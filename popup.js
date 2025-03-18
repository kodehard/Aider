document.addEventListener('DOMContentLoaded', function() {
    const solveButton = document.getElementById('solveButton');
    const questionInput = document.getElementById('questionInput');
    const answerContent = document.getElementById('answerContent');
    const screenshotButton = document.getElementById('screenshotButton');

    solveButton.addEventListener('click', async () => {
        const question = questionInput.value.trim();

        if (question) {
            answerContent.textContent = 'Solving...';

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
                    answerContent.textContent = `API Error: ${response.status} - ${errorText}`;
                    return;
                }

                const data = await response.json();

                if (data.choices && data.choices.length > 0) {
                    answerContent.textContent = data.choices[0].message.content || 'No answer found.';
                } else {
                    answerContent.textContent = 'No answer found.';
                }
            } catch (error) {
                console.error('Fetch Error:', error);
                answerContent.textContent = 'Error processing the request.';
            }
        }
    });

    screenshotButton.addEventListener('click', function() {
        console.log('Screenshot button clicked');
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0) {
                const tabId = tabs[0].id;
                console.log('Found active tab:', tabId, 'URL:', tabs[0].url);
                
                // Ensure the content scripts are injected
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js', 'screenshot.js']
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error injecting scripts:', chrome.runtime.lastError.message);
                    } else {
                        console.log('Scripts injected successfully');
                        
                        // Send message to start selection mode
                        chrome.tabs.sendMessage(tabId, { action: 'startSelectionMode' }, function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('Error starting selection mode:', chrome.runtime.lastError.message);
                            } else if (response && response.success) {
                                console.log('Selection mode started successfully');
                            } else {
                                console.log('No response from content script');
                            }
                        });
                    }
                });
            } else {
                console.error("No active tabs found.");
            }
        });
    });
});
