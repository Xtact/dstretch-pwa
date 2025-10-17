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
    let tfReady = false; // Track if TF.js core is ready

    // --- DEBOUNCE UTILITY ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- HISTORY (UNDO/REDO) ---
    const updateHistory = (dataUrl) => {
        if (history.length > 0 && history[historyIndex] === dataUrl) return;
        history.splice(historyIndex + 1); history.push(dataUrl); historyIndex++;
        updateUndoRedoButtons();
    };
    const updateUndoRedoButtons = () => {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex === history.length - 1;
    };
    const undo = () => { if (historyIndex > 0) { historyIndex--; imageDisplay.src = history[historyIndex]; updateUndoRedoButtons(); } };
    const redo = () => { if (historyIndex < history.length - 1) { historyIndex++; imageDisplay.src = history[historyIndex]; updateUndoRedoButtons(); } };

    // --- CORE APP EVENT LISTENERS ---
    const setupCoreEventListeners = () => {
        console.log("Setting up core event listeners...");
        navTabs.forEach(tab => tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            controlPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.panel).classList.add('active');
            if (tab.dataset.panel === 'tools-panel') updateToolStatus();
        }));

        imageDisplay.addEventListener('click', () => { if (!originalImageSrc) imageLoader.click(); });
        imageLoader.addEventListener('change', handleImageUpload);

        colorspaceButtons.forEach(button => button.addEventListener('click', () => {
            colorspaceButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active'); selectedColorspace = button.dataset.colorspace;
            if (originalImageSrc) debouncedProcess(true);
        }));

        debouncedProcess = debounce(processImage, 400);
        allSliders.forEach(slider => {
            if (slider.id !== 'sharpen') {
                 slider.addEventListener('input', () => { if (originalImageSrc) debouncedProcess(false); });
                 slider.addEventListener('change', () => { if (originalImageSrc) setTimeout(() => updateHistory(imageDisplay.src), 50); });
            }
        });

        imageDisplay.addEventListener('pointerdown', () => { if (originalImageSrc && history.length > 0) imageDisplay.src = originalImageSrc; });
        imageDisplay.addEventListener('pointerup', () => { if (originalImageSrc && history.length > 0) imageDisplay.src = history[historyIndex]; });
        imageDisplay.addEventListener('pointerleave', () => { if (originalImageSrc && history.length > 0) imageDisplay.src = history[historyIndex]; });

        downloadBtn.addEventListener('click', downloadImage);
        cancelBtn.addEventListener('click', () => {
             if (!originalImageSrc) return;
             history = [originalImageSrc]; historyIndex = 0; imageDisplay.src = originalImageSrc;
             updateUndoRedoButtons(); resetSliders();
        });
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        superResBtn.addEventListener('click', runSuperResolution);
        console.log("Core listeners initialized.");
    };

    function handleImageUpload(event) {
        console.log("handleImageUpload triggered.");
        const file = event.target.files[0]; if (!file) return;
        isImageLoaded = false; toolStatus.textContent = '';
        const reader = new FileReader();
        reader.onload = e => {
            originalImageSrc = e.target.result; history = [originalImageSrc]; historyIndex = 0;
            isImageLoaded = true; imageDisplay.src = originalImageSrc;
            updateUndoRedoButtons(); downloadBtn.disabled = false;
            updateToolStatus(); resetSliders();
            console.log("Image loaded.");
        };
        reader.onerror = e => console.error("FileReader error:", e);
        reader.readAsDataURL(file);
    }

    function resetSliders() {
        allSliders.forEach(slider => { slider.value = slider.defaultValue || (slider.id === 'stretch' ? 50 : 0); });
    }

    // --- IMAGE PROCESSING ---
    function processImage(isNewHistoryState = false) {
        if (!originalImageSrc || !isImageLoaded) return;
        // console.log("Processing image..."); // Keep console less noisy during slider drag
        const baseImage = new Image();
        baseImage.onload = () => {
            if (canvas.width !== baseImage.naturalWidth || canvas.height !== baseImage.naturalHeight) {
                canvas.width = baseImage.naturalWidth; canvas.height = baseImage.naturalHeight;
            }
            ctx.drawImage(baseImage, 0, 0);
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let pixels = imageData.data;
            try {
                applyAdjustments(pixels);
                const finalPixelData = runDStretch(pixels);
                imageData.data.set(finalPixelData);
            } catch (error) { console.error("Error processing:", error); ctx.drawImage(baseImage, 0, 0); imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
            ctx.putImageData(imageData, 0, 0);
            const finalDataUrl = canvas.toDataURL(); imageDisplay.src = finalDataUrl;
            if (isNewHistoryState) updateHistory(finalDataUrl);
            else { if (history.length > 0) history[historyIndex] = finalDataUrl; else { history = [finalDataUrl]; historyIndex = 0; } updateUndoRedoButtons(); }
            // console.log("Processing complete.");
        };
        baseImage.onerror = () => console.error("Error loading image for processing.");
        baseImage.src = originalImageSrc;
    }

    function applyAdjustments(pixels) {
        // ... (This function remains unchanged) ...
        const exposure = parseFloat(document.getElementById('exposure').value);
        const shadows = parseFloat(document.getElementById('shadows').value);
        const brightness = parseFloat(document.getElementById('brightness').value);
        const contrast = parseFloat(document.getElementById('contrast').value);
        const blackPoint = parseFloat(document.getElementById('blackPoint').value) / 100;
        const saturation = parseFloat(document.getElementById('saturation').value);

        const contrastFactor = contrast === 0 ? 1 : (259 * (contrast + 255)) / (255 * (259 - contrast));
        const satFactor = saturation / 100;
        const totalBrightness = exposure + brightness;

        for (let i = 0; i < pixels.length; i += 4) {
            let r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            r += totalBrightness; g += totalBrightness; b += totalBrightness;
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luma < 128) { const shadowFactor = shadows * (1 - luma / 128); r += shadowFactor; g += shadowFactor; b += shadowFactor; }
            if (contrast !== 0) { r = contrastFactor * (r - 128) + 128; g = contrastFactor * (g - 128) + 128; b = contrastFactor * (b - 128) + 128; }
            r = Math.max(r, 255 * blackPoint); g = Math.max(g, 255 * blackPoint); b = Math.max(b, 255 * blackPoint);
            if (satFactor !== 0) { const avg = (r + g + b) / 3; r = avg + (r - avg) * (1 + satFactor); g = avg + (g - avg) * (1 + satFactor); b = avg + (b - avg) * (1 + satFactor); }
            pixels[i]   = Math.max(0, Math.min(255, r)); pixels[i+1] = Math.max(0, Math.min(255, g)); pixels[i+2] = Math.max(0, Math.min(255, b));
        }
    }

    function runDStretch(imageData) {
       // ... (This function remains unchanged) ...
        const nPixels = imageData.length / 4; let c1=[],c2=[],c3=[];
        for(let i=0;i<nPixels;i++){const r=imageData[i*4],g=imageData[i*4+1],b=imageData[i*4+2];const cv=convertRgbTo(r,g,b,selectedColorspace);c1.push(cv[0]);c2.push(cv[1]);c3.push(cv[2])}
        const{stretchedC1,stretchedC2,stretchedC3}=performDstretch(c1,c2,c3);
        const finalPixelData=new Uint8ClampedArray(imageData.length);
        for(let i=0;i<nPixels;i++){const rgb=convertToRgb(stretchedC1[i],stretchedC2[i],stretchedC3[i],selectedColorspace);const idx=i*4;finalPixelData[idx]=Math.max(0,Math.min(255,rgb[0]));finalPixelData[idx+1]=Math.max(0,Math.min(255,rgb[1]));finalPixelData[idx+2]=Math.max(0,Math.min(255,rgb[2]));finalPixelData[idx+3]=255}return finalPixelData
    }

    function performDstretch(c1, c2, c3) {
       // ... (This function remains unchanged) ...
        const m1=calculateMean(c1),m2=calculateMean(c2),m3=calculateMean(c3);const cov=calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3);const{eigenvectors:ev,eigenvalues:ew}=eigenDecomposition(cov);
        const sa=stretchSlider.value;let sC1=[],sC2=[],sC3=[];
        for(let i=0;i<c1.length;i++){const v1=c1[i]-m1,v2=c2[i]-m2,v3=c3[i]-m3;let p1=v1*ev[0][0]+v2*ev[1][0]+v3*ev[2][0],p2=v1*ev[0][1]+v2*ev[1][1]+v3*ev[2][1],p3=v1*ev[0][2]+v2*ev[1][2]+v3*ev[2][2];
        const sc1=sa/Math.sqrt(Math.max(1e-6,ew[0])),sc2=sa/Math.sqrt(Math.max(1e-6,ew[1])),sc3=sa/Math.sqrt(Math.max(1e-6,ew[2]));
        p1*=sc1;p2*=sc2;p3*=sc3;
        sC1[i]=p1*ev[0][0]+p2*ev[0][1]+p3*ev[0][2]+m1;sC2[i]=p1*ev[1][0]+p2*ev[1][1]+p3*ev[1][2]+m2;sC3[i]=p1*ev[2][0]+p2*ev[2][1]+p3*ev[2][2]+m3}return{stretchedC1:sC1,stretchedC2:sC2,stretchedC3:sC3}
    }

    function downloadImage() {
        if (!history[historyIndex]) return; const link=document.createElement('a');link.download='DstretchPro_Image.png';link.href=history[historyIndex];link.click();
    }

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

    async function loadSuperResModel() {
        if (!tfReady || isModelLoaded || isModelLoading) return; // Exit if TF not ready or already loaded/loading

        isModelLoading = true; updateToolStatus();
        console.log("Attempting to load AI model...");
        try {
            const modelUrl = 'https://tfhub.dev/captain-pool/esrgan-tfjs/1';
            superResModel = await tf.loadGraphModel(modelUrl);
            // Warm-up prediction to potentially speed up the first real run
            tf.tidy(() => { superResModel.predict(tf.zeros([1, 64, 64, 3], 'int32')).dispose(); });
            isModelLoaded = true;
            console.log("AI Model Loaded Successfully");
        } catch (e) { console.error('Failed to load AI model:', e); isModelLoaded = false; }
        finally { isModelLoading = false; updateToolStatus(); }
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
    function calculateMean(a){return a.reduce((b,c)=>b+c,0)/a.length}
    function calculateCovarianceMatrix(c1,c2,c3,m1,m2,m3){const n=c1.length;let a=0,b=0,c=0,d=0,e=0,f=0;for(let i=0;i<n;i++){const g=c1[i]-m1,h=c2[i]-m2,j=c3[i]-m3;a+=g*g;b+=h*h;c+=j*j;d+=g*h;e+=g*j;f+=h*j}const k=n-1;return[[a/k,d/k,e/k],[d/k,b/k,f/k],[e/k,f/k,c/k]]}
    function eigenDecomposition(a){if(typeof math==='undefined'){console.error("math.js not loaded");return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}try{const{vectors,values}=math.eigs(a);return{eigenvectors:vectors,eigenvalues:values}}catch(c){console.error("Eigen Decomp Error:",c);return{eigenvectors:[[1,0,0],[0,1,0],[0,0,1]],eigenvalues:[1,1,1]}}}
    function convertRgbTo(r,g,b,cs){switch(cs){case'LAB':return rgbToLab(r,g,b);case'YRE':return[0.299*r+0.587*g+0.114*b,r,g];case'LRE':return[0.2126*r+0.7152*g+0.0722*b,r,g];case'YBK':return[0.299*r+0.587*g+0.114*b,b,255-g];default:return[r,g,b]}}
    function convertToRgb(c1,c2,c3,cs){let r,g,b;try{switch(cs){case'LAB':return labToRgb(c1,c2,c3);case'YRE':r=c2;g=c3;b=(c1-0.587*g-0.299*r)/0.114||0;break;case'LRE':r=c2;g=c3;b=(c1-0.7152*g-0.2126*r)/0.0722||0;break;case'YBK':g=255-c3;b=c2;r=(c1-0.587*g-0.114*b)/0.299||0;break;default:r=c1;g=c2;b=c3;break}}catch(e){console.error("Error converting back to RGB:",e);return[0,0,0]}return[r,g,b];}
    function rgbToLab(r,g,b){r/=255;g/=255;b/=255;r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;let x=(r*0.4124+g*0.3576+b*0.1805)*100,y=(r*0.2126+g*0.7152+b*0.0722)*100,z=(r*0.0193+g*0.1192+b*0.9505)*100;x/=95.047;y/=100;z/=108.883;x=x>0.008856?Math.cbrt(x):7.787*x+16/116;y=y>0.008856?Math.cbrt(y):7.787*y+16/116;z=z>0.008856?Math.cbrt(z):7.787*z+16/116;return[(116*y)-16,500*(x-y),200*(y-z)]}
    function labToRgb(l,a,b_lab){let y=(l+16)/116,x=a/500+y,z=y-b_lab/200;const k=x*x*x,m=y*y*y,n=z*z*z;x=k>0.008856?k:(x-16/116)/7.787;y=m>0.008856?m:(y-16/116)/7.787;z=n>0.008856?n:(z-16/116)/7.787;x*=95.047;y*=100;z*=108.883;x/=100;y/=100;z/=100;let r=x*3.2406+y*-1.5372+z*-0.4986,g=x*-0.9689+y*1.8758+z*0.0415,b=x*0.0557+y*-0.2040+z*1.0570;r=r>0.0031308?1.055*Math.pow(r,1/2.4)-0.055:12.92*r;g=g>0.0031308?1.055*Math.pow(g,1/2.4)-0.055:12.92*g;b=b>0.0031308?1.055*Math.pow(b,1/2.4)-0.055:12.92*b;return[r*255,g*255,b*255]}

    // --- INITIALIZE ---
    // Setup core listeners first
    setupCoreEventListeners();

    // Then, asynchronously check for TF and load the model
    const checkTfAndLoadModel = async () => {
        if (typeof tf !== 'undefined') {
            tfReady = true;
            console.log("TensorFlow.js is ready.");
            await loadSuperResModel(); // Load model now that TF is confirmed ready
        } else {
            console.log("Waiting for TensorFlow.js...");
            setTimeout(checkTfAndLoadModel, 200); // Check again shortly
        }
    };

    // Timeout for TFJS loading check
    const tfLoadCheckTimeout = setTimeout(() => {
        if (!tfReady) {
            console.error("TensorFlow.js did not load within 15 seconds.");
            tfReady = false; // Explicitly set to false
            updateToolStatus(); // Update status to show error
        }
    }, 15000); // 15 second timeout

    // Start the TF check and AI model loading process
    checkTfAndLoadModel();


}); // End DOMContentLoaded
