document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const notchToggle = document.getElementById('notch-toggle');
  const frameToggle = document.getElementById('frame-toggle');
  const mp4Toggle = document.getElementById('mp4-toggle');
  const webmToggle = document.getElementById('webm-toggle');
  const bgStyleSelect = document.getElementById('bg-style');
  
  // Load saved settings
  chrome.storage.local.get(['showNotch', 'showFrame', 'recordMP4', 'recordWebM', 'bgStyle'], (result) => {
    if (result.showNotch !== undefined) {
      notchToggle.checked = result.showNotch;
    }
    if (result.showFrame !== undefined) {
      frameToggle.checked = result.showFrame;
    }
    // Default to true if not set
    mp4Toggle.checked = result.recordMP4 !== undefined ? result.recordMP4 : true;
    webmToggle.checked = result.recordWebM !== undefined ? result.recordWebM : true;
    
    if (result.bgStyle) {
        bgStyleSelect.value = result.bgStyle;
    }
  });

  // Save settings on change
  notchToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showNotch: notchToggle.checked });
  });
  
  frameToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showFrame: frameToggle.checked });
  });

  mp4Toggle.addEventListener('change', () => {
    chrome.storage.local.set({ recordMP4: mp4Toggle.checked });
  });

  webmToggle.addEventListener('change', () => {
    chrome.storage.local.set({ recordWebM: webmToggle.checked });
  });
  
  bgStyleSelect.addEventListener('change', () => {
      chrome.storage.local.set({ bgStyle: bgStyleSelect.value });
  });
  
  // Check initial state
  chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
    if (response && response.isRecording) {
      updateUI(true);
    }
  });

  function updateUI(recording) {
    if (recording) {
      startBtn.textContent = 'Stop Recording';
      startBtn.style.background = '#ff4757';
      
      screenshotBtn.disabled = true;
      screenshotBtn.style.opacity = 0.5;
      notchToggle.disabled = true; 
      frameToggle.disabled = true;
      mp4Toggle.disabled = true;
      webmToggle.disabled = true;
      bgStyleSelect.disabled = true;
    } else {
      startBtn.textContent = 'Start Recording';
      startBtn.style.background = '#00d4aa';
      
      screenshotBtn.disabled = false;
      screenshotBtn.style.opacity = 1;
      notchToggle.disabled = false;
      frameToggle.disabled = false;
      mp4Toggle.disabled = false;
      webmToggle.disabled = false;
      bgStyleSelect.disabled = false;
    }
  }

  screenshotBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.runtime.sendMessage({ 
      type: 'TAKE_SCREENSHOT_REQUEST',
      tabId: tab.id,
      showNotch: notchToggle.checked,
      showFrame: frameToggle.checked,
      bgStyle: bgStyleSelect.value
    });
  });

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Validate at least one format is selected
    if (!mp4Toggle.checked && !webmToggle.checked) {
      alert('Please select at least one output format (MP4 or WebM).');
      return;
    }

    // Get current state to toggle
    chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
      const isRecording = response ? response.isRecording : false;
      
      if (!isRecording) {
        // Start
        chrome.runtime.sendMessage({ 
          type: 'START_RECORDING_REQUEST',
          tabId: tab.id,
          showNotch: notchToggle.checked,
          showFrame: frameToggle.checked,
          recordMP4: mp4Toggle.checked,
          recordWebM: webmToggle.checked,
          bgStyle: bgStyleSelect.value
        });
        updateUI(true);
      } else {

        // Stop
        chrome.runtime.sendMessage({ 
          type: 'STOP_RECORDING_REQUEST'
        });
        updateUI(false);
      }
    });
  });
});
