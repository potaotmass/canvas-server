// index.js

// 1. SETUP
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Define our directories ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');

// Ensure all needed directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

// --- Mock Database (Persisting video data) ---
// To make sure our video list survives restarts on Render, we'll use a simple JSON file.
const DB_PATH = path.join(__dirname, 'db.json');
let videos = [];
const loadDB = () => {
    if (fs.existsSync(DB_PATH)) {
        videos = JSON.parse(fs.readFileSync(DB_PATH));
    }
};
const saveDB = () => {
    fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));
};
loadDB(); // Load the database on startup


// 2. MIDDLEWARE
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

const storage = multer.diskStorage({ /* ... same as before ... */ });
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });


// 3. API ROUTES

// GET all videos
app.get('/api/videos', (req, res) => res.json(videos.slice().reverse()));

// POST to upload a new video
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const inputFilePath = req.file.path;
    const thumbnailFileName = `thumb-${path.parse(req.file.filename).name}.png`;
    const thumbnailFilePath = path.join(THUMBNAILS_DIR, thumbnailFileName);
    
    // ** REAL THUMBNAIL GENERATION **
    ffmpeg(inputFilePath)
        .on('end', () => {
            console.log('Thumbnail generated for', req.file.filename);
            const newVideo = {
                // Find the highest existing ID and add 1
                id: videos.length > 0 ? Math.max(...videos.map(v => v.id)) + 1 : 1,
                title: req.body.title || "Untitled Video",
                fileName: req.file.filename, // Store original file name to delete it later
                path: `/uploads/${req.file.filename}`,
                thumbnailPath: `/thumbnails/${thumbnailFileName}`,
                uploadDate: new Date().toISOString()
            };
            videos.push(newVideo);
            saveDB(); // Save to our JSON database
            res.status(201).json({ message: 'Video uploaded!', video: newVideo });
        })
        .on('error', (err) => {
            console.error('Error generating thumbnail:', err);
            // Even if thumbnail fails, we should still allow the upload.
            // But first, let's delete the uploaded video file to prevent orphans.
            fs.unlink(inputFilePath, () => {});
            res.status(500).json({ message: "Could not process video thumbnail." });
        })
        .screenshots({
            count: 1,
            timestamps: ['50%'], // A single screenshot from the middle of the video
            filename: thumbnailFileName,
            folder: THUMBNAILS_DIR,
            size: '320x180'
        });
});

// GET the watch page
app.get('/watch/:id', (req, res) => { /* ... same as before, no changes needed ... */ });

// *** NEW DELETE ROUTE ***
app.delete('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const videoIndex = videos.findIndex(v => v.id === videoId);

    if (videoIndex === -1) {
        return res.status(404).json({ message: "Video not found" });
    }

    // Get the video object before deleting its metadata
    const videoToDelete = videos[videoIndex];

    try {
        // Delete the video file
        const videoPath = path.join(UPLOADS_DIR, videoToDelete.fileName);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

        // Delete the thumbnail file
        const thumbFileName = path.basename(videoToDelete.thumbnailPath);
        const thumbPath = path.join(THUMBNAILS_DIR, thumbFileName);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

        // Remove the video from our database array and save
        videos.splice(videoIndex, 1);
        saveDB();

        console.log(`Deleted video ${videoId} and its files.`);
        res.status(200).json({ message: "Video deleted successfully" });
    } catch (err) {
        console.error("Error deleting files:", err);
        res.status(500).json({ message: "Error deleting video files." });
    }
});


// 4. START SERVER
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));