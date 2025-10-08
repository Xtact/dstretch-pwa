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

// --- HELPER FUNCTIONS ---

function calculateMean(array) {
    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
}

function calculateCovarianceMatrix(reds, greens, blues, meanRed, meanGreen, meanBlue) {
    const n = reds.length;
    let cov_rr = 0, cov_gg = 0, cov_bb = 0;
    let cov_rg = 0, cov_rb = 0, cov_gb = 0;

    for (let i = 0; i < n; i++) {
        const dR = reds[i] - meanRed;
        const dG = greens[i] - meanGreen;
        const dB = blues[i] - meanBlue;

        cov_rr += dR * dR;
        cov_gg += dG * dG;
        cov_bb += dB * dB;
        cov_rg += dR * dG;
        cov_rb += dR * dB;
        cov_gb += dG * dB;
    }

    const divisor = n - 1;
    return [
        [cov_rr / divisor, cov_rg / divisor, cov_rb / divisor],
        [cov_rg / divisor, cov_gg / divisor, cov_gb / divisor],
        [cov_rb / divisor, cov_gb / divisor, cov_bb / divisor]
    ];
}

function eigenDecomposition(matrix) {
    try {
        const result = math.eigs(matrix);
        return {
            eigenvectors: result.vectors,
            eigenvalues: result.values
        };
    } catch (error) {
        console.error("Error during eigen-decomposition:", error);
        return {
            eigenvectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            eigenvalues: [1, 1, 1]
        };
    }
}

// --- MAIN ENHANCEMENT LOGIC ---

enhanceBtn.addEventListener('click', function() {
    if (!originalImageData) {
        alert("Please upload an image first.");
        return;
    }
    
    console.log("Starting enhancement...");
    
    // 1. Organize the raw pixel data
    const imageData = originalImageData.data;
    const reds = [], greens = [], blues = [];
    for (let i = 0; i < imageData.length; i += 4) {
        reds.push(imageData[i]);
        greens.push(imageData[i + 1]);
        blues.push(imageData[i + 2]);
    }
    
    // 2. Calculate statistics
    const meanRed = calculateMean(reds);
    const meanGreen = calculateMean(greens);
    const meanBlue = calculateMean(blues);
    const covarianceMatrix = calculateCovarianceMatrix(reds, greens, blues, meanRed, meanGreen, meanBlue);

    // 3. Perform the Transformation (Eigen-decomposition)
    const { eigenvectors, eigenvalues } = eigenDecomposition(covarianceMatrix);

    // 4. Apply the Stretch to every pixel
    const newPixelData = new Uint8ClampedArray(imageData.length);
    const stretchAmount = 50.0; // Target standard deviation, can be a user setting later

    for (let i = 0; i < reds.length; i++) {
        const r = reds[i] - meanRed;
        const g = greens[i] - meanGreen;
        const b = blues[i] - meanBlue;

        // Project pixel onto eigenvectors
        let p1 = r * eigenvectors[0][0] + g * eigenvectors[1][0] + b * eigenvectors[2][0];
        let p2 = r * eigenvectors[0][1] + g * eigenvectors[1][1] + b * eigenvectors[2][1];
        let p3 = r * eigenvectors[0][2] + g * eigenvectors[1][2] + b * eigenvectors[2][2];

        // Stretch the projected values
        p1 *= (stretchAmount / Math.sqrt(eigenvalues[0]));
        p2 *= (stretchAmount / Math.sqrt(eigenvalues[1]));
        p3 *= (stretchAmount / Math.sqrt(eigenvalues[2]));

        // Rotate back to RGB coordinate system
        const newR = p1 * eigenvectors[0][0] + p2 * eigenvectors[0][1] + p3 * eigenvectors[0][2] + meanRed;
        const newG = p1 * eigenvectors[1][0] + p2 * eigenvectors[1][1] + p3 * eigenvectors[1][2] + meanGreen;
        const newB = p1 * eigenvectors[2][0] + p2 * eigenvectors[2][1] + p3 * eigenvectors[2][2] + meanBlue;

        const pixelIndex = i * 4;
        newPixelData[pixelIndex] = newR;     // Red
        newPixelData[pixelIndex + 1] = newG; // Green
        newPixelData[pixelIndex + 2] = newB; // Blue
        newPixelData[pixelIndex + 3] = 255;  // Alpha (fully opaque)
    }

    // 5. Display the Result
    const newImageData = new ImageData(newPixelData, canvas.width, canvas.height);
    ctx.putImageData(newImageData, 0, 0);
    imageDisplay.src = canvas.toDataURL(); // Update the visible image
    
    console.log("Enhancement complete.");
});
