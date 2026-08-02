
const CACHE='northstar-v033';
const ASSETS=['./','./index.html','./styles.css','./app.js','./config.js',
'./modules/core.js','./modules/trading.js','./modules/focus.js','./modules/goals.js',
'./modules/fitness.js','./modules/notes.js','./modules/academy.js','./modules/calendar.js','./modules/pwa.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
