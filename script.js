document.addEventListener('DOMContentLoaded', () => {
    // Get all interactive elements
    const imageDisplay = document.getElementById('imageDisplay');
    const imageLoader = document.getElementById('imageLoader');
    const navTabs = document.querySelectorAll('.nav-tab');
    const controlPanels = document.querySelectorAll('.control-panel');
    const headerTitle = document.querySelector('.header-title');
const colorspaceButtons = document.querySelectorAll('.cs-btn');

// --- NEW: Colorspace Selection Logic ---
let selectedColorspace = 'RGB'; // Default colorspace

colorspaceButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        colorspaceButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        button.classList.add('active');
        // Store the selected colorspace
        selectedColorspace = button.dataset.colorspace;
        console.log("Selected Colorspace:", selectedColorspace);
    });
});

    // --- Tab Navigation Logic ---
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs and panels
            navTabs.forEach(t => t.classList.remove('active'));
            controlPanels.forEach(p => p.classList.remove('active'));

            // Activate the clicked tab and its corresponding panel
            tab.classList.add('active');
            const panelId = tab.dataset.panel;
            document.getElementById(panelId).classList.add('active');

            // Update header title
            headerTitle.textContent = tab.textContent;
        });
    });

    // --- Image Loading Logic ---
    // Trigger the hidden file input when the image area is clicked
    imageDisplay.addEventListener('click', () => {
        imageLoader.click();
    });

    imageLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageDisplay.src = e.target.result;
                // We will add logic to enable controls and prepare for editing here
            };
            reader.readAsDataURL(file);
        }
    });

    // We will re-integrate the DStretch and filter logic here
});
