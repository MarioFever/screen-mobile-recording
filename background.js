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
      consumerTabId: tabId, // Wait, we pass the *target* tab ID? No, consumer is usually the one *using* it.
      // Actually, for offscreen document, we might not need to specify consumerTabId if we are the extension.
      // But let's try passing the target tabId as the target.
      targetTabId: tabId
    });

    // 3. Setup Offscreen Doc
    await setupOffscreenDocument('offscreen.html');

    // 4. Send start message to offscreen
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

  } catch (err) {
    console.error('Error starting capture:', err);
  }
}
