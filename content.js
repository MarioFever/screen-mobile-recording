// Content script for screenshot processing
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'PROCESS_SCREENSHOT') {
    processScreenshot(message.data);
  }
});

async function processScreenshot(data) {
  const { screenshotUrl, width, height, devicePixelRatio, showNotch, showFrame, bgStyle } = data;
  
  try {
    const img = new Image();
    img.src = screenshotUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    
    // Logic from offscreen.js adapted for direct DOM use
    let dpr = devicePixelRatio || 1;
    const screenLogicalW = width;
    const screenLogicalH = height;
    
    const bezel = showFrame ? 20 : 0;
    const cornerRadius = showFrame ? 55 : 0;
    const homeIndicatorW = Math.round(screenLogicalW * 0.35);
    const homeIndicatorH = Math.round(5 * (dpr/3));
    
    const frameLogicalW = screenLogicalW + (bezel * 2);
    const frameLogicalH = screenLogicalH + (bezel * 2);
    
    // Force even dimensions for consistency
    canvas.width = (Math.ceil(frameLogicalW * dpr) + 1) & ~1;
    canvas.height = (Math.ceil(frameLogicalH * dpr) + 1) & ~1;
    
    const scale = dpr;
    
    const frameW = frameLogicalW * scale;
    const frameH = frameLogicalH * scale;
    const screenW = screenLogicalW * scale;
    const screenH = screenLogicalH * scale;
    const bezelSize = bezel * scale;
    const radius = cornerRadius * scale;

    // --- Drawing Functions ---
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

    // --- Rendering ---
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sample Background Color from image (center area)
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    const colorCtx = colorCanvas.getContext('2d');
    
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const cropX = imgW / 2;
    const cropY = imgH / 2;
    
    colorCtx.drawImage(img, cropX, cropY, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = colorCtx.getImageData(0, 0, 1, 1).data;
    const navColor = `rgb(${r}, ${g}, ${b})`;

    // 1. Draw Device Frame
    if (showFrame) {
        ctx.fillStyle = '#D1D1D6';
        roundRect(ctx, -2*scale, 100*scale, 6*scale, 20*scale, 2*scale);
        roundRect(ctx, -2*scale, 140*scale, 6*scale, 45*scale, 2*scale);
        roundRect(ctx, -2*scale, 200*scale, 6*scale, 45*scale, 2*scale);
        roundRect(ctx, frameW - 4*scale, 160*scale, 6*scale, 70*scale, 2*scale);
        ctx.fill();
        
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
        
        const rimWidth = 3.5 * scale;
        ctx.fillStyle = '#000000'; 
        roundRect(ctx, rimWidth, rimWidth, frameW - (rimWidth * 2), frameH - (rimWidth * 2), radius); 
        ctx.fill();
    }

    // 2. Draw Screen Content
    ctx.save();
    ctx.translate(bezelSize, bezelSize);
    const innerRadius = radius - (showFrame ? (bezelSize - (3.5 * scale)) : 0); 
    roundRect(ctx, 0, 0, screenW, screenH, showFrame ? innerRadius : 0);
    ctx.clip();
    
    const statusBarHeight = 50 * scale; 
    
    ctx.fillStyle = navColor; 
    ctx.fillRect(0, 0, screenW, statusBarHeight);
    
    const videoDestH = screenH - statusBarHeight;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Fit Image Cover Style
    const targetRatio = screenLogicalW / screenLogicalH;
    const sourceRatio = imgW / imgH;
    let renderW, renderH;
    
    // Default to 'cover' logic similar to previous implementation or just fill
    // If we assume the screenshot matches viewport dimensions exactly (which it does via captureVisibleTab)
    // we can just draw it. However, if dpr differs, we scale.
    
    if (sourceRatio > targetRatio) {
        renderH = imgH;
        renderW = renderH * targetRatio;
    } else {
        renderW = imgW;
        renderH = renderW / targetRatio;
    }
    const renderX = (imgW - renderW) / 2;
    const renderY = (imgH - renderH) / 2;
    
    ctx.drawImage(img, renderX, renderY, renderW, renderH, 0, statusBarHeight, screenW, videoDestH);
    
    // Status Bar Items
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

    // 3. Dynamic Island / Notch
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

    // 4. Home Indicator
    const hiW = homeIndicatorW * scale;
    const hiH = homeIndicatorH * scale;
    const hiX = (frameW - hiW) / 2;
    const hiY = frameH - bezelSize - (8 * scale);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    roundRect(ctx, hiX, hiY, hiW, hiH, hiH/2);
    ctx.fill();

    // Export
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const filename = `mobile-screenshot-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.png`;
      
      // Send back to background to download
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_RECORDING',
        url: url,
        filename: filename
      });
      
      // Note: We can't revoke immediately as background needs to read it
      // Let background handle cleanup or timeout here
    }, 'image/png');

  } catch (err) {
    console.error('Error processing screenshot in content script:', err);
  }
}

