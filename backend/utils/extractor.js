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
 * Strategy 1: JSON Endpoint
 */
const tryJsonExtraction = async (targetUrl) => {
    try {
        const jsonUrl = `${targetUrl}?__a=1&__d=dis`;
        console.log(`[Strategy JSON] Fetching ${jsonUrl}...`);

        const response = await axios.get(jsonUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 10000
        });

        const data = response.data;

        // Check if we got HTML instead of JSON (Login Wall)
        if (typeof data === 'string' && (data.includes('<!DOCTYPE html>') || data.includes('Login'))) {
            throw new Error('Received HTML instead of JSON (Login Wall)');
        }

        let media = null;
        if (data.graphql && data.graphql.shortcode_media) {
            media = data.graphql.shortcode_media;
        } else if (data.items && data.items.length > 0) {
            media = data.items[0];
        }

        if (!media) throw new Error('No media data found in JSON');
        if (!media.is_video) throw new Error('Target is not a video');

        let videoUrl = media.video_url;

        // Try to find best quality
        if (media.video_versions && media.video_versions.length > 0) {
            const best = media.video_versions.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
            videoUrl = best.url;
        }

        if (videoUrl) {
            return {
                status: 'success',
                type: 'json',
                quality: 'high',
                videoUrl: videoUrl,
                filename: `insta_${media.id}.mp4`
            };
        }
        throw new Error('No video_url in JSON');

    } catch (e) {
        console.log(`[Strategy JSON] Failed: ${e.message}`);
        return null;
    }
};

/**
 * Strategy 2: HTML Scraping (HTML Fallback)
 */
const tryHtmlExtraction = async (targetUrl) => {
    try {
        console.log(`[Strategy HTML] Fetching ${targetUrl}...`);
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Connection': 'keep-alive',
            },
            timeout: 15000
        });

        const html = response.data;

        // 1. Check Meta Tags (og:video)
        const ogVideo = html.match(/<meta property="og:video" content="([^"]+)"/);
        if (ogVideo && ogVideo[1]) {
            return {
                status: 'success',
                type: 'html_og',
                videoUrl: ogVideo[1].replace(/&amp;/g, '&')
            };
        }

        const ogVideoSecure = html.match(/<meta property="og:video:secure_url" content="([^"]+)"/);
        if (ogVideoSecure && ogVideoSecure[1]) {
            return {
                status: 'success',
                type: 'html_og_secure',
                videoUrl: ogVideoSecure[1].replace(/&amp;/g, '&')
            };
        }

        // 2. Check SharedData (JSON inside script)
        // Look for window._sharedData = {...} or similar structures
        // This is complex regex, but we can look for "video_url":"..."
        const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
        if (videoUrlMatch && videoUrlMatch[1]) {
            // Usually escaped unicode, need to unescape
            let vUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
            return {
                status: 'success',
                type: 'html_regex',
                videoUrl: vUrl
            };
        }

        // 3. Twitter Card
        const twitterStream = html.match(/<meta name="twitter:player:stream" content="([^"]+)"/);
        if (twitterStream && twitterStream[1]) {
            return {
                status: 'success',
                type: 'html_twitter',
                videoUrl: twitterStream[1].replace(/&amp;/g, '&')
            };
        }

        console.log('[Strategy HTML] No patterns matched.');
        if (html.includes('Login • Instagram')) {
            throw new Error('Login Wall (HTML)');
        }

        throw new Error('No video found in HTML');

    } catch (e) {
        console.log(`[Strategy HTML] Failed: ${e.message}`);
        throw e;
    }
};

/**
 * Main extraction function
 */
const extractVideoInfo = async (instagramUrl) => {
    try {
        const targetUrl = cleanUrl(instagramUrl);

        // 1. Try JSON
        const jsonResult = await tryJsonExtraction(targetUrl);
        if (jsonResult) return jsonResult;

        // 2. Try HTML Fallback
        const htmlResult = await tryHtmlExtraction(targetUrl);
        if (htmlResult) return htmlResult;

        throw new Error('All extraction strategies failed.');

    } catch (error) {
        console.error('Final Extraction Error:', error.message);
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timed out (Instagram is slow/throttling).');
        }

        const status = 500;
        const message = error.message;

        // Normalize errors for API response
        if (message.includes('Page Not Found') || message.includes('404')) {
            throw new Error('Post not found (404)');
        }

        throw new Error(message || 'Failed to extract video');
    }
};

module.exports = { extractVideoInfo };
