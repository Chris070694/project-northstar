const fs=require('fs');
const assert=require('assert');

const css=fs.readFileSync('styles.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const serviceWorker=fs.readFileSync('sw.js','utf8');

assert.match(css,/\.workout-set-row\s*>\s*label:nth-of-type\(1\)\s*\{[^}]*grid-column:\s*2;?[^}]*grid-row:\s*2;?[^}]*\}/);
assert.match(css,/\.workout-set-row\s*>\s*label:nth-of-type\(2\)\s*\{[^}]*grid-column:\s*3;?[^}]*grid-row:\s*2;?[^}]*\}/);
assert.match(css,/\.workout-set-row input\[type=['\"]?number['\"]?\]\s*\{[^}]*flex:\s*1 1 0;?[^}]*width:\s*0;?[^}]*min-width:\s*0;?/);
assert.match(css,/\.active-workout\s*\{\s*padding:\s*14px;?\s*\}/);
assert.match(index,/styles\.css\?v=\d+/);
assert.match(serviceWorker,/^const CACHE\s*=\s*'cprb-[a-z0-9-]+';/m);
assert.match(serviceWorker,/\.\/styles\.css\?v=\d+/);

console.log('fitness inputs remain visible in mobile portrait layout: OK');
