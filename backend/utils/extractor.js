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
 * Strategy 1: JSON Endpoint (?__a=1&__d=dis)
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
            timeout: 8000 // Short timeout to fail fast
        });

        const data = response.data;

        if (typeof data === 'string' && (data.includes('<!DOCTYPE html>') || data.includes('Login'))) {
            throw new Error('Received HTML instead of JSON');
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
                type: 'json_api',
                quality: 'high',
                videoUrl: videoUrl,
                filename: `insta_${media.id || Date.now()}.mp4`
            };
        }
        throw new Error('No video_url in JSON');

    } catch (e) {
        console.log(`[Strategy JSON] Failed: ${e.message}`);
        return null;
    }
};

/**
 * Strategy 2: Embed Page Scraping (/embed/captioned)
 * Often easier to scrape than the main page
 */
const tryEmbedExtraction = async (targetUrl) => {
    try {
        // Ensure trailing slash for embed url construction
        const baseUrl = targetUrl.endsWith('/') ? targetUrl : targetUrl + '/';
        const embedUrl = `${baseUrl}embed/captioned/`;
        console.log(`[Strategy Embed] Fetching ${embedUrl}...`);

        const response = await axios.get(embedUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.instagram.com/',
            },
            timeout: 10000
        });

        const html = response.data;

        // Pattern 1: Look for .mp4 inside the HTML directly
        // The embed page usually has a video tag or a JSON blob

        // Check for specific video_url pattern in embed JSON
        const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
        if (videoUrlMatch && videoUrlMatch[1]) {
            let vUrl = videoUrlMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            return {
                status: 'success',
                type: 'embed_json',
                videoUrl: vUrl
            };
        }

        // Pattern 2: scan for any .mp4 url (fallback)
        // Be careful not to match poster images
        const mp4Match = html.match(/https?:\/\/[^"']+\.mp4[^"']*/);
        if (mp4Match && mp4Match[0]) {
            let vUrl = mp4Match[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
            return {
                status: 'success',
                type: 'embed_regex',
                videoUrl: vUrl
            };
        }

        throw new Error('No video found in Embed HTML');

    } catch (e) {
        console.log(`[Strategy Embed] Failed: ${e.message}`);
        return null;
    }
};

/**
 * Strategy 3: Main Page HTML Scraping (Fallback)
 */
const tryHtmlExtraction = async (targetUrl) => {
    try {
        console.log(`[Strategy HTML] Fetching ${targetUrl}...`);
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
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

        // 2. Shared Data Regex
        const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
        if (videoUrlMatch && videoUrlMatch[1]) {
            let vUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
            return {
                status: 'success',
                type: 'html_regex',
                videoUrl: vUrl
            };
        }

        // Log snippet for debugging
        const snippet = html.substring(0, 300).replace(/\n/g, ' ');
        console.log(`[Strategy HTML] Failed. Snippet: ${snippet}`);

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

        // 2. Try Embed Page (NEW)
        const embedResult = await tryEmbedExtraction(targetUrl);
        if (embedResult) return embedResult;

        // 3. Try Main HTML Fallback
        const htmlResult = await tryHtmlExtraction(targetUrl);
        if (htmlResult) return htmlResult;

        throw new Error('All extraction strategies failed.');

    } catch (error) {
        console.error('Final Extraction Error:', error.message);
        throw new Error(error.message || 'Failed to extract video');
    }
};

module.exports = { extractVideoInfo };
