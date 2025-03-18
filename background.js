// Define default config to be used until the real config is loaded
const defaultConfig = {
    OPENROUTER_API_KEY: "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",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    DEFAULT_MODEL: "openai/gpt-3.5-turbo:free",
    OCR_API_KEY: "K89040367688957",
    OCR_API_URL: "https://api.ocr.space/parse/image"
};

// Use default config initially
let config = defaultConfig;

// Load the config at startup
loadConfig();

// Function to load config
async function loadConfig() {
    try {
        const response = await fetch('config.js');
        if (!response.ok) {
            console.error('Failed to load config file, using defaults');
            return;
        }
        
        const text = await response.text();
        // Extract the config object definition
        const configMatch = text.match(/const\s+config\s*=\s*({[\s\S]*?});/);
        if (configMatch && configMatch[1]) {
            try {
                // Use Function constructor to safely evaluate the object
                const loadedConfig = Function(`return ${configMatch[1]}`)();
                console.log('Config loaded successfully:', loadedConfig);
                config = loadedConfig;
            } catch (e) {
                console.error('Error parsing config:', e);
            }
        }
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    // Reload config when extension is installed/updated
    loadConfig();
    
    chrome.contextMenus.create({
        id: 'solveWithSmartSolve',
        title: 'Solve with SmartSolve',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'solveWithSmartSolve' && info.selectionText) {
        chrome.storage.local.set({ selectedText: info.selectionText });
        chrome.action.openPopup();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background script received message:', message);
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    
    if (message.action === 'captureSelection') {
        console.log('Capturing selection for tab:', tabId);
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Tab not found", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error("Capture failed", chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                
                console.log('Screenshot captured, sending to content script');
                chrome.tabs.sendMessage(tabId, {
                    action: 'cropAndSendScreenshot',
                    selection: message.selection,
                    dataUrl: dataUrl
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message to content script:', chrome.runtime.lastError.message);
                    }
                });
                
                sendResponse({ success: true });
            });
        });
        
        return true;
    } else if (message.action === 'startSelectionMode') {
        console.log('Starting selection mode for tab:', tabId);
        if (tabId) {
            chrome.tabs.sendMessage(tabId, { action: 'startSelectionMode' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error starting selection mode:', chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('Selection mode started successfully:', response);
                    sendResponse({ success: true });
                }
            });
        } else {
            console.error("Tab ID is not available for startSelectionMode");
            sendResponse({ success: false, error: "Tab ID is not available" });
        }
        return true;
    } else if (message.action === 'processImage') {
        console.log('Processing image with extracted text');
        
        // Use the extracted text if available
        if (message.extractedText) {
            console.log('Using extracted text from OCR:', message.extractedText);
            solveQuestion(message.extractedText, tabId, message.dataUrl);
        } else {
            // Fall back to image-based processing
            console.log('No extracted text available, using image directly');
            solveQuestion("Unable to extract text from image", tabId, message.dataUrl);
        }
        
        sendResponse({ success: true });
        return true;
    }
});

async function solveQuestion(extractedText, tabId, imageDataUrl) {
    try {
        console.log('Starting to process extracted text');
        
        const baseUrl = config.OPENROUTER_API_URL;
        const apiKey = config.OPENROUTER_API_KEY;
        const model = config.DEFAULT_MODEL;
        
        console.log('Preparing to send API request to model:', model);
        
        // Create a prompt with the extracted text
        const prompt = `I've captured a screenshot of text that says:\n\n"${extractedText}"\n\nPlease analyze this text and provide a detailed explanation or answer.`;
        
        console.log('Sending API request to OpenRouter...');
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://example.com',
                'X-Title': 'SmartSolve AI'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }]
            })
        });
        
        console.log('Received API response, status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            
            let errorMessage = `Error ${response.status}: Failed to process the text.`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error && errorJson.error.message) {
                    errorMessage += ` ${errorJson.error.message}`;
                }
            } catch (e) {
                errorMessage += ` ${errorText.substring(0, 200)}...`;
            }
            
            chrome.tabs.sendMessage(tabId, {
                action: 'displaySolution',
                solution: errorMessage
            });
            return;
        }
        
        const data = await response.json();
        console.log('API data received:', data);
        
        if (data.choices && data.choices.length > 0) {
            const answer = data.choices[0].message.content;
            
            console.log('AI response received, sending solution to content script');
            
            // Format the solution to include the extracted text
            const formattedSolution = `
Extracted Text:
${extractedText}

Analysis:
${answer}
`;
            
            chrome.tabs.sendMessage(tabId, {
                action: 'displaySolution',
                solution: formattedSolution
            }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending solution to content script:', chrome.runtime.lastError);
                }
            });
        } else {
            console.error('No choices found in API response:', data);
            chrome.tabs.sendMessage(tabId, {
                action: 'displaySolution',
                solution: 'Error: No response from the AI model. Please try again.'
            });
        }
    } catch (error) {
        console.error('Error processing text:', error);
        chrome.tabs.sendMessage(tabId, {
            action: 'displaySolution',
            solution: 'Error: ' + error.message
        });
    }
}

// Function to resize large images for better API reliability
function resizeImageIfNeeded(dataUrl, maxDimension = 800) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            // Check if resizing is needed
            let width = img.width;
            let height = img.height;
            
            if (width <= maxDimension && height <= maxDimension) {
                console.log('Image is already within size limits', width, 'x', height);
                resolve(dataUrl);
                return;
            }
            
            // Calculate new dimensions
            if (width > height) {
                height = Math.round((height / width) * maxDimension);
                width = maxDimension;
            } else {
                width = Math.round((width / height) * maxDimension);
                height = maxDimension;
            }
            
            console.log('Resizing image from', img.width, 'x', img.height, 'to', width, 'x', height);
            
            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            // Draw resized image
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get new data URL
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            console.log('Image resized successfully');
            resolve(resizedDataUrl);
        };
        
        img.onerror = function() {
            console.error('Error loading image for resizing');
            reject(new Error('Failed to load image for resizing'));
        };
        
        img.src = dataUrl;
    });
}
