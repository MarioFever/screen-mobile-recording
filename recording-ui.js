(function() {
  // Prevent multiple injections
  if (document.getElementById('smr-overlay-root')) return;

  let startTime = Date.now();
  let timerInterval;

  // Create Shadow DOM Root to isolate styles
  const host = document.createElement('div');
  host.id = 'smr-overlay-root';
  document.documentElement.appendChild(host); // Append to HTML to be above everything
  
  const shadow = host.attachShadow({ mode: 'closed' });

  // Add Styles
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('recording-ui.css');
  shadow.appendChild(styleLink);

  // Create UI Structure
  const container = document.createElement('div');
  container.className = 'smr-overlay-container';
  
  const box = document.createElement('div');
  box.className = 'smr-controls-box';

  const dot = document.createElement('div');
  dot.className = 'smr-dot';

  const timer = document.createElement('div');
  timer.className = 'smr-timer';
  timer.textContent = '00:00';

  const stopBtn = document.createElement('button');
  stopBtn.className = 'smr-stop-btn';
  stopBtn.title = 'Stop Recording';
  
  const stopIcon = document.createElement('div');
  stopIcon.className = 'smr-stop-icon';
  
  stopBtn.appendChild(stopIcon);
  box.appendChild(dot);
  box.appendChild(timer);
  box.appendChild(stopBtn);
  container.appendChild(box);
  shadow.appendChild(container);

  // Timer Logic
  function updateTimer() {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    timer.textContent = `${mins}:${secs}`;
  }

  timerInterval = setInterval(updateTimer, 1000);

  // Stop Action
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
  });

  // Listen for removal
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RECORDING_STOPPED') {
      clearInterval(timerInterval);
      box.style.opacity = '0';
      box.style.transform = 'translateY(-20px)';
      setTimeout(() => host.remove(), 300);
    }
  });
})();
