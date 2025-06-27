// index.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Define Directories ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');
const DB_PATH = path.join(__dirname, 'db.json');

// --- Setup ---
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
let videos = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH)) : [];
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2));

// --- Middleware ---
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-')),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// --- API ROUTES ---

// GET all videos
app.get('/api/videos', (req, res) => res.json(videos.slice().reverse()));

// POST a new video upload with robust error handling
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const inputFilePath = req.file.path;
    const thumbnailFileName = `thumb-${path.parse(req.file.filename).name}.png`;
    const thumbnailFilePath = path.join(THUMBNAILS_DIR, thumbnailFileName);

    ffmpeg(inputFilePath)
        .on('end', () => {
            console.log('Thumbnail generated for', req.file.filename);
            const newVideo = {
                id: videos.length > 0 ? Math.max(...videos.map(v => v.id)) + 1 : 1,
                title: req.body.title || "Untitled Video",
                fileName: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                thumbnailPath: `/thumbnails/${thumbnailFileName}`,
                uploadDate: new Date().toISOString()
            };
            videos.push(newVideo);
            saveDB();
            // ALWAYS send a success response
            res.status(201).json({ message: 'Video uploaded!', video: newVideo });
        })
        .on('error', (err) => {
            console.error('Error during thumbnail generation:', err.message);
            // Cleanup the failed upload
            fs.unlink(inputFilePath, (unlinkErr) => {
                if (unlinkErr) console.error("Failed to delete orphaned video file:", unlinkErr);
            });
            // ALWAYS send an error response
            res.status(500).json({ message: "Could not process video. It may be a corrupted or unsupported format." });
        })
        .screenshots({ count: 1, timestamps: ['50%'], filename: thumbnailFileName, folder: THUMBNAILS_DIR, size: '320x180' });
});

// GET the watch page
app.get('/watch/:id', (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const video = videos.find(v => v.id === videoId);

    if (!video) return res.status(404).send('<h1>Error 404: Video Not Found</h1><a href="/">Go Back Home</a>');

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
        <body class=""> <!-- Class is set by script -->
            <header class="header">
                <a href="/" class="logo">embedit</a>
                <a href="/" style="color: var(--text-color); text-decoration: none;">← Back to All Videos</a>
            </header>
            <main class="container">
                <div class="watch-container">
                    <h2>${video.title}</h2>
                    <p>Uploaded on ${new Date(video.uploadDate).toLocaleDateString()}</p>
                    <video controls autoplay src="${video.path}"></video>
                </div>
            </main>
        </body>
        </html>
    `;
    res.send(html);
});

// --- Start Server ---
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));