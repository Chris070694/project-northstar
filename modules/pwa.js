
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstallPrompt=e;
  $('#pwaNotice')?.classList.add('show');
});
$('#installBtn')?.addEventListener('click',async()=>{
  if(!deferredInstallPrompt){
    alert('Die Installation wird verfügbar, sobald Northstar online über Vercel geöffnet wird.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  $('#pwaNotice')?.classList.remove('show');
});
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));
}
