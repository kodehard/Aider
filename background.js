// Define default config to be used until the real config is loaded
const defaultConfig = {
    OPENROUTER_API_KEY: "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",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    TEXT_MODEL: "deepseek/deepseek-r1:free",
    VISION_MODEL: "meta-llama/llama-3.2-11b-vision-instruct:free",
    OCR_API_KEY: "K87825071688957",
    OCR_API_URL: "https://api.ocr.space/parse/image",
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
                return null;
            }
        }
    } catch (error) {
        return null;
    }
    return null;
}

chrome.runtime.onInstalled.addListener(() => {
    loadConfig();
    
    chrome.contextMenus.create({
        id: 'solveWithAider',
        title: 'Solve with Aider AI',
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
                return chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        console.log('Executing selection mode in page context');
                        if (typeof window.startSelectionMode === 'function') {
                            window.startSelectionMode();
                            return { success: true };
                        } else {
                            console.error('Selection mode functions not found in page context');
                            return { success: false, error: 'Selection functions not available' };
                        }
                    }
                });
            })
            .then((results) => {
                console.log('Selection mode execution results:', results);
                if (results && results[0] && results[0].result && results[0].result.success) {
                    sendResponse({ success: true });
                } else {
                    const error = results?.[0]?.result?.error || 'Could not start selection mode. Please try refreshing the page.';
                    sendResponse({ success: false, error: error });
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
        
        // Send an immediate acknowledgment that we received the message
        sendResponse({ received: true });
        
        // Then process the capture separately
        captureAndProcessSelection(selection, message.tabId || sender.tab.id);
        
        return true;
    } else if (message.action === 'startSelectionMode') {
        if (message.tabId) {
            chrome.tabs.sendMessage(message.tabId, { action: 'startSelectionMode' }, (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
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
        const API_URL = config.OPENROUTER_API_URL || "https://openrouter.ai/api/v1";
        const API_KEY = config.OPENROUTER_API_KEY;
        const MODEL = config.VISION_MODEL || "meta-llama/llama-3.2-11b-vision-instruct:free";
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
                    'X-Title': 'Aider AI'
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

    // Capture the entire page
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, function(dataUrl) {
        if (chrome.runtime.lastError) {
            console.error('Error capturing tab:', chrome.runtime.lastError);
            return;
        }

        // Process the image in the content script context
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: processFullPageScreenshot,
            args: [dataUrl, selection]
        });
    });
}

// Function to process the full page screenshot and crop it based on selection
function processFullPageScreenshot(dataUrl, selection) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas dimensions to the selection size
            canvas.width = selection.width;
            canvas.height = selection.height;

            // Draw the full image on the canvas
            ctx.drawImage(img, -selection.startX, -selection.startY);

            // Convert back to dataURL
            const croppedDataUrl = canvas.toDataURL('image/png');
            resolve(croppedDataUrl);
        };
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
            func: optimizeImageInPage,
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
                const MAX_SIZE = 4096; // Many vision APIs limit image dimensions
                const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB limit common for APIs
                
                // Check if we need to resize
                let newWidth = img.width;
                let newHeight = img.height;
                
                if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
                    if (img.width > img.height) {
                        newWidth = MAX_SIZE;
                        newHeight = (img.height / img.width) * MAX_SIZE;
                    } else {
                        newHeight = MAX_SIZE;
                        newWidth = (img.width / img.height) * MAX_SIZE;
                    }
                }
                
                // Create canvas and resize
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                
                // Convert to optimized JPEG
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            
            img.onerror = function() {
                reject('Failed to load image for optimization');
            };
            
            img.src = dataUrl;
        } catch (error) {
            console.error('Error optimizing image:', error);
            reject(error.message);
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
                files: ['content.js', 'screenshot.js']
            })
            .then(() => {
                // Inject config into the page context
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (configData) => {
                        // This runs in the context of the web page
                        window.config = configData;
                    },
                    args: [config]
                })
                .then(() => {
                    // Inject MathJax into the page context
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: () => {
                            // This runs in the context of the web page
                            window.MathJax = window.MathJax || {
                                tex: {
                                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                                    processEscapes: true
                                },
                                svg: {
                                    fontCache: 'global'
                                }
                            };
                            
                            // Basic handling of math expressions without full MathJax
                            window.formatMath = function(text) {
                                return text.replace(/\$\$(.*?)\$\$/g, '<div class="math-display">$1</div>')
                                           .replace(/\$(.*?)\$/g, '<span class="math-inline">$1</span>');
                            };
                        }
                    })
                    .then(() => {
                        // Send message to content script that scripts are loaded
                        chrome.tabs.sendMessage(tabId, { action: 'scriptsLoaded' }, function(response) {
                            resolve();
                        });
                    })
                    .catch(error => {
                        reject(new Error(`MathJax injection error: ${error.message}`));
                    });
                })
                .catch(error => {
                    reject(new Error(`Config injection error: ${error.message}`));
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

// Global variable to track selection state
window.aider = {
    screenshot: {
        isSelecting: false,
        selection: {
            startX: 0,
            startY: 0,
            width: 0,
            height: 0,
            isActive: false
        }
    }
};

let selectionDiv;

// Function to start selection mode
function startSelectionMode() {
    console.log('Starting selection mode');
    window.aider.screenshot.isSelecting = true;
    window.aider.screenshot.selection.isActive = true;

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Handle mouse down event
function handleMouseDown(e) {
    console.log('Mouse down at:', e.clientX, e.clientY);
    if (!window.aider.screenshot.isSelecting) return;

    // Capture starting coordinates
    window.aider.screenshot.selection.startX = e.clientX;
    window.aider.screenshot.selection.startY = e.clientY;
}

// Handle mouse move event
function handleMouseMove(e) {
    if (!window.aider.screenshot.isSelecting) return;

    // Update selection dimensions
    window.aider.screenshot.selection.width = e.clientX - window.aider.screenshot.selection.startX;
    window.aider.screenshot.selection.height = e.clientY - window.aider.screenshot.selection.startY;

    // Draw selection rectangle
    if (!selectionDiv) {
        selectionDiv = document.createElement('div');
        selectionDiv.style.position = 'absolute';
        selectionDiv.style.border = '2px dashed rgba(0, 255, 0, 0.5)';
        selectionDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        document.body.appendChild(selectionDiv);
    }

    selectionDiv.style.left = `${Math.min(e.clientX, window.aider.screenshot.selection.startX)}px`;
    selectionDiv.style.top = `${Math.min(e.clientY, window.aider.screenshot.selection.startY)}px`;
    selectionDiv.style.width = `${Math.abs(window.aider.screenshot.selection.width)}px`;
    selectionDiv.style.height = `${Math.abs(window.aider.screenshot.selection.height)}px`;
}

// Handle mouse up event
function handleMouseUp(e) {
    console.log('Mouse up at:', e.clientX, e.clientY);
    if (!window.aider.screenshot.isSelecting) return;

    // Finalize selection dimensions
    window.aider.screenshot.selection.isActive = false;
    window.aider.screenshot.isSelecting = false;

    // Remove the selection rectangle
    if (selectionDiv) {
        document.body.removeChild(selectionDiv);
        selectionDiv = null;
    }

    // Send selection data to background script for processing
    chrome.runtime.sendMessage({
        action: 'captureSelection',
        selection: window.aider.screenshot.selection
    });
}

// Start selection mode when needed
startSelectionMode();

// Function to initialize the screenshot functionality
function initScreenshot() {
    const screenshotButton = document.getElementById('screenshot-button');
    screenshotButton.addEventListener('click', captureScreenshot);
}

// Function to capture the screenshot
async function captureScreenshot() {
    try {
        const selection = getSelectionArea(); // Implement this to get the selected area
        const canvas = await html2canvas(document.body, {
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            width: selection.width,
            height: selection.height,
            x: selection.x,
            y: selection.y,
        });
        const imgData = canvas.toDataURL('image/png');
        downloadImage(imgData, 'screenshot.png');
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
}

// Function to download the image
function downloadImage(data, filename) {
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to get the selection area (to be implemented)
function getSelectionArea() {
    // Logic to determine the selected area
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }; // Example
}

// Initialize the screenshot functionality on page load
window.onload = initScreenshot;
