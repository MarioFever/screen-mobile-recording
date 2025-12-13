chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_RECORDING') {
    startRecording(message.data);
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording();
  }
});

let mediaRecorder;
let recordedChunks = [];
let sourceVideo;
let processCanvas;
let processContext;
let animationId;
let stream;
let canvasStream;

async function startRecording(data) {
  const { streamId, width, height, devicePixelRatio } = data;
  
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Starting recording...';

  try {
    // 1. Get the stream using the ID from tabCapture
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    // 2. Setup video element to play the stream (needed for canvas drawing)
    sourceVideo = document.getElementById('sourceVideo');
    sourceVideo.srcObject = stream;
    await sourceVideo.play();

    // 3. Setup Canvas for cropping
    processCanvas = document.getElementById('processCanvas');
    processContext = processCanvas.getContext('2d');

    // Use the target mobile dimensions
    processCanvas.width = width * devicePixelRatio;
    processCanvas.height = height * devicePixelRatio;

    // 4. Draw loop
    const draw = () => {
      if (sourceVideo.paused || sourceVideo.ended) return;
      
      const videoWidth = sourceVideo.videoWidth;
      const videoHeight = sourceVideo.videoHeight;
      
      // Calculate crop (center)
      // We want to grab the center 'width * devicePixelRatio' from the source
      // If the source is the full tab, and the content is centered
      
      const targetW = width * devicePixelRatio;
      const targetH = height * devicePixelRatio;
      
      const startX = (videoWidth - targetW) / 2;
      const startY = 0; // Usually device mode starts at top, but sometimes centered vertically too? 
      // In device mode, the content area is usually centered horizontally. 
      // Vertically it depends. Usually there is a top bar in Chrome.
      // However, tabCapture captures the *content viewport*. 
      // If "Device Mode" is active, the viewport includes the gray background.
      // The "phone" is usually centered.
      
      // Let's assume horizontal center and vertical top (or center?).
      // In the provided screenshot, it looks vertically centered-ish?
      // Actually, let's try to center both.
      const startY_center = (videoHeight - targetH) / 2;
      
      // We will clear and draw
      processContext.fillStyle = '#000';
      processContext.fillRect(0, 0, processCanvas.width, processCanvas.height);
      
      processContext.drawImage(
        sourceVideo, 
        startX, startY_center, targetW, targetH, // Source crop
        0, 0, targetW, targetH // Destination
      );
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();

    // 5. Create stream from canvas
    canvasStream = processCanvas.captureStream(30); // 30 FPS
    
    // 6. Start MediaRecorder
    mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Download the file
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `mobile-recording-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.webm`;
      document.body.appendChild(a);
      a.click();
      
      // Keep cleanup slightly delayed to ensure download triggers
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Cleanup streams
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
        sourceVideo.srcObject = null;
        
        // Close offscreen document to save resources? 
        // No, keep it open for next time or let background handle it.
        // Actually, closing it might stop the download if not careful?
        // Offscreen documents have a lifetime limit anyway.
        
      }, 1000); // Increased timeout to be safe
      
      cancelAnimationFrame(animationId);
      statusDiv.textContent = 'Idle';
    };

    mediaRecorder.start();
    statusDiv.textContent = 'Recording...';

  } catch (err) {
    console.error('Error starting recording:', err);
    statusDiv.textContent = 'Error: ' + err.message;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

