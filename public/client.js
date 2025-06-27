// public/client.js - FINAL VERSION WITH LIVE PROGRESS BAR
document.addEventListener('DOMContentLoaded', () => {

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
    
    // --- UI Flow Functions ---
    const handleFileSelect = (file) => { selectedFile = file; fileNameDisplay.textContent = `File: ${file.name}`; uploadDetails.style.display = 'block'; dropZone.style.display = 'none'; uploadStatus.textContent = ''; progressContainer.style.display = 'none'; };
    const uploadFormReset = () => { selectedFile = null; uploadDetails.style.display = 'none'; dropZone.style.display = 'block'; titleInput.value = ''; fileInput.value = ''; uploadBtn.disabled = false; setTimeout(() => { uploadStatus.textContent = ''; progressContainer.style.display = 'none';}, 3000); };
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    ['dragleave', 'dragend', 'drop'].forEach(type => dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over')));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file?.type.startsWith('video/')) { fileInput.files = e.dataTransfer.files; handleFileSelect(file); } });
    fileInput.addEventListener('change', (e) => e.target.files.length && handleFileSelect(e.target.files[0]));

    // --- Upload with XMLHttpRequest for Progress ---
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedFile || !titleInput.value.trim()) return alert('Please select a file and provide a title.');

        const formData = new FormData();
        formData.append('videoFile', selectedFile);
        formData.append('title', titleInput.value.trim());
        formData.append('deviceID', deviceID);
        
        uploadStatus.textContent = '';
        uploadBtn.disabled = true;
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.style.backgroundColor = 'var(--accent-color)';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressBar.textContent = percentComplete + '%';
            }
        };
        xhr.onload = () => {
            progressBar.textContent = 'Processing...';
            progressBar.style.backgroundColor = '#f59e0b'; // Yellow for processing

            if (xhr.status === 201) {
                uploadStatus.textContent = 'Upload complete! Thumbnail is processing.';
                const result = JSON.parse(xhr.responseText);
                window.open(`/watch/${result.video.id}`, '_blank');
                uploadFormReset();
                loadVideos();
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    uploadStatus.textContent = `Error: ${error.message}`;
                } catch {
                    uploadStatus.textContent = `Error: Server responded with status ${xhr.status}.`;
                }
            }
            uploadBtn.disabled = false;
        };
        xhr.onerror = () => { uploadStatus.textContent = 'Network error during upload.'; uploadBtn.disabled = false; };
        xhr.send(formData);
    });

    // --- Video Grid & Actions ---
    const loadVideos = async () => {
        try {
            const response = await fetch(`/api/videos?deviceID=${deviceID}`);
            const videos = await response.json();
            videoGrid.innerHTML = '';
            if (videos.length === 0) return videoGrid.innerHTML = '<p>Your videos for this device will appear here.</p>';
            
            videos.forEach(video => {
                const videoCard = document.createElement('div');
                videoCard.className = 'video-card';
                const watchLink = `/watch/${video.id}`;
                videoCard.innerHTML = `${video.processing ? '<div class="thumbnail-processing">Processing...</div>' : ''}<a href="${watchLink}" target="_blank"><div class="thumbnail"><img src="${video.thumbnailPath}" alt="Thumbnail"></div></a><div class="video-info"><h3 class="video-title">${video.title}</h3><p class="video-date">Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}</p></div><div class="card-overlay"><button class="overlay-btn share-btn" data-link="${watchLink}">Share</button><button class="overlay-btn delete-btn" data-id="${video.id}">Delete</button></div>`;
                videoCard.addEventListener('click', (e) => { if (e.target.closest('.overlay-btn')) return; window.open(watchLink, '_blank'); });
                videoGrid.appendChild(videoCard);
});
        } catch (error) { videoGrid.innerHTML = '<p>Could not load videos.</p>'; }
    };
    
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
    setInterval(loadVideos, 10000); // Poll for new thumbnails every 10 seconds
});