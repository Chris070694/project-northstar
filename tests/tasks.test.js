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
    {id:'two',title:'Training',category:'Fitness',is_completed:false,is_priority:true}
  ];
  renderFocus();
`,context);

assert.equal(element('#mainFocus').textContent,'Training');
assert.match(element('#nextFocus').textContent,/Top-Priorität/);
assert.match(element('#homeTaskList').innerHTML,/toggleDailyTask\('one',this\.checked\)/);
assert.match(element('#homeTaskList').innerHTML,/toggleTaskPriority\('two'\)/);
assert.match(element('#dailyTaskList').innerHTML,/class="daily-task[^\"]*priority/);

const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260805_todo_priority.sql'),'utf8');
assert.match(migration,/add column if not exists is_priority boolean not null default false/i);
assert.match(migration,/unique index[\s\S]*where is_priority/i);

console.log('dashboard task completion and one-priority setup: OK');
