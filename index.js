// index.js

// 1. SETUP
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// const ffmpeg = require('fluent-ffmpeg'); // If you have ffmpeg installed

const app = express();
const PORT = process.env.PORT || 3000;

// --- Define our directories ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails'); // We'll generate thumbnails here

// Ensure all needed directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

let videos = [];
let nextVideoId = 1;

// 2. MIDDLEWARE
app.use(express.static('public')); // Serve frontend homepage
app.use('/uploads', express.static(UPLOADS_DIR)); // Serve uploaded videos
app.use('/thumbnails', express.static(THUMBNAILS_DIR)); // Serve thumbnails

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-')),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// 3. API ROUTES

// GET all videos for the homepage
app.get('/api/videos', (req, res) => {
    res.json(videos.slice().reverse());
});

// POST a new video upload
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const thumbnailFileName = `thumb-${path.parse(req.file.filename).name}.png`;

    const newVideo = {
        id: nextVideoId++,
        title: req.body.title || "Untitled Video",
        path: `/uploads/${req.file.filename}`,
        // For now, we will use a placeholder thumbnail. Real thumbnail generation is an advanced step.
        thumbnailPath: `/placeholder-thumbnail.png`, // Placeholder
        uploadDate: new Date().toISOString()
    };
    videos.push(newVideo);
    res.status(201).json({ message: 'Video uploaded!', video: newVideo });
});

// *** THIS IS THE NEW CORE FEATURE ***
// GET a dedicated, shareable page for a single video
app.get('/watch/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);

    if (!video) {
        return res.status(404).send('<h1>Error 404: Video Not Found</h1>');
    }
    
    // Construct the full URL for meta tags
    const absoluteVideoUrl = `${req.protocol}://${req.get('host')}${video.path}`;
    const absoluteThumbnailUrl = `${req.protocol}://${req.get('host')}${video.thumbnailPath}`;
    const pageUrl = `${req.protocol}://${req.get('host')}/watch/${video.id}`;

    // Dynamically generate the HTML with the correct meta tags
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${video.title}</title>
            
            <!-- Twitter Meta Tags -->
            <meta name="twitter:card" content="player">
            <meta name="twitter:title" content="${video.title}">
            <meta name="twitter:player" content="${absoluteVideoUrl}">
            <meta name="twitter:player:width" content="1280">
            <meta name="twitter:player:height" content="720">
            <meta name="twitter:image" content="${absoluteThumbnailUrl}">
            
            <!-- Open Graph / Facebook / Discord Meta Tags -->
            <meta property="og:type" content="video.other">
            <meta property="og:title" content="${video.title}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:image" content="${absoluteThumbnailUrl}">
            <meta property="og:video" content="${absoluteVideoUrl}">
            <meta property="og:video:type" content="video/mp4">
            <meta property="og:video:width" content="1280">
            <meta property="og:video:height" content="720">

            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <header>
                <h1><a href="/" style="color: #4CAF50; text-decoration: none;">Canvas Video Platform</a></h1>
            </header>
            <div class="container watch-container">
                <h2>${video.title}</h2>
                <p>Uploaded on ${new Date(video.uploadDate).toLocaleDateString()}</p>
                <video controls autoplay src="${video.path}"></video>
            </div>
        </body>
        </html>
    `;

    res.send(html);
});


// 4. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});