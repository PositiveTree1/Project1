window.skipSavedPopup = false;
// parallax.js
(function() {
    let dropZone, mobileUploadButton, desktopUploadButton;
    let isFileUploaded = false;
    let consentPopup, agreeConsentBtn, declineConsentBtn;

    function initializeElements() {
        dropZone = document.getElementById('dropZone');
        mobileUploadButton = document.querySelector('.mobile-upload-button');
        desktopUploadButton = document.querySelector('.desktop-upload-button');
        consentPopup = document.getElementById('consentPopup');
        agreeConsentBtn = document.getElementById('agreeConsent');
        declineConsentBtn = document.getElementById('declineConsent');

        // Initially hide or show based on whether a file is already "uploaded"
        updateUploadInterface();
    }

    async function checkConsent(userId) {
        try {
            const response = await fetch(`/api/check-consent/${userId}`);
            if (!response.ok) throw new Error('Failed to check consent');
            const data = await response.json();
            return data.hasConsented || false;
        } catch (error) {
            console.error('Error checking consent:', error);
            return false;
        }
    }

    async function saveConsent(userId, consented) {
        try {
            const response = await fetch('/api/save-consent', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({userId, consented})
            });
            return response.ok;
        } catch (error) {
            console.error('Error saving consent:', error);
            return false;
        }
    }

    function showConsentPopup() {
        if (consentPopup) {
            consentPopup.classList.remove('hidden');
        }
    }

    function hideConsentPopup() {
        if (consentPopup) {
            consentPopup.classList.add('hidden');
        }
    }

    function startProcessing() {
        const processButton = document.getElementById('processButton');
        const loadingOverlay = document.querySelector('.loading-overlay');
        
        processButton.classList.add('processing');
        loadingOverlay.classList.add('active');
        processButton.disabled = true;

        const resultsSection = document.getElementById('results');
        if (resultsSection) resultsSection.scrollIntoView({behavior: 'smooth'});
    }

    function endProcessing() {
        const processButton = document.getElementById('processButton');
        const loadingOverlay = document.querySelector('.loading-overlay');
        
        processButton.classList.remove('processing');
        loadingOverlay.classList.remove('active');
        processButton.disabled = false;
    }

    async function processFile(useAI = false) {
        try {
            startProcessing();
            // Set AI mode before processing
            window.useAIForProcessing = useAI;
            await window.processSelectedFile();
        } catch (error) {
            console.error('Error processing file:', error);
        } finally {
            endProcessing();
        }
    }

    function setupConsentButtons() {
        if (agreeConsentBtn && declineConsentBtn) {
            agreeConsentBtn.addEventListener('click', async () => {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                if (user.sub) {
                    await saveConsent(user.sub, true);
                    hideConsentPopup();
                    await processFile(true); // Process with AI
                }
            });

            declineConsentBtn.addEventListener('click', async () => {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                if (user.sub) {
                    await saveConsent(user.sub, false);
                    hideConsentPopup();
                }
            });
        }
    }

    function updateUploadInterface() {
        // If no file has been uploaded yet, show the drop zone (or upload buttons on mobile) 
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

    function setupDragDrop() {
        const fileInput = document.getElementById('fileInput');
        const fileInfo   = document.getElementById('fileInfo');
        const fileName   = document.getElementById('fileName');
        const uploadText = document.getElementById('upload-text');
        const clearFile  = document.getElementById('clearFile');
        const processButton = document.getElementById('processButton');
        const aiToggleContainer = document.getElementById('aiToggleContainer');

        // Create (and hide) a loading overlay for “analysis in progress”
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Analyzing your chat...</div>
        `;
        document.body.appendChild(loadingOverlay);

        if (!dropZone || !fileInput) return;

        // 1) Whenever “Process” is clicked, show spinner, then call window.processSelectedFile()
        // Replace the existing processButton click handler with this:
        processButton.addEventListener('click', async function(e) {e.stopPropagation();

  const fileInput = document.getElementById('fileInput');
  if (!fileInput.files.length) {
    alert('Please select a file first');
    return;
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const aiToggle = document.getElementById('aiToggle');
  const wantsAI = aiToggle && aiToggle.checked && !window.isGroupChat;

  // Helper: run basic analysis + encouragement if needed
  async function runBasicWithEncouragement() {
    await processFile(false);
    // only show encouragement if zero credits
    if (user.sub) {
      const resp = await fetch(`/api/user-credits/${user.sub}`);
      const { credits = 0 } = await resp.json();
      if (credits === 0) {
        const results = document.getElementById('results');
        results.appendChild(createAIEncouragementContainer());
      }
    }
  }

  // — If they want AI… —
  if (wantsAI && user.sub) {
    // 1) Consent
    const hasConsented = await checkConsent(user.sub);
    if (!hasConsented) {
      showConsentPopup();
      return;
    }

    // 2) Credits
    const needed = window.currentCreditsNeeded || 1;
    const creditResp = await fetch(`/api/user-credits/${user.sub}`);
    const { credits = 0 } = await creditResp.json();

    if (credits < needed) {
    showNoCreditsPopup(needed, credits);
      // not enough → fallback to basic analysis + encouragement
      aiToggle.checked = false;
      window.skipSavedPopup = true;  
      await runBasicWithEncouragement();
      window.skipSavedPopup = false;  
      return;
    }

    // 3) Enough credits → do AI analysis
    await processFile(true);
    return;
  }

  // — Otherwise (basic mode) — always run basic (even with zero credits)
  await runBasicWithEncouragement();
});

function showNoCreditsPopup(needed = 1, current = 0) {
  const popup = document.createElement("div");
  popup.className = "ai-popup";
  popup.innerHTML = `
    <div class="ai-popup-content">
      <div class="ai-popup-progress">
        <div class="ai-popup-progress-bar2"></div>
      </div>
      <div class="ai-popup-header">
        <h3 class="ai-popup-title">Not Enough Credits</h3>
        <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
      </div>
      <p class="ai-popup-message">
        You dont have enough credits to run the AI analysis, basic analysis will still be shown.
      </p>
      <p class="ai-popup-message">
        Please <a href="/credits.html" style="color: #007BFF;">buy more credits</a> to continue.
      </p>
    </div>
  `;

  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 5000);
  popup.addEventListener('click', e => {
    if (e.target === popup) popup.remove();
  });
}




        // 2) Central helper: show/hide/disable the AI toggle depending on window.isGroupChat + login status
        function updateAiToggleUi() {
                const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
                if (!isLoggedIn) {
                    aiToggleContainer.style.display = 'none';
                    processButton.textContent = 'Analyze Chat';
                    return;
                }

                aiToggleContainer.style.display = 'flex';
                aiToggleContainer.innerHTML = `
                    <label class="ai-toggle-button">
                        <input type="checkbox" id="aiToggle" ${window.isGroupChat ? 'disabled' : 'checked'}>
                        <span class="slider">
                            <span class="text on">AI</span>
                            <span class="text off">OFF</span>
                        </span>
                    </label>
                    ${window.isGroupChat 
                        ? '<span class="group-chat-message">AI analysis not available for group chats</span>' 
                        : ''
                    }
                `;

                const aiToggle = document.getElementById('aiToggle');
                const processBtn = document.getElementById('processButton');

                if (aiToggle) {
                    aiToggle.addEventListener('change', function() {
                        if (window.isGroupChat && this.checked) {
                            showGroupChatNoAIPopup();
                            this.checked = false;
                            processBtn.textContent = 'Analyze Chat';
                            return;
                        }
                        
                        if (this.checked && window.selectedFile) {
                            processBtn.textContent = `Analyze Chat (${window.currentCreditsNeeded || 1} credit${window.currentCreditsNeeded !== 1 ? 's' : ''})`;
                        } else {
                            processBtn.textContent = 'Analyze Chat';
                        }
                    });
                }

                // Set initial button text
                if (window.isGroupChat) {
                    processBtn.textContent = 'Analyze Chat';
                } else if (aiToggle && aiToggle.checked && window.selectedFile) {
                    processBtn.textContent = `Analyze Chat (${window.currentCreditsNeeded || 1} credit${window.currentCreditsNeeded !== 1 ? 's' : ''})`;
                } else {
                    processBtn.textContent = 'Analyze Chat';
                }
            }

        // 3) Whenever authentication status changes somewhere else, re‐render the toggle:
        document.addEventListener('authChange', updateAiToggleUi);


        // 4) “handleFiles” is called by both drag/drop and fileInput.change
        async function handleFiles(files) {
            if (!files.length) return;

            isFileUploaded = true;
            const file = files[0];
            window.selectedFile = file;
            fileName.textContent = file.name;
            fileInfo.style.display = 'flex';
            uploadText.textContent = 'File selected! Drop another to replace';
            processButton.disabled = false;
            if (dropZone) dropZone.style.display = 'none';
            if (mobileUploadButton) mobileUploadButton.style.display = 'none';
            if (desktopUploadButton) desktopUploadButton.style.display = 'none';

            // Calculate credits based on uncompressed size
            const uncompressedSize = await getUncompressedTextSize(file);
            const fileSizeKB = uncompressedSize / 1024;
            const creditsNeeded = Math.max(1, Math.round(fileSizeKB / 50));
            processButton.textContent = `Analyze Chat (${creditsNeeded} credit${creditsNeeded !== 1 ? 's' : ''})`;
            window.currentCreditsNeeded = creditsNeeded;

            // (b) **Immediately read first ~100 lines and look for “distinct senders”**
            let isGroup = false;
            try {
                let text;
                if (file.name.endsWith('.zip')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const txtFile = Object.keys(zip.files).find(f => f.endsWith('.txt'));
                    if (!txtFile) throw new Error('No .txt file in ZIP');
                    text = await zip.files[txtFile].async('text');
                } else {
                    text = await file.text();
                }

                // Only proceed if we got valid text content
                if (typeof text === 'string') {
                    const regex = /^\[?\d{1,2}\/\d{1,2}\/\d{4}.*?\] ?([^:]+):/gm;
                    const senders = new Set();
                    let match;

                    const lines = text.split('\n').slice(0, 100);
                    for (const line of lines) {
                        match = regex.exec(line);
                        if (match) {
                            senders.add(match[1].trim());
                            if (senders.size > 2) {
                                isGroup = true;
                                break;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Group chat detection failed:', err);
                // Fallback to assuming it's not a group chat if we can't determine
                isGroup = false;
            }

            window.isGroupChat = isGroup;
            updateAiToggleUi();
        }

        async function getUncompressedTextSize(file) {
            if (file.name.endsWith('.zip')) {
                const arrayBuffer = await file.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const txtFile = Object.keys(zip.files).find(f => f.endsWith('.txt'));
                if (!txtFile) return file.size; // fallback to compressed size
                return zip.files[txtFile]._data.uncompressedSize;
            }
            return file.size;
        }

        // 5) Wire up drag/drop events to “handleFiles”
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, () => dropZone.classList.add('dragover'), false);
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'), false);
        });

        dropZone.addEventListener('drop', function(e) {
            const dt = e.dataTransfer;
            handleFiles(dt.files);
        }, false);

        // 6) Also when “Browse” buttons are clicked
        if (mobileUploadButton) {
            mobileUploadButton.addEventListener('click', e => {
                e.stopPropagation();
                fileInput.click();
            }, false);
        }
        if (desktopUploadButton) {
            desktopUploadButton.addEventListener('click', e => {
                e.stopPropagation();
                fileInput.click();
            }, false);
        }

        // 7) When user selects via the native file‐picker
        fileInput.addEventListener('change', function() {
            if (this.files.length) {
                handleFiles(this.files);
            }
        });

        // 8) “Clear file” button: reset everything back to “no file uploaded” state
        clearFile.addEventListener('click', function(e) {
            e.stopPropagation();
            fileInput.value = '';
            window.selectedFile = null;
            fileInfo.style.display = 'none';
            processButton.disabled = true;
            isFileUploaded = false;
            window.isGroupChat = false;
            updateUploadInterface();
            updateAiToggleUi();
            uploadText.textContent = 'Drag & drop your .txt or .zip file here';
        });
    }

    function setupGuideToggle() {
        document.querySelector('.guide-toggle').addEventListener('click', () => {
            const guideContent = document.querySelector('.guide-content');
            const guideToggle  = document.querySelector('.guide-toggle');
            guideContent.classList.toggle('active');
            guideToggle.classList.toggle('active');
        });
    }

    // This popup is shown if user tries to turn on AI for a group chat
    function showGroupChatNoAIPopup() {
        const popup = document.createElement("div");
        popup.className = "ai-popup";
        popup.innerHTML = `
            <div class="ai-popup-content">
                <div class="ai-popup-progress">
                    <div class="ai-popup-progress-bar"></div>
                </div>
                <div class="ai-popup-header">
                    <h3 class="ai-popup-title">Group Chat Detected</h3>
                    <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
                </div>
                <p class="ai-popup-message">AI analysis is currently only available for chats with exactly two participants.</p>
                <p class="ai-popup-message">Basic analytics will still be shown.</p>
            </div>
        `;
        document.body.appendChild(popup);
        setTimeout(() => {
            if (popup.parentElement) {
                popup.parentElement.removeChild(popup);
            }
        }, 5000);
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
            }
        });
    }

    // Initialize everything once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        initializeElements();
        setupDragDrop();
        setupGuideToggle();
        setupConsentButtons();
        
        updateUploadInterface();
    });

    // Recompute “show dropzone vs. button” if window is resized
    window.addEventListener('resize', function() {
        updateUploadInterface();
    });
})();
