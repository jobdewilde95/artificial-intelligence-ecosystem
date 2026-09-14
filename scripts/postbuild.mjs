// GitHub Pages has no SPA rewrite rule: a deep link like /capability 404s.
// Serving the same shell as 404.html makes client-side routing work anyway.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = resolve(root, 'dist/index.html');
if (!existsSync(index)) {
  console.error('postbuild: dist/index.html missing — did vite build run?');
  process.exit(1);
}
copyFileSync(index, resolve(root, 'dist/404.html'));
// .nojekyll stops Pages' Jekyll pass from dropping _-prefixed asset files.
copyFileSync(resolve(root, 'public/.nojekyll'), resolve(root, 'dist/.nojekyll'));
console.log('postbuild: wrote dist/404.html and dist/.nojekyll');
