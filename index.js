// index.js - THE DEFINITIVE FINAL VERSION WITH ALL FIXES AND FEATURES

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Directories & Database ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');
const DB_PATH = path.join(__dirname, 'db.json');

// --- Setup on Startup ---
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));
let videos = [];
const loadDB = () => { try { if (fs.existsSync(DB_PATH)) { const data = fs.readFileSync(DB_PATH, 'utf-8'); videos = data.length ? JSON.parse(data) : []; } else { fs.writeFileSync(DB_PATH, '[]'); } } catch (e) { videos = []; } };
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
loadDB();

// --- Middleware ---
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// --- API ROUTES ---

// GET videos for a device
app.get('/api/videos', (req, res) => {
    const { deviceID } = req.query;
    if (!deviceID) return res.status(400).json({ message: 'Device ID required.' });
    res.json(videos.filter(v => v.deviceID === deviceID).slice().reverse());
});

// WATCH PAGE: This version includes the buttons and the script to make them work.
app.get('/watch/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);
    if (!video) return res.status(404).send('<h1>404: Video Not Found</h1>');

    const pageUrl = `${req.protocol}://${req.get('host')}/watch/${video.id}`;
    const absoluteVideoUrl = `${req.protocol}://${req.get('host')}${video.path}`;
    const absoluteThumbnailUrl = `${req.protocol}://${req.get('host')}${video.thumbnailPath}`;

    // THE FIX IS HERE: The HTML string now contains the buttons and the <script> block.
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Embedit | ${video.title}</title>
            <meta property="og:type" content="video.other">
            <meta property="og:title" content="${video.title}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:image" content="${absoluteThumbnailUrl}">
            <meta property="og:video" content="${absoluteVideoUrl}">
            <link rel="stylesheet" href="/style.css">
            <script>
                const theme=localStorage.getItem("theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
                document.documentElement.className=theme;
            </script>
        </head>
        <body class="">
            <header class="header">
                <a href="/" class="logo">Embedit</a>
                <a href="/" class="back-link">← All Videos</a>
            </header>
            <main class="container">
                <div class="watch-container">
                    <h2>${video.title}</h2>
                    <p>Uploaded on ${new Date(video.uploadDate).toLocaleDateString()}</p>
                    <video controls autoplay src="${video.path}"></video>

                    <!-- *** THE ADDED BUTTONS *** -->
                    <div class="watch-page-actions">
                        <button class="overlay-btn share-btn" data-link="/watch/${video.id}">Share</button>
                        <button class="overlay-btn delete-btn" data-id="${video.id}">Delete</button>
                    </div>
                </div>
            </main>

            <!-- *** THE ADDED SCRIPT TO POWER THE BUTTONS *** -->
            <script>
                document.addEventListener('click', async (e) => {
                    // Check if the clicked element is a button we care about
                    const target = e.target.closest('.overlay-btn');
                    if (!target) return;

                    const deviceID = localStorage.getItem('Embedit-device-id');
                    if (!deviceID) {
                        alert("Your device ID is not set. Please return to the homepage.");
                        return;
                    }

                    if (target.classList.contains('share-btn')) {
                        const link = window.location.origin + target.dataset.link;
                        navigator.clipboard.writeText(link).then(() => {
                            target.textContent = 'Copied!';
                            setTimeout(() => { target.textContent = 'Share'; }, 2000);
                        });
                    }

                    if (target.classList.contains('delete-btn')) {
                        if (confirm("Permanently delete this video? This cannot be undone.")) {
                            try {
                                const response = await fetch('/api/videos/' + target.dataset.id + '?deviceID=' + deviceID, { method: 'DELETE' });
                                if (!response.ok) {
                                    const error = await response.json();
                                    throw new Error(error.message || 'Failed to delete video.');
                                }
                                alert('Video deleted. You will be returned to the homepage.');
                                window.location.href = '/';
                            } catch (err) {
                                alert(err.message);
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// UPLOAD a new video to Supabase
app.post('/api/upload', upload.single('videoFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file was provided.' });
    
    const { deviceID, title } = req.body;
    if (!deviceID) return res.status(400).json({ message: 'Device ID is required.' });
    
    try {
        // 1. Upload the main video file to the 'videos' bucket
        const videoFileName = `${deviceID}/${Date.now()}-${req.file.originalname.replace(/\s/g, '-')}`;
        const { data: videoUploadData, error: videoUploadError } = await supabase
            .storage
            .from('videos')
            .upload(videoFileName, req.file.buffer, { contentType: req.file.mimetype });

        if (videoUploadError) throw videoUploadError;

        // 2. Get the public URL of the uploaded video
        const { data: { publicUrl: videoPublicUrl } } = supabase.storage.from('videos').getPublicUrl(videoFileName);

        // 3. Insert metadata into the database
        const { data: dbData, error: dbError } = await supabase
            .from('videos')
            .insert([{
                device_id: deviceID,
                title: title || 'Untitled',
                file_path: videoPublicUrl,
                thumbnail_path: '/placeholder.png' // Use a placeholder from your /public folder for now
            }])
            .select()
            .single();

        if (dbError) throw dbError;

        res.status(201).json({ video: dbData });

    } catch (error) {
        console.error('Upload process failed:', error);
        res.status(500).json({ message: error.message });
    }
});


// DELETE Route (Unchanged, already perfect)
app.delete('/api/videos/:id', (req, res) => {
    // This entire function from the last step is perfect
    const videoId = parseInt(req.params.id, 10);
    const { deviceID } = req.query;
    if (!deviceID) return res.status(403).json({ message: 'Permission denied.' });
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return res.status(404).json({ message: "Video not found" });
    if (videos[videoIndex].deviceID !== deviceID) return res.status(403).json({ message: "This video does not belong to your device." });
    try {
        const videoToDelete = videos[videoIndex];
        const videoPath = path.join(UPLOADS_DIR, videoToDelete.fileName);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        const thumbPath = path.join(THUMBNAILS_DIR, path.basename(videoToDelete.thumbnailPath));
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        videos.splice(videoIndex, 1);
        saveDB();
        res.status(200).json({ message: "Video deleted." });
    } catch (err) { res.status(500).json({ message: "Error deleting files." }); }
});

// --- Start Server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));