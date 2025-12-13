document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const notchToggle = document.getElementById('notch-toggle');
  
  // Load saved setting
  chrome.storage.local.get(['showNotch'], (result) => {
    if (result.showNotch !== undefined) {
      notchToggle.checked = result.showNotch;
    }
  });

  // Save setting on change
  notchToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showNotch: notchToggle.checked });
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
      // statusText removed
      notchToggle.disabled = true; // Disable toggle while recording
    } else {
      startBtn.textContent = 'Start Recording';
      startBtn.style.background = '#00d4aa';
      // statusText removed
      notchToggle.disabled = false;
    }
  }

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get current state to toggle
    chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
      const isRecording = response ? response.isRecording : false;
      
      if (!isRecording) {
        // Start
        chrome.runtime.sendMessage({ 
          type: 'START_RECORDING_REQUEST',
          tabId: tab.id,
          showNotch: notchToggle.checked
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
