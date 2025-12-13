// OpenGraph Preview Extension - Optimized
document.addEventListener('DOMContentLoaded', async () => {
  // Configuration
  const DEBUG = false;
  const log = DEBUG ? console.log : () => {};
  const IMAGE_SIZE_THRESHOLD = 300 * 1024; // 300KB in bytes
  
  // State management
  const state = {
    currentImageUrl: '',
    currentImageInfo: { size: null, dimensions: null },
    hasImageError: false,
    activeTab: 'preview',
    currentPageUrl: '' // Track current page URL for cache
  };
  
  // Image cache (persistent across popup opens)
  const imageCache = new Map();
  
  // Icon paths configuration
  const ICON_PATHS = {
    default: { 16: 'icon16.png', 48: 'icon48.png', 128: 'icon128.png' },
    red: { 16: 'icon16-red.png', 48: 'icon48-red.png', 128: 'icon128-red.png' },
    orange: { 16: 'icon16-orange.png', 48: 'icon48-orange.png', 128: 'icon128-orange.png' }
  };
  
  // Cache DOM elements
  const elements = {
    urlInput: document.getElementById('url-input'),
    checkBtn: document.getElementById('check-btn'),
    titleInput: document.getElementById('title-input'),
    descriptionInput: document.getElementById('description-input'),
    metaTagsCode: document.getElementById('meta-tags-code'),
    copyBtn: document.getElementById('copy-btn'),
    loading: document.getElementById('loading'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    // Preview elements - cached for performance
    previews: {
      facebook: {
        domain: document.getElementById('preview-facebook-domain'),
        title: document.getElementById('preview-facebook-title'),
        description: document.getElementById('preview-facebook-description'),
        image: document.getElementById('preview-facebook-image'),
        alert: document.getElementById('alert-facebook'),
        warning: document.getElementById('warning-facebook')
      },
      whatsapp: {
        domain: document.getElementById('preview-whatsapp-domain'),
        title: document.getElementById('preview-whatsapp-title'),
        description: document.getElementById('preview-whatsapp-description'),
        image: document.getElementById('preview-whatsapp-image'),
        alert: document.getElementById('alert-whatsapp'),
        warning: document.getElementById('warning-whatsapp')
      },
      linkedin: {
        title: document.getElementById('preview-linkedin-title'),
        domain: document.getElementById('preview-linkedin-domain'),
        image: document.getElementById('preview-linkedin-image'),
        alert: document.getElementById('alert-linkedin'),
        warning: document.getElementById('warning-linkedin')
      },
      twitter: {
        domain: document.getElementById('preview-twitter-domain'),
        title: document.getElementById('preview-twitter-title'),
        description: document.getElementById('preview-twitter-description'),
        image: document.getElementById('preview-twitter-image'),
        alert: document.getElementById('alert-twitter'),
        warning: document.getElementById('warning-twitter')
      },
      discord: {
        site: document.getElementById('preview-discord-site'),
        title: document.getElementById('preview-discord-title'),
        description: document.getElementById('preview-discord-description'),
        image: document.getElementById('preview-discord-image'),
        alert: document.getElementById('alert-discord'),
        warning: document.getElementById('warning-discord')
      },
      editFacebook: {
        domain: document.getElementById('edit-preview-facebook-domain'),
        title: document.getElementById('edit-preview-facebook-title'),
        description: document.getElementById('edit-preview-facebook-description'),
        image: document.getElementById('edit-preview-facebook-image'),
        alert: document.getElementById('alert-edit-facebook'),
        warning: document.getElementById('warning-edit-facebook')
      }
    }
  };
  
  // Validate critical elements
  if (!elements.urlInput || !elements.checkBtn || !elements.titleInput || 
      !elements.descriptionInput || !elements.metaTagsCode || !elements.copyBtn || !elements.loading) {
    console.error('Critical DOM elements missing');
    return;
  }
  
  // Utility functions
  const utils = {
    truncateText: (text, maxLength) => {
      if (!text) return '';
      return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
    },
    
    escapeHtml: (text) => {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
    formatFileSize: (bytes) => {
      if (!bytes) return 'Unknown';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    
    getDomainFromUrl: (url) => {
      try {
        if (url && url.startsWith('http')) {
          return new URL(url).hostname.replace('www.', '');
        }
      } catch (e) {
        // Invalid URL
      }
      return '';
    },
    
    normalizeImageUrl: (imageUrl, baseUrl) => {
      if (!imageUrl) return '';
      
      if (imageUrl.startsWith('http')) return imageUrl;
      
      if (imageUrl.startsWith('//')) {
        return 'https:' + imageUrl;
      }
      
      if (imageUrl.startsWith('/') && baseUrl) {
        try {
          return new URL(baseUrl).origin + imageUrl;
        } catch (e) {
          // Keep as is
        }
      }
      
      if (baseUrl) {
        try {
          return new URL(imageUrl, baseUrl).href;
        } catch (e) {
          // Keep as is
        }
      }
      
      return imageUrl;
    }
  };
  
  // Tab management
  function initTabs() {
    elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        state.activeTab = targetTab;
        
        elements.tabButtons.forEach(b => b.classList.remove('active'));
        elements.tabPanels.forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const targetPanel = document.getElementById(`${targetTab}-tab`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
        
        // Regenerate meta tags when switching to HTML tab
        if (targetTab === 'html') {
          generateMetaTags({}, elements.urlInput.value);
        }
      });
    });
  }
  
  // Extension icon management - with caching to prevent flickering
  let lastIconState = { hasImage: null, imageSize: null };
  
  async function updateExtensionIcon(hasImage, imageSize = null) {
    try {
      // Skip update if state hasn't changed
      if (lastIconState.hasImage === hasImage && lastIconState.imageSize === imageSize) {
        return;
      }
      
      lastIconState = { hasImage, imageSize };
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      
      let iconPath;
      if (!hasImage) {
        iconPath = ICON_PATHS.red;
      } else if (imageSize && imageSize > IMAGE_SIZE_THRESHOLD) {
        iconPath = ICON_PATHS.orange;
      } else {
        iconPath = ICON_PATHS.default;
      }
      
      chrome.action.setIcon({ tabId: tab.id, path: iconPath });
    } catch (error) {
      if (DEBUG) console.error('Error updating extension icon:', error);
    }
  }
  
  // Load image cache from storage
  async function loadImageCache() {
    try {
      const result = await chrome.storage.local.get(['imageCache']);
      if (result.imageCache) {
        // Restore cache from storage (keep only recent entries, max 100)
        const cached = JSON.parse(result.imageCache);
        Object.entries(cached).forEach(([key, value]) => {
          // Only keep entries less than 1 hour old
          if (value.timestamp && Date.now() - value.timestamp < 3600000) {
            imageCache.set(key, value);
          }
        });
      }
    } catch (e) {
      if (DEBUG) log('Error loading cache:', e);
    }
  }
  
  // Save image cache to storage
  async function saveImageCache() {
    try {
      const cacheObj = Object.fromEntries(imageCache);
      await chrome.storage.local.set({ imageCache: JSON.stringify(cacheObj) });
    } catch (e) {
      if (DEBUG) log('Error saving cache:', e);
    }
  }
  
  // Image info fetching (optimized for speed with persistent cache)
  async function getImageInfo(imageUrl) {
    if (!imageUrl) {
      state.currentImageInfo = { size: null, dimensions: null };
      return;
    }
    
    // Check cache first (instant response)
    const cacheKey = imageUrl;
    const cached = imageCache.get(cacheKey);
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 3600000) {
      // Use cached data immediately (less than 1 hour old)
      state.currentImageUrl = imageUrl;
      state.currentImageInfo = {
        size: cached.size,
        dimensions: cached.dimensions
      };
      state.hasImageError = cached.hasError || false;
      
      // Update UI immediately with cached data
      updateExtensionIcon(!state.hasImageError, state.currentImageInfo.size);
      updateImageWarnings();
      
      if (state.activeTab === 'html') {
        generateMetaTags({}, elements.urlInput.value);
      }
      
      // Still verify in background (non-blocking) to update cache if needed
      verifyImageInBackground(imageUrl);
      return;
    }
    
    // Check if same URL to avoid redundant checks in same session
    if (state.currentImageUrl === imageUrl && state.currentImageInfo.size !== null) {
      return; // Already have info for this image in current session
    }
    
    state.currentImageUrl = imageUrl;
    
    try {
      // Start HEAD request immediately for faster size detection (parallel to image load)
      const headPromise = fetch(imageUrl, { method: 'HEAD', cache: 'no-cache' })
        .then(response => {
          const contentLength = response.headers.get('content-length');
          return contentLength ? parseInt(contentLength) : null;
        })
        .catch(() => null);
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Set timeout for image loading (3 seconds)
      const imageTimeout = setTimeout(() => {
        if (!state.currentImageInfo.dimensions) {
          state.currentImageInfo = { size: null, dimensions: null };
          state.hasImageError = true;
          updateExtensionIcon(false);
          // Cache the error state
          imageCache.set(cacheKey, {
            size: null,
            dimensions: null,
            hasError: true,
            timestamp: Date.now()
          });
          saveImageCache();
        }
      }, 3000);
      
      img.onload = async () => {
        clearTimeout(imageTimeout);
        state.hasImageError = false;
        state.currentImageInfo.dimensions = {
          width: img.naturalWidth,
          height: img.naturalHeight
        };
        
        // Get size from HEAD request (already in progress)
        try {
          let size = await headPromise;
          
          if (size === null) {
            // Fallback: get size from blob (only if HEAD failed)
            try {
              const blobResponse = await fetch(imageUrl, { cache: 'no-cache' });
              const blob = await blobResponse.blob();
              size = blob.size;
            } catch (e) {
              if (DEBUG) log('Could not get image size:', e);
              size = null;
            }
          }
          
          state.currentImageInfo.size = size;
          
          // Cache the result
          imageCache.set(cacheKey, {
            size: size,
            dimensions: state.currentImageInfo.dimensions,
            hasError: false,
            timestamp: Date.now()
          });
          saveImageCache();
          
          // Update icon and warnings immediately
          updateExtensionIcon(true, size);
          updateImageWarnings();
          
          // Update HTML tab if visible
          if (state.activeTab === 'html') {
            generateMetaTags({}, elements.urlInput.value);
          }
        } catch (e) {
          if (DEBUG) log('Error getting image size:', e);
          state.currentImageInfo.size = null;
          updateExtensionIcon(true, null);
        }
      };
      
      img.onerror = () => {
        clearTimeout(imageTimeout);
        state.currentImageInfo = { size: null, dimensions: null };
        state.hasImageError = true;
        updateExtensionIcon(false);
        // Cache the error state
        imageCache.set(cacheKey, {
          size: null,
          dimensions: null,
          hasError: true,
          timestamp: Date.now()
        });
        saveImageCache();
      };
      
      img.src = imageUrl;
    } catch (e) {
      if (DEBUG) log('Error getting image info:', e);
      state.currentImageInfo = { size: null, dimensions: null };
    }
  }
  
  // Verify image in background (non-blocking, updates cache)
  function verifyImageInBackground(imageUrl) {
    // Run in background without blocking UI
    setTimeout(async () => {
      try {
        const headPromise = fetch(imageUrl, { method: 'HEAD', cache: 'no-cache' })
          .then(response => {
            const contentLength = response.headers.get('content-length');
            return contentLength ? parseInt(contentLength) : null;
          })
          .catch(() => null);
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = async () => {
          const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
          let size = await headPromise;
          
          if (size === null) {
            try {
              const blobResponse = await fetch(imageUrl, { cache: 'no-cache' });
              const blob = await blobResponse.blob();
              size = blob.size;
            } catch (e) {
              size = null;
            }
          }
          
          // Update cache
          const cacheKey = imageUrl;
          imageCache.set(cacheKey, {
            size: size,
            dimensions: dimensions,
            hasError: false,
            timestamp: Date.now()
          });
          saveImageCache();
          
          // Only update UI if this is still the current image
          if (state.currentImageUrl === imageUrl) {
            state.currentImageInfo = { size, dimensions };
            updateExtensionIcon(true, size);
            updateImageWarnings();
          }
        };
        
        img.onerror = () => {
          const cacheKey = imageUrl;
          imageCache.set(cacheKey, {
            size: null,
            dimensions: null,
            hasError: true,
            timestamp: Date.now()
          });
          saveImageCache();
        };
        
        img.src = imageUrl;
      } catch (e) {
        // Silent fail for background verification
      }
    }, 100);
  }
  
  // Image element management - optimized for immediate display
  function setupImageElement(imgElement, src, alertElement) {
    if (!imgElement) return;
    
    if (src && src.trim() !== '') {
      // Hide alert immediately
      if (alertElement) {
        alertElement.style.display = 'none';
      }
      
      // Set display immediately for instant feedback
      imgElement.style.display = 'block';
      
      // Only update src if it changed to avoid unnecessary reloads
      if (imgElement.src !== src) {
        // Remove old listeners by replacing with null first
        imgElement.onload = null;
        imgElement.onerror = null;
        
        // Set up new load/error handlers
        imgElement.onload = () => {
          state.hasImageError = false;
          // Icon will be updated when image info is fetched
          if (alertElement) {
            alertElement.style.display = 'none';
          }
        };
        
        imgElement.onerror = () => {
          state.hasImageError = true;
          updateExtensionIcon(false);
          // Don't show alert for broken URLs, just change icon
          if (alertElement) {
            alertElement.style.display = 'none';
          }
        };
        
        imgElement.src = src;
      }
      
      // Wrap in link if needed (only once)
      const container = imgElement.parentElement;
      if (container && !container.classList.contains('image-link-wrapper')) {
        if (container.tagName !== 'A') {
          const link = document.createElement('a');
          link.href = src;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'image-link-wrapper';
          link.style.display = 'block';
          link.style.cursor = 'pointer';
          container.insertBefore(link, imgElement);
          link.appendChild(imgElement);
        }
      } else if (container?.tagName === 'A') {
        container.href = src;
      }
      
      // Update image info if URL changed (async, non-blocking)
      if (src !== state.currentImageUrl) {
        state.currentImageUrl = src;
        // Don't await - let it run in background
        getImageInfo(src);
      }
    } else {
      imgElement.src = '';
      imgElement.style.display = 'none';
      
      // Show alert only if no image URL at all
      if (alertElement) {
        alertElement.style.display = 'flex';
      }
    }
  }
  
  // Update image size warnings
  function updateImageWarnings() {
    const imageSize = state.currentImageInfo.size;
    const showWarning = imageSize && imageSize > IMAGE_SIZE_THRESHOLD;
    
    // Format size for display
    let sizeText = '';
    if (showWarning && imageSize) {
      const formattedSize = utils.formatFileSize(imageSize);
      sizeText = ` (${formattedSize})`;
    }
    
    // Update all warnings in batch
    const warnings = [
      elements.previews.facebook.warning,
      elements.previews.whatsapp.warning,
      elements.previews.linkedin.warning,
      elements.previews.twitter.warning,
      elements.previews.discord.warning,
      elements.previews.editFacebook.warning
    ].filter(Boolean); // Remove null/undefined
    
    warnings.forEach(warning => {
      if (warning) {
        warning.style.display = showWarning ? 'inline-flex' : 'none';
        // Update size text
        const sizeElement = warning.querySelector('.warning-size');
        if (sizeElement) {
          sizeElement.textContent = sizeText;
        }
      }
    });
  }
  
  // Update previews - optimized for immediate display
  function updatePreviews() {
    const title = elements.titleInput.value || 'No title';
    const description = elements.descriptionInput.value || 'No description';
    const imageUrl = state.currentImageUrl;
    const url = elements.urlInput.value || '';
    const domain = utils.getDomainFromUrl(url);
    const truncatedDesc = utils.truncateText(description, 200);
    
    // Update text content first (fast, synchronous)
    const fb = elements.previews.facebook;
    if (fb.domain) fb.domain.textContent = domain.toUpperCase();
    if (fb.title) fb.title.textContent = title;
    if (fb.description) fb.description.textContent = truncatedDesc;
    
    const wa = elements.previews.whatsapp;
    if (wa.domain) wa.domain.textContent = domain;
    if (wa.title) wa.title.textContent = title;
    if (wa.description) wa.description.textContent = truncatedDesc;
    
    const li = elements.previews.linkedin;
    if (li.title) li.title.textContent = title;
    if (li.domain) li.domain.textContent = domain.toUpperCase();
    
    const tw = elements.previews.twitter;
    if (tw.domain) tw.domain.textContent = domain;
    if (tw.title) tw.title.textContent = title;
    if (tw.description) tw.description.textContent = truncatedDesc;
    
    const dc = elements.previews.discord;
    if (dc.site) dc.site.textContent = domain;
    if (dc.title) dc.title.textContent = title;
    if (dc.description) dc.description.textContent = description;
    
    const editFb = elements.previews.editFacebook;
    if (editFb.domain) editFb.domain.textContent = domain.toUpperCase();
    if (editFb.title) editFb.title.textContent = title;
    if (editFb.description) editFb.description.textContent = truncatedDesc;
    
    // Update image size warnings
    updateImageWarnings();
    
    // Update images after text (allows UI to render immediately)
    requestAnimationFrame(() => {
      setupImageElement(fb.image, imageUrl, fb.alert);
      setupImageElement(wa.image, imageUrl, wa.alert);
      setupImageElement(li.image, imageUrl, li.alert);
      setupImageElement(tw.image, imageUrl, tw.alert);
      setupImageElement(dc.image, imageUrl, dc.alert);
      setupImageElement(editFb.image, imageUrl, editFb.alert);
    });
  }
  
  // Meta tags extraction
  function extractMetaTags() {
    const metaTags = {};
    
    try {
      // Extract Open Graph tags
      document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
        const property = tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (property && content) {
          metaTags[property] = content;
        }
      });
      
      // Extract Twitter tags
      document.querySelectorAll('meta[name^="twitter:"], meta[property^="twitter:"]').forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (name && content) {
          metaTags[name] = content;
        }
      });
      
      // Extract standard meta tags
      const titleTag = document.querySelector('title');
      if (titleTag) {
        metaTags.title = titleTag.textContent;
      }
      
      const descriptionTag = document.querySelector('meta[name="description"]');
      if (descriptionTag) {
        metaTags.description = descriptionTag.getAttribute('content');
      }
      
      // Use OG tags as fallback
      if (!metaTags.title && metaTags['og:title']) {
        metaTags.title = metaTags['og:title'];
      }
      if (!metaTags.description && metaTags['og:description']) {
        metaTags.description = metaTags['og:description'];
      }
      
      // Get image
      metaTags.image = metaTags['og:image'] || metaTags['twitter:image'] || '';
      
      // Get URL
      metaTags.url = metaTags['og:url'] || window.location.href;
      
      // Get site name
      try {
        metaTags.siteName = metaTags['og:site_name'] || new URL(window.location.href).hostname.replace('www.', '');
      } catch (e) {
        metaTags.siteName = '';
      }
    } catch (error) {
      console.error('Error extracting meta tags:', error);
    }
    
    return metaTags;
  }
  
  // Populate form - optimized for immediate display
  async function populateForm(metaData, url) {
    // Update form fields immediately
    elements.titleInput.value = metaData.title || metaData['og:title'] || '';
    elements.descriptionInput.value = metaData.description || metaData['og:description'] || '';
    
    let imageUrl = metaData.image || metaData['og:image'] || metaData['twitter:image'] || '';
    imageUrl = utils.normalizeImageUrl(imageUrl, url);
    
    state.currentImageUrl = imageUrl;
    state.currentPageUrl = url; // Track page URL for cache
    state.hasImageError = false;
    
    // Update previews immediately with available data
    updatePreviews();
    
    // Get image info (uses cache for instant display)
    if (imageUrl) {
      await getImageInfo(imageUrl);
    } else {
      state.currentImageInfo = { size: null, dimensions: null };
      // Only update icon if there's no image
      updateExtensionIcon(false);
      updateImageWarnings();
    }
  }
  
  // Generate meta tags HTML
  function generateMetaTags(metaData, url) {
    if (!elements.metaTagsCode) return;
    
    const title = elements.titleInput.value || metaData.title || '';
    const description = elements.descriptionInput.value || metaData.description || '';
    const imageUrl = state.currentImageUrl || metaData.image || '';
    const domain = utils.getDomainFromUrl(url);
    
    // Helper functions for syntax highlighting
    const highlightTag = (tag, attrs) => {
      let html = `<span class="code-bracket">&lt;</span><span class="code-tag">${tag}</span>`;
      for (const [key, value] of Object.entries(attrs)) {
        html += ` <span class="code-attr">${key}</span><span class="code-equals">=</span><span class="code-string">"${utils.escapeHtml(value)}"</span>`;
      }
      html += `<span class="code-bracket">&gt;</span>`;
      return html;
    };
    
    const highlightTagPair = (tag, content) => {
      return `<span class="code-bracket">&lt;</span><span class="code-tag">${tag}</span><span class="code-bracket">&gt;</span><span class="code-content">${utils.escapeHtml(content)}</span><span class="code-bracket">&lt;/</span><span class="code-tag">${tag}</span><span class="code-bracket">&gt;</span>`;
    };
    
    const highlightComment = (text) => {
      return `<span class="code-comment">&lt;!-- ${text} --&gt;</span>`;
    };
    
    // Format image info
    const formatImageInfo = () => {
      const parts = [];
      if (state.currentImageInfo.dimensions) {
        parts.push(`${state.currentImageInfo.dimensions.width}x${state.currentImageInfo.dimensions.height}px`);
      }
      if (state.currentImageInfo.size) {
        parts.push(utils.formatFileSize(state.currentImageInfo.size));
      }
      return parts.length > 0 ? ` (${parts.join(', ')})` : '';
    };
    
    const imageInfo = formatImageInfo();
    const lines = [
      highlightComment('HTML Meta Tags'),
      highlightTagPair('title', title),
      highlightTag('meta', { name: 'description', content: description }),
      '',
      highlightComment('Facebook Meta Tags' + imageInfo),
      highlightTag('meta', { property: 'og:url', content: url || '' }),
      highlightTag('meta', { property: 'og:type', content: 'website' }),
      highlightTag('meta', { property: 'og:title', content: title }),
      highlightTag('meta', { property: 'og:description', content: description }),
      highlightTag('meta', { property: 'og:image', content: imageUrl }),
      '',
      highlightComment('Twitter Meta Tags' + imageInfo),
      highlightTag('meta', { name: 'twitter:card', content: 'summary_large_image' }),
      highlightTag('meta', { property: 'twitter:domain', content: domain }),
      highlightTag('meta', { property: 'twitter:url', content: url || '' }),
      highlightTag('meta', { name: 'twitter:title', content: title }),
      highlightTag('meta', { name: 'twitter:description', content: description }),
      highlightTag('meta', { name: 'twitter:image', content: imageUrl }),
      '',
      highlightComment('Meta Tags Generated via OpenGraph Preview Extension')
    ];
    
    elements.metaTagsCode.innerHTML = lines.join('\n');
    
    // Update line numbers
    const lineNumberDiv = document.querySelector('.code-line-number');
    if (lineNumberDiv) {
      lineNumberDiv.innerHTML = lines.map((_, i) => i + 1).join('<br>');
    }
  }
  
  // Fetch Open Graph data
  async function fetchOpenGraphData(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      elements.loading.classList.add('hidden');
      updateExtensionIcon(false);
      return;
    }
    
    elements.loading.classList.remove('hidden');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.id) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractMetaTags
          });
          
          if (results?.[0]?.result) {
            const metaData = results[0].result;
            populateForm(metaData, url);
            generateMetaTags(metaData, url);
            elements.loading.classList.add('hidden');
            return;
          }
        } catch (error) {
          console.error('Script execution error:', error);
        }
      }
      
      // Fallback: show empty form
      populateForm({}, url);
      generateMetaTags({}, url);
    } catch (error) {
      console.error('Error fetching Open Graph data:', error);
      populateForm({}, url);
      updatePreviews();
      generateMetaTags({}, url);
    } finally {
      elements.loading.classList.add('hidden');
    }
  }
  
  // Event handlers
  function initEventHandlers() {
    // Check button
    elements.checkBtn.addEventListener('click', async () => {
      const url = elements.urlInput.value.trim();
      if (url) {
        await fetchOpenGraphData(url);
      }
    });
    
    // Enter key in URL input
    elements.urlInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const url = elements.urlInput.value.trim();
        if (url) {
          await fetchOpenGraphData(url);
        }
      }
    });
    
    // Input changes
    elements.titleInput.addEventListener('input', () => {
      updatePreviews();
      generateMetaTags({}, elements.urlInput.value);
    });
    
    elements.descriptionInput.addEventListener('input', () => {
      updatePreviews();
      generateMetaTags({}, elements.urlInput.value);
    });
    
    // Copy to clipboard
    elements.copyBtn.addEventListener('click', async () => {
      try {
        const code = elements.metaTagsCode.textContent;
        if (!code) return;
        
        await navigator.clipboard.writeText(code);
        const originalHTML = elements.copyBtn.innerHTML;
        elements.copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Copied!
        `;
        setTimeout(() => {
          elements.copyBtn.innerHTML = originalHTML;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  }
  
  // Initialize
  async function init() {
    // Load cache first for instant display
    await loadImageCache();
    
    initTabs();
    initEventHandlers();
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        elements.urlInput.value = tab.url;
        await fetchOpenGraphData(tab.url);
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }
  
  // Start
  init();
});


