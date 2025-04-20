/**
 * Screenshot Functionality Test
 * 
 * This script tests the screenshot selection and capture process.
 * Run this in the browser console on a regular page to test.
 */

async function testScreenshotFunctionality() {
    console.log('Starting screenshot functionality test...');
    
    // Step 1: Make sure screenshot.js is loaded
    if (typeof window.startScreenshot !== 'function') {
        console.error('Error: screenshot.js is not loaded properly');
        return;
    }
    
    // Step 2: Test the selection UI
    try {
        console.log('Testing selection UI...');
        window.startScreenshot();
        
        console.log('Selection mode started. UI elements should be visible.');
        console.log('Overlay present:', !!document.getElementById('aider-screenshot-overlay'));
        console.log('Instructions present:', !!document.getElementById('aider-screenshot-instructions'));
        console.log('Cancel button present:', !!document.getElementById('aider-screenshot-cancel'));
        
        // Wait for a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Clean up the UI
        if (typeof window.cleanupScreenshotUI === 'function') {
            window.cleanupScreenshotUI();
            console.log('Selection UI cleaned up');
        } else {
            console.error('cleanupScreenshotUI function not found');
        }
        
    } catch (error) {
        console.error('Error testing selection UI:', error);
    }
    
    // Step 3: Test message handling
    try {
        console.log('Testing message handling...');
        
        // Create a mock selection
        const mockSelection = {
            startX: 100,
            startY: 100,
            width: 300,
            height: 200,
            scrollX: window.pageXOffset || document.documentElement.scrollLeft || 0,
            scrollY: window.pageYOffset || document.documentElement.scrollTop || 0
        };
        
        // Test sendCaptureRequest function if available
        if (typeof window.sendCaptureRequest === 'function') {
            console.log('Testing sendCaptureRequest with mock data...');
            try {
                window.sendCaptureRequest(mockSelection);
                console.log('Capture request sent successfully');
            } catch (error) {
                console.error('Error sending capture request:', error);
            }
        } else {
            console.log('sendCaptureRequest function not available directly, skipping');
        }
        
        // Test processing UI
        if (typeof window.showProcessingUI === 'function') {
            console.log('Testing processing UI...');
            window.showProcessingUI();
            console.log('Processing UI should be visible');
            
            // Wait a moment and then clean up
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (typeof window.removeAllPopups === 'function') {
                window.removeAllPopups();
                console.log('Processing UI cleaned up');
            }
        }
        
        // Test solution display
        if (typeof window.showSolution === 'function') {
            console.log('Testing solution display...');
            window.showSolution(
                'This is a test solution. It includes **bold** and *italic* text.\n\nAnd a math equation: $E=mc^2$',
                null, // No image for test
                { test: true }
            );
            console.log('Solution display should be visible');
            
            // Wait a moment and then clean up
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (typeof window.removeAllPopups === 'function') {
                window.removeAllPopups();
                console.log('Solution display cleaned up');
            }
        }
        
    } catch (error) {
        console.error('Error testing message handling:', error);
    }
    
    console.log('Screenshot functionality test completed');
}

// Run the test
testScreenshotFunctionality(); 