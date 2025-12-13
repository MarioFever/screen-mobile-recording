let startTime;
const timerElement = document.getElementById('timer');
const stopBtn = document.getElementById('stopBtn');

// Initialize
chrome.storage.local.get(['recordingStartTime'], (result) => {
  if (result.recordingStartTime) {
    startTime = result.recordingStartTime;
    startTimer();
  } else {
    // If no start time, maybe we just started? Or not recording.
    // Listen for start.
    timerElement.textContent = "--:--";
  }
});

function startTimer() {
  setInterval(() => {
    if (!startTime) return;
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    timerElement.textContent = `${mins}:${secs}`;
  }, 1000);
}

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
  // Close side panel? 
  // chrome.sidePanel.setOptions({ enabled: false }); // Cannot close easily, but we can reset UI
  window.close();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RECORDING_STARTED') {
    startTime = Date.now();
    chrome.storage.local.set({ recordingStartTime: startTime });
    startTimer();
  } else if (message.type === 'RECORDING_STOPPED') {
    startTime = null;
    chrome.storage.local.remove('recordingStartTime');
    timerElement.textContent = "Saved!";
    setTimeout(() => window.close(), 2000);
  }
});

