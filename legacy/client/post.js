import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { minify } from "html-minifier-terser";
import { join } from "path";

const outDir = './dist';
rmSync(join(outDir, 'assets'), { recursive: true, force: true });
let fileData = readFileSync(join(outDir, 'index.html'), 'utf-8');

fileData = fileData.replace(/<!--\s*([^-\s]+)\s*-->/g, (_, file) => {
  file = join(outDir, file);
  if (existsSync(file)) {
    const data = readFileSync(file);
    rmSync(file);
    return data;
  }
  return '';
});

minify(fileData.replace(/\/\*([^\/]+)\*\//gsm, ''), {
  removeComments: true,
  noNewlinesBeforeTagClose: true,
  collapseWhitespace: true,
  minifyCSS: true,
  minifyJS: true,
}).then(output => {
  writeFileSync(join(outDir, 'index.html'), output);
});