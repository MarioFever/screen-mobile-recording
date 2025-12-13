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
let recordingTabId = null;
let recordingStartTime = null;
let timerInterval = null;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING_REQUEST') {
    startCapture(message.tabId, message.showNotch);
    isRecording = true;
    recordingTabId = message.tabId;
    
    // Start Icon Timer
    recordingStartTime = Date.now();
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    chrome.action.setBadgeText({ text: '0:00' });
    
    // Disable popup so clicking icon fires onClicked
    chrome.action.setPopup({ popup: '' });

    timerInterval = setInterval(() => {
      const diff = Math.floor((Date.now() - recordingStartTime) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = (diff % 60).toString().padStart(2, '0');
      chrome.action.setBadgeText({ text: `${mins}:${secs}` });
    }, 1000);

  } else if (message.type === 'STOP_RECORDING_REQUEST') {
    stopRecording();
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

// Handle Icon Click to Stop
chrome.action.onClicked.addListener((tab) => {
  if (isRecording) {
    stopRecording();
  }
});

function stopRecording() {
  if (!isRecording) return;
  
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_RECORDING' });
  
  // Detach debugger to restore view
  if (recordingTabId) {
    chrome.debugger.detach({ tabId: recordingTabId }).catch(() => {});
  }
  
  isRecording = false;
  
  // Clear Timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  chrome.action.setBadgeText({ text: '' });
  
  // Re-enable popup
  chrome.action.setPopup({ popup: 'popup.html' });
  recordingTabId = null;
}

// Ensure link forcing script is injected on every page load during recording
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isRecording && recordingTabId && tabId === recordingTabId && changeInfo.status === 'loading') {
    injectLinkEnforcer(tabId);
  }
});

function injectLinkEnforcer(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      // Prevent multiple injections
      if (window.__linkEnforcerAttached) return;
      window.__linkEnforcerAttached = true;
      
      window.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.target === '_blank') {
          link.target = '_self';
        }
      }, true);
    }
  }).catch(() => {});
}

async function startCapture(tabId, showNotch = true) {
  try {
    // 1. Enable Debugger for Mobile Emulation (Clean View without Tooltips)
    await chrome.debugger.attach({ tabId: tabId }, "1.3");
    
    await chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.setDeviceMetricsOverride", {
      width: 430,
      height: 932,
      deviceScaleFactor: 3,
      mobile: true,
      fitWindow: true
    });
    
    await chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.setTouchEmulationEnabled", {
      enabled: true
    });
    
    // Slight delay to allow layout to update
    await new Promise(r => setTimeout(r, 500));

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
          width: 430, // Hardcoded to match emulation
          height: 932,
          devicePixelRatio: 3,
          showNotch: showNotch
        }
      });
      
      // Inject script to force links to open in same tab
      injectLinkEnforcer(tabId);
      
    }, 500);

  } catch (err) {
    console.error('Error starting capture:', err);
    isRecording = false; // Reset state on error
  }
}
