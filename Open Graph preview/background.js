// Background service worker for automatic icon updates
// Updates extension icon automatically when tabs change based on og:image status

const tabIconCache = new Map();
const IMAGE_SIZE_THRESHOLD = 300 * 1024; // 300KB in bytes
const PAGE_READY_DELAY = 300; // 300ms delay for page to be ready (optimized)
const IMAGE_CHECK_TIMEOUT = 3000; // 3 seconds timeout for image check (optimized)

// Icon paths configuration
const ICON_PATHS = {
  default: {
    16: 'icon16.png',
    48: 'icon48.png',
    128: 'icon128.png'
  },
  red: {
    16: 'icon16-red.png',
    48: 'icon48-red.png',
    128: 'icon128-red.png'
  },
  orange: {
    16: 'icon16-orange.png',
    48: 'icon48-orange.png',
    128: 'icon128-orange.png'
  }
};

// Extract meta tags from page
async function extractMetaTagsFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const metaTags = {};
        
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
        
        return metaTags;
      }
    });
    
    return results?.[0]?.result || null;
  } catch (error) {
    // Page not accessible (chrome://, chrome-extension://, etc.)
    return null;
  }
}

// Normalize image URL (convert relative to absolute)
function normalizeImageUrl(imageUrl, baseUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('//')) return 'https:' + imageUrl;
  
  if (imageUrl.startsWith('/') && baseUrl) {
    try {
      return new URL(baseUrl).origin + imageUrl;
    } catch (e) {
      // Invalid base URL
    }
  }
  
  if (baseUrl) {
    try {
      return new URL(imageUrl, baseUrl).href;
    } catch (e) {
      // Invalid URL
    }
  }
  
  return imageUrl;
}

// Check if image is valid and get its size using page context (optimized)
async function checkImageAndGetSize(tabId, imageUrl) {
  if (!imageUrl) return { valid: false, size: null };
  
  // Check cache first
  const cacheKey = `${tabId}:${imageUrl}`;
  const cached = tabIconCache.get(cacheKey);
  if (cached && cached.timestamp && Date.now() - cached.timestamp < 5000) {
    // Use cached result if less than 5 seconds old
    return { valid: cached.hasImage, size: cached.imageSize };
  }
  
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (url, timeoutMs) => {
        return new Promise((resolve) => {
          try {
            // Start HEAD request immediately for faster size detection
            const headPromise = fetch(url, { method: 'HEAD', cache: 'no-cache' })
              .then(response => {
                const contentLength = response.headers.get('content-length');
                return contentLength ? parseInt(contentLength) : null;
              })
              .catch(() => null);
            
            // Start image load check in parallel
            const img = new Image();
            let resolved = false;
            let imageValid = false;
            
            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve({ valid: false, size: null });
              }
            }, timeoutMs);
            
            img.onload = async () => {
              if (!resolved) {
                imageValid = true;
                // Wait for HEAD request result
                const size = await headPromise;
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  if (size !== null) {
                    resolve({ valid: true, size });
                  } else {
                    // Fallback: try to get size from blob (only if HEAD failed)
                    try {
                      const blobResponse = await fetch(url, { cache: 'no-cache' });
                      const blob = await blobResponse.blob();
                      resolve({ valid: true, size: blob.size });
                    } catch (e) {
                      resolve({ valid: true, size: null });
                    }
                  }
                }
              }
            };
            
            img.onerror = async () => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve({ valid: false, size: null });
              }
            };
            
            // Set src after setting up handlers
            img.src = url;
          } catch (e) {
            resolve({ valid: false, size: null });
          }
        });
      },
      args: [imageUrl, IMAGE_CHECK_TIMEOUT]
    });
    
    const result = await results?.[0]?.result || { valid: false, size: null };
    
    // Cache the result
    tabIconCache.set(cacheKey, {
      hasImage: result.valid,
      imageSize: result.size,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    // Script injection failed - assume image is broken
    return { valid: false, size: null };
  }
}

// Determine icon path based on image state
function getIconPath(imageInfo) {
  if (!imageInfo.valid) {
    return ICON_PATHS.red;
  } else if (imageInfo.size && imageInfo.size > IMAGE_SIZE_THRESHOLD) {
    return ICON_PATHS.orange;
  }
  return ICON_PATHS.default;
}

// Update icon for a tab (optimized)
async function updateIconForTab(tabId, url) {
  // Skip non-HTTP URLs
  if (!url || !url.startsWith('http')) {
    return;
  }
  
  try {
    // Extract meta tags and get image URL in parallel when possible
    const metaTags = await extractMetaTagsFromTab(tabId);
    if (!metaTags) {
      chrome.action.setIcon({ tabId, path: ICON_PATHS.red });
      return;
    }
    
    // Get image URL
    let imageUrl = metaTags['og:image'] || metaTags['twitter:image'] || '';
    imageUrl = normalizeImageUrl(imageUrl, url);
    
    if (!imageUrl) {
      chrome.action.setIcon({ tabId, path: ICON_PATHS.red });
      return;
    }
    
    // Check if image is valid and get size (optimized with cache)
    const imageInfo = await checkImageAndGetSize(tabId, imageUrl);
    const iconPath = getIconPath(imageInfo);
    
    chrome.action.setIcon({ tabId, path: iconPath });
    
  } catch (error) {
    // On error, set red icon
    chrome.action.setIcon({ tabId, path: ICON_PATHS.red });
  }
}

// Debounced update function to avoid multiple rapid calls
let updateTimeouts = new Map();

function debouncedUpdateIcon(tabId, url) {
  // Clear existing timeout for this tab
  if (updateTimeouts.has(tabId)) {
    clearTimeout(updateTimeouts.get(tabId));
  }
  
  // Set new timeout
  const timeout = setTimeout(async () => {
    updateTimeouts.delete(tabId);
    await updateIconForTab(tabId, url);
  }, PAGE_READY_DELAY);
  
  updateTimeouts.set(tabId, timeout);
}

// Listen for tab updates (when page loads or URL changes) - optimized
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check status first for early exit
  if (changeInfo.status !== 'complete' && changeInfo.status !== 'loading') {
    return;
  }
  
  // Only process HTTP/HTTPS URLs
  if (!tab.url || !tab.url.startsWith('http')) {
    return;
  }
  
  // If page is complete, update immediately (reduced delay)
  if (changeInfo.status === 'complete') {
    debouncedUpdateIcon(tabId, tab.url);
  }
});

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith('http')) {
      await updateIconForTab(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    // Tab might not be accessible
  }
});

// Clean up cache and timeouts when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up all cache entries for this tab
  for (const key of tabIconCache.keys()) {
    if (key.startsWith(`${tabId}:`)) {
      tabIconCache.delete(key);
    }
  }
  if (updateTimeouts.has(tabId)) {
    clearTimeout(updateTimeouts.get(tabId));
    updateTimeouts.delete(tabId);
  }
});

// Update icon for current tab on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && tab.url.startsWith('http')) {
      await updateIconForTab(tab.id, tab.url);
    }
  } catch (error) {
    // Ignore errors
  }
});

// Update when extension is installed/enabled
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && tab.url.startsWith('http')) {
      await updateIconForTab(tab.id, tab.url);
    }
  } catch (error) {
    // Ignore errors
  }
});
