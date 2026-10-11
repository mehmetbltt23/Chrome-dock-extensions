import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const allowedPermissions = new Set(['tabs', 'storage', 'favicon', 'scripting', 'search']);
const unexpected = manifest.permissions.filter((permission) => !allowedPermissions.has(permission));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 is required.');
if (manifest.side_panel !== undefined) throw new Error('The Web Dock-only release must not package a side panel.');
if (unexpected.length > 0) throw new Error(`Unexpected permissions: ${unexpected.join(', ')}`);
if (JSON.stringify(manifest.chrome_url_overrides) !== JSON.stringify({ newtab: 'newtab.html' })) throw new Error('Only the packaged DockTabs new tab page may override a Chrome page.');
if (manifest.host_permissions !== undefined) throw new Error('Required host permissions are not allowed in the base release.');
if (JSON.stringify(manifest.optional_host_permissions) !== JSON.stringify(['http://*/*', 'https://*/*'])) throw new Error('Web Dock host access must remain optional and limited to web pages.');
if (manifest.web_accessible_resources !== undefined) throw new Error('DockTabs must not expose packaged resources to web pages.');
if (!manifest.content_security_policy.extension_pages.includes("script-src 'self'")) throw new Error('Strict extension CSP is required.');
for (const dependency of Object.values({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
  if (/^[~^]/.test(dependency)) throw new Error(`Dependency versions must be exact: ${dependency}`);
}
console.log(`Project validation passed: MV${manifest.manifest_version}, ${manifest.permissions.length} permissions, exact dependency versions.`);
