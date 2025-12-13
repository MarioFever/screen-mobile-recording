document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const statusText = document.querySelector('.recording-controls p');
  
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
      statusText.textContent = 'Recording...';
    } else {
      startBtn.textContent = 'Start Recording';
      startBtn.style.background = '#00d4aa';
      statusText.textContent = 'Ready to record';
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
          hostDPR: window.devicePixelRatio // Send host system DPR
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
