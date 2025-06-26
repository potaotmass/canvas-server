document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const videoList = document.getElementById('videoList');
    const uploadStatus = document.getElementById('uploadStatus');

    // Function to fetch and display videos from our server
    const loadVideos = async () => {
        try {
            const response = await fetch('/api/videos');
            const videos = await response.json();
            
            videoList.innerHTML = ''; // Clear current list
            
            if (videos.length === 0) {
                 videoList.innerHTML = '<p>No videos uploaded yet. Be the first!</p>';
            } else {
                videos.forEach(video => {
                    const videoElement = document.createElement('div');
                    videoElement.className = 'video-item';
                    videoElement.innerHTML = `
                        <h3>${video.title}</h3>
                        <video controls src="${video.path}"></video>
                    `;
                    videoList.appendChild(videoElement);
                });
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            videoList.innerHTML = '<p>Could not load videos.</p>';
        }
    };

    // Handle the form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const titleInput = document.getElementById('titleInput');
        const fileInput = document.getElementById('fileInput');
        
        // We use FormData to send both the file and other form fields (like the title)
        const formData = new FormData();
        formData.append('title', titleInput.value);
        formData.append('videoFile', fileInput.files[0]);

        uploadStatus.textContent = 'Uploading... Please wait.';

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                // Don't set 'Content-Type' header; browser does it automatically for FormData
            });

            if (response.ok) {
                uploadStatus.textContent = 'Upload successful!';
                uploadForm.reset();
                loadVideos(); // Refresh the video list
            } else {
                throw new Error('Upload failed.');
            }
        } catch (error) {
            console.error('Error uploading video:', error);
            uploadStatus.textContent = `Upload failed: ${error.message}`;
        }
    });

    // Initial load of videos when the page opens
    loadVideos();
});