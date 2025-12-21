const axios = require('axios');
const { getRandomUserAgent } = require('./userAgents');

/**
 * Clean URL to remove query parameters
 */
const cleanUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch (e) {
        return url;
    }
};

/**
 * Extracts JSON data from Instagram HTML
 */
const extractSharedData = (html) => {
    // Attempt to find shared data patterns
    const patterns = [
        /<script type="application\/ld\+json">(\s*{.*?}\s*)<\/script>/s,
        /window\._sharedData\s*=\s*({.*?});/s,
        /__additionalDataLoaded\('[^']+',\s*({.*?})\);/s
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {
                console.error('JSON parse error:', e);
                continue;
            }
        }
    }
    return null;
};

/**
 * Main extraction function
 */
const extractVideoInfo = async (instagramUrl) => {
    try {
        const targetUrl = cleanUrl(instagramUrl);

        // 1. Fetch HTML
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.instagram.com/',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Upgrade-Insecure-Requests': '1',
            },
            timeout: 10000 // 10s timeout
        });

        const html = response.data;

        // 2. Try to find GraphQL data or Shared Data
        // Note: Instagram changes this frequently. This is a best-effort robust approach.
        // We grep for "video_versions" specifically if full JSON parse fails or as a fallback.

        let videoVersions = [];
        let width = 0;
        let height = 0;

        // Strategy A: Regex for video_versions directly (Most robust for public extraction)
        // Look for: "video_versions":[{"type":101,"width":...}]
        const videoVersionsMatch = html.match(/"video_versions":\s*(\[.*?\])/);

        if (videoVersionsMatch && videoVersionsMatch[1]) {
            try {
                videoVersions = JSON.parse(videoVersionsMatch[1]);
            } catch (e) {
                console.error('Failed to parse video_versions regex match');
            }
        }

        if (!videoVersions || videoVersions.length === 0) {
            // Strategy B: Legacy shared data
            const jsonData = extractSharedData(html);
            // Traverse typically: entry_data.PostPage[0].graphql.shortcode_media.video_versions
            // Or structured data
            // This part is highly variable, so Regex A is preferred.
        }

        if (!videoVersions || videoVersions.length === 0) {
            // Strategy C: Graphql meta tag
            const metaVideo = html.match(/<meta property="og:video" content="([^"]+)"/);
            if (metaVideo && metaVideo[1]) {
                return {
                    status: 'success',
                    quality: 'standard', // Cannot determine without list
                    resolution: 'unknown',
                    videoUrl: metaVideo[1].replace(/&amp;/g, '&')
                };
            }
            throw new Error('No video found. Post might be private or not a video.');
        }

        // 3. Sort by quality (Resolution > Bandwidth)
        // Highest resolution (width * height)
        videoVersions.sort((a, b) => {
            const resA = (a.width || 0) * (a.height || 0);
            const resB = (b.width || 0) * (b.height || 0);
            return resB - resA;
        });

        const bestVideo = videoVersions[0];

        return {
            status: 'success',
            quality: 'original',
            resolution: `${bestVideo.width}x${bestVideo.height}`,
            videoUrl: bestVideo.url
        };

    } catch (error) {
        console.error('Extraction Error:', error.message);
        // Differentiate errors
        if (error.response && error.response.status === 404) {
            throw new Error('Post not found');
        } else if (error.response && (error.response.status === 403 || error.response.status === 401)) {
            throw new Error('Access denied (Private post?)');
        }
        throw error;
    }
};

module.exports = { extractVideoInfo };
