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
                enhanceBtn.disabled = false;
                canvas.width = imageDisplay.naturalWidth;
                canvas.height = imageDisplay.naturalHeight;
                ctx.drawImage(imageDisplay, 0, 0);
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
    
    console.log("Starting enhancement...");
    
    // Organize the raw pixel data
    const imageData = originalImageData.data;
    const reds = [];
    const greens = [];
    const blues = [];
    
    for (let i = 0; i < imageData.length; i += 4) {
        reds.push(imageData[i]);
        greens.push(imageData[i + 1]);
        blues.push(imageData[i + 2]);
        // We ignore imageData[i + 3], the Alpha channel
    }
    
    console.log("Pixel data organized into R, G, B arrays.");

    // The next steps of the algorithm will go here
});
