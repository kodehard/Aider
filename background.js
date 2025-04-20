// Define default config to be used until the real config is loaded
const defaultConfig = {
    OPENROUTER_API_KEY: "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",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    TEXT_MODEL: "deepseek/deepseek-r1:free",
    VISION_MODEL: "qwen/qwen2.5-vl-72b-instruct:free",
    mathjax_cdn_url: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
    SYSTEM_PROMPTS: {
        TEXT_SOLVE: "You are a helpful assistant that specializes in solving problems in mathematics, physics, chemistry, and other technical subjects. Provide clear explanations with step-by-step solutions.",
        IMAGE_SOLVE: "You are analyzing an image containing a problem. First identify the subject area (math, physics, etc.), then provide a complete solution with step-by-step reasoning. Format any equations properly and ensure your answer is clear and accurate."
    }
};

// Use default config initially
let config = defaultConfig;

// Load the config at startup
loadConfig().then(loadedConfig => {
    chrome.storage.local.set({ config: loadedConfig || config });
});

// Function to load config
async function loadConfig() {
    try {
        // Import config from the config.js file
        const response = await fetch('config.js');
        if (!response.ok) return null;
        
        const text = await response.text();
        const configMatch = text.match(/const\s+config\s*=\s*({[\s\S]*?});/);
        if (configMatch && configMatch[1]) {
            try {
                const loadedConfig = Function(`return ${configMatch[1]}`)();
                config = loadedConfig;
                return loadedConfig;
            } catch (e) {
                console.error('Error parsing config:', e);
                return null;
            }
        }
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
    return null;
}

chrome.runtime.onInstalled.addListener(() => {
    loadConfig();
    
    chrome.contextMenus.create({
        id: 'solveWithAider',
        title: 'Solve with Snap Solve',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'solveWithAider' && info.selectionText) {
        chrome.storage.local.set({ selectedText: info.selectionText });
        chrome.action.openPopup();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'takeScreenshot') {
        const tabId = message.tabId;

        if (!tabId) {
            sendResponse({ success: false, error: 'No tabId provided' });
            return true;
        }

        injectScripts(tabId)
            .then(() => {
                console.log('Scripts injected, starting selection mode...');
                // Add more details for debugging
                console.log('Tab ID:', tabId);
                console.log('Executing script in page context to call startScreenshot...');
                
                // Use executeScript to directly call startScreenshot function in page context
                return chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    function: () => {
                        console.log('Executing startScreenshot in page context');
                        // Add more detailed logging
                        console.log('Window.startScreenshot exists:', typeof window.startScreenshot === 'function');
                        console.log('Window.aider exists:', !!window.aider);
                        console.log('Window.aider.screenshot exists:', !!(window.aider && window.aider.screenshot));
                        
                        // Try multiple possible ways the function might be exposed
                        if (typeof window.startScreenshot === 'function') {
                            console.log('Calling window.startScreenshot()');
                            try {
                                window.startScreenshot();
                                return { success: true, method: 'window.startScreenshot' };
                            } catch (e) {
                                console.error('Error calling window.startScreenshot:', e);
                                return { success: false, error: e.message, method: 'window.startScreenshot' };
                            }
                        } else if (window.aider && window.aider.screenshot && typeof window.aider.screenshot.startScreenshot === 'function') {
                            console.log('Calling window.aider.screenshot.startScreenshot()');
                            try {
                                window.aider.screenshot.startScreenshot();
                                return { success: true, method: 'window.aider.screenshot.startScreenshot' };
                            } catch (e) {
                                console.error('Error calling window.aider.screenshot.startScreenshot:', e);
                                return { success: false, error: e.message, method: 'window.aider.screenshot.startScreenshot' };
                            }
                        } else if (typeof startScreenshot === 'function') {
                            console.log('Calling startScreenshot()');
                            try {
                                startScreenshot();
                                return { success: true, method: 'startScreenshot' };
                            } catch (e) {
                                console.error('Error calling startScreenshot:', e);
                                return { success: false, error: e.message, method: 'startScreenshot' };
                            }
                        } else {
                            // Try one more approach - dispatch an event
                            try {
                                console.log('Dispatching smartsolve_startSelection event');
                                const event = new CustomEvent('smartsolve_startSelection');
                                document.dispatchEvent(event);
                                return { success: true, method: 'event', warning: 'Used event dispatch as fallback' };
                            } catch (e) {
                                console.error('No screenshot functions found and event dispatch failed');
                                return { 
                                    success: false, 
                                    error: 'Screenshot functions not available and event dispatch failed: ' + e.message,
                                    availableFunctions: Object.keys(window)
                                };
                            }
                        }
                    }
                });
            })
            .then((results) => {
                console.log('Selection mode execution results:', results);
                if (results && results[0] && results[0].result) {
                    const result = results[0].result;
                    console.log('Result details:', result);
                    
                    if (result.success) {
                        console.log('Successfully started screenshot mode using:', result.method);
                        sendResponse({ success: true, method: result.method });
                    } else {
                        console.error('Failed to start screenshot mode:', result.error);
                        sendResponse({ 
                            success: false, 
                            error: result.error || 'Could not start selection mode. Please try refreshing the page.',
                            details: result
                        });
                    }
                } else {
                    console.error('Invalid result from executeScript:', results);
                    sendResponse({ success: false, error: 'Invalid result from script execution' });
                }
            })
            .catch(error => {
                console.error('Error in takeScreenshot flow:', error);
                sendResponse({ success: false, error: error.message });
            });

        return true; // Keep the message channel open for async response
    } else if (message.action === 'injectScripts') {
        injectScripts(message.tabId)
            .then(() => {
                console.log('Scripts injected successfully via injectScripts action');
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Error injecting scripts:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    } else if (message.action === 'captureSelection') {
        const selection = message.selection;
        
        if (!selection) {
            sendResponse({ success: false, error: 'No selection data provided' });
            return true;
        }
        
        // Send an immediate acknowledgment
        sendResponse({ received: true });
        
        // Process the capture separately
        const tabId = message.tabId || sender.tab.id;
        
        // Add a small delay to ensure UI is cleaned up
        setTimeout(() => {
            captureAndProcessSelection(selection, tabId);
        }, 100);
        
        return true;
    } else if (message.action === 'startSelectionMode') {
        if (message.tabId) {
            // Use direct executeScript instead of message passing
            chrome.scripting.executeScript({
                target: { tabId: message.tabId },
                function: () => {
                    console.log('Executing startScreenshot in page context via startSelectionMode');
                    if (typeof window.startScreenshot === 'function') {
                        window.startScreenshot();
                        return { success: true };
                    } else if (window.aider && window.aider.screenshot && typeof window.aider.screenshot.startScreenshot === 'function') {
                        window.aider.screenshot.startScreenshot();
                        return { success: true };
                    } else if (typeof startScreenshot === 'function') {
                        startScreenshot();
                        return { success: true };
                    } else {
                        console.error('Screenshot functions not found in page context');
                        return { success: false, error: 'Screenshot functions not available' };
                    }
                }
            })
            .then(results => {
                if (results && results[0] && results[0].result && results[0].result.success) {
                    sendResponse({ success: true });
                } else {
                    const error = results?.[0]?.result?.error || 'Could not start selection mode';
                    sendResponse({ success: false, error: error });
                }
            })
            .catch(error => {
                console.error('Error starting selection mode:', error);
                sendResponse({ success: false, error: error.message || 'Failed to start selection mode' });
            });
        } else {
            sendResponse({ success: false, error: "Tab ID is not available" });
        }
        return true;
    }
});

// Function to send images to vision API
async function sendToVisionAPI(imageDataUrl, tabId) {
    // Set up a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timed out after 30 seconds')), 30000);
    });

    try {
        const API_URL = config.OPENROUTER_API_URL;
        const API_KEY = config.OPENROUTER_API_KEY;
        const MODEL = config.VISION_MODEL;
        const SYSTEM_PROMPT = config.SYSTEM_PROMPTS?.IMAGE_SOLVE || 
            "You are analyzing an image containing a problem. First identify the subject area (math, physics, etc.), then provide a complete solution with step-by-step reasoning. Format any equations properly and ensure your answer is clear and accurate.";
        
        if (!API_KEY) {
            throw new Error('API key not configured. Please set up your API key in the extension settings.');
        }

        console.log('Optimizing image before sending to API');
        // Optimize image if needed
        const optimizedImage = await optimizeImageForAPI(imageDataUrl);

        console.log('Sending optimized image to OpenRouter API');
        
        // Send status update to tab
        chrome.tabs.sendMessage(tabId, {
            action: 'displaySolution',
            solution: 'Processing your capture... This may take up to 30 seconds.',
            status: 'processing',
            imageUrl: imageDataUrl,
            options: { processing: true }
        });
        
        // Use Promise.race to implement the timeout
        const response = await Promise.race([
            fetch(`${API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': 'https://github.com/OpenRouterTeam/openrouter',
                    'X-Title': 'Snap Solve'
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { 
                            role: "system", 
                            content: SYSTEM_PROMPT
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Please solve the problem in this image. Provide a detailed step-by-step solution."
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: optimizedImage
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: config.TEMPERATURE || 0.7,
                    max_tokens: config.MAX_TOKENS || 800,
                    stream: false
                })
            }),
            timeoutPromise
        ]);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}):`, errorText);
            throw new Error(`API error (${response.status}): ${errorText}`);
        }

        console.log('Received response from API, processing data');
        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            const solution = data.choices[0].message.content;
            console.log('Solution received, sending to tab');
            
            // Save solution and image to storage for popup to access
            chrome.storage.local.set({ 
                capturedImage: imageDataUrl,
                solution: solution
            });
            
            // Send solution to active tab to display
            chrome.tabs.sendMessage(tabId, {
                action: 'displaySolution',
                solution: solution,
                imageUrl: imageDataUrl,
                options: { success: true }
            });
            
            return { success: true, solution: solution };
        } else {
            console.error('No valid choices in API response:', data);
            throw new Error('No valid response from API');
        }
    } catch (error) {
        console.error('Error in vision API processing:', error);
        
        // Send error message to active tab
        sendErrorToTab(tabId, error.message, imageDataUrl);
        
        throw error;
    }
}

// Function to capture the entire page and process the selection
function captureAndProcessSelection(selection, tabId) {
    console.log('Starting capture and process selection:', { selection, tabId });

    try {
        // Get detailed page information including window dimensions, scroll position, and device pixel ratio
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: () => {
                return {
                    scrollX: window.pageXOffset || document.documentElement.scrollLeft || 0,
                    scrollY: window.pageYOffset || document.documentElement.scrollTop || 0,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    clientWidth: document.documentElement.clientWidth || window.innerWidth,
                    clientHeight: document.documentElement.clientHeight || window.innerHeight,
                    devicePixelRatio: window.devicePixelRatio || 1,
                    hasScrolled: window.pageYOffset > 0 || document.documentElement.scrollTop > 0
                };
            }
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting page info:', chrome.runtime.lastError);
                sendErrorToTab(tabId, "Failed to capture screenshot. Please try again.");
                return;
            }
            
            // Get page information
            const pageInfo = results[0].result;
            console.log('Page information before capture:', pageInfo);
            
            // Update the selection with the latest scroll position if not already set
            if (typeof selection.scrollX === 'undefined' || typeof selection.scrollY === 'undefined') {
                selection.scrollX = pageInfo.scrollX;
                selection.scrollY = pageInfo.scrollY;
            }
            
            // Store information for proper scaling
            selection.devicePixelRatio = pageInfo.devicePixelRatio;
            selection.viewportWidth = pageInfo.viewportWidth;
            selection.viewportHeight = pageInfo.viewportHeight;
            selection.clientWidth = pageInfo.clientWidth;
            selection.clientHeight = pageInfo.clientHeight;
            
            // Make sure the selection coordinates make sense
            if (selection.width <= 0 || selection.height <= 0) {
                sendErrorToTab(tabId, "Invalid selection area. Please try selecting again.");
                return;
            }
            
            // Check if selection is outside the viewport
            const isOffscreen = (
                selection.startX < 0 || 
                selection.startY < 0 || 
                selection.startX + selection.width > pageInfo.viewportWidth ||
                selection.startY + selection.height > pageInfo.viewportHeight
            );
            
            if (isOffscreen) {
                console.warn('Selection is partially outside viewport, adjusting coordinates');
                
                // Adjust to keep within viewport
                selection.startX = Math.max(0, selection.startX);
                selection.startY = Math.max(0, selection.startY);
                selection.width = Math.min(selection.width, pageInfo.viewportWidth - selection.startX);
                selection.height = Math.min(selection.height, pageInfo.viewportHeight - selection.startY);
            }
            
            console.log('Adjusted selection before capture:', selection);
            
            // Now capture the visible tab
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, function(dataUrl) {
                if (chrome.runtime.lastError) {
                    console.error('Error capturing tab:', chrome.runtime.lastError);
                    sendErrorToTab(tabId, "Failed to capture screenshot. Please try again.");
                    return;
                }
                
                // Process the image to crop it based on selection
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    function: processFullPageScreenshot,
                    args: [dataUrl, selection]
                }, (results) => {
                    if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
                        console.error('Error processing screenshot:', chrome.runtime.lastError);
                        sendErrorToTab(tabId, "Failed to process screenshot. Please try again.");
                        return;
                    }
                    
                    const croppedDataUrl = results[0].result;
                    
                    // Save image for popup to access
                    chrome.storage.local.set({ capturedImage: croppedDataUrl });
                    
                    // Send to vision API for processing
                    sendToVisionAPI(croppedDataUrl, tabId).catch(error => {
                        console.error('Error sending to vision API:', error);
                        sendErrorToTab(tabId, error.message || "Failed to analyze image. Please try again.");
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error in captureAndProcessSelection:', error);
        sendErrorToTab(tabId, error.message || "An unknown error occurred. Please try again.");
    }
}

// Function to process the full page screenshot and crop it based on selection
function processFullPageScreenshot(dataUrl, selection) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Processing screenshot with selection data:', selection);
            const img = new Image();
            
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas dimensions to the selection size
                    canvas.width = selection.width;
                    canvas.height = selection.height;
                    
                    // Use the viewport dimensions passed from the background script
                    // This ensures consistency between capturing and processing
                    const viewportWidth = selection.clientWidth || selection.viewportWidth || document.documentElement.clientWidth || window.innerWidth;
                    const viewportHeight = selection.clientHeight || selection.viewportHeight || document.documentElement.clientHeight || window.innerHeight;
                    const devicePixelRatio = selection.devicePixelRatio || window.devicePixelRatio || 1;
                    
                    // Calculate scaling factor if the image size doesn't match window size
                    // This adjusts for high DPI displays and zoom levels
                    const scaleX = img.width / viewportWidth;
                    const scaleY = img.height / viewportHeight;
                    
                    console.log('Image dimensions:', img.width, 'x', img.height);
                    console.log('Viewport dimensions:', viewportWidth, 'x', viewportHeight);
                    console.log('Device pixel ratio:', devicePixelRatio);
                    console.log('Scale factors:', scaleX, scaleY);
                    
                    // Calculate adjusted coordinates accounting for scaling
                    const adjustedX = Math.round(selection.startX * scaleX);
                    const adjustedY = Math.round(selection.startY * scaleY);
                    const adjustedWidth = Math.round(selection.width * scaleX);
                    const adjustedHeight = Math.round(selection.height * scaleY);
                    
                    console.log('Original selection coordinates:', {
                        x: selection.startX,
                        y: selection.startY,
                        width: selection.width,
                        height: selection.height
                    });
                    
                    console.log('Adjusted coordinates for capture:', {
                        x: adjustedX,
                        y: adjustedY,
                        width: adjustedWidth,
                        height: adjustedHeight
                    });
                    
                    // Draw only the selected portion of the image with adjusted coordinates
                    ctx.drawImage(
                        img,
                        adjustedX, adjustedY, // Source X, Y (adjusted for scaling)
                        adjustedWidth, adjustedHeight, // Source width, height (adjusted for scaling)
                        0, 0, // Destination X, Y
                        selection.width, selection.height // Destination width, height (original size)
                    );
                    
                    // Convert back to dataURL
                    const croppedDataUrl = canvas.toDataURL('image/png');
                    
                    // Log dimensions for debugging
                    console.log(`Original image: ${img.width}x${img.height}, Cropped to: ${canvas.width}x${canvas.height}`);
                    
                    resolve(croppedDataUrl);
                } catch (err) {
                    console.error('Error cropping image:', err);
                    reject(err);
                }
            };
            
            img.onerror = function() {
                console.error('Error loading image');
                reject(new Error('Failed to load screenshot image'));
            };
            
            // Set the source of the image
            img.src = dataUrl;
        } catch (error) {
            console.error('Error in processFullPageScreenshot:', error);
            reject(error);
        }
    });
}

// Optimize image for vision API - also execute in content script context
async function optimizeImageForAPI(dataUrl) {
    try {
        // Get the active tab to execute the optimization in
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            console.warn('No active tab found, using original image');
            return dataUrl;
        }

        // For optimization, we'll delegate to a content script function
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: optimizeImageInPage,
            args: [dataUrl]
        });
        
        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
        
        // If we couldn't get a result, return the original data URL
        console.warn('Could not optimize image, using original');
        return dataUrl;
    } catch (error) {
        console.error('Error optimizing image:', error);
        return dataUrl; // Return original if optimization fails
    }
}

// This function runs in the context of the web page
function optimizeImageInPage(dataUrl) {
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            
            img.onload = function() {
                try {
                    // Set reasonable limits for API requests
                    const MAX_SIZE = 4096; // Many vision APIs limit image dimensions
                    const TARGET_SIZE = 1600; // Target size for most cases (good balance of quality and size)
                    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB limit common for APIs
                    
                    // Get original dimensions
                    let newWidth = img.width;
                    let newHeight = img.height;
                    
                    // Always resize if above target size for better performance
                    if (img.width > TARGET_SIZE || img.height > TARGET_SIZE) {
                        if (img.width > img.height) {
                            newWidth = TARGET_SIZE;
                            newHeight = Math.round((img.height / img.width) * TARGET_SIZE);
                        } else {
                            newHeight = TARGET_SIZE;
                            newWidth = Math.round((img.width / img.height) * TARGET_SIZE);
                        }
                    }
                    
                    // Hard limit if still above MAX_SIZE
                    if (newWidth > MAX_SIZE || newHeight > MAX_SIZE) {
                        if (newWidth > newHeight) {
                            const ratio = MAX_SIZE / newWidth;
                            newWidth = MAX_SIZE;
                            newHeight = Math.round(newHeight * ratio);
                        } else {
                            const ratio = MAX_SIZE / newHeight;
                            newHeight = MAX_SIZE;
                            newWidth = Math.round(newWidth * ratio);
                        }
                    }
                    
                    // Create canvas and resize
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Use dimensions that are multiples of 2 for better compatibility
                    newWidth = Math.floor(newWidth / 2) * 2;
                    newHeight = Math.floor(newHeight / 2) * 2;
                    
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    
                    // Use high quality image rendering
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Draw the image with the new dimensions
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    
                    // Convert to optimized JPEG with appropriate quality
                    // Start with higher quality and reduce if needed
                    let quality = 0.90;
                    let optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    
                    // Estimate size (rough calculation, 1.37 is empirical factor for base64 encoding)
                    let estimatedSize = Math.ceil((optimizedDataUrl.length - 22) * 0.75);
                    
                    // If still too large, gradually reduce quality
                    while (estimatedSize > MAX_FILE_SIZE && quality > 0.5) {
                        quality -= 0.05;
                        optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
                        estimatedSize = Math.ceil((optimizedDataUrl.length - 22) * 0.75);
                    }
                    
                    console.log(`Optimized image: ${img.width}x${img.height} -> ${newWidth}x${newHeight}, Quality: ${quality.toFixed(2)}`);
                    
                    resolve(optimizedDataUrl);
                } catch (error) {
                    console.error('Error during image optimization:', error);
                    // Fall back to original image
                    resolve(dataUrl);
                }
            };
            
            img.onerror = function() {
                console.error('Failed to load image for optimization');
                // Fall back to original image
                resolve(dataUrl);
            };
            
            img.src = dataUrl;
        } catch (error) {
            console.error('Error optimizing image:', error);
            // Fall back to original image
            resolve(dataUrl);
        }
    });
}

function injectScripts(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, function(tab) {
            if (chrome.runtime.lastError) {
                reject(new Error(`Cannot access tab: ${chrome.runtime.lastError.message}`));
                return;
            }
            
            if (!tab.url || !tab.url.startsWith('http')) {
                reject(new Error('Cannot inject scripts on this page. Please try on a regular webpage.'));
                return;
            }
            
            injectScriptsToTab(tabId).then(resolve).catch(reject);
        });
    });
}

function injectScriptsToTab(tabId) {
    return new Promise((resolve, reject) => {
        try {
            // Inject content scripts first
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['config.js', 'content.js', 'screenshot.js']
            })
            .then(() => {
                // No need to inject config separately since we're already injecting config.js
                // Send message to content script that scripts are loaded
                chrome.tabs.sendMessage(tabId, { action: 'scriptsLoaded' }, function(response) {
                    resolve();
                });
            })
            .catch((error) => {
                reject(new Error(`Script injection error: ${error.message}`));
            });
        } catch (error) {
            reject(new Error(`Script injection error: ${error.message}`));
        }
    });
}

// Helper function to send errors to the tab
function sendErrorToTab(tabId, errorMessage, imageUrl = null) {
    console.error('Error in captureAndProcessSelection:', errorMessage);
    
    chrome.tabs.sendMessage(tabId, {
        action: 'displaySolution',
        solution: `Error: ${errorMessage}. Please try again or select a different area.`,
        imageUrl: imageUrl,
        options: { error: true }
    }, function(response) {
        // Log if there's an error sending the message
        if (chrome.runtime.lastError) {
            console.error('Error sending error message to tab:', chrome.runtime.lastError);
        }
    });
}

// Remove duplicated screenshot implementation that conflicts with screenshot.js
// The functionality is now properly handled by the screenshot.js file
