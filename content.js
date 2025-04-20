// This file will be used for content script functionality
// Screenshot functionality is handled in screenshot.js

// Default config fallback if main config fails to load
if (typeof window.config === 'undefined') {
    // Load from config.js first
    console.error('Config not found, using fallback config');
    // This should not happen since we're injecting config.js first
}

// Ensure mathjax_cdn_url is defined for any scripts that need it
if (typeof window.mathjax_cdn_url === 'undefined' && window.config && window.config.mathjax_cdn_url) {
    window.mathjax_cdn_url = window.config.mathjax_cdn_url;
}

// Create solution display
if (typeof window.solutionDiv === 'undefined') {
    window.solutionDiv = null;
}

// Setup message listener for communication with popup and background scripts
if (!window.messageListenerInitialized) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content.js received message:', message);
        
        // Add a listener for ping to check if content script is loaded
        if (message.action === 'ping') {
            sendResponse({ success: true });
            return true;
        }
        // Add a listener for scriptsLoaded
        else if (message.action === 'scriptsLoaded') {
            sendResponse({ success: true });
            return true;
        }
        // Add a listener for startSelectionMode - forward to screenshot.js functions
        else if (message.action === 'startSelectionMode') {
            console.log('Content.js handling startSelectionMode');
            try {
                // Try to call the appropriate function in screenshot.js
                if (typeof window.startScreenshot === 'function') {
                    console.log('Calling window.startScreenshot()');
                    window.startScreenshot();
                    sendResponse({ success: true });
                } else if (typeof window.startSelectionMode === 'function') {
                    console.log('Calling window.startSelectionMode()');
                    window.startSelectionMode();
                    sendResponse({ success: true });
                } else if (window.aider && window.aider.screenshot) {
                    if (typeof window.aider.screenshot.startScreenshot === 'function') {
                        console.log('Calling window.aider.screenshot.startScreenshot()');
                        window.aider.screenshot.startScreenshot();
                        sendResponse({ success: true });
                    } else {
                        console.error('Screenshot function not found in aider.screenshot namespace');
                        // Try dispatching event
                        const event = new CustomEvent('smartsolve_startSelection');
                        document.dispatchEvent(event);
                        sendResponse({ success: true });
                    }
                } else {
                    console.error('No screenshot function found, dispatching event');
                    // Try dispatching event
                    const event = new CustomEvent('smartsolve_startSelection');
                    document.dispatchEvent(event);
                    sendResponse({ success: true });
                }
            } catch (error) {
                console.error('Error starting selection mode:', error);
                sendResponse({ success: false, error: 'Error starting selection mode: ' + error.message });
            }
            return true;
        }
        // Add a listener for displaying solution
        else if (message.action === 'displaySolution') {
            if (typeof window.displaySolution === 'function') {
                try {
                    const options = {
                        status: message.status || 'completed',
                        error: message.options?.error || false
                    };
                    window.displaySolution(message.solution, message.imageUrl, options);
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('Error displaying solution:', error);
                    sendResponse({ success: false, error: 'Error displaying solution: ' + error.message });
                }
            } else if (window.smartsolve && window.smartsolve.ui) {
                // Try to find the function in smartsolve namespace
                try {
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
                } catch (error) {
                    console.error('Error dispatching solution event:', error);
                    sendResponse({ success: false, error: 'Error dispatching solution event: ' + error.message });
                }
            } else {
                // Fallback to our own implementation
                try {
                    displaySolution(message.solution, message.imageUrl, message.options);
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('Error with fallback display solution:', error);
                    sendResponse({ success: false, error: 'Error with fallback display: ' + error.message });
                }
            }
            return true;
        }
    });
    
    window.messageListenerInitialized = true;
    console.log('Content script message listener initialized');
}

// Helper function to display solutions
function displaySolution(text, imageUrl, options = {}) {
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
    solutionDiv.style.borderRadius = '8px';
    solutionDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    solutionDiv.style.zIndex = '2147483644'; // High but below screenshot UI
    solutionDiv.style.maxWidth = '80%';
    solutionDiv.style.maxHeight = '80vh';
    solutionDiv.style.overflow = 'auto';
    
    // Add a draggable header
    const header = document.createElement('div');
    header.style.padding = '10px 0';
    header.style.marginBottom = '15px';
    header.style.borderBottom = '1px solid #eee';
    header.style.cursor = 'move';
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.backgroundColor = 'white';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    const title = document.createElement('h3');
    title.textContent = 'Snap Solve';
    title.style.margin = '0';
    title.style.color = '#333';
    title.style.fontWeight = '500';
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#999';
    
    header.appendChild(title);
    header.appendChild(closeButton);
    solutionDiv.appendChild(header);
    
    // Main content container
    const contentContainer = document.createElement('div');
    contentContainer.style.position = 'relative';
    
    // Add image if provided
    if (imageUrl) {
        const imageContainer = document.createElement('div');
        imageContainer.style.textAlign = 'center';
        imageContainer.style.marginBottom = '15px';
        
        const image = document.createElement('img');
        image.src = imageUrl;
        image.style.maxWidth = '100%';
        image.style.maxHeight = '300px';
        image.style.border = '1px solid #eee';
        image.style.borderRadius = '4px';
        
        imageContainer.appendChild(image);
        contentContainer.appendChild(imageContainer);
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
    
    const textContent = document.createElement('div');
    textContent.style.textAlign = 'left';
    textContent.style.lineHeight = '1.5';
    
    // Add error styling if needed
    if (options.error) {
        textContent.style.color = '#f44336';
    }
    
    textContent.innerHTML = formattedText;
    contentContainer.appendChild(textContent);
    
    // Add "Take Another Screenshot" button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '10px';
    
    const takeAnotherButton = document.createElement('button');
    takeAnotherButton.textContent = 'Take Another Screenshot';
    takeAnotherButton.style.backgroundColor = '#1a73e8';
    takeAnotherButton.style.color = 'white';
    takeAnotherButton.style.border = 'none';
    takeAnotherButton.style.borderRadius = '4px';
    takeAnotherButton.style.padding = '8px 16px';
    takeAnotherButton.style.cursor = 'pointer';
    
    buttonContainer.appendChild(takeAnotherButton);
    contentContainer.appendChild(buttonContainer);
    
    // Add the content container to the solution div
    solutionDiv.appendChild(contentContainer);
    
    // Add to page
    document.body.appendChild(solutionDiv);
    
    // Make the solution div draggable by header
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - solutionDiv.getBoundingClientRect().left;
        offsetY = e.clientY - solutionDiv.getBoundingClientRect().top;
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            solutionDiv.style.left = (e.clientX - offsetX) + 'px';
            solutionDiv.style.top = (e.clientY - offsetY) + 'px';
            solutionDiv.style.transform = 'none'; // Remove the centering transform
        }
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
    
    // Event listeners
    closeButton.addEventListener('click', () => {
        solutionDiv.remove();
    });
    
    takeAnotherButton.addEventListener('click', () => {
        solutionDiv.remove();
        // Check if we have the screenshot function available
        if (typeof window.startSelectionMode === 'function') {
            window.startSelectionMode();
        } else if (window.aider && window.aider.screenshot) {
            if (typeof window.aider.screenshot.startScreenshot === 'function') {
                window.aider.screenshot.startScreenshot();
            } else if (typeof startScreenshot === 'function') {
                startScreenshot();
            }
        } else {
            // Try to trigger via event
            const event = new CustomEvent('smartsolve_startSelection');
            document.dispatchEvent(event);
        }
    });
    
    // Store reference to solution div
    window.solutionDiv = solutionDiv;
}

// Expose functions for access from other scripts or background page
window.displaySolution = displaySolution;
