document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const clearFile = document.getElementById('clearFile');
    const processButton = document.getElementById('processButton');
    const uploadText = document.getElementById('upload-text');
  
    // Process button functionality
    processButton.addEventListener('click', function() {
      if (fileInput.files.length) {
        // Connect this to your actual processing function
        console.log("Processing file:", fileInput.files[0].name);
        // Example: processWhatsAppFile(fileInput.files[0]);
      }
    });
  
    // File selection handling
    function handleFiles(files) {
      if (files.length && files[0].name.match(/\.(txt|zip)$/i)) {
        fileInput.files = files;
        fileName.textContent = files[0].name;
        dropZone.classList.add('hidden');
        fileInfo.style.display = 'flex';
        processButton.disabled = false;
      }
    }
  
    // Drag and drop functionality
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
      dropZone.classList.add('highlight');
    }
  
    function unhighlight() {
      dropZone.classList.remove('highlight');
    }
  
    dropZone.addEventListener('drop', function(e) {
      handleFiles(e.dataTransfer.files);
    });
  
    fileInput.addEventListener('change', function() {
      handleFiles(this.files);
    });
  
    clearFile.addEventListener('click', function(e) {
      e.stopPropagation();
      fileInput.value = '';
      fileInfo.style.display = 'none';
      dropZone.classList.remove('hidden');
      processButton.disabled = true;
    });
  });