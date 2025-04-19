// Test script to verify OpenRouter API access
async function testOpenRouterAPI() {
    console.log('Starting OpenRouter API test...');
    
    // Use the same API key from our extension
    const apiKey = "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";
    const baseUrl = "https://openrouter.ai/api/v1";
    const model = "openai/gpt-3.5-turbo:free";
    
    console.log(`Using API key: ${apiKey.substring(0, 10)}...`);
    
    // Create a simple test prompt
    const testPrompt = "Hello, what can you do?";
    
    // Set headers according to OpenRouter documentation
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://example.com',
        'X-Title': 'API Test'
    };
    
    const requestBody = {
        model: model,
        messages: [{ role: "user", content: testPrompt }],
        max_tokens: 50
    };
    
    console.log('Making test request to OpenRouter API...');
    
    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return;
        }
        
        const data = await response.json();
        console.log('API response received successfully!');
        console.log('Model used:', data.model);
        console.log('Response:', data.choices[0].message.content);
        console.log('Test completed successfully!');
        
    } catch (error) {
        console.error('Error during API test:', error);
    }
}

// Run the test
testOpenRouterAPI();
