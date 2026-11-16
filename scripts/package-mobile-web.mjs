import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {mobileBuildConfiguration} from './mobile-build-config.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web/dist');
const destination = path.join(root, 'android/app/src/main/assets');
const mime = {'.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'};
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, url) => {
  const code = fs.readFileSync(path.join(dist, url.replace(/^\//, '')), 'utf8');
  return `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g, (_, url) => {
  let css = fs.readFileSync(path.join(dist, url.replace(/^\//, '')), 'utf8');
  css = css.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (original, _quote, resource) => {
    if (/^(data:|https?:|#)/.test(resource)) return original;
    const file = path.resolve(resource.startsWith('/') ? dist : path.dirname(path.join(dist, url.replace(/^\//, ''))), resource.replace(/^\//, ''));
    if (!file.startsWith(dist + path.sep)) throw new Error('Asset outside frontend bundle');
    return `url("data:${mime[path.extname(file)] ?? 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}")`;
  });
  return `<style>${css}</style>`;
});
html = html.replace(/<link\b[^>]*(?:rel="(?:icon|modulepreload)")[^>]*>/g, '');
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
if (/<script\b[^>]*src=|<link\b[^>]*rel="stylesheet"/.test(html)) throw new Error('The UI still references an external bundle');
const {backendUrl} = mobileBuildConfiguration(root);
fs.mkdirSync(path.join(destination, 'mobile-web'), {recursive: true});
fs.writeFileSync(path.join(destination, 'mobile-web/index.html'), html);
fs.writeFileSync(path.join(destination, 'mobile-config.json'), JSON.stringify({backendUrl}));
console.log(`Bundled offline UI: ${Buffer.byteLength(html)} bytes; sha256=${crypto.createHash('sha256').update(html).digest('hex')}`);
console.log(backendUrl ? 'Registration backend configured.' : 'PALMERA_BACKEND_URL is unset: registration and synchronization need configuration.');
