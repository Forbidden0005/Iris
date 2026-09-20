import { launchChromeDebug, getPageWsUrl, CdpClient } from '../src/browser/index.ts';
import WebSocket from 'ws';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function main() {
    const port = 9225;
    const framesDir = join(projectRoot, 'tmp', 'frames_repl');
    const outputVideo = join(projectRoot, 'docs/marketing/repl-demo.mp4');
    const templateUrl = `file://${join(projectRoot, 'scripts', 'terminal-template.html')}`;

    console.log('🚀 Starting REPL demo video generation...');
    await rm(framesDir, { recursive: true, force: true });
    await mkdir(framesDir, { recursive: true });
    await mkdir(dirname(outputVideo), { recursive: true });

    const proc = await launchChromeDebug(templateUrl, port);
    await new Promise(r => setTimeout(r, 2000));
    let ws;
    let frameCount = 0;

    try {
        const wsUrl = await getPageWsUrl(port);
        ws = new WebSocket(wsUrl);
        await new Promise((resolve) => ws.once('open', resolve));
        const client = new CdpClient(ws);

        await client.send('Runtime.enable');
        await client.send('Page.enable');
        await client.send('Emulation.setDeviceMetricsOverride', {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            mobile: false
        });

        const takeFrame = async (repeat = 1) => {
            const res = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
            const data = res.result?.data || res.data;
            const buffer = Buffer.from(data, 'base64');
            for (let i = 0; i < repeat; i++) {
                frameCount++;
                const filename = `frame_${String(frameCount).padStart(5, '0')}.png`;
                await writeFile(join(framesDir, filename), buffer);
            }
        };

        const evalJs = (code) => client.send('Runtime.evaluate', { expression: code, awaitPromise: true });

        const typePrompt = async (prompt, text) => {
            await evalJs(`
                (function() {
                    let terminal = document.getElementById('terminal');
                    let line = document.createElement('div');
                    line.innerHTML = '<span class="prompt">${prompt}</span><span class="cmd"></span><span class="cursor"></span>';
                    terminal.appendChild(line);
                })()
            `);
            const chars = text.split('');
            let current = '';
            for (const char of chars) {
                current += char;
                await evalJs(`document.querySelector('div:last-child .cmd').textContent = ${JSON.stringify(current)}`);
                await takeFrame(2);
            }
            await evalJs(`if(document.querySelector('.cursor')) document.querySelector('.cursor').remove()`);
            await takeFrame(10);
        };

        const appendOutput = async (html, holdFrames = 30) => {
            await evalJs(`window.appendLine(${JSON.stringify(html)})`);
            await takeFrame(holdFrames);
        };

        const clear = async () => {
            await evalJs(`window.clearTerminal()`);
            await takeFrame(5);
        };

        // --- REPL SCRIPT ---

        // 1. Initial Start
        await typePrompt('$', 'iris repl');
        await appendOutput(`
<div class="info"> ╔═══════════════════════════════════════════════════════════════════════════╗
 ║                                                                           ║
 ║     ██████╗ ██████╗ ███████╗██╗    ██╗      ██████╗██╗     ██╗           ║
 ║    ██╔════╝ ██╔══██╗██╔════╝██║    ██║     ██╔════╝██║     ██║           ║
 ║    ██║      ██████╔╝█████╗  ██║ █╗ ██║     ██║     ██║     ██║           ║
 ║    ██║      ██╔══██╗██╔══╝  ██║███╗██║     ██║     ██║     ██║           ║
 ║    ╚██████╗ ██║  ██║███████╗╚███╔███╔╝     ╚██████╗███████╗██║           ║
 ║     ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝       ╚═════╝╚══════╝╚═╝           ║
 ║                                                                           ║
 ║              🎪  Multi-Agent Orchestrator  •  Interactive Mode            ║
 ║                                                                           ║
 ╚═══════════════════════════════════════════════════════════════════════════╝</div>
<div class="gray">
  Project: /home/user/Iris
  Session: 7b30e600-6084-471f-9daa-3de3fa700b08
  Model: deepseek-chat  Engine: auto  Mode: manual

  Type /help for full command list or start chatting!</div>`, 60);

        // 2. Interactive Request
        await typePrompt('iris(manual)> ', 'create a glassmorphism bio page for Stinki (lead agent)');
        await appendOutput('<div class="gray">  ⏳ Routing...</div>', 10);
        await appendOutput('<div class="gray">  → iris-frontend (CODE)</div>', 20);
        await appendOutput(`
<div class="gray">  ┌─ Response
  I'll create <b>stinki-bio.html</b> with a modern glassmorphism design.

  FILE: stinki-bio.html
  <<<<<< SEARCH
  ======
  &lt;!DOCTYPE html&gt;
  &lt;html&gt;
  &lt;head&gt;
    &lt;style&gt;
      body { background: linear-gradient(45deg, #060a10, #1e293b); }
      .glass { backdrop-filter: blur(10px); background: rgba(255,255,255,0.1); }
    &lt;/style&gt;
  &lt;/head&gt;
  &lt;body&gt;
    &lt;div class="glass"&gt;&lt;h1&gt;Stinki: The Iris Lead&lt;/h1&gt;&lt;/div&gt;
  &lt;/body&gt;
  &lt;/html&gt;
  >>>>>> REPLACE
  └─</div>`, 90);

        // 3. Command usage - Switch to Gemini
        await typePrompt('iris(manual)> ', '/model gemini-2.0-flash');
        await appendOutput('<div class="success">  ✓ Model set to: gemini-2.0-flash (via Iris Gateway)</div>', 30);

        // 4. Optimization request
        await typePrompt('iris(manual)> ', 'optimize the bio page: add mobile responsiveness and CSS variables');
        await appendOutput('<div class="gray">  ⏳ Routing...</div>', 10);
        await appendOutput('<div class="gray">  → iris-frontend (CODE)</div>', 20);
        await appendOutput(`
<div class="gray">  ┌─ Response
  Optimizing <b>stinki-bio.html</b> for performance and responsiveness using <b>Gemini 2.0 Flash</b>.

  FILE: stinki-bio.html
  <<<<<< SEARCH
      body { background: linear-gradient(45deg, #060a10, #1e293b); }
      .glass { backdrop-filter: blur(10px); background: rgba(255,255,255,0.1); }
  ======
      :root { --accent: #38bdf8; --bg: #060a10; }
      body { background: var(--bg); margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
      .glass { 
        backdrop-filter: blur(12px); 
        background: rgba(255,255,255,0.05); 
        border: 1px solid rgba(255,255,255,0.1);
        padding: 2rem; border-radius: 20px;
      }
      @media (max-width: 640px) { .glass { width: 90%; } }
  >>>>>> REPLACE
  └─</div>`, 90);

        // 5. Help and Exit
        await typePrompt('iris(manual)> ', '/help');
        await appendOutput(`
<div class="blue">  Available Commands:</div>
<div class="gray">  /model [name]   Change the execution model
  /mode           Cycle manual|assist|autopilot
  /clear          Clear terminal
  /help           Show this menu</div>`, 45);

        await typePrompt('iris(manual)> ', 'exit');
        await appendOutput('<div class="info">  Session saved to .iris/ — run "iris repl" to continue.</div>', 30);

        console.log(`✅ Generated ${frameCount} frames.`);

        // --- STITCH VIDEO ---
        console.log('🎞️ Stitching video with ffmpeg...');
        execSync(`ffmpeg -y -framerate 30 -i ${join(framesDir, 'frame_%05d.png')} -c:v libx264 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${outputVideo}`);

        console.log(`🎉 REPL demo saved to ${outputVideo}`);

        // --- OPTIMIZE VIDEO ---
        console.log('✨ Optimizing REPL demo video...');
        execSync(`ffmpeg -y -i ${outputVideo} -vcodec libx264 -crf 28 -preset slower -movflags +faststart ${outputVideo.replace('.mp4', '_opt.mp4')}`);
        execSync(`mv ${outputVideo.replace('.mp4', '_opt.mp4')} ${outputVideo}`);
        console.log('✅ REPL demo video optimized.');

    } catch (err) {
        console.error('❌ Error during REPL video generation:', err);
    } finally {
        if (ws) ws.close();
        proc.kill('SIGTERM');
    }
}

main();
