// public/client.js - FINAL MULTI-USER VERSION
document.addEventListener('DOMContentLoaded', () => {

    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const currentUserSpan = document.getElementById('current-user');
    const logoutBtn = document.getElementById('logout-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const docElement = document.documentElement;
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

    // --- Core Auth & UI Functions ---
    const showLoginView = () => { loginView.style.display = 'flex'; appView.style.display = 'none'; };
    const showAppView = (username) => {
        loginView.style.display = 'none'; appView.style.display = 'block';
        currentUserSpan.textContent = `User: ${username}`;
        document.getElementById('my-videos-header').textContent = `${username}'s Videos`;
        loadVideosForUser(username);
    };

    // --- Login/Logout ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (username) { localStorage.setItem('Embedit-user', username); showAppView(username); }
    });
    logoutBtn.addEventListener('click', () => { localStorage.removeItem('Embedit-user'); showLoginView(); });

    // --- Theme Management ---
    themeToggle.checked = docElement.classList.contains('dark');
    themeToggle.addEventListener('change', () => {
        const isDark = themeToggle.checked;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        docElement.className = isDark ? 'dark' : '';
    });

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
    
    // --- UI Flow ---
    const handleFileSelect = (file) => { selectedFile = file; fileNameDisplay.textContent = `File: ${file.name}`; uploadDetails.style.display = 'block'; dropZone.style.display = 'none'; };
    const uploadFormReset = () => { selectedFile = null; uploadDetails.style.display = 'none'; dropZone.style.display = 'block'; titleInput.value = ''; fileInput.value = ''; uploadBtn.disabled = false; setTimeout(() => { uploadStatus.textContent = ''; }, 3000); };
    
    // --- App Logic (API Calls) ---
    const loadVideosForUser = async (username) => {
        try {
            const response = await fetch(`/api/videos?user=${username}`);
            const videos = await response.json();
            videoGrid.innerHTML = '';
            if (videos.length === 0) return videoGrid.innerHTML = `<p>You haven't uploaded any videos yet. Drag one above to start!</p>`;
            videos.forEach(video => {
                const videoCard = document.createElement('div');
                videoCard.className = 'video-card';
                const watchLink = `/watch/${video.id}`;
                videoCard.innerHTML = `<a href="${watchLink}" target="_blank"><div class="thumbnail"><img src="${video.thumbnailPath}" alt="Thumbnail"></div></a><div class="video-info"><a href="${watchLink}" target="_blank" style="text-decoration:none; color:inherit;"><h3 class="video-title">${video.title}</h3></a><p class="video-date">Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}</p></div><div class="card-overlay"><button class="overlay-btn share-btn" data-link="${watchLink}">Share</button><button class="overlay-btn delete-btn" data-id="${video.id}">Delete</button></div>`;
                videoCard.addEventListener('dblclick', () => window.open(watchLink, '_blank'));
                videoGrid.appendChild(videoCard);
            });
        } catch (error) { videoGrid.innerHTML = '<p>Could not load videos.</p>'; }
    };

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = localStorage.getItem('Embedit-user');
        if (!selectedFile || !titleInput.value.trim() || !username) return alert('Please select a file and title.');
        const formData = new FormData();
        formData.append('videoFile', selectedFile);
        formData.append('title', titleInput.value.trim());
        formData.append('username', username);
        uploadStatus.textContent = 'Uploading & Processing...';
        uploadBtn.disabled = true;
        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            window.open(`/watch/${result.video.id}`, '_blank');
            uploadFormReset();
            loadVideosForUser(username);

        } catch (error) { uploadStatus.textContent = `Error: ${error.message}`; uploadBtn.disabled = false; }
    });
    
    videoGrid.addEventListener('click', async (e) => {
        const username = localStorage.getItem('Embedit-user');
        const target = e.target;
        if (target.classList.contains('share-btn')) {
            const link = window.location.origin + target.dataset.link;
            navigator.clipboard.writeText(link).then(() => { target.textContent = 'Copied!'; setTimeout(() => target.textContent = 'Share', 2000); });
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm("Permanently delete this video?")) {
                try {
                    const response = await fetch(`/api/videos/${target.dataset.id}?user=${username}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error((await response.json()).message);
                    loadVideosForUser(username);
                } catch (err) { alert(`Failed to delete: ${err.message}`); }
            }
        }
    });

    // --- Check login status on page load ---
    (() => {
        const loggedInUser = localStorage.getItem('Embedit-user');
        if (loggedInUser) {
            showAppView(loggedInUser);
        } else {
            showLoginView();
        }
    })();
});