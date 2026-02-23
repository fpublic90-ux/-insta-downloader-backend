const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const https = require('https');
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
    res.json({ status: 'running', message: 'VidSaver Downloader API — Instagram, Facebook, YouTube' });
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

// YouTube Shorts Downloader via RapidAPI
app.post('/extract-yt', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: 'error', message: 'URL is required' });
        }

        // Extract video ID from URL
        let videoId = null;
        const shortsMatch = url.match(/youtube\.com\/shorts\/([\w-]+)/);
        const watchMatch = url.match(/[?&]v=([\w-]+)/);
        const ytbeMatch = url.match(/yt\.be\/([\w-]+)/);
        const youtubeMatch = url.match(/youtu\.be\/([\w-]+)/);

        if (shortsMatch) videoId = shortsMatch[1];
        else if (watchMatch) videoId = watchMatch[1];
        else if (ytbeMatch) videoId = ytbeMatch[1];
        else if (youtubeMatch) videoId = youtubeMatch[1];

        if (!videoId) {
            return res.status(400).json({ status: 'error', message: 'Could not extract YouTube video ID from URL' });
        }

        const rapidApiKey = process.env.RAPIDAPI_KEY;
        if (!rapidApiKey) {
            return res.status(500).json({ status: 'error', message: 'YouTube API not configured' });
        }

        // Call RapidAPI YouTube Media Downloader
        const apiResult = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'youtube-media-downloader.p.rapidapi.com',
                path: `/v2/video/details?videoId=${videoId}`,
                method: 'GET',
                headers: {
                    'x-rapidapi-key': rapidApiKey,
                    'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com'
                }
            };

            const apiReq = https.request(options, (apiRes) => {
                let data = '';
                apiRes.on('data', chunk => data += chunk);
                apiRes.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid API response'));
                    }
                });
            });
            apiReq.on('error', reject);
            apiReq.end();
        });

        if (!apiResult || apiResult.status === false) {
            return res.status(404).json({ status: 'error', message: 'Video not found or unavailable' });
        }

        // Logging the response structure for debugging (only if video not found)
        const videos = apiResult.videos?.items || apiResult.videos || [];
        const audios = apiResult.audios?.items || apiResult.audios || [];

        if (videos.length === 0) {
            console.warn('[YouTube] No videos found in API response. Keys:', Object.keys(apiResult));
            console.log('[YouTube] Full Response snippet:', JSON.stringify(apiResult).substring(0, 500));
        }

        // Try to find a merged video (has both audio+video)
        // Priority: MP4 with Audio > Any MP4 > Any Video
        let bestVideo = videos.find(v => v.hasAudio && v.extension === 'mp4') ||
            videos.find(v => v.extension === 'mp4') ||
            videos.find(v => v.hasAudio) ||
            videos[0];

        if (!bestVideo) {
            return res.status(404).json({
                status: 'error',
                message: 'No downloadable video found',
                debug: { hasVideos: videos.length > 0, keys: Object.keys(apiResult) }
            });
        }

        res.json({
            status: 'success',
            videoUrl: bestVideo.url,
            resolution: bestVideo.quality || bestVideo.height ? `${bestVideo.height}p` : 'HD',
            title: apiResult.title || 'YouTube Video',
            thumbnail: apiResult.thumbnail?.url || '',
            duration: apiResult.lengthSeconds || 0,
        });

    } catch (error) {
        console.error('[YouTube] API Error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to extract YouTube video'
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
