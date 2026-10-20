// Simplified room estimate. No network, storage, catalogue or appliance settings.
export const VERSION = 'private-btu-2026-10-20';
export const METRES_PER_FOOT = 0.3048;
export const SQUARE_METRES_PER_SQUARE_FOOT = 0.09290304;
export const BTU_PER_WATT_HOUR = 3.412141633;
export const VENTILATION_COEFFICIENT = 0.33;
export const PRESET_SOURCE = 'https://www.stelradprofessional.com/basic-heat-loss-calculator/';
export const METHOD_SOURCES = Object.freeze([
  'https://www.stelrad.com/news-events/blog/how-to-calculate-the-heating-requirements-of-your-house/',
  'https://www.cibsejournal.com/cpd/modules/2013-02/'
]);
const freezeGroup = x => Object.freeze(Object.fromEntries(Object.entries(x).map(([k,v]) => [k,Object.freeze(v)])));
export const PRESETS = Object.freeze({
  wall: freezeGroup({solidBrick:{label:'220 mm solid brick',u:2.10},cavityBare:{label:'Uninsulated brick cavity',u:1.47},cavityInsulated:{label:'Insulated brick cavity',u:0.50},timberFrame:{label:'Timber frame',u:0.29}}),
  glazing: freezeGroup({single:{label:'Single glazing — wood / PVC',u:5.0},double:{label:'Double glazing',u:2.9},lowE:{label:'Low-E double glazing',u:1.7}}),
  floor: freezeGroup({timberVoid:{label:'Timber over ventilated void',u:0.82},solidGround:{label:'Solid uninsulated earth — simplified',u:0.82,ground:true},concrete:{label:'Concrete floor',u:1.6},heatedSpace:{label:'Heated room below',u:1.36}}),
  ceiling: freezeGroup({heatedSpace:{label:'Heated room above',u:1.62},roofInsulated:{label:'Insulated roof space',u:0.71},roofBare:{label:'Uninsulated roof space',u:2.30},flatInsulated:{label:'Insulated flat roof',u:0.70},flatBare:{label:'Uninsulated flat roof',u:2.19}})
});
export const LIMITATIONS = Object.freeze([
  'Simplified room estimate, not a full BS EN 12831 or MCS design or an installed-appliance assessment.',
  'Construction presets are published examples. Check the actual fabric and use a known U-value when needed; “not sure” cannot supply a heat-loss result.',
  'Thermal bridges, detailed ground effects, doors as separate elements, solar/internal gains and exchange through unselected internal walls are not fully modelled. Doors are included in the selected wall area at that wall U-value.',
  'Floor and ceiling use the entered adjacent temperature. The solid-earth preset is a simplified U × area × temperature-difference boundary, not an ISO ground-floor calculation.',
  'Warmer adjacent spaces contribute zero loss here; heat gains are not credited. Ventilation uses the entered air changes, without heat-recovery/wind/site corrections.',
  'Room heat loss is independent of radiator flow/return water temperature. Emitter output correction needs its own manufacturer data; it is not included.',
  'A sum of these room estimates is not a final boiler design output or an automatic radiator/product recommendation.'
]);
export function emptyDraft() {
  return {name:'',roomType:'other',unit:'m',length:'',width:'',height:'',exposed:[],exposureConfirmed:false,windowMode:'',windowArea:'',wallPreset:'',wallCustomU:'',glazingPreset:'',glazingCustomU:'',floorPreset:'',floorCustomU:'',floorAdjacent:'',ceilingPreset:'',ceilingCustomU:'',ceilingAdjacent:'',inside:21,outside:-3,ach:0.5};
}
export class InputError extends Error {
  constructor(messages){super(messages.join(' '));this.name='InputError';this.messages=messages;}
}
export function finiteNumber(value) {
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!value.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim()))return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}
export function changeUnits(draft,unit) {
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
export function calculateRoom(raw) {
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
export function roomSummary(result,label=result.name||'Room') {
  const g=result.geometry,a=result.assumptions;
  return `${label}: ${rounded(result.watts,0)} W | ${rounded(result.kilowatts,2)} kW | ${rounded(result.btuPerHour,0)} BTU/h\nDimensions: ${rounded(g.length,3)} × ${rounded(g.width,3)} × ${rounded(g.height,3)} m; volume ${rounded(g.volume,2)} m³.\nExposed walls: ${g.exposed.join(', ')||'none'}; gross ${rounded(g.grossWallArea,2)} m²; windows ${rounded(g.windowArea,2)} m²; opaque ${rounded(g.netWallArea,2)} m².\nRoom ${rounded(a.inside)}°C / outside ${rounded(a.outside)}°C; air changes ${rounded(a.ach,2)}/h.\n${result.fabric.map(e=>`${e.label}: ${rounded(e.watts,0)} W (U ${rounded(e.u,2)} W/m²K; ${rounded(e.area,2)} m²; adjacent ${rounded(e.adjacent)}°C)`).join('\n')}\nVentilation: ${rounded(result.ventilationWatts,0)} W. Simplified room estimate; check actual fabric and site conditions.`;
}
