import { access, readFile, stat } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
for (const file of ['manifest.json', 'options.html', 'newtab.html', 'service-worker.js', 'web-dock.js']) await access(new URL(file, dist));
try {
  await access(new URL('sidepanel.html', dist));
  throw new Error('The Web Dock-only package must not contain sidepanel.html.');
} catch (error) {
  if (error instanceof Error && error.message === 'The Web Dock-only package must not contain sidepanel.html.') throw error;
}
const manifest = JSON.parse(await readFile(new URL('manifest.json', dist), 'utf8'));
const worker = await readFile(new URL('service-worker.js', dist), 'utf8');
const webDock = await readFile(new URL('web-dock.js', dist), 'utf8');
if (manifest.background.service_worker !== 'service-worker.js') throw new Error('Built worker path does not match the manifest.');
if (/eval\s*\(|new Function\s*\(/.test(worker)) throw new Error('Unsafe dynamic code found in the service worker.');
if (/^\s*import\s/m.test(webDock) || /import\s*\(/.test(webDock)) throw new Error('The dynamically injected Web Dock must be a self-contained script.');
const workerSize = (await stat(new URL('service-worker.js', dist))).size;
if (workerSize > 250_000) throw new Error(`Service worker is unexpectedly large: ${workerSize} bytes.`);
console.log(`Build validation passed: loadable MV3 package, service worker ${workerSize} bytes.`);
