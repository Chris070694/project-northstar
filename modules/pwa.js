let deferredInstallPrompt=null;
const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;

function openInstallGuide(){
  $('#installGuide')?.classList.add('show');
  document.body.classList.add('sheet-open');
}
function closeInstallGuide(){
  $('#installGuide')?.classList.remove('show');
  document.body.classList.remove('sheet-open');
}

if(isIos&&!isStandalone)$('#pwaNotice')?.classList.add('show');

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  $('#pwaNotice')?.classList.add('show');
});

$('#installBtn')?.addEventListener('click',async()=>{
  if(isIos){
    openInstallGuide();
    return;
  }
  if(!deferredInstallPrompt){
    alert('Öffne das Browser-Menü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
});

window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  $('#pwaNotice')?.classList.remove('show');
});

document.addEventListener('keydown',event=>{if(event.key==='Escape')closeInstallGuide()});

if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));
}
