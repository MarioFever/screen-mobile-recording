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

    // 2. Attach Debugger to Clean UI (Remove Tooltips/Rulers)
    // We replicate the current exact dimensions into the debugger emulation
    // This "locks" the view but removes the DevTools overlay artifacts.
    try {
      await chrome.debugger.attach({ tabId: tabId }, "1.3");
      
      await chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.setDeviceMetricsOverride", {
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: dimensions.devicePixelRatio,
        mobile: true,
        fitWindow: false 
      });
      
      // Enable touch
      await chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.setTouchEmulationEnabled", {
        enabled: true
      });
      
      // Wait a moment for layout settle
      await new Promise(r => setTimeout(r, 300));
      
    } catch (dbgErr) {
      console.warn("Debugger attach failed or rejected (maybe already attached?):", dbgErr);
    }
    
    // 3. Get Media Stream ID
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
      
      // Inject script to hide Chrome resolution tooltip if possible via CSS injection into the DevTools frontend?
      // No, extensions cannot inject CSS into DevTools.
      
      // Attempt to hide the tooltip by injecting a very specific style into the page
      // that pushes content down slightly or overlays a blocking element?
      // No, the tooltip is outside the DOM.
      
      // BEST EFFORT: Inject script to force links to open in same tab
      injectLinkEnforcer(tabId);
      
    }, 500);

  } catch (err) {
    console.error('Error starting capture:', err);
    isRecording = false; // Reset state on error
  }
}
