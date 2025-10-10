document.addEventListener('DOMContentLoaded', () => {
    // --- Get all interactive elements ---
    const imageDisplay = document.getElementById('imageDisplay');
    const imageLoader = document.getElementById('imageLoader');
    const navTabs = document.querySelectorAll('.nav-tab');
    const controlPanels = document.querySelectorAll('.control-panel');
    const headerTitle = document.querySelector('.header-title');
    const colorspaceButtons = document.querySelectorAll('.cs-btn');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Sliders
    const stretchSlider = document.getElementById('stretch');
    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    const saturationSlider = document.getElementById('saturation');

    let originalImageObject = null;
    let selectedColorspace = 'RGB';
    let debouncedEnhance;

    // --- DEBOUNCE UTILITY ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

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
            if (originalImageObject && debouncedEnhance) debouncedEnhance();
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
                    debouncedEnhance = debounce(runFullEnhancement, 500);
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
        stretchSlider.value = 50;
        applyFilters();
    }

    function drawImageWithFilters() {
        const brightness = brightnessSlider.value / 100;
        const contrast = contrastSlider.value / 100;
        const saturation = saturationSlider.value / 100;
        const filterString = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = filterString;
        ctx.drawImage(originalImageObject, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
    }

    // --- Real-time listener for the stretch slider ---
    stretchSlider.addEventListener('input', () => {
        if (originalImageObject && debouncedEnhance) debouncedEnhance();
    });

    // --- Main Enhancement Function ---
    function runFullEnhancement() {
        if (!originalImageObject) return;

        drawImageWithFilters();
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const nPixels = currentImageData.length / 4;
        let c1 = [], c2 = [], c3 = [];

        for (let i = 0; i < nPixels; i++) {
            const r = currentImageData[i * 4], g = currentImageData[i * 4 + 1], b = currentImageData[i * 4 + 2];
            const converted = convertRgbTo(r, g, b, selectedColorspace);
            c1.push(converted[0]); c2.push(converted[1]); c3.push(converted[2]);
        }
        
        const { stretchedC1, stretchedC2, stretchedC3 } = performDstretch(c1, c2, c3);

        const newPixelData = new Uint8ClampedArray(currentImageData.length);
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
    }
    
    function performDstretch(c1, c2, c3) {
        const meanC1 = calculateMean(c1);
        const meanC2 = calculateMean(c2);
        const meanC3 = calculateMean(c3);
        const covMatrix = calculateCovarianceMatrix(c1, c2, c3, meanC1, meanC2, meanC3);
        const { eigenvectors, eigenvalues } = eigenDecomposition(covMatrix);
        
        const stretchAmount = stretchSlider.value;
        let stretchedC1 = [], stretchedC2 = [], stretchedC3 = [];

        for (let i = 0; i < c1.length; i++) {
            const v1 = c1[i] - meanC1, v2 = c2[i] - meanC2, v3 = c3[i] - meanC3;
            let p1 = v1 * eigenvectors[0][0] + v2 * eigenvectors[1][0] + v3 * eigenvectors[2][0];
            let p2 = v1 * eigenvectors[0][1] + v2 * eigenvectors[1][1] + v3 * eigenvectors[2][1];
            let p3 = v1 * eigenvectors[0][2] + v2 * eigenvectors[1][2] + v3 * eigenvectors[2][2];

            p1 *= (stretchAmount / Math.sqrt(Math.abs(eigenvalues[0]) || 1));
            p2 *= (stretchAmount / Math.sqrt(Math.abs(eigenvalues[1]) || 1));
            p3 *= (stretchAmount / Math.sqrt(Math.abs(eigenvalues[2]) || 1));

            stretchedC1[i] = p1 * eigenvectors[0][0] + p2 * eigenvectors[0][1] + p3 * eigenvectors[0][2] + meanC1;
            stretchedC2[i] = p1 * eigenvectors[1][0] + p2 * eigenvectors[1][1] + p3 * eigenvectors[1][2] + meanC2;
            stretchedC3[i] = p1 * eigenvectors[2][0] + p2 * eigenvectors[2][1] + p3 * eigenvectors[2][2] + meanC3;
        }
        return { stretchedC1, stretchedC2, stretchedC3 };
    }

    // --- UTILITY AND MATH FUNCTIONS ---
    function calculateMean(array) {
        return array.reduce((acc, val) => acc + val, 0) / array.length;
    }

    function calculateCovarianceMatrix(c1, c2, c3, m1, m2, m3) {
        const n = c1.length;
        let cov11 = 0, cov22 = 0, cov33 = 0, cov12 = 0, cov13 = 0, cov23 = 0;
        for (let i = 0; i < n; i++) {
            const d1 = c1[i] - m1, d2 = c2[i] - m2, d3 = c3[i] - m3;
            cov11 += d1 * d1; cov22 += d2 * d2; cov33 += d3 * d3;
            cov12 += d1 * d2; cov13 += d1 * d3; cov23 += d2 * d3;
        }
        const divisor = n - 1;
        return [
            [cov11 / divisor, cov12 / divisor, cov13 / divisor],
            [cov12 / divisor, cov22 / divisor, cov23 / divisor],
            [cov13 / divisor, cov23 / divisor, cov33 / divisor]
        ];
    }

    function eigenDecomposition(matrix) {
        try {
            const result = math.eigs(matrix);
            return { eigenvectors: result.vectors, eigenvalues: result.values };
        } catch (error) {
            console.error("Eigen-decomposition failed:", error);
            return { eigenvectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], eigenvalues: [1, 1, 1] };
        }
    }

    // --- COLORSPACE CONVERSION ---
    function convertRgbTo(r, g, b, colorspace) {
        switch (colorspace) {
            case 'LAB': return rgbToLab(r, g, b);
            case 'YRE': return [0.299*r + 0.587*g + 0.114*b, r, g];
            case 'LRE': return [0.2126*r + 0.7152*g + 0.0722*b, r, g];
            case 'CRGB': return [r, g, b];
            case 'YBK': return [0.299*r + 0.587*g + 0.114*b, b, 255 - g];
            case 'RGB': default: return [r, g, b];
        }
    }

    function convertToRgb(c1, c2, c3, colorspace) {
        switch (colorspace) {
            case 'LAB': return labToRgb(c1, c2, c3);
            case 'YRE': return [c2, c3, (c1 - 0.587*c3 - 0.299*c2) / 0.114];
            case 'LRE': return [c2, c3, (c1 - 0.7152*c3 - 0.2126*c2) / 0.0722];
            case 'CRGB': return [c1, c2, c3];
            case 'YBK': return [(c1 - 0.587*(255-c3) - 0.114*c2)/0.299, 255-c3, c2];
            case 'RGB': default: return [c1, c2, c3];
        }
    }

    function rgbToLab(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
        x /= 95.047; y /= 100.000; z /= 108.883;
        x = (x > 0.008856) ? Math.cbrt(x) : (7.787 * x) + 16/116;
        y = (y > 0.008856) ? Math.cbrt(y) : (7.787 * y) + 16/116;
        z = (z > 0.008856) ? Math.cbrt(z) : (7.787 * z) + 16/116;
        return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
    }

    function labToRgb(l, a, b_lab) {
        let y = (l + 16) / 116, x = a / 500 + y, z = y - b_lab / 200;
        const x3 = x*x*x, y3 = y*y*y, z3 = z*z*z;
        x = (x3 > 0.008856) ? x3 : (x - 16/116) / 7.787;
        y = (y3 > 0.008856) ? y3 : (y - 16/116) / 7.787;
        z = (z3 > 0.008856) ? z3 : (z - 16/116) / 7.787;
        x *= 95.047; y *= 100.000; z *= 108.883;
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
