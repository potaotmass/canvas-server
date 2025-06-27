// index.js

// 1. SETUP
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

let videos = [];
let nextVideoId = 1;

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 2. MIDDLEWARE
app.use(express.static('public')); // Serve frontend files
app.use('/uploads', express.static(UPLOADS_DIR)); // Serve video files

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } });

// 3. API ROUTES

// GET all videos (for the homepage list)
app.get('/api/videos', (req, res) => {
    // Send newest videos first
    const sortedVideos = videos.slice().reverse();
    res.json(sortedVideos);
});

// *** NEW ROUTE ***
// GET a single video's data by its ID
app.get('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);

    if (video) {
        res.json(video);
    } else {
        res.status(404).json({ message: 'Video not found' });
    }
});

// POST to upload a new video
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file was uploaded.' });
    }
    const newVideo = {
        id: nextVideoId++,
        title: req.body.title || "Untitled Video",
        path: `/uploads/${req.file.filename}`,
        uploadDate: new Date().toISOString() // Add a timestamp!
    };
    videos.push(newVideo);
    console.log('Video uploaded:', newVideo);
    res.status(201).json({ message: 'Video uploaded successfully!', video: newVideo });
});


// 4. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});