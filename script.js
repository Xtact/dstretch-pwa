document.addEventListener('DOMContentLoaded', () => {
    // --- Get all interactive elements ---
    const imageDisplay = document.getElementById('imageDisplay');
    const imageLoader = document.getElementById('imageLoader');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Header buttons
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const downloadBtn = document.getElementById('download-btn');
    
    // All Sliders
    const allSliders = document.querySelectorAll('input[type="range"]');
    const stretchSlider = document.getElementById('stretch');
    
    // Navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    const controlPanels = document.querySelectorAll('.control-panel');
    const colorspaceButtons = document.querySelectorAll('.cs-btn');

    // --- State Management ---
    let originalImageSrc = null;
    let history = [];
    let historyIndex = -1;
    let selectedColorspace = 'RGB';
    let debouncedProcess;

    // --- DEBOUNCE UTILITY ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- HISTORY (UNDO/REDO) MANAGEMENT ---
    const updateHistory = (dataUrl) => {
        if (history[historyIndex] === dataUrl) return;
        history.splice(historyIndex + 1);
        history.push(dataUrl);
        historyIndex++;
        updateUndoRedoButtons();
    };

    const updateUndoRedoButtons = () => {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex === history.length - 1;
    };

    const undo = () => {
        if (historyIndex > 0) {
            historyIndex--;
            imageDisplay.src = history[historyIndex];
            updateUndoRedoButtons();
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            imageDisplay.src = history[historyIndex];
            updateUndoRedoButtons();
        }
    };

    // --- CORE APP LOGIC ---
    const initialize = () => {
        navTabs.forEach(tab => tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            controlPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.panel).classList.add('active');
        }));

        imageDisplay.addEventListener('click', () => { if (!originalImageSrc) imageLoader.click(); });
        imageLoader.addEventListener('change', handleImageUpload);

        colorspaceButtons.forEach(button => button.addEventListener('click', () => {
            colorspaceButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedColorspace = button.dataset.colorspace;
            if (originalImageSrc) processImage(true); // Colorspace change is a major change, so no debounce and always history
        }));
        
        // Debounce only for continuous slider input to prevent lag
        debouncedProcess = debounce(processImage, 400); 
        allSliders.forEach(slider => slider.addEventListener('input', () => {
             // If it's a new "stretch" state, we want a new history entry.
             // If it's any other slider, we need to run a debounced process.
             const isNewHistoryState = slider.id === 'stretch';
             if (originalImageSrc) debouncedProcess(isNewHistoryState); 
        }));
        
        // Handling pointer events for before/after comparison
        imageDisplay.addEventListener('pointerdown', () => { if (originalImageSrc && history.length > 0) imageDisplay.src = originalImageSrc; });
        imageDisplay.addEventListener('pointerup', () => { if (originalImageSrc && history.length > 0) imageDisplay.src = history[historyIndex]; });
        imageDisplay.addEventListener('pointerleave', () => { if (originalImageSrc && history.length > 0) imageDisplay.src = history[historyIndex]; });
        
        downloadBtn.addEventListener('click', downloadImage);
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
    };

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            originalImageSrc = e.target.result;
            // The very first image load is the first history state
            history = [originalImageSrc]; 
            historyIndex = 0;
            updateUndoRedoButtons();
            resetAndProcess();
        };
        reader.readAsDataURL(file);
    }

    function resetAndProcess() {
        allSliders.forEach(slider => {
            if(slider.id === 'stretch') slider.value = 50;
            else slider.value = 0;
        });
        processImage(true);
    }

    // --- MAIN IMAGE PROCESSING PIPELINE ---
    function processImage(isNewHistoryState = false) {
        if (!originalImageSrc) return;
        
        const baseImage = new Image();
        baseImage.onload = () => {
            canvas.width = baseImage.naturalWidth;
            canvas.height = baseImage.naturalHeight;
            ctx.drawImage(baseImage, 0, 0);

            // Get a fresh copy of pixel data from the original image
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let pixels = imageData.data;

            // Step 1: Apply "Adjust" filters to a COPY of the original pixel data
            // We pass a copy to avoid modifying the array that holds the original data for subsequent calls
            const adjustedPixels = applyAdjustments(new Uint8ClasedArray(pixels)); 
            
            // Step 2: Run DStretch on the adjusted pixel data
            const finalPixelData = runDStretch(adjustedPixels);

            // Step 3: Display final result and update history
            // We must update the existing imageData object with the final result
            imageData.data.set(finalPixelData);
            ctx.putImageData(imageData, 0, 0);
            
            const finalDataUrl = canvas.toDataURL('image/png'); // Use PNG for quality
            imageDisplay.src = finalDataUrl;
            
            if (isNewHistoryState) {
                updateHistory(finalDataUrl);
            } else if (historyIndex >= 0) {
                // This ensures the current visual state is always reflected in the current history index
                history[historyIndex] = finalDataUrl;
            }
        };
        // It is CRITICAL to always start from the pristine original image
        baseImage.src = originalImageSrc; 
    }

    /**
     * Applies standard image adjustments (Exposure, Contrast, etc.) to the pixel data.
     * @param {Uint8ClampedArray} pixels - The pixel data array (R, G, B, A, R, G, B, A, ...)
     * @returns {Uint8ClampedArray} The adjusted pixel data.
     */
    function applyAdjustments(pixels) {
        // Read values once
        const exposure = parseFloat(document.getElementById('exposure').value);
        const shadows = parseFloat(document.getElementById('shadows').value);
        const brightness = parseFloat(document.getElementById('brightness').value);
        const contrast = parseFloat(document.getElementById('contrast').value);
        const blackPoint = parseFloat(document.getElementById('blackPoint').value) / 100;
        const saturation = parseFloat(document.getElementById('saturation').value);

        const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const satFactor = saturation / 100;
        const totalBrightness = exposure + brightness;

        for (let i = 0; i < pixels.length; i += 4) {
            let r = pixels[i], g = pixels[i+1], b = pixels[i+2];

            // Exposure & Brightness
            r += totalBrightness; g += totalBrightness; b += totalBrightness;

            // Shadows: Simple lift for darker pixels
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luma < 128) {
                // Apply a lift that is stronger for darker pixels
                const shadowFactor = shadows * (1 - luma / 128) * 0.5; // Adjusted factor for subtlety
                r += shadowFactor; g += shadowFactor; b += shadowFactor;
            }

            // Contrast & Black Point (apply contrast first)
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;
            
            // Black Point (clip dark colors to black point)
            const minClip = blackPoint * 255;
            r = Math.max(r, minClip);
            g = Math.max(g, minClip);
            b = Math.max(b, minClip);
            
            // Saturation
            const avg = (r + g + b) / 3;
            r = avg + (r - avg) * (1 + satFactor);
            g = avg + (g - avg) * (1 + satFactor);
            b = avg + (b - avg) * (1 + satFactor);
            
            // Clamp and update
            pixels[i] = Math.min(255, Math.max(0, r)); 
            pixels[i+1] = Math.min(255, Math.max(0, g)); 
            pixels[i+2] = Math.min(255, Math.max(0, b));
        }
        return pixels; // Return the modified array
    }
    
    function runDStretch(imageData) {
        // This function now just runs the DStretch part, not the whole pipeline
        const nPixels = imageData.length / 4;
        let c1 = [], c2 = [], c3 = [];

        // Convert the (potentially adjusted) RGB data to the selected color space
        for (let i = 0; i < nPixels; i++) {
            const r = imageData[i * 4], g = imageData[i * 4 + 1], b = imageData[i * 4 + 2];
            const converted = convertRgbTo(r, g, b, selectedColorspace);
            c1.push(converted[0]); c2.push(converted[1]); c3.push(converted[2]);
        }
        
        const { stretchedC1, stretchedC2, stretchedC3 } = performDstretch(c1, c2, c3);

        const finalPixelData = new Uint8ClampedArray(imageData.length);
        // Convert the stretched color space components back to RGB
        for (let i = 0; i < nPixels; i++) {
            const rgb = convertToRgb(stretchedC1[i], stretchedC2[i], stretchedC3[i], selectedColorspace);
            const pixelIndex = i * 4;
            // Clamp colors and set
            finalPixelData[pixelIndex] = Math.min(255, Math.max(0, rgb[0]));
            finalPixelData[pixelIndex + 1] = Math.min(255, Math.max(0, rgb[1]));
            finalPixelData[pixelIndex + 2] = Math.min(255, Math.max(0, rgb[2]));
            finalPixelData[pixelIndex + 3] = 255; // Keep alpha channel opaque
        }
        return finalPixelData;
    }
    
    function performDstretch(c1, c2, c3) {
        const meanC1 = calculateMean(c1), meanC2 = calculateMean(c2), meanC3 = calculateMean(c3);
        const covMatrix = calculateCovarianceMatrix(c1, c2, c3, meanC1, meanC2, meanC3);
        // Use a more robust check for 'math.eigs' since it's an external library function
        const { eigenvectors, eigenvalues } = (typeof math !== 'undefined' && math.eigs) 
            ? eigenDecomposition(covMatrix) 
            : { eigenvectors: [[1,0,0],[0,1,0],[0,0,1]], eigenvalues: [1,1,1] };
        
        // The Dstretch algorithm scales the principal components.
        const stretchAmount = stretchSlider.value / 50; // Normalize 1-100 to 0.02-2.0
        let stretchedC1 = [], stretchedC2 = [], stretchedC3 = [];

        for (let i = 0; i < c1.length; i++) {
            const v1=c1[i]-meanC1, v2=c2[i]-meanC2, v3=c3[i]-meanC3;
            // Project the component values onto the eigenvector space (PCA)
            let p1=v1*eigenvectors[0][0]+v2*eigenvectors[1][0]+v3*eigenvectors[2][0];
            let p2=v1*eigenvectors[0][1]+v2*eigenvectors[1][1]+v3*eigenvectors[2][1];
            let p3=v1*eigenvectors[0][2]+v2*eigenvectors[1][2]+v3*eigenvectors[2][2];
            
            // Stretch along the principal component axes (p1, p2, p3)
            // The scaling factor should be proportional to stretchAmount and inversely proportional to the standard deviation (sqrt of eigenvalue)
            p1 *= (stretchAmount/Math.sqrt(Math.abs(eigenvalues[0])||1));
            p2 *= (stretchAmount/Math.sqrt(Math.abs(eigenvalues[1])||1));
            p3 *= (stretchAmount/Math.sqrt(Math.abs(eigenvalues[2])||1));
            
            // Project the stretched component values back to the original color space
            stretchedC1[i]=p1*eigenvectors[0][0]+p2*eigenvectors[0][1]+p3*eigenvectors[0][2]+meanC1;
            stretchedC2[i]=p1*eigenvectors[1][0]+p2*eigenvectors[1][1]+p3*eigenvectors[1][2]+meanC2;
            stretchedC3[i]=p1*eigenvectors[2][0]+p2*eigenvectors[2][1]+p3*eigenvectors[2][2]+meanC3;
        }
        return { stretchedC1, stretchedC2, stretchedC3 };
    }
    
    function downloadImage() {
        if (!history[historyIndex]) return;
        const link = document.createElement('a');
        link.download = 'DstretchPro_Image.png';
        // Use the current image displayed, which should be the last one in history
        link.href = history[historyIndex]; 
        link.click();
    }

    // --- UTILITY, MATH, AND COLORSPACE FUNCTIONS (minified for brevity) ---
    function calculateMean(a){return a.reduce((b,c)=>b+c,0)/a.length}
    function calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3){const n=c1.length;let a=0,b=0,c=0,d=0,e=0,f=0;for(let i=0;i<n;i++){const g=c1[i]-m1,h=c2[i]-m2,j=c3[i]-m3;a+=g*g;b+=h*h;c+=j*j;d+=g*h;e+=g*j;f+=h*j}const k=n-1;return[[a/k,d/k,e/k],[d/k,b/k,f/k],[e/k,f/k,c/k]]}
    function eigenDecomposition(a){try{const{vectors,values}=math.eigs(a);return{eigenvectors:vectors,eigenvalues:values}}catch(c){console.warn('Eigen decomposition failed, using default identity matrix.');return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}}
    function convertRgbTo(r,g,b,cs){switch(cs){case'LAB':return rgbToLab(r,g,b);case'YRE':return[0.299*r+0.587*g+0.114*b,r,g];case'LRE':return[0.2126*r+0.7152*g+0.0722*b,r,g];case'CRGB':return[r,g,b];case'YBK':return[0.299*r+0.587*g+0.114*b,b,255-g];default:return[r,g,b]}}
    function convertToRgb(c1,c2,c3,cs){switch(cs){case'LAB':return labToRgb(c1,c2,c3);case'YRE':return[c2,c3,(c1-0.587*c3-0.299*c2)/0.114];case'LRE':return[c2,c3,(c1-0.7152*c3-0.2126*c2)/0.0722];case'CRGB':return[c1,c2,c3];case'YBK':return[(c1-0.587*(255-c3)-0.114*c2)/0.299,255-c3,c2];default:return[c1,c2,c3]}}
    function rgbToLab(r,g,b){r/=255;g/=255;b/=255;r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;let x=(r*0.4124+g*0.3576+b*0.1805)*100,y=(r*0.2126+g*0.7152+b*0.0722)*100,z=(r*0.0193+g*0.1192+b*0.9505)*100;x/=95.047;y/=100;z/=108.883;x=x>0.008856?Math.cbrt(x):7.787*x+16/116;y=y>0.008856?Math.cbrt(y):7.787*y+16/116;z=z>0.008856?Math.cbrt(z):7.787*z+16/116;return[(116*y)-16,500*(x-y),200*(y-z)]}
    function labToRgb(l,a,b_lab){let y=(l+16)/116,x=a/500+y,z=y-b_lab/200;const k=x*x*x,m=y*y*y,n=z*z*z;x=k>0.008856?k:(x-16/116)/7.787;y=m>0.008856?m:(y-16/116)/7.787;z=n>0.008856?n:(z-16/116)/7.787;x*=95.047;y*=100;z*=108.883;x/=100;y/=100;z/=100;let r=x*3.2406+y*-1.5372+z*-0.4986,g=x*-0.9689+y*1.8758+z*0.0415,b=x*0.0557+y*-0.2040+z*1.0570;r=r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;g=g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;b=b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;return[r*255,g*255,b*255]}

    initialize();
});
