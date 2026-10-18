const icons = {
  weave:'<path d="M3 5h5l6 14h5M3 12h5l6-7h5M3 19h5l6-7h5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  activity:'<path d="M2 12h4l3-7 5 14 3-7h5"/>',
  building:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1m-4 6v-3h2v3"/>',
  layers:'<path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',
  previous:'<path d="M5 5v14m14-14-9 7 9 7V5Z"/>',
  next:'<path d="M19 5v14M5 5l9 7-9 7V5Z"/>',
  play:'<path d="m8 4 12 8-12 8V4Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  loop:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
  plus:'<path d="M5 12h14M12 5v14"/>', minus:'<path d="M5 12h14"/>',
  fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M7 12h10m-8-2-2 2 2 2m6-4 2 2-2 2"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m5 9 7 7 7-7"/>',
  fold:'<path d="M4 4h16M4 20h16m-8-3V7m-3 3 3-3 3 3m-6 4 3 3 3-3"/>',
  tree:'<path d="M5 3v12a3 3 0 0 0 3 3h4M5 8h7"/><rect x="13" y="5" width="7" height="6" rx="1"/><rect x="13" y="15" width="7" height="6" rx="1"/>',
  density:'<path d="M4 5h16M4 12h16M4 19h16M7 3v4m10 3v4M9 17v4"/>',
  compact:'<path d="M4 5h16M4 9h16M4 13h16M4 17h16M4 21h16"/>',
  standard:'<path d="M4 5h16M4 12h16M4 19h16"/>',
  comfortable:'<rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="15" width="16" height="5" rx="1"/>',
  crosshair:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  radio:'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
  sensor:'<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0V4Z"/><path d="M12 10v8m5-11h3m-3 4h3"/>',
  plug:'<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v5"/>',
  code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  alert:'<path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2 2 0 0 0-4 0Z"/><path d="M12 9v5m0 3h.01"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  folder:'<path d="M3 5h6l2 3h10v12H3V5Z"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.activity}</svg>`;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function hydrate(scope=document){ scope.querySelectorAll('[data-icon]').forEach(el => el.innerHTML=svg(el.dataset.icon)); }
hydrate();

const opRows = [
  {id:'connectors',label:'Connecteurs',icon:'plug',level:0,count:'07'},
  {id:'mqtt',label:'Réseau MQTT',icon:'radio',level:1,parent:'connectors',count:'03'},
  {id:'temp',label:'TMP-001 · Température',icon:'sensor',level:2,parent:'mqtt',count:'08'},
  {id:'pressure',label:'PRS-002 · Pression',icon:'sensor',level:2,parent:'mqtt',count:'06'},
  {id:'gateway',label:'GTW-001 · Passerelle',icon:'plug',level:2,parent:'mqtt',count:'05'},
  {id:'radio',label:'Réseau LoRa',icon:'radio',level:1,parent:'connectors',count:'02'},
  {id:'lora',label:'LRA-004 · Télémétrie',icon:'activity',level:2,parent:'radio',count:'04'},
  {id:'processing',label:'Traitements',icon:'layers',level:0,count:'03'},
  {id:'alerts',label:'Incidents & alertes',icon:'alert',level:0,count:'02'}
];
const historyRows = [
  {id:'companies',label:'Entreprises',icon:'building',level:0,count:'03'},
  {id:'oreka',label:'Oreka Ingénierie',icon:'briefcase',level:1,parent:'companies',count:'01'},
  {id:'schneider',label:'Schneider Electric',icon:'briefcase',level:1,parent:'companies',count:'01'},
  {id:'projects',label:'Projets',icon:'folder',level:0,count:'05'},
  {id:'industry',label:'Industrie & simulation',icon:'layers',level:1,parent:'projects',count:'03'},
  {id:'personal',label:'Projets indépendants',icon:'code',level:1,parent:'projects',count:'02'},
  {id:'skills',label:'Compétences',icon:'code',level:0,count:'07'},
  {id:'explorations',label:'Explorations',icon:'compass',level:0,count:'04'}
];
let serial=0;
function ev(row,start,end,label,color,extra={}){return {id:`event-${++serial}`,row,start,end,label,color,...extra};}
const opEvents = [
  ev('connectors',1,18,'Acquisition continue','teal',{group:128}),ev('connectors',20,39,'Acquisition continue','teal',{group:256}),ev('connectors',42,59,'Acquisition continue','teal',{group:192}),
  ev('mqtt',2,14,'Cycle 01','teal',{group:48}),ev('mqtt',18,35,'Cycle 02','teal',{group:64}),ev('mqtt',39,58,'Cycle 03','teal',{group:72}),
  ev('temp',3,7,'Mesure','blue'),ev('temp',11,16,'Mesure','blue'),ev('temp',23.5,32,'Transmission de télémétrie','teal',{description:'Transmission du lot de mesures de température vers la passerelle de la station Nord.',source:'TMP-001',topic:'sensors/temperature',packets:24}),ev('temp',38,43,'Mesure','blue'),ev('temp',49,55,'Mesure','blue'),
  ev('pressure',5,10,'Mesure','blue'),ev('pressure',16,21,'Mesure','blue'),ev('pressure',28,34,'Mesure','blue'),ev('pressure',41,46,'Mesure','blue'),ev('pressure',53,58,'Mesure','blue'),
  ev('gateway',1,9,'Connexion','teal'),ev('gateway',14,23,'Synchronisation','teal'),ev('gateway',27,39,'Synchronisation','teal'),ev('gateway',44,58,'Connexion','teal'),
  ev('radio',4,21,'Fenêtre radio','purple',{group:36}),ev('radio',29,49,'Fenêtre radio','purple',{group:42}),
  ev('lora',6,10,'Trame','purple'),ev('lora',16,20,'Trame','purple'),ev('lora',32,37,'Trame','purple'),ev('lora',43,48,'Trame','purple'),
  ev('processing',8,17,'Agrégation','purple'),ev('processing',26,38,'Normalisation','purple'),ev('processing',45,55,'Export des mesures','purple'),
  ev('alerts',17.5,17.5,'Latence élevée','amber',{description:'Le délai de transmission dépasse le seuil de référence. La communication reprend après cette alerte.',source:'GTW-001'}),ev('alerts',40,40,'Reconnexion','amber',{description:'La passerelle a rétabli sa connexion au réseau MQTT.',source:'GTW-001'})
];
const year = value => (value-2013)/14*60;
const he = (r,a,b,l,c,x) => ev(r,year(a),year(b),l,c,x);
const historyEvents = [
  he('companies',2013,2017,'Oreka Ingénierie','blue'),he('companies',2017,2026,'Schneider Electric','teal'),he('companies',2026,2027,'X-PERT','purple'),
  he('oreka',2013,2017,'Ingénierie & simulation','blue'),he('schneider',2017,2026,'Industrie numérique','teal'),
  he('projects',2013.4,2015,'Simulateur de lignes','blue'),he('projects',2017.5,2019.5,'Plateforme e-learning 3D','purple'),he('projects',2020,2022,'Jumeau numérique','teal'),he('projects',2023,2024.5,'Application terrain','purple'),
  he('industry',2015,2016.5,'Formation sécurité VR','blue'),he('industry',2020.4,2022.5,'Simulation industrielle','teal'),
  he('personal',2025.6,2026.3,'Iasit','purple'),he('personal',2026.4,2027,'Time Weave','teal'),
  he('skills',2013,2014.5,'C#','blue'),he('skills',2014.7,2016,'Unity','teal'),he('skills',2016.2,2017.5,'3D','purple'),he('skills',2018,2019.6,'TypeScript','blue'),he('skills',2019.8,2021.3,'React','blue'),he('skills',2021.5,2022.8,'Python','teal'),he('skills',2023,2024.5,'Docker','blue'),
  he('explorations',2013.3,2013.3,'3D temps réel','neutral'),he('explorations',2017.6,2017.6,'IoT industriel','neutral'),he('explorations',2020.3,2020.3,'Cartographie','neutral'),he('explorations',2024,2024,'IA & agents','neutral')
];
const scenarios = {
  operations:{rows:opRows,events:opEvents,keys:[8,24,40,53],title:'Station Nord · Rejeu opérationnel',subtitle:'18 octobre 2026 <b>·</b> Temps calendrier <b>·</b> UTC',initial:24},
  history:{rows:historyRows,events:historyEvents,keys:[year(2013),year(2015),year(2020),year(2026)],title:'Parcours · Ingénierie & explorations',subtitle:'2013 — 2027 <b>·</b> Temps calendrier <b>·</b> Échelle annuelle',initial:year(2020)}
};
let scenario='operations',position=24,viewStart=0,viewEnd=60,selected=opEvents.find(e=>e.topic),collapsed=new Set(),hiddenColors=new Set(),playing=false,loop=false,lastFrame=0,speed=1;
const data=()=>scenarios[scenario];
function format(t,seconds=false){
  if(scenario==='history'){const y=2013+t/60*14;return seconds ? `${Math.floor(y)} · ${String(Math.floor((y%1)*12)+1).padStart(2,'0')}` : String(Math.floor(y));}
  const total=Math.round(t*60),h=13+Math.floor(total/3600),m=Math.floor(total/60)%60,s=total%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}${seconds?':'+String(s).padStart(2,'0'):''}`;
}
const percent=t=>(t-viewStart)/(viewEnd-viewStart)*100;
function visibleRows(){return data().rows.filter(row=>{let p=row.parent;while(p){if(collapsed.has(p))return false;p=data().rows.find(r=>r.id===p)?.parent;}return true;});}
function isParent(row){return data().rows.some(r=>r.parent===row.id);}
function render(){
  $('scenario-title').textContent=data().title;$('scenario-subtitle').innerHTML=data().subtitle;
  $('row-count').textContent=`${data().rows.length} lignes`;$('event-count').textContent=`${data().events.length} éléments`;
  const legendNames=scenario==='operations'?{teal:'Communication',blue:'Acquisition',amber:'Alerte',purple:'Séquence'}:{teal:'Industrie',blue:'Ingénierie',amber:'Jalon',purple:'Création'};
  document.querySelectorAll('[data-color]').forEach(button=>{button.innerHTML=`<i class="dot ${button.dataset.color}"></i> ${legendNames[button.dataset.color]}`;});
  const rows=visibleRows();
  $('rows').innerHTML=rows.map(row=>{
    const parent=isParent(row),expanded=!collapsed.has(row.id);
    const events=data().events.filter(e=>e.row===row.id&&!hiddenColors.has(e.color)&&e.start<=viewEnd&&e.end>=viewStart);
    return `<div class="row-label level-${row.level} ${parent?'parent':''}">${parent?`<button class="chevron" data-toggle="${row.id}" aria-expanded="${expanded}" aria-label="${expanded?'Replier':'Déplier'} ${escapeHTML(row.label)}">${svg(expanded?'down':'chevron')}</button>`:'<span style="width:12px;flex-shrink:0"></span>'}<span class="row-icon">${svg(row.icon)}</span><span class="row-name">${escapeHTML(row.label)}</span><span class="row-number">${row.count}</span></div><div class="track ${parent?'parent':''}" data-track="${row.id}" aria-label="${escapeHTML(row.label)}">${events.map(e=>{
      const point=e.start===e.end,left=Math.max(0,percent(e.start)),right=Math.min(100,percent(e.end));
      return `<button class="event ${e.color} ${point?'point':''} ${e.group?'group':''} ${selected?.id===e.id?'is-selected':''}" data-event="${e.id}" style="left:${left}%;${point?'':`width:${Math.max(.3,right-left)}%`}" title="${escapeHTML(e.label)} · ${format(e.start,true)}" aria-label="${escapeHTML(e.label)}, ${format(e.start,true)}" aria-pressed="${selected?.id===e.id}">${point?`<span>${escapeHTML(e.label)}</span>`:`${e.group?svg('layers'):e.topic?svg('radio'):''}<span>${escapeHTML(e.label)}</span>${e.group?`<strong>${e.group}</strong>`:''}`}</button>`;
    }).join('')}</div>`;
  }).join('');
  $('ruler').innerHTML=Array.from({length:7},(_,i)=>{let t=viewStart+(viewEnd-viewStart)*i/6;return `<div class="tick" style="left:${i/6*100}%"><span>${format(t)}</span></div>`;}).join('')+data().keys.filter(k=>k>=viewStart&&k<=viewEnd).map((k,i)=>`<button class="key-marker" style="left:${Math.min(99,Math.max(1,percent(k)))}%" data-key="${k}" aria-label="Aller au repère ${format(k)}" title="Repère ${format(k)}">◇</button>`).join('');
  $('domain-start').textContent=format(0);$('domain-end').textContent=format(60);
  $('visible-count').textContent=`${rows.length} lignes visibles`;$('key-count').textContent=`${data().keys.length} clés`;
  $('zoom-label').textContent=scenario==='operations'?`${Math.round(viewEnd-viewStart)} min`:`${((viewEnd-viewStart)/60*14).toFixed(1).replace('.',',')} ans`;
  $('zoom-in').disabled=viewEnd-viewStart<=5;$('zoom-out').disabled=viewEnd-viewStart>=60;
  $('overview-window').style.left=`${viewStart/60*100}%`;$('overview-window').style.width=`${(viewEnd-viewStart)/60*100}%`;
  $('overview-bars').innerHTML=Array.from({length:90},(_,i)=>`<i style="height:${20+((i*17+i*i*3)%80)}%"></i>`).join('');
  $('collapse-all').setAttribute('aria-label',collapsed.size?'Déplier toutes les lignes':'Replier toutes les lignes');
  updatePosition();renderInspector();
}
function updatePosition(){
  const timeline=$('timeline'),labelWidth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--label-width'));
  const p=percent(position);$('playhead').style.left=`${labelWidth+(timeline.clientWidth-labelWidth)*p/100}px`;
  $('playhead').style.visibility=p>=0&&p<=100?'visible':'hidden';$('playhead-label').textContent=format(position);
  $('playhead').setAttribute('aria-valuenow',(position/60*100).toFixed(1));$('playhead').setAttribute('aria-valuetext',format(position,true));
  $('time-readout').innerHTML=`${format(position,true)}${scenario==='operations'?'<span>.000</span>':''}`;
  $('overview-cursor').style.left=`${position/60*100}%`;
  $('previous').disabled=!data().keys.some(k=>k<position-.001);$('next').disabled=!data().keys.some(k=>k>position+.001);
}
function renderInspector(){
  if(!selected)return;
  const e=selected,row=data().rows.find(r=>r.id===e.row),colors=scenario==='operations'?{teal:'Communication',blue:'Acquisition',amber:'Alerte',purple:'Séquence',neutral:'Exploration'}:{teal:'Industrie',blue:'Ingénierie',amber:'Jalon',purple:'Création',neutral:'Exploration'},icon={teal:'radio',blue:'sensor',amber:'alert',purple:'layers',neutral:'compass'};
  const duration=scenario==='operations'?`${Math.round((e.end-e.start)*60)} s`:`${((e.end-e.start)/60*14).toFixed(1).replace('.',',')} ans`;
  $('inspector-content').innerHTML=`<div class="detail-icon ${e.color}">${svg(icon[e.color])}</div><div class="detail-code">${scenario==='operations'?'EVT':'HST'}-${e.id.split('-')[1].padStart(4,'0')}</div><h2>${escapeHTML(e.label)}</h2><div class="detail-chips"><span class="chip ${e.color}"><i class="dot ${e.color}"></i>${colors[e.color]}</span><span class="chip neutral">${e.start===e.end?'Ponctuel':e.group?'Groupe':'Période'}</span></div><p class="detail-description">${escapeHTML(e.description||(scenario==='operations'?`Séquence de ${row.label.toLowerCase()} enregistrée pendant la fenêtre d’observation.`:`Une étape du parcours, dans la catégorie ${row.label.toLowerCase()}.`))}</p><dl class="detail-fields"><div><dt>Début</dt><dd>${format(e.start,true)}</dd></div><div><dt>${e.start===e.end?'Type':'Fin'}</dt><dd>${e.start===e.end?'Événement':format(e.end,true)}</dd></div><div><dt>Durée</dt><dd>${e.start===e.end?'—':duration}</dd></div><div><dt>Source</dt><dd>${escapeHTML(e.source||row.label.split(' · ')[0])}</dd></div>${e.group?`<div><dt>Éléments</dt><dd>${e.group}</dd></div>`:''}</dl><div class="payload-heading">${svg('code')} Métadonnées</div><pre class="payload">{
  <span>"${scenario==='operations'?'topic':'category'}"</span>: <em>"${escapeHTML(e.topic||e.row)}"</em>,
  <span>"${e.group?'count':'type'}"</span>: <em>${e.group||`"${e.start===e.end?'event':'period'}"`}</em>${e.packets?`,\n  <span>"packets"</span>: <em>${e.packets}</em>`:''}
}</pre><button class="seek-button" id="seek-selected">${svg('crosshair')} Aller à cet instant ${svg('arrow')}</button>`;
  $('seek-selected').onclick=()=>{seek(e.start);toast(`Curseur positionné sur ${format(e.start,true)}`);};
}
function seek(target){position=Math.max(0,Math.min(60,target));if(position<viewStart||position>viewEnd){const width=viewEnd-viewStart;viewStart=Math.max(0,Math.min(60-width,position-width/2));viewEnd=viewStart+width;render();}else updatePosition();}
function setPlaying(value){playing=value;lastFrame=0;$('play').innerHTML=svg(playing?'pause':'play');$('play').setAttribute('aria-label',playing?'Mettre en pause':'Lire');$('play-status').textContent=playing?'Lecture':'En pause';if(playing){if(position>=60)seek(0);requestAnimationFrame(frame);}}
function frame(timestamp){if(!playing)return;if(lastFrame){const elapsed=Math.min((timestamp-lastFrame)/1000,.2);seek(position+elapsed*speed*.35);if(position>=60){if(loop)seek(0);else{setPlaying(false);return;}}}lastFrame=timestamp;requestAnimationFrame(frame);}
function zoom(factor){const width=Math.min(60,Math.max(5,(viewEnd-viewStart)*factor));viewStart=Math.max(0,Math.min(60-width,position-width/2));viewEnd=viewStart+width;render();}
let toastTimer;function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2200);}
document.querySelectorAll('.segmented button').forEach(button=>button.onclick=()=>{
  document.body.dataset.density=button.dataset.density;
  document.querySelectorAll('.segmented button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('density-label').textContent={compact:'Compacte',standard:'Standard',comfortable:'Confortable'}[button.dataset.density];
  updatePosition();
});
document.querySelectorAll('[data-scenario]').forEach(button=>button.onclick=()=>{
  setPlaying(false);scenario=button.dataset.scenario;position=data().initial;viewStart=0;viewEnd=60;collapsed.clear();hiddenColors.clear();selected=scenario==='operations'?opEvents.find(e=>e.topic):historyEvents[1];
  document.querySelectorAll('[data-scenario]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
  document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed','true'));render();
});
$('play').onclick=()=>setPlaying(!playing);$('stop').onclick=()=>{setPlaying(false);seek(0);};
$('previous').onclick=()=>seek([...data().keys].reverse().find(k=>k<position-.001)??position);
$('next').onclick=()=>seek(data().keys.find(k=>k>position+.001)??position);
$('speed').onchange=e=>speed=Number(e.target.value);
$('loop').onclick=()=>{loop=!loop;$('loop').setAttribute('aria-pressed',String(loop));toast(loop?'Boucle sur la période complète activée':'Lecture en boucle désactivée');};
$('zoom-in').onclick=()=>zoom(.5);$('zoom-out').onclick=()=>zoom(2);$('fit').onclick=()=>{viewStart=0;viewEnd=60;render();};
$('reset').onclick=()=>{setPlaying(false);position=data().initial;viewStart=0;viewEnd=60;collapsed.clear();hiddenColors.clear();document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed','true'));render();toast('Vue réinitialisée');};
$('collapse-all').onclick=()=>{if(collapsed.size)collapsed.clear();else data().rows.filter(isParent).forEach(row=>collapsed.add(row.id));render();};
document.querySelectorAll('[data-color]').forEach(button=>button.onclick=()=>{const color=button.dataset.color;if(hiddenColors.has(color))hiddenColors.delete(color);else hiddenColors.add(color);button.setAttribute('aria-pressed',String(!hiddenColors.has(color)));render();});
$('timeline').addEventListener('click',event=>{
  const toggle=event.target.closest('[data-toggle]');if(toggle){const id=toggle.dataset.toggle;if(collapsed.has(id))collapsed.delete(id);else collapsed.add(id);render();document.querySelector(`[data-toggle="${id}"]`).focus({preventScroll:true});return;}
  const item=event.target.closest('[data-event]');if(item){selected=data().events.find(e=>e.id===item.dataset.event);render();document.querySelector(`[data-event="${selected.id}"]`).focus({preventScroll:true});return;}
  const key=event.target.closest('[data-key]');if(key){seek(Number(key.dataset.key));return;}
  const track=event.target.closest('.track,.ruler');if(track){const rect=track.getBoundingClientRect();seek(viewStart+(event.clientX-rect.left)/rect.width*(viewEnd-viewStart));}
});
let dragging=false;
$('playhead').addEventListener('pointerdown',e=>{dragging=true;e.preventDefault();$('playhead').setPointerCapture(e.pointerId);});
$('playhead').addEventListener('pointermove',e=>{if(!dragging)return;const rect=$('ruler').getBoundingClientRect();seek(viewStart+(e.clientX-rect.left)/rect.width*(viewEnd-viewStart));});
$('playhead').addEventListener('pointerup',()=>dragging=false);
$('playhead').addEventListener('pointercancel',()=>dragging=false);
$('overview').onclick=e=>{const rect=$('overview').getBoundingClientRect();seek((e.clientX-rect.left)/rect.width*60);};
document.querySelector('.workspace').addEventListener('keydown',e=>{
  if(e.target.matches('select,input,textarea,button,a'))return;
  if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}else if(e.code==='ArrowRight'){e.preventDefault();seek(position+.5);}else if(e.code==='ArrowLeft'){e.preventDefault();seek(position-.5);}
});
document.addEventListener('visibilitychange',()=>{lastFrame=0;});
new ResizeObserver(updatePosition).observe($('timeline'));
render();
