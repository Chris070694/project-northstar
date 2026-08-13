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

const today=(()=>{
  const date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
})();
const rows={
  daily_tasks:[
    {id:'today',user_id:'user-1',task_date:today,title:'Training',category:'Fitness',is_completed:false,is_priority:true,keep_until_done:false,position:0,created_at:'2026-08-13T08:00:00Z'},
    {id:'carry',user_id:'user-1',task_date:'2026-08-01',title:'Auto waschen',category:'Privat',is_completed:false,is_priority:true,keep_until_done:true,position:0,created_at:'2026-08-01T08:00:00Z'},
    {id:'done',user_id:'user-1',task_date:'2026-08-01',title:'Schon erledigt',category:'Privat',is_completed:true,is_priority:false,keep_until_done:true,position:1,created_at:'2026-08-01T09:00:00Z'}
  ],
  recurring_tasks:[],
  recurring_task_skips:[]
};

class Query{
  constructor(table){this.table=table;this.filters=[];this.action='select';this.values=null;this.limitValue=null}
  select(){this.action=this.action==='update'?this.action:'select';return this}
  eq(column,value){this.filters.push(row=>row[column]===value);return this}
  lt(column,value){this.filters.push(row=>row[column]<value);return this}
  order(){return this}
  limit(value){this.limitValue=value;return this}
  update(values){this.action='update';this.values=values;return this}
  in(column,values){this.filters.push(row=>values.includes(row[column]));return this}
  execute(){
    let matched=(rows[this.table]||[]).filter(row=>this.filters.every(filter=>filter(row)));
    if(this.action==='update')matched.forEach(row=>Object.assign(row,this.values));
    if(this.limitValue!==null)matched=matched.slice(0,this.limitValue);
    return {data:matched.map(row=>({...row})),error:null};
  }
  then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject)}
}

const context=vm.createContext({
  console,
  alert(message){throw new Error(message)},
  confirm(){return true},
  currentUser:{id:'user-1'},
  focus:null,
  $:element,
  escapeHtml(value){return String(value)},
  sb:{from(table){return new Query(table)}}
});
vm.runInContext(fs.readFileSync(path.join(root,'modules/focus.js'),'utf8'),context);

vm.runInContext('globalThis.loadPromise=loadFocus().then(()=>{globalThis.loadedTasks=dailyTasks.map(task=>({...task}))})',context);
context.loadPromise.then(()=>{
  assert.equal(rows.daily_tasks.find(task=>task.id==='carry').task_date,today);
  assert.equal(rows.daily_tasks.find(task=>task.id==='carry').is_priority,false);
  assert.equal(rows.daily_tasks.find(task=>task.id==='done').task_date,'2026-08-01');
  assert.deepEqual(context.loadedTasks.map(task=>task.id).sort(),['carry','today']);
  console.log('unfinished persistent tasks roll forward while completed tasks stay archived: OK');
});
