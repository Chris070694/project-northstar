const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const elements=new Map();
function element(selector){
  if(!elements.has(selector))elements.set(selector,{
    textContent:'',innerHTML:'',value:'',checked:false,disabled:false,
    style:{width:''},classList:{toggle(){}},focus(){}
  });
  return elements.get(selector);
}

const context=vm.createContext({
  console,
  alert(){},
  confirm(){return true},
  currentUser:{id:'user-1'},
  focus:null,
  $:element,
  escapeHtml(value){return String(value)},
  sb:{from(){throw new Error('Database access is not expected in this render test')}}
});
vm.runInContext(fs.readFileSync(path.join(root,'modules/focus.js'),'utf8'),context);

vm.runInContext(`
  dailyTasksReady=true;
  taskPriorityReady=true;
  recurringTasksReady=true;
  recurringTasks=[];
  dailyTasks=[
    {id:'one',title:'Journal schreiben',category:'Trading',is_completed:false,is_priority:false},
    {id:'two',title:'Training',category:'Fitness',is_completed:false,is_priority:true},
    {id:'three',title:'Auto waschen',category:'Privat',is_completed:false,is_priority:false,keep_until_done:true},
    {id:'four',title:'Altglas wegbringen',category:'Privat',is_completed:true,is_priority:false,keep_until_done:true}
  ];
  renderFocus();
`,context);

assert.equal(element('#mainFocus').textContent,'Training');
assert.match(element('#nextFocus').textContent,/Top-Priorität/);
assert.match(element('#homeTaskList').innerHTML,/toggleDailyTask\('one',this\.checked\)/);
assert.match(element('#homeTaskList').innerHTML,/toggleTaskPriority\('two'\)/);
assert.match(element('#dailyTaskList').innerHTML,/class="daily-task[^\"]*priority/);
assert.match(element('#dailyTaskList').innerHTML,/class="daily-task[^\"]*persistent/);
assert.match(element('#dailyTaskList').innerHTML,/Auto waschen[\s\S]*Bleibt offen/);
assert.match(element('#dailyTaskList').innerHTML,/Erledigt \(1\)/);
assert.doesNotMatch(element('#homeTaskList').innerHTML,/Altglas wegbringen/);

const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260805_todo_priority.sql'),'utf8');
assert.match(migration,/add column if not exists is_priority boolean not null default false/i);
assert.match(migration,/unique index[\s\S]*where is_priority/i);

const persistentMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260813_persistent_tasks.sql'),'utf8');
assert.match(persistentMigration,/add column if not exists keep_until_done boolean not null default false/i);
assert.match(persistentMigration,/where keep_until_done and not is_completed/i);

const focusSource=fs.readFileSync(path.join(root,'modules/focus.js'),'utf8');
assert.match(focusSource,/eq\('keep_until_done',\s*true\)[\s\S]*eq\('is_completed',\s*false\)[\s\S]*lt\('task_date',\s*d\)/);
assert.match(focusSource,/task_date:\s*d,[\s\S]*is_priority:\s*false/);

console.log('dashboard task completion, carry-until-done and one-priority setup: OK');
