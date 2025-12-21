const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { extractVideoInfo } = require('./utils/extractor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON bodies
app.use(morgan('combined')); // Logging

// Fix for Render/Heroku proxied environments
app.set('trust proxy', 1);

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});
app.use('/extract', limiter);

// Routes
app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'Instagram Public Downloader API' });
});

app.post('/extract', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: 'error', message: 'URL is required' });
        }

        // Basic validation
        if (!url.includes('instagram.com') &&
            !url.includes('facebook.com') &&
            !url.includes('fb.watch')) {
            return res.status(400).json({ status: 'error', message: 'Invalid URL. Only Instagram & Facebook links supported.' });
        }

        const result = await extractVideoInfo(url);
        res.json(result);

    } catch (error) {
        console.error('API Error:', error.message);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            status: 'error',
            message: error.message || 'Failed to extract video'
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
