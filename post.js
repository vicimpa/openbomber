import { readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { minify } from 'html-minifier-terser';

const outDir = './dist';
rmSync(join(outDir, 'assets'), { recursive: true, force: true });
const fileData = readFileSync(join(outDir, 'index.html'), 'utf-8');

minify(fileData.replace(/\/\*([^\/]+)\*\//gsm, ''), {
  removeComments: true,
  removeTagWhitespace: true,
  noNewlinesBeforeTagClose: true,
  collapseWhitespace: true,
  minifyCSS: true,
  minifyJS: true,
})
  .then(output => {
    writeFileSync(join(outDir, 'index.html'), output);
  });