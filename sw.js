'use strict';
const FILES={"index.html":"3b5a3b4a8e31318ac13aa27c92f0872ab0b425074235e8da546ed835628cde97","bootstrap.js":"d2a15352d8786135682e63aed399ee972199871736fb3719fc86cd76a5c111e2","calculator.js":"25715f0d649f750c59c6c1766cbe8a0228a11578e78724122d5c08e815c6203e","reference.json":"d9dfffc623652bc03e3212c278c40549145234c33d95173e18d9c91cbe9f39e2","styles.css":"086e43ad349ca6477b25a3614227f78e9fb9baadddf7fbf56848dbe2a7888dc6","manifest.webmanifest":"c7d3d570deec0b90bdcffd9f9af3360ee5f5bafcbf21ecf3d36ea2eab4def472","icon-stag-black-teal-20261019-512.png":"3ad190e356f81869b3ce8f3abc50fc1234d67abfedf9af454368c47fadf5cf05","icon-stag-black-teal-20261019-192.png":"6a01070c6f45a8ccc43693f3da54ce8fc843bb8bf86cce9043e07af9cd7a117a","apple-touch-icon-stag-black-teal-20261019-180.png":"6ff735a6817c1ae22e51623855f6cff3c0a87ede094e35ce04cc9e7b5ddabacb","apple-touch-icon-stag-black-teal-20261019-167.png":"804c2aeaa8f9906c014938d282af19d1cd8cda9e49a7eec48dcd592ed4b12d3e","apple-touch-icon-stag-black-teal-20261019-152.png":"dae50229310711b7ee0b76f974c69592e705e932a2d0769cd60b2a38f0f55238","favicon-stag-black-teal-20261019-32.png":"2d23225ee24a45bc4077cfa1f3b1cb6a22f7e0bf0e97bd5b8ef34a4db6457ad5","btu-engine.mjs":"73b10ca0817134a9ea76e65d642d311de01341014d31b3e98e3dfce0080468bd","btu-ui.mjs":"b8ff6a43b5bf95c6bdab242b6a3f98a0c0c4d8fb694d5ddc446cd7f28b4316d6","btu-runtime.js":"ce3e9188b6921d44c4296461bbdf74f48f876546dc6f8638ff183befebb5ed2f"}, RELEASE='bdd9bc87a844e330', CACHE='stag-gas-offline-'+RELEASE;
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
