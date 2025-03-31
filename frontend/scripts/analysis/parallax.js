(function() {
    let selectedFile = null;

    function setupDragDrop() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const uploadText = document.getElementById('upload-text');
        const clearFile = document.getElementById('clearFile');
        const processButton = document.getElementById('processButton');
        const loadingOverlay = document.createElement('div');
        const regionSelect = document.getElementById('regionSelect');
        
        // Create loading overlay
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Analyzing your chat...</div>
        `;
        document.body.appendChild(loadingOverlay);
        
        if (!dropZone || !fileInput) return;
        
        // Process button click handler – now calls processSelectedFile from fileProcessor.js
        processButton.addEventListener('click', async function() {
            if (!fileInput.files.length) {
                alert('Please select a file first');
                return;
            }
            
            // Show loading state
            processButton.classList.add('processing');
            loadingOverlay.classList.add('active');
            processButton.disabled = true;
            
            // Scroll to results section
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
            
            try {
                // Call the exported function from fileProcessor.js
                await window.processSelectedFile();
            } catch (error) {
                console.error('Error processing file:', error);
                alert('Error processing file. Please try again.');
            } finally {
                processButton.classList.remove('processing');
                loadingOverlay.classList.remove('active');
                processButton.disabled = false;
            }
        });

        // File reader helper and drag/drop handlers for UI feedback
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            dropZone.classList.add('dragover');
        }
        
        function unhighlight() {
            dropZone.classList.remove('dragover');
        }
        
        dropZone.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) {
                handleFiles(files);
            }
        }
        
        fileInput.addEventListener('change', function() {
            if (this.files.length) {
                handleFiles(this.files);
            }
        });
        
        // Clear file selection
        clearFile.addEventListener('click', function() {
            fileInput.value = '';
            selectedFile = null;
            fileInfo.style.display = 'none';
            uploadText.textContent = 'Drag & drop your .txt or .zip file here';
            processButton.disabled = true;
            dropZone.style.display = 'flex';
        });
        
        function handleFiles(files) {
            // Save the file globally so fileProcessor.js can access it.
            window.selectedFile = files[0];
            fileName.textContent = files[0].name;
            fileInfo.style.display = 'flex';
            uploadText.textContent = 'File selected! Drop another to replace';
            processButton.disabled = false;
            dropZone.style.display = 'none';
            
            if (document.querySelector('.signin-button')?.textContent.includes('Signed in')) {
                processButton.textContent = 'Analyze Chat';
            }
        }
        
    }
    
    document.addEventListener('DOMContentLoaded', setupDragDrop);
})();
