const fs=require('fs');
const assert=require('assert');

const source=fs.readFileSync('modules/fitness.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260805_fitness_sets_v2.sql','utf8');
const backup=fs.readFileSync('modules/backup.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(migration,/create table if not exists public\.fitness_set_logs/i);
assert.match(migration,/unique \(session_exercise_id,set_number\)/i);
assert.match(migration,/previous_session_id uuid references public\.fitness_sessions/i);
assert.match(migration,/source in \('app','watch','import'\)/i);
assert.match(migration,/enable row level security/i);

assert.match(source,/session\.status\s*===\s*'completed'\s*&&\s*session\.plan_id\s*===\s*planId/);
assert.match(source,/previous\.sets\.find\(\s*item\s*=>\s*item\.plan_exercise_id\s*===\s*sessionExercise\.plan_exercise_id\s*&&\s*Number\(item\.set_number\)\s*===\s*setNumber,?\s*\)/);
assert.match(source,/toggleFitnessSet/);
assert.match(source,/completed_at:\s*completedAt/);
assert.match(source,/openFitnessProgress/);
assert.match(source,/Vergleich nur mit dem letzten/);

assert.match(backup,/\{\s*name:\s*'fitness_set_logs'\s*\}/);
assert.match(backup,/fitness:\s*\[\s*'fitness_plans',\s*'fitness_plan_exercises',\s*'fitness_sessions',\s*'fitness_session_exercises',\s*'fitness_set_logs',?\s*\]/);
assert.match(index,/modules\/fitness\.js\?v=2/);
assert.match(index,/id="fitnessProgressModal"/);

console.log('fitness v2 set logs, strict A/B history, progress UI and backup coverage: OK');
