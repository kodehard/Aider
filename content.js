// This file will be used for other content script functionality
// Screenshot functionality is handled in screenshot.js

// Default config fallback if main config fails to load
if (typeof window.config === 'undefined') {
    window.config = {
        OPENROUTER_API_KEY: "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",
        OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
        TEXT_MODEL: "deepseek/deepseek-r1:free",
        VISION_MODEL: "meta-llama/llama-3.2-11b-vision-instruct:free",
        mathjax_cdn_url: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
    };
}

// Ensure mathjax_cdn_url is defined for any scripts that need it
if (typeof window.mathjax_cdn_url === 'undefined' && window.config.mathjax_cdn_url) {
    window.mathjax_cdn_url = window.config.mathjax_cdn_url;
}

// Store config globally for easier access if not already defined
if (typeof window.extensionConfig === 'undefined') {
    window.extensionConfig = window.config;
}

// Variables for selection functionality - only define if not already defined
if (typeof window.isSelecting === 'undefined') {
    window.isSelecting = false;
    window.isDrawing = false;
    window.overlay = null;
    window.selectionBox = null;
    window.selection = {
        startX: 0,
        startY: 0,
        width: 0,
        height: 0,
        docWidth: 0,
        docHeight: 0,
        scrollX: 0,
        scrollY: 0
    };
}

// Function to start selection mode
function startSelection() {
    window.isSelecting = true;
    
    // Create selection overlay
    window.overlay = document.createElement('div');
    window.overlay.style.position = 'fixed';
    window.overlay.style.top = '0';
    window.overlay.style.left = '0';
    window.overlay.style.width = '100%';
    window.overlay.style.height = '100%';
    window.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    window.overlay.style.cursor = 'crosshair';
    window.overlay.style.zIndex = '10000';
    document.body.appendChild(window.overlay);
    
    // Store document dimensions
    window.selection.docWidth = Math.max(
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth
    );
    window.selection.docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.clientHeight
    );
}

// Mouse event handlers
function handleMouseDown(e) {
    if (!window.isSelecting) return;
    
    window.isDrawing = true;
    window.selection.startX = e.pageX;
    window.selection.startY = e.pageY;
    
    // Store scroll position at start of selection
    window.selection.scrollX = window.pageXOffset;
    window.selection.scrollY = window.pageYOffset;
    
    window.selectionBox = document.createElement('div');
    window.selectionBox.style.position = 'absolute';
    window.selectionBox.style.border = '2px solid #0078D7';
    window.selectionBox.style.backgroundColor = 'rgba(0, 120, 215, 0.1)';
    window.selectionBox.style.zIndex = '10001';
    document.body.appendChild(window.selectionBox);
}

function handleMouseMove(e) {
    if (!window.isDrawing) return;
    
    const width = e.pageX - window.selection.startX;
    const height = e.pageY - window.selection.startY;
    
    window.selectionBox.style.left = width < 0 ? e.pageX + 'px' : window.selection.startX + 'px';
    window.selectionBox.style.top = height < 0 ? e.pageY + 'px' : window.selection.startY + 'px';
    window.selectionBox.style.width = Math.abs(width) + 'px';
    window.selectionBox.style.height = Math.abs(height) + 'px';
}

function handleMouseUp(e) {
    if (!window.isDrawing) return;
    
    window.isDrawing = false;
    window.isSelecting = false;
    
    window.selection.width = Math.abs(e.pageX - window.selection.startX);
    window.selection.height = Math.abs(e.pageY - window.selection.startY);
    
    if (e.pageX < window.selection.startX) {
        window.selection.startX = e.pageX;
    }
    if (e.pageY < window.selection.startY) {
        window.selection.startY = e.pageY;
    }
    
    if (window.overlay) {
        window.overlay.remove();
        window.overlay = null;
    }
    if (window.selectionBox) {
        window.selectionBox.remove();
        window.selectionBox = null;
    }
    
    chrome.runtime.sendMessage({
        action: 'captureSelection',
        selection: window.selection
    });
}

// Add event listeners only if they haven't been added yet
if (!window.contentScriptEventsInitialized) {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.contentScriptEventsInitialized = true;
}

// Create solution display
if (typeof window.solutionDiv === 'undefined') {
    window.solutionDiv = null;
}

// Initialize window namespace to avoid conflicts with screenshot.js
if (typeof window.smartsolve === 'undefined') {
    window.smartsolve = {
        messageListenerInitialized: false
    };
}

// Setup message listener for communication with popup and background scripts
if (!window.messageListenerInitialized) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Add a listener for ping to check if content script is loaded
        if (message.action === 'ping') {
            sendResponse({ success: true });
            return true;
        }
        // Add a listener for starting selection mode
        else if (message.action === 'startSelectionMode') {
            if (typeof window.startSelectionMode === 'function') {
                window.startSelectionMode();
                sendResponse({ success: true });
            } else if (window.smartsolve && typeof window.smartsolve.selectionModeActive !== 'undefined') {
                window.smartsolve.selectionModeActive = true;
                const event = new CustomEvent('smartsolve_startSelection');
                document.dispatchEvent(event);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'Selection mode function not available' });
            }
            return true;
        }
        // Add a listener for scriptsLoaded
        else if (message.action === 'scriptsLoaded') {
            sendResponse({ success: true });
            return true;
        }
        // Add a listener for displaying solution
        else if (message.action === 'displaySolution') {
            if (typeof window.displaySolution === 'function') {
                const options = {
                    status: message.status || 'completed',
                    error: message.options?.error || false
                };
                window.displaySolution(message.solution, message.imageUrl, options);
                sendResponse({ success: true });
            } else if (window.smartsolve && window.smartsolve.ui) {
                // Try to find the function in smartsolve namespace
                const event = new CustomEvent('smartsolve_displaySolution', { 
                    detail: { 
                        solution: message.solution, 
                        imageUrl: message.imageUrl,
                        options: {
                            status: message.status || 'completed',
                            error: message.options?.error || false
                        }
                    } 
                });
                document.dispatchEvent(event);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'Display solution function not available' });
            }
            return true;
        }
    });
    
    window.messageListenerInitialized = true;
}

// Helper function to display solutions
function displaySolution(text, imageUrl) {
    // Remove any existing solution div
    const existingSolution = document.getElementById('smartsolve-solution');
    if (existingSolution) {
        existingSolution.remove();
    }
    
    const solutionDiv = document.createElement('div');
    solutionDiv.id = 'smartsolve-solution';
    solutionDiv.style.position = 'fixed';
    solutionDiv.style.top = '50%';
    solutionDiv.style.left = '50%';
    solutionDiv.style.transform = 'translate(-50%, -50%)';
    solutionDiv.style.backgroundColor = 'white';
    solutionDiv.style.padding = '20px';
    solutionDiv.style.border = '1px solid #ccc';
    solutionDiv.style.borderRadius = '5px';
    solutionDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    solutionDiv.style.zIndex = '10004';
    solutionDiv.style.maxWidth = '80%';
    solutionDiv.style.maxHeight = '80vh';
    solutionDiv.style.overflow = 'auto';
    
    let contentHtml = '<div style="text-align: center;">';
    
    // Add image if provided
    if (imageUrl) {
        contentHtml += `<img src="${imageUrl}" style="max-width: 100%; max-height: 300px; margin-bottom: 15px;" />`;
    }
    
    // Format text content with basic handling for math expressions
    let formattedText = text;
    formattedText = formattedText
        .replace(/\$\$(.*?)\$\$/g, '<div class="math-display" style="font-family: serif; font-style: italic; margin: 10px 0;">$1</div>')
        .replace(/\$(.*?)\$/g, '<span class="math-inline" style="font-family: serif; font-style: italic;">$1</span>')
        .replace(/```([\s\S]*?)```/g, '<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;"><code>$1</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    
    contentHtml += `<div style="text-align: left; white-space: pre-wrap;">${formattedText}</div>`;
    
    // Add close button
    contentHtml += `<button id="smartsolve-close-solution" style="margin-top: 20px;">Close</button></div>`;
    
    solutionDiv.innerHTML = contentHtml;
    document.body.appendChild(solutionDiv);
    
    // Add event listener to close button
    document.getElementById('smartsolve-close-solution').addEventListener('click', () => {
        solutionDiv.remove();
    });
}
