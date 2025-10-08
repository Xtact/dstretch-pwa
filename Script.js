// Get the important HTML elements
const imageLoader = document.getElementById('imageLoader');
const imageDisplay = document.getElementById('imageDisplay');
const enhanceBtn = document.getElementById('enhanceBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let originalImageData = null;

// Listen for when a file is chosen
imageLoader.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imageDisplay.src = e.target.result;
            imageDisplay.onload = () => {
                // Once the image is loaded, we can enable the enhance button
                enhanceBtn.disabled = false;
                // Prepare the canvas for processing
                canvas.width = imageDisplay.naturalWidth;
                canvas.height = imageDisplay.naturalHeight;
                ctx.drawImage(imageDisplay, 0, 0);
                // Store the raw pixel data
                originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            };
        };
        reader.readAsDataURL(file);
    }
});

// We'll add the enhancement logic here
enhanceBtn.addEventListener('click', function() {
    if (!originalImageData) {
        alert("Please upload an image first.");
        return;
    }
    
    // --- STEP 1: Get Pixel Data ---
    const imageData = originalImageData.data; // This is a giant array of [R,G,B,A, R,G,B,A, ...]
    
    console.log("Starting enhancement...");
    console.log("Total pixels to process:", imageData.length / 4);

    // The next steps of the algorithm will go here
});
