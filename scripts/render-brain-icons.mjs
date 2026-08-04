import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

const svg = fs.readFileSync('icons/favicon.svg', 'utf8');
// maskable: more padding so safe zone stays clear
const svgMaskable = svg.replace(
  '<g transform="translate(0,0)"',
  '<g transform="translate(8,8) scale(0.75)"'
);

function render(svgStr, size, out) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: size }
  });
  const png = resvg.render().asPng();
  fs.writeFileSync(out, png);
  console.log(out, png.length, 'bytes');
}

render(svg, 32, 'icons/favicon-32.png');
render(svg, 180, 'icons/apple-touch-icon.png');
render(svg, 192, 'icons/icon-192.png');
render(svg, 512, 'icons/icon-512.png');
render(svgMaskable, 512, 'icons/icon-512-maskable.png');

const docsIcons = 'docs/icons';
if (fs.existsSync(docsIcons)) {
  for (const f of [
    'favicon-32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-512-maskable.png',
    'favicon.svg'
  ]) {
    fs.copyFileSync(path.join('icons', f), path.join(docsIcons, f));
  }
  console.log('copied to docs/icons');
}
