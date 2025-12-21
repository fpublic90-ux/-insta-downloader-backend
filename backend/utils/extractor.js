const axios = require('axios');
const { getRandomUserAgent } = require('./userAgents');

const cleanUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch (e) {
        return url;
    }
};

const getHeaders = () => ({
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'dnt': '1',
});

// JSON Strategy
const tryJsonExtraction = async (targetUrl) => {
    try {
        const jsonUrl = `${targetUrl}?__a=1&__d=dis`;
        console.log(`[Strategy JSON] Fetching ${jsonUrl}...`);
        const response = await axios.get(jsonUrl, { headers: getHeaders(), timeout: 8000 });
        const data = response.data;

        if (typeof data === 'string') throw new Error('Not JSON');

        const media = data.graphql?.shortcode_media || data.items?.[0];
        if (!media) throw new Error('No media found');
        if (!media.is_video) throw new Error('Not a video');

        return {
            status: 'success',
            type: 'json',
            videoUrl: media.video_url
        };
    } catch (e) {
        console.log(`[Strategy JSON] Failed: ${e.message}`);
        return null;
    }
};

// Embed Strategy
const tryEmbedExtraction = async (targetUrl) => {
    try {
        const baseUrl = targetUrl.endsWith('/') ? targetUrl : targetUrl + '/';
        const embedUrl = `${baseUrl}embed/captioned/`;
        console.log(`[Strategy Embed] Fetching ${embedUrl}...`);

        const response = await axios.get(embedUrl, { headers: getHeaders(), timeout: 10000 });
        const html = response.data;

        const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
        if (videoUrlMatch?.[1]) {
            return {
                status: 'success',
                type: 'embed_json',
                videoUrl: videoUrlMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '')
            };
        }
        return null;
    } catch (e) {
        console.log(`[Strategy Embed] Failed: ${e.message}`);
        return null;
    }
};

// HTML Strategy
const tryHtmlExtraction = async (targetUrl) => {
    try {
        console.log(`[Strategy HTML] Fetching ${targetUrl}...`);
        const response = await axios.get(targetUrl, { headers: getHeaders(), timeout: 15000 });
        const html = response.data;

        // OG Video
        const ogVideo = html.match(/<meta property="og:video" content="([^"]+)"/);
        if (ogVideo?.[1]) return { status: 'success', type: 'html_og', videoUrl: ogVideo[1].replace(/&amp;/g, '&') };

        // Twitter Stream
        const twitterStream = html.match(/<meta name="twitter:player:stream" content="([^"]+)"/);
        if (twitterStream?.[1]) return { status: 'success', type: 'html_twitter', videoUrl: twitterStream[1].replace(/&amp;/g, '&') };

        // Global Regex Search (Last Resort)
        // Look for any string that looks like an mp4 url inside quotes
        // This is risky but effective as a catch-all
        const globalMatch = html.match(/"(https:[^"]+\.mp4[^"]*)"/);
        if (globalMatch?.[1]) {
            // Validate it's an instagram CDN url to avoid ads/tracking pixels
            if (globalMatch[1].includes('cdninstagram') || globalMatch[1].includes('fbcdn')) {
                return {
                    status: 'success',
                    type: 'html_global_regex',
                    videoUrl: globalMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '')
                };
            }
        }

        console.log(`[Strategy HTML] Failed. HTML length: ${html.length}`);
        throw new Error('the srver is busy try again');
    } catch (e) {
        console.log(`[Strategy HTML] Failed: ${e.message}`);
        throw e;
    }
};

const tryFacebookExtraction = async (targetUrl) => {
    try {
        console.log(`[Strategy FB] Fetching ${targetUrl}...`);

        // Basic scraping for HD/SD sources
        // We need a widely compatible User-Agent for standard FB pages
        const headers = getHeaders();

        const response = await axios.get(targetUrl, { headers: headers, timeout: 15000 });
        const html = response.data;

        // 1. Check for hd_src (Video quality: HD)
        const hdMatch = html.match(/"hd_src":"([^"]+)"/);
        if (hdMatch?.[1]) {
            return {
                status: 'success',
                type: 'fb_hd',
                videoUrl: hdMatch[1].replace(/\\u0025/g, '%').replace(/\\/g, '')
            };
        }

        // 2. Check for sd_src (Video quality: SD)
        const sdMatch = html.match(/"sd_src":"([^"]+)"/);
        if (sdMatch?.[1]) {
            return {
                status: 'success',
                type: 'fb_sd',
                videoUrl: sdMatch[1].replace(/\\u0025/g, '%').replace(/\\/g, '')
            };
        }

        // 3. Check for og:video (Open Graph) - often works for public posts
        const ogVideo = html.match(/<meta property="og:video" content="([^"]+)"/);
        if (ogVideo?.[1]) {
            return {
                status: 'success',
                type: 'fb_og',
                videoUrl: ogVideo[1].replace(/&amp;/g, '&')
            };
        }

        console.log(`[Strategy FB] Failed to find video source in HTML.`);
        return null;
    } catch (e) {
        console.log(`[Strategy FB] Failed: ${e.message}`);
        return null;
    }
};

const extractVideoInfo = async (instagramUrl) => {
    try {
        const targetUrl = cleanUrl(instagramUrl);

        // ROUTING: Facebook vs Instagram
        if (targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch')) {
            const result = await tryFacebookExtraction(targetUrl);
            if (result) return result;
            throw new Error('Could not extract Facebook video. Make sure it is public.');
        }

        // Parallel execution for speed? No, sequential is safer for IPs.
        let result = await tryJsonExtraction(targetUrl);
        if (result) return result;

        result = await tryEmbedExtraction(targetUrl);
        if (result) return result;

        result = await tryHtmlExtraction(targetUrl);
        if (result) return result;

        throw new Error('All strategies failed');
    } catch (error) {
        throw new Error(error.message || 'Failed to extract video');
    }
};

module.exports = { extractVideoInfo };
