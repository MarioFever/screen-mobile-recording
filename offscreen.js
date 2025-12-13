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
    processContext = processCanvas.getContext('2d', { alpha: false });

    // Use the EMULATED device pixel ratio passed from background (e.g. 3 for iPhone)
    // This assumes tabCapture captures at the full emulated resolution.
    let dpr = devicePixelRatio || 1;
    
    // Set canvas to the TARGET LOGICAL SIZE (e.g. 430x932) requested by user
    // We will draw the high-res crop into this canvas, effectively downscaling it
    // to the requested resolution.
    processCanvas.width = width;
    processCanvas.height = height;

    console.log(`Target Output: ${width}x${height}, Crop DPR: ${dpr}`);

    // 4. Draw loop
    const draw = () => {
      if (sourceVideo.paused || sourceVideo.ended) return;
      
      const videoWidth = sourceVideo.videoWidth;
      const videoHeight = sourceVideo.videoHeight;
      
      // Calculate Crop Size based on Emulated DPR
      let cropW = width * dpr;
      let cropH = height * dpr;
      
      // Safety check: If emulated resolution is LARGER than actual video stream
      // (e.g. user zoomed out, or non-retina screen handling), fallback to fitting the video.
      if (cropW > videoWidth || cropH > videoHeight) {
          // If the difference is huge, maybe dpr 1 is better?
          // Let's try to just crop the logical width if high-res fails
          if (width <= videoWidth) {
              cropW = width;
              cropH = height;
          } else {
             // Fallback: just use full video? No, keep aspect ratio?
             // Let's stick to center crop of whatever is available
             cropW = Math.min(cropW, videoWidth);
             cropH = Math.min(cropH, videoHeight);
          }
      }
      
      const startX = (videoWidth - cropW) / 2;
      const startY = (videoHeight - cropH) / 2;
      
      // Draw black background first
      processContext.fillStyle = '#000';
      processContext.fillRect(0, 0, processCanvas.width, processCanvas.height);
      
      processContext.drawImage(
        sourceVideo, 
        startX, startY, cropW, cropH, // Source crop
        0, 0, processCanvas.width, processCanvas.height // Destination (Scaled to logical)
      );
    };
    
    // 30 FPS
    animationId = setInterval(draw, 1000 / 30);
    
    // 5. Create stream from canvas
    canvasStream = processCanvas.captureStream(30); // 30 FPS
    
    // 6. Start MediaRecorder
    // Try to use MP4 if supported, otherwise fallback to WebM
    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      mimeType = 'video/webm;codecs=h264';
    }

    console.log('Using mimeType:', mimeType);

    // Use higher bitrate for quality
    mediaRecorder = new MediaRecorder(canvasStream, { 
      mimeType: mimeType,
      videoBitsPerSecond: 5000000 // 5Mbps
    });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      // Determine extension based on mimeType
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      
      // Send to background to download via chrome.downloads API
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_RECORDING',
        url: url,
        filename: `mobile-recording-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.${ext}`
      });
      
      statusDiv.textContent = 'Processing download...';

      // Keep stream alive briefly to allow download logic to pick up the blob URL if needed
      // (Though chrome.downloads can handle blob URLs from same extension)
      setTimeout(() => {
        // Cleanup
        URL.revokeObjectURL(url);
        clearInterval(animationId);
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
