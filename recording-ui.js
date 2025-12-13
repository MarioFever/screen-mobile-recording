(function() {
  // Prevent multiple injections
  if (document.getElementById('smr-floating-ui')) return;

  let startTime = Date.now();
  let timerInterval;

  // Create Container
  const container = document.createElement('div');
  container.id = 'smr-floating-ui';
  container.className = 'smr-floating-controls';
  
  // Show immediately
  container.style.display = 'flex';

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

  // Drag Logic
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  container.addEventListener("mousedown", dragStart);
  window.addEventListener("mouseup", dragEnd);
  window.addEventListener("mousemove", drag);

  function dragStart(e) {
    if (e.target.closest('.smr-stop-btn')) return;
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (container.contains(e.target)) {
      isDragging = true;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      
      container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }

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

