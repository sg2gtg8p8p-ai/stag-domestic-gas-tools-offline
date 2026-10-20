import {emptyDraft,calculateRoom,changeUnits,finiteNumber,roomSummary,PRESETS,LIMITATIONS,InputError,BTU_PER_WATT_HOUR} from './btu-engine.mjs';
const clone = x => structuredClone(x);
export function createRoomStore() {
  let state={draft:emptyDraft(),revision:0,calculated:null,editingId:null,dirty:false,rooms:[],nextId:1};
  const clearResult=()=>{state.calculated=null;state.revision++;};
  const restoreSaved=()=>{if(state.editingId)state.rooms=state.rooms.map(r=>r.id===state.editingId?{...r,stale:false}:r);};
  return {
    getState:()=>clone(state),
    updateDraft(draft){if(JSON.stringify(draft)===JSON.stringify(state.draft))return;state.draft=clone(draft);state.dirty=true;clearResult();if(state.editingId)state.rooms=state.rooms.map(r=>r.id===state.editingId?{...r,stale:true}:r);},
    convertUnits(unit){this.updateDraft(changeUnits(state.draft,unit));},
    calculate(){try{const result=calculateRoom(state.draft);state.calculated={revision:state.revision,result};return{ok:true,result:clone(result)};}catch(e){state.calculated=null;if(e instanceof InputError)return{ok:false,errors:[...e.messages]};throw e;}},
    save(){if(!state.calculated||state.calculated.revision!==state.revision)throw new InputError(['Calculate the current inputs before saving this room.']);const total=state.rooms.filter(r=>r.id!==state.editingId&&!r.stale).reduce((sum,r)=>sum+r.result.watts,state.calculated.result.watts);if(!Number.isFinite(total)||!Number.isFinite(total*BTU_PER_WATT_HOUR))throw new InputError(['The schedule subtotal is outside a finite valid range. Check the room inputs.']);const id=state.editingId??`room-${state.nextId++}`;const old=state.rooms.find(r=>r.id===id);const result=clone(state.calculated.result);const name=result.name||old?.name||`Room ${state.rooms.length+1}`;const entry={id,name,input:clone(state.draft),result,stale:false};state.rooms=old?state.rooms.map(r=>r.id===id?entry:r):[...state.rooms,entry];state.editingId=id;state.dirty=false;return clone(entry);},
    edit(id){if(state.dirty)throw new InputError(['Save or discard the current draft before loading a saved room.']);const entry=state.rooms.find(r=>r.id===id);if(!entry)throw new InputError(['That room is no longer in the schedule.']);state.draft=clone(entry.input);state.revision++;state.calculated={revision:state.revision,result:clone(entry.result)};state.editingId=id;state.dirty=false;return clone(entry);},
    newRoom(){restoreSaved();state.draft=emptyDraft();state.revision++;state.calculated=null;state.editingId=null;state.dirty=false;},
    remove(id){state.rooms=state.rooms.filter(r=>r.id!==id);if(state.editingId===id){state.draft=emptyDraft();state.revision++;state.calculated=null;state.editingId=null;state.dirty=false;}}
  };
}
export function scheduleTotals(state) {
  const valid=state.rooms.filter(r=>!r.stale),watts=valid.reduce((sum,r)=>sum+r.result.watts,0);
  return {watts,kilowatts:watts/1000,btuPerHour:watts*BTU_PER_WATT_HOUR,count:valid.length,stale:state.rooms.length-valid.length};
}
const fmt=(n,d=0)=>n.toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
export function summaryText(state) {
  const totals=scheduleTotals(state),parts=['Gas Tools — simplified room heat-loss estimates'];
  for(const room of state.rooms)parts.push(room.stale?`${room.name}: EDIT IN PROGRESS — excluded from subtotal until recalculated and saved.`:roomSummary(room.result,room.name));
  if(totals.count)parts.push(`Subtotal of ${totals.count} saved room estimate${totals.count===1?'':'s'}: ${fmt(totals.watts)} W | ${fmt(totals.kilowatts,2)} kW | ${fmt(totals.btuPerHour)} BTU/h. This is not final boiler sizing.`);
  if(totals.stale)parts.push(`${totals.stale} room edit${totals.stale===1?' is':'s are'} excluded from the subtotal.`);
  if(state.calculated&&(!state.editingId||state.dirty))parts.push('Current draft estimate — NOT included in the saved-room subtotal:\n'+roomSummary(state.calculated.result));
  if(!state.rooms.length&&!state.calculated)parts.push('No calculated rooms.');
  parts.push('Method: Σ(U × area × positive room/boundary temperature difference) + 0.33 × air changes/h × room volume × positive room/outside difference. Construction and adjacent temperatures must be checked. Thermal bridges, detailed ground effects and internal-wall exchange are not fully modelled. No radiator water-temperature correction or product selection.\nSources: https://www.stelradprofessional.com/basic-heat-loss-calculator/ ; https://www.cibsejournal.com/cpd/modules/2013-02/');
  return parts.join('\n\n');
}
export async function copyWithFallback(text,clipboard) {
  try{if(!clipboard||typeof clipboard.writeText!=='function')throw new Error('Unavailable');await clipboard.writeText(text);return{copied:true,text,message:'Summary copied.'};}
  catch{return{copied:false,text,message:'Automatic copy is unavailable here. Select and copy the text below.'};}
}
const mountedPanels=new WeakMap();
const namespaceClasses=cls=>cls.split(/\s+/).filter(Boolean).map(c=>'btu-'+c).join(' ');
export function mount(root,doc=root?.ownerDocument??globalThis.document) {
  if(!root||root.id!=='btu')throw new Error('BTU panel root is missing');
  if(mountedPanels.has(root))return mountedPanels.get(root);
  const get=id=>root.querySelector('#btu-'+id),form=get('roomForm'),store=createRoomStore(),status=get('status');
  const control=name=>form.elements.namedItem('btu-'+name);
  if(!form)throw new Error('Room form is missing');
  for(const kind of ['wall','glazing','floor','ceiling']){
    const select=control(kind+'Preset');
    for(const [id,p]of Object.entries(PRESETS[kind])){const o=doc.createElement('option');o.value=id;o.textContent=`${p.label} · U ${p.u.toFixed(2)}`;select.append(o);}
    for(const [id,label]of [['custom','Enter a known U-value'],['not-sure','Not sure — needs checking']]){const o=doc.createElement('option');o.value=id;o.textContent=label;select.append(o);}
  }
  const inputKeys=Object.keys(emptyDraft()).filter(k=>!['exposed','exposureConfirmed'].includes(k));
  function readForm(){const draft={};for(const key of inputKeys)draft[key]=control(key).value;draft.exposed=['A','B','C','D'].filter(x=>get('wall'+x).checked);draft.exposureConfirmed=control('exposureConfirmed').checked;return draft;}
  function fillForm(){const d=store.getState().draft;for(const key of inputKeys)control(key).value=d[key];for(const wall of ['A','B','C','D'])get('wall'+wall).checked=d.exposed.includes(wall);control('exposureConfirmed').checked=d.exposureConfirmed;}
  const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=namespaceClasses(cls);return n;};
  const announce=(text,bad=false)=>{status.textContent=text;status.className=bad?'btu-status btu-error':'btu-status';};
  function render(){
    const state=store.getState(),d=state.draft,areaUnit=d.unit==='ft'?'ft²':'m²';
    root.querySelectorAll('[data-btu-length-unit]').forEach(n=>n.textContent=d.unit);root.querySelectorAll('[data-btu-area-unit]').forEach(n=>n.textContent=areaUnit);
    for(const kind of ['wall','glazing','floor','ceiling'])get(kind+'Custom').hidden=d[kind+'Preset']!=='custom';
    get('windowInputs').hidden=d.windowMode!=='area';get('glazingSection').hidden=d.windowMode!=='area';
    get('groundNote').hidden=d.floorPreset!=='solidGround';
    const shown=x=>x===''?'—':String(x);
    get('activeAssumptions').textContent=`Current assumptions: room ${shown(d.inside)}°C · outside ${shown(d.outside)}°C · ${shown(d.ach)} air changes/h. Edit these below; the starting examples are not property facts.`;
    const l=finiteNumber(d.length),w=finiteNumber(d.width),h=finiteNumber(d.height);
    for(const wall of ['A','B','C','D'])get('wallLength'+wall).textContent=`${wall==='A'||wall==='C'?(l>0?fmt(l,2):'—'):(w>0?fmt(w,2):'—')} ${d.unit}`;
    const length=d.exposed.reduce((sum,x)=>sum+((x==='A'||x==='C'?l:w)||0),0);
    get('wallGeometry').textContent=l>0&&w>0&&h>0?`Selected exposed length: ${fmt(length,2)} ${d.unit}. Gross exposed wall area: ${fmt(length*h,2)} ${areaUnit}. Window area is deducted once from this total.`:'Enter dimensions to see the selected exposed-wall length and gross area.';
    get('draftLabel').textContent=state.editingId?`Editing ${state.rooms.find(r=>r.id===state.editingId)?.name??'room'}${state.dirty?' — changes not saved':''}`:'New room';
    const box=get('result');box.hidden=!state.calculated;box.replaceChildren();
    if(state.calculated){
      const r=state.calculated.result,metrics=el('div',undefined,'metrics');
      for(const [value,unit]of [[fmt(r.watts),'W'],[fmt(r.kilowatts,2),'kW'],[fmt(r.btuPerHour),'BTU/h']]){const item=el('div');item.append(el('strong',value),el('span',unit));metrics.append(item);}
      box.append(el('h2','Room heat-loss estimate'),metrics,el('p','Under the entered fabric, temperature and ventilation assumptions. Check actual construction before selecting an emitter.','small'));
      const details=el('details'),sum=el('summary','Breakdown and assumptions'),table=el('table');table.setAttribute('aria-label','Room heat-loss breakdown');const head=el('tr');for(const name of ['Element','Area / volume','U / ACH','ΔT','W'])head.append(el('th',name));table.append(head);
      for(const e of r.fabric){const row=el('tr');for(const text of [e.label,`${fmt(e.area,2)} m²`,fmt(e.u,2),`${fmt(e.deltaT,1)} K`,fmt(e.watts)])row.append(el('td',text));table.append(row);}
      const vent=el('tr');for(const text of ['Ventilation',`${fmt(r.geometry.volume,2)} m³`,`${fmt(r.assumptions.ach,2)}/h`,`${fmt(r.assumptions.inside-r.assumptions.outside,1)} K`,fmt(r.ventilationWatts)])vent.append(el('td',text));table.append(vent);details.append(sum,table);
      for(const e of r.fabric)details.append(el('p',`${e.label}: ${e.construction}; adjacent ${fmt(e.adjacent,1)}°C.`, 'small'));
      details.append(el('p',`Fabric ${fmt(r.fabricWatts)} W + ventilation ${fmt(r.ventilationWatts)} W. Inside ${fmt(r.assumptions.inside,1)}°C; outside ${fmt(r.assumptions.outside,1)}°C.`, 'small'));box.append(details);
    }
    get('saveRoom').disabled=!state.calculated;get('saveRoom').textContent=state.editingId?'Save room changes':'Add room to schedule';
    const list=get('roomList');list.replaceChildren();
    for(const room of state.rooms){
      const card=el('article',undefined,'room-row');card.append(el('strong',room.name));card.append(el('p',room.stale?'Edit in progress — excluded from subtotal.':`${fmt(room.result.watts)} W · ${fmt(room.result.btuPerHour)} BTU/h`));
      const actions=el('div',undefined,'actions');for(const [text,action]of [['Edit',()=>{try{store.edit(room.id);fillForm();render();announce(`Loaded ${room.name}.`);get('calculator').scrollIntoView({block:'start'});}catch(e){announce(e.message,true);}}],['Remove',()=>{store.remove(room.id);fillForm();render();announce(`${room.name} removed.`);} ]]){const b=el('button',text,'secondary');b.type='button';b.addEventListener('click',action);actions.append(b);}card.append(actions);list.append(card);
    }
    if(!state.rooms.length)list.append(el('p','No rooms added yet. Rooms stay in this page only.','small'));
    const totals=scheduleTotals(state);get('subtotal').textContent=totals.count?`Saved-room estimate subtotal: ${fmt(totals.watts)} W · ${fmt(totals.kilowatts,2)} kW · ${fmt(totals.btuPerHour)} BTU/h${totals.stale?` (${totals.stale} edit excluded)`:''}. Not final boiler sizing.`:totals.stale?'Room edit in progress. No current saved estimate is included.':'Calculate and add rooms to build a schedule.';
    get('copyPanel').hidden=true;
  }
  form.addEventListener('input',event=>{if(event.target.name==='btu-unit')return;store.updateDraft(readForm());render();announce('Inputs changed. Calculate again to show a current estimate.');});
  control('unit').addEventListener('change',()=>{const desired=control('unit').value,old=store.getState().draft.unit,draft=readForm();draft.unit=old;store.updateDraft(draft);store.convertUnits(desired);fillForm();render();announce('Dimensions and window area converted. Calculate again.');});
  form.addEventListener('submit',event=>{event.preventDefault();store.updateDraft(readForm());const result=store.calculate();render();announce(result.ok?'Current estimate calculated. Add or save the room when ready.':result.errors.join(' '),!result.ok);});
  get('saveRoom').addEventListener('click',()=>{try{const room=store.save();render();announce(`${room.name} saved to this page’s schedule.`);}catch(e){announce(e.message,true);}});
  get('newRoom').addEventListener('click',()=>{store.newRoom();fillForm();render();announce('New room. Unsaved changes discarded; any previously saved estimate restored.');});
  get('copySummary').addEventListener('click',async()=>{const result=await copyWithFallback(summaryText(store.getState()),globalThis.navigator?.clipboard);announce(result.message,!result.copied);if(!result.copied){get('copyText').value=result.text;get('copyPanel').hidden=false;get('copyText').focus();get('copyText').select();}});
  for(const kind of ['floor','ceiling'])get(kind+'Outside').addEventListener('click',()=>{control(kind+'Adjacent').value=control('outside').value;store.updateDraft(readForm());render();announce('Adjacent temperature explicitly copied from the outside assumption. Calculate again.');});
  get('roomTempExample').addEventListener('click',()=>{control('inside').value=control('roomType').value==='bathroom'?'22':'21';store.updateDraft(readForm());render();announce('Published room-temperature example applied; edit it for this room.');});
  const limits=get('limitsList');for(const text of LIMITATIONS)limits.append(el('li',text));
  fillForm();render();get('controls').disabled=false;mountedPanels.set(root,store);return store;
}
if(typeof document!=='undefined'){const root=document.getElementById('btu');if(root)mount(root);}
