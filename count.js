import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const cwd = process.cwd();
const test = /\.(svelte|tsx?|jsx?|html|sass|s?css)$/;
const ingore = /(node_modules|vite\.config\.ts|svelte\.config\.js|tsconfig|dist|numsCount\.js)/;

function scan(folder = cwd) {
  let output = 0;
  const files = readdirSync(folder);

  for (const file of files) {
    if (ingore.test(file))
      continue;

    const filename = join(folder, file);
    const s = statSync(filename);

    if (s.isDirectory()) {
      output += scan(filename);
      continue;
    }

    if (!test.test(file))
      continue;

    output += readFileSync(filename, 'utf-8').split(/\n+/).filter(e => e.trim()).length;
  }

  return output;
}

console.log(scan());