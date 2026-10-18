const variant = document.body.dataset.variant;
const variantCopy = {
  console:{number:'02',title:'Console de supervision',subtitle:'Station Nord / Session du 18 octobre 2026',eyebrow:'ESPACE OPÉRATIONNEL',description:'Une console de travail précise, avec une navigation latérale et un journal de session.'},
  horizon:{number:'03',title:'Les trajectoires se dessinent.',subtitle:'Des années d’expérience, reliées par un même fil.',eyebrow:'PARCOURS & PERSPECTIVES',description:'Une lecture panoramique du parcours, avec plus d’espace et des détails sous la chronologie.'},
  studio:{number:'04',title:'Composez votre lecture.',subtitle:'Un atelier de précision, ajusté à votre manière de travailler.',eyebrow:'STUDIO / EXPLORATEUR TEMPOREL',description:'Un atelier avec les réglages de densité, de grille et de libellés à portée de main.'}
};
const copy=variantCopy[variant];
document.querySelector('.version').textContent=`ÉTUDE / ${copy.number}`;
document.querySelector('h1').textContent=copy.title;
document.querySelector('.page-heading p').textContent=copy.subtitle;
document.querySelector('.page-heading .eyebrow').textContent=copy.eyebrow;
document.querySelector('.breadcrumb').innerHTML=`Explorations <span>/</span> ${copy.number} <span>/</span> <strong>${variant[0].toUpperCase()+variant.slice(1)}</strong>`;
document.querySelector('nav').innerHTML=`<a class="active" href="#atelier">${variant==='console'?'Supervision':variant==='horizon'?'Chronologie':'Explorateur'}</a><a href="propositions.html">Toutes les propositions ${svg('arrow')}</a>`;
document.querySelector('.header-note').innerHTML=`<span class="status-dot"></span> ${variant==='console'?'Session de démonstration':'Exploration visuelle'} <span class="header-divider"></span> ${copy.number} / 04`;
document.querySelector('.page-footer').innerHTML=`<a href="propositions.html">← Comparer les propositions</a><span>TIME WEAVE <span>·</span> ${copy.number} / ${variant.toUpperCase()}</span>`;
document.querySelectorAll('.segmented button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.density===document.body.dataset.density)));
$('density-label').textContent=document.body.dataset.density==='compact'?'Compacte':'Standard';

if(variant==='console'){
  document.querySelector('.app-header').insertAdjacentHTML('beforeend',`<div class="rail-section"><span class="rail-label">ESPACE DE TRAVAIL</span><a href="#atelier" class="rail-active">${svg('activity')} Rejeu opérationnel <small>01</small></a><a href="horizon.html">${svg('building')} Parcours historique</a></div><div class="rail-section rail-bottom"><span class="rail-label">EXPLORATIONS</span><a href="index.html">${svg('layers')} Atelier original</a><a href="studio.html">${svg('density')} Studio</a><a href="propositions.html">${svg('compass')} Comparer les vues</a><div class="rail-status"><span class="status-dot"></span> Source locale <span>UTC +00</span></div></div>`);
  document.querySelector('.anatomy').outerHTML=`<section class="session-journal" aria-label="Journal de session"><div class="journal-heading"><span>${svg('code')} Journal de session</span><span>DÉMONSTRATION · 3 ENTRÉES</span></div><div class="journal-entry"><time>13:00:00</time><i class="dot teal"></i><span>Chargement de la session</span><code>station-nord / 2026-10-18</code><span class="journal-state">Prêt</span></div><div class="journal-entry"><time>13:00:00</time><i class="dot blue"></i><span>Initialisation de la fenêtre</span><code>13:00:00 → 14:00:00</code><span class="journal-state">Chargée</span></div><div class="journal-entry"><time>13:24:00</time><i class="dot purple"></i><span>Position initiale du rejeu</span><code>TMP-001 / télémétrie</code><span class="journal-state">En pause</span></div></section>`;
}

if(variant==='horizon'){
  document.querySelector('.page-heading .eyebrow').insertAdjacentHTML('afterend','<div class="horizon-edition">TIME WEAVE <span>—</span> CHRONOLOGIE</div>');
  document.querySelector('.anatomy').outerHTML=`<section class="horizon-notes" aria-label="Les chapitres du parcours"><span class="horizon-caption">UNE CONTINUITÉ, TROIS CHAPITRES</span><div><span>01 / 2013—2017</span><h3>Explorer la simulation.</h3><p>Les premiers outils, la 3D et les environnements immersifs.</p></div><div><span>02 / 2017—2026</span><h3>Relier l’industrie au numérique.</h3><p>Des systèmes connectés aux expériences de terrain.</p></div><div><span>03 / DEPUIS 2026</span><h3>Ouvrir de nouvelles perspectives.</h3><p>Des projets indépendants, des agents et de nouveaux outils.</p></div></section>`;
  document.querySelector('[data-scenario="history"]').click();
  $('collapse-all').click();
}

if(variant==='studio'){
  const workspace=document.querySelector('.workspace');
  const studio=document.createElement('div');studio.className='studio-layout';workspace.before(studio);
  studio.innerHTML=`<aside class="display-settings" aria-label="Réglages de présentation"><div class="settings-title">${svg('density')} Présentation <span>01</span></div><div class="settings-section"><span class="settings-label">ESPACEMENT</span><p>Le bon niveau de détail.</p><div id="studio-density"></div></div><div class="settings-section"><span class="settings-label">DANS LA TIMELINE</span><label class="setting-switch"><span>Grille temporelle<small>Conserver les repères visuels</small></span><input type="checkbox" id="show-grid" checked><i></i></label><label class="setting-switch"><span>Libellés des éléments<small>Afficher le nom des séquences</small></span><input type="checkbox" id="show-labels" checked><i></i></label><label class="setting-switch"><span>Panneau de détail<small>Inspecter la sélection</small></span><input type="checkbox" id="show-detail" checked><i></i></label></div><div class="settings-section"><label class="settings-label" for="structure-width">LARGEUR DE STRUCTURE</label><div class="range-value"><span>Libellés de lignes</span><output id="width-output">200 px</output></div><input id="structure-width" type="range" min="160" max="280" value="200" step="10"></div><div class="settings-section"><span class="settings-label">PALETTE DE SIGNAL</span><div class="palette-samples"><i class="teal"></i><i class="blue"></i><i class="amber"></i><i class="purple"></i></div><p>De la couleur pour les données.<br>Du calme pour la structure.</p></div><div class="settings-foot">${svg('sun')} Clair <span>Apparence de l’atelier</span></div></aside>`;
  studio.append(workspace);
  $('studio-density').append(document.querySelector('.density-control'));
  const densityLabels={compact:'Compacte',standard:'Standard',comfortable:'Confortable'};
  document.querySelectorAll('.segmented button').forEach(button=>button.insertAdjacentHTML('beforeend',`<span>${densityLabels[button.dataset.density]}</span>`));
  for(const [id,cls] of [['show-grid','without-grid'],['show-labels','without-labels'],['show-detail','without-detail']]){
    $(id).onchange=()=>{document.body.classList.toggle(cls,!$(id).checked);requestAnimationFrame(updatePosition);};
  }
  $('structure-width').oninput=()=>{document.documentElement.style.setProperty('--label-width',`${$('structure-width').value}px`);$('width-output').textContent=`${$('structure-width').value} px`;updatePosition();};
  document.querySelector('.anatomy').outerHTML=`<div class="studio-tip">${svg('crosshair')} <span>Sélectionnez un élément pour l’inspecter. Cliquez dans la timeline pour déplacer le curseur.</span><span>Les réglages restent locaux à cette vue.</span></div>`;
}
hydrate();updatePosition();
