// Configuration file for API keys and other environment variables
// API keys stored here are for development purposes only
// In production, these should be securely managed

// Default config values
const config = {
    // OpenRouter API configuration
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "YOUR_API_KEY_HERE",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    // Use deepseek-r1 for text input processing
    TEXT_MODEL: "deepseek/deepseek-r1:free",
    // Keep vision model for screenshot processing
    VISION_MODEL: "meta-llama/llama-3.2-11b-vision-instruct:free",
    
    // Optional OCR configuration (as fallback)
    OCR_API_KEY: process.env.OCR_API_KEY || "YOUR_OCR_KEY_HERE",
    OCR_API_URL: "https://api.ocr.space/parse/image",
    
    // UI/UX configuration
    MAX_TOKENS: 800,
    TEMPERATURE: 0.7,
    
    // System prompts for different operations
    SYSTEM_PROMPTS: {
        TEXT_SOLVE: "You are a helpful assistant that specializes in solving problems in mathematics, physics, chemistry, and other technical subjects. Provide clear explanations with step-by-step solutions.",
        IMAGE_SOLVE: "You are analyzing an image containing a problem. First identify the subject area (math, physics, etc.), then provide a complete solution with step-by-step reasoning. Format any equations properly and ensure your answer is clear and accurate."
    }
};

// Make config available globally in content scripts
if (typeof window !== 'undefined') {
    window.config = config;
}

// For module contexts (if supported)
try {
    if (typeof exports !== 'undefined') {
        exports.config = config;
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = { config };
    }
} catch (error) {
    // Remove line completely
}

// Function to load environment variables from .env file during development
// This is only used in development, not in the extension
const loadEnvVars = async () => {
    try {
        if (typeof fetch !== 'undefined') {
            // Try to load .env file for development
            const response = await fetch('.env');
            if (response.ok) {
                const text = await response.text();
                // Parse .env file
                const lines = text.split('\n').filter(line => 
                    line.trim() && !line.startsWith('#')
                );
                lines.forEach(line => {
                    const [key, value] = line.split('=').map(part => part.trim());
                    if (key && value && config.hasOwnProperty(key)) {
                        config[key] = value;
                    }
                });
            }
        }
    } catch (error) {
        // Remove line completely
    }
    return config;
}; 