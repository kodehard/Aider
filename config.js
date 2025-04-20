// Configuration file for API keys and other settings
// Single source of truth for all extension configurations

const config = {
    // API Configuration
    OPENROUTER_API_KEY: "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",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    
    // Model Selection
    TEXT_MODEL: "deepseek/deepseek-r1:free",
    VISION_MODEL: "qwen/qwen2.5-vl-72b-instruct:free",
    
    // Request Configuration
    MAX_TOKENS: 800,
    TEMPERATURE: 0.7,
    
    // UI Configuration
    mathjax_cdn_url: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
    
    // System Prompts
    SYSTEM_PROMPTS: {
        TEXT_SOLVE: "You are a helpful assistant that specializes in solving problems in mathematics, physics, chemistry, and other technical subjects. Provide clear explanations with step-by-step solutions.",
        IMAGE_SOLVE: "You are analyzing an image containing a problem. First identify the subject area (math, physics, etc.), then provide a complete solution with step-by-step reasoning. Format any equations properly and ensure your answer is clear and accurate."
    }
};

// Make config available globally
if (typeof window !== 'undefined') {
    window.config = config;
    window.extensionConfig = config;
}

// Export for module contexts if needed
try {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { config };
    }
} catch (error) {
    // Silently fail if module exports aren't supported
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