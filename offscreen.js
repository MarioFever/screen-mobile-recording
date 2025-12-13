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
    
    // Configuración de dimensiones lógicas
    const screenLogicalW = width;
    const screenLogicalH = height;

    // Configuración del Marco (Estilo iPhone Pro Silver)
    const bezel = Math.round(screenLogicalW * 0.045); // ~4.5% bezel
    const cornerRadius = Math.round(screenLogicalW * 0.13);
    const homeIndicatorW = Math.round(screenLogicalW * 0.35);
    const homeIndicatorH = Math.round(5 * (dpr/3));
    
    // Dimensiones del Marco
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

    // Helper para dibujar iconos de estado
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
        ctx.lineWidth = 2; // Grosor de línea ajustado para no ser muy grueso
        // Body
        roundRect(ctx, x, y, w, h, h/3);
        ctx.stroke(); // Solo borde
        // Fill (capacidad)
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, x + 2, y + 2, w - 4, h - 4, h/4);
        ctx.fill();
        // Cap (el piquito)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x + w + 2, y + h/2, h/4, Math.PI * 0.5, Math.PI * 1.5, true);
        ctx.fill();
    }

    const draw = () => {
      if (sourceVideo.paused || sourceVideo.ended) return;
      
      const videoWidth = sourceVideo.videoWidth;
      const videoHeight = sourceVideo.videoHeight;
      
      // Auto-Fit Crop
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
      // Dibujamos antes del marco principal para que queden "detrás" o integrados
      ctx.fillStyle = '#D1D1D6'; // Silver claro
      // Izquierda (Silent, Vol+, Vol-)
      roundRect(ctx, -2*scale, 100*scale, 6*scale, 20*scale, 2*scale);
      roundRect(ctx, -2*scale, 140*scale, 6*scale, 45*scale, 2*scale);
      roundRect(ctx, -2*scale, 200*scale, 6*scale, 45*scale, 2*scale);
      // Derecha (Power)
      roundRect(ctx, frameW - 4*scale, 160*scale, 6*scale, 70*scale, 2*scale);
      ctx.fill();
      
      // --- Marco Exterior (Chasis Metálico Silver) ---
      // Degradado complejo para simular metal redondeado
      const grad = ctx.createLinearGradient(0, 0, frameW, 0); // Horizontal gradient looks better for side sheen
      grad.addColorStop(0, '#8E8E93');   // Darker edge
      grad.addColorStop(0.05, '#E5E5EA'); // Highlight
      grad.addColorStop(0.2, '#D1D1D6');  // Mid silver
      grad.addColorStop(0.8, '#D1D1D6');
      grad.addColorStop(0.95, '#E5E5EA'); // Highlight
      grad.addColorStop(1, '#8E8E93');   // Darker edge
      
      ctx.fillStyle = grad;
      roundRect(ctx, 0, 0, frameW, frameH, radius + bezelSize/2); 
      ctx.fill();
      
      // --- Bisel Negro Interno ---
      const rimWidth = 3.5 * scale; // Grosor del borde metálico visible frontalmente
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
      
      // Máscara de pantalla (Esquinas redondeadas internas)
      // Ajustamos el radio interno para que sea paralelo al externo
      const innerRadius = radius - (bezelSize - rimWidth); 
      roundRect(ctx, 0, 0, screenW, screenH, innerRadius);
      ctx.clip();
      
      // Dibujar Video
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceVideo, cropX, cropY, cropW, cropH, 0, 0, screenW, screenH);
      
      // --- Barra de Estado (Status Bar) ---
      // Hora (Izquierda)
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); // 10:09 style
      
      const statusBarHeight = 44 * scale; // Standard iOS header height approx
      const textY = statusBarHeight * 0.75;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${15 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      // Ajuste fino de posición para librar la curva
      ctx.fillText(timeStr, 50 * scale, textY); 
      
      // Iconos (Derecha)
      const iconY = textY - (11 * scale);
      const rightMargin = screenW - (25 * scale);
      
      // Battery
      drawBattery(ctx, rightMargin - (25*scale), iconY, 22*scale, 11*scale);
      
      // WiFi
      drawWifi(ctx, rightMargin - (55*scale), iconY - (2*scale), 16*scale);
      
      // Signal
      drawSignal(ctx, rightMargin - (80*scale), iconY, 17*scale, 11*scale);

      ctx.restore();
      
      // --- Dynamic Island / Notch (Negro Puro) ---
      const notchW = screenW * 0.3; // ~120px logical width approx
      const notchH = 35 * scale;    // ~35px height
      const notchX = (frameW - notchW) / 2;
      const notchY = bezelSize + (12 * scale); // Top margin inside screen
      
      ctx.fillStyle = '#000000';
      roundRect(ctx, notchX, notchY, notchW, notchH, notchH/2);
      ctx.fill();
      
      // Lente de la cámara (reflejo sutil dentro de la isla)
      ctx.fillStyle = '#1A1A1A'; // Gris muy oscuro
      ctx.beginPath();
      ctx.arc(notchX + notchW - (12*scale), notchY + notchH/2, 6*scale, 0, Math.PI*2);
      ctx.fill();

      // --- Home Indicator ---
      const hiW = homeIndicatorW * scale;
      const hiH = homeIndicatorH * scale;
      const hiX = (frameW - hiW) / 2;
      const hiY = frameH - bezelSize - (8 * scale); // Pegado abajo
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Blanco brillante
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
