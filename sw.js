'use strict';
const FILES={"index.html":"8884cf373326e52e5b5b1813b278505f26fa782085568aef5948f882d135a521","bootstrap.js":"85f9b52063113349531f33e54ae5a2b7314d4410c06858cfcb9f384d529c3f36","calculator.js":"766160e79f43e94ddcf8f94d039421b3f378ef559f0465884fede3eb4e987b06","reference.json":"fbd24b1893db6a5361bed8ec9c527738793c99777b618973369387592a27623a","styles.css":"9c9044ca72107040a1d70e31d96a8b63e0bf6df9826b390ef6dd71799fe5cf62","manifest.webmanifest":"c7d3d570deec0b90bdcffd9f9af3360ee5f5bafcbf21ecf3d36ea2eab4def472","icon-stag-black-teal-20261019-512.png":"3ad190e356f81869b3ce8f3abc50fc1234d67abfedf9af454368c47fadf5cf05","icon-stag-black-teal-20261019-192.png":"6a01070c6f45a8ccc43693f3da54ce8fc843bb8bf86cce9043e07af9cd7a117a","apple-touch-icon-stag-black-teal-20261019-180.png":"6ff735a6817c1ae22e51623855f6cff3c0a87ede094e35ce04cc9e7b5ddabacb","apple-touch-icon-stag-black-teal-20261019-167.png":"804c2aeaa8f9906c014938d282af19d1cd8cda9e49a7eec48dcd592ed4b12d3e","apple-touch-icon-stag-black-teal-20261019-152.png":"dae50229310711b7ee0b76f974c69592e705e932a2d0769cd60b2a38f0f55238","favicon-stag-black-teal-20261019-32.png":"2d23225ee24a45bc4077cfa1f3b1cb6a22f7e0bf0e97bd5b8ef34a4db6457ad5"}, RELEASE='0e7963546798d87c', CACHE='stag-gas-offline-'+RELEASE;
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
