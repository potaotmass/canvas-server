// public/watch.js
document.addEventListener('DOMContentLoaded', async () => {
    const watchArea = document.getElementById('watch-area');

    // Get the video ID from the URL (e.g., from ?v=123)
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v');

    if (!videoId) {
        watchArea.innerHTML = '<h2>Error: No video specified.</h2>';
        return;
    }

    try {
        const response = await fetch(`/api/videos/${videoId}`);
        if (!response.ok) {
            throw new Error('Video not found.');
        }
        const video = await response.json();
        
        // Update the page title
        document.title = video.title;

        // Populate the watch area with the video player and info
        watchArea.innerHTML = `
            <h2>${video.title}</h2>
            <p>Uploaded on ${new Date(video.uploadDate).toLocaleDateString()}</p>
            <video controls autoplay src="${video.path}"></video>
        `;

    } catch (error) {
        watchArea.innerHTML = `<h2>Error: ${error.message}</h2><p>This video might not exist.</p>`;
    }
});