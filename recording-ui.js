(function() {
  // Prevent multiple injections
  if (document.getElementById('smr-floating-ui')) return;

  let startTime = Date.now();
  let timerInterval;

  // Create Container
  const container = document.createElement('div');
  container.id = 'smr-floating-ui';
  container.className = 'smr-floating-controls';

  // Red Dot
  const dot = document.createElement('div');
  dot.className = 'smr-dot';

  // Timer
  const timer = document.createElement('div');
  timer.className = 'smr-timer';
  timer.textContent = '00:00';

  // Stop Button
  const stopBtn = document.createElement('button');
  stopBtn.className = 'smr-stop-btn';
  stopBtn.title = 'Stop Recording';
  
  const stopIcon = document.createElement('div');
  stopIcon.className = 'smr-stop-icon';
  
  stopBtn.appendChild(stopIcon);

  // Assemble
  container.appendChild(dot);
  container.appendChild(timer);
  container.appendChild(stopBtn);
  document.body.appendChild(container);

  // Timer Logic
  function updateTimer() {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    timer.textContent = `${mins}:${secs}`;
  }

  timerInterval = setInterval(updateTimer, 1000);

  // Stop Action
  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
  });

  // Listen for removal
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RECORDING_STOPPED') {
      clearInterval(timerInterval);
      container.style.opacity = '0';
      setTimeout(() => container.remove(), 300);
    }
  });
})();

