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
    let superResModel = null;
    let isModelLoading = false;
    let isModelLoaded = false;
    let isImageLoaded = false;
    let tfReady = false; // Track TF readiness

    // --- DEBOUNCE UTILITY ---
    const debounce = (func, delay) => { /* ... unchanged ... */ };

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
            // If AI tab is clicked, *attempt* to load model if not already done
            if (tab.dataset.panel === 'tools-panel') {
                 updateToolStatus(); // Show initial status
                 if (!isModelLoaded && !isModelLoading) {
                     loadSuperResModel(); // Trigger loading on demand
                 }
            }
        }));

        if (imageDisplay && imageLoader) {
            imageDisplay.addEventListener('click', () => { if (!originalImageSrc) imageLoader.click(); });
            imageLoader.addEventListener('change', handleImageUpload);
            console.log("Upload listeners attached.");
        } else { console.error("Image display or loader element not found!"); return; }

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
        superResBtn.addEventListener('click', runSuperResolution);
        console.log("Core listeners initialized.");
    };

    function handleImageUpload(event) {
        // ... (function remains unchanged) ...
        console.log("handleImageUpload called.");
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
    function processImage(isNewHistoryState = false) { /* ... unchanged ... */ }
    function applyAdjustments(pixels) { /* ... unchanged ... */ }
    function runDStretch(imageData) { /* ... unchanged ... */ }
    function performDstretch(c1, c2, c3) { /* ... unchanged ... */ }
    function downloadImage() { /* ... unchanged ... */ }

    // --- AI SUPER RESOLUTION ---
    function updateToolStatus() {
        const aiTabActive = document.querySelector('.nav-tab[data-panel="tools-panel"]').classList.contains('active');
        const updateText = (text) => { if (toolStatus && aiTabActive) toolStatus.textContent = text; };

        if (!isImageLoaded) { updateText('Upload an image to use AI tools.'); if (superResBtn) superResBtn.disabled = true; }
        else if (!tfReady) { updateText('Error: AI library failed to load.'); if (superResBtn) superResBtn.disabled = true; }
        else if (isModelLoading) { updateText('Loading AI model... (this can take ~30s)'); if (superResBtn) superResBtn.disabled = true; }
        else if (!isModelLoaded) { updateText('Error: AI model failed to load.'); if (superResBtn) superResBtn.disabled = true; }
        else { updateText('AI Ready. Apply before adjustments for best results.'); if (superResBtn) superResBtn.disabled = false; }
    }

    // Load model on demand, ensuring TF is ready first
    async function loadSuperResModel() {
        if (isModelLoaded || isModelLoading) return; // Don't reload if already loaded/loading

        isModelLoading = true;
        updateToolStatus();
        console.log("Attempting to load AI model...");

        try {
            // Ensure tf object is available and ready
            if (typeof tf === 'undefined') throw new Error("TensorFlow library not loaded.");
            await tf.ready(); // Explicitly wait for TF backend
            console.log("TensorFlow backend ready.");

            // Use a potentially more stable TF Hub URL format
            const modelUrl = 'https://tfhub.dev/captain-pool/esrgan-tfjs/1'; // Double-checked URL
            superResModel = await tf.loadGraphModel(modelUrl, { fromTFHub: true }); // Specify source
            console.log("Model fetched, warming up...");

            // Warm-up prediction
            tf.tidy(() => {
                superResModel.predict(tf.zeros([1, 64, 64, 3], 'int32')).dispose();
            });

            isModelLoaded = true;
            console.log("AI Model Loaded Successfully");
        } catch (e) {
            console.error('Failed to load or initialize AI model:', e);
            isModelLoaded = false;
        } finally {
            isModelLoading = false;
            updateToolStatus(); // Update status after attempt
        }
    }

    async function runSuperResolution() {
        if (!superResModel || !isImageLoaded) { updateToolStatus(); return; }
        toolStatus.textContent = 'Upscaling image... (this may take a moment)';
        superResBtn.disabled = true; allSliders.forEach(s => s.disabled = true); colorspaceButtons.forEach(b => b.disabled = true);
        await new Promise(resolve => setTimeout(resolve, 10));

        const baseImage = new Image();
        baseImage.onload = async () => {
            const currentWidth = baseImage.naturalWidth, currentHeight = baseImage.naturalHeight;
            const tempCanvas = document.createElement('canvas'); tempCanvas.width = currentWidth; tempCanvas.height = currentHeight;
            const tempCtx = tempCanvas.getContext('2d'); tempCtx.drawImage(baseImage, 0, 0);
            console.log(`Input size: ${currentWidth}x${currentHeight}`);
            try {
                const inputTensor = tf.browser.fromPixels(tempCanvas).expandDims(0).cast('int32');
                const outputTensor = await superResModel.predict(inputTensor);
                const outputImage = await tf.browser.toPixels(outputTensor.squeeze().clipByValue(0, 255).cast('int32'));
                tf.dispose([inputTensor, outputTensor]);
                const newWidth = currentWidth * 2, newHeight = currentHeight * 2;
                 if (outputImage.length !== newWidth * newHeight * 4) throw new Error(`AI output size mismatch`);
                console.log(`Output size: ${newWidth}x${newHeight}`);
                canvas.width = newWidth; canvas.height = newHeight;
                const newImageData = new ImageData(outputImage, newWidth, newHeight); ctx.putImageData(newImageData, 0, 0);
                const finalDataUrl = canvas.toDataURL(); imageDisplay.src = finalDataUrl;
                originalImageSrc = finalDataUrl; history = [originalImageSrc]; historyIndex = 0;
                updateUndoRedoButtons(); resetSliders();
                toolStatus.textContent = 'AI upscaling complete!';
            } catch (e) { console.error('Error during AI prediction:', e); toolStatus.textContent = 'Error running AI. Image may be too large or invalid.'; }
            finally {
                 superResBtn.disabled = false;
                 allSliders.forEach(s => { if(s.id !== 'sharpen') s.disabled = false; });
                 colorspaceButtons.forEach(b => b.disabled = false);
            }
        };
        baseImage.src = history[historyIndex];
    }


    // --- UTILITY, MATH, AND COLORSPACE FUNCTIONS (minified) ---
    // These functions remain unchanged
    function calculateMean(a){return a.reduce((b,c)=>b+c,0)/a.length}
    function calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3){const n=c1.length;let a=0,b=0,c=0,d=0,e=0,f=0;for(let i=0;i<n;i++){const g=c1[i]-m1,h=c2[i]-m2,j=c3[i]-m3;a+=g*g;b+=h*h;c+=j*j;d+=g*h;e+=g*j;f+=h*j}const k=n-1;return[[a/k,d/k,e/k],[d/k,b/k,f/k],[e/k,f/k,c/k]]}
    function eigenDecomposition(a){if(typeof math==='undefined'){console.error("math.js not loaded");return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}try{const{vectors,values}=math.eigs(a);return{eigenvectors:vectors,eigenvalues:values}}catch(c){console.error("Eigen Decomp Error:",c);return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}}
    function convertRgbTo(r,g,b,cs){switch(cs){case'LAB':return rgbToLab(r,g,b);case'YRE':return[0.299*r+0.587*g+0.114*b,r,g];case'LRE':return[0.2126*r+0.7152*g+0.0722*b,r,g];case'YBK':return[0.299*r+0.587*g+0.114*b,b,255-g];default:return[r,g,b]}}
    function convertToRgb(c1,c2,c3,cs){let r,g,b;try{switch(cs){case'LAB':return labToRgb(c1,c2,c3);case'YRE':r=c2;g=c3;b=(c1-0.587*g-0.299*r)/0.114||0;break;case'LRE':r=c2;g=c3;b=(c1-0.7152*g-0.2126*r)/0.0722||0;break;case'YBK':g=255-c3;b=c2;r=(c1-0.587*g-0.114*b)/0.299||0;break;default:r=c1;g=c2;b=c3;break}}catch(e){console.error("Error converting back to RGB:",e);return[0,0,0]}return[r,g,b];}
    function rgbToLab(r,g,b){r/=255;g/=255;b/=255;r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;let x=(r*0.4124+g*0.3576+b*0.1805)*100,y=(r*0.2126+g*0.7152+b*0.0722)*100,z=(r*0.0193+g*0.1192+b*0.9505)*100;x/=95.047;y/=100;z/=108.883;x=x>0.008856?Math.cbrt(x):7.787*x+16/116;y=y>0.008856?Math.cbrt(y):7.787*y+16/116;z=z>0.008856?Math.cbrt(z):7.787*z+16/116;return[(116*y)-16,500*(x-y),200*(y-z)]}
    function labToRgb(l,a,b_lab){let y=(l+16)/116,x=a/500+y,z=y-b_lab/200;const k=x*x*x,m=y*y*y,n=z*z*z;x=k>0.008856?k:(x-16/116)/7.787;y=m>0.008856?m:(y-16/116)/7.787;z=n>0.008856?n:(z-16/116)/7.787;x*=95.047;y*=100;z*=108.883;x/=100;y/=100;z/=100;let r=x*3.2406+y*-1.5372+z*-0.4986,g=x*-0.9689+y*1.8758+z*0.0415,b=x*0.0557+y*-0.2040+z*1.0570;r=r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;g=g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;b=b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;return[r*255,g*255,b*255]}

    // --- TFJS READY CHECK AND INITIALIZATION ---
    const checkTfReadyAndInit = async () => {
        if (typeof tf !== 'undefined') {
            try {
                await tf.ready(); // Explicitly wait for backend initialization
                tfReady = true;
                console.log("TensorFlow.js backend is ready.");
                setupCoreEventListeners(); // Setup basic listeners
                loadSuperResModel();     // Trigger AI model loading
            } catch (error) {
                console.error("TensorFlow.js backend failed to initialize:", error);
                tfReady = false;
                setupCoreEventListeners(); // Setup core listeners anyway
                updateToolStatus(); // Show error status for AI
            }
        } else {
            console.log("Waiting for TensorFlow.js script...");
            setTimeout(checkTfReadyAndInit, 100); // Check again shortly
        }
    };

    // Timeout for TFJS loading check
    const tfLoadCheckTimeout = setTimeout(() => {
        if (!tfReady) {
            console.error("TensorFlow.js did not load within 15 seconds.");
            tfReady = false;
            updateToolStatus();
            // Still initialize core functions if timeout occurs
            if(!document.getElementById('imageLoader').hasAttribute('listenerAttached')) { // Prevent double init
                setupCoreEventListeners();
                document.getElementById('imageLoader').setAttribute('listenerAttached', 'true');
            }
        }
    }, 15000); // 15 second timeout

    // Start the check
    checkTfReadyAndInit();

}); // End DOMContentLoaded
