const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'modules/goals.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260805_vision_goal_image.sql'),'utf8');

assert.match(migration,/alter table public\.vision_goals[\s\S]*add column if not exists image_path text/i);
assert.match(migration,/pg_notify\('pgrst','reload schema'\)/i);
assert.match(source,/if\(imagePath&&!saved\)/);
assert.match(source,/storage\.from\('northstar-media'\)\.remove\(\[imagePath\]\)/);
assert.match(source,/isMissingGoalImageSchema/);

console.log('vision goal image schema and failed-upload cleanup: OK');
