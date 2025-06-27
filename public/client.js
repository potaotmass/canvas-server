// public/client.js - FINAL VERSION WITH DEVICE ID

document.addEventListener('DOMContentLoaded', () => {

    // --- Device ID Management ---
    const getDeviceID = () => {
        let deviceID = localStorage.getItem('Embedit-device-id');
        if (!deviceID) {
            deviceID = crypto.randomUUID(); // Generate a new, unique ID
            localStorage.setItem('Embedit-device-id', deviceID);
        }
        return deviceID;
    };
    const deviceID = getDeviceID();
    
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
    let selectedFile = null;
    
    // --- Drag & Drop / UI Flow ---
    const handleFileSelect = (file) => { selectedFile = file; fileNameDisplay.textContent = `File: ${file.name}`; uploadDetails.style.display = 'block'; dropZone.style.display = 'none'; };
    const uploadFormReset = () => { selectedFile = null; uploadDetails.style.display = 'none'; dropZone.style.display = 'block'; titleInput.value = ''; fileInput.value = ''; uploadBtn.disabled = false; setTimeout(() => { uploadStatus.textContent = ''; }, 3000); };
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    ['dragleave', 'dragend', 'drop'].forEach(type => dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over')));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file?.type.startsWith('video/')) { fileInput.files = e.dataTransfer.files; handleFileSelect(file); }});
    fileInput.addEventListener('change', (e) => e.target.files.length && handleFileSelect(e.target.files[0]));
    
    // --- App Logic (API Calls) ---
    const loadVideos = async () => {
        try {
            const response = await fetch(`/api/videos?deviceID=${deviceID}`);
            const videos = await response.json();
            videoGrid.innerHTML = '';
            if (videos.length === 0) return videoGrid.innerHTML = '<p>Your uploaded videos for this device will appear here.</p>';
            videos.forEach(video => {
                const videoCard = document.createElement('div');
                videoCard.className = 'video-card';
                const watchLink = `/watch/${video.id}`;
                videoCard.innerHTML = `<div class="thumbnail"><img src="${video.thumbnailPath}" alt="Thumbnail"></div><div class="video-info"><h3 class="video-title">${video.title}</h3><p class="video-date">Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}</p></div><div class="card-overlay"><button class="overlay-btn share-btn" data-link="${watchLink}">Share</button><button class="overlay-btn delete-btn" data-id="${video.id}">Delete</button></div>`;
                videoCard.addEventListener('click', (e) => { if (e.target.closest('.overlay-btn')) return; window.open(watchLink, '_blank'); });
                videoGrid.appendChild(videoCard);
            });
        } catch (error) { videoGrid.innerHTML = '<p>Could not load videos.</p>'; }
    };

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile || !titleInput.value.trim()) return alert('Please select a file and provide a title.');
        const formData = new FormData();
        formData.append('videoFile', selectedFile);
        formData.append('title', titleInput.value.trim());
        formData.append('deviceID', deviceID);
        uploadStatus.textContent = 'Uploading & Processing...';
        uploadBtn.disabled = true;
        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            window.open(`/watch/${result.video.id}`, '_blank');
            uploadFormReset();
            loadVideos();
        } catch (error) { uploadStatus.textContent = `Error: ${error.message}`; uploadBtn.disabled = false; }
    });
    
    videoGrid.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('share-btn')) {
            const link = window.location.origin + target.dataset.link;
            navigator.clipboard.writeText(link).then(() => { target.textContent = 'Copied!'; setTimeout(() => target.textContent = 'Share', 2000); });
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm("Permanently delete this video?")) {
                try {
                    const response = await fetch(`/api/videos/${target.dataset.id}?deviceID=${deviceID}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error((await response.json()).message);
                    loadVideos();
                } catch (err) { alert(`Failed to delete: ${err.message}`); }
            }
        }
    });

    loadVideos();
});