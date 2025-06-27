// index.js - FINAL, COMPLETE, NON-BLOCKING VERSION

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
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));

let videos = [];
const loadDB = () => { try { if (fs.existsSync(DB_PATH)) { const data = fs.readFileSync(DB_PATH, 'utf-8'); videos = data.length ? JSON.parse(data) : []; } else { fs.writeFileSync(DB_PATH, '[]'); } } catch (e) { videos = []; console.error("DB Load Error:", e); } };
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

// WATCH PAGE (Dynamically generates the HTML for a single video)
app.get('/watch/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);
    if (!video) return res.status(404).send('<h1>404: Video Not Found</h1>');
    
    const pageUrl = `${req.protocol}://${req.get('host')}/watch/${video.id}`;
    const absoluteVideoUrl = `${req.protocol}://${req.get('host')}${video.path}`;
    const absoluteThumbnailUrl = `${req.protocol}://${req.get('host')}${video.thumbnailPath}`;

    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Embedit | ${video.title}</title><meta property="og:type" content="video.other"><meta property="og:title" content="${video.title}"><meta property="og:image" content="${absoluteThumbnailUrl}"><meta property="og:video" content="${absoluteVideoUrl}"><link rel="stylesheet" href="/style.css"><script>const theme=localStorage.getItem("theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.className=theme;</script></head><body class=""><header class="header"><a href="/" class="logo">embedit</a><a href="/" class="back-link">← All Videos</a></header><main class="container"><div class="watch-container"><h2>${video.title}</h2><p>Uploaded on ${new Date(video.uploadDate).toLocaleDateString()}</p><video controls autoplay src="${video.path}"></video></div></main></body></html>`);
});

// UPLOAD a new video (Non-blocking)
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file selected.' });
    
    const { deviceID, title } = req.body;
    if (!deviceID) return res.status(400).json({ message: 'Device ID required.' });
    
    const thumbnailFileName = `thumb-${path.parse(req.file.filename).name}.png`;
    const newVideo = {
        id: videos.length ? Math.max(...videos.map(v => v.id)) + 1 : 1,
        deviceID, title: title || 'Untitled', fileName: req.file.filename,
        path: `/uploads/${req.file.filename}`, thumbnailPath: `/placeholder.png`, // Use a placeholder initially
        uploadDate: new Date(), processing: true
    };
    videos.push(newVideo);
    saveDB();

    res.status(201).json({ video: newVideo });

    // Process thumbnail in the background
    try {
        ffmpeg(req.file.path)
            .on('end', () => {
                const videoIndex = videos.findIndex(v => v.id === newVideo.id);
                if (videoIndex !== -1) {
                    videos[videoIndex].thumbnailPath = `/thumbnails/${thumbnailFileName}`;
                    videos[videoIndex].processing = false;
                    saveDB();
                    console.log(`Thumbnail generated for video ID: ${newVideo.id}`);
                }
            })
            .on('error', (err) => {
                console.error(`FFMPEG background error for video ID ${newVideo.id}:`, err.message);
                const videoIndex = videos.findIndex(v => v.id === newVideo.id);
                if (videoIndex !== -1) {
                    videos[videoIndex].processing = false;
                    videos[videoIndex].thumbnailPath = `/thumbnail-error.png`;
                    saveDB();
                }
            })
            .screenshots({ count: 1, timestamps: ['50%'], filename: thumbnailFileName, folder: THUMBNAILS_DIR, size: '320x180' });
    } catch (error) {
        console.error("Critical error starting FFMPEG:", error);
    }
});

// DELETE a video
app.delete('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const { deviceID } = req.query;
    if (!deviceID) return res.status(403).json({ message: 'Permission denied.' });
    
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return res.status(404).json({ message: "Video not found" });

    if (videos[videoIndex].deviceID !== deviceID) {
        return res.status(403).json({ message: "This video does not belong to your device." });
    }

    try {
        const videoToDelete = videos[videoIndex];
        const videoPath = path.join(UPLOADS_DIR, videoToDelete.fileName);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        const thumbPath = path.join(THUMBNAILS_DIR, path.basename(videoToDelete.thumbnailPath));
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        videos.splice(videoIndex, 1);
        saveDB();
        res.status(200).json({ message: "Video deleted." });
    } catch (err) {
        res.status(500).json({ message: "Error deleting files." });
    }
});

// --- Start Server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));