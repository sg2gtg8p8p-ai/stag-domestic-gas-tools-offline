'use strict';
(()=>{
 const CALC_HASH='766160e79f43e94ddcf8f94d039421b3f378ef559f0465884fede3eb4e987b06', REF_HASH='fbd24b1893db6a5361bed8ec9c527738793c99777b618973369387592a27623a', VERSION='approved-20261009-622952a27038';
 let registration, verified=false, reloading=false;
 const $=id=>document.getElementById(id), tools=$('tools');
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const block=message=>{verified=false;tools.disabled=true;tools.inert=true;$('readiness').textContent=message;$('readiness').dataset.state='blocked';};
 const connection=()=>{$('connection').textContent=navigator.onLine?'Online':'Offline';$('connection').dataset.offline=String(!navigator.onLine);};
 async function asset(name,expected){const r=await fetch(name,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Offline file unavailable: '+name);const b=await r.arrayBuffer();if(await digest(b)!==expected)throw Error('Offline file failed integrity check: '+name);return b;}
 async function cacheHealth(){
  if(!navigator.serviceWorker?.controller)return false;
  return await new Promise(resolve=>{const channel=new MessageChannel(), timer=setTimeout(()=>resolve(false),5000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data?.ok===true);};navigator.serviceWorker.controller.postMessage({type:'CHECK'},[channel.port2]);});
 }
 async function readiness(){
  if(!verified)return;
  const ready=await cacheHealth();if(!verified)return;
  $('readiness').dataset.state=ready?'ready':'incomplete';
  $('readiness').textContent=ready?'Offline copy verified • Ready to reopen without internet':'Calculators verified • Offline installation not yet complete';
 }
 async function start(){
  block('Checking calculator and reference integrity…');connection();
  try{
   const [bytes,refs]=await Promise.all([asset('calculator.js',CALC_HASH),asset('reference.json',REF_HASH)]);
   const reference=JSON.parse(new TextDecoder().decode(refs));if(reference.version!==VERSION||reference.calculationSHA256!==CALC_HASH)throw Error('Reference version mismatch');
   const script=document.createElement('script'),url=URL.createObjectURL(new Blob([bytes],{type:'application/javascript'}));script.src=url;
   await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Calculator could not start'));document.head.appendChild(script);});URL.revokeObjectURL(url);
   verified=true;tools.disabled=false;tools.inert=false;
   if(!('serviceWorker' in navigator)||!window.isSecureContext){$('readiness').textContent='Offline installation unavailable: use Safari over HTTPS.';return;}
   registration=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
   const waiting=()=>{$('update').hidden=!registration.waiting;};waiting();
   registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){waiting();readiness();}});});
   await navigator.serviceWorker.ready;await readiness();
  }catch(e){block(e.message+' — reconnect and repair before using calculators.');}
 }
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(reloading){location.reload();return;}readiness();});
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='INTEGRITY_FAILURE')block('Offline copy is incomplete or corrupt. Reconnect and repair before calculating.');});
 $('update').onclick=()=>{if(registration?.waiting&&confirm('Finish any timed test first. Finish timed tests in every app window. Applying the update reloads this app window and clears its unsaved inputs. Continue?')){reloading=true;registration.waiting.postMessage({type:'ACTIVATE'});}};
 $('repair').onclick=async()=>{
  if(!navigator.onLine){block('Repair requires an internet connection. Reconnect, then check / repair.');return;}
  $('readiness').textContent='Verifying and repairing offline files…';
  try{
   if(navigator.serviceWorker?.controller){await new Promise((resolve,reject)=>{const ch=new MessageChannel(),t=setTimeout(()=>reject(Error('Repair timed out')),12000);ch.port1.onmessage=e=>{clearTimeout(t);e.data?.ok?resolve():reject(Error('Repair failed'));};navigator.serviceWorker.controller.postMessage({type:'REPAIR'},[ch.port2]);});}
   location.reload();
  }catch(e){block(e.message+' — keep connected and try again.');}
 };
 $('persist').onclick=async()=>{const kept=await navigator.storage?.persist?.();alert(kept?'Persistent storage granted. Still check Offline copy verified before leaving coverage.':'Storage persistence was not granted. iOS may clear cached files; check readiness before leaving coverage.');};
 window.addEventListener('online',()=>{connection();readiness();});window.addEventListener('offline',()=>{connection();readiness();});
 window.addEventListener('pageshow',()=>{if(verified)verifyLoaded();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&verified)verifyLoaded();});
 async function verifyLoaded(){try{await Promise.all([asset('calculator.js',CALC_HASH),asset('reference.json',REF_HASH)]);await readiness();}catch(e){block(e.message+' — reconnect and repair.');}}
 start();
})();
