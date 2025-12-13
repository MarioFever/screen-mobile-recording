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

  // Add Styles inline to ensure they load regardless of file access issues
  const style = document.createElement('style');
  style.textContent = `
    .smr-overlay-container {
      all: initial;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: visible;
      display: block !important;
      /* Ensure it stays fixed relative to the viewport, ignoring parent transforms */
      contain: layout size style; 
    }
    .smr-controls-box {
      position: absolute;
      top: 10px;
      right: 20px;
      /* Ensure high contrast and visibility */
      background: #202124 !important;
      color: #fff !important;
      padding: 8px 16px;
      border-radius: 40px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: auto;
      border: 1px solid rgba(255,255,255,0.1);
      opacity: 0;
      transform: translateY(-20px);
      animation: smr-slide-in 0.3s forwards ease-out;
    }
    @keyframes smr-slide-in {
      to { opacity: 1; transform: translateY(0); }
    }
    .smr-dot {
      width: 10px;
      height: 10px;
      background-color: #ff4444;
      border-radius: 50%;
      box-shadow: 0 0 8px #ff4444;
      animation: smr-pulse 2s infinite;
    }
    @keyframes smr-pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    .smr-timer {
      font-variant-numeric: tabular-nums;
      font-size: 14px;
      font-weight: 500;
      min-width: 45px;
      color: #ffffff;
    }
    .smr-stop-btn {
      background: #fff;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s;
      padding: 0;
      margin: 0;
    }
    .smr-stop-btn:hover {
      transform: scale(1.1);
      background: #f0f0f0;
    }
    .smr-stop-icon {
      width: 10px;
      height: 10px;
      background-color: #202124;
      border-radius: 2px;
    }
  `;
  shadow.appendChild(style);

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
