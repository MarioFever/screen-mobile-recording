// pip-controller.js

(async function() {
  // 1. Create and show the "Click to Start" overlay
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '2147483647',
    cursor: 'pointer',
    fontFamily: '-apple-system, system-ui, sans-serif'
  });

  overlay.innerHTML = `
    <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Click anywhere to start recording</div>
    <div style="font-size: 16px; opacity: 0.8;">This ensures the controls stay on top of the screen</div>
  `;

  document.body.appendChild(overlay);

  // 2. Wait for click
  await new Promise(resolve => {
    overlay.addEventListener('click', () => {
      overlay.remove();
      resolve();
    }, { once: true });
  });

  // 3. Open Document Picture-in-Picture Window
  try {
    const pipWindow = await documentPictureInPicture.requestWindow({
      width: 220,
      height: 80,
    });

    // 4. Style and Content for PiP
    // Copy main document style sheets to ensure consistent font rendering if needed (optional)
    // For now, inline styles are safer.

    const pipDoc = pipWindow.document;
    pipDoc.body.style.margin = '0';
    pipDoc.body.style.background = '#202124';
    pipDoc.body.style.color = '#fff';
    pipDoc.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    pipDoc.body.style.display = 'flex';
    pipDoc.body.style.alignItems = 'center';
    pipDoc.body.style.justifyContent = 'center';
    pipDoc.body.style.height = '100%';

    pipDoc.body.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 10px; height: 10px; background: #ff4444; border-radius: 50%; box-shadow: 0 0 8px #ff4444; animation: pulse 2s infinite;"></div>
        <div id="timer" style="font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 500;">00:00</div>
        <button id="stopBtn" style="background: #fff; border: none; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 8px;">
          <div style="width: 10px; height: 10px; background: #202124; border-radius: 2px;"></div>
        </button>
      </div>
      <style>
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        button:hover { background: #f0f0f0 !important; transform: scale(1.1); }
      </style>
    `;

    // 5. Timer Logic
    const startTime = Date.now();
    const timerElem = pipDoc.getElementById('timer');
    const interval = setInterval(() => {
      if (pipWindow.closed) {
        clearInterval(interval);
        return;
      }
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(diff / 60).toString().padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      timerElem.textContent = `${mins}:${secs}`;
    }, 1000);

    // 6. Stop Handler
    pipDoc.getElementById('stopBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
      pipWindow.close();
    });

    // Handle PiP close by X button
    pipWindow.addEventListener('pagehide', () => {
      // If closed manually, stop recording too?
      chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
    });

    // 7. Notify Background to Start Recording
    chrome.runtime.sendMessage({ type: 'PIP_OPENED_START_RECORDING' });

  } catch (err) {
    console.error("Failed to open PiP:", err);
    alert("Could not open floating controls. Please try again.");
  }

})();

