const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'modules/notes.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260810_pencil_notes_v1.sql'),'utf8');
const backup=fs.readFileSync(path.join(root,'modules/backup.js'),'utf8');

const elements=new Map();
const context2d={
  save(){},restore(){},fillRect(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  globalCompositeOperation:'source-over',fillStyle:'',strokeStyle:'',lineWidth:1,lineCap:'round',lineJoin:'round'
};
function element(selector){
  if(!elements.has(selector))elements.set(selector,{
    value:selector==='#pencilSize'?'5':selector==='#pencilPaper'?'lined':'',
    textContent:'',innerHTML:'',checked:false,disabled:false,width:1200,height:1697,
    classList:{add(){},remove(){},toggle(){}},
    reset(){},addEventListener(){},getContext(){return context2d},
    getBoundingClientRect(){return {left:0,top:0,width:1200,height:1697}},
    setPointerCapture(){},releasePointerCapture(){},toBlob(callback){callback(new Blob(['preview'],{type:'image/png'}))}
  });
  return elements.get(selector);
}

const context=vm.createContext({
  console,
  Blob,
  crypto:globalThis.crypto,
  alert(){},confirm(){return true},requestAnimationFrame(callback){callback()},
  currentUser:{id:'user-1'},
  $:element,$$(){return []},
  escapeHtml(value){return String(value)},
  signedUrl:async()=>'',
  showPage(){},loadAll:async()=>{},
  sb:{from(){throw new Error('Database access is not expected in this unit test')},storage:{from(){throw new Error('Storage access is not expected in this unit test')}}}
});
vm.runInContext(source,context);

const light=vm.runInContext(`pencilStrokeWidth(5,.2,'pen')`,context);
const firm=vm.runInContext(`pencilStrokeWidth(5,1,'pen')`,context);
const eraser=vm.runInContext(`pencilStrokeWidth(5,.5,'eraser')`,context);
assert.ok(firm>light,'Apple Pencil pressure must increase line width');
assert.ok(eraser>firm,'Eraser must be wider than the pen');

assert.match(source,/event\.pointerType\s*===\s*'touch'/);
assert.match(source,/event\.getCoalescedEvents/);
assert.match(source,/drawing\.json/);
assert.match(source,/preview\.png/);
assert.match(source,/note_type:\s*'handwriting'/);
assert.match(html,/id="pencilCanvas"[\s\S]*width="1200"[\s\S]*height="1697"/);
assert.match(html,/id="pencilUndoBtn"/);
assert.match(html,/value="lined">Liniert[\s\S]*value="grid">Kariert[\s\S]*value="dotted">Gepunktet/);
assert.match(css,/#pencilCanvas[^{]*\{[^}]*touch-action:\s*pan-y pinch-zoom/);
assert.match(migration,/add column if not exists note_type text not null default 'text'/i);
assert.match(migration,/add column if not exists drawing_path text/i);
assert.match(migration,/notes_note_type_check/i);
assert.match(backup,/\{\s*name:\s*'notes'\s*\}/);
assert.match(backup,/key\.endsWith\('_path'\)/);

console.log('pencil notes pressure, tools, private storage, migration and backup coverage: OK');
