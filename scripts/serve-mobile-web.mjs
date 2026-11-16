import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'android/app/src/main/assets/mobile-web/index.html'));
const port = Number(process.env.PALMERA_TEST_PORT ?? 18766);
http.createServer((_request, response) => {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  response.end(html);
}).listen(port, '127.0.0.1');
