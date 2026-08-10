const fs=require('fs');
const assert=require('assert');

const css=fs.readFileSync('styles.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const serviceWorker=fs.readFileSync('sw.js','utf8');

assert.match(css,/\.workout-set-row>label:nth-of-type\(1\)\{grid-column:2;grid-row:2\}/);
assert.match(css,/\.workout-set-row>label:nth-of-type\(2\)\{grid-column:3;grid-row:2\}/);
assert.match(css,/\.workout-set-row input\[type=number\]\{flex:1 1 0;width:0;min-width:0/);
assert.match(css,/\.active-workout\{padding:14px\}/);
assert.match(index,/styles\.css\?v=3/);
assert.match(serviceWorker,/cprb-calendar-v2-v1/);
assert.match(serviceWorker,/\.\/styles\.css\?v=3/);

console.log('fitness inputs remain visible in mobile portrait layout: OK');
