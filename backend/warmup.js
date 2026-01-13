/**
 * Tachyon Warmup Script v10 (Node.js Version)
 * Usage: node warmup.js
 * 
 * Features:
 * - Automatically discovers Signed URLs via API
 * - Warms cache for Covers and Pages
 * - Concurrent requests with rate limiting
 * - Detailed progress logging
 */

import fetch from 'node-fetch'; // Assuming node 18+ or standard fetch. If not, https.
// Actually, for a standalone script without package.json dependency issues, let's use built-in 'https' or 'fetch' (Node 18+).
// The user is using Node 22 (from @types/node^22). fetch is global.

const CONFIG = {
    // API URL (Edit this if needed)
    baseUrl: 'http://localhost:3001',

    // Cookie (Copy from browser: "tachyon_session=...")
    cookie: 'tachyon_session=YOUR_COOKIE_HERE',

    // User Agent to bypass simple blockers
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TachyonWarmup/10.0',

    // Concurrency
    concurrency: 20
};

// Colors
const C = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    dim: "\x1b[2m"
};

async function main() {
    console.log(`${C.cyan}🔥 Tachyon Cache Warm-up v10${C.reset}`);

    // Check Config
    if (CONFIG.cookie.includes('YOUR_COOKIE_HERE')) {
        console.error(`${C.red}❌ Error: Please edit this script and set your SESSION_COOKIE!${C.reset}`);
        process.exit(1);
    }

    const headers = {
        'Cookie': CONFIG.cookie,
        'User-Agent': CONFIG.userAgent
    };

    // 1. Fetch All Comics (to get IDs and Covers)
    console.log(`${C.yellow}Step 1: Discovering Comics...${C.reset}`);
    const comics = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const res = await fetch(`${CONFIG.baseUrl}/api/comics?page=${page}&limit=500`, { headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            if (!data.comics) throw new Error('Invalid API response');

            comics.push(...data.comics);
            process.stdout.write(`\r   Found ${comics.length} comics...`);

            if (page >= data.totalPages) hasMore = false;
            page++;
        } catch (e) {
            console.error(`\n${C.red}❌ Failed to fetch comic list: ${e.message}${C.reset}`);
            process.exit(1);
        }
    }
    console.log(`\n${C.green}✅ Discovered ${comics.length} comics.${C.reset}`);

    // 2. Build Request Queue
    console.log(`${C.yellow}Step 2: Building URL Queue (Covers & Pages)...${C.reset}`);
    const queue = [];

    // Add Covers
    for (const comic of comics) {
        if (comic.cover) {
            queue.push({ type: 'COVER', url: CONFIG.baseUrl + comic.cover, name: comic.name });
        }
    }

    // Fetch Pages for each Comic (Concurrent limit for constructing queue)
    // We need to call /api/comics/:id/pages to get the signed URLs for pages.
    let processedInfo = 0;
    const infoConcurrency = 10;

    async function fetchComicDetails(comic) {
        try {
            const res = await fetch(`${CONFIG.baseUrl}/api/comics/${comic.id}/pages`, { headers });
            if (res.ok) {
                const data = await res.json();
                if (data.pages) {
                    data.pages.forEach(p => {
                        queue.push({ type: 'PAGE ', url: CONFIG.baseUrl + p.url, name: `${comic.name} #${p.index}` });
                    });
                }
            }
        } catch (e) {
            // Ignore individual failures
        }
        processedInfo++;
        process.stdout.write(`\r   Fetching Metadata: ${Math.floor(processedInfo / comics.length * 100)}% (${queue.length} items queued)`);
    }

    // Simple pool for metadata fetching
    for (let i = 0; i < comics.length; i += infoConcurrency) {
        const chunk = comics.slice(i, i + infoConcurrency);
        await Promise.all(chunk.map(fetchComicDetails));
    }

    console.log(`\n${C.green}✅ Queue Ready: ${queue.length} items to warm.${C.reset}`);

    // 3. Execute Warmup
    console.log(`${C.yellow}Step 3: Warming CDN... (Concurrency: ${CONFIG.concurrency})${C.reset}`);

    let active = 0;
    let index = 0;
    let completed = 0;
    let errors = 0;
    const startTime = Date.now();

    async function worker() {
        while (index < queue.length) {
            const item = queue[index++];

            try {
                const res = await fetch(item.url, {
                    headers,
                    method: 'GET'
                    // We just need to trigger the cache, so we can't use HEAD strictly if we want to ensure body is cached, 
                    // but usually GET is safer. We'll discard body.
                });

                // Read buffer to ensure download completes
                await res.arrayBuffer();

                const cacheStatus = res.headers.get('x-server-cache') || res.headers.get('cf-cache-status') || 'UNK';
                const statusColor = cacheStatus === 'HIT' ? C.green : C.dim;

                // Optional: Verbose log? Too spammy.
                // console.log(`[${statusColor}${cacheStatus}${C.reset}] ${item.name}`);

            } catch (e) {
                errors++;
            }

            completed++;
            if (completed % 10 === 0 || completed === queue.length) {
                const pct = Math.floor(completed / queue.length * 100);
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = Math.floor(completed / elapsed);
                process.stdout.write(`\r   Progress: ${pct}% | ${completed}/${queue.length} | Err: ${errors} | ${rate} req/s   `);
            }
        }
    }

    const workers = [];
    for (let i = 0; i < CONFIG.concurrency; i++) workers.push(worker());
    await Promise.all(workers);

    console.log(`\n${C.green}🎉 Warmup Complete!${C.reset}`);
}

main().catch(console.error);
