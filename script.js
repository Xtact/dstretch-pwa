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
    const headerTitleEl = document.querySelector('.app-header .header-title'); // Renamed to avoid conflict
    const colorspaceButtons = document.querySelectorAll('.cs-btn');

    // --- State Management ---
    let originalImageSrc = null; // The very first image uploaded
    let history = [];
    let historyIndex = -1;
    let selectedColorspace = 'RGB';
    let debouncedProcess;

    // --- DEBOUNCE UTILITY ---
    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- HISTORY (UNDO/REDO) MANAGEMENT ---
    function updateHistory(dataUrl) {
        history.splice(historyIndex + 1); // Clear "redo" history
        history.push(dataUrl);
        historyIndex++;
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex === history.length - 1;
    }

    undoBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            imageDisplay.src = history[historyIndex];
            updateUndoRedoButtons();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            imageDisplay.src = history[historyIndex];
            updateUndoRedoButtons();
        }
    });

    // --- CORE APP LOGIC ---
    function initialize() {
        // Tab Navigation
        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                navTabs.forEach(t => t.classList.remove('active'));
                controlPanels.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.panel).classList.add('active');
            });
        });

        // Image Loading
        imageDisplay.addEventListener('click', () => { if (!originalImageSrc) imageLoader.click(); });
        imageLoader.addEventListener('change', handleImageUpload);

        // Colorspace Selection
        colorspaceButtons.forEach(button => {
            button.addEventListener('click', () => {
                colorspaceButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                selectedColorspace = button.dataset.colorspace;
                if (originalImageSrc) debouncedProcess(true); // Force process on colorspace change
            });
        });
        
        // Auto-processing for all sliders
        debouncedProcess = debounce(processImage, 400);
        allSliders.forEach(slider => {
            slider.addEventListener('input', () => { if (originalImageSrc) debouncedProcess(false); });
        });

        // Press and hold to view original
        imageDisplay.addEventListener('mousedown', () => { if (originalImageSrc) imageDisplay.src = originalImageSrc; });
        imageDisplay.addEventListener('mouseup', () => { if (originalImageSrc) imageDisplay.src = history[historyIndex]; });
        imageDisplay.addEventListener('touchstart', (e) => { e.preventDefault(); if (originalImageSrc) imageDisplay.src = originalImageSrc; });
        imageDisplay.addEventListener('touchend', () => { if (originalImageSrc) imageDisplay.src = history[historyIndex]; });
        
        // Download
        downloadBtn.addEventListener('click', downloadImage);
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImageSrc = e.target.result;
            history = [originalImageSrc];
            historyIndex = 0;
            updateUndoRedoButtons();
            resetAndProcess();
        };
        reader.readAsDataURL(file);
    }

    function resetAndProcess() {
        allSliders.forEach(slider => slider.value = slider.id === 'stretch' ? 50 : (slider.id === 'saturation' ? 100 : (slider.id === 'shadows' || slider.id === 'blackPoint' || slider.id === 'sharpen' ? 0 : 100)));
        processImage(true);
    }

    // --- MAIN IMAGE PROCESSING PIPELINE ---
    function processImage(isNewHistoryState = true) {
        if (!originalImageSrc) return;
        
        const baseImage = new Image();
        baseImage.onload = () => {
            canvas.width = baseImage.naturalWidth;
            canvas.height = baseImage.naturalHeight;

            // Step 1: Apply all "Adjust" filters to the base image
            const exposure = document.getElementById('exposure').value / 100;
            const shadows = document.getElementById('shadows').value / 100;
            const brightness = document.getElementById('brightness').value / 100;
            const contrast = document.getElementById('contrast').value / 100;
            const blackPoint = document.getElementById('blackPoint').value / 100;
            const saturation = document.getElementById('saturation').value / 100;
            const sharpen = document.getElementById('sharpen').value / 100;

            // More complex filters are combined. Shadows use brightness, blackPoint uses contrast.
            ctx.filter = `
                brightness(${exposure * brightness}) 
                contrast(${contrast + blackPoint}) 
                saturate(${saturation}) 
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><filter id="sharpen"><feGaussianBlur stdDeviation="${1 - sharpen}" /></filter></svg>#sharpen')
            `;
            // A simple way to simulate shadows lift is by adding brightness. More complex filters can be used.
            // For now, let's keep it simple. Shadows can also be a filter: drop-shadow isn't quite right. Let's use brightness.
            ctx.filter = `brightness(${exposure * brightness + shadows}) contrast(${contrast + blackPoint}) saturate(${saturation})`;
            
            ctx.drawImage(baseImage, 0, 0);
            
            // Step 2-5: DStretch Algorithm
            const adjustedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const finalPixelData = runDStretch(adjustedImageData);

            // Step 6: Display final result and update history
            const finalImageData = new ImageData(finalPixelData, canvas.width, canvas.height);
            ctx.putImageData(finalImageData, 0, 0);
            const finalDataUrl = canvas.toDataURL();
            imageDisplay.src = finalDataUrl;
            
            if (isNewHistoryState) {
                updateHistory(finalDataUrl);
            } else {
                // If just sliding, update the current history state without adding a new one
                history[historyIndex] = finalDataUrl;
            }
        };
        baseImage.src = history[0]; // Always process from the original uploaded image
    }
    
    function runDStretch(imageData) {
        const nPixels = imageData.length / 4;
        let c1 = [], c2 = [], c3 = [];

        for (let i = 0; i < nPixels; i++) {
            const r = imageData[i * 4], g = imageData[i * 4 + 1], b = imageData[i * 4 + 2];
            const converted = convertRgbTo(r, g, b, selectedColorspace);
            c1.push(converted[0]); c2.push(converted[1]); c3.push(converted[2]);
        }
        
        const { stretchedC1, stretchedC2, stretchedC3 } = performDstretch(c1, c2, c3);

        const finalPixelData = new Uint8ClampedArray(imageData.length);
        for (let i = 0; i < nPixels; i++) {
            const rgb = convertToRgb(stretchedC1[i], stretchedC2[i], stretchedC3[i], selectedColorspace);
            const pixelIndex = i * 4;
            finalPixelData[pixelIndex] = rgb[0];
            finalPixelData[pixelIndex + 1] = rgb[1];
            finalPixelData[pixelIndex + 2] = rgb[2];
            finalPixelData[pixelIndex + 3] = 255;
        }
        return finalPixelData;
    }
    
    function performDstretch(c1, c2, c3) {
        const meanC1 = calculateMean(c1), meanC2 = calculateMean(c2), meanC3 = calculateMean(c3);
        const covMatrix = calculateCovarianceMatrix(c1, c2, c3, meanC1, meanC2, meanC3);
        const { eigenvectors, eigenvalues } = eigenDecomposition(covMatrix);
        
        const stretchAmount = stretchSlider.value;
        let stretchedC1 = [], stretchedC2 = [], stretchedC3 = [];

        for (let i = 0; i < c1.length; i++) {
            const v1 = c1[i]-meanC1, v2 = c2[i]-meanC2, v3 = c3[i]-meanC3;
            let p1 = v1*eigenvectors[0][0] + v2*eigenvectors[1][0] + v3*eigenvectors[2][0];
            let p2 = v1*eigenvectors[0][1] + v2*eigenvectors[1][1] + v3*eigenvectors[2][1];
            let p3 = v1*eigenvectors[0][2] + v2*eigenvectors[1][2] + v3*eigenvectors[2][2];
            p1 *= (stretchAmount/Math.sqrt(Math.abs(eigenvalues[0])||1));
            p2 *= (stretchAmount/Math.sqrt(Math.abs(eigenvalues[1])||1));
            p3 *= (stretchAmount/Math.sqrt(Math.abs(eigenvalues[2])||1));
            stretchedC1[i] = p1*eigenvectors[0][0] + p2*eigenvectors[0][1] + p3*eigenvectors[0][2] + meanC1;
            stretchedC2[i] = p1*eigenvectors[1][0] + p2*eigenvectors[1][1] + p3*eigenvectors[1][2] + meanC2;
            stretchedC3[i] = p1*eigenvectors[2][0] + p2*eigenvectors[2][1] + p3*eigenvectors[2][2] + meanC3;
        }
        return { stretchedC1, stretchedC2, stretchedC3 };
    }
    
    function downloadImage() {
        if (!history[historyIndex]) return;
        const link = document.createElement('a');
        link.download = 'DstretchPro_Image.png';
        link.href = history[historyIndex];
        link.click();
    }

    // --- UTILITY, MATH, AND COLORSPACE FUNCTIONS (minified for brevity) ---
    function calculateMean(a){return a.reduce((b,c)=>b+c,0)/a.length}
    function calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3){const n=c1.length;let a=0,b=0,c=0,d=0,e=0,f=0;for(let i=0;i<n;i++){const g=c1[i]-m1,h=c2[i]-m2,j=c3[i]-m3;a+=g*g;b+=h*h;c+=j*j;d+=g*h;e+=g*j;f+=h*j}const k=n-1;return[[a/k,d/k,e/k],[d/k,b/k,f/k],[e/k,f/k,c/k]]}
    function eigenDecomposition(a){try{const b=math.eigs(a);return{eigenvectors:b.vectors,eigenvalues:b.values}}catch(c){return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}}
    function convertRgbTo(r,g,b,cs){switch(cs){case'LAB':return rgbToLab(r,g,b);case'YRE':return[0.299*r+0.587*g+0.114*b,r,g];case'LRE':return[0.2126*r+0.7152*g+0.0722*b,r,g];case'YBK':return[0.299*r+0.587*g+0.114*b,b,255-g];default:return[r,g,b]}}
    function convertToRgb(c1,c2,c3,cs){switch(cs){case'LAB':return labToRgb(c1,c2,c3);case'YRE':return[c2,c3,(c1-0.587*c3-0.299*c2)/0.114];case'LRE':return[c2,c3,(c1-0.7152*c3-0.2126*c2)/0.0722];case'YBK':return[(c1-0.587*(255-c3)-0.114*c2)/0.299,255-c3,c2];default:return[c1,c2,c3]}}
    function rgbToLab(r,g,b){r/=255;g/=255;b/=255;r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;let x=(r*0.4124+g*0.3576+b*0.1805)*100,y=(r*0.2126+g*0.7152+b*0.0722)*100,z=(r*0.0193+g*0.1192+b*0.9505)*100;x/=95.047;y/=100;z/=108.883;x=x>0.008856?Math.cbrt(x):7.787*x+16/116;y=y>0.008856?Math.cbrt(y):7.787*y+16/116;z=z>0.008856?Math.cbrt(z):7.787*z+16/116;return[(116*y)-16,500*(x-y),200*(y-z)]}
    function labToRgb(l,a,b_lab){let y=(l+16)/116,x=a/500+y,z=y-b_lab/200;const k=x*x*x,m=y*y*y,n=z*z*z;x=k>0.008856?k:(x-16/116)/7.787;y=m>0.008856?m:(y-16/116)/7.787;z=n>0.008856?n:(z-16/116)/7.787;x*=95.047;y*=100;z*=108.883;x/=100;y/=100;z/=100;let r=x*3.2406+y*-1.5372+z*-0.4986,g=x*-0.9689+y*1.8758+z*0.0415,b=x*0.0557+y*-0.2040+z*1.0570;r=r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;g=g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;b=b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;return[r*255,g*255,b*255]}

    initialize();
});
