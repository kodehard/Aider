// Configuration file for API keys and other environment variables
// In production, these values will be used directly
// In development, values can be overridden by a .env file

// Default config values - always available
const config = {
    // OpenRouter API configuration
    OPENROUTER_API_KEY: "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",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    DEFAULT_MODEL: "deepseek/deepseek-r1:free",
    
    // OCR.space API configuration
    OCR_API_KEY: "K89040367688957",
    OCR_API_URL: "https://api.ocr.space/parse/image"
};

// Make config available globally in content scripts
if (typeof window !== 'undefined') {
    window.config = config;
    console.log('Config loaded and attached to window object');
}

// For module contexts (if supported)
try {
    if (typeof exports !== 'undefined') {
        exports.config = config;
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = { config };
    }
} catch (error) {
    console.log('Module exports not supported in this context');
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
                console.log('Loaded config values from .env file');
            }
        }
    } catch (error) {
        console.log('No .env file found, using default config values');
    }
    return config;
}; 