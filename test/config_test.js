/**
 * Config Test
 * 
 * This script tests the configuration loading and consistency across different parts of the extension.
 * Run this in the browser console to test.
 */

async function testConfigLoading() {
    console.log('Starting config loading test...');
    
    // Test 1: Check if config is available in window
    console.log('Test 1: Checking window.config...');
    if (typeof window.config !== 'undefined') {
        console.log('✅ window.config is available:');
        console.log('API Key ending with: ' + window.config.OPENROUTER_API_KEY.slice(-8));
        console.log('Text Model: ' + window.config.TEXT_MODEL);
        console.log('Vision Model: ' + window.config.VISION_MODEL);
    } else {
        console.error('❌ window.config is not available');
    }
    
    // Test 2: Check if config is correctly loaded in Chrome storage
    console.log('\nTest 2: Checking chrome.storage for config...');
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['config'], function(result) {
            if (result.config) {
                console.log('✅ config found in chrome.storage:');
                console.log('API Key ending with: ' + result.config.OPENROUTER_API_KEY.slice(-8));
                console.log('Text Model: ' + result.config.TEXT_MODEL);
                console.log('Vision Model: ' + result.config.VISION_MODEL);
                
                // Test 3: Compare window.config and storage config
                console.log('\nTest 3: Comparing window.config and storage config...');
                if (typeof window.config !== 'undefined') {
                    const windowKeyEnd = window.config.OPENROUTER_API_KEY.slice(-8);
                    const storageKeyEnd = result.config.OPENROUTER_API_KEY.slice(-8);
                    
                    if (windowKeyEnd === storageKeyEnd &&
                        window.config.TEXT_MODEL === result.config.TEXT_MODEL &&
                        window.config.VISION_MODEL === result.config.VISION_MODEL) {
                        console.log('✅ Configs match!');
                    } else {
                        console.error('❌ Configs do not match:');
                        console.log('window.config:', 
                            { 
                                keyEnd: windowKeyEnd,
                                textModel: window.config.TEXT_MODEL,
                                visionModel: window.config.VISION_MODEL
                            }
                        );
                        console.log('storage.config:', 
                            { 
                                keyEnd: storageKeyEnd,
                                textModel: result.config.TEXT_MODEL,
                                visionModel: result.config.VISION_MODEL
                            }
                        );
                    }
                }
            } else {
                console.error('❌ config not found in chrome.storage');
            }
        });
    } else {
        console.error('❌ chrome.storage is not available');
    }
    
    console.log('\nConfig test complete. Check console for results.');
}

// Run the test
testConfigLoading(); 