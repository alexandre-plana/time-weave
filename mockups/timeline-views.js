/* Trois géométries de timeline. Le moteur de la maquette 01 reste inchangé. */
const initialTimelineRender = render;
const signalPath = (e, index) => {
  if (e.start === e.end) return '<path d="M50 30V5m-4 4 4-4 4 4"/>';
  if (e.group) {
    const count = Math.min(32, Math.max(8, Math.round(e.group / 5)));
    return Array.from({length:count},(_,i)=>`<path d="M${4+i*92/count} 26V${i%3===0?7:13}"/>`).join('');
  }
  return `<path d="M0 26H9V${index%2?11:7}H91V26H100"/><path class="signal-fill" d="M9 26V${index%2?11:7}H91V26Z"/>`;
};
function decorateTimeline() {
  $('timeline').dataset.geometry = variant;
  document.querySelector('.ruler-label>span').textContent = {console:'CANAUX / ÉVÉNEMENTS',horizon:'STRATES / JALONS',studio:'PISTES / SÉQUENCES'}[variant];
  if(variant==='horizon'){
    $('ruler').style.gridRow=String(visibleRows().length+1);$('ruler').style.gridColumn='2';
    document.querySelector('.ruler-label').style.gridRow=String(visibleRows().length+1);document.querySelector('.ruler-label').style.gridColumn='1';
  }
  document.querySelectorAll('.track').forEach(track => {
    const row = data().rows.find(r=>r.id===track.dataset.track);
    const label=track.previousElementSibling;
    const events=[...track.querySelectorAll('[data-event]')];
    track.classList.toggle('clip-group',isParent(row));label.classList.toggle('clip-group',isParent(row));
    if(variant==='console') {
      label.insertAdjacentHTML('beforeend',`<span class="signal-row-count">${events.length.toString().padStart(2,'0')}</span>`);
    }
    if(variant==='studio') {
      label.insertAdjacentHTML('afterbegin',`<span class="clip-index">${(data().rows.indexOf(row)+1).toString().padStart(2,'0')}</span>`);
      label.insertAdjacentHTML('beforeend',`<span class="clip-row-kind">${isParent(row)?'GROUPE':'PISTE'}</span>`);
    }
    events.forEach((button,index) => {
      const e=data().events.find(item=>item.id===button.dataset.event);
      const isPoint=e.start===e.end;
      button.classList.add(`geometry-${variant}`);
      button.style.setProperty('--event-order',index);
      button.style.setProperty('--sublane',index%2);
      if(variant==='console') {
        button.innerHTML=`<svg class="signal-shape" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">${signalPath(e,index)}</svg><span class="signal-caption">${escapeHTML(e.label)}</span>${e.group?`<span class="signal-count">${e.group}</span>`:''}`;
      } else if(variant==='horizon') {
        button.classList.toggle('milestone-below',index%2===1);
        button.classList.toggle('milestone-end',percent(e.start)>80);
        const mark=e.row==='companies'?{['Oreka Ingénierie']:'O',['Schneider Electric']:'S',['X-PERT']:'X'}[e.label]:'';
        const period=!isPoint?`${format(e.start)} — ${format(e.end)}`:format(e.start,true);
        button.innerHTML=`${!isPoint?'<i class="milestone-range" aria-hidden="true"></i>':''}<i class="milestone-stem" aria-hidden="true"></i><span class="milestone-node ${mark?'company-node':''}" aria-hidden="true">${mark||''}</span><span class="milestone-label"><strong>${escapeHTML(e.label)}</strong><small>${period}${e.group?` · ${e.group} éléments`:''}</small></span>`;
      } else {
        const duration=scenario==='operations'?`${Math.round((e.end-e.start)*60)} s`:`${((e.end-e.start)/60*14).toFixed(1).replace('.',',')} ans`;
        if(isParent(row)) {
          button.innerHTML=`<i class="clip-summary-line" aria-hidden="true"></i><span class="clip-summary-name">${escapeHTML(e.label)}</span>${e.group?`<strong class="clip-summary-count">${e.group}</strong>`:''}`;
        } else {
          const icon=isPoint?'alert':e.topic?'radio':e.color==='purple'?'layers':'activity';
          button.innerHTML=`<span class="clip-topline">${svg(icon)}<span>${escapeHTML(e.label)}</span></span><span class="clip-timing"><time>${format(e.start,true)}</time><span>${isPoint?'JALON':duration}</span></span><span class="clip-edge" aria-hidden="true"></span>`;
        }
      }
    });
  });
  updatePosition();
}
render = function renderVariantTimeline(){initialTimelineRender();decorateTimeline();};
render();
