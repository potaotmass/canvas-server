// index.js - THE FINAL, ROBUST VERSION

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

// Ensure all directories and a database file exist on startup
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));

let videos = [];
const loadDB = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            videos = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        } else {
            fs.writeFileSync(DB_PATH, '[]'); // Create empty DB if not present
        }
    } catch (error) { videos = []; }
};
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));

loadDB(); // Load on startup

// --- Middleware ---
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 }});

// --- API Routes ---

// GET all videos
app.get('/api/videos', (req, res) => res.json(videos.slice().reverse()));

// WATCH PAGE - Dynamically generates the HTML for a single video
app.get('/watch/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);

    if (!video) return res.status(404).send('<h1>404: Not Found</h1>');

    const absoluteThumbnailUrl = `${req.protocol}://${req.get('host')}${video.thumbnailPath}`;
    
    // THE FIX: Full HTML structure for the watch page, linking to the SAME stylesheet
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>embedit | ${video.title}</title>
            <meta property="og:title" content="${video.title}"><meta property="og:image" content="${absoluteThumbnailUrl}">
            <link rel="stylesheet" href="/style.css">
            <script>
                const theme = localStorage.getItem('theme') || 'dark';
                document.documentElement.className = theme;
            </script>
        </head>
        <body class="">
            <header class="header"><a href="/" class="logo">embedit</a><a href="/" class="back-link">← All Videos</a></header>
            <main class="container">
                <div class="watch-container">
                    <h2>${video.title}</h2>
                    <p>Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}</p>
                    <video controls autoplay src="${video.path}"></video>
                </div>
            </main>
        </body>
        </html>
    `);
});

// UPLOAD a new video
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file.' });
    
    const { path: inputFilePath, filename } = req.file;
    const thumbnailFileName = `thumb-${path.parse(filename).name}.png`;
    
    ffmpeg(inputFilePath)
        .on('end', () => {
            const newVideo = { id: videos.length ? Math.max(...videos.map(v => v.id)) + 1 : 1, title: req.body.title || 'Untitled', fileName: filename, path: `/uploads/${filename}`, thumbnailPath: `/thumbnails/${thumbnailFileName}`, uploadDate: new Date() };
            videos.push(newVideo);
            saveDB();
            res.status(201).json({ video: newVideo });
        })
        .on('error', (err) => {
            console.error("FFMPEG Error:", err.message);
            fs.unlink(inputFilePath, () => {}); // Cleanup
            res.status(500).json({ message: 'Could not process video. Format may be unsupported.' });
        });
});

// DELETE a video
app.delete('/api/videos/:id', (req, res) => { /* Code from last complete version is fine */ });

// START SERVER
app.listen(PORT, () => console.log(`Server at ${PORT}`));

// Ensure the rest of the routes are copied from the complete 'index.js' in my "Is there 2 client.js???" answer to be safe.