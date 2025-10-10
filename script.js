document.addEventListener('DOMContentLoaded', () => {
    // --- Get all interactive elements ---
    const imageDisplay = document.getElementById('imageDisplay');
    const imageLoader = document.getElementById('imageLoader');
    const navTabs = document.querySelectorAll('.nav-tab');
    const controlPanels = document.querySelectorAll('.control-panel');
    const headerTitle = document.querySelector('.header-title');
    const colorspaceButtons = document.querySelectorAll('.cs-btn');
    const enhanceBtn = document.querySelector('.header-btn.done');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Sliders
    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    const saturationSlider = document.getElementById('saturation');

    let originalImageObject = null; // This will hold the clean "master copy" Image object
    let selectedColorspace = 'RGB';

    // --- Tab Navigation Logic ---
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            controlPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panelId = tab.dataset.panel;
            document.getElementById(panelId).classList.add('active');
            headerTitle.textContent = tab.textContent;
        });
    });

    // --- Colorspace Selection Logic ---
    colorspaceButtons.forEach(button => {
        button.addEventListener('click', () => {
            colorspaceButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedColorspace = button.dataset.colorspace;
        });
    });
    
    // --- Image Loading Logic ---
    imageDisplay.addEventListener('click', () => imageLoader.click());
    imageLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                originalImageObject = new Image();
                originalImageObject.onload = () => {
                    canvas.width = originalImageObject.naturalWidth;
                    canvas.height = originalImageObject.naturalHeight;
                    resetAdjustmentsAndDraw();
                };
                originalImageObject.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // --- Filter Adjustment Logic ---
    function applyFilters() {
        if (!originalImageObject) return;
        drawImageWithFilters();
        imageDisplay.src = canvas.toDataURL();
    }

    brightnessSlider.addEventListener('input', applyFilters);
    contrastSlider.addEventListener('input', applyFilters);
    saturationSlider.addEventListener('input', applyFilters);
    
    function resetAdjustmentsAndDraw() {
        brightnessSlider.value = 100;
        contrastSlider.value = 100;
        saturationSlider.value = 100;
        applyFilters();
    }

    function drawImageWithFilters() {
        const brightness = brightnessSlider.value / 100;
        const contrast = contrastSlider.value / 100;
        const saturation = saturationSlider.value / 100;
        const filterString = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas first
        ctx.filter = filterString;
        ctx.drawImage(originalImageObject, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // Reset filter to avoid side effects
    }

    // --- Main Enhancement Logic ---
    enhanceBtn.addEventListener('click', () => {
        if (!originalImageObject) return;

        // 1. Get the pixel data of the image *with filters applied*
        drawImageWithFilters();
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const nPixels = currentImageData.length / 4;
        let c1 = [], c2 = [], c3 = [];

        // 2. Convert to selected colorspace
        for (let i = 0; i < nPixels; i++) {
            const r = currentImageData[i * 4];
            const g = currentImageData[i * 4 + 1];
            const b = currentImageData[i * 4 + 2];
            const converted = convertRgbTo(r, g, b, selectedColorspace);
            c1.push(converted[0]); c2.push(converted[1]); c3.push(converted[2]);
        }
        
        // 3. Perform DStretch
        const { stretchedC1, stretchedC2, stretchedC3 } = performDstretch(c1, c2, c3);

        // 4. Convert back to RGB
        const newPixelData = new Uint8ClampedArray(currentImageData.length);
        for (let i = 0; i < nPixels; i++) {
            const rgb = convertToRgb(stretchedC1[i], stretchedC2[i], stretchedC3[i], selectedColorspace);
            const pixelIndex = i * 4;
            newPixelData[pixelIndex] = rgb[0];
            newPixelData[pixelIndex + 1] = rgb[1];
            newPixelData[pixelIndex + 2] = rgb[2];
            newPixelData[pixelIndex + 3] = 255;
        }

        // 5. Display and set the result as the new "master copy"
        const newImageData = new ImageData(newPixelData, canvas.width, canvas.height);
        ctx.putImageData(newImageData, 0, 0);
        
        originalImageObject.src = canvas.toDataURL();
        originalImageObject.onload = () => {
             resetAdjustmentsAndDraw(); // Reset sliders and show the new master image
        };
    });
    
    // All other helper functions (performDstretch, conversions, math, etc.) should be here
    // ...
});
