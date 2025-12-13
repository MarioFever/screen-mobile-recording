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
      const targetW = width * devicePixelRatio;
      const targetH = height * devicePixelRatio;
      
      // Assume center alignment
      const startX = (videoWidth - targetW) / 2;
      const startY = (videoHeight - targetH) / 2;
      
      // We will clear and draw
      processContext.fillStyle = '#000';
      processContext.fillRect(0, 0, processCanvas.width, processCanvas.height);
      
      processContext.drawImage(
        sourceVideo, 
        startX, startY, targetW, targetH, // Source crop
        0, 0, targetW, targetH // Destination
      );
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();

    // 5. Create stream from canvas
    canvasStream = processCanvas.captureStream(30); // 30 FPS
    
    // 6. Start MediaRecorder
    // Use higher bitrate for quality
    mediaRecorder = new MediaRecorder(canvasStream, { 
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000 // 5Mbps
    });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Send to background to download via chrome.downloads API
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_RECORDING',
        url: url,
        filename: `mobile-recording-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.webm`
      });
      
      statusDiv.textContent = 'Processing download...';

      // Keep stream alive briefly to allow download logic to pick up the blob URL if needed
      // (Though chrome.downloads can handle blob URLs from same extension)
      setTimeout(() => {
        // Cleanup
        URL.revokeObjectURL(url);
        cancelAnimationFrame(animationId);
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
        sourceVideo.srcObject = null;
        statusDiv.textContent = 'Idle';
      }, 5000); // 5 seconds grace period
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
