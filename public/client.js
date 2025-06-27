// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    const setTheme = (isDark) => {
        document.body.classList.toggle('dark', isDark);
        themeToggle.checked = isDark;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    if (savedTheme) {
        setTheme(savedTheme === 'dark');
    } else {
        setTheme(prefersDark);
    }
    themeToggle.addEventListener('change', () => setTheme(themeToggle.checked));


    // --- Element References ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadDetails = document.getElementById('upload-details');
    const fileNameSpan = document.getElementById('file-name');
    const titleInput = document.getElementById('title-input');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadStatus = document.getElementById('upload-status');
    const videoGrid = document.getElementById('video-grid');

    let selectedFile = null;

    // --- Drag and Drop Logic ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over'));
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            handleFileSelect(file);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        selectedFile = file;
        fileNameSpan.textContent = file.name;
        uploadDetails.style.display = 'block';
    }


    // --- Upload Logic ---
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile || !titleInput.value.trim()) {
            alert('Please select a file and enter a title.');
            return;
        }

        const formData = new FormData();
        formData.append('title', titleInput.value.trim());
        formData.append('videoFile', selectedFile);

        uploadStatus.innerHTML = `Uploading <strong>${selectedFile.name}</strong>... <div class="loader"></div>`;
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            uploadStatus.textContent = 'Upload successful!';
            
            // Open the new video in a new tab
            window.open(`/watch/${result.video.id}`, '_blank');
            
            // Reset the form and reload the video list
            uploadFormReset();
            loadVideos();

        } catch (error) {
            uploadStatus.textContent = `Upload failed: ${error.message}`;
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


    // --- Load Videos on Page Load ---
    const loadVideos = async () => {
        try {
            const response = await fetch('/api/videos');
            const videos = await response.json();
            videoGrid.innerHTML = '';

            if (videos.length === 0) {
                videoGrid.innerHTML = '<p>You haven\'t uploaded any videos yet. Drag one above to get started!</p>';
                return;
            }

            videos.forEach(video => {
                const videoCard = document.createElement('a');
                videoCard.className = 'video-card';
                videoCard.href = `/watch/${video.id}`;
                videoCard.target = '_blank'; // ** THIS OPENS THE LINK IN A NEW TAB **

                const date = new Date(video.uploadDate).toLocaleDateString();

                videoCard.innerHTML = `
                    <div class="thumbnail">
                        <!-- For now, we use a placeholder. Real thumbnail path would go here. -->
                        <img src="/placeholder-thumbnail.png" alt="thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="video-info">
                        <h3 class="video-title">${video.title}</h3>
                        <p class="video-date">Uploaded: ${date}</p>
                    </div>
                `;
                videoGrid.appendChild(videoCard);
            });
        } catch (error) {
            videoGrid.innerHTML = '<p>Could not load videos.</p>';
            console.error('Failed to load videos:', error);
        }
    };

    // Initial call
    loadVideos();
});