// Deterministically derived from pinned reviewed BTU modules. Do not edit.
(()=>{
'use strict';
// Simplified room estimate. No network, storage, catalogue or appliance settings.
const VERSION = 'private-btu-2026-10-20';
const METRES_PER_FOOT = 0.3048;
const SQUARE_METRES_PER_SQUARE_FOOT = 0.09290304;
const BTU_PER_WATT_HOUR = 3.412141633;
const VENTILATION_COEFFICIENT = 0.33;
const PRESET_SOURCE = 'https://www.stelradprofessional.com/basic-heat-loss-calculator/';
const METHOD_SOURCES = Object.freeze([
  'https://www.stelrad.com/news-events/blog/how-to-calculate-the-heating-requirements-of-your-house/',
  'https://www.cibsejournal.com/cpd/modules/2013-02/'
]);
const freezeGroup = x => Object.freeze(Object.fromEntries(Object.entries(x).map(([k,v]) => [k,Object.freeze(v)])));
const PRESETS = Object.freeze({
  wall: freezeGroup({solidBrick:{label:'220 mm solid brick',u:2.10},cavityBare:{label:'Uninsulated brick cavity',u:1.47},cavityInsulated:{label:'Insulated brick cavity',u:0.50},timberFrame:{label:'Timber frame',u:0.29}}),
  glazing: freezeGroup({single:{label:'Single glazing — wood / PVC',u:5.0},double:{label:'Double glazing',u:2.9},lowE:{label:'Low-E double glazing',u:1.7}}),
  floor: freezeGroup({timberVoid:{label:'Timber over ventilated void',u:0.82},solidGround:{label:'Solid uninsulated earth — simplified',u:0.82,ground:true},concrete:{label:'Concrete floor',u:1.6},heatedSpace:{label:'Heated room below',u:1.36}}),
  ceiling: freezeGroup({heatedSpace:{label:'Heated room above',u:1.62},roofInsulated:{label:'Insulated roof space',u:0.71},roofBare:{label:'Uninsulated roof space',u:2.30},flatInsulated:{label:'Insulated flat roof',u:0.70},flatBare:{label:'Uninsulated flat roof',u:2.19}})
});
const LIMITATIONS = Object.freeze([
  'Simplified room estimate, not a full BS EN 12831 or MCS design or an installed-appliance assessment.',
  'Construction presets are published examples. Check the actual fabric and use a known U-value when needed; “not sure” cannot supply a heat-loss result.',
  'Thermal bridges, detailed ground effects, doors as separate elements, solar/internal gains and exchange through unselected internal walls are not fully modelled. Doors are included in the selected wall area at that wall U-value.',
  'Floor and ceiling use the entered adjacent temperature. The solid-earth preset is a simplified U × area × temperature-difference boundary, not an ISO ground-floor calculation.',
  'Warmer adjacent spaces contribute zero loss here; heat gains are not credited. Ventilation uses the entered air changes, without heat-recovery/wind/site corrections.',
  'Room heat loss is independent of radiator flow/return water temperature. Emitter output correction needs its own manufacturer data; it is not included.',
  'A sum of these room estimates is not a final boiler design output or an automatic radiator/product recommendation.'
]);
function emptyDraft() {
  return {name:'',roomType:'other',unit:'m',length:'',width:'',height:'',exposed:[],exposureConfirmed:false,windowMode:'',windowArea:'',wallPreset:'',wallCustomU:'',glazingPreset:'',glazingCustomU:'',floorPreset:'',floorCustomU:'',floorAdjacent:'',ceilingPreset:'',ceilingCustomU:'',ceilingAdjacent:'',inside:21,outside:-3,ach:0.5};
}
class InputError extends Error {
  constructor(messages){super(messages.join(' '));this.name='InputError';this.messages=messages;}
}
function finiteNumber(value) {
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!value.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim()))return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}
function changeUnits(draft,unit) {
  if(!['m','ft'].includes(unit)||!['m','ft'].includes(draft.unit))throw new InputError(['Choose metres or feet.']);
  const next=structuredClone(draft);if(next.unit===unit)return next;
  const factor=unit==='m'?METRES_PER_FOOT:1/METRES_PER_FOOT;
  const areaFactor=unit==='m'?SQUARE_METRES_PER_SQUARE_FOOT:1/SQUARE_METRES_PER_SQUARE_FOOT;
  for(const key of ['length','width','height','windowArea']){
    const n=finiteNumber(next[key]);if(n!==null)next[key]=String(n*(key==='windowArea'?areaFactor:factor));
  }
  next.unit=unit;return next;
}
function knownU(raw,kind,needed,errors) {
  if(!needed)return {u:0,label:'Not included — zero applicable area',preset:null};
  const id=raw[kind+'Preset'];
  if(id==='custom'){
    const u=finiteNumber(raw[kind+'CustomU']);
    if(u===null||u<=0){errors.push(`Enter a positive known ${kind} U-value in W/m²K.`);return null;}
    return {u,label:'Entered known U-value',preset:'custom'};
  }
  const value=Object.hasOwn(PRESETS[kind],id)?PRESETS[kind][id]:null;
  if(!value){errors.push(`Choose a known ${kind} construction or enter its known U-value.`);return null;}
  return {...value,preset:id};
}
function calculateRoom(raw) {
  const errors=[];
  const number=(key,label,positive=false)=>{const n=finiteNumber(raw[key]);if(n===null||(positive&&n<=0))errors.push(`Enter ${positive?'a positive':'a finite'} ${label}.`);return n;};
  const l=number('length','room length',true),w=number('width','room width',true),h=number('height','room height',true);
  if(!['m','ft'].includes(raw.unit))errors.push('Choose metres or feet.');
  const inside=number('inside','room temperature'),outside=number('outside','outside design temperature'),ach=number('ach','air-change rate');
  if(inside!==null&&inside<=-273.15||outside!==null&&outside<=-273.15)errors.push('Temperatures must be above absolute zero.');
  if(inside!==null&&outside!==null&&outside>=inside)errors.push('For a heating estimate, outside design temperature must be lower than room temperature.');
  if(ach!==null&&ach<0)errors.push('Air changes per hour cannot be negative.');
  const exposed=Array.isArray(raw.exposed)?raw.exposed:[];
  if(!Array.isArray(raw.exposed)||new Set(exposed).size!==exposed.length||exposed.some(x=>!['A','B','C','D'].includes(x)))errors.push('Choose each exposed wall once from A, B, C and D.');
  if(raw.exposureConfirmed!==true)errors.push('Confirm the exposed-wall selection, including none if no walls are external.');
  if(!['none','area'].includes(raw.windowMode))errors.push('Choose no windows or enter a measured window area.');
  let windowArea=raw.windowMode==='none'?0:number('windowArea','window area',true);
  const factor=raw.unit==='ft'?METRES_PER_FOOT:1;
  const L=l*factor,W=w*factor,H=h*factor;
  windowArea=windowArea===null?null:windowArea*(raw.unit==='ft'?SQUARE_METRES_PER_SQUARE_FOOT:1);
  const wallLengths={A:L,B:W,C:L,D:W},exposedLength=exposed.reduce((sum,key)=>sum+(wallLengths[key]??0),0),grossWallArea=exposedLength*H;
  // Equal all-glass areas can differ by a few binary floating-point ulps after
  // exact m/ft conversion. Normalise only machine-precision equality; real
  // oversize windows still fail and never create negative opaque wall area.
  const areaTolerance=Number.EPSILON*32*Math.max(Number.MIN_VALUE,Math.abs(grossWallArea),Math.abs(windowArea??0));
  if(raw.windowMode==='area'&&windowArea>0&&Number.isFinite(windowArea)&&Number.isFinite(grossWallArea)&&Math.abs(windowArea-grossWallArea)<=areaTolerance)windowArea=grossWallArea;
  if(windowArea!==null&&windowArea>grossWallArea)errors.push('Window area cannot exceed the gross area of the selected exposed walls.');
  const netWallArea=windowArea===null?NaN:grossWallArea-windowArea;
  const wall=knownU(raw,'wall',netWallArea>0,errors),glazing=knownU(raw,'glazing',windowArea>0,errors),floor=knownU(raw,'floor',true,errors),ceiling=knownU(raw,'ceiling',true,errors);
  const floorAdjacent=number('floorAdjacent','temperature below the floor'),ceilingAdjacent=number('ceilingAdjacent','temperature above the ceiling');
  for(const t of [floorAdjacent,ceilingAdjacent])if(t!==null&&t<=-273.15)errors.push('Adjacent temperatures must be above absolute zero.');
  if(errors.length)throw new InputError([...new Set(errors)]);
  const planArea=L*W,volume=planArea*H,delta=Math.max(inside-outside,0);
  const fabric=[
    {id:'walls',label:'Opaque exposed walls',area:netWallArea,u:wall.u,adjacent:outside,construction:wall.label},
    {id:'windows',label:'Windows',area:windowArea,u:glazing.u,adjacent:outside,construction:glazing.label},
    {id:'floor',label:'Floor',area:planArea,u:floor.u,adjacent:floorAdjacent,construction:floor.label},
    {id:'ceiling',label:'Ceiling',area:planArea,u:ceiling.u,adjacent:ceilingAdjacent,construction:ceiling.label}
  ].map(e=>({...e,deltaT:Math.max(inside-e.adjacent,0),watts:e.u*e.area*Math.max(inside-e.adjacent,0)}));
  const fabricWatts=fabric.reduce((sum,e)=>sum+e.watts,0),ventilationWatts=VENTILATION_COEFFICIENT*ach*volume*delta,watts=fabricWatts+ventilationWatts;
  if(![L,W,H,planArea,volume,exposedLength,grossWallArea,netWallArea,windowArea,fabricWatts,ventilationWatts,watts,watts*BTU_PER_WATT_HOUR].every(Number.isFinite)||planArea<=0||volume<=0||netWallArea<0)throw new InputError(['The geometry or calculated result is outside a finite valid range. Check the inputs.']);
  return {version:VERSION,name:String(raw.name??'').replace(/[\r\n\t]/g,' ').trim().slice(0,80),roomType:String(raw.roomType??'other'),unit:raw.unit,geometry:{length:L,width:W,height:H,planArea,volume,exposed:[...exposed],exposedLength,grossWallArea,windowArea,netWallArea},assumptions:{inside,outside,ach,floorAdjacent,ceilingAdjacent},fabric,fabricWatts,ventilationWatts,watts,kilowatts:watts/1000,btuPerHour:watts*BTU_PER_WATT_HOUR,groundSimplification:floor.preset==='solidGround',limitations:[...LIMITATIONS]};
}
const rounded=(n,d=1)=>Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
function roomSummary(result,label=result.name||'Room') {
  const g=result.geometry,a=result.assumptions;
  return `${label}: ${rounded(result.watts,0)} W | ${rounded(result.kilowatts,2)} kW | ${rounded(result.btuPerHour,0)} BTU/h\nDimensions: ${rounded(g.length,3)} × ${rounded(g.width,3)} × ${rounded(g.height,3)} m; volume ${rounded(g.volume,2)} m³.\nExposed walls: ${g.exposed.join(', ')||'none'}; gross ${rounded(g.grossWallArea,2)} m²; windows ${rounded(g.windowArea,2)} m²; opaque ${rounded(g.netWallArea,2)} m².\nRoom ${rounded(a.inside)}°C / outside ${rounded(a.outside)}°C; air changes ${rounded(a.ach,2)}/h.\n${result.fabric.map(e=>`${e.label}: ${rounded(e.watts,0)} W (U ${rounded(e.u,2)} W/m²K; ${rounded(e.area,2)} m²; adjacent ${rounded(e.adjacent)}°C)`).join('\n')}\nVentilation: ${rounded(result.ventilationWatts,0)} W. Simplified room estimate; check actual fabric and site conditions.`;
}

const clone = x => structuredClone(x);
function createRoomStore() {
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
function scheduleTotals(state) {
  const valid=state.rooms.filter(r=>!r.stale),watts=valid.reduce((sum,r)=>sum+r.result.watts,0);
  return {watts,kilowatts:watts/1000,btuPerHour:watts*BTU_PER_WATT_HOUR,count:valid.length,stale:state.rooms.length-valid.length};
}
const fmt=(n,d=0)=>n.toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
function summaryText(state) {
  const totals=scheduleTotals(state),parts=['Gas Tools — simplified room heat-loss estimates'];
  for(const room of state.rooms)parts.push(room.stale?`${room.name}: EDIT IN PROGRESS — excluded from subtotal until recalculated and saved.`:roomSummary(room.result,room.name));
  if(totals.count)parts.push(`Subtotal of ${totals.count} saved room estimate${totals.count===1?'':'s'}: ${fmt(totals.watts)} W | ${fmt(totals.kilowatts,2)} kW | ${fmt(totals.btuPerHour)} BTU/h. This is not final boiler sizing.`);
  if(totals.stale)parts.push(`${totals.stale} room edit${totals.stale===1?' is':'s are'} excluded from the subtotal.`);
  if(state.calculated&&(!state.editingId||state.dirty))parts.push('Current draft estimate — NOT included in the saved-room subtotal:\n'+roomSummary(state.calculated.result));
  if(!state.rooms.length&&!state.calculated)parts.push('No calculated rooms.');
  parts.push('Method: Σ(U × area × positive room/boundary temperature difference) + 0.33 × air changes/h × room volume × positive room/outside difference. Construction and adjacent temperatures must be checked. Thermal bridges, detailed ground effects and internal-wall exchange are not fully modelled. No radiator water-temperature correction or product selection.\nSources: https://www.stelradprofessional.com/basic-heat-loss-calculator/ ; https://www.cibsejournal.com/cpd/modules/2013-02/');
  return parts.join('\n\n');
}
async function copyWithFallback(text,clipboard) {
  try{if(!clipboard||typeof clipboard.writeText!=='function')throw new Error('Unavailable');await clipboard.writeText(text);return{copied:true,text,message:'Summary copied.'};}
  catch{return{copied:false,text,message:'Automatic copy is unavailable here. Select and copy the text below.'};}
}
const mountedPanels=new WeakMap();
const namespaceClasses=cls=>cls.split(/\s+/).filter(Boolean).map(c=>'btu-'+c).join(' ');
function mount(root,doc=root?.ownerDocument??globalThis.document) {
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

// The verified loader alone receives readiness, after the actual root mount completed.
const readyScript=document.currentScript,readyRoot=document.getElementById('btu');
if(!readyRoot||!mountedPanels.has(readyRoot)||readyRoot.querySelector('#btu-controls')?.disabled!==false)throw Error('Radiator BTU calculator did not mount');
if(typeof readyScript?.__stagBTUMounted!=='function')throw Error('Radiator BTU calculator requires its verified loader');
readyScript.__stagBTUMounted();
})();
