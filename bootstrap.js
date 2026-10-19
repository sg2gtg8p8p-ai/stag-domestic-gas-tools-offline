'use strict';
(()=>{
 const CALC_HASH='25715f0d649f750c59c6c1766cbe8a0228a11578e78724122d5c08e815c6203e', REF_HASH='d9dfffc623652bc03e3212c278c40549145234c33d95173e18d9c91cbe9f39e2', VERSION='approved-20261009-622952a27038';
 let registration, verified=false, reloading=false, checkingUpdate=false, lastUpdateCheck=0;
 const $=id=>document.getElementById(id), tools=$('tools');
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const block=message=>{verified=false;tools.disabled=true;tools.inert=true;$('readiness').textContent=message;$('readiness').dataset.state='blocked';$('appAlert').hidden=false;$('appAlert').textContent=message;};
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
   verified=true;tools.disabled=false;tools.inert=false;$('appAlert').hidden=true;
   if(!('serviceWorker' in navigator)||!window.isSecureContext){$('readiness').textContent='Offline installation unavailable: use Safari over HTTPS.';return;}
   registration=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
   const waiting=()=>{$('update').hidden=!registration.waiting;$('updateNotice').hidden=!registration.waiting;$('menuLabel').textContent='Menu';};waiting();
   registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){waiting();readiness();}});});
   await navigator.serviceWorker.ready;waiting();await readiness();checkForUpdates(false);
  }catch(e){block(e.message+' — reconnect and repair before using calculators.');}
 }
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{$('update').hidden=!registration?.waiting;if(reloading){location.reload();return;}readiness();});
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='INTEGRITY_FAILURE')block('Offline copy is incomplete or corrupt. Reconnect and repair before calculating.');});
 $('update').onclick=()=>{
  if(!registration?.waiting)return;
  const timing=typeof isGasRateTiming==='function'?isGasRateTiming():(typeof grTimerId!=='undefined'&&grTimerId!==null);
  const warning=(timing?'A gas-rate test is running in this window. ':'')+'Finish any timed test first. Finish timed tests in every app window. Applying the update reloads this app window and clears its unsaved inputs. Continue?';
  if(!confirm(warning))return;
  reloading=true;registration.waiting.postMessage({type:'ACTIVATE'});
 };
 async function checkForUpdates(manual=false){
  if(checkingUpdate||!registration)return;if(!manual&&Date.now()-lastUpdateCheck<60000)return;if(!manual&&!navigator.onLine)return;lastUpdateCheck=Date.now();checkingUpdate=true;
  const button=$('checkUpdates'), status=$('updateStatus');button.disabled=true;status.textContent='Checking for updates…';
  try{
   if(!navigator.onLine)throw Error('Connect to check for updates.');
   registration ||= await navigator.serviceWorker?.getRegistration();
   if(!registration)throw Error('Open the app online, then try again.');
   await registration.update();
   if(registration.installing)await new Promise((resolve,reject)=>{const worker=registration.installing,timer=setTimeout(()=>reject(Error('Download is still in progress. Check again shortly.')),30000);const state=()=>{if(['installed','redundant'].includes(worker.state)){clearTimeout(timer);worker.state==='installed'?resolve():reject(Error('The update could not be verified. Try again when connected.'));}};worker.addEventListener('statechange',state);state();});
   $('update').hidden=!registration.waiting;$('updateNotice').hidden=!registration.waiting;$('menuLabel').textContent='Menu';
   status.textContent=registration.waiting?'Update ready. Finish any timed tests before applying it.':"You’re up to date.";
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;checkingUpdate=false;}
 }
 $('checkUpdates').onclick=()=>checkForUpdates(true);
 $('applyUpdateNow').onclick=()=>$('update').click();
 $('repair').onclick=async()=>{
  if(!navigator.onLine){block('Repair requires an internet connection. Reconnect, then check / repair.');return;}
  $('readiness').textContent='Verifying and repairing offline files…';
  try{
   if(navigator.serviceWorker?.controller){await new Promise((resolve,reject)=>{const ch=new MessageChannel(),t=setTimeout(()=>reject(Error('Repair timed out')),12000);ch.port1.onmessage=e=>{clearTimeout(t);e.data?.ok?resolve():reject(Error('Repair failed'));};navigator.serviceWorker.controller.postMessage({type:'REPAIR'},[ch.port2]);});}
   location.reload();
  }catch(e){block(e.message+' — keep connected and try again.');}
 };
 $('persist').onclick=async()=>{const kept=await navigator.storage?.persist?.();alert(kept?'Persistent storage granted. Still check Offline copy verified before leaving coverage.':'Storage persistence was not granted. iOS may clear cached files; check readiness before leaving coverage.');};
 window.addEventListener('online',()=>{connection();readiness();checkForUpdates(false);});window.addEventListener('offline',()=>{connection();readiness();});
 window.addEventListener('pageshow',()=>{if(verified){verifyLoaded();checkForUpdates(false);}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&verified){verifyLoaded();checkForUpdates(false);}});
 async function verifyLoaded(){try{await Promise.all([asset('calculator.js',CALC_HASH),asset('reference.json',REF_HASH)]);await readiness();}catch(e){block(e.message+' — reconnect and repair.');}}
 start();
})();
