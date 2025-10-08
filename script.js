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

/**
 * Calculates the average (mean) of an array of numbers.
 * @param {number[]} array The array of numbers.
 * @returns {number} The mean of the array.
 */
function calculateMean(array) {
    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
}

// Logic for the enhancement
enhanceBtn.addEventListener('click', function() {
    if (!originalImageData) {
        alert("Please upload an image first.");
        return;
    }
    
    console.log("Starting enhancement...");
    
    // 1. Organize the raw pixel data
    const imageData = originalImageData.data;
    const reds = [];
    const greens = [];
    const blues = [];
    
    for (let i = 0; i < imageData.length; i += 4) {
        reds.push(imageData[i]);
        greens.push(imageData[i + 1]);
        blues.push(imageData[i + 2]);
    }
    
    console.log("Pixel data organized.");

    // 2. Calculate statistics (Part A: Means)
    const meanRed = calculateMean(reds);
    const meanGreen = calculateMean(greens);
    const meanBlue = calculateMean(blues);

    console.log("Means calculated:", { meanRed, meanGreen, meanBlue });

    // The next steps of the algorithm will go here
});
