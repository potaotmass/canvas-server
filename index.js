// index.js - FINAL VERSION WITH DEVICE ID AUTHENTICATION

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Directories & Database (Unchanged) ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');
const DB_PATH = path.join(__dirname, 'db.json');
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));

let videos = [];
const loadDB = () => { try { if (fs.existsSync(DB_PATH)) { const data = fs.readFileSync(DB_PATH, 'utf-8'); videos = data.length ? JSON.parse(data) : []; } else { fs.writeFileSync(DB_PATH, '[]'); } } catch (e) { videos = []; } };
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
loadDB();

// --- Middleware (Unchanged) ---
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// --- API ROUTES (MODIFIED FOR DEVICE ID) ---

// GET videos for a specific device
app.get('/api/videos', (req, res) => {
    const { deviceID } = req.query;
    if (!deviceID) return res.status(400).json({ message: 'Device ID is required.' });
    const deviceVideos = videos.filter(v => v.deviceID === deviceID);
    res.json(deviceVideos.slice().reverse());
});

// WATCH PAGE (Unchanged, public links work for anyone)
app.get('/watch/:id', (req, res) => {
    const video = videos.find(v => v.id === parseInt(req.params.id, 10));
    if (!video) return res.status(404).send('<h1>404: Not Found</h1>');
    const pageUrl = `${req.protocol}://${req.get('host')}/watch/${video.id}`;
    const absoluteVideoUrl = `${req.protocol}://${req.get('host')}${video.path}`;
    const absoluteThumbnailUrl = `${req.protocol}://${req.get('host')}${video.thumbnailPath}`;
    res.send(`<!DOCTYPE html><html lang="en"><head><title>embedit | ${video.title}</title><meta property="og:type" content="video.other"><meta property="og:title" content="${video.title}"><meta property="og:image" content="${absoluteThumbnailUrl}"><meta property="og:video" content="${absoluteVideoUrl}"><link rel="stylesheet" href="/style.css"><script>const theme=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.className=theme;</script></head><body class=""><header class="header"><a href="/" class="logo">embedit</a><a href="/" class="back-link">← All Videos</a></header><main class="container"><div class="watch-container"><h2>${video.title}</h2><p>Uploaded by an embedit user on ${new Date(video.uploadDate).toLocaleDateString()}</p><video controls autoplay src="${video.path}"></video></div></main></body></html>`);
});


// UPLOAD a new video, associating it with a device
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file.' });
    
    const { deviceID, title } = req.body;
    if (!deviceID) return res.status(400).json({ message: 'Device ID is required for upload.' });
    
    const { path: inputFilePath, filename } = req.file;
    const thumbnailFileName = `thumb-${path.parse(filename).name}.png`;
    
    try {
        ffmpeg(inputFilePath)
            .on('end', () => {
                const newVideo = { id: videos.length ? Math.max(...videos.map(v => v.id)) + 1 : 1, deviceID: deviceID, title: title || 'Untitled', fileName: filename, path: `/uploads/${filename}`, thumbnailPath: `/thumbnails/${thumbnailFileName}`, uploadDate: new Date() };
                videos.push(newVideo);
                saveDB();
                res.status(201).json({ video: newVideo });
            })
            .on('error', (err) => {
                fs.unlink(inputFilePath, () => {});
                res.status(500).json({ message: 'Could not process video.' });
            });
    } catch (error) {
        fs.unlink(inputFilePath, () => {});
        res.status(500).json({ message: 'Server error with FFMPEG.' });
    }
});

// DELETE a video, ensuring the device owns it
app.delete('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const { deviceID } = req.query;

    if (!deviceID) return res.status(403).json({ message: 'Permission denied.' });
    
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return res.status(404).json({ message: "Video not found." });

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));