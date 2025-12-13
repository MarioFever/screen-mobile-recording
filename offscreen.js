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

    // 2. Setup video element to play the stream
    sourceVideo = document.getElementById('sourceVideo');
    sourceVideo.srcObject = stream;
    await sourceVideo.play();

    // 3. Setup Canvas
    processCanvas = document.getElementById('processCanvas');
    processContext = processCanvas.getContext('2d', { alpha: true }); // Enable alpha for transparency effects

    // Emulated DPR
    let dpr = devicePixelRatio || 1;
    
    // Calculate Logical Sizes
    const screenLogicalW = width;
    const screenLogicalH = height;

    // Frame configuration (Modern iPhone style)
    // Scale bezels based on device size. Roughly 4% of width.
    const bezel = Math.round(screenLogicalW * 0.05); 
    const cornerRadius = Math.round(screenLogicalW * 0.12); // ~12% for rounded corners
    const homeIndicatorW = Math.round(screenLogicalW * 0.35);
    const homeIndicatorH = Math.round(5 * (dpr/3)); // Scale thickness
    const homeIndicatorY = Math.round(screenLogicalH - 15);

    // Frame Dimensions (Logical)
    const frameLogicalW = screenLogicalW + (bezel * 2);
    const frameLogicalH = screenLogicalH + (bezel * 2);

    // Canvas Size (Physical Pixels)
    processCanvas.width = frameLogicalW * dpr;
    processCanvas.height = frameLogicalH * dpr;

    console.log(`Frame: ${frameLogicalW}x${frameLogicalH} (Logical), Canvas: ${processCanvas.width}x${processCanvas.height} (Physical), DPR: ${dpr}`);

    // Helper to draw rounded rect
    function roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // 4. Draw loop
    const draw = () => {
      if (sourceVideo.paused || sourceVideo.ended) return;
      
      const videoWidth = sourceVideo.videoWidth;
      const videoHeight = sourceVideo.videoHeight;
      
      // --- CROP LOGIC (Get content from stream) ---
      const targetRatio = screenLogicalW / screenLogicalH;
      const videoRatio = videoWidth / videoHeight;
      
      let cropW, cropH;
      
      if (videoRatio > targetRatio) {
        cropH = videoHeight;
        cropW = cropH * targetRatio;
      } else {
        cropW = videoWidth;
        cropH = cropW / targetRatio;
      }
      
      const cropX = (videoWidth - cropW) / 2;
      const cropY = (videoHeight - cropH) / 2;
      
      // --- DRAW FRAME & CONTENT ---
      // Scale everything to physical pixels for canvas drawing
      const ctx = processContext;
      const scale = dpr;
      
      const frameW = frameLogicalW * scale;
      const frameH = frameLogicalH * scale;
      const screenW = screenLogicalW * scale;
      const screenH = screenLogicalH * scale;
      const bezelSize = bezel * scale;
      const radius = cornerRadius * scale;
      
      // 1. Clear Canvas (Transparent)
      ctx.clearRect(0, 0, frameW, frameH);
      
      // 2. Draw Bezel (Body) - Black
      ctx.fillStyle = '#000000'; // Deep black for OLED look
      roundRect(ctx, 0, 0, frameW, frameH, radius + bezelSize/2); // Outer radius
      ctx.fill();
      
      // 3. Draw Inner Border (Screen Edge) - Dark Gray/Stroke
      // Optional: Add a subtle stroke around screen
      
      // 4. Draw Screen Content
      // We need to mask the screen content to be rounded
      ctx.save();
      ctx.translate(bezelSize, bezelSize); // Move to screen area
      roundRect(ctx, 0, 0, screenW, screenH, radius); // Inner radius
      ctx.clip(); // Clip to screen shape
      
      // Draw Video
      // Use high quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(
        sourceVideo, 
        cropX, cropY, cropW, cropH, // Source
        0, 0, screenW, screenH      // Destination
      );
      
      // Draw inner shadow/border for realism?
      // ctx.strokeStyle = "rgba(0,0,0,0.1)";
      // ctx.lineWidth = 4;
      // ctx.stroke();
      
      ctx.restore();
      
      // 5. Draw Notch / Dynamic Island
      const notchW = screenW * 0.3;
      const notchH = notchW * 0.3; // Aspect ratio of dynamic island roughly
      const notchX = (frameW - notchW) / 2;
      const notchY = bezelSize + (notchH * 0.3); // Positioned slightly down from top bezel
      
      ctx.fillStyle = '#000000';
      roundRect(ctx, notchX, notchY, notchW, notchH, notchH/2);
      ctx.fill();

      // 6. Draw Home Indicator (Bottom Line)
      // Only if desired. Chrome emulation often lacks it.
      const hiW = homeIndicatorW * scale;
      const hiH = homeIndicatorH * scale; // Thickness
      const hiX = (frameW - hiW) / 2;
      const hiY = frameH - bezelSize - (15 * scale); // 15px logical from bottom
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      roundRect(ctx, hiX, hiY, hiW, hiH, hiH/2);
      ctx.fill();
      
      // 7. Glossy reflection on bezel (Optional - subtle)
      // Linear gradient
      /*
      const grad = ctx.createLinearGradient(0, 0, frameW, frameH);
      grad.addColorStop(0, 'rgba(255,255,255,0.1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = grad;
      roundRect(ctx, 0, 0, frameW, frameH, radius + bezelSize/2);
      ctx.fill();
      */

    };
    
    // 30 FPS
    animationId = setInterval(draw, 1000 / 30);
    
    // 5. Create stream from canvas
    canvasStream = processCanvas.captureStream(30);
    
    // 6. Start MediaRecorder
    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      mimeType = 'video/webm;codecs=h264';
    }

    console.log('Using mimeType:', mimeType);

    mediaRecorder = new MediaRecorder(canvasStream, { 
      mimeType: mimeType,
      videoBitsPerSecond: 8000000 // 8Mbps for high quality with frame
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
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_RECORDING',
        url: url,
        filename: `mobile-recording-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.${ext}`
      });
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
        clearInterval(animationId);
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
        sourceVideo.srcObject = null;
        statusDiv.textContent = 'Idle';
      }, 5000);
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
