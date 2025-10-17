// aiWorker.js

// Import TensorFlow.js library (adjust path if needed, CDN works here)
try {
    importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js');
} catch (e) {
    console.error("Worker: Failed to import TFJS:", e);
    // Send error message back to main thread
    self.postMessage({ type: 'error', payload: 'Failed to load AI library.' });
}

let model = null;
const modelUrl = 'https://tfhub.dev/captain-pool/esrgan-tfjs/1'; // Verified URL

async function loadModel() {
    if (model) {
        return true; // Already loaded
    }
    if (typeof tf === 'undefined') {
        console.error("Worker: TFJS not available.");
        return false;
    }

    try {
        console.log("Worker: Waiting for TFJS backend...");
        await tf.ready(); // Ensure backend is ready
        console.log("Worker: TFJS backend ready. Loading model...");
        model = await tf.loadGraphModel(modelUrl);
        // Warm-up prediction
        tf.tidy(() => {
            model.predict(tf.zeros([1, 64, 64, 3], 'int32')).dispose();
        });
        console.log("Worker: Model loaded successfully.");
        return true;
    } catch (error) {
        console.error("Worker: Error loading model:", error);
        return false;
    }
}

async function runPrediction(imageData) {
    if (!model) {
        throw new Error("Worker: Model not loaded.");
    }

    const { data, width, height } = imageData;

    console.log(`Worker: Received image ${width}x${height} for prediction.`);

    try {
        // Create tensor from raw pixel data
        const inputTensor = tf.tidy(() => {
             // Create tensor directly from Uint8ClampedArray
             return tf.tensor(data, [height, width, 4], 'int32')
                      .slice([0, 0, 0], [height, width, 3]) // Remove alpha channel
                      .expandDims(0); // Add batch dimension
        });
        console.log("Worker: Input tensor created", inputTensor.shape);

        const outputTensor = await model.predict(inputTensor);
        console.log("Worker: Prediction complete", outputTensor.shape);

        // Process output tensor
        const outputImage = await tf.browser.toPixels(outputTensor.squeeze().clipByValue(0, 255).cast('int32'));
        console.log("Worker: Output tensor converted to pixels", outputImage.length);

        tf.dispose([inputTensor, outputTensor]); // Dispose tensors

        const newWidth = width * 2;
        const newHeight = height * 2;

        if (outputImage.length !== newWidth * newHeight * 4) {
            throw new Error(`Worker: Output size mismatch. Expected ${newWidth*newHeight*4}, got ${outputImage.length}`);
        }

        // Return the raw pixel data and dimensions
        return { data: outputImage, width: newWidth, height: newHeight };

    } catch (error) {
        console.error("Worker: Error during prediction:", error);
        throw error; // Re-throw to be caught by the message handler
    }
}


// Listen for messages from the main thread
self.onmessage = async (event) => {
    const { type, payload } = event.data;

    if (type === 'loadModel') {
        const success = await loadModel();
        if (success) {
            self.postMessage({ type: 'modelReady' });
        } else {
            self.postMessage({ type: 'modelError', payload: 'Failed to load model.' });
        }
    } else if (type === 'predict') {
        try {
            const result = await runPrediction(payload); // payload should be { data, width, height }
            self.postMessage({ type: 'predictionComplete', payload: result });
        } catch (error) {
            self.postMessage({ type: 'predictionError', payload: error.message || 'Prediction failed.' });
        }
    }
};

console.log("AI Worker script loaded.");
