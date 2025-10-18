document.addEventListener('DOMContentLoaded', () => {
    // --- Get Elements ---
    const imageDisplay = document.getElementById('imageDisplay');
    const imageLoader = document.getElementById('imageLoader');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const cancelBtn = document.getElementById('cancel-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const downloadBtn = document.getElementById('download-btn');
    const allSliders = document.querySelectorAll('input[type="range"]');
    const stretchSlider = document.getElementById('stretch');
    const navTabs = document.querySelectorAll('.nav-tab');
    const controlPanels = document.querySelectorAll('.control-panel');
    const colorspaceButtons = document.querySelectorAll('.cs-btn');
    const mainHeaderTitle = document.getElementById('main-header-title'); // Get header title element

    // --- State ---
    let originalImageSrc = null; // Pristine uploaded src
    let history = [];
    let historyIndex = -1;
    let selectedColorspace = 'RGB';
    let debouncedProcess;
    let isImageLoaded = false;
    let isProcessing = false; // Flag to prevent concurrent processing

    // --- Debounce ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- History ---
    const updateHistory = (dataUrl) => {
        if (isProcessing) return; // Don't update history during processing
        if (history.length > 0 && history[historyIndex] === dataUrl) return;
        console.log("Updating history");
        history.splice(historyIndex + 1); history.push(dataUrl); historyIndex++;
        updateUndoRedoButtons();
    };
    const updateUndoRedoButtons = () => { undoBtn.disabled = historyIndex <= 0; redoBtn.disabled = historyIndex === history.length - 1; };
    const undo = () => { if (historyIndex > 0) { historyIndex--; imageDisplay.src = history[historyIndex]; updateUndoRedoButtons(); /* TODO: Optionally reset sliders to match history state */ } };
    const redo = () => { if (historyIndex < history.length - 1) { historyIndex++; imageDisplay.src = history[historyIndex]; updateUndoRedoButtons(); /* TODO: Optionally reset sliders */ } };

    // --- Core Listeners ---
    const setupCoreEventListeners = () => {
        console.log("Setting up core listeners...");
        navTabs.forEach(tab => tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            controlPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.panel).classList.add('active');
            mainHeaderTitle.textContent = tab.textContent; // Update header title
        }));

        if (imageDisplay && imageLoader) {
            imageDisplay.addEventListener('click', () => { if (!originalImageSrc) imageLoader.click(); });
            imageLoader.addEventListener('change', handleImageUpload);
            console.log("Upload listeners ready.");
        } else { console.error("Missing critical display/loader elements!"); return; }

        colorspaceButtons.forEach(button => button.addEventListener('click', () => {
            if (isProcessing) return; // Prevent changes during processing
            colorspaceButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active'); selectedColorspace = button.dataset.colorspace;
            if (originalImageSrc) debouncedProcess(true); // Process and add history
        }));

        debouncedProcess = debounce(processImage, 400);
        allSliders.forEach(slider => {
            if (slider.id !== 'sharpen') {
                 slider.addEventListener('input', () => { if (originalImageSrc && !isProcessing) debouncedProcess(false); }); // Process in real time
                 slider.addEventListener('change', () => { if (originalImageSrc && !isProcessing) setTimeout(() => updateHistory(imageDisplay.src), 50); }); // Add history on release
            }
        });

        // Use pointer events for better touch compatibility
        imageDisplay.addEventListener('pointerdown', (e) => { if (originalImageSrc && history.length > 0 && historyIndex >= 0) { e.preventDefault(); imageDisplay.src = originalImageSrc;} });
        imageDisplay.addEventListener('pointerup', (e) => { if (originalImageSrc && history.length > 0 && historyIndex >= 0) { e.preventDefault(); imageDisplay.src = history[historyIndex];} });
        imageDisplay.addEventListener('pointerleave', (e) => { if (originalImageSrc && history.length > 0 && historyIndex >= 0) { e.preventDefault(); imageDisplay.src = history[historyIndex]; }}); // Revert if pointer leaves element while pressed

        downloadBtn.addEventListener('click', downloadImage);
        cancelBtn.addEventListener('click', () => {
             if (!originalImageSrc || isProcessing) return;
             history = [originalImageSrc]; historyIndex = 0; imageDisplay.src = originalImageSrc;
             updateUndoRedoButtons(); resetSlidersVisually();
        });
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        console.log("Core listeners initialized.");
    };

    function handleImageUpload(event) {
        console.log("Image upload started...");
        const file = event.target.files[0]; if (!file) return;
        isImageLoaded = false;
        const reader = new FileReader();
        reader.onload = e => {
            originalImageSrc = e.target.result;
            history = [originalImageSrc]; historyIndex = 0;
            isImageLoaded = true;
            imageDisplay.src = originalImageSrc; // Display original immediately
            console.log("Original image displayed.");
            updateUndoRedoButtons();
            downloadBtn.disabled = false;
            resetSlidersVisually(); // Reset sliders visually ONLY
        };
        reader.onerror = e => console.error("FileReader error:", e);
        reader.readAsDataURL(file);
    }

    // Renamed for clarity - only resets slider positions
    function resetSlidersVisually() {
        allSliders.forEach(slider => {
            slider.value = slider.defaultValue || (slider.id === 'stretch' ? 50 : 0);
        });
        console.log("Sliders reset visually.");
         // Reset colorspace button to RGB visually
        colorspaceButtons.forEach(btn => btn.classList.remove('active'));
        const defaultCSButton = document.querySelector('.cs-btn[data-colorspace="RGB"]');
        if (defaultCSButton) defaultCSButton.classList.add('active');
        selectedColorspace = 'RGB';
    }

    // --- Image Processing Pipeline ---
    function processImage(isNewHistoryState = false) {
        if (!originalImageSrc || !isImageLoaded || isProcessing) return;
        console.log("Processing image...");
        isProcessing = true; // Set processing flag

        // Disable controls during processing
        allSliders.forEach(s => s.disabled = true);
        colorspaceButtons.forEach(b => b.disabled = true);
        undoBtn.disabled = true; redoBtn.disabled = true; downloadBtn.disabled = true; cancelBtn.disabled = true;

        const baseImage = new Image();
        baseImage.onload = () => {
            try {
                if (canvas.width !== baseImage.naturalWidth || canvas.height !== baseImage.naturalHeight) {
                    canvas.width = baseImage.naturalWidth; canvas.height = baseImage.naturalHeight;
                }
                ctx.drawImage(baseImage, 0, 0); // Draw base image
                let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let pixels = imageData.data;

                // Determine if any adjustments or stretch need to be applied
                const needsAdjust = Array.from(allSliders).some(s => s.id !== 'stretch' && s.id !== 'sharpen' && parseFloat(s.value) !== 0);
                const needsStretch = parseFloat(stretchSlider.value) !== 50 || selectedColorspace !== 'RGB';

                if (needsAdjust) {
                    applyAdjustments(pixels);
                }
                if (needsStretch) {
                    const finalPixelData = runDStretch(pixels); // Pass current (potentially adjusted) pixel data
                    imageData.data.set(finalPixelData);
                }

                ctx.putImageData(imageData, 0, 0); // Put processed data back
                const finalDataUrl = canvas.toDataURL(); imageDisplay.src = finalDataUrl;
                if (isNewHistoryState) updateHistory(finalDataUrl);
                else { if (history.length > 0) history[historyIndex] = finalDataUrl; else { history = [finalDataUrl]; historyIndex = 0; } updateUndoRedoButtons(); }
                console.log("Processing complete.");

            } catch (error) {
                console.error("Processing error:", error);
                imageDisplay.src = history[historyIndex] || originalImageSrc; // Revert display on error
            } finally {
                isProcessing = false; // Clear processing flag
                 // Re-enable controls
                allSliders.forEach(s => { if(s.id !== 'sharpen') s.disabled = false; });
                colorspaceButtons.forEach(b => b.disabled = false);
                updateUndoRedoButtons(); // Re-enable based on history
                downloadBtn.disabled = !isImageLoaded;
                cancelBtn.disabled = !isImageLoaded;
            }
        };
        baseImage.onerror = () => {
            console.error("Base image load error for processing.");
            isProcessing = false; // Clear flag on load error
            // Re-enable controls on error too
            allSliders.forEach(s => { if(s.id !== 'sharpen') s.disabled = false; });
            colorspaceButtons.forEach(b => b.disabled = false);
            updateUndoRedoButtons();
            downloadBtn.disabled = !isImageLoaded;
            cancelBtn.disabled = !isImageLoaded;
        };
        baseImage.src = originalImageSrc; // Always start from original src
    }

    function applyAdjustments(pixels) { /* ... unchanged ... */ }
    function runDStretch(imageData) { /* ... unchanged ... */ }
    function performDstretch(c1, c2, c3) { /* ... unchanged ... */ }
    function downloadImage() { /* ... unchanged ... */ }

    // --- UTILITY, MATH, AND COLORSPACE FUNCTIONS (minified) ---
    // These remain unchanged
    // ... (include all the math/color functions from the previous correct version here) ...
    function calculateMean(a){return a.reduce((b,c)=>b+c,0)/a.length}
    function calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3){const n=c1.length;let a=0,b=0,c=0,d=0,e=0,f=0;for(let i=0;i<n;i++){const g=c1[i]-m1,h=c2[i]-m2,j=c3[i]-m3;a+=g*g;b+=h*h;c+=j*j;d+=g*h;e+=g*j;f+=h*j}const k=n-1;return[[a/k,d/k,e/k],[d/k,b/k,f/k],[e/k,f/k,c/k]]}
    function eigenDecomposition(a){if(typeof math==='undefined'){console.error("math.js not loaded");return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}try{const{vectors,values}=math.eigs(a);return{eigenvectors:vectors,eigenvalues:values}}catch(c){console.error("Eigen Decomp Error:",c);return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}}
    function convertRgbTo(r,g,b,cs){switch(cs){case'LAB':return rgbToLab(r,g,b);case'YRE':return[0.299*r+0.587*g+0.114*b,r,g];case'LRE':return[0.2126*r+0.7152*g+0.0722*b,r,g];case'YBK':return[0.299*r+0.587*g+0.114*b,b,255-g];default:return[r,g,b]}}
    function convertToRgb(c1,c2,c3,cs){let r,g,b;try{switch(cs){case'LAB':return labToRgb(c1,c2,c3);case'YRE':r=c2;g=c3;b=(c1-0.587*g-0.299*r)/0.114||0;break;case'LRE':r=c2;g=c3;b=(c1-0.7152*g-0.2126*r)/0.0722||0;break;case'YBK':g=255-c3;b=c2;r=(c1-0.587*g-0.114*b)/0.299||0;break;default:r=c1;g=c2;b=c3;break}}catch(e){console.error("Error converting back to RGB:",e);return[0,0,0]}return[r,g,b];}
    function rgbToLab(r,g,b){r/=255;g/=255;b/=255;r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;let x=(r*0.4124+g*0.3576+b*0.1805)*100,y=(r*0.2126+g*0.7152+b*0.0722)*100,z=(r*0.0193+g*0.1192+b*0.9505)*100;x/=95.047;y/=100;z/=108.883;x=x>0.008856?Math.cbrt(x):7.787*x+16/116;y=y>0.008856?Math.cbrt(y):7.787*y+16/116;z=z>0.008856?Math.cbrt(z):7.787*z+16/116;return[(116*y)-16,500*(x-y),200*(y-z)]}
    function labToRgb(l,a,b_lab){let y=(l+16)/116,x=a/500+y,z=y-b_lab/200;const k=x*x*x,m=y*y*y,n=z*z*z;x=k>0.008856?k:(x-16/116)/7.787;y=m>0.008856?m:(y-16/116)/7.787;z=n>0.008856?n:(z-16/116)/7.787;x*=95.047;y*=100;z*=108.883;x/=100;y/=100;z/=100;let r=x*3.2406+y*-1.5372+z*-0.4986,g=x*-0.9689+y*1.8758+z*0.0415,b=x*0.0557+y*-0.2040+z*1.0570;r=r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;g=g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;b=b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;return[r*255,g*255,b*255]}

    // --- INITIALIZE CORE APP ---
    setupCoreEventListeners();

}); // End DOMContentLoaded
