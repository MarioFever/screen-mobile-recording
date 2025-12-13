// Background service worker

// Ensure offscreen document exists
async function setupOffscreenDocument(path) {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['USER_MEDIA'],
      justification: 'Recording screen content',
    });
    await creating;
    creating = null;
  }
}

let creating; // Promise keeper
let isRecording = false;
let controlsWindowId = null;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING_REQUEST') {
    // Inject the PiP controller script which will:
    // 1. Show overlay "Click to start"
    // 2. Open PiP window on click
    // 3. Send back 'PIP_OPENED_START_RECORDING'
    
    // Store params for when we actually start
    await chrome.storage.local.set({ 
      pendingRecording: { 
        tabId: message.tabId, 
        showNotch: message.showNotch 
      }
    });

    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['pip-controller.js']
    });
    
  } else if (message.type === 'PIP_OPENED_START_RECORDING') {
    // Now actually start recording
    const data = await chrome.storage.local.get('pendingRecording');
    if (data.pendingRecording) {
      startCapture(data.pendingRecording.tabId, data.pendingRecording.showNotch);
      isRecording = true;
      // Clear pending
      chrome.storage.local.remove('pendingRecording');
    }

  } else if (message.type === 'STOP_RECORDING_REQUEST') {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_RECORDING' });
    isRecording = false;
    // PiP window closes itself via script
    
  } else if (message.type === 'GET_RECORDING_STATE') {
    sendResponse({ isRecording });
  } else if (message.type === 'DOWNLOAD_RECORDING') {
    // Handle download from background to avoid offscreen limitations
    chrome.downloads.download({
      url: message.url,
      filename: message.filename
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
      } else {
        console.log('Download started, ID:', downloadId);
      }
    });
  }
});

async function startCapture(tabId, showNotch = true) {
  try {
    // 1. Get tab info/dimensions via scripting
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        };
      }
    });
    
    const dimensions = results[0].result;
    console.log('Detected dimensions:', dimensions);
    
    // 2. Get Media Stream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });

    // 3. Setup Offscreen Doc (Resetting it to ensure fresh state)
    // Check if offscreen exists and close it to ensure fresh state
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
    
    // Create fresh document
    await setupOffscreenDocument('offscreen.html');

    // 4. Send start message to offscreen
    // Wait a bit to ensure offscreen is ready receiving messages
    setTimeout(() => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'START_RECORDING',
        data: {
          streamId: streamId,
          width: dimensions.width,
          height: dimensions.height,
          devicePixelRatio: dimensions.devicePixelRatio,
          showNotch: showNotch
        }
      });
      
      // Floating UI injection removed
      
    }, 500);

  } catch (err) {
    console.error('Error starting capture:', err);
    isRecording = false; // Reset state on error
  }
}
