document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;
    // Set initial toggle state based on the theme loaded by the head script
    themeToggle.checked = docElement.classList.contains('dark');
    themeToggle.addEventListener('change', () => {
        const isDark = themeToggle.checked;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        docElement.className = isDark ? 'dark' : '';
    });

    // --- All other code from the final, complete client.js goes here ---
    const uploadForm = document.getElementById('upload-form');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadDetails = document.getElementById('upload-details');
    const fileNameSpan = document.getElementById('file-name');
    const titleInput = document.getElementById('title-input');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadStatus = document.getElementById('upload-status');
    const videoGrid = document.getElementById('video-grid');
    let selectedFile = null;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    ['dragleave', 'dragend', 'drop'].forEach(type => dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over')));
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('video/')) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect(file);
            } else {
                alert("Please drop a valid video file!");
            }
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelect(e.target.files[0]);
    });
    
    function handleFileSelect(file) {
        selectedFile = file;
        fileNameSpan.textContent = file.name;
        uploadDetails.style.display = 'block';
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile || !titleInput.value.trim()) return alert('Please select a file and provide a title.');
        
        const formData = new FormData();
        formData.append('videoFile', selectedFile);
        formData.append('title', titleInput.value.trim());

        uploadStatus.textContent = 'Uploading & Processing...';
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Server error during upload.');
            
            // Success! Open the new video in a new tab.
            window.open(`/watch/${result.video.id}`, '_blank');
            uploadFormReset();
            loadVideos();
        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadBtn.disabled = false; // Re-enable button on failure
        }
    });

    // ... Rest of the functions (loadVideos, etc.) are the same as the final version in the previous answer.
    const loadVideos = async () => { /* ... unchanged ... */ };
    videoGrid.addEventListener('click', async (e) => { /* ... unchanged ... */ });

    // The rest of the `client.js` functions go here. Use the final version from my previous "is there 2 client.js???" answer.
});