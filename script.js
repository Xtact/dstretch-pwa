document.addEventListener('DOMContentLoaded', () => {
    // --- Get all interactive elements ---
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
    const superResBtn = document.getElementById('super-res-btn');
    const toolStatus = document.getElementById('tool-status');

    // --- State Management ---
    let originalImageSrc = null;
    let history = [];
    let historyIndex = -1;
    let selectedColorspace = 'RGB';
    let debouncedProcess;
    // AI Worker state
    let aiWorker = null;
    let isModelLoading = false;
    let isModelLoaded = false;
    let isImageLoaded = false;

     // --- DEBOUNCE UTILITY ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- HISTORY (UNDO/REDO) ---
    const updateHistory = (dataUrl) => { /* ... unchanged ... */ };
    const updateUndoRedoButtons = () => { /* ... unchanged ... */ };
    const undo = () => { /* ... unchanged ... */ };
    const redo = () => { /* ... unchanged ... */ };

    // --- CORE APP EVENT LISTENERS ---
    const setupCoreEventListeners = () => {
        console.log("Setting up core event listeners...");
        navTabs.forEach(tab => tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            controlPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.panel).classList.add('active');
            if (tab.dataset.panel === 'tools-panel') {
                updateToolStatus();
                // Trigger model loading only when AI tab is first viewed
                if (!isModelLoaded && !isModelLoading && aiWorker) {
                    isModelLoading = true;
                    updateToolStatus();
                    aiWorker.postMessage({ type: 'loadModel' });
                }
            }
        }));

        imageDisplay.addEventListener('click', () => { if (!originalImageSrc) imageLoader.click(); });
        imageLoader.addEventListener('change', handleImageUpload);
        colorspaceButtons.forEach(button => button.addEventListener('click', () => { /* ... unchanged ... */ }));
        debouncedProcess = debounce(processImage, 400);
        allSliders.forEach(slider => { /* ... unchanged ... */ });
        imageDisplay.addEventListener('pointerdown', () => { /* ... unchanged ... */ });
        imageDisplay.addEventListener('pointerup', () => { /* ... unchanged ... */ });
        imageDisplay.addEventListener('pointerleave', () => { /* ... unchanged ... */ });
        downloadBtn.addEventListener('click', downloadImage);
        cancelBtn.addEventListener('click', () => { /* ... unchanged ... */ });
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        superResBtn.addEventListener('click', triggerSuperResolution); // Renamed function
        console.log("Core listeners initialized.");
    };

    function handleImageUpload(event) {
        console.log("handleImageUpload called.");
        // ... (rest of the function is unchanged) ...
        const file = event.target.files[0]; if (!file) return; isImageLoaded = false; toolStatus.textContent = '';
        const reader = new FileReader();
        reader.onload = e => {
            originalImageSrc = e.target.result; history = [originalImageSrc]; historyIndex = 0;
            isImageLoaded = true; imageDisplay.src = originalImageSrc;
            updateUndoRedoButtons(); downloadBtn.disabled = false;
            updateToolStatus(); resetSliders(); console.log("Image loaded.");
        };
        reader.onerror = e => console.error("FileReader error:", e); reader.readAsDataURL(file);
    }

    function resetSliders() { /* ... unchanged ... */ }

    // --- IMAGE PROCESSING ---
    function processImage(isNewHistoryState = false) { /* ... unchanged ... */ }
    function applyAdjustments(pixels) { /* ... unchanged ... */ }
    function runDStretch(imageData) { /* ... unchanged ... */ }
    function performDstretch(c1, c2, c3) { /* ... unchanged ... */ }
    function downloadImage() { /* ... unchanged ... */ }

    // --- AI SUPER RESOLUTION (Worker Communication) ---
    function setupAIWorker() {
        if (window.Worker) {
            console.log("Initializing AI Worker...");
            aiWorker = new Worker('aiWorker.js');

            aiWorker.onmessage = (event) => {
                const { type, payload } = event.data;
                console.log("Main: Received message from worker:", type);

                if (type === 'modelReady') {
                    isModelLoading = false;
                    isModelLoaded = true;
                    updateToolStatus();
                } else if (type === 'modelError') {
                    isModelLoading = false;
                    isModelLoaded = false;
                    toolStatus.textContent = `Error: ${payload}`;
                    superResBtn.disabled = true;
                } else if (type === 'predictionComplete') {
                    handlePredictionResult(payload); // payload = { data, width, height }
                } else if (type === 'predictionError') {
                    toolStatus.textContent = `Error: ${payload}`;
                    enableControlsAfterAI(); // Re-enable controls even on error
                } else if (type === 'error') { // Handle errors from worker setup (e.g., TFJS import failed)
                     isModelLoading = false; isModelLoaded = false;
                     toolStatus.textContent = `Error: ${payload}`;
                     superResBtn.disabled = true;
                }
            };

            aiWorker.onerror = (error) => {
                console.error("Main: Error in AI Worker:", error);
                isModelLoading = false;
                isModelLoaded = false;
                toolStatus.textContent = 'Critical AI Worker Error.';
                superResBtn.disabled = true;
            };

        } else {
            console.error("Web Workers not supported in this browser.");
            toolStatus.textContent = 'AI features require a modern browser.';
            superResBtn.disabled = true;
        }
    }

    function updateToolStatus() {
        const aiTabActive = document.querySelector('.nav-tab[data-panel="tools-panel"]').classList.contains('active');
        const updateText = (text) => { if (toolStatus && aiTabActive) toolStatus.textContent = text; };

        if (!window.Worker) { updateText('AI features not supported by browser.'); if(superResBtn) superResBtn.disabled = true; return; }
        if (!isImageLoaded) { updateText('Upload an image to use AI tools.'); if(superResBtn) superResBtn.disabled = true; }
        else if (isModelLoading) { updateText('Loading AI model... (this can take ~30s)'); if(superResBtn) superResBtn.disabled = true; }
        else if (!isModelLoaded) { updateText('Error: AI model failed to load.'); if(superResBtn) superResBtn.disabled = true; }
        else { updateText('AI Ready. Apply before adjustments for best results.'); if(superResBtn) superResBtn.disabled = false; }
    }

    // Renamed from runSuperResolution to avoid conflict
    function triggerSuperResolution() {
        if (!aiWorker || !isModelLoaded || !isImageLoaded) {
            updateToolStatus(); return;
        }

        toolStatus.textContent = 'Preparing image for AI...';
        superResBtn.disabled = true; disableControlsDuringAI();
        await new Promise(resolve => setTimeout(resolve, 10)); // Allow UI update

        // Get pixel data from the *current* image state on canvas
        const baseImage = new Image();
        baseImage.onload = () => {
            // Ensure canvas matches image size before getting data
            if(canvas.width !== baseImage.naturalWidth || canvas.height !== baseImage.naturalHeight) {
                canvas.width = baseImage.naturalWidth;
                canvas.height = baseImage.naturalHeight;
            }
            ctx.drawImage(baseImage, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Send ImageData's data buffer, width, and height to the worker
            // Note: Sending large data like this copies it, which can be slow.
            // Consider OffscreenCanvas later for optimization if needed.
            aiWorker.postMessage({
                type: 'predict',
                payload: {
                    data: imageData.data,
                    width: imageData.width,
                    height: imageData.height
                }
            });
            toolStatus.textContent = 'Upscaling image in background...';
        };
        baseImage.onerror = () => {
             toolStatus.textContent = 'Error loading current image for AI.';
             enableControlsAfterAI();
        };
        baseImage.src = history[historyIndex]; // Use current history state
    }

    function handlePredictionResult(result) {
        console.log("Main: Handling prediction result");
        const { data, width, height } = result;

        // Create ImageData from the worker's result
        const newImageData = new ImageData(new Uint8ClampedArray(data.buffer), width, height);

        // Update canvas and display
        canvas.width = width;
        canvas.height = height;
        ctx.putImageData(newImageData, 0, 0);

        const finalDataUrl = canvas.toDataURL();
        imageDisplay.src = finalDataUrl;

        // Set upscaled image as the new base and reset history/sliders
        originalImageSrc = finalDataUrl;
        history = [originalImageSrc];
        historyIndex = 0;
        updateUndoRedoButtons();
        resetSliders();

        toolStatus.textContent = 'AI upscaling complete!';
        enableControlsAfterAI();
    }

     function disableControlsDuringAI() {
        allSliders.forEach(s => s.disabled = true);
        colorspaceButtons.forEach(b => b.disabled = true);
        undoBtn.disabled = true;
        redoBtn.disabled = true;
        downloadBtn.disabled = true;
        cancelBtn.disabled = true;
     }

      function enableControlsAfterAI() {
         superResBtn.disabled = false; // Re-enable AI button itself
         allSliders.forEach(s => { if(s.id !== 'sharpen') s.disabled = false; });
         colorspaceButtons.forEach(b => b.disabled = false);
         updateUndoRedoButtons(); // Re-enable based on history state
         downloadBtn.disabled = !isImageLoaded;
         cancelBtn.disabled = !isImageLoaded;
      }

    // --- UTILITY, MATH, AND COLORSPACE FUNCTIONS ---
    // These functions remain unchanged (calculateMean, calculateCovarianceMatrix, etc.)
    // ... (include all the math/color functions from the previous correct version here) ...
    function calculateMean(a){return a.reduce((b,c)=>b+c,0)/a.length}
    function calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3){const n=c1.length;let a=0,b=0,c=0,d=0,e=0,f=0;for(let i=0;i<n;i++){const g=c1[i]-m1,h=c2[i]-m2,j=c3[i]-m3;a+=g*g;b+=h*h;c+=j*j;d+=g*h;e+=g*j;f+=h*j}const k=n-1;return[[a/k,d/k,e/k],[d/k,b/k,f/k],[e/k,f/k,c/k]]}
    function eigenDecomposition(a){if(typeof math==='undefined'){console.error("math.js not loaded");return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}try{const{vectors,values}=math.eigs(a);return{eigenvectors:vectors,eigenvalues:values}}catch(c){console.error("Eigen Decomp Error:",c);return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}}
    function convertRgbTo(r,g,b,cs){switch(cs){case'LAB':return rgbToLab(r,g,b);case'YRE':return[0.299*r+0.587*g+0.114*b,r,g];case'LRE':return[0.2126*r+0.7152*g+0.0722*b,r,g];case'YBK':return[0.299*r+0.587*g+0.114*b,b,255-g];default:return[r,g,b]}}
    function convertToRgb(c1,c2,c3,cs){let r,g,b;try{switch(cs){case'LAB':return labToRgb(c1,c2,c3);case'YRE':r=c2;g=c3;b=(c1-0.587*g-0.299*r)/0.114||0;break;case'LRE':r=c2;g=c3;b=(c1-0.7152*g-0.2126*r)/0.0722||0;break;case'YBK':g=255-c3;b=c2;r=(c1-0.587*g-0.114*b)/0.299||0;break;default:r=c1;g=c2;b=c3;break}}catch(e){console.error("Error converting back to RGB:",e);return[0,0,0]}return[r,g,b];}
    function rgbToLab(r,g,b){r/=255;g/=255;b/=255;r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;let x=(r*0.4124+g*0.3576+b*0.1805)*100,y=(r*0.2126+g*0.7152+b*0.0722)*100,z=(r*0.0193+g*0.1192+b*0.9505)*100;x/=95.047;y/=100;z/=108.883;x=x>0.008856?Math.cbrt(x):7.787*x+16/116;y=y>0.008856?Math.cbrt(y):7.787*y+16/116;z=z>0.008856?Math.cbrt(z):7.787*z+16/116;return[(116*y)-16,500*(x-y),200*(y-z)]}
    function labToRgb(l,a,b_lab){let y=(l+16)/116,x=a/500+y,z=y-b_lab/200;const k=x*x*x,m=y*y*y,n=z*z*z;x=k>0.008856?k:(x-16/116)/7.787;y=m>0.008856?m:(y-16/116)/7.787;z=n>0.008856?n:(z-16/116)/7.787;x*=95.047;y*=100;z*=108.883;x/=100;y/=100;z/=100;let r=x*3.2406+y*-1.5372+z*-0.4986,g=x*-0.9689+y*1.8758+z*0.0415,b=x*0.0557+y*-0.2040+z*1.0570;r=r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;g=g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;b=b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;return[r*255,g*255,b*255]}

    // --- INITIALIZE APP ---
    setupCoreEventListeners(); // Setup basic UI listeners immediately
    setupAIWorker();          // Setup the worker communication channel

}); // End DOMContentLoaded

