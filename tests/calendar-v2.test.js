const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'modules/calendar.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260810_calendar_v2.sql'),'utf8');
const reminderFunction=fs.readFileSync(path.join(root,'supabase/functions/smart-reminder/index.ts'),'utf8');
const backupSource=fs.readFileSync(path.join(root,'modules/backup.js'),'utf8');

const elements=new Map();
function element(selector){
  if(!elements.has(selector))elements.set(selector,{
    value:'',checked:false,disabled:false,innerHTML:'',textContent:'',
    reset(){},addEventListener(){},
    classList:{add(){},remove(){},toggle(){}}
  });
  return elements.get(selector);
}

const context=vm.createContext({
  console,
  alert(){},
  confirm(){return true},
  currentUser:{id:'user-1'},
  $:element,
  escapeHtml(value){return String(value)},
  location:{href:'https://cprb.example/?page=calendar',search:'?page=calendar'},
  history:{replaceState(){}},
  URL,
  URLSearchParams,
  sb:{from(){throw new Error('Database access is not expected in this recurrence test')}}
});
vm.runInContext(source,context);

const ids=JSON.parse(vm.runInContext(`
  calendarEvents=[
    {id:'once',event_date:'2026-08-10',recurrence:'none',start_time:'10:00'},
    {id:'birthday',event_date:'1994-08-10',recurrence:'yearly',start_time:null},
    {id:'future',event_date:'2027-08-10',recurrence:'yearly',start_time:null},
    {id:'other',event_date:'1994-08-11',recurrence:'yearly',start_time:null}
  ];
  JSON.stringify(calendarEventsForDate('2026-08-10').map(event=>event.id));
`,context));

assert.deepEqual(ids,['birthday','once']);
assert.equal(vm.runInContext(`calendarEventOccursOn({event_date:'2024-02-29',recurrence:'yearly'},'2026-02-28')`,context),false);
assert.match(html,/id="cRecurrence"[\s\S]*value="yearly">Jedes Jahr/);
assert.match(html,/id="cReminderEnabled"[\s\S]*id="cReminderTime"/);
assert.match(migration,/add column if not exists recurrence text not null default 'none'/i);
assert.match(migration,/add column if not exists reminder_enabled boolean not null default false/i);
assert.match(migration,/calendar_events_reminders_idx/i);
assert.match(reminderFunction,/dueCalendarReminders/);
assert.match(reminderFunction,/type:`calendar:\$\{event\.id\}`/);
assert.match(reminderFunction,/page=calendar&date=/);
assert.match(backupSource,/\{name:'calendar_events'\}/);

console.log('calendar v2 yearly events, reminder fields and push dispatch: OK');
