/* Recherches 05—07 : couverture, intervalles courbes, focus + contexte. */
const exploration=document.body.dataset.exploration;
const explorations={
  matrix:{number:'05',name:'Matrice',title:'Voir les rythmes.',description:'Lire la couverture temporelle, tranche par tranche.',structure:'CANAUX / COUVERTURE'},
  arcs:{number:'06',name:'Arches',title:'Les périodes prennent de la hauteur.',description:'Un début, une fin. Une courbe pour les relier.',structure:'LIGNES / INTERVALLES'},
  lens:{number:'07',name:'Loupe',title:'Le détail, sans perdre le fil.',description:'Une fenêtre agrandie, son contexte toujours visible.',structure:'CANAUX / FOCUS'}
};
const explorationCopy=explorations[exploration];
const explorationBaseRender=render,explorationBaseUpdate=updatePosition;
let selectedCell=null,cellCount=30,lensCenter=24,lensFollowing=false,lensDragging=false;
document.querySelector('.version').textContent=`ÉTUDE / ${explorationCopy.number}`;
document.querySelector('h1').textContent=explorationCopy.title;
document.querySelector('.page-heading p').textContent=explorationCopy.description;
document.querySelector('.page-heading .eyebrow').textContent=`RECHERCHE / ${explorationCopy.name.toUpperCase()}`;
document.querySelector('nav').innerHTML=`<a class="active" href="#atelier">${explorationCopy.name}</a><a href="propositions.html#${exploration}">Les sept propositions ↗</a>`;
document.querySelector('.anatomy').outerHTML=`<section class="exploration-note"><span>PRINCIPE DE LECTURE / ${explorationCopy.number}</span><p>${{
  matrix:'La teinte indique la part de la tranche couverte par au moins une période. Un losange signale un événement ponctuel. Cliquez sur une cellule pour retrouver ses éléments.',
  arcs:'Chaque arche représente un seul intervalle, entre ses deux extrémités. La courbure sépare les périodes ; elle ne représente ni une mesure, ni une relation entre les lignes.',
  lens:'La zone centrale est agrandie et les côtés sont comprimés. Les graduations restent explicites : les distances horizontales ne correspondent pas à une échelle uniforme.'
}[exploration]}</p><a href="RECHERCHES.md">Références et intentions ↗</a></section>`;
document.querySelector('.page-footer').innerHTML=`<a href="propositions.html#${exploration}">← Comparer les sept propositions</a><span>TIME WEAVE / RECHERCHE ${explorationCopy.number}</span>`;

function renderNewExploration(){
  explorationBaseRender();
  $('timeline').dataset.geometry=exploration;
  document.querySelector('.ruler-label>span').textContent=explorationCopy.structure;
  if(exploration==='matrix')renderMatrix();
  else if(exploration==='arcs')renderArches();
  else renderLens();
}
render=renderNewExploration;

function overlappingElements(rowId,start,end){
  return data().events.filter(e=>e.row===rowId&&!hiddenColors.has(e.color)&&(e.start===e.end?e.start>=start&&(e.start<end||(end===60&&e.start===60)):e.start<end&&e.end>start));
}
function coveredFraction(elements,start,end){
  const intervals=elements.filter(e=>e.start!==e.end).map(e=>[Math.max(start,e.start),Math.min(end,e.end)]).sort((a,b)=>a[0]-b[0]);
  let total=0,previousEnd=start;
  for(const [left,right] of intervals){total+=Math.max(0,right-Math.max(left,previousEnd));previousEnd=Math.max(previousEnd,right);}
  return Math.min(1,total/(end-start));
}
function renderMatrix(){
  document.querySelectorAll('.track').forEach(track=>{
    const rowId=track.dataset.track,step=(viewEnd-viewStart)/cellCount;
    track.style.setProperty('--cell-count',cellCount);
    track.previousElementSibling.querySelector('.row-number').textContent=String(data().events.filter(e=>e.row===rowId).length).padStart(2,'0');
    track.innerHTML=Array.from({length:cellCount},(_,i)=>{
      const start=viewStart+i*step,end=start+step,elements=overlappingElements(rowId,start,end),coverage=coveredFraction(elements,start,end),points=elements.filter(e=>e.start===e.end).length;
      const color=elements.find(e=>e.start!==e.end)?.color||elements[0]?.color||'neutral';
      const chosen=selectedCell?.row===rowId&&Math.abs(selectedCell.start-start)<.001;
      return `<button class="matrix-cell ${color} ${elements.length?'has-data':''} ${chosen?'chosen-cell':''}" data-cell="${rowId}|${start}|${end}" style="--coverage:${coverage};--heat-alpha:${.1+coverage*.66}" aria-pressed="${chosen}" aria-label="${format(start)} à ${format(end)}, ${elements.length} élément${elements.length>1?'s':''}, couverture ${Math.round(coverage*100)} pour cent" title="${format(start)} — ${format(end)} · couverture ${Math.round(coverage*100)} % · ${elements.length} élément(s)"><i aria-hidden="true"></i>${points?'<span class="matrix-point" aria-hidden="true">◇</span>':''}${coverage>0?`<small>${Math.round(coverage*100)}</small>`:''}</button>`;
    }).join('');
  });
  renderCellDetails();
  $('matrix-step').textContent=scenario==='operations'?`${((viewEnd-viewStart)/cellCount).toFixed(1).replace('.',',')} min / cellule`:`${((viewEnd-viewStart)/cellCount/60*14).toFixed(2).replace('.',',')} an / cellule`;
}
function renderCellDetails(){
  if(!selectedCell){$('matrix-details').innerHTML='<span class="cell-details-prompt">Sélectionnez une cellule pour retrouver les périodes et événements qui la traversent.</span>';return;}
  const {row,start,end}=selectedCell,elements=overlappingElements(row,start,end);
  const rowLabel=data().rows.find(r=>r.id===row)?.label;
  if(!rowLabel){selectedCell=null;renderCellDetails();return;}
  $('matrix-details').innerHTML=`<div class="cell-detail-heading"><span>${escapeHTML(rowLabel)}</span><span>${format(start,true)} → ${format(end,true)} <b>·</b> ${Math.round(coveredFraction(elements,start,end)*100)} % couverts</span></div><div class="cell-detail-events">${elements.length?elements.map(e=>`<button data-drill-event="${e.id}"><i class="dot ${e.color}"></i>${escapeHTML(e.label)}<small>${e.group?`groupe de ${e.group}`:format(e.start,true)}</small>${svg('arrow')}</button>`).join(''):'<span>Aucun élément dans cette tranche.</span>'}</div>`;
}

function renderArches(){
  document.querySelectorAll('.track').forEach(track=>{
    track.querySelectorAll('[data-event]').forEach((button,index)=>{
      const e=data().events.find(item=>item.id===button.dataset.event),point=e.start===e.end;
      button.classList.add('arch-event');button.style.setProperty('--arch-lift',index%2?'.64':'1');
      button.innerHTML=point?`<span class="arch-point" aria-hidden="true">◇</span><span class="arch-point-label">${escapeHTML(e.label)}</span>`:`<svg class="arch-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="arch-wash" d="M1 95C3 12 97 12 99 95Z"/><path class="arch-stroke" d="M1 95C3 12 97 12 99 95"/></svg><i class="arch-end arch-start" aria-hidden="true"></i><i class="arch-end" aria-hidden="true"></i><span class="arch-label">${escapeHTML(e.label)}${e.group?` <b>${e.group}</b>`:''}</span><span class="arch-times"><time>${format(e.start)}</time><time>${format(e.end)}</time></span>`;
    });
  });
}

function lensBounds(){
  const width=viewEnd-viewStart,focusWidth=width*.2;
  const start=Math.max(viewStart,Math.min(viewEnd-focusWidth,lensCenter-focusWidth/2)),end=start+focusWidth;
  return {start,end,left:start>viewStart+.0001?18:0,right:end<viewEnd-.0001?82:100};
}
function lensMap(t){
  if(t<=viewStart)return 0;if(t>=viewEnd)return 100;
  const b=lensBounds();
  if(t<b.start)return b.left*(t-viewStart)/(b.start-viewStart);
  if(t>b.end)return b.right+(100-b.right)*(t-b.end)/(viewEnd-b.end);
  return b.left+(b.right-b.left)*(t-b.start)/(b.end-b.start);
}
function lensInverse(x){
  const b=lensBounds(),p=Math.max(0,Math.min(100,x));
  if(p<b.left)return viewStart+(b.start-viewStart)*p/b.left;
  if(p>b.right)return b.end+(viewEnd-b.end)*(p-b.right)/(100-b.right);
  return b.start+(b.end-b.start)*(p-b.left)/(b.right-b.left);
}
function renderLens(){
  const b=lensBounds();
  $('timeline').style.setProperty('--focus-left',`${b.left}%`);$('timeline').style.setProperty('--focus-right',`${b.right}%`);
  $('lens-window').textContent=`${format(b.start)} — ${format(b.end)} · ×${((b.right-b.left)/20).toFixed(1).replace('.',',')}`;
  $('lens-position').value=String(lensCenter);
  document.querySelectorAll('.track').forEach(track=>{
    track.querySelectorAll('[data-event]').forEach(button=>{
      const e=data().events.find(item=>item.id===button.dataset.event),point=e.start===e.end;
      button.style.left=`${Math.max(0,lensMap(e.start))}%`;
      button.style.width=point?'7px':`${Math.max(.3,Math.min(100,lensMap(e.end))-Math.max(0,lensMap(e.start)))}%`;
      button.classList.add('lens-event');button.classList.toggle('lens-context',e.end<b.start||e.start>b.end);
      button.classList.toggle('lens-overhang',lensMap(e.start)>76);
      button.innerHTML=`<i class="lens-period" aria-hidden="true"></i><i class="lens-node" aria-hidden="true"></i>${!point?'<i class="lens-endpoint" aria-hidden="true"></i>':''}<span class="lens-label">${escapeHTML(e.label)}${e.group?`<small>${e.group}</small>`:''}</span>`;
    });
  });
  const times=[viewStart,(viewStart+b.start)/2,b.start,(b.start+b.end)/2,b.end,(b.end+viewEnd)/2,viewEnd].filter((t,i,a)=>a.findIndex(v=>Math.abs(v-t)<.001)===i);
  $('ruler').innerHTML=times.map(t=>`<div class="tick ${t>=b.start&&t<=b.end?'focus-tick':''}" style="left:${lensMap(t)}%"><span>${format(t)}</span></div>`).join('')+data().keys.filter(k=>k>=viewStart&&k<=viewEnd).map(k=>`<button class="key-marker" style="left:${Math.min(99,Math.max(1,lensMap(k)))}%" data-key="${k}" aria-label="Aller au repère ${format(k)}" title="Repère ${format(k)}">◇</button>`).join('')+`<span class="lens-axis-break" style="left:${b.left}%" aria-hidden="true">//</span><span class="lens-axis-break" style="left:${b.right}%" aria-hidden="true">//</span>`;
  const labelWidth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--label-width'));
  $('playhead').style.left=`${labelWidth+($('timeline').clientWidth-labelWidth)*lensMap(position)/100}px`;
}

if(exploration==='matrix'){
  document.querySelector('.timeline-toolbar').insertAdjacentHTML('afterend',`<div class="exploration-toolbar"><span>${svg('density')} COUVERTURE TEMPORELLE <small id="matrix-step"></small></span><label>Résolution <select id="matrix-resolution" aria-label="Résolution de la matrice"><option value="15">15 tranches</option><option value="30" selected>30 tranches</option><option value="60">60 tranches</option></select></label><span class="coverage-scale">0 % <i></i> 100 % <b>◇</b> événement</span></div>`);
  document.querySelector('.overview-wrap').insertAdjacentHTML('beforebegin','<div id="matrix-details" class="matrix-details" aria-live="polite"></div>');
  $('matrix-resolution').onchange=event=>{cellCount=Number(event.target.value);render();};
  $('timeline').addEventListener('click',event=>{
    const cell=event.target.closest('[data-cell]');if(!cell)return;event.stopImmediatePropagation();
    const [row,start,end]=cell.dataset.cell.split('|');selectedCell={row,start:Number(start),end:Number(end)};
    const elements=overlappingElements(row,Number(start),Number(end));if(elements.length){selected=elements[0];renderInspector();}
    renderMatrix();document.querySelector(`[data-cell="${cell.dataset.cell}"]`)?.focus({preventScroll:true});
  },true);
  $('matrix-details').onclick=event=>{const button=event.target.closest('[data-drill-event]');if(!button)return;selected=data().events.find(e=>e.id===button.dataset.drillEvent);renderInspector();};
}
if(exploration==='lens'){
  document.querySelector('.timeline-toolbar').insertAdjacentHTML('afterend',`<div class="exploration-toolbar lens-toolbar"><span>${svg('crosshair')} LOUPE <strong id="lens-window"></strong></span><label for="lens-position">Déplacer la fenêtre</label><input id="lens-position" type="range" min="0" max="60" step="0.25" value="24" aria-label="Centre de la loupe"><button id="lens-follow" aria-pressed="false">${svg('crosshair')} Suivre le curseur</button><small>ÉCHELLE NON UNIFORME</small></div>`);
  $('lens-position').oninput=event=>{lensCenter=Number(event.target.value);lensFollowing=false;$('lens-follow').setAttribute('aria-pressed','false');renderLens();};
  $('lens-follow').onclick=()=>{lensFollowing=!lensFollowing;$('lens-follow').setAttribute('aria-pressed',String(lensFollowing));if(lensFollowing){lensCenter=position;renderLens();}};
  updatePosition=function updateLensPosition(){explorationBaseUpdate();if(lensFollowing)lensCenter=position;renderLens();};
  $('timeline').addEventListener('click',event=>{
    if(event.target.closest('[data-event],[data-toggle],[data-key],#playhead'))return;
    const track=event.target.closest('.track,.ruler');if(!track)return;
    event.stopImmediatePropagation();const rect=track.getBoundingClientRect();seek(lensInverse((event.clientX-rect.left)/rect.width*100));
  },true);
  $('playhead').addEventListener('pointerdown',event=>{event.stopImmediatePropagation();event.preventDefault();lensDragging=true;$('playhead').setPointerCapture(event.pointerId);},true);
  $('playhead').addEventListener('pointermove',event=>{if(!lensDragging)return;event.stopImmediatePropagation();const rect=$('ruler').getBoundingClientRect();seek(lensInverse((event.clientX-rect.left)/rect.width*100));},true);
  for(const type of ['pointerup','pointercancel'])$('playhead').addEventListener(type,event=>{if(lensDragging){event.stopImmediatePropagation();lensDragging=false;}},true);
  new ResizeObserver(()=>updatePosition()).observe($('timeline'));
}
hydrate();render();
