// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const videoList = document.getElementById('videoList');
    const uploadStatus = document.getElementById('uploadStatus');

    // Helper function for relative time
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    const loadVideos = async () => {
        const response = await fetch('/api/videos');
        const videos = await response.json();
        
        videoList.innerHTML = '';
        if (videos.length === 0) {
            videoList.innerHTML = '<p>No videos yet. Upload one!</p>';
            return;
        }

        videos.forEach(video => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';

            // The URL for the new watch page, with a "v" query parameter for the video ID
            const videoLink = `./watch.html?v=${video.id}`;
            
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
    };

    // Add event listener for the share buttons (using event delegation)
    videoList.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('share-btn')) {
            const link = window.location.origin + e.target.dataset.link.substring(1); // Create absolute URL
            navigator.clipboard.writeText(link).then(() => {
                alert('Video link copied to clipboard!');
            });
        }
    });

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
            
            // Redirect to the new video's watch page!
            window.location.href = `./watch.html?v=${result.video.id}`;
            
        } catch (error) {
            uploadStatus.textContent = `Upload failed: ${error.message}`;
        }
    });

    loadVideos();
});