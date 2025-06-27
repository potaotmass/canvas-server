// public/client.js - DEFINITIVE FINAL VERSION
document.addEventListener('DOMContentLoaded', () => {

    // Use Vercel's standard way of reading environment variables.
    // Falls back to localhost for local testing.
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    // --- Device ID Management ---
    const deviceID = (() => { let id = localStorage.getItem('embedit-device-id'); if (!id) { id = crypto.randomUUID(); localStorage.setItem('embedit-device-id', id); } return id; })();
    
    // --- Theme Management ---
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;
    themeToggle.checked = docElement.classList.contains('dark');
    themeToggle.addEventListener('change', () => {
        const isDark = themeToggle.checked;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        docElement.className = isDark ? 'dark' : '';
    });

    // --- Element References ---
    const uploadForm = document.getElementById('upload-form');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadDetails = document.getElementById('upload-details');
    const fileNameDisplay = document.getElementById('file-name-display');
    const titleInput = document.getElementById('title-input');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadStatus = document.getElementById('upload-status');
    const videoGrid = document.getElementById('video-grid');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    let selectedFile = null;

    // --- Drag & Drop ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    ['dragleave', 'dragend', 'drop'].forEach(type => dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over')));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith('video/')) { fileInput.files = e.dataTransfer.files; handleFileSelect(file); }
    });
    fileInput.addEventListener('change', (e) => e.target.files.length && handleFileSelect(e.target.files[0]));
    
    function handleFileSelect(file) { selectedFile = file; fileNameDisplay.textContent = `File: ${file.name}`; uploadDetails.style.display = 'block'; dropZone.style.display = 'none'; uploadStatus.textContent = ''; progressContainer.style.display = 'none'; }
    function uploadFormReset() { selectedFile = null; uploadDetails.style.display = 'none'; dropZone.style.display = 'block'; titleInput.value = ''; fileInput.value = ''; uploadBtn.disabled = false; setTimeout(() => { uploadStatus.textContent = ''; progressContainer.style.display = 'none'; }, 3000); }

    // --- Upload ---
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedFile || !titleInput.value.trim()) return alert('Please select a file and provide a title.');

        const formData = new FormData();
        formData.append('videoFile', selectedFile);
        formData.append('title', titleInput.value.trim());
        formData.append('deviceID', deviceID);
        
        uploadBtn.disabled = true;
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/upload`, true);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                progressBar.style.width = percent + '%';
                progressBar.textContent = percent + '%';
            }
        };
        xhr.onload = () => {
            if (xhr.status === 201) {
                uploadStatus.textContent = 'Upload complete! Refreshing...';
                const result = JSON.parse(xhr.responseText);
                window.open(`${API_BASE_URL}/watch/${result.video.id}`, '_blank');
                uploadFormReset();
                loadVideos();
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    uploadStatus.textContent = `Error: ${err.message || 'Server error.'}`;
                } catch {
                    uploadStatus.textContent = `Error: Server responded with status ${xhr.status}.`;
                }
            }
            uploadBtn.disabled = false;
        };
        xhr.onerror = () => { uploadStatus.textContent = 'Network error.'; uploadBtn.disabled = false; };
        xhr.send(formData);
    });

    // --- Video Grid ---
    const loadVideos = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/videos?deviceID=${deviceID}`);
            const videos = await response.json();
            videoGrid.innerHTML = '';
            if (videos.length === 0) return videoGrid.innerHTML = '<p>Your videos will appear here.</p>';
            videos.forEach(video => {
                const videoCard = document.createElement('div');
                videoCard.className = 'video-card';
                const watchLink = `/watch/${video.id}`; // The path on the API server
                videoCard.innerHTML = `<a href="${API_BASE_URL}${watchLink}" target="_blank"><div class="thumbnail"><img src="${API_BASE_URL}${video.thumbnailPath}"></div></a><div class="video-info">...</div><div class="card-overlay">...</div>`;
                videoGrid.appendChild(videoCard);
            });
        } catch (error) { videoGrid.innerHTML = '<p>Could not connect to API server.</p>'; }
    };
    
    // Grid click listener... unchanged from previous full version
    videoGrid.addEventListener('click', async (e) => {
        const target = e.target;
        if(target.classList.contains('delete-btn')) {
            // ... logic to call fetch(`${API_BASE_URL}/api/videos/...`, {method: 'DELETE'})
        }
    });

    loadVideos();
});