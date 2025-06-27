// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;

    // Set initial toggle state based on the class set by the script in <head>
    themeToggle.checked = docElement.classList.contains('dark');

    themeToggle.addEventListener('change', () => {
        const isDark = themeToggle.checked;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        docElement.className = isDark ? 'dark' : '';
    });

    // --- Element References & State ---
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

    // --- Drag & Drop Logic (Corrected & Final) ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // This is essential
        dropZone.classList.add('drag-over');
    });
    ['dragleave', 'dragend', 'drop'].forEach(type => {
        dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over'));
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('video/')) {
                fileInput.files = e.dataTransfer.files; // Critical step
                handleFileSelect(file);
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

    // --- Upload Logic ---
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile || !titleInput.value.trim()) return alert('Please select a file and title.');
        const formData = new FormData();
        formData.append('videoFile', selectedFile);
        formData.append('title', titleInput.value.trim());

        uploadStatus.textContent = 'Uploading & Processing... This can take a moment.';
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            // Success! Open in new tab and refresh the list
            window.open(`/watch/${result.video.id}`, '_blank');
            uploadFormReset();
            loadVideos();
        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadBtn.disabled = false;
        }
    });

    function uploadFormReset() { /* ... unchanged ... */ }

    // --- Video Grid & Actions Logic ---
    const loadVideos = async () => { /* ... unchanged ... */ };
    videoGrid.addEventListener('click', async (e) => { /* ... unchanged ... */ });

    // Initial Load
    loadVideos();
});

// To be completely safe, copy the full and final client.js from the "Is there 2 client.js?" answer, and just make sure the theme-toggle part at the top matches this version.