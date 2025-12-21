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
 * Main extraction function
 */
const extractVideoInfo = async (instagramUrl) => {
    try {
        const targetUrl = cleanUrl(instagramUrl);

        // Strategy: Use the ?__a=1&__d=dis endpoint to get JSON directly
        // This is often more reliable for public posts than scraping HTML
        const jsonUrl = `${targetUrl}?__a=1&__d=dis`;

        console.log(`Fetching ${jsonUrl}...`);

        const response = await axios.get(jsonUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Upgrade-Insecure-Requests': '1',
            },
            timeout: 30000 // Increased to 30s
        });

        const data = response.data;

        if (!data) {
            throw new Error('Empty response from Instagram');
        }

        // Handle JSON response
        // Structure usually: graphql.shortcode_media
        // Or sometimes just items[0]

        let media = null;
        if (data.graphql && data.graphql.shortcode_media) {
            media = data.graphql.shortcode_media;
        } else if (data.items && data.items.length > 0) {
            media = data.items[0];
        }

        if (!media) {
            // Fallback to HTML scraping if JSON fails or is weird
            // But usually if __a=1 returns HTML, it's a login page redirect
            if (typeof data === 'string' && data.includes('Login • Instagram')) {
                throw new Error('Instagram blocked the request (Login Wall).');
            }
            throw new Error('Could not find media data in JSON response.');
        }

        if (!media.is_video) {
            throw new Error('Post is not a video.');
        }

        // Get video URL
        // video_url might be directly available
        // or in video_versions
        let videoUrl = media.video_url;

        // Try to find best quality
        if (media.video_versions && media.video_versions.length > 0) {
            const best = media.video_versions.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
            videoUrl = best.url;
            return {
                status: 'success',
                quality: 'original',
                resolution: `${best.width}x${best.height}`,
                videoUrl: videoUrl
            };
        }

        if (videoUrl) {
            return {
                status: 'success',
                quality: 'standard',
                resolution: `${media.dimensions ? media.dimensions.width + 'x' + media.dimensions.height : 'unknown'}`,
                videoUrl: videoUrl
            };
        }

        throw new Error('No video URL found in media data.');

    } catch (error) {
        console.error('Extraction Error:', error.message);
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timed out (Instagram is slow/throttling).');
        }
        // Differentiate errors
        if (error.response && error.response.status === 404) {
            throw new Error('Post not found');
        } else if (error.response && (error.response.status === 403 || error.response.status === 401)) {
            throw new Error('Access denied (Private post?)');
        }
        throw new Error(error.message || 'Failed to extract video');
    }
};

module.exports = { extractVideoInfo };
