document.addEventListener('DOMContentLoaded', () => {
    // ... (all element selectors remain the same, just remove the 'enhanceBtn')

    // Sliders
    const stretchSlider = document.getElementById('stretch');
    // ... (other sliders)

    let debouncedEnhance; // This will hold our debounced function

    // --- DEBOUNCE UTILITY ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- Image Loading Logic ---
    imageLoader.addEventListener('change', (event) => {
        // ... (this function remains the same)
        // At the end of the reader.onload function, initialize the debounced function
        originalImageObject.onload = () => {
            canvas.width = originalImageObject.naturalWidth;
            canvas.height = originalImageObject.naturalHeight;
            debouncedEnhance = debounce(runFullEnhancement, 500); // Create a 500ms delay
            resetAdjustmentsAndDraw();
        };
        // ...
    });
    
    // --- Event Listeners for Real-Time Enhancement ---
    colorspaceButtons.forEach(button => {
        button.addEventListener('click', () => {
            // ... (code to handle active state)
            selectedColorspace = button.dataset.colorspace;
            if (originalImageObject) debouncedEnhance(); // Trigger enhancement
        });
    });

    stretchSlider.addEventListener('input', () => {
        if (originalImageObject) debouncedEnhance(); // Trigger enhancement
    });

    // --- Main Enhancement Logic is now in its own function ---
    function runFullEnhancement() {
        if (!originalImageObject) return;
        
        console.log(`Enhancing with ${selectedColorspace}...`);
        
        // This function now contains the entire DStretch process:
        // 1. drawImageWithFilters()
        // 2. Get pixel data
        // 3. Convert to colorspace
        // 4. performDstretch()
        // 5. Convert back to RGB
        // 6. Display the final result
        // The internal logic is the same as the previous 'enhanceBtn' click handler.
        
        // I will provide the full, complete script in the next turn if this approach is good.
    }
    
    // ... (All other functions: applyFilters, drawImageWithFilters, performDstretch, math helpers, etc. remain)
});
