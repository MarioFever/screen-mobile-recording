let startTime = Date.now();
const timerElement = document.getElementById('timer');
const stopBtn = document.getElementById('stopBtn');

// Timer Logic
setInterval(() => {
  const diff = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(diff / 60).toString().padStart(2, '0');
  const secs = (diff % 60).toString().padStart(2, '0');
  timerElement.textContent = `${mins}:${secs}`;
}, 1000);

// Stop Logic
stopBtn.addEventListener('click', () => {
  // Send message to background script to stop recording
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
  // Window will be closed by background script
});

