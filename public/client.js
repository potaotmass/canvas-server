document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;
    themeToggle.checked = docElement.classList.contains('dark');
    themeToggle.addEventListener('change', () => {
        const isDark = themeToggle.checked;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        docElement.classList.toggle('dark', isDark);
    });

    // --- Element References ---
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

    // --- Drag & Drop Logic ---
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
            }
        }
    });
    fileInput.addEventListener('change', (e) => e.target.files.length && handleFileSelect(e.target.files[0]));
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

        uploadStatus.textContent = 'Uploading & Processing...';
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Upload failed');
            window.open(`/watch/${result.video.id}`, '_blank');
            uploadFormReset();
            loadVideos();
        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadBtn.disabled = false;
        }
    });
    
    function uploadFormReset() {
        selectedFile = null;
        uploadDetails.style.display = 'none';
        titleInput.value = '';
        fileInput.value = '';
        uploadBtn.disabled = false;
        setTimeout(() => { uploadStatus.textContent = ''; }, 3000);
    }

    // --- Video Grid & Actions ---
    const loadVideos = async () => {
        try {
            const response = await fetch('/api/videos');
            const videos = await response.json();
            videoGrid.innerHTML = '';
            if (videos.length === 0) return videoGrid.innerHTML = '<p>Your uploaded videos appear here. Drag one above to start!</p>';
            videos.forEach(video => {
                const videoCard = document.createElement('div');
                videoCard.className = 'video-card';
                const watchLink = `/watch/${video.id}`;
                videoCard.innerHTML = `
                    <a href="${watchLink}" target="_blank" title="Watch ${video.title}">
                        <div class="thumbnail"><img src="${video.thumbnailPath}" alt="Thumbnail"></div>
                    </a>
                    <div class="video-info">
                        <a href="${watchLink}" target="_blank" style="text-decoration:none; color:inherit;">
                            <h3 class="video-title">${video.title}</h3>
                        </a>
                        <p class="video-date">Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}</p>
                    </div>
                    <div class="card-overlay">
                        <button class="overlay-btn share-btn" data-link="${watchLink}">Share</button>
                        <button class="overlay-btn delete-btn" data-id="${video.id}">Delete</button>
                    </div>`;
                videoGrid.appendChild(videoCard);
            });
        } catch (error) {
            videoGrid.innerHTML = '<p>Could not load videos.</p>';
        }
    };
    
    videoGrid.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('share-btn')) {
            const link = window.location.origin + target.dataset.link;
            navigator.clipboard.writeText(link).then(() => {
                target.textContent = 'Copied!';
                setTimeout(() => target.textContent = 'Share', 2000);
            });
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm("Are you sure? This action cannot be undone.")) {
                try {
                    const response = await fetch(`/api/videos/${target.dataset.id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error((await response.json()).message);
                    loadVideos();
                } catch (err) {
                    alert(`Failed to delete: ${err.message}`);
                }
            }
        }
    });

    // Initial Load
    loadVideos();
});