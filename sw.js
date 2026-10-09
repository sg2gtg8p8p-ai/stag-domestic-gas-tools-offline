'use strict';
const FILES={"index.html":"62eaae3f3cb4e2cea284cc51741c81f31bdea5eecce8b1e87d418b963818576d","bootstrap.js":"fa4a120e74dc5b871bc25b9292f0ac2042bf5491d2a86e68d60e468f4ee83c6b","calculator.js":"766160e79f43e94ddcf8f94d039421b3f378ef559f0465884fede3eb4e987b06","reference.json":"fbd24b1893db6a5361bed8ec9c527738793c99777b618973369387592a27623a","styles.css":"19baeb399b98d1a81e18e2238284c709ccf553863f913b1fd343edeec83ce071","manifest.webmanifest":"76b0c42c1291c80bd86528f35146164c1d88c851bea0d627191abbbf68b93ed2","icon-256.png":"54fb2bc470507a3868b3c8fbf1fb9f278a22eeaa6bb2b1a7afb0ed1245cfa8d8","icon-512.png":"f41a8e2775be83ccef6b2745a61389458c990f2bb62579f4d401032a84948193"}, RELEASE='6e76eb1dfaf6b073', CACHE='stag-gas-offline-'+RELEASE;
const url=name=>new URL(name,self.registration.scope).href;
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function valid(response,name){return !!response&&response.ok&&await digest(await response.clone().arrayBuffer())===FILES[name];}
async function network(name){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{const r=await fetch(url(name),{cache:'no-store',credentials:'omit',signal:controller.signal});if(!await valid(r,name))throw Error('Invalid release file');return r;}finally{clearTimeout(timer);}}
async function install(){
 const entries=await Promise.all(Object.keys(FILES).map(async name=>[name,await network(name)]));
 const cache=await caches.open(CACHE);for(const [name,r]of entries)await cache.put(url(name),r);
}
async function health(){const cache=await caches.open(CACHE);for(const name of Object.keys(FILES))if(!await valid(await cache.match(url(name)),name))return false;return true;}
async function notify(){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage({type:'INTEGRITY_FAILURE'});}
self.addEventListener('install',event=>event.waitUntil(install()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{if(!await health())throw Error('Incomplete offline installation');await self.clients.claim();})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE'){event.waitUntil(self.skipWaiting());return;}
 if(event.data?.type==='CHECK')event.waitUntil(health().then(ok=>event.ports[0]?.postMessage({ok,release:RELEASE})).catch(()=>event.ports[0]?.postMessage({ok:false})));
 if(event.data?.type==='REPAIR')event.waitUntil(install().then(()=>event.ports[0]?.postMessage({ok:true})).catch(()=>event.ports[0]?.postMessage({ok:false})));
});
const safePage='<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stag Gas Tools unavailable</title><body style="font:18px system-ui;padding:24px"><h1>Offline copy unavailable</h1><p>The calculator or reference files are incomplete or failed verification. Do not use this copy.</p><p>Reconnect to the internet and reopen Stag Gas Tools to repair the offline copy.</p><button onclick="location.reload()">Retry when connected</button></body></html>';
self.addEventListener('fetch',event=>{
 const request=event.request,u=new URL(request.url),base=new URL(self.registration.scope);
 if(request.method!=='GET'||u.origin!==base.origin||u.search||!u.pathname.startsWith(base.pathname))return;
 let name=u.pathname.slice(base.pathname.length);if(name==='')name='index.html';
 if(!Object.hasOwn(FILES,name))return;
 event.respondWith((async()=>{
  if(name==='index.html'&&!await health()){try{await install();}catch{await notify();return new Response(safePage,{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});}}
  const cache=await caches.open(CACHE);let response=await cache.match(url(name));
  if(await valid(response,name))return response;
  try{response=await network(name);await cache.put(url(name),response.clone());return response;}catch{await notify();return new Response(name==='index.html'?safePage:'Offline asset failed verification',{status:503,headers:{'Content-Type':name==='index.html'?'text/html; charset=utf-8':'text/plain'}});}
 })());
});
