const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const backup=fs.readFileSync(path.join(root,'modules/backup.js'),'utf8');

assert.doesNotMatch(index,/Project Northstar/i);
assert.match(index,/<title>CPRB OS<\/title>/);
assert.match(index,/apple-mobile-web-app-title" content="CPRB OS"/);
assert.match(index,/class="brand">CPRB <b>OS<\/b>/);
assert.equal(manifest.name,'CPRB OS');
assert.equal(manifest.short_name,'CPRB OS');
assert.match(backup,/app:'CPRB OS'/);

console.log('CPRB OS branding is consistent: OK');
