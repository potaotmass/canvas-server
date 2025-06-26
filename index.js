// 1. SETUP - Import required packages
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = 'fs'; // For a more robust app, use a real DB like SQLite or Mongo

const app = express();
const PORT = process.env.PORT || 3000;

// --- Mock Database (in a real app, use a real database) ---
let videos = []; 
let nextVideoId = 1;


// 2. MIDDLEWARE - Configure Express and Multer

// Serve the static frontend files (HTML, JS) from the 'public' directory
app.use(express.static('public'));

// Serve the uploaded video files statically from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // The destination folder for uploads
    },
    filename: function (req, file, cb) {
        // Create a unique filename to avoid overwriting files
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// 3. API ROUTES - Define how the server responds to requests

// Route to get the list of all videos
app.get('/api/videos', (req, res) => {
    res.json(videos);
});

// Route to handle video uploads
// 'videoFile' must match the name attribute of the file input in the HTML form
app.post('/api/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Create a new video object with metadata
    const newVideo = {
        id: nextVideoId++,
        title: req.body.title, // 'title' comes from the form data
        description: "A cool video.",
        fileName: req.file.filename,
        path: `/uploads/${req.file.filename}` // The path to access the video
    };
    
    // "Save" the video metadata to our mock database
    videos.push(newVideo);
    
    console.log('Video uploaded:', newVideo);
    
    // Send a success response back to the client
    res.status(201).json({ message: 'Video uploaded successfully!', video: newVideo });
});


// 4. START SERVER - Tell the app to start listening for requests
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('Video content will be available from the /uploads directory.');
});