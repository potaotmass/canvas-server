// index.js - THE DEFINITIVE FINAL VERSION

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Define Directories & Database Path ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');
const DB_PATH = path.join(__dirname, 'db.json');

// --- Setup: Ensure Folders & DB Exist ---
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

let videos = [];
const loadDB = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        } else {
            fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.error("Error loading or creating database:", error);
        videos = [];
    }
};
const saveDB = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
    } catch (error) {
        console.error("Error saving to database:", error);
    }
};
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

// GET all videos
app.get('/api/videos', (req, res) => res.json(videos.slice().reverse()));

// ** THE COMPLETE WATCH PAGE ROUTE **
app.get('/watch/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);

    if (!video) {
        return res.status(404).send('<h1>404: Video Not Found</h1><a href="/">Go Home</a>');
    }

    const pageUrl = `${req.protocol}://${req.get('host')}/watch/${video.id}`;
    const absoluteVideoUrl = `${req.protocol}://${req.get('host')}${video.path}`;
    const absoluteThumbnailUrl = `${req.protocol}://${req.get('host')}${video.thumbnailPath}`;

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>embedit | ${video.title}</title>
            <meta property="og:type" content="video.other">
            <meta property="og:title" content="${video.title}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:image" content="${absoluteThumbnailUrl}">
            <meta property="og:video" content="${absoluteVideoUrl}">
            <link rel="stylesheet" href="/style.css">
            <script>
                const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.className = theme;
            </script>
        </head>
        <body class="">
            <header class="header">
                <a href="/" class="logo">embedit</a>
                <a href="/" class="back-link">← Back to Videos</a>
            </header>
            <main class="container">
                <div class="watch-container">
                    <h2>${video.title}</h2>
                    <p>Uploaded on ${new Date(video.uploadDate).toLocaleDateString()}</p>
                    <video controls autoplay src="${video.path}"></video>
                    <!-- NEW BUTTONS ON WATCH PAGE -->
                    <div class="watch-page-actions">
                        <button class="overlay-btn share-btn" data-link="/watch/${video.id}">Share</button>
                        <button class="overlay-btn delete-btn" data-id="${video.id}">Delete</button>
                    </div>
                </div>
            </main>
            <!-- SCRIPT TO HANDLE WATCH PAGE ACTIONS -->
            <script>
                document.addEventListener('click', async (e) => {
                    if (e.target.classList.contains('share-btn')) {
                        const link = window.location.origin + e.target.dataset.link;
                        navigator.clipboard.writeText(link).then(() => alert('Link Copied!'));
                    }
                    if (e.target.classList.contains('delete-btn')) {
                        if (confirm("Are you sure? This video will be permanently deleted.")) {
                            try {
                                const response = await fetch('/api/videos/' + e.target.dataset.id, { method: 'DELETE' });
                                if (!response.ok) throw new Error('Failed to delete.');
                                alert('Video deleted. You will now be returned to the homepage.');
                                window.location.href = '/';
                            } catch (err) { alert(err.message); }
                        }
                    }
                });
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// ** THE COMPLETE UPLOAD ROUTE **
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file.' });
    
    const inputFilePath = req.file.path;
    const thumbnailFileName = `thumb-${path.parse(req.file.filename).name}.png`;
    
    ffmpeg(inputFilePath)
        .on('end', () => {
            const newVideo = {
                id: videos.length > 0 ? Math.max(...videos.map(v => v.id)) + 1 : 1,
                title: req.body.title || 'Untitled',
                fileName: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                thumbnailPath: `/thumbnails/${thumbnailFileName}`,
                uploadDate: new Date()
            };
            videos.push(newVideo);
            saveDB();
            res.status(201).json({ video: newVideo });
        })
        .on('error', (err) => {
            console.error("FFMPEG Error:", err.message);
            fs.unlink(inputFilePath, () => {}); // Clean up the partial upload
            // Send a response so the browser doesn't wait forever
            res.status(500).json({ message: 'Could not process video. Format may not be supported.' });
        })
        .screenshots({ count: 1, timestamps: ['50%'], filename: thumbnailFileName, folder: THUMBNAILS_DIR, size: '320x180' });
});

// ** THE COMPLETE DELETE ROUTE **
app.delete('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const videoIndex = videos.findIndex(v => v.id === videoId);

    if (videoIndex === -1) return res.status(404).json({ message: "Not found" });

    const videoToDelete = videos[videoIndex];
    try {
        const videoPath = path.join(__dirname, videoToDelete.path);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        
        const thumbPath = path.join(__dirname, videoToDelete.thumbnailPath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

        videos.splice(videoIndex, 1);
        saveDB();
        res.status(200).json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error during file deletion." });
    }
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));