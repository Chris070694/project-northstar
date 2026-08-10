const CPRB_BACKUP_VERSION=1;
const CPRB_BACKUP_MAGIC='CPRB01';
const CPRB_BACKUP_ITERATIONS=250000;
const CPRB_BACKUP_TABLES=[
  {name:'trades'},
  {name:'trading_settings',conflict:'user_id'},
  {name:'daily_focus'},
  {name:'vision_goals'},
  {name:'recurring_tasks'},
  {name:'daily_tasks'},
  {name:'recurring_task_skips'},
  {name:'weekly_reviews'},
  {name:'fitness_exercises'},
  {name:'fitness_plans'},
  {name:'fitness_plan_exercises'},
  {name:'fitness_sessions'},
  {name:'fitness_session_exercises'},
  {name:'fitness_set_logs'},
  {name:'notes'},
  {name:'academy_notes'},
  {name:'calendar_events'},
  {name:'reminder_settings',conflict:'user_id'},
  {name:'library_books'}
];

const CPRB_RESTORE_ORDER=[
  'trades','trading_settings','daily_focus','vision_goals','recurring_tasks','daily_tasks',
  'recurring_task_skips','weekly_reviews','fitness_exercises','fitness_plans',
  'fitness_plan_exercises','fitness_sessions','fitness_session_exercises','fitness_set_logs','notes',
  'academy_notes','calendar_events','reminder_settings','library_books'
];

const CPRB_EXPORT_MODULES={
  trading:['trades','trading_settings'],
  fitness:['fitness_plans','fitness_plan_exercises','fitness_sessions','fitness_session_exercises','fitness_set_logs'],
  focus:['daily_focus','daily_tasks','recurring_tasks','recurring_task_skips','weekly_reviews'],
  goals:['vision_goals']
};

function isMissingBackupTable(error){
  const message=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
  return message.includes('42p01')||message.includes('pgrst205')||
    /relation .* does not exist|could not find the table|schema cache/.test(message);
}

function setBackupProgress(kind,percent,text){
  const wrapper=$(`#${kind}Progress`);
  const bar=$(`#${kind}ProgressBar`);
  const label=$(`#${kind}ProgressText`);
  wrapper?.classList.remove('hide');
  if(bar)bar.style.width=`${Math.max(0,Math.min(100,percent))}%`;
  if(label)label.textContent=text;
}

function hideBackupProgress(kind){
  $(`#${kind}Progress`)?.classList.add('hide');
  const bar=$(`#${kind}ProgressBar`);
  if(bar)bar.style.width='0%';
}

function setBackupBusy(busy){
  ['backupDataBtn','backupCompleteBtn','restoreBackupBtn','exportCsvBtn'].forEach(id=>{
    const button=$(`#${id}`);
    if(button)button.disabled=busy;
  });
}

function formatBackupBytes(bytes){
  const value=Number(bytes)||0;
  if(value<1024)return `${value} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(value<10240?1:0)} KB`;
  if(value<1024*1024*1024)return `${(value/1024/1024).toFixed(value<10*1024*1024?1:0)} MB`;
  return `${(value/1024/1024/1024).toFixed(1)} GB`;
}

function backupDateStamp(date=new Date()){
  const pad=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

async function fetchAllBackupRows(table){
  const pageSize=1000;
  const rows=[];
  for(let from=0;;from+=pageSize){
    const {data,error}=await sb.from(table).select('*').range(from,from+pageSize-1);
    if(error){
      if(isMissingBackupTable(error))return {rows:[],available:false};
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...(data||[]));
    if(!data||data.length<pageSize)break;
  }
  return {rows,available:true};
}

async function collectBackupData(tableNames=CPRB_BACKUP_TABLES.map(item=>item.name),onProgress=()=>{}){
  const tables={};
  const unavailable=[];
  let rowCount=0;
  for(let index=0;index<tableNames.length;index+=1){
    const name=tableNames[index];
    onProgress(index/tableNames.length,name);
    const result=await fetchAllBackupRows(name);
    if(result.available){
      tables[name]=result.rows;
      rowCount+=result.rows.length;
    }else unavailable.push(name);
  }
  return {tables,unavailable,rowCount};
}

function collectBackupFiles(tables){
  const seen=new Set();
  const files=[];
  const add=(bucket,path)=>{
    if(!path||typeof path!=='string')return;
    const key=`${bucket}:${path}`;
    if(seen.has(key))return;
    seen.add(key);
    files.push({bucket,path});
  };
  Object.entries(tables).forEach(([table,rows])=>{
    (rows||[]).forEach(row=>{
      Object.entries(row).forEach(([key,value])=>{
        if(!value||typeof value!=='string'||!key.endsWith('_path'))return;
        add(table==='library_books'?'northstar-library':'northstar-media',value);
      });
    });
  });
  return files;
}

function backupZipPath(file,index){
  const safePath=file.path.split('/').filter(Boolean).map(part=>encodeURIComponent(part)).join('/');
  return `files/${file.bucket}/${safePath||`file-${index}`}`;
}

function backupFileMimeType(path,reportedType=''){
  const extension=String(path||'').split('?')[0].split('.').pop().toLowerCase();
  const byExtension={
    pdf:'application/pdf',
    webp:'image/webp',
    jpg:'image/jpeg',
    jpeg:'image/jpeg',
    png:'image/png',
    json:'application/json'
  };
  return byExtension[extension]||reportedType||'application/octet-stream';
}

async function addFilesToBackup(zip,fileRefs,onProgress){
  const included=[];
  const failed=[];
  let totalBytes=0;
  for(let index=0;index<fileRefs.length;index+=1){
    const file=fileRefs[index];
    onProgress(index,fileRefs.length,file.path);
    try{
      const {data,error}=await sb.storage.from(file.bucket).createSignedUrl(file.path,600);
      if(error)throw error;
      const response=await fetch(data.signedUrl);
      if(!response.ok)throw new Error(`Download ${response.status}`);
      const blob=await response.blob();
      const zipPath=backupZipPath(file,index);
      zip.file(zipPath,blob,{binary:true,compression:'STORE'});
      included.push({bucket:file.bucket,path:file.path,zip_path:zipPath,size:blob.size,type:backupFileMimeType(file.path,blob.type)});
      totalBytes+=blob.size;
    }catch(error){
      console.warn(`Backup-Datei übersprungen: ${file.bucket}/${file.path}`,error);
      failed.push({bucket:file.bucket,path:file.path,error:error.message});
    }
  }
  return {included,failed,totalBytes};
}

async function deriveBackupKey(password,salt,usage){
  const encoder=new TextEncoder();
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:CPRB_BACKUP_ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);
}

async function encryptBackupBytes(bytes,password){
  const encoder=new TextEncoder();
  const magic=encoder.encode(CPRB_BACKUP_MAGIC);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveBackupKey(password,salt,'encrypt');
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:magic},key,bytes));
  const output=new Uint8Array(magic.length+salt.length+iv.length+encrypted.length);
  output.set(magic,0);
  output.set(salt,magic.length);
  output.set(iv,magic.length+salt.length);
  output.set(encrypted,magic.length+salt.length+iv.length);
  return output;
}

async function decryptBackupBytes(bytes,password){
  const encoder=new TextEncoder();
  const magic=encoder.encode(CPRB_BACKUP_MAGIC);
  if(bytes.length<magic.length+16+12+16)throw new Error('Die Datei ist kein gültiges CPRB-Backup.');
  if(!magic.every((value,index)=>bytes[index]===value))throw new Error('Die Datei ist kein gültiges CPRB-Backup.');
  const salt=bytes.slice(magic.length,magic.length+16);
  const iv=bytes.slice(magic.length+16,magic.length+28);
  const encrypted=bytes.slice(magic.length+28);
  try{
    const key=await deriveBackupKey(password,salt,'decrypt');
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:magic},key,encrypted));
  }catch(error){
    throw new Error('Das Backup-Passwort ist falsch oder die Datei wurde beschädigt.');
  }
}

function downloadBackupBlob(blob,fileName){
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=fileName;
  anchor.style.display='none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

async function createCprbBackup(includeFiles=true){
  const password=$('#backupPassword')?.value||'';
  if(password.length<6)return alert('Bitte ein Backup-Passwort mit mindestens 6 Zeichen eingeben.');
  if(!window.JSZip)return alert('Das Backup-Modul konnte nicht geladen werden. Bitte die App neu öffnen.');
  if(includeFiles&&!confirm('Das komplette Backup kann wegen deiner PDFs größer werden. Am Windows-Laptop funktioniert der Download am zuverlässigsten. Jetzt starten?'))return;

  setBackupBusy(true);
  setBackupProgress('backup',2,'Daten werden gesammelt…');
  try{
    const collected=await collectBackupData(undefined,(part,name)=>setBackupProgress('backup',3+part*26,`${name} wird gesichert…`));
    const zip=new JSZip();
    let files={included:[],failed:[],totalBytes:0};
    if(includeFiles){
      const refs=collectBackupFiles(collected.tables);
      files=await addFilesToBackup(zip,refs,(index,total,path)=>{
        const part=total?index/total:1;
        setBackupProgress('backup',30+part*45,`Dateien ${index+1}/${total}: ${path.split('/').pop()}`);
      });
    }
    const manifest={
      format:'cprb-backup',
      version:CPRB_BACKUP_VERSION,
      created_at:new Date().toISOString(),
      owner_id:currentUser.id,
      backup_type:includeFiles?'complete':'data',
      app:'CPRB OS',
      row_count:collected.rowCount,
      unavailable_tables:collected.unavailable,
      files:files.included,
      failed_files:files.failed,
      local:{active_fitness_plan:localStorage.getItem(`northstar-fitness-plan-${currentUser.id}`)||null},
      tables:collected.tables
    };
    zip.file('manifest.json',JSON.stringify(manifest,null,2));
    setBackupProgress('backup',78,'Backup wird gepackt…');
    const archive=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}},metadata=>{
      setBackupProgress('backup',78+metadata.percent*.1,`Backup wird gepackt… ${Math.round(metadata.percent)}%`);
    });
    setBackupProgress('backup',90,'Backup wird verschlüsselt…');
    const encrypted=await encryptBackupBytes(archive,password);
    const fileName=`CPRB_${includeFiles?'Komplett':'Daten'}_${backupDateStamp()}.cprbbackup`;
    downloadBackupBlob(new Blob([encrypted],{type:'application/octet-stream'}),fileName);
    const savedAt=new Date().toISOString();
    localStorage.setItem(`cprb-last-backup-${currentUser.id}`,savedAt);
    renderBackupCenter();
    setBackupProgress('backup',100,`${collected.rowCount} Einträge${includeFiles?` und ${files.included.length} Dateien`:''} gesichert · ${formatBackupBytes(encrypted.length)}`);
    if(files.failed.length)alert(`Backup erstellt. ${files.failed.length} Datei(en) konnten nicht geladen werden und fehlen in dieser Sicherung.`);
  }catch(error){
    console.error(error);
    hideBackupProgress('backup');
    alert(`Backup konnte nicht erstellt werden: ${error.message}`);
  }finally{
    setBackupBusy(false);
  }
}

function normalizeRestoredRows(rows){
  return (rows||[]).map(row=>({...row,user_id:currentUser.id}));
}

async function restoreBackupFiles(zip,files,onProgress){
  for(let index=0;index<files.length;index+=1){
    const file=files[index];
    onProgress(index,files.length,file.path);
    const entry=zip.file(file.zip_path);
    if(!entry)throw new Error(`Datei fehlt im Backup: ${file.path}`);
    const bytes=await entry.async('uint8array');
    const {error}=await sb.storage.from(file.bucket).upload(file.path,bytes,{
      contentType:backupFileMimeType(file.path,file.type),
      cacheControl:'3600',
      upsert:true
    });
    if(error)throw new Error(`${file.path}: ${error.message}`);
  }
}

async function restoreBackupTables(tables,onProgress){
  let restored=0;
  for(let index=0;index<CPRB_RESTORE_ORDER.length;index+=1){
    const name=CPRB_RESTORE_ORDER[index];
    const rows=normalizeRestoredRows(tables[name]);
    if(!rows.length)continue;
    onProgress(index,CPRB_RESTORE_ORDER.length,name);
    const definition=CPRB_BACKUP_TABLES.find(item=>item.name===name)||{};
    const chunkSize=250;
    for(let start=0;start<rows.length;start+=chunkSize){
      const chunk=rows.slice(start,start+chunkSize);
      const options=definition.conflict?{onConflict:definition.conflict}:undefined;
      const {error}=await sb.from(name).upsert(chunk,options);
      if(error)throw new Error(`${name}: ${error.message}`);
      restored+=chunk.length;
    }
  }
  return restored;
}

async function restoreCprbBackup(){
  const file=$('#backupFile')?.files?.[0];
  const password=$('#restorePassword')?.value||'';
  if(!file)return alert('Bitte zuerst eine CPRB-Backup-Datei auswählen.');
  if(password.length<6)return alert('Bitte das Passwort der Sicherung eingeben.');
  if(!confirm('Backup jetzt sicher mit deinen vorhandenen Daten zusammenführen? Es werden keine Einträge gelöscht.'))return;

  setBackupBusy(true);
  setBackupProgress('restore',3,'Backup wird entschlüsselt…');
  try{
    const encrypted=new Uint8Array(await file.arrayBuffer());
    const archive=await decryptBackupBytes(encrypted,password);
    setBackupProgress('restore',15,'Backup wird geprüft…');
    const zip=await JSZip.loadAsync(archive);
    const manifestEntry=zip.file('manifest.json');
    if(!manifestEntry)throw new Error('Die Backup-Beschreibung fehlt.');
    const manifest=JSON.parse(await manifestEntry.async('text'));
    if(manifest.format!=='cprb-backup'||manifest.version!==CPRB_BACKUP_VERSION)throw new Error('Diese Backup-Version wird noch nicht unterstützt.');
    if(manifest.owner_id!==currentUser.id)throw new Error('Dieses Backup gehört zu einem anderen CPRB-Konto.');

    const files=Array.isArray(manifest.files)?manifest.files:[];
    if(files.length){
      await restoreBackupFiles(zip,files,(index,total,path)=>{
        setBackupProgress('restore',18+(index/Math.max(total,1))*42,`Dateien ${index+1}/${total}: ${path.split('/').pop()}`);
      });
    }
    const restored=await restoreBackupTables(manifest.tables||{},(index,total,name)=>{
      setBackupProgress('restore',62+(index/total)*33,`${name} wird wiederhergestellt…`);
    });
    if(manifest.local?.active_fitness_plan)localStorage.setItem(`northstar-fitness-plan-${currentUser.id}`,manifest.local.active_fitness_plan);
    setBackupProgress('restore',97,'Ansicht wird aktualisiert…');
    await loadAll();
    setBackupProgress('restore',100,`${restored} Einträge und ${files.length} Dateien wiederhergestellt ✓`);
    alert('Backup erfolgreich wiederhergestellt.');
  }catch(error){
    console.error(error);
    hideBackupProgress('restore');
    alert(`Backup konnte nicht wiederhergestellt werden: ${error.message}`);
  }finally{
    setBackupBusy(false);
  }
}

function csvCell(value){
  let normalized=value;
  if(Array.isArray(value)||value&&typeof value==='object')normalized=JSON.stringify(value);
  const string=String(normalized??'');
  return `"${string.replace(/"/g,'""')}"`;
}

function rowsToCsv(rows){
  const columns=[...new Set((rows||[]).flatMap(row=>Object.keys(row)))];
  if(!columns.length)return 'Keine Daten\r\n';
  return '\ufeff'+[columns.map(csvCell).join(';'),...rows.map(row=>columns.map(column=>csvCell(row[column])).join(';'))].join('\r\n');
}

async function exportCprbCsv(){
  const moduleName=$('#exportModule')?.value||'trading';
  const tables=CPRB_EXPORT_MODULES[moduleName];
  if(!tables)return;
  setBackupBusy(true);
  try{
    const collected=await collectBackupData(tables);
    const zip=new JSZip();
    Object.entries(collected.tables).forEach(([name,rows])=>zip.file(`${name}.csv`,rowsToCsv(rows)));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
    downloadBackupBlob(blob,`CPRB_Export_${moduleName}_${backupDateStamp()}.zip`);
  }catch(error){
    console.error(error);
    alert(`Export fehlgeschlagen: ${error.message}`);
  }finally{
    setBackupBusy(false);
  }
}

function renderBackupCenter(){
  if(!currentUser)return;
  const stored=localStorage.getItem(`cprb-last-backup-${currentUser.id}`);
  const card=$('#backupStatusCard');
  const title=$('#backupStatusTitle');
  const copy=$('#backupStatusCopy');
  const icon=$('#backupStatusIcon');
  if(!card||!title||!copy||!icon)return;
  if(!stored){
    card.classList.add('due');
    icon.textContent='!';
    title.textContent='Noch kein Backup';
    copy.textContent='Erstelle jetzt deine erste Sicherung.';
    return;
  }
  const date=new Date(stored);
  const days=Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));
  const due=days>=30;
  card.classList.toggle('due',due);
  icon.textContent=due?'!':'✓';
  title.textContent=days===0?'Heute gesichert':days===1?'Gestern gesichert':`Vor ${days} Tagen gesichert`;
  copy.textContent=due?'Eine neue Sicherung ist empfohlen.':new Intl.DateTimeFormat('de-AT',{dateStyle:'medium',timeStyle:'short'}).format(date);
}

$('#backupFile')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];
  $('#backupFileName').textContent=file?`${file.name} · ${formatBackupBytes(file.size)}`:'CPRB-Backup auswählen';
});
