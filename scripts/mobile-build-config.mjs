import fs from 'node:fs';
import path from 'node:path';

export function mobileBuildConfiguration(root, environment = process.env) {
  const file = path.join(root, 'mobile-v2.local.json');
  const local = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {};
  const value = environment.PALMERA_BACKEND_URL ?? local.backendUrl ?? '';
  if (typeof value !== 'string') throw new Error('backendUrl must be a string');
  const backendUrl = value.trim().replace(/\/$/, '');
  if (backendUrl) {
    const url = new URL(backendUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new Error(
        'The backend URL must be an HTTP(S) origin without credentials or paths',
      );
    }
  }
  return { backendUrl };
}
