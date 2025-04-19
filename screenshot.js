/**
 * Aider AI Screenshot Module
 * A simple, reliable screenshot selection implementation
 */

// Initialize global namespace with minimal state
window.aider = window.aider || {};
window.aider.screenshot = {
  isSelecting: false,
  selection: null,
  ui: {},
  timeoutId: null
};

/**
 * Starts the screenshot selection process
 */
function startScreenshot() {
  console.log('Starting screenshot selection');
  
  // Clean up any previous selection UI
  cleanupScreenshotUI();
  
  // Initialize selection state
  window.aider.screenshot.isSelecting = true;
  window.aider.screenshot.selection = {
            startX: 0,
            startY: 0,
            width: 0,
            height: 0,
    scrollX: 0,
    scrollY: 0
  };
  
  // Change cursor
    document.body.style.cursor = 'crosshair';
    
  // Create overlay
    const overlay = document.createElement('div');
  overlay.id = 'aider-screenshot-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  overlay.style.zIndex = '2147483645'; // Very high z-index to be on top
    overlay.style.cursor = 'crosshair';
  document.body.appendChild(overlay);
  window.aider.screenshot.ui.overlay = overlay;
    
  // Add instructions
    const instructions = document.createElement('div');
  instructions.id = 'aider-screenshot-instructions';
  instructions.style.position = 'fixed';
    instructions.style.top = '10px';
    instructions.style.left = '50%';
    instructions.style.transform = 'translateX(-50%)';
  instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    instructions.style.color = 'white';
    instructions.style.padding = '8px 16px';
    instructions.style.borderRadius = '4px';
    instructions.style.fontSize = '14px';
    instructions.style.fontFamily = 'Arial, sans-serif';
  instructions.style.zIndex = '2147483646';
    instructions.textContent = 'Click and drag to select an area';
  document.body.appendChild(instructions);
  window.aider.screenshot.ui.instructions = instructions;
    
    // Add cancel button
    const cancelButton = document.createElement('button');
  cancelButton.id = 'aider-screenshot-cancel';
    cancelButton.textContent = 'Cancel';
  cancelButton.style.position = 'fixed';
    cancelButton.style.top = '10px';
    cancelButton.style.right = '10px';
    cancelButton.style.backgroundColor = '#f44336';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontFamily = 'Arial, sans-serif';
  cancelButton.style.zIndex = '2147483646';
  cancelButton.onclick = function(e) {
        e.stopPropagation();
    cleanupScreenshotUI();
  };
  document.body.appendChild(cancelButton);
  window.aider.screenshot.ui.cancelButton = cancelButton;
  
  // Set up event handlers
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
    
    return true;
}

/**
 * Handles the mouse down event to start a selection
 */
function handleMouseDown(e) {
  if (!window.aider.screenshot.isSelecting) return;
    
  // Prevent text selection
    e.preventDefault();
    
  // Store the starting position in client coordinates (fixed position relative to viewport)
  const selection = window.aider.screenshot.selection;
  selection.startX = e.clientX;
  selection.startY = e.clientY;
  
  // Get the current scroll position - include all possible scroll sources
  // This captures how far the page is scrolled at the START of selection
  selection.scrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
  selection.scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  
  console.log('Selection started at client coords:', selection.startX, selection.startY);
  console.log('Page scroll position:', selection.scrollX, selection.scrollY);
  console.log('Page coords (clientX+scrollX, clientY+scrollY):', 
    selection.startX + selection.scrollX, 
    selection.startY + selection.scrollY);
  
  selection.isActive = true;
  
  // Create selection rectangle - this is in fixed position (viewport coordinates)
  const selectionRect = document.createElement('div');
  selectionRect.id = 'aider-screenshot-selection';
  selectionRect.style.position = 'fixed';
  selectionRect.style.backgroundColor = 'rgba(66, 133, 244, 0.3)';
  selectionRect.style.border = '2px solid #4285F4';
  selectionRect.style.zIndex = '2147483646';
  selectionRect.style.pointerEvents = 'none';
  selectionRect.style.left = selection.startX + 'px';
  selectionRect.style.top = selection.startY + 'px';
  selectionRect.style.width = '0';
  selectionRect.style.height = '0';
  document.body.appendChild(selectionRect);
  window.aider.screenshot.ui.selectionRect = selectionRect;
}

/**
 * Handles mouse move to update the selection rectangle
 */
function handleMouseMove(e) {
  const selection = window.aider.screenshot.selection;
  if (!window.aider.screenshot.isSelecting || !selection || !selection.isActive) return;
  
  // Prevent text selection
  e.preventDefault();
  
  // Calculate dimensions
  const width = Math.abs(e.clientX - selection.startX);
  const height = Math.abs(e.clientY - selection.startY);
  
  // Calculate position (top-left corner)
  const left = Math.min(e.clientX, selection.startX);
  const top = Math.min(e.clientY, selection.startY);
  
  // Update selection object
  selection.width = width;
  selection.height = height;
  selection.endX = e.clientX;
  selection.endY = e.clientY;
  
  // Update selection rectangle
  const selectionRect = window.aider.screenshot.ui.selectionRect;
  if (selectionRect) {
    selectionRect.style.left = left + 'px';
    selectionRect.style.top = top + 'px';
    selectionRect.style.width = width + 'px';
    selectionRect.style.height = height + 'px';
  }
  
  // Update dimensions display
  updateDimensionsDisplay(width, height, left, top);
}

/**
 * Updates the dimensions display
 */
function updateDimensionsDisplay(width, height, left, top) {
  let dimensionsDisplay = window.aider.screenshot.ui.dimensionsDisplay;
  
  if (!dimensionsDisplay && width > 10 && height > 10) {
    dimensionsDisplay = document.createElement('div');
    dimensionsDisplay.id = 'aider-screenshot-dimensions';
    dimensionsDisplay.style.position = 'fixed';
    dimensionsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    dimensionsDisplay.style.color = 'white';
    dimensionsDisplay.style.padding = '4px 8px';
    dimensionsDisplay.style.borderRadius = '4px';
    dimensionsDisplay.style.fontSize = '12px';
    dimensionsDisplay.style.fontFamily = 'Arial, sans-serif';
    dimensionsDisplay.style.zIndex = '2147483646';
    dimensionsDisplay.style.pointerEvents = 'none';
    document.body.appendChild(dimensionsDisplay);
    window.aider.screenshot.ui.dimensionsDisplay = dimensionsDisplay;
  }
  
  if (dimensionsDisplay) {
    dimensionsDisplay.textContent = `${width} × ${height}`;
    dimensionsDisplay.style.left = (left + width + 5) + 'px';
    dimensionsDisplay.style.top = top + 'px';
  }
}

/**
 * Handles mouse up to complete the selection
 */
function handleMouseUp(e) {
  const selection = window.aider.screenshot.selection;
  if (!window.aider.screenshot.isSelecting || !selection || !selection.isActive) return;
  
  // Calculate final dimensions using client coordinates (viewport-relative)
  selection.width = Math.abs(e.clientX - selection.startX);
  selection.height = Math.abs(e.clientY - selection.startY);
  
  // Update the starting position to be the top-left corner
  // This keeps everything in client coordinates (viewport-relative)
  if (e.clientX < selection.startX) {
    selection.startX = e.clientX;
  }
  
  if (e.clientY < selection.startY) {
    selection.startY = e.clientY;
  }
  
  // Get current scroll position at the END of the selection
  // This ensures we account for any scrolling that happened during selection
  const currentScrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
  const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  
  console.log('Selection ended at client coords:', e.clientX, e.clientY);
  console.log('Final selection rect (client coords):', 
    selection.startX, selection.startY, selection.width, selection.height);
  console.log('Current scroll position:', currentScrollX, currentScrollY);
  
  // If scroll position changed during selection, use the new scroll position
  // This ensures we capture the correct part of the page
  selection.scrollX = currentScrollX;
  selection.scrollY = currentScrollY;
  
  // Check if selection is big enough
  if (selection.width < 10 || selection.height < 10) {
    console.log('Selection too small, ignoring');
    return;
  }
  
  console.log('Final selection data:', selection);
  
  // Prepare final selection data - using client coords and scroll position
  const finalSelection = {
    startX: selection.startX,  // client X (viewport relative)
    startY: selection.startY,  // client Y (viewport relative)
    width: selection.width,    // width in pixels
    height: selection.height,  // height in pixels
    scrollX: selection.scrollX, // page scroll X
    scrollY: selection.scrollY  // page scroll Y
  };
  
  // Clean up UI
  cleanupScreenshotUI();
  
  // Show processing UI
  showProcessingUI();
  
  // Send capture request
  sendCaptureRequest(finalSelection);
}

/**
 * Handles keyboard events
 */
function handleKeyDown(e) {
  if (e.key === 'Escape' && window.aider.screenshot.isSelecting) {
    cleanupScreenshotUI();
  }
}

/**
 * Shows the processing UI
 */
function showProcessingUI() {
  // Remove any existing popups first
  removeAllPopups();

  const processingContainer = document.createElement('div');
  processingContainer.id = 'aider-screenshot-processing';
  processingContainer.style.position = 'fixed';
  processingContainer.style.bottom = '20px';
  processingContainer.style.right = '20px';
  processingContainer.style.width = '350px';
  processingContainer.style.backgroundColor = 'white';
  processingContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  processingContainer.style.borderRadius = '8px';
  processingContainer.style.padding = '15px';
  processingContainer.style.zIndex = '2147483645';
  processingContainer.style.fontFamily = 'Arial, sans-serif';
  processingContainer.style.maxHeight = '80vh';
  processingContainer.style.overflow = 'auto';
  
  // Add header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '15px';
  
  const title = document.createElement('h3');
  title.textContent = 'Aider AI';
  title.style.margin = '0';
  title.style.color = '#333';
  title.style.fontWeight = '500';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.fontSize = '24px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.color = '#999';
  closeButton.style.lineHeight = '1';
  closeButton.onclick = function() {
    removeAllPopups();
    if (window.aider.screenshot.timeoutId) {
      clearTimeout(window.aider.screenshot.timeoutId);
    }
  };
  
  header.appendChild(title);
  header.appendChild(closeButton);
  processingContainer.appendChild(header);
  
  // Add spinner
  const spinnerContainer = document.createElement('div');
  spinnerContainer.style.display = 'flex';
  spinnerContainer.style.alignItems = 'center';
  spinnerContainer.style.justifyContent = 'center';
  spinnerContainer.style.flexDirection = 'column';
  spinnerContainer.style.padding = '15px 0';
  
  // Add keyframes for spinner animation if not already added
  if (!document.getElementById('aider-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'aider-spinner-style';
    style.textContent = `
      @keyframes aider-spinner-rotation {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  const spinner = document.createElement('div');
  spinner.style.border = '3px solid #f3f3f3';
  spinner.style.borderTop = '3px solid #3498db';
  spinner.style.borderRadius = '50%';
  spinner.style.width = '30px';
  spinner.style.height = '30px';
  spinner.style.animation = 'aider-spinner-rotation 1s linear infinite';
  
  const statusText = document.createElement('p');
  statusText.textContent = 'Processing your screenshot...';
  statusText.style.margin = '10px 0 0 0';
  statusText.style.color = '#666';
  
  spinnerContainer.appendChild(spinner);
  spinnerContainer.appendChild(statusText);
  processingContainer.appendChild(spinnerContainer);
  
  document.body.appendChild(processingContainer);
  window.aider.screenshot.ui.processingContainer = processingContainer;
  window.aider.screenshot.ui.statusText = statusText;
  
  // Set timeout for response
  window.aider.screenshot.timeoutId = setTimeout(() => {
    if (statusText) {
      statusText.textContent = 'No response from server. The request may have timed out.';
      statusText.style.color = '#f44336';
    }
    if (spinner) {
      spinner.style.display = 'none';
    }
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Try Again';
    retryButton.style.marginTop = '15px';
    retryButton.style.padding = '8px 16px';
    retryButton.style.backgroundColor = '#4285F4';
    retryButton.style.color = 'white';
    retryButton.style.border = 'none';
    retryButton.style.borderRadius = '4px';
    retryButton.style.cursor = 'pointer';
    retryButton.onclick = function() {
      removeAllPopups();
      startScreenshot();
    };
    processingContainer.appendChild(retryButton);
    
  }, 30000); // 30 second timeout
}

/**
 * Sends the capture request to the background script
 */
function sendCaptureRequest(selection) {
  console.log('Sending capture request:', selection);
  
    chrome.runtime.sendMessage({
        action: 'captureSelection',
    selection: selection,
    timestamp: Date.now()
    }, function(response) {
    console.log('Capture request response:', response);
    
    if (chrome.runtime.lastError) {
      handleCaptureError(chrome.runtime.lastError.message);
      return;
    }
    
    if (!response || !response.received) {
      handleCaptureError('No confirmation received');
      return;
    }
    
    // Request successfully sent, wait for processing
    updateProcessingStatus('Processing your screenshot...');
  });
}

/**
 * Updates the processing status text
 */
function updateProcessingStatus(message) {
  const statusText = window.aider.screenshot.ui.statusText;
  if (statusText) {
    statusText.textContent = message;
  }
}

/**
 * Handles capture errors
 */
function handleCaptureError(errorMessage) {
  console.error('Capture error:', errorMessage);
  
  const statusText = window.aider.screenshot.ui.statusText;
  const spinnerContainer = document.querySelector('#aider-screenshot-processing div:nth-child(2)');
  
  if (statusText) {
    statusText.textContent = `Error: ${errorMessage}`;
    statusText.style.color = '#f44336';
  }
  
  if (spinnerContainer) {
    const spinner = spinnerContainer.querySelector('div');
    if (spinner) {
      spinner.style.display = 'none';
    }
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Try Again';
    retryButton.style.marginTop = '15px';
    retryButton.style.padding = '8px 16px';
    retryButton.style.backgroundColor = '#4285F4';
    retryButton.style.color = 'white';
    retryButton.style.border = 'none';
    retryButton.style.borderRadius = '4px';
    retryButton.style.cursor = 'pointer';
    retryButton.onclick = function() {
      const container = document.getElementById('aider-screenshot-processing');
      if (container) document.body.removeChild(container);
      startScreenshot();
    };
    spinnerContainer.appendChild(retryButton);
  }
  
  // Clear timeout
  if (window.aider.screenshot.timeoutId) {
    clearTimeout(window.aider.screenshot.timeoutId);
    window.aider.screenshot.timeoutId = null;
  }
}

/**
 * Shows a solution result
 */
function showSolution(solution, imageUrl = null, options = {}) {
  console.log('Showing solution:', solution, imageUrl, options);
  
  // Clear timeout
  if (window.aider.screenshot.timeoutId) {
    clearTimeout(window.aider.screenshot.timeoutId);
    window.aider.screenshot.timeoutId = null;
  }
  
  // Remove any existing popups
  removeAllPopups();
  
  // Create a new container
  const container = document.createElement('div');
  container.id = 'aider-screenshot-solution';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.width = '350px';
  container.style.backgroundColor = 'white';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  container.style.borderRadius = '8px';
  container.style.padding = '15px';
  container.style.zIndex = '2147483645';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxHeight = '80vh';
  container.style.overflow = 'auto';
  
  // Add header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '15px';
  header.style.position = 'sticky';
  header.style.top = '0';
  header.style.backgroundColor = 'white';
  header.style.padding = '0 0 10px 0';
  header.style.borderBottom = '1px solid #f0f0f0';
  
  const title = document.createElement('h3');
  title.textContent = 'Aider AI';
  title.style.margin = '0';
    title.style.color = '#333';
  title.style.fontWeight = '500';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.fontSize = '24px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.color = '#999';
  closeButton.style.lineHeight = '1';
  closeButton.onclick = function() {
    removeAllPopups();
  };
  
  header.appendChild(title);
  header.appendChild(closeButton);
  container.appendChild(header);
  
  // Add image if provided
    if (imageUrl) {
        const imageContainer = document.createElement('div');
        imageContainer.style.marginBottom = '15px';
    imageContainer.style.maxHeight = '250px'; // Increased from 200px for better visibility
        imageContainer.style.overflow = 'hidden';
        imageContainer.style.borderRadius = '4px';
        imageContainer.style.border = '1px solid #e0e0e0';
    imageContainer.style.position = 'relative';
    imageContainer.style.textAlign = 'center'; // Center the image
        
        const image = document.createElement('img');
        image.src = imageUrl;
    image.style.maxWidth = '100%';
    image.style.maxHeight = '250px';
        image.style.objectFit = 'contain';
        
    // Add click to expand functionality
    imageContainer.style.cursor = 'pointer';
    imageContainer.title = 'Click to view full size';
    
    imageContainer.onclick = function() {
      const expandedView = document.createElement('div');
      expandedView.style.position = 'fixed';
      expandedView.style.top = '0';
      expandedView.style.left = '0';
      expandedView.style.width = '100%';
      expandedView.style.height = '100%';
      expandedView.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      expandedView.style.zIndex = '2147483647';
      expandedView.style.display = 'flex';
      expandedView.style.justifyContent = 'center';
      expandedView.style.alignItems = 'center';
      expandedView.style.cursor = 'zoom-out';
      
      const expandedImage = document.createElement('img');
      expandedImage.src = imageUrl;
      expandedImage.style.maxWidth = '90%';
      expandedImage.style.maxHeight = '90%';
      expandedImage.style.objectFit = 'contain';
      expandedImage.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
      
      expandedView.appendChild(expandedImage);
      document.body.appendChild(expandedView);
      
      expandedView.onclick = function() {
        document.body.removeChild(expandedView);
      };
    };
    
    // Add image info
    const imageInfo = document.createElement('div');
    imageInfo.style.position = 'absolute';
    imageInfo.style.bottom = '0';
    imageInfo.style.right = '0';
    imageInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    imageInfo.style.color = 'white';
    imageInfo.style.padding = '2px 6px';
    imageInfo.style.fontSize = '10px';
    imageInfo.style.borderTopLeftRadius = '4px';
    
    // Create a temporary image to get actual dimensions
    const tempImg = new Image();
    tempImg.onload = function() {
      imageInfo.textContent = `${tempImg.width} × ${tempImg.height}`;
    };
    tempImg.src = imageUrl;
    
    imageContainer.appendChild(image);
    imageContainer.appendChild(imageInfo);
    container.appendChild(imageContainer);
  }
  
  // Add solution content
  const content = document.createElement('div');
  content.style.marginBottom = '15px';
  content.style.padding = '5px';
  content.style.overflow = 'auto';
  content.style.maxHeight = imageUrl ? 'calc(80vh - 350px)' : 'calc(80vh - 150px)';
  content.style.lineHeight = '1.5';
  content.style.fontSize = '14px';
  
  // Format text with basic markdown
    let formattedSolution = solution
    .replace(/```([\s\S]*?)```/g, '<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 14px; white-space: pre-wrap; word-break: break-word;"><code>$1</code></pre>')
    .replace(/\$\$([\s\S]*?)\$\$/g, '<div style="font-family: serif; font-style: italic; margin: 10px 0; overflow-x: auto;">$1</div>')
    .replace(/\$([\s\S]*?)\$/g, '<span style="font-family: serif; font-style: italic;">$1</span>')
        .replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([\s\S]*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
        
  // Add error styling if needed
  if (options.error) {
    content.style.color = '#f44336';
  }
  
  content.innerHTML = formattedSolution;
  container.appendChild(content);
  
  // Add button container (for layout)
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.marginTop = '10px';
  buttonContainer.style.position = 'sticky';
  buttonContainer.style.bottom = '0';
  buttonContainer.style.backgroundColor = 'white';
  buttonContainer.style.padding = '10px 0 0 0';
  buttonContainer.style.borderTop = '1px solid #f0f0f0';
  
  // Add "take another" button
  const anotherButton = document.createElement('button');
  anotherButton.textContent = 'Take Another Screenshot';
  anotherButton.style.padding = '8px 16px';
  anotherButton.style.backgroundColor = '#4285F4';
  anotherButton.style.color = 'white';
  anotherButton.style.border = 'none';
  anotherButton.style.borderRadius = '4px';
  anotherButton.style.cursor = 'pointer';
  anotherButton.onclick = function() {
    removeAllPopups();
    startScreenshot();
  };
  
  buttonContainer.appendChild(anotherButton);
  container.appendChild(buttonContainer);
  
  document.body.appendChild(container);
  window.aider.screenshot.ui.solutionContainer = container;
}

/**
 * Removes all popup UI elements
 */
function removeAllPopups() {
  // Remove all possible popup elements
  const popupIds = [
    'aider-screenshot-processing',
    'aider-screenshot-solution', 
    'smartsolve-solution' // Also remove any old popups from previous implementation
  ];
  
  popupIds.forEach(id => {
    const element = document.getElementById(id);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
}

/**
 * Cleans up all screenshot UI elements
 */
function cleanupScreenshotUI() {
  console.log('Cleaning up screenshot UI');
  
  // Reset state
  window.aider.screenshot.isSelecting = false;
  if (window.aider.screenshot.selection) {
    window.aider.screenshot.selection.isActive = false;
  }
  
  // Remove all UI elements
  const elements = [
    'aider-screenshot-overlay',
    'aider-screenshot-instructions',
    'aider-screenshot-cancel',
    'aider-screenshot-selection',
    'aider-screenshot-dimensions'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.parentNode.removeChild(element);
    }
  });
  
  // Clear UI references
  window.aider.screenshot.ui = {};
  
  // Remove event listeners
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);
  
  // Reset cursor
  document.body.style.cursor = 'default';
}

/**
 * Set up message listener
 */
function setupMessageListener() {
  if (window.aider.listenerInitialized) return;
  
  console.log('Setting up message listener');
  
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Received message:', message);
    
    if (message.action === 'startSelectionMode') {
      const success = startScreenshot();
      sendResponse({success: success});
      return true;
    }
    
    if (message.action === 'displaySolution') {
      const { solution, imageUrl, options = {} } = message;
      
      // Handle different status values for backward compatibility
      if (message.status === 'processing' || options.processing) {
        showProcessingUI();
        if (window.aider.screenshot.ui.statusText) {
          window.aider.screenshot.ui.statusText.textContent = solution;
        }
      } else {
        showSolution(solution, imageUrl, options);
      }
      
      sendResponse({success: true});
      return true;
    }
    
    if (message.action === 'scriptsLoaded' || message.action === 'ping') {
      sendResponse({success: true});
      return true;
    }
  });
  
  // Also listen for custom events (for compatibility)
  document.addEventListener('smartsolve_startSelection', function() {
    startScreenshot();
  });
  
  document.addEventListener('smartsolve_displaySolution', function(event) {
    if (event.detail && event.detail.solution) {
      // Convert to the new options format
      const options = event.detail.options || {};
      if (event.detail.status === 'processing') {
        options.processing = true;
      }
      if (event.detail.error) {
        options.error = true;
      }
      
      showSolution(
        event.detail.solution,
        event.detail.imageUrl,
        options
      );
    }
  });
  
  // Expose functions globally for direct calls
  window.startSelectionMode = startScreenshot;
  window.displaySolution = showSolution;
  
  window.aider.listenerInitialized = true;
}

// Initialize when the script loads
setupMessageListener(); 