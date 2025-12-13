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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING_REQUEST') {
    startCapture(message.tabId);
    isRecording = true;
  } else if (message.type === 'STOP_RECORDING_REQUEST') {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_RECORDING' });
    isRecording = false;
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

async function startCapture(tabId) {
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

    // 3. Setup Offscreen Doc
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
          devicePixelRatio: dimensions.devicePixelRatio
        }
      });
    }, 500);

  } catch (err) {
    console.error('Error starting capture:', err);
    isRecording = false; // Reset state on error
  }
}
