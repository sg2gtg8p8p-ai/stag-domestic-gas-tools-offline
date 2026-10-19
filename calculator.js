// Standalone calculator: no ServiceM8 connection or identifiers.
const BORE={"15":13,"22":19,"28":25,"35":32},FIT={"15":{"b45":0.15,"b90":0.2,"elbow":0.4,"teeIn":0.75,"teeOut":1.2},"22":{"b45":0.2,"b90":0.3,"elbow":0.6,"teeIn":1.2,"teeOut":1.8},"28":{"b45":0.25,"b90":0.4,"elbow":0.8,"teeIn":1.5,"teeOut":2.3},"35":{"b45":0.3,"b90":0.5,"elbow":1,"teeIn":2,"teeOut":3}},IV={"15":0.154,"22":0.352,"28":0.594,"35":0.924},MET={"E6":2.4,"U6":8,"G4":8,"U16":25,"G10":25};let n=0,lastPipe='',lastTight='';
function show(x){document.querySelectorAll('.panel').forEach(e=>e.classList.remove('on'));document.getElementById(x).classList.add('on')}
function num(id){return Math.max(0,Number(document.getElementById(id).value)||0)}
function addSection(){n++;let d=document.createElement('div');d.className='card';d.id='sec'+n;d.innerHTML='<h3>Section '+String.fromCharCode(64+n)+'</h3><div class="grid"><div><label>Actual pipe length (m)</label><input class="len" type="number" step="0.1" value="5"></div><div><label>Gas load carried (kW, blank = appliance load)</label><input class="load" type="number" step="0.1"></div></div><div class="grid4 section"><div><label>45° bends</label><input class="b45" type="number" value="0"></div><div><label>90° bends</label><input class="b90" type="number" value="0"></div><div><label>90° elbows</label><input class="elbow" type="number" value="0"></div><div><label>Tee entering branch</label><input class="teeIn" type="number" value="0"></div><div><label>Tee exiting branch</label><input class="teeOut" type="number" value="0"></div></div><button onclick="this.parentNode.remove();calcPipe()">Remove</button>';document.getElementById('sections').appendChild(d);d.querySelectorAll('input').forEach(x=>x.addEventListener('input',calcPipe));calcPipe()}
function lossPerM(q,size){let d=BORE[size],Re=25043*q/d,X=Math.log10(Re)-5,fsp=Math.pow(14.7519+3.5657*X+0.0362*X*X,-2),f=fsp/(.95*.95);return Math.pow(q/(57.1e-5),2)*.6*f/Math.pow(d,5)}
function tableGasRate(q){if(q<=0)return 0;if(q<=8.5)return Math.ceil(q*4-1e-9)/4;if(q<=9.5)return Math.ceil(q*2-1e-9)/2;if(q<=16)return Math.ceil(q-1e-9);return NaN;}function calcPipe(){let kw=num('kw'),gross=document.getElementById('basis').value==='net'?kw*1.1:kw,q=gross/10.80,secs=[...document.querySelectorAll('#sections .card')],cum=0,rows=[],ok=true;for(let s of secs){let skw=Number(s.querySelector('.load').value)||gross,sq=(document.getElementById('basis').value==='net'?skw*1.1:skw)/10.80,chosen=null;for(let size of [15,22,28,35]){let F=FIT[size],eff=Number(s.querySelector('.len').value||0)+Number(s.querySelector('.b45').value||0)*F.b45+Number(s.querySelector('.b90').value||0)*F.b90+Number(s.querySelector('.elbow').value||0)*F.elbow+Number(s.querySelector('.teeIn').value||0)*F.teeIn+Number(s.querySelector('.teeOut').value||0)*F.teeOut,drop=lossPerM(tableGasRate(sq),size)*eff;if(cum+drop<=1){chosen={size,eff,drop,pl:lossPerM(tableGasRate(sq),size),q:sq};break}}if(!chosen){ok=false;rows.push('Section '+(rows.length+1)+': outside 35 mm / 1 mbar scope');continue}cum+=chosen.drop;rows.push('Section '+(rows.length+1)+': '+chosen.size+' mm | '+chosen.q.toFixed(3)+' m³/h | effective '+chosen.eff.toFixed(2)+' m | '+chosen.pl.toFixed(4)+' mbar/m | section '+chosen.drop.toFixed(3)+' mbar | cumulative '+cum.toFixed(3)+' mbar')}
let cls=ok?'ok':'bad';lastPipe='STAG GAS PIPE SIZING | Natural gas / copper | Gross load '+gross.toFixed(1)+' kW | Gas rate '+q.toFixed(3)+' m³/h | '+rows.join(' ; ')+' | Route drop '+cum.toFixed(3)+' mbar. Calculation aid; verify against current BS 6891 and appliance requirements.';document.getElementById('pipeResult').className='card '+cls;document.getElementById('pipeResult').innerHTML='<div class="result">'+(ok?'Calculated route: '+cum.toFixed(3)+' mbar':'Outside calculator scope')+'</div>'+rows.map(x=>'<div>'+x+'</div>').join('')+'<p class="small">Sizing is evaluated section-by-section against the remaining 1.00 mbar route allowance. Upstream sections should be entered with their combined downstream load.</p>'}
async function save(content){if(!content){alert('Calculate a result first.');return}try{await navigator.clipboard.writeText(content);alert('Result copied. This offline app does not save to ServiceM8.')}catch{document.getElementById('copyResult').value=content;document.getElementById('copyDialog').showModal()}}
function savePipe(){save(lastPipe)}
function calcIV(){let m=document.getElementById('meter').value,ml=m==='custom'?num('meterCustom'):(MET[m]||0),pipe=num('iv15')*IV[15]+num('iv22')*IV[22]+num('iv28')*IV[28]+num('iv35')*IV[35],litres=ml+pipe;return{ml,pipe,litres,m3:litres/1000,pv:litres*1.5/1000}}
function ngLimit(iv){if(iv<=.005)return 8;if(iv<=.010)return 4;if(iv<=.015)return 2.5;if(iv<=.035)return 1;return null}
function calcTight(){let v=calcIV(),drop=Math.max(0,num('startP')-num('endP')),np=document.getElementById('gauge').value==='1dp'?.2:.25,type=document.getElementById('installType').value,smell=document.getElementById('smell').value==='yes',lim=ngLimit(v.m3),status='',cls='warn';if(v.m3<=0||!lim){status='Outside IV scope / check inputs';cls='bad'}else if(smell){status='Do not apply permissible-drop route: reported smell of gas — investigate/make safe in accordance with applicable procedure.';cls='bad'}else if(type==='pipe'){if(drop<=np){status='No perceptible movement criterion met.';cls='ok'}else{status='FAIL — perceptible movement on pipework-only/new-appliance test. Trace/repair or make safe.';cls='bad'}}else{if(drop<=np){status='No perceptible movement criterion met.';cls='ok'}else if(drop<=lim){status='WITHIN IV PERMISSIBLE LIMIT — PIPEWORK RETEST REQUIRED. Isolate all appliances and complete a pipework-only retest. The pipework-only retest must show no perceptible movement.';cls='warn'}else{status='FAIL — pressure drop exceeds IV permissible limit. Trace/repair or make safe.';cls='bad'}}let purge=v.pv<=.02?'NG purge volume ≤0.020 m³: purge-to-air route within the supplied Edition 4 guidance.':'NG purge volume >0.020 m³: purge to ignition.';lastTight='STAG TIGHTNESS TEST / PURGE | IGEM/UP/1B Ed 4 | IV '+v.m3.toFixed(5)+' m³ ('+v.litres.toFixed(2)+' L), meter '+v.ml.toFixed(2)+' L, pipe+fittings '+v.pipe.toFixed(2)+' L | Test '+num('startP').toFixed(1)+' to '+num('endP').toFixed(1)+' mbar, drop '+drop.toFixed(2)+' mbar | NG IV limit '+lim+' mbar | '+status+' | PV '+v.pv.toFixed(5)+' m³. Verify current controlled procedure.';document.getElementById('tightResult').className='card '+cls;document.getElementById('tightResult').innerHTML='<div class="result">IV '+v.m3.toFixed(5)+' m³ ('+v.litres.toFixed(2)+' L)</div><div>Meter: '+v.ml.toFixed(2)+' L • Pipe + fittings: '+v.pipe.toFixed(2)+' L</div><div>Observed drop: '+drop.toFixed(2)+' mbar • IV permissible limit: '+(lim??'—')+' mbar</div><p class="danger">'+status+'</p><div>Purge volume: '+v.pv.toFixed(5)+' m³ ('+(v.pv*1000).toFixed(2)+' L)</div><div>'+purge+'</div>'}
function saveTight(){save(lastTight)}
document.querySelectorAll('#tight input,#tight select').forEach(x=>x.addEventListener('input',calcTight));document.getElementById('kw').addEventListener('input',calcPipe);document.getElementById('basis').addEventListener('change',calcPipe);addSection();calcTight();
// Gas rate only. Pipe sizing and tightness/purge prefix remains byte-identical.
let grTimerId=null,grStartedAt=0,grElapsed=0,lastGasRate='';
let grMode='metric',grDurationValue=document.getElementById('grDuration').value,grImperialStartedAt=0;

function grClock(s){
s=Math.max(0,Math.ceil(s));
return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function grCountUp(s){
const tenths=Math.floor(Math.max(0,s)*10);
return String(Math.floor(tenths/600)).padStart(2,'0')+':'+((tenths%600)/10).toFixed(1).padStart(4,'0');
}
function isGasRateTiming(){return grTimerId!==null;}
function grClearResult(){document.getElementById('grResult').innerHTML='';lastGasRate='';}
function grResetState(clearInputs){
if(grTimerId!==null){clearInterval(grTimerId);grTimerId=null;}
grStartedAt=0;grElapsed=0;grImperialStartedAt=0;
document.getElementById('grTimer').textContent=grMode==='imperial'?grCountUp(0):grClock(Number(document.getElementById('grDuration').value));
document.getElementById('grTimer').setAttribute('aria-label',grMode==='imperial'?'Elapsed time':'Time remaining');
document.getElementById('grStart').textContent='Start';
if(clearInputs){document.getElementById('grInitial').value='';document.getElementById('grFinal').value='';document.getElementById('grDialVolume').value='';}
grClearResult();
}
function grShowMode(){
const imperial=grMode==='imperial';
document.getElementById('grMetricDuration').hidden=imperial;
document.getElementById('grMetricReadings').hidden=imperial;
document.getElementById('grImperialFields').hidden=!imperial;
document.getElementById('grMethod').textContent=imperial?'Imperial: confirm the test-dial volume, then use Start / Stop for one full turn.':'Metric: run the countdown, then enter initial and final meter readings.';
document.getElementById('grBasis').textContent=imperial?'Imperial basis: Worcester TB 0105 b average CV 1040 Btu/ft³; gross kW = Btu/h ÷ 3412, net = gross ÷ 1.11. Calculation aid; compare with the appliance instructions.':'Metric basis: CV 38.9 MJ/m³; net kW = gross kW ÷ 1.11. Calculation aid; compare with the appliance instructions.';
}
function changeGasRateMode(){
const select=document.getElementById('grMode'),next=select.value;
if(next!== 'metric'&&next!=='imperial'){select.value=grMode;return;}
if(next===grMode)return;
if(isGasRateTiming()&&!confirm('Changing meter type will stop and reset this timed test. Meter entries will be kept. Continue?')){select.value=grMode;return;}
grMode=next;grShowMode();grResetState(false);
}
function changeGasRateDuration(){
const select=document.getElementById('grDuration'),next=select.value;
if(next!=='60'&&next!=='120'){select.value=grDurationValue;return;}
if(next===grDurationValue)return;
if(isGasRateTiming()&&!confirm('Changing the duration will stop and reset this timed test and clear its readings. Continue?')){select.value=grDurationValue;return;}
grDurationValue=next;grResetState(true);
}
function resetGasRate(){grResetState(true);}

function imperialGasRate(volume,seconds){
if(!Number.isFinite(volume)||!Number.isFinite(seconds)||volume<=0||seconds<=0)return null;
const rate=volume*3600/seconds,btuh=rate*1040,gross=btuh/3412,net=gross/1.11;
if(![rate,btuh,gross,net].every(x=>Number.isFinite(x)&&x>0))return null;
return {volume,seconds,rate,btuh,gross,net};
}

function startGasRate(){
if(isGasRateTiming()){
grElapsed=grMode==='imperial'?(performance.now()-grImperialStartedAt)/1000:(Date.now()-grStartedAt)/1000;
clearInterval(grTimerId);grTimerId=null;
document.getElementById('grStart').textContent='Start';
document.getElementById('grTimer').textContent=grMode==='imperial'?grCountUp(grElapsed):grClock(Number(document.getElementById('grDuration').value)-grElapsed);
return;
}
const target=Number(document.getElementById('grDuration').value);
if(grMode==='imperial'){
const raw=document.getElementById('grDialVolume').value.trim(),volume=Number(raw);
if(raw===''||!Number.isFinite(volume)||volume<=0){alert('Enter the positive volume marked for one full turn of the test dial, in ft³.');return;}
}else if(target!==60&&target!==120){alert('Choose a valid metric test duration.');return;}
grClearResult();grElapsed=0;grStartedAt=Date.now();grImperialStartedAt=performance.now();
document.getElementById('grStart').textContent='Stop';
document.getElementById('grTimer').textContent=grMode==='imperial'?grCountUp(0):grClock(target);
grTimerId=setInterval(function(){
grElapsed=grMode==='imperial'?(performance.now()-grImperialStartedAt)/1000:(Date.now()-grStartedAt)/1000;
if(grMode==='imperial'){document.getElementById('grTimer').textContent=grCountUp(grElapsed);return;}
const left=target-grElapsed;
if(left<=0){grElapsed=target;clearInterval(grTimerId);grTimerId=null;document.getElementById('grTimer').textContent='00:00';document.getElementById('grStart').textContent='Start';return;}
document.getElementById('grTimer').textContent=grClock(left);
},grMode==='imperial'?100:250);
}

function calcGasRate(){
grClearResult();
if(grMode==='imperial'){
if(isGasRateTiming()){alert('Stop the timer after one full turn of the test dial before calculating.');return;}
if(!grStartedAt||!Number.isFinite(grElapsed)||grElapsed<=0){alert('Use Start and Stop to time one full turn of the test dial first.');return;}
const raw=document.getElementById('grDialVolume').value.trim(),volume=Number(raw);
const result=raw===''?null:imperialGasRate(volume,grElapsed);
if(!result){alert('Enter a positive test-dial volume and a valid elapsed time.');return;}
document.getElementById('grResult').innerHTML='<div class="grid4">'+
'<div><b>'+result.rate.toFixed(2)+'</b><br>ft³/hr</div>'+
'<div><b>'+result.gross.toFixed(2)+'</b><br>Gross kW</div>'+
'<div><b>'+result.net.toFixed(2)+'</b><br>Net kW</div>'+
'<div><b>'+result.seconds.toFixed(1)+'</b><br>seconds</div></div>';
lastGasRate='STAG GAS RATE | Natural Gas | Imperial test dial | One full turn | '+result.seconds.toFixed(1)+' seconds | Timed volume '+String(volume)+' ft³ | Gas rate '+result.rate.toFixed(2)+' ft³/h | Gross '+result.gross.toFixed(2)+' kW | Net '+result.net.toFixed(2)+' kW | CV 1040 Btu/ft³ | 3412 Btu/h per kW | Gross/net ratio 1.11 | Worcester TB 0105 b (2016/03)';
return;
}
const initialRaw=document.getElementById('grInitial').value.trim(),finalRaw=document.getElementById('grFinal').value.trim();
let initial=Number(initialRaw),final=Number(finalRaw),target=Number(document.getElementById('grDuration').value);
if(!grStartedAt||isGasRateTiming()||grElapsed<target){alert('Run the selected timed test to completion before calculating the gas rate.');return;}
let seconds=grElapsed;
if(initialRaw===''||finalRaw===''||!Number.isFinite(initial)||!Number.isFinite(final)||initial<0||final<=initial){alert('Enter valid initial and final meter readings.');return;}
if(!Number.isFinite(seconds)||seconds<=0||seconds<target){alert('Timed test is shorter than the selected test duration.');return;}

let volume=final-initial;
let rate=volume*3600/seconds;
let cv=38.9;
let gross=rate*cv/3.6;
let net=gross/1.11;

if(![volume,rate,gross,net].every(x=>Number.isFinite(x)&&x>0)){alert('Enter meter readings that give a valid finite gas rate.');return;}
document.getElementById('grResult').innerHTML=
'<div class="grid4">'+
'<div><b>'+rate.toFixed(2)+'</b><br>m³/hr</div>'+
'<div><b>'+gross.toFixed(2)+'</b><br>Gross kW</div>'+
'<div><b>'+net.toFixed(2)+'</b><br>Net kW</div>'+
'<div><b>'+seconds.toFixed(1)+'</b><br>seconds</div>'+
'</div>';
lastGasRate='STAG GAS RATE | Natural Gas | Metric meter | '+seconds.toFixed(1)+' seconds | Initial '+initial.toFixed(3)+' m³ | Final '+final.toFixed(3)+' m³ | Volume '+volume.toFixed(3)+' m³ | Gas rate '+rate.toFixed(2)+' m³/h | Gross '+gross.toFixed(2)+' kW | Net '+net.toFixed(2)+' kW | CV '+cv.toFixed(1)+' MJ/m³';
}
function saveGasRate(){save(lastGasRate);}
document.getElementById('grMode').addEventListener('change',changeGasRateMode);
document.getElementById('grDuration').addEventListener('change',changeGasRateDuration);
for(const id of ['grInitial','grFinal','grDialVolume'])document.getElementById(id).addEventListener('input',grClearResult);
grShowMode();resetGasRate();
