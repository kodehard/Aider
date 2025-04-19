document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const solveButton = document.getElementById('solveButton');
    const questionInput = document.getElementById('questionInput');
    const answerContent = document.getElementById('answerContent');
    const screenshotButton = document.getElementById('screenshotButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    // Load or initialize config
    let appConfig = {};
    try {
        // Try to load from chrome storage first
        chrome.storage.local.get(['config'], function(result) {
            if (result.config) {
                appConfig = result.config;
            } else {
                // Use default config
                appConfig = {
                    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
                    OPENROUTER_API_KEY: "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",
                    TEXT_MODEL: "deepseek/deepseek-r1:free",
                    VISION_MODEL: "meta-llama/llama-3.2-11b-vision-instruct:free",
                    MAX_TOKENS: 800,
                    TEMPERATURE: 0.7
                };
            }
        });
    } catch (error) {
        // Fallback config
        appConfig = {
            OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
            OPENROUTER_API_KEY: "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",
            TEXT_MODEL: "deepseek/deepseek-r1:free",
            VISION_MODEL: "meta-llama/llama-3.2-11b-vision-instruct:free",
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
                
                // Get config values - fallback to defaults if not available
                const config = appConfig;

                const response = await fetch(`${config.OPENROUTER_API_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/OpenRouterTeam/openrouter',
                        'X-Title': 'Aider AI'
                    },
                    body: JSON.stringify({
                        model: config.TEXT_MODEL || "deepseek/deepseek-r1:free",
                        messages: [
                            // Include system prompt if available
                            ...(config.SYSTEM_PROMPTS?.TEXT_SOLVE ? 
                                [{ role: "system", content: config.SYSTEM_PROMPTS.TEXT_SOLVE }] : 
                                []
                            ),
                            { role: "user", content: question }
                        ],
                        temperature: config.TEMPERATURE || 0.7,
                        max_tokens: config.MAX_TOKENS || 800
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
            if (tabs && tabs.length > 0) {
                const tabId = tabs[0].id;
                
                // Clear any existing messages
                answerContent.innerHTML = '';
                
                // Display a message to the user before proceeding
                showAnswer("Initializing screenshot mode...");
                
                // Check if we can access the tab
                if (!tabId || tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('edge://')) {
                    showAnswer("Error: Cannot access this page. Please try on a regular webpage.");
                    return;
                }
                
                // First check if content script is already loaded
                chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(pingResponse) {
                    if (chrome.runtime.lastError) {
                        console.log('Content script not loaded, injecting scripts...');
                        // Content script not loaded, need to inject first
                        chrome.runtime.sendMessage({
                            action: 'injectScripts',
                            tabId: tabId
                        }, function(injectResponse) {
                            if (chrome.runtime.lastError || !injectResponse || !injectResponse.success) {
                                console.error('Failed to inject scripts:', chrome.runtime.lastError || 'Unknown error');
                                showAnswer("Error: Failed to inject scripts. Please refresh the page and try again.");
                                return;
                            }
                            
                            console.log('Scripts injected successfully, starting screenshot mode...');
                            // Scripts successfully injected, now start screenshot mode
                            startScreenshotMode(tabId);
                        });
                    } else {
                        console.log('Content script already loaded, starting screenshot mode directly...');
                        // Content script already loaded, start screenshot mode directly
                        startScreenshotMode(tabId);
                    }
                });
            } else {
                showAnswer("Error: No active tab found. Please try again.");
            }
        });
        
        // Function to start screenshot mode
        function startScreenshotMode(tabId) {
            showAnswer("Click and drag to select an area to capture.");
            
            // Delay briefly to allow the message to display
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    action: 'takeScreenshot',
                    tabId: tabId
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error taking screenshot:', chrome.runtime.lastError);
                        showAnswer(`Error: ${chrome.runtime.lastError.message}`);
                    } else if (response && response.success) {
                        console.log('Screenshot mode started successfully');
                        // Close the popup
                        window.close();
                    } else {
                        console.error('Failed to start screenshot mode:', response?.error || 'Unknown error');
                        showAnswer(`Error: ${response?.error || 'Unknown error'}`);
                    }
                });
            }, 500);
        }
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
