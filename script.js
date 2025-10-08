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
// ... (previous code from the last step remains the same)

/**
 * Calculates the average (mean) of an array of numbers.
 * @param {number[]} array The array of numbers.
 * @returns {number} The mean of the array.
 */
function calculateMean(array) {
    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
}

/**
 * Calculates the 3x3 covariance matrix for the R, G, B channels.
 * @param {number[]} reds Array of red values.
 * @param {number[]} greens Array of green values.
 * @param {number[]} blues Array of blue values.
 * @param {number} meanRed Mean of the red channel.
 * @param {number} meanGreen Mean of the green channel.
 * @param {number} meanBlue Mean of the blue channel.
 * @returns {number[][]} A 3x3 covariance matrix.
 */
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

    // Finalize the covariance values
    cov_rr /= (n - 1);
    cov_gg /= (n - 1);
    cov_bb /= (n - 1);
    cov_rg /= (n - 1);
    cov_rb /= (n - 1);
    cov_gb /= (n - 1);

    return [
        [cov_rr, cov_rg, cov_rb],
        [cov_rg, cov_gg, cov_gb], // cov_rg is the same as cov_gr
        [cov_rb, cov_gb, cov_bb]  // cov_rb is the same as cov_br, etc.
    ];
}

// Logic for the enhancement
enhanceBtn.addEventListener('click', function() {
    // ... (code to organize pixels and calculate means)

    // 2. Calculate statistics (Part B: Covariance Matrix)
    const covarianceMatrix = calculateCovarianceMatrix(reds, greens, blues, meanRed, meanGreen, meanBlue);

    console.log("Covariance Matrix calculated:", covarianceMatrix);

    // The next steps of the algorithm will go here
});// ... (all the previous code remains the same)

/**
 * Calculates the 3x3 covariance matrix for the R, G, B channels.
// ... (previous function)
 */
function calculateCovarianceMatrix(reds, greens, blues, meanRed, meanGreen, meanBlue) {
    // ... (function content is the same)
}

/**
 * Performs eigen-decomposition on a matrix.
 * @param {number[][]} matrix The matrix to decompose.
 * @returns {object} An object containing eigenvectors and eigenvalues.
 */
function eigenDecomposition(matrix) {
    try {
        const result = math.eigs(matrix);
        // The library returns eigenvectors as columns, so we can use them directly.
        return {
            eigenvectors: result.vectors,
            eigenvalues: result.values
        };
    } catch (error) {
        console.error("Error during eigen-decomposition:", error);
        // Return a default "identity" matrix if the calculation fails
        return {
            eigenvectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            eigenvalues: [1, 1, 1]
        };
    }
}


// Logic for the enhancement
enhanceBtn.addEventListener('click', function() {
    // ... (code to organize pixels, calculate means, and calculate covariance matrix)

    // 3. Perform the Transformation (Eigen-decomposition)
    const { eigenvectors, eigenvalues } of eigenDecomposition(covarianceMatrix);

    console.log("Eigenvectors:", eigenvectors);
    console.log("Eigenvalues:", eigenvalues);

    // The final steps of applying the stretch will go here
});

