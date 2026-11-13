// Bundles index.html + CSS + JS into one self-contained file for pasting
// into a site builder's "Embed HTML" / custom code element (e.g. Wix).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');
const css = read('css/styles.css');
const js = (p) => read(p).replace(/<\/script/gi, '<\\/script');

html = html
  .replace('<link rel="stylesheet" href="css/styles.css">', () => '<style>\n' + css + '</style>')
  .replace('<script src="js/calc.js"></script>', () => '<script>\n' + js('js/calc.js') + '</script>')
  .replace('<script src="js/lenders.js"></script>', () => '<script>\n' + js('js/lenders.js') + '</script>')
  .replace('<script src="js/app.js"></script>', () => '<script>\n' + js('js/app.js') + '</script>');

if (/href="css\/|src="js\//.test(html)) throw new Error('Unbundled asset reference left in output');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'dealer-fee-calculator.html');
fs.writeFileSync(out, html);
console.log('Wrote', path.relative(root, out), '(' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
