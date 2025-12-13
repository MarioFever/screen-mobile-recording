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
  const { streamId, width, height, devicePixelRatio, showNotch } = data;
  
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Starting recording...';

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    sourceVideo = document.getElementById('sourceVideo');
    sourceVideo.srcObject = stream;
    await sourceVideo.play();

    processCanvas = document.getElementById('processCanvas');
    processContext = processCanvas.getContext('2d', { alpha: true });

    let dpr = devicePixelRatio || 1;
    
    const screenLogicalW = width;
    const screenLogicalH = height;

    const bezel = Math.round(screenLogicalW * 0.045);
    const cornerRadius = Math.round(screenLogicalW * 0.13);
    const homeIndicatorW = Math.round(screenLogicalW * 0.35);
    const homeIndicatorH = Math.round(5 * (dpr/3));
    
    const frameLogicalW = screenLogicalW + (bezel * 2);
    const frameLogicalH = screenLogicalH + (bezel * 2);

    processCanvas.width = frameLogicalW * dpr;
    processCanvas.height = frameLogicalH * dpr;

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

    function drawSignal(ctx, x, y, w, h) {
        const gap = w * 0.2;
        const barW = (w - (3 * gap)) / 4;
        for (let i = 0; i < 4; i++) {
            const barH = h * (0.4 + (0.2 * i));
            ctx.fillStyle = '#FFFFFF';
            roundRect(ctx, x + (i * (barW + gap)), y + (h - barH), barW, barH, 1);
            ctx.fill();
        }
    }

    function drawWifi(ctx, x, y, size) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x + size/2, y + size, size * 0.9, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + size/2, y + size, size * 0.6, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x + size/2, y + size * 0.9, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBattery(ctx, x, y, w, h) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, w, h, h/3);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, x + 2, y + 2, w - 4, h - 4, h/4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x + w + 2, y + h/2, h/4, Math.PI * 0.5, Math.PI * 1.5, true);
        ctx.fill();
    }

    // Helper canvas for color sampling
    const colorCanvas = new OffscreenCanvas(1, 1);
    const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });

    const draw = () => {
      if (sourceVideo.paused || sourceVideo.ended) return;
      
      const videoWidth = sourceVideo.videoWidth;
      const videoHeight = sourceVideo.videoHeight;
      
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
      
      // --- Sample Background Color ---
      // Get color from the top-center of the actual video content
      colorCtx.drawImage(sourceVideo, cropX + (cropW/2), cropY, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = colorCtx.getImageData(0, 0, 1, 1).data;
      const navColor = `rgb(${r}, ${g}, ${b})`;
      
      const ctx = processContext;
      const scale = dpr;
      
      const frameW = frameLogicalW * scale;
      const frameH = frameLogicalH * scale;
      const screenW = screenLogicalW * scale;
      const screenH = screenLogicalH * scale;
      const bezelSize = bezel * scale;
      const radius = cornerRadius * scale;
      
      ctx.clearRect(0, 0, frameW, frameH);

      // --- Botones Laterales (Silver) ---
      ctx.fillStyle = '#D1D1D6';
      roundRect(ctx, -2*scale, 100*scale, 6*scale, 20*scale, 2*scale);
      roundRect(ctx, -2*scale, 140*scale, 6*scale, 45*scale, 2*scale);
      roundRect(ctx, -2*scale, 200*scale, 6*scale, 45*scale, 2*scale);
      roundRect(ctx, frameW - 4*scale, 160*scale, 6*scale, 70*scale, 2*scale);
      ctx.fill();
      
      // --- Marco Exterior (Chasis Metálico Silver) ---
      const grad = ctx.createLinearGradient(0, 0, frameW, 0);
      grad.addColorStop(0, '#8E8E93');
      grad.addColorStop(0.05, '#E5E5EA');
      grad.addColorStop(0.2, '#D1D1D6');
      grad.addColorStop(0.8, '#D1D1D6');
      grad.addColorStop(0.95, '#E5E5EA');
      grad.addColorStop(1, '#8E8E93');
      
      ctx.fillStyle = grad;
      roundRect(ctx, 0, 0, frameW, frameH, radius + bezelSize/2); 
      ctx.fill();
      
      // --- Bisel Negro Interno ---
      const rimWidth = 3.5 * scale;
      ctx.fillStyle = '#000000'; 
      roundRect(
        ctx, 
        rimWidth, 
        rimWidth, 
        frameW - (rimWidth * 2), 
        frameH - (rimWidth * 2), 
        radius
      ); 
      ctx.fill();
      
      // --- Pantalla ---
      ctx.save();
      ctx.translate(bezelSize, bezelSize);
      
      const innerRadius = radius - (bezelSize - rimWidth); 
      roundRect(ctx, 0, 0, screenW, screenH, innerRadius);
      ctx.clip();
      
      const statusBarHeight = 50 * scale; 
      
      // 1. Dibujar Fondo de Barra Superior (Color muestreado)
      ctx.fillStyle = navColor; 
      ctx.fillRect(0, 0, screenW, statusBarHeight);
      
      // 2. Dibujar Video
      const videoDestH = screenH - statusBarHeight;
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        sourceVideo, 
        cropX, cropY, cropW, cropH, 
        0, statusBarHeight, screenW, videoDestH 
      );
      
      // --- Barra de Estado (Status Bar) ---
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const textY = statusBarHeight * 0.65;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${15 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, 50 * scale, textY); 
      
      const iconY = textY - (11 * scale);
      const rightMargin = screenW - (25 * scale);
      
      drawBattery(ctx, rightMargin - (25*scale), iconY, 22*scale, 11*scale);
      drawWifi(ctx, rightMargin - (55*scale), iconY - (2*scale), 16*scale);
      drawSignal(ctx, rightMargin - (80*scale), iconY, 17*scale, 11*scale);

      ctx.restore();
      
      // --- Dynamic Island / Notch (Negro Puro) ---
      // Solo si showNotch es true
      if (showNotch) {
        const notchW = screenW * 0.3;
        const notchH = 35 * scale;
        const notchX = (frameW - notchW) / 2;
        const notchY = bezelSize + (12 * scale);
        
        ctx.fillStyle = '#000000';
        roundRect(ctx, notchX, notchY, notchW, notchH, notchH/2);
        ctx.fill();
        
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(notchX + notchW - (12*scale), notchY + notchH/2, 6*scale, 0, Math.PI*2);
        ctx.fill();
      }

      // --- Home Indicator ---
      const hiW = homeIndicatorW * scale;
      const hiH = homeIndicatorH * scale;
      const hiX = (frameW - hiW) / 2;
      const hiY = frameH - bezelSize - (8 * scale);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      roundRect(ctx, hiX, hiY, hiW, hiH, hiH/2);
      ctx.fill();
    };
    
    animationId = setInterval(draw, 1000 / 30);
    
    canvasStream = processCanvas.captureStream(30);
    
    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      mimeType = 'video/webm;codecs=h264';
    }

    mediaRecorder = new MediaRecorder(canvasStream, { 
      mimeType: mimeType,
      videoBitsPerSecond: 8000000 
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
