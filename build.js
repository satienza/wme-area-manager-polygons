import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const header = readFileSync(new URL('./src/header.js', import.meta.url), 'utf8')
  .replace('__VERSION__', pkg.version);
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/wme-area-manager.user.js',
  format: 'iife',
  target: 'es2020',
  banner: { js: header },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching for changes... (Ctrl+C to stop)');
} else {
  await esbuild.build(options);
  console.log('Build complete: dist/wme-area-manager.user.js');
}
