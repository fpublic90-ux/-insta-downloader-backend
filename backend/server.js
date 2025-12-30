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

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
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

// Keep-Alive Mechanism to prevent Render sleep
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

function keepAlive() {
    const https = require('https');
    const http = require('http');

    const protocol = RENDER_URL.startsWith('https') ? https : http;
    const healthUrl = `${RENDER_URL}/health`;

    protocol.get(healthUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`[Keep-Alive] Ping successful. Status: ${res.statusCode}, Response: ${data}`);
        });
    }).on('error', (err) => {
        console.error(`[Keep-Alive] Ping failed: ${err.message}`);
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Keep-alive enabled: Pinging ${RENDER_URL} every 14 minutes`);

    // Start keep-alive pings (only if deployed, not in local dev)
    if (process.env.RENDER_EXTERNAL_URL) {
        setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
        console.log('[Keep-Alive] Self-ping mechanism activated');
    } else {
        console.log('[Keep-Alive] Skipped (running locally)');
    }
});
