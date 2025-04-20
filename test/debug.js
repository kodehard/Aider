/**
 * Screenshot Debug Tool
 * 
 * This script helps debug the screenshot functionality.
 * Run this in the browser console on a page where you're testing the extension.
 */

function debugScreenshotFunctionality() {
    console.log('=== Screenshot Functionality Debug ===');
    
    // Check global functions availability
    console.log('\n1. Checking global functions:');
    console.log('window.startScreenshot exists:', typeof window.startScreenshot === 'function');
    console.log('window.startSelectionMode exists:', typeof window.startSelectionMode === 'function');
    console.log('window.aider exists:', typeof window.aider !== 'undefined');
    
    if (window.aider) {
        console.log('window.aider.screenshot exists:', typeof window.aider.screenshot !== 'undefined');
        if (window.aider.screenshot) {
            console.log('window.aider.screenshot.startScreenshot exists:', 
                typeof window.aider.screenshot.startScreenshot === 'function');
        }
    }
    
    // Check message listeners
    console.log('\n2. Testing message listeners:');
    console.log('window.messageListenerInitialized:', window.messageListenerInitialized);
    console.log('window.aider.listenerInitialized:', window.aider?.listenerInitialized);
    
    // Try to manually trigger screenshot functionality
    console.log('\n3. Attempting to manually trigger screenshot:');
    try {
        if (typeof window.startScreenshot === 'function') {
            console.log('Calling window.startScreenshot()');
            window.startScreenshot();
            return 'Started screenshot via window.startScreenshot';
        } else if (typeof window.startSelectionMode === 'function') {
            console.log('Calling window.startSelectionMode()');
            window.startSelectionMode();
            return 'Started screenshot via window.startSelectionMode';
        } else if (window.aider && window.aider.screenshot && 
                   typeof window.aider.screenshot.startScreenshot === 'function') {
            console.log('Calling window.aider.screenshot.startScreenshot()');
            window.aider.screenshot.startScreenshot();
            return 'Started screenshot via window.aider.screenshot.startScreenshot';
        } else {
            console.log('No screenshot function found, attempting event dispatch');
            const event = new CustomEvent('smartsolve_startSelection');
            document.dispatchEvent(event);
            return 'Dispatched smartsolve_startSelection event';
        }
    } catch (error) {
        console.error('Error triggering screenshot:', error);
        return 'Error: ' + error.message;
    }
}

// Inject debug UI
function injectDebugUI() {
    // Remove any existing debug UI
    const existingDebug = document.getElementById('aider-debug-panel');
    if (existingDebug) {
        existingDebug.remove();
    }
    
    // Create debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'aider-debug-panel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '10px';
    debugPanel.style.left = '10px';
    debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    debugPanel.style.color = 'white';
    debugPanel.style.padding = '10px';
    debugPanel.style.borderRadius = '5px';
    debugPanel.style.zIndex = '9999999';
    debugPanel.style.fontSize = '12px';
    debugPanel.style.fontFamily = 'monospace';
    
    // Add a title
    const title = document.createElement('h3');
    title.textContent = 'Aider Debug Panel';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '14px';
    debugPanel.appendChild(title);
    
    // Add debug buttons
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Screenshot';
    startButton.style.marginRight = '5px';
    startButton.style.padding = '5px';
    startButton.onclick = function() {
        debugScreenshotFunctionality();
    };
    debugPanel.appendChild(startButton);
    
    const cleanButton = document.createElement('button');
    cleanButton.textContent = 'Clean UI';
    cleanButton.style.marginRight = '5px';
    cleanButton.style.padding = '5px';
    cleanButton.onclick = function() {
        if (typeof window.cleanupScreenshotUI === 'function') {
            window.cleanupScreenshotUI();
        }
    };
    debugPanel.appendChild(cleanButton);
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close Debug';
    closeButton.style.padding = '5px';
    closeButton.onclick = function() {
        debugPanel.remove();
    };
    debugPanel.appendChild(closeButton);
    
    // Add to page
    document.body.appendChild(debugPanel);
}

// Run debug
injectDebugUI();
debugScreenshotFunctionality(); 