'use strict';
const FILES={"index.html":"54f4c3f06a6403d1f27ed008e1b7fc008c717a2be24525faa0e46eecccf9896a","bootstrap.js":"85f9b52063113349531f33e54ae5a2b7314d4410c06858cfcb9f384d529c3f36","calculator.js":"766160e79f43e94ddcf8f94d039421b3f378ef559f0465884fede3eb4e987b06","reference.json":"fbd24b1893db6a5361bed8ec9c527738793c99777b618973369387592a27623a","styles.css":"9c9044ca72107040a1d70e31d96a8b63e0bf6df9826b390ef6dd71799fe5cf62","manifest.webmanifest":"a536773c20075e059797f9c38b0f0098b2aa7d099e100694b629a15d1e2c35f6","icon-stag-option-b-v2-512.png":"a405e85bf1dc67b3a1a480a677805ede8e4398b646fc9f1469cd3b3c6f3d6694","icon-stag-option-b-v2-256.png":"e566bafeb185a5a1890f8ec6625012189838adbe069d2d99587570a0f828503f","icon-stag-option-b-v2-192.png":"33816773f7ca8b4c9ab856c2a83e5bc1e7a2414b6e63ac5a8d4610d6bc0098cc","apple-touch-icon-stag-option-b-v2-180.png":"b144cf17747f06b87a9f3b80d37421b83ec76ae4d97a6c3cb43c947042b1d597","apple-touch-icon-stag-option-b-v2-167.png":"810cc3cd3e705127d4634f4ad4278d0b9d05ec1921b43eed117c43df5dca3515","apple-touch-icon-stag-option-b-v2-152.png":"937f8fba6765b621326ab800c9e9aeaa137a694a719463e9e1575c883db333e3","favicon-stag-option-b-v2-32.png":"b399a50c306c529730a4336389684d468d476af46bdbb755a3fd8666f861c532"}, RELEASE='d43a8a732e40a8ed', CACHE='stag-gas-offline-'+RELEASE;
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
