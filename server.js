/* ========================================
   Challenge XAi — Node.js Server
   Static file serving + Fish Audio TTS proxy
   ======================================== */

// Load environment variables (.env) — with fallback if dotenv not installed
try {
    require('dotenv').config();
} catch (e) {
    // Graceful fallback parser
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
            for (const line of lines) {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let val = (match[2] || '').trim();
                    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                    if (!process.env[key]) process.env[key] = val;
                }
            }
        }
    } catch (_) {}
}

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = process.env.PORT || 8090;
const ROOT_DIR = path.join(__dirname, 'public');

// Fish Audio configuration (loaded from .env)
const FISH_API_KEY  = process.env.FISH_API_KEY  || '';
const FISH_VOICE_ID = process.env.FISH_VOICE_ID || '';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.mp3':  'audio/mpeg',
    '.wav':  'audio/wav',
    '.fbx':  'application/octet-stream',
    '.glb':  'model/gltf-binary',
    '.gltf': 'model/gltf+json',
};

// In-memory TTS cache for instant playback of repeated speech
if (!global.ttsCache) global.ttsCache = new Map();

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname  = parsedUrl.pathname;

    // ─── Client Config Endpoint (injects GROQ key to frontend) ────────
    if (pathname === '/api/config' && req.method === 'GET') {
        const config = {
            GROQ_API_KEY: process.env.GROQ_API_KEY || ''
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(config));
        return;
    }

    // ─── Fish Audio TTS Proxy ───────────────────────────────────────────
    if ((pathname === '/api/fish-tts' || pathname === '/api/tts') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body || '{}');
                const text = (data.text || '').trim();

                if (!text) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Text required' }));
                    return;
                }

                // Serve from cache if available (0 ms latency)
                if (global.ttsCache.has(text)) {
                    const cached = global.ttsCache.get(text);
                    console.log(`[TTS] Cache hit (${cached.length} bytes): "${text.substring(0, 30)}..."`);
                    res.writeHead(200, {
                        'Content-Type': 'audio/mpeg',
                        'Content-Length': cached.length,
                        'Cache-Control': 'public, max-age=86400'
                    });
                    res.end(cached);
                    return;
                }

                const apiKey  = data.api_key  || FISH_API_KEY;
                const voiceId = data.voice_id || data.reference_id || FISH_VOICE_ID;

                if (!apiKey) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'FISH_API_KEY not configured. Set it in .env' }));
                    return;
                }

                console.log(`[TTS] Generating voice for: "${text.substring(0, 45)}..."`);

                const controller = new AbortController();
                const timeoutId  = setTimeout(() => controller.abort(), 8000);

                const fishRes = await fetch('https://api.fish.audio/v1/tts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'model': 's2.1-pro-free'
                    },
                    body: JSON.stringify({
                        text: text,
                        reference_id: voiceId,
                        format: 'mp3'
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!fishRes.ok) {
                    const errText = await fishRes.text().catch(() => '');
                    console.warn(`[TTS] Fish Audio error ${fishRes.status}:`, errText);
                    res.writeHead(fishRes.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: errText, status: fishRes.status }));
                    return;
                }

                const arrayBuffer = await fishRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                console.log(`[TTS] Success! ${buffer.length} bytes`);

                global.ttsCache.set(text, buffer);

                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': buffer.length,
                    'Cache-Control': 'public, max-age=86400'
                });
                res.end(buffer);
            } catch (err) {
                console.warn('[TTS] Failed:', err.message);
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ─── Static File Serving ────────────────────────────────────────────
    let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';
    const filePath = path.join(ROOT_DIR, safePath);

    // Prevent directory traversal outside ROOT_DIR
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
        });

        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\n  🚀  Challenge XAi server running at  http://localhost:${PORT}/`);
    console.log(`  🎙️  Fish Audio TTS proxy at          http://localhost:${PORT}/api/fish-tts`);
    console.log(`  📁  Serving static files from         ${ROOT_DIR}\n`);
});
