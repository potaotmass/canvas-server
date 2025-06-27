// 1. SETUP - Import required packages
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // THE FIX: This now correctly imports the File System module

const app = express();
const PORT = process.env.PORT || 3000; // Ready for deployment
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// --- Mock Database ---
let videos = [];
let nextVideoId = 1;


// --- ENSURE UPLOAD DIRECTORY EXISTS ---
// Now this code will work correctly because `fs` is the proper module.
if (!fs.existsSync(UPLOADS_DIR)){
    console.log(`Creating directory for uploads: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}


// 2. MIDDLEWARE - Configure Express and Multer

app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100 MB limit
});


// 3. API ROUTES - With robust error handling

app.get('/api/videos', (req, res) => {
    res.json(videos);
});

app.post('/api/upload', (req, res) => {
    const uploader = upload.single('videoFile');
    
    uploader(req, res, function (err) {
        if (err) {
            console.error("An error occurred during upload:", err);
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        }
        
        if (!req.file) {
            return res.status(400).json({ message: 'No file was uploaded.' });
        }

        const newVideo = {
            id: nextVideoId++,
            title: req.body.title || "Untitled Video",
            fileName: req.file.filename,
            path: `/uploads/${req.file.filename}`
        };

        videos.push(newVideo);
        console.log('Video uploaded successfully:', newVideo);
        
        res.status(201).json({ message: 'Video uploaded successfully!', video: newVideo });
    });
});


// 4. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});