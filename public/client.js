// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const videoList = document.getElementById('videoList');
    const uploadStatus = document.getElementById('uploadStatus');

    // Helper for "5 minutes ago" text
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        return "today";
    };

    // Load videos for the homepage
    const loadVideos = async () => {
        try {
            const response = await fetch('/api/videos');
            const videos = await response.json();
            videoList.innerHTML = '';

            if (videos.length === 0) {
                videoList.innerHTML = '<p>No videos uploaded yet. Be the first!</p>';
                return;
            }

            videos.forEach(video => {
                const videoItem = document.createElement('div');
                videoItem.className = 'video-item';
                // *** THE CHANGE: Use the new, cleaner URL format ***
                const videoLink = `/watch/${video.id}`;
                
                videoItem.innerHTML = `
                    <div class="video-item-info">
                        <a href="${videoLink}">${video.title}</a>
                        <p>Posted ${timeAgo(video.uploadDate)}</p>
                    </div>
                    <div>
                        <button class="share-btn" data-link="${videoLink}">Copy Link</button>
                    </div>
                `;
                videoList.appendChild(videoItem);
            });
        } catch (err) {
            console.error(err);
            videoList.innerHTML = "<p>Could not load videos.</p>";
        }
    };

    // Handle the share button click
    videoList.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('share-btn')) {
            const link = window.location.origin + e.target.dataset.link;
            navigator.clipboard.writeText(link).then(() => {
                alert('Video link copied!');
            });
        }
    });

    // Handle the upload form
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        uploadStatus.textContent = 'Uploading...';
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            // Redirect to the new video's dynamic watch page
            window.location.href = `/watch/${result.video.id}`;
            
        } catch (error) {
            uploadStatus.textContent = `Upload failed: ${error.message}`;
        }
    });

    loadVideos();
});