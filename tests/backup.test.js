const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

const source=fs.readFileSync('modules/backup.js','utf8');
const context={
  crypto:webcrypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  console,
  $:()=>null,
  currentUser:{id:'test-user'},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  globalThis:null
};
context.globalThis=context;

const test=`
globalThis.testPromise=(async()=>{
  const payload=new TextEncoder().encode('CPRB test payload');
  const encrypted=await encryptBackupBytes(payload,'sicher123');
  const decrypted=await decryptBackupBytes(encrypted,'sicher123');
  if(new TextDecoder().decode(decrypted)!=='CPRB test payload')throw new Error('Encryption roundtrip failed');

  let wrongPasswordRejected=false;
  try{await decryptBackupBytes(encrypted,'falsch99')}
  catch(error){wrongPasswordRejected=/falsch|beschädigt/.test(error.message)}
  if(!wrongPasswordRejected)throw new Error('Wrong password was accepted');

  const refs=collectBackupFiles({
    trades:[{before_image_path:'user/trades/before.png'}],
    library_books:[{pdf_path:'user/books/book.pdf',cover_path:'user/covers/book.webp'}]
  });
  if(refs.length!==3)throw new Error('Storage references were not collected');
  if(refs[0].bucket!=='northstar-media'||refs[1].bucket!=='northstar-library')throw new Error('Storage bucket mapping failed');
  if(backupFileMimeType('user/books/book.pdf','application/octet-stream')!=='application/pdf')throw new Error('PDF MIME type correction failed');
  if(backupFileMimeType('user/covers/book.webp','application/octet-stream')!=='image/webp')throw new Error('Image MIME type correction failed');

  const csv=rowsToCsv([{title:'A;B',note:'Zitat "ok"'}]);
  if(!csv.includes('"A;B"')||!csv.includes('"Zitat ""ok"""'))throw new Error('CSV escaping failed');
})();`;

vm.runInNewContext(`${source}\n${test}`,context,{filename:'backup.js'});
context.testPromise.then(()=>console.log('backup crypto, MIME correction, password rejection, file mapping and CSV: OK'));
