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
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = filterString;
        ctx.drawImage(originalImageObject, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
    }

    // --- Main Enhancement Logic ---
    enhanceBtn.addEventListener('click', () => {
        if (!originalImageObject) return;

        drawImageWithFilters();
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const nPixels = currentImageData.length / 4;
        let c1 = [], c2 = [], c3 = [];

        for (let i = 0; i < nPixels; i++) {
            const r = currentImageData[i * 4];
            const g = currentImageData[i * 4 + 1];
            const b = currentImageData[i * 4 + 2];
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
        
        originalImageObject.src = canvas.toDataURL();
        originalImageObject.onload = () => {
             resetAdjustmentsAndDraw();
        };
    });

    // --- DStretch Core Function ---
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

    // --- COLORSPACE CONVERSION ROUTERS ---
    
    function convertRgbTo(r, g, b, colorspace) {
        // ... (function content is the same as previous correct version)
    }

    function convertToRgb(c1, c2, c3, colorspace) {
        // ... (function content is the same as previous correct version)
    }

    // --- RGB <-> LAB CONVERSION ---
    
    function rgbToLab(r, g, b) {
        // ... (function content is the same as previous correct version)
    }

    function labToRgb(l, a, b_lab) {
        // ... (function content is the same as previous correct version)
    }
});
