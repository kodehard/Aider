document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const solveButton = document.getElementById('solveButton');
    const questionInput = document.getElementById('questionInput');
    const answerContent = document.getElementById('answerContent');
    const screenshotButton = document.getElementById('screenshotButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    // Load config
    let appConfig = {};
    try {
        // Try to load from chrome storage
        chrome.storage.local.get(['config'], function(result) {
            if (result.config) {
                console.log('Using config from storage');
                appConfig = result.config;
            } else if (typeof window.config !== 'undefined') {
                console.log('Using window.config');
                appConfig = window.config;
            } else {
                console.warn('No config found in storage or window, using fallback');
                // Fallback config - should be the same as in config.js
                appConfig = {
                    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
                    OPENROUTER_API_KEY: "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",
                    TEXT_MODEL: "deepseek/deepseek-r1:free",
                    VISION_MODEL: "qwen/qwen2.5-vl-72b-instruct:free",
                    MAX_TOKENS: 800,
                    TEMPERATURE: 0.7
                };
            }
        });
    } catch (error) {
        console.error('Error loading config:', error);
        // Fallback config
        appConfig = {
            OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
            OPENROUTER_API_KEY: "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",
            TEXT_MODEL: "deepseek/deepseek-r1:free",
            VISION_MODEL: "qwen/qwen2.5-vl-72b-instruct:free",
            MAX_TOKENS: 800,
            TEMPERATURE: 0.7
        };
    }

    // Initialize UI
    resetUI();

    // Check for any stored images from screenshot tool
    chrome.storage.local.get(['capturedImage'], function(result) {
        if (result.capturedImage) {
            imagePreview.src = result.capturedImage;
            imagePreviewContainer.classList.remove('hidden');
        }
    });

    // Check for any stored text from context menu
    chrome.storage.local.get(['selectedText'], function(result) {
        if (result.selectedText) {
            questionInput.value = result.selectedText;
            // Clear the storage to prevent persistence across popup openings
            chrome.storage.local.remove(['selectedText']);
        }
    });

    function resetUI() {
        loadingIndicator.classList.add('hidden');
        answerContent.textContent = '';
        answerContent.classList.add('hidden');
    }

    function showLoading() {
        resetUI();
        loadingIndicator.classList.remove('hidden');
    }

    function showAnswer(text) {
        loadingIndicator.classList.add('hidden');
        
        // Process markdown or special formatting if present in text
        try {
            // Check if the answer contains any LaTeX-like math expressions
            if (text.includes('$')) {
                answerContent.innerHTML = processMathInText(text);
            } else {
                answerContent.textContent = text;
            }
        } catch (error) {
            answerContent.textContent = text;
        }
        
        answerContent.classList.remove('hidden');
    }

    // Simple function to replace math expressions with formatted HTML
    function processMathInText(text) {
        return text
            .replace(/\$\$(.*?)\$\$/g, '<div class="math-display" style="font-family: serif; font-style: italic; margin: 10px 0;">$1</div>')
            .replace(/\$(.*?)\$/g, '<span class="math-inline" style="font-family: serif; font-style: italic;">$1</span>')
            .replace(/```([\s\S]*?)```/g, '<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;"><code>$1</code></pre>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }

    solveButton.addEventListener('click', async () => {
        const question = questionInput.value.trim();

        if (question) {
            showLoading();

            try {
                // Add a subtle button animation for feedback
                solveButton.classList.add('processing');
                
                // Use config values
                const response = await fetch(`${appConfig.OPENROUTER_API_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${appConfig.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/OpenRouterTeam/openrouter',
                        'X-Title': 'Snap Solve'
                    },
                    body: JSON.stringify({
                        model: appConfig.TEXT_MODEL,
                        messages: [
                            // Include system prompt if available
                            ...(appConfig.SYSTEM_PROMPTS?.TEXT_SOLVE ? 
                                [{ role: "system", content: appConfig.SYSTEM_PROMPTS.TEXT_SOLVE }] : 
                                []
                            ),
                            { role: "user", content: question }
                        ],
                        temperature: appConfig.TEMPERATURE,
                        max_tokens: appConfig.MAX_TOKENS
                    })
                });

                // Remove the processing class
                solveButton.classList.remove('processing');

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API error: ${response.status} - ${errorText}`);
                    showAnswer(`Error: ${response.status} - Could not process your request. Please try again.`);
                    return;
                }

                const data = await response.json();

                if (data.choices && data.choices.length > 0) {
                    showAnswer(data.choices[0].message.content || 'No answer found.');
                } else {
                    showAnswer('No answer found. Please try rephrasing your question.');
                }
            } catch (error) {
                console.error('Error processing request:', error);
                showAnswer('Error processing the request. Please check your connection and try again.');
                solveButton.classList.remove('processing');
            }
        } else {
            // Animated shake effect for empty input
            questionInput.classList.add('shake');
            setTimeout(() => {
                questionInput.classList.remove('shake');
            }, 500);
        }
    });

    screenshotButton.addEventListener('click', function() {
        // Add visual feedback for button click
        screenshotButton.classList.add('active');
        setTimeout(() => {
            screenshotButton.classList.remove('active');
        }, 300);
        
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs || tabs.length === 0) {
                showAnswer("Error: No active tab found. Please try again.");
                return;
            }
            
            const tab = tabs[0];
            const tabId = tab.id;
            
            // Clear any existing messages
            answerContent.innerHTML = '';
            
            // Check if we can access the tab
            if (!tabId) {
                showAnswer("Error: Cannot access tab. Please try again.");
                return;
            }
            
            // Check if the tab is on a supported page
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                showAnswer("Error: Cannot take screenshots of browser pages. Please try on a regular webpage.");
                return;
            }
            
            // Display a message to the user
            showAnswer("Initializing screenshot mode...");
            
            // Function to handle initialization failures
            const handleInitError = (message) => {
                showAnswer(`Error: ${message || "Failed to initialize screenshot mode"}. Please try again or refresh the page.`);
            };
            
            // Function to start screenshot mode
            const startScreenshotMode = () => {
                showAnswer("Click and drag to select an area to capture.");
                
                // Close the popup after a short delay to allow the user to see the message
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: 'takeScreenshot',
                        tabId: tabId
                    }, function(response) {
                        if (chrome.runtime.lastError || !response || !response.success) {
                            const errorMsg = chrome.runtime.lastError?.message || 
                                            response?.error || 
                                            "Unknown error";
                            console.error('Error starting screenshot mode:', errorMsg);
                            handleInitError(errorMsg);
                        } else {
                            console.log('Screenshot mode started successfully');
                            window.close(); // Close popup only on success
                        }
                    });
                }, 800); // Allow time for user to read the message
            };
            
            // Ping the content script to check if it's loaded
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(pingResponse) {
                // Check for error, which means content script is not loaded
                if (chrome.runtime.lastError) {
                    console.log('Content script not loaded, injecting scripts...');
                    
                    chrome.runtime.sendMessage({
                        action: 'injectScripts',
                        tabId: tabId
                    }, function(injectResponse) {
                        if (chrome.runtime.lastError || !injectResponse || !injectResponse.success) {
                            console.error('Failed to inject scripts:', chrome.runtime.lastError || 'Unknown error');
                            handleInitError("Failed to inject scripts");
                            return;
                        }
                        
                        console.log('Scripts injected successfully, starting screenshot mode...');
                        
                        // Wait a moment for scripts to initialize
                        setTimeout(startScreenshotMode, 200);
                    });
                } else {
                    console.log('Content script already loaded, starting screenshot mode directly...');
                    startScreenshotMode();
                }
            });
        });
    });

    // Listen for "Enter" key in textarea
    questionInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            solveButton.click();
        }
    });

    // Check for stored solution from background script
    chrome.storage.local.get(['solution'], function(result) {
        if (result.solution) {
            showAnswer(result.solution);
            
            // Clear the storage to prevent persistence
            chrome.storage.local.remove(['solution']);
        }
    });
});
