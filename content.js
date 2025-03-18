// This file will be used for other content script functionality
// Screenshot functionality is handled in screenshot.js

// Default config fallback if main config fails to load
if (typeof config === 'undefined') {
    console.warn('Config not found, using default values');
    window.config = {
        OCR_API_KEY: "K89040367688957",
        OCR_API_URL: "https://api.ocr.space/parse/image",
        OPENROUTER_API_KEY: "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",
        OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
        DEFAULT_MODEL: "openai/gpt-3.5-turbo:free"
    };
}
// Store config globally for easier access
const extensionConfig = window.config;

// Variables for selection functionality
let isSelecting = false;
let isDrawing = false;
let overlay = null;
let selectionBox = null;
let selection = {
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    docWidth: 0,
    docHeight: 0,
    scrollX: 0,
    scrollY: 0
};

// Function to start selection mode
function startSelection() {
    console.log('Starting selection mode');
    isSelecting = true;
    
    // Create selection overlay
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    overlay.style.cursor = 'crosshair';
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);
    
    // Store document dimensions
    selection.docWidth = Math.max(
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth
    );
    selection.docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.clientHeight
    );
    
    console.log('Document dimensions:', {
        width: selection.docWidth,
        height: selection.docHeight
    });
}

// Mouse event handlers
function handleMouseDown(e) {
    if (!isSelecting) return;
    
    isDrawing = true;
    selection.startX = e.pageX;
    selection.startY = e.pageY;
    
    // Store scroll position at start of selection
    selection.scrollX = window.pageXOffset;
    selection.scrollY = window.pageYOffset;
    
    console.log('Selection started at:', {
        x: selection.startX,
        y: selection.startY,
        scroll: {
            x: selection.scrollX,
            y: selection.scrollY
        }
    });
    
    selectionBox = document.createElement('div');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px solid #0078D7';
    selectionBox.style.backgroundColor = 'rgba(0, 120, 215, 0.1)';
    selectionBox.style.zIndex = '10001';
    document.body.appendChild(selectionBox);
}

function handleMouseMove(e) {
    if (!isDrawing) return;
    
    const width = e.pageX - selection.startX;
    const height = e.pageY - selection.startY;
    
    selectionBox.style.left = width < 0 ? e.pageX + 'px' : selection.startX + 'px';
    selectionBox.style.top = height < 0 ? e.pageY + 'px' : selection.startY + 'px';
    selectionBox.style.width = Math.abs(width) + 'px';
    selectionBox.style.height = Math.abs(height) + 'px';
}

function handleMouseUp(e) {
    if (!isDrawing) return;
    
    isDrawing = false;
    isSelecting = false;
    
    selection.width = Math.abs(e.pageX - selection.startX);
    selection.height = Math.abs(e.pageY - selection.startY);
    
    if (e.pageX < selection.startX) {
        selection.startX = e.pageX;
    }
    if (e.pageY < selection.startY) {
        selection.startY = e.pageY;
    }
    
    console.log('Selection completed:', selection);
    
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    
    chrome.runtime.sendMessage({
        action: 'captureSelection',
        selection: selection
    }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error capturing screenshot:', chrome.runtime.lastError);
        } else if (!response.success) {
            console.error('Screenshot capture failed:', response.error);
        } else {
            console.log('Screenshot capture initiated successfully');
        }
    });
}

// Add event listeners
document.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

// Create solution display
let solutionDiv = null;

function createSolutionDiv() {
    if (solutionDiv) return solutionDiv;
    
    solutionDiv = document.createElement('div');
    solutionDiv.style.position = 'fixed';
    solutionDiv.style.top = '10px';
    solutionDiv.style.right = '10px';
    solutionDiv.style.backgroundColor = 'white';
    solutionDiv.style.border = '1px solid #ccc';
    solutionDiv.style.borderRadius = '4px';
    solutionDiv.style.padding = '15px';
    solutionDiv.style.maxWidth = '400px';
    solutionDiv.style.maxHeight = '80vh';
    solutionDiv.style.overflowY = 'auto';
    solutionDiv.style.zIndex = '10002';
    solutionDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    document.body.appendChild(solutionDiv);
    return solutionDiv;
}

function displaySolution(solution, imageUrl = null, debugInfo = null) {
    const div = createSolutionDiv();
    
    let content = `
        <div style="margin-bottom: 10px;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="float: right; border: none; background: none; cursor: pointer; font-size: 16px;">×</button>
            <strong>Solution:</strong>
        </div>
        <div style="white-space: pre-wrap;">${solution}</div>
    `;
    
    if (imageUrl) {
        content += `
        <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
            <p><strong>Captured Image:</strong></p>
            <img src="${imageUrl}" style="max-width: 100%; border: 1px solid #ddd;" />
        </div>
        `;
    }
    
    if (debugInfo) {
        content += `
        <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; font-size: 12px; color: #666;">
            <p><strong>Debug Info:</strong></p>
            <pre style="overflow-x: auto;">${JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
        `;
    }
    
    div.innerHTML = content;
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'startSelectionMode') {
        startSelection();
        sendResponse({ status: 'Selection mode started' });
    } else if (request.action === 'cropAndSendScreenshot') {
        console.log('Processing screenshot with selection:', request.selection);
        const { selection, dataUrl } = request;
        
        const canvas = document.createElement('canvas');
        canvas.width = selection.width;
        canvas.height = selection.height;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = async function() {
            console.log('Image loaded, drawing to canvas');
            try {
                // Create a temporary canvas for the full screenshot
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Set canvas size to match the image
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                
                // Draw the full screenshot
                tempCtx.drawImage(img, 0, 0);
                
                // Calculate viewport dimensions
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Calculate scale factor between image and document
                const scaleX = img.width / viewportWidth;
                const scaleY = img.height / viewportHeight;
                
                // Adjust selection coordinates based on scale and scroll
                const scrollX = selection.scrollX || 0;
                const scrollY = selection.scrollY || 0;
                
                // Calculate viewport-relative coordinates (account for scroll)
                const viewportX = selection.startX - scrollX;
                const viewportY = selection.startY - scrollY;
                
                // Scale to image coordinates
                const scaledX = viewportX * scaleX;
                const scaledY = viewportY * scaleY;
                const scaledWidth = selection.width * scaleX;
                const scaledHeight = selection.height * scaleY;
                
                // Debug info for troubleshooting
                const debugInfo = {
                    viewport: { width: viewportWidth, height: viewportHeight },
                    image: { width: img.width, height: img.height },
                    scale: { x: scaleX, y: scaleY },
                    selection: {
                        original: {
                            x: selection.startX,
                            y: selection.startY,
                            width: selection.width,
                            height: selection.height
                        },
                        viewport: {
                            x: viewportX,
                            y: viewportY
                        },
                        scroll: {
                            x: scrollX,
                            y: scrollY
                        },
                        scaled: {
                            x: scaledX,
                            y: scaledY,
                            width: scaledWidth,
                            height: scaledHeight
                        }
                    }
                };
                
                console.log('Selection debug info:', debugInfo);
                
                // Set the target canvas size to match the selection
                canvas.width = scaledWidth;
                canvas.height = scaledHeight;
                
                // Draw the selected portion
                ctx.drawImage(
                    tempCanvas,
                    scaledX,
                    scaledY,
                    scaledWidth,
                    scaledHeight,
                    0,
                    0,
                    scaledWidth,
                    scaledHeight
                );
                
                const croppedDataUrl = canvas.toDataURL('image/png');
                console.log('Image cropped successfully');
                
                // Process the image by extracting text with Tesseract.js
                console.log('Starting text extraction...');
                
                // Display the image immediately while waiting for processing
                displaySolution('Analyzing the image...', croppedDataUrl, debugInfo);
                
                // Extract text from the image using OCR.space API
                const formData = new FormData();
                // Convert base64 to blob
                const base64Data = croppedDataUrl.split(',')[1];
                const blob = await (async () => {
                    const response = await fetch(`data:image/png;base64,${base64Data}`);
                    return response.blob();
                })();
                formData.append('file', blob, 'screenshot.png');
                
                try {
                    // Make a fallback text analysis with proper OCR
                    const ocrResult = await extractTextFromImage(croppedDataUrl);
                    console.log('Text extraction completed:', ocrResult);
                    
                    // Send the text and image to the background script
                    chrome.runtime.sendMessage({
                        action: 'processImage',
                        dataUrl: croppedDataUrl,
                        extractedText: ocrResult
                    }, response => {
                        console.log('Received response from processImage message:', response);
                        if (chrome.runtime.lastError) {
                            console.error('Error sending cropped image:', chrome.runtime.lastError);
                            displaySolution('Error processing image: ' + chrome.runtime.lastError.message, croppedDataUrl, debugInfo);
                        }
                    });
                } catch (error) {
                    console.error('Error extracting text:', error);
                    // Still send the image for processing even if OCR fails
                    chrome.runtime.sendMessage({
                        action: 'processImage',
                        dataUrl: croppedDataUrl,
                        extractedText: null
                    });
                }
                
            } catch (error) {
                console.error('Error processing screenshot:', error);
                displaySolution('Error processing the screenshot: ' + error.message, null, { error: error.toString(), stack: error.stack });
            }
        };
        
        img.src = dataUrl;
        sendResponse({ success: true });
    } else if (request.action === 'displaySolution') {
        displaySolution(request.solution);
        sendResponse({ success: true });
    }
    
    return true;
});

// Add OCR.space text extraction function 
async function extractTextFromImage(imageDataUrl) {
    try {
        // First, convert the data URL to a Blob
        const base64Data = imageDataUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        
        const blob = new Blob(byteArrays, {type: 'image/png'});
        
        // Create a FormData object and append the blob
        const formData = new FormData();
        formData.append('file', blob, 'screenshot.png');
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('apikey', extensionConfig.OCR_API_KEY); // Use extensionConfig
        
        // Send the request to OCR.space API
        const response = await fetch(extensionConfig.OCR_API_URL, { // Use extensionConfig
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.IsErroredOnProcessing) {
            throw new Error(result.ErrorMessage[0]);
        }
        
        // Extract text from the response
        if (result.ParsedResults && result.ParsedResults.length > 0) {
            return result.ParsedResults[0].ParsedText;
        } else {
            return '';
        }
    } catch (error) {
        console.error('OCR Error:', error);
        return '';
    }
}
