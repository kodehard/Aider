// Tesseract loading state
let tesseractLoaded = false;
let tesseractLoadAttempted = false;
let tesseractObject = null;

// Initialize Tesseract from the locally loaded script
(() => {
    console.log('Checking for Tesseract.js');
    if (typeof window.Tesseract !== 'undefined') {
        console.log('Tesseract.js is available');
        tesseractLoaded = true;
        tesseractObject = window.Tesseract;
    } else {
        console.log('Waiting for Tesseract.js to become available');
        // Wait for Tesseract to be loaded by the content script
        const checkInterval = setInterval(() => {
            if (typeof window.Tesseract !== 'undefined') {
                clearInterval(checkInterval);
                console.log('Tesseract.js is now available');
                tesseractLoaded = true;
                tesseractObject = window.Tesseract;
            }
        }, 100);
    }
})();

// Function to check if Tesseract is loaded
async function waitForTesseract(timeout = 5000) {
    console.log('Waiting for Tesseract to load...');
    
    // If already loaded, return immediately
    if (tesseractLoaded && tesseractObject) {
        console.log('Tesseract already loaded');
        return tesseractObject;
    }
    
    // Set up a promise with timeout
    return Promise.race([
        new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (tesseractObject) {
                    clearInterval(checkInterval);
                    console.log('Tesseract detected:', tesseractObject);
                    resolve(tesseractObject);
                }
            }, 100);
        }),
        new Promise((_, reject) => 
            setTimeout(() => {
                console.error('Tesseract loading timed out after', timeout, 'ms');
                reject(new Error('Tesseract loading timed out'));
            }, timeout)
        )
    ]);
}

let isSelecting = false;
let startX = 0;
let startY = 0;
let selectionDiv;
let solutionDiv;
let isSelectionMode = false;

function createSelectionDiv() {
    selectionDiv = document.createElement('div');
    selectionDiv.id = 'selectionDiv';
    selectionDiv.style.position = 'fixed';
    selectionDiv.style.backgroundColor = 'rgba(100, 149, 237, 0.3)';
    selectionDiv.style.border = '2px dashed dodgerblue';
    selectionDiv.style.zIndex = '10000';
    selectionDiv.style.pointerEvents = 'none';
    document.body.appendChild(selectionDiv);
    return selectionDiv;
}

function createSolutionDiv() {
    solutionDiv = document.createElement('div');
    solutionDiv.id = 'solutionDiv';
    solutionDiv.style.position = 'fixed';
    solutionDiv.style.top = '10px';
    solutionDiv.style.left = '10px';
    solutionDiv.style.backgroundColor = 'white';
    solutionDiv.style.border = '1px solid black';
    solutionDiv.style.padding = '10px';
    solutionDiv.style.zIndex = '10001';
    solutionDiv.style.maxWidth = '300px';
    solutionDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    document.body.appendChild(solutionDiv);
    return solutionDiv;
}

function startSelection(x, y) {
    if (!isSelectionMode) return;
    
    isSelecting = true;
    startX = x;
    startY = y;
    if (!selectionDiv) {
        selectionDiv = createSelectionDiv();
    }
    selectionDiv.style.left = `${x}px`;
    selectionDiv.style.top = `${y}px`;
    selectionDiv.style.width = '0px';
    selectionDiv.style.height = '0px';
    selectionDiv.style.display = 'block';
}

function updateSelection(x, y) {
    if (!isSelecting || !isSelectionMode) return;

    let width = Math.abs(x - startX);
    let height = Math.abs(y - startY);
    let left = Math.min(x, startX);
    let top = Math.min(y, startY);

    selectionDiv.style.left = `${left}px`;
    selectionDiv.style.top = `${top}px`;
    selectionDiv.style.width = `${width}px`;
    selectionDiv.style.height = `${height}px`;
}

function endSelection(x, y) {
    console.log('endSelection called with coordinates:', { x, y });
    if (!isSelecting || !isSelectionMode) {
        console.log('Selection not active, returning early');
        return;
    }
    isSelecting = false;

    let width = Math.abs(x - startX);
    let height = Math.abs(y - startY);
    let left = Math.min(x, startX);
    let top = Math.min(y, startY);

    // Check if selection is too small
    if (width < 10 || height < 10) {
        console.log('Selection too small, ignoring:', { width, height });
        selectionDiv.style.display = 'none';
        return;
    }

    selectionDiv.style.display = 'none';

    const selection = {
        startX: left,
        startY: top,
        width: width,
        height: height,
        docWidth: document.documentElement.scrollWidth,
        docHeight: document.documentElement.scrollHeight
    };

    console.log('Sending capture selection message:', selection);
    
    // Add a small delay to ensure UI updates before capturing
    setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'captureSelection', selection: selection }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background script:', chrome.runtime.lastError.message);
                displaySolution('Error capturing screenshot. Please try again.');
            } else if (response && !response.success) {
                console.error('Background script reported error:', response.error);
                displaySolution('Error: ' + (response.error || 'Unknown error occurred'));
            } else {
                console.log('Screenshot capture initiated successfully');
            }
        });
    }, 100);
}

function handleMouseDown(e) {
    if (e.target.id !== 'selectionDiv') {
        startSelection(e.clientX, e.clientY);
    }
}

function handleMouseMove(e) {
    updateSelection(e.clientX, e.clientY);
}

function handleMouseUp(e) {
    endSelection(e.clientX, e.clientY);
}

// Initialize message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.action === 'startSelectionMode') {
        console.log('Starting selection mode');
        isSelectionMode = true;
        document.body.style.cursor = 'crosshair';
        
        // Load Tesseract.js in advance
        waitForTesseract();
        
        // Add event listeners
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Send response back to confirm
        sendResponse({ success: true });
        return true;
    } else if (message.action === 'cropAndSendScreenshot') {
        console.log('Processing screenshot with selection:', message.selection);
        const { selection, dataUrl } = message;

        // Make sure Tesseract is loading
        waitForTesseract();

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
                
                // Calculate scale factor between image and document
                const scaleX = img.width / selection.docWidth;
                const scaleY = img.height / selection.docHeight;
                
                // Adjust selection coordinates based on scale
                const scaledX = selection.startX * scaleX;
                const scaledY = selection.startY * scaleY;
                const scaledWidth = selection.width * scaleX;
                const scaledHeight = selection.height * scaleY;
                
                console.log('Scaled coordinates:', {
                    original: selection,
                    scaled: {
                        x: scaledX,
                        y: scaledY,
                        width: scaledWidth,
                        height: scaledHeight
                    },
                    scale: { x: scaleX, y: scaleY }
                });

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
                console.log('Image cropped and converted to data URL');

                // Try to use Tesseract OCR with fallback to manual entry
                try {
                    console.log('Attempting to use OCR on the captured image');
                    const tesseract = await waitForTesseract(3000);
                    
                    if (tesseract) {
                        console.log('Starting OCR processing with Tesseract');
                        
                        // Create a blob from the data URL
                        const base64Data = croppedDataUrl.split(',')[1];
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        
                        const byteArray = new Uint8Array(byteNumbers);
                        const imageBlob = new Blob([byteArray], { type: 'image/png' });
                        
                        // Configure worker options
                        const workerOptions = {
                            workerPath: chrome.runtime.getURL('tesseract-core/worker.min.js'),
                            corePath: chrome.runtime.getURL('tesseract-core/tesseract-core.wasm.js')
                        };
                        console.log('Worker options:', workerOptions);
                        
                        // Create worker with local paths
                        const worker = await tesseract.createWorker('eng', undefined, workerOptions);
                        console.log('Tesseract worker created');
                        
                        // Initialize worker
                        await worker.load();
                        await worker.loadLanguage('eng');
                        await worker.initialize('eng');
                        
                        // Recognize text from blob
                        const result = await worker.recognize(imageBlob);
                        console.log('OCR result:', result);
                        
                        // Terminate worker
                        await worker.terminate();
                        
                        if (result.data.text && result.data.text.trim() !== '') {
                            console.log('OCR text detected:', result.data.text);
                            // Process the detected text
                            solveQuestion(result.data.text);
                        } else {
                            console.log('No text detected by OCR, showing manual entry form');
                            displayImageSolution(croppedDataUrl);
                        }
                    } else {
                        throw new Error('Tesseract not available');
                    }
                } catch (ocrError) {
                    console.error('OCR failed:', ocrError);
                    // Fallback to manual entry
                    displayImageSolution(croppedDataUrl);
                }
            } catch (error) {
                console.error('Image Processing Error:', error);
                displaySolution('Error processing the screenshot: ' + error.message);
            }
        };
        
        img.onerror = function(error) {
            console.error('Image loading error:', error);
            displaySolution('Error loading the screenshot image.');
        };
        
        img.src = dataUrl;
        sendResponse({ success: true });
        return true;
    } else if (message.action === 'displaySolution') {
        displaySolution(message.solution);
        sendResponse({ success: true });
        return true;
    }
});

async function solveQuestion(question) {
    try {
        const baseUrl = "https://openrouter.ai/api/v1";
        const apiKey = "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";
        const model = "deepseek/deepseek-r1-zero:free";
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
                messages: [{ role: "user", content: question }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            displaySolution(`API Error: ${response.status} - ${errorText}`);
            return;
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            const answer = data.choices[0].message.content || 'No answer found.';
            displaySolution(answer);
        } else {
            displaySolution('No answer found.');
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        displaySolution('Error processing the request.');
    }
}

function displaySolution(solution) {
    if (!solutionDiv) {
        solutionDiv = createSolutionDiv();
    }
    
    // Make solution div larger for better usability
    solutionDiv.style.maxWidth = '400px';
    solutionDiv.style.maxHeight = '80vh';
    solutionDiv.style.overflow = 'auto';
    
    // Clear previous content
    while (solutionDiv.firstChild) {
        solutionDiv.removeChild(solutionDiv.firstChild);
    }
    
    // Add title
    const title = document.createElement('p');
    title.textContent = 'Solution';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    solutionDiv.appendChild(title);
    
    // Add solution text
    const solutionText = document.createElement('div');
    solutionText.textContent = solution;
    solutionText.style.marginBottom = '15px';
    solutionText.style.lineHeight = '1.4';
    solutionDiv.appendChild(solutionText);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.padding = '5px 15px';
    closeButton.style.backgroundColor = '#f1f1f1';
    closeButton.style.color = 'black';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => {
        solutionDiv.style.display = 'none';
    };
    solutionDiv.appendChild(closeButton);
    
    document.body.style.cursor = 'default';
    isSelectionMode = false;
    
    // Remove event listeners
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

function displayImageSolution(imageDataUrl) {
    if (!solutionDiv) {
        solutionDiv = createSolutionDiv();
    }
    
    // Make solution div larger for better usability
    solutionDiv.style.maxWidth = '400px';
    solutionDiv.style.maxHeight = '80vh';
    solutionDiv.style.overflow = 'auto';
    
    // Clear previous content
    while (solutionDiv.firstChild) {
        solutionDiv.removeChild(solutionDiv.firstChild);
    }
    
    // Add title
    const title = document.createElement('p');
    title.textContent = 'Image captured successfully';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    solutionDiv.appendChild(title);
    
    // Add image
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.style.maxWidth = '100%';
    img.style.marginBottom = '10px';
    img.style.border = '1px solid #ccc';
    solutionDiv.appendChild(img);
    
    // Add textarea for manual text entry
    const textareaLabel = document.createElement('p');
    textareaLabel.textContent = 'Enter the text from the image:';
    textareaLabel.style.marginBottom = '5px';
    solutionDiv.appendChild(textareaLabel);
    
    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '80px';
    textarea.style.marginBottom = '10px';
    textarea.style.padding = '5px';
    textarea.style.boxSizing = 'border-box';
    solutionDiv.appendChild(textarea);
    
    // Add solve button
    const solveButton = document.createElement('button');
    solveButton.textContent = 'Solve';
    solveButton.style.padding = '5px 15px';
    solveButton.style.backgroundColor = '#4285f4';
    solveButton.style.color = 'white';
    solveButton.style.border = 'none';
    solveButton.style.borderRadius = '4px';
    solveButton.style.cursor = 'pointer';
    solveButton.onclick = () => {
        const text = textarea.value.trim();
        if (text) {
            // Clear the textarea and show loading message
            textarea.disabled = true;
            solveButton.disabled = true;
            
            const loadingMessage = document.createElement('p');
            loadingMessage.textContent = 'Processing...';
            loadingMessage.id = 'loadingMessage';
            solutionDiv.appendChild(loadingMessage);
            
            solveQuestion(text);
        }
    };
    solutionDiv.appendChild(solveButton);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.padding = '5px 15px';
    closeButton.style.backgroundColor = '#f1f1f1';
    closeButton.style.color = 'black';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginLeft = '10px';
    closeButton.onclick = () => {
        solutionDiv.style.display = 'none';
    };
    solutionDiv.appendChild(closeButton);
    
    document.body.style.cursor = 'default';
    isSelectionMode = false;
    
    // Remove event listeners
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
} 