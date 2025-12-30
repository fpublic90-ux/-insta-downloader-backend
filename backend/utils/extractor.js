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

        console.log(`[Strategy HTML] Received HTML length: ${html.length}`);

        // Pattern 1: OG Video
        const ogVideo = html.match(/<meta property="og:video" content="([^"]+)"/);
        if (ogVideo?.[1]) {
            console.log(`[Strategy HTML] ✓ Found via og:video`);
            return { status: 'success', type: 'html_og', videoUrl: ogVideo[1].replace(/&amp;/g, '&') };
        }

        // Pattern 2: Twitter Stream
        const twitterStream = html.match(/<meta name="twitter:player:stream" content="([^"]+)"/);
        if (twitterStream?.[1]) {
            console.log(`[Strategy HTML] ✓ Found via twitter:player:stream`);
            return { status: 'success', type: 'html_twitter', videoUrl: twitterStream[1].replace(/&amp;/g, '&') };
        }

        // Pattern 3: video_url in JSON (most common for reels)
        const videoUrlJson = html.match(/"video_url":"([^"]+)"/);
        if (videoUrlJson?.[1]) {
            const url = videoUrlJson[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            if (url.includes('cdninstagram') || url.includes('fbcdn')) {
                console.log(`[Strategy HTML] ✓ Found via video_url JSON`);
                return { status: 'success', type: 'html_video_url_json', videoUrl: url };
            }
        }

        // Pattern 4: playback_url in JSON
        const playbackUrl = html.match(/"playback_url":"([^"]+)"/);
        if (playbackUrl?.[1]) {
            const url = playbackUrl[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            if (url.includes('cdninstagram') || url.includes('fbcdn')) {
                console.log(`[Strategy HTML] ✓ Found via playback_url JSON`);
                return { status: 'success', type: 'html_playback_url', videoUrl: url };
            }
        }

        // Pattern 5: Global .mp4 search
        const globalMp4 = html.match(/"(https:[^"]+\.mp4[^"]*)"/);
        if (globalMp4?.[1]) {
            const url = globalMp4[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            if (url.includes('cdninstagram') || url.includes('fbcdn')) {
                console.log(`[Strategy HTML] ✓ Found via global .mp4 search`);
                return { status: 'success', type: 'html_global_mp4', videoUrl: url };
            }
        }

        // Pattern 6: Look for any Instagram CDN video URL
        const cdnVideo = html.match(/"(https:\/\/[^"]*(?:cdninstagram|fbcdn)[^"]*(?:\.mp4|\/video)[^"]*)"/);
        if (cdnVideo?.[1]) {
            const url = cdnVideo[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            console.log(`[Strategy HTML] ✓ Found via CDN pattern`);
            return { status: 'success', type: 'html_cdn_pattern', videoUrl: url };
        }

        // Debug: Show what we're getting
        console.log(`[Strategy HTML] ✗ No patterns matched`);
        console.log(`[Strategy HTML] Checking for common indicators...`);
        console.log(`  - Contains "video_url": ${html.includes('video_url')}`);
        console.log(`  - Contains "playback_url": ${html.includes('playback_url')}`);
        console.log(`  - Contains "cdninstagram": ${html.includes('cdninstagram')}`);
        console.log(`  - Contains "fbcdn": ${html.includes('fbcdn')}`);
        console.log(`  - Contains ".mp4": ${html.includes('.mp4')}`);

        // Log a snippet to help debug
        const snippet = html.substring(0, 500).replace(/\n/g, ' ');
        console.log(`[Strategy HTML] Preview: ${snippet}`);

        throw new Error('Could not extract video. Possible reasons: 1) Post is private or deleted, 2) Invalid URL, 3) Instagram changed their structure, or 4) Content type not supported. Please try a different public post or reel.');
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
