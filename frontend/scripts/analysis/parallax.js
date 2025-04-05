(function() {
    let selectedFile = null;
    let isFileUploaded = false;
    let dropZone, mobileUploadButton, desktopUploadButton;

    function initializeElements() {
        dropZone = document.getElementById('dropZone');
        mobileUploadButton = document.querySelector('.mobile-upload-button');
        desktopUploadButton = document.querySelector('.desktop-upload-button');
        
        // Set initial visibility based on screen size
        updateUploadInterface();
    }

    function updateUploadInterface() {
        if (!isFileUploaded) {
            if (window.innerWidth <= 768) {
                if (dropZone) dropZone.style.display = 'none';
                if (mobileUploadButton) mobileUploadButton.style.display = 'inline-block';
                if (desktopUploadButton) desktopUploadButton.style.display = 'none';
            } else {
                if (dropZone) dropZone.style.display = 'flex';
                if (mobileUploadButton) mobileUploadButton.style.display = 'none';
                if (desktopUploadButton) desktopUploadButton.style.display = 'inline-block';
            }
        }
    }

    function setupGoogleSignIn() {
        const signinButton = document.getElementById('signin-button');
        
        if (!signinButton) return;
        
        window.google.accounts.id.initialize({
            client_id: '969099711725-hldrjpjo3le920chng1ethgbbc71vald.apps.googleusercontent.com',
            callback: handleCredentialResponse
        });
        
        window.google.accounts.id.renderButton(
            signinButton,
            { theme: 'outline', size: 'medium' }
        );
        
        window.google.accounts.id.prompt();
    }

    function handleCredentialResponse(response) {
        // Verify the credential with your backend if needed
        console.log('Google Sign-In response:', response);
        
        // Store user info in localStorage
        const userInfo = parseJwt(response.credential);
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('isLoggedIn', 'true');
        
        // Update UI
        updateSignInStatus();
    }

    function parseJwt(token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        return JSON.parse(jsonPayload);
    }

    function updateSignInStatus() {
        const signinButton = document.getElementById('signin-button');
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        if (isLoggedIn) {
            const user = JSON.parse(localStorage.getItem('user'));
            signinButton.innerHTML = `Signed in as ${user.name}`;
            // Remove blur if user is logged in
            const aiSection = document.getElementById('aiAnalysisSection');
            if (aiSection) {
                aiSection.classList.remove('blurred');
            }
        }
    }

    function setupDragDrop() {
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
        
        // Process button click handler
        processButton.addEventListener('click', async function(e) {
            e.stopPropagation();
            if (!fileInput.files.length) {
                alert('Please select a file first');
                return;
            }
            
            processButton.classList.add('processing');
            loadingOverlay.classList.add('active');
            processButton.disabled = true;
            
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
            
            try {
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

        // Drag/drop handlers
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
            handleFiles(dt.files);
        }
        
        fileInput.addEventListener('change', function() {
            if (this.files.length) {
                handleFiles(this.files);
            }
        });
        
        // Clear file selection
        clearFile.addEventListener('click', function(e) {
            e.stopPropagation();
            fileInput.value = '';
            selectedFile = null;
            fileInfo.style.display = 'none';
            processButton.disabled = true;
            isFileUploaded = false;
            updateUploadInterface();
            uploadText.textContent = 'Drag & drop your .txt or .zip file here';
        });
        
        // Single click handler for upload buttons
        if (mobileUploadButton) {
            mobileUploadButton.addEventListener('click', function(e) {
                e.stopPropagation();
                fileInput.click();
            }, false);
        }
        
        if (desktopUploadButton) {
            desktopUploadButton.addEventListener('click', function(e) {
                e.stopPropagation();
                fileInput.click();
            }, false);
        }
    }

    function handleFiles(files) {
        if (!files.length) return;
        
        window.selectedFile = files[0];
        const fileName = document.getElementById('fileName');
        const uploadText = document.getElementById('upload-text');
        const processButton = document.getElementById('processButton');
        const fileInfo = document.getElementById('fileInfo');
        
        fileName.textContent = files[0].name;
        fileInfo.style.display = 'flex';
        uploadText.textContent = 'File selected! Drop another to replace';
        processButton.disabled = false;
        isFileUploaded = true;
        
        // Hide upload interfaces
        if (dropZone) dropZone.style.display = 'none';
        if (mobileUploadButton) mobileUploadButton.style.display = 'none';
        if (desktopUploadButton) desktopUploadButton.style.display = 'none';
        
        if (document.querySelector('.signin-button')?.textContent.includes('Signed in')) {
            processButton.textContent = 'Analyze Chat';
        }
    }

    function setupGuideToggle() {
        const toggle = document.querySelector('.guide-toggle');
        const content = document.querySelector('.guide-content');
    
        if (toggle && content) {
            // Clean click handler
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                this.classList.toggle('active');
                content.classList.toggle('active');
    
                // Force remove any lingering classes
                this.classList.remove('hover', 'active-hover', 'processing');
            });
    
            // Mobile-specific: reset styles after touch
            toggle.addEventListener('touchend', function() {
                setTimeout(() => {
                    this.style.backgroundColor = '';
                    this.style.color = '';
                    this.classList.remove('active'); // Ensure effect doesn't persist
                }, 100);
            });
        }
    }
    

    document.addEventListener('DOMContentLoaded', () => {
        initializeElements();
        setupDragDrop();
        setupGuideToggle();
        updateUploadInterface();
        setupGoogleSignIn();
        updateSignInStatus(); // Check login status on page load
    });

    window.addEventListener('resize', function() {
        updateUploadInterface();
    });
})(); 