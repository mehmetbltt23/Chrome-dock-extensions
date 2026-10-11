// Zips the validated dist/ folder into a release asset that installs without a
// build step (Load unpacked) and uploads unchanged to the Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
const archive = `docktabs-v${manifest.version}.zip`;
const root = new URL('../', import.meta.url).pathname;
await rm(new URL(`../${archive}`, import.meta.url), { force: true });
execFileSync('zip', ['-qr', `../${archive}`, '.', '-x', '.DS_Store'], { cwd: `${root}dist`, stdio: 'inherit' });
console.log(`Packaged ${archive}`);
