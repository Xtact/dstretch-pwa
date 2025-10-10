document.addEventListener('DOMContentLoaded', () => {
    // --- Get all interactive elements ---
    const imageDisplay = document.getElementById('imageDisplay');
    const imageLoader = document.getElementById('imageLoader');
    const navTabs = document.querySelectorAll('.nav-tab');
    const controlPanels = document.querySelectorAll('.control-panel');
    const headerTitle = document.querySelector('.header-title');
    const colorspaceButtons = document.querySelectorAll('.cs-btn');
    const enhanceBtn = document.querySelector('.header-btn.done'); // Using 'Done' as enhance
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    let originalImageData = null;
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
            console.log("Selected Colorspace:", selectedColorspace);
        });
    });
    
    // --- Image Loading Logic ---
    imageDisplay.addEventListener('click', () => imageLoader.click());
    imageLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageDisplay.src = e.target.result;
                imageDisplay.onload = () => {
                    canvas.width = imageDisplay.naturalWidth;
                    canvas.height = imageDisplay.naturalHeight;
                    ctx.drawImage(imageDisplay, 0, 0);
                    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                };
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Main Enhancement Logic ---
    enhanceBtn.addEventListener('click', () => {
        if (!originalImageData) return;
        console.log(`Enhancing with ${selectedColorspace}...`);

        const imageData = originalImageData.data;
        const nPixels = imageData.length / 4;
        let c1 = new Array(nPixels), c2 = new Array(nPixels), c3 = new Array(nPixels);

        // 1. Convert to selected colorspace
        for (let i = 0; i < nPixels; i++) {
            const r = imageData[i * 4];
            const g = imageData[i * 4 + 1];
            const b = imageData[i * 4 + 2];
            const converted = convertRgbTo(r, g, b, selectedColorspace);
            c1[i] = converted[0];
            c2[i] = converted[1];
            c3[i] = converted[2];
        }
        
        // 2. Perform DStretch on the converted channels
        const { stretchedC1, stretchedC2, stretchedC3 } = performDstretch(c1, c2, c3);

        // 3. Convert back to RGB and display
        const newPixelData = new Uint8ClampedArray(imageData.length);
        for (let i = 0; i < nPixels; i++) {
            const rgb = convertToRgb(stretchedC1[i], stretchedC2[i], stretchedC3[i], selectedColorspace);
            const pixelIndex = i * 4;
            newPixelData[pixelIndex] = rgb[0];
            newPixelData[pixelIndex + 1] = rgb[1];
            newPixelData[pixelIndex + 2] = rgb[2];
            newPixelData[pixelIndex + 3] = 255;
        }

        const newImageData = new ImageData(newPixelData, canvas.width, canvas.height);
        ctx.putImageData(newImageData, 0, 0);
        imageDisplay.src = canvas.toDataURL();
        console.log("Enhancement complete.");
    });
    
    function performDstretch(c1, c2, c3) {
        const meanC1 = calculateMean(c1), meanC2 = calculateMean(c2), meanC3 = calculateMean(c3);
        const covMatrix = calculateCovarianceMatrix(c1, c2, c3, meanC1, meanC2, meanC3);
        const { eigenvectors, eigenvalues } = eigenDecomposition(covMatrix);
        
        const stretchAmount = 50.0;
        let stretchedC1 = [], stretchedC2 = [], stretchedC3 = [];

        for (let i = 0; i < c1.length; i++) {
            const v1 = c1[i] - meanC1;
            const v2 = c2[i] - meanC2;
            const v3 = c3[i] - meanC3;

            let p1 = v1 * eigenvectors[0][0] + v2 * eigenvectors[1][0] + v3 * eigenvectors[2][0];
            let p2 = v1 * eigenvectors[0][1] + v2 * eigenvectors[1][1] + v3 * eigenvectors[2][1];
            let p3 = v1 * eigenvectors[0][2] + v2 * eigenvectors[1][2] + v3 * eigenvectors[2][2];

            p1 *= (stretchAmount / Math.sqrt(Math.abs(eigenvalues[0])));
            p2 *= (stretchAmount / Math.sqrt(Math.abs(eigenvalues[1])));
            p3 *= (stretchAmount / Math.sqrt(Math.abs(eigenvalues[2])));

            stretchedC1[i] = p1 * eigenvectors[0][0] + p2 * eigenvectors[0][1] + p3 * eigenvectors[0][2] + meanC1;
            stretchedC2[i] = p1 * eigenvectors[1][0] + p2 * eigenvectors[1][1] + p3 * eigenvectors[1][2] + meanC2;
            stretchedC3[i] = p1 * eigenvectors[2][0] + p2 * eigenvectors[2][1] + p3 * eigenvectors[2][2] + meanC3;
        }
        return { stretchedC1, stretchedC2, stretchedC3 };
    }

    // --- UTILITY AND MATH FUNCTIONS ---

    function calculateMean(array) { /* ... same as before ... */ }
    function calculateCovarianceMatrix(c1, c2, c3, m1, m2, m3) { /* ... same as before, but generic */ }
    function eigenDecomposition(matrix) { /* ... same as before ... */ }

    // --- COLORSPACE CONVERSION ROUTERS ---
    
    function convertRgbTo(r, g, b, colorspace) {
        switch (colorspace) {
            case 'LAB': return rgbToLab(r, g, b);
            // Placeholders for other colorspaces
            case 'YRE': return [0.299*r + 0.587*g + 0.114*b, r, g]; // Simplified
            case 'LRE': return [0.2126*r + 0.7152*g + 0.0722*b, r, g]; // Simplified
            case 'CRGB': return [r, g, b]; // CRGB is a matrix choice, handled in DStretch
            case 'YBK': return [0.299*r + 0.587*g + 0.114*b, b, 255 - g]; // Simplified
            case 'RGB':
            default: return [r, g, b];
        }
    }

    function convertToRgb(c1, c2, c3, colorspace) {
        switch (colorspace) {
            case 'LAB': return labToRgb(c1, c2, c3);
            // Inverse placeholders
            case 'YRE': return [c2, c3, (c1 - 0.587*c3 - 0.299*c2) / 0.114]; // Simplified inverse
            case 'LRE': return [c2, c3, (c1 - 0.7152*c3 - 0.2126*c2) / 0.0722]; // Simplified inverse
            case 'CRGB': return [c1, c2, c3];
            case 'YBK': return [(c1 - 0.587*(255-c3) - 0.114*c2)/0.299, 255-c3, c2]; // Simplified inverse
            case 'RGB':
            default: return [c1, c2, c3];
        }
    }

    // --- RGB <-> LAB CONVERSION ---
    
    function rgbToLab(r, g, b) {
        // First, convert RGB to XYZ
        r /= 255; g /= 255; b /= 255;
        r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
        
        // Then, convert XYZ to LAB
        x /= 95.047; y /= 100.000; z /= 108.883;
        x = (x > 0.008856) ? Math.cbrt(x) : (7.787 * x) + 16/116;
        y = (y > 0.008856) ? Math.cbrt(y) : (7.787 * y) + 16/116;
        z = (z > 0.008856) ? Math.cbrt(z) : (7.787 * z) + 16/116;
        const l = (116 * y) - 16;
        const a = 500 * (x - y);
        const b_lab = 200 * (y - z);
        return [l, a, b_lab];
    }

    function labToRgb(l, a, b_lab) {
        // First, convert LAB to XYZ
        let y = (l + 16) / 116;
        let x = a / 500 + y;
        let z = y - b_lab / 200;
        const x3 = x*x*x;
        const y3 = y*y*y;
        const z3 = z*z*z;
        x = (x3 > 0.008856) ? x3 : (x - 16/116) / 7.787;
        y = (y3 > 0.008856) ? y3 : (y - 16/116) / 7.787;
        z = (z3 > 0.008856) ? z3 : (z - 16/116) / 7.787;
        x *= 95.047; y *= 100.000; z *= 108.883;

        // Then, convert XYZ to RGB
        x /= 100; y /= 100; z /= 100;
        let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
        let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
        let b = x * 0.0557 + y * -0.2040 + z * 1.0570;
        r = (r > 0.0031308) ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
        g = (g > 0.0031308) ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
        b = (b > 0.0031308) ? 1.055 * Math.pow(b, 1/2.4) - 0.055 : 12.92 * b;
        return [r * 255, g * 255, b * 255];
    }
});
