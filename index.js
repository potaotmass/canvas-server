// index.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// Define directories & DB path
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');
const DB_PATH = path.join(__dirname, 'db.json');

// Setup: Ensure all directories and a database file exist on startup
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

let videos = [];
const loadDB = () => {
    if (fs.existsSync(DB_PATH)) {
        try {
            videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            console.log("Database loaded.");
        } catch (error) {
            console.error("Error parsing db.json, starting fresh:", error);
            videos = [];
        }
    }
};
const saveDB = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
    } catch (error) {
        console.error("Error saving to database:", error);
    }
};

loadDB(); // Load the database when the server starts!

// --- Middleware ---
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '-'))
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 }});

// --- API ROUTES ---

// GET all videos
app.get('/api/videos', (req, res) => {
    res.json(videos.slice().reverse());
});

// GET the watch page
app.get('/watch/:id', (req, res) => {
    // This route code is perfect from the last 'embedit' version. Re-use that here.
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);
    if (!video) return res.status(404).send('<h1>Not Found</h1>');
    
    // ... all the meta tag and HTML generation logic
    const absoluteVideoUrl = `${req.protocol}://${req.get('host')}${video.path}`;
    const html = `<!DOCTYPE html>... etc ...`; // (Use the full HTML string from before)
    res.send(html);
});

// POST a new video
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    
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
            saveDB(); // <-- CRITICAL: Save the change
            res.status(201).json({ video: newVideo });
        })
        .on('error', (err) => {
            fs.unlink(inputFilePath, () => {}); // Clean up failed upload
            res.status(500).json({ message: 'Could not process video thumbnail.' });
        })
        .screenshots({ count: 1, timestamps: ['50%'], filename: thumbnailFileName, folder: THUMBNAILS_DIR, size: '320x180' });
});

// DELETE a video
app.delete('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const videoIndex = videos.findIndex(v => v.id === videoId);

    if (videoIndex === -1) return res.status(404).json({ message: "Video not found" });

    const videoToDelete = videos[videoIndex];

    try {
        const videoPath = path.join(UPLOADS_DIR, videoToDelete.fileName);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

        const thumbPath = path.join(THUMBNAILS_DIR, path.basename(videoToDelete.thumbnailPath));
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

        videos.splice(videoIndex, 1);
        saveDB(); // <-- CRITICAL: Save the change

        res.status(200).json({ message: "Video deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting files." });
    }
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));