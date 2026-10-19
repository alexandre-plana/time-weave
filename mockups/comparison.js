const views={
  original:{file:'index.html',name:'01 / Originale',height:1460,description:'La référence : bandes proportionnelles et chips colorés.',title:'Bandes & chips.',copy:'La première maquette est conservée. Les périodes prennent la forme de bandes colorées, et les points apparaissent sur une grille de lignes.',structure:'La référence conservée.',structureCopy:'Ce rendu sert de point de comparaison aux trois nouvelles géométries.'},
  console:{file:'console.html',name:'02 / Signaux',height:1270,description:'Impulsions, trames de paquets et lignes de référence.',title:'Lire l’activité comme un signal.',copy:'Les périodes deviennent des créneaux, les groupes des trames de traits et les événements ponctuels des impulsions. La couleur identifie les canaux sans remplir de rectangles.',structure:'La géométrie change.',structureCopy:'Pas de chips de durée : une ligne de base par canal, des tracés fins et une grille de précision. Adapté aux séquences techniques denses.'},
  horizon:{file:'horizon.html',name:'03 / Jalons',height:1390,description:'Rails horizontaux, nœuds circulaires et légendes alternées.',title:'Lire le temps de point en point.',copy:'Chaque événement s’ancre sur un rail. Les noms et dates alternent au-dessus et au-dessous ; une ligne relie le début et la fin des périodes.',structure:'Des jalons reliés.',structureCopy:'Les marqueurs deviennent le point d’entrée de la lecture. Le nom, l’icône et les dates s’inscrivent à côté du point, sans bande pleine.'},
  studio:{file:'studio.html',name:'04 / Pistes',height:1430,description:'Clips détaillés sur deux niveaux et sommaires de groupes.',title:'Parcourir des pistes et des séquences.',copy:'Des blocs détaillés se répartissent sur deux sous-pistes. Chaque clip affiche son nom, son instant et sa durée. Les parents utilisent des accolades de synthèse.',structure:'Deux niveaux dans chaque piste.',structureCopy:'Une composition inspirée des éditeurs de séquences : des pistes épaisses, des clips à tranche colorée et une hiérarchie visible dans la géométrie.'},
  matrix:{file:'matrix.html',name:'05 / Matrice',height:1000,description:'Couverture temporelle, cellules sélectionnables et détail par tranche.',title:'Voir les rythmes, pas seulement les événements.',copy:'La couverture d’une tranche devient une intensité de couleur. Les zones actives, les creux et les points isolés se comparent d’une ligne à l’autre. Cliquer une cellule restitue ses éléments.',structure:'Une lecture par cellules.',structureCopy:'Inspirée des encodages en cellules d’Observable Plot. Le pourcentage décrit la durée couverte, sans inventer de fréquence à partir des groupes.'},
  arcs:{file:'arcs.html',name:'06 / Arches',height:1300,description:'Une arche entre les bornes de chaque période ; les instants restent des points.',title:'Dessiner les périodes dans l’espace.',copy:'Une courbe légère relie le début et la fin de chaque période. Les deux extrémités restent visibles, et le nom flotte au-dessus de l’intervalle.',structure:'Une recherche graphique.',structureCopy:'La hauteur sépare les périodes visuellement. Elle ne représente aucune valeur ni une causalité entre les événements : chaque arche est un seul intervalle.'},
  lens:{file:'lens.html',name:'07 / Loupe',height:1100,description:'Centre agrandi, contexte comprimé, fenêtre déplaçable et suivi du curseur.',title:'S’approcher sans perdre le contexte.',copy:'La zone d’intérêt prend davantage de largeur, tandis que les alentours restent visibles. Déplacez la loupe ou activez le suivi pour observer la lecture de près.',structure:'Focus + contexte.',structureCopy:'Inspirée des travaux de Mike Bostock sur la déformation fisheye. Les graduations et les séparateurs signalent explicitement l’échelle non uniforme.'}
};
const frame=document.getElementById('preview-frame'),viewport=document.getElementById('viewport');
let currentKey=views[location.hash.slice(1)]?location.hash.slice(1):'matrix';
let current=views[currentKey],focusMode=true,comparisonScenario='operations',comparisonDensity='standard',componentSizeObserver;
const componentCSS=`
  html{background:#fff!important}body{margin:0!important;background:#fff!important}
  .app-header,main>.breadcrumb,main>.page-heading,.anatomy,.session-journal,.horizon-notes,.studio-tip,.page-footer,.display-settings,.exploration-note{display:none!important}
  main{padding:0!important;margin:0!important;max-width:none!important}
  .studio-layout{display:block!important;margin:0!important}
  .workspace{border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important}
  .workspace-heading{display:none!important}
  .context-bar{padding:19px 22px!important;background:#fff!important}
  .context-icon{display:none!important}.context-bar strong{font:500 13px Inter,system-ui,sans-serif!important;color:#52647b!important}
  .context-bar #scenario-subtitle{font:9px Inter,system-ui,sans-serif!important;color:#a0abba!important}
  .timeline-toolbar{border-top:1px solid #e6eaf0!important;border-bottom:1px solid #e6eaf0!important;background:#fcfdff!important;padding:0 17px!important}
  .editor-layout{display:flex!important;flex-direction:column!important}
  .ruler-label{font-family:'IBM Plex Mono',Consolas,monospace!important}
  .inspector{display:block!important;border:0!important;border-top:1px solid #e6eaf0!important;padding:0!important;background:#fbfcfe!important}
  .inspector-heading,.detail-icon,.detail-code,.detail-description,.detail-fields,.payload-heading,.payload{display:none!important}
  #inspector-content{display:flex!important;align-items:center!important;gap:18px!important;padding:13px 20px!important;min-height:48px!important}
  #inspector-content h2{font:500 11px Inter,system-ui,sans-serif!important;margin:0!important;color:#6f8098!important}
  .detail-chips{display:flex!important;gap:5px!important;margin:0!important}
  .detail-chips .chip{font:8px Inter,system-ui,sans-serif!important}
  .seek-button{width:auto!important;max-width:none!important;margin:0 0 0 auto!important;height:26px!important;font:8px Inter,system-ui,sans-serif!important;padding:0 10px!important}
  .legend{padding:0 22px!important;min-height:42px!important;background:#fff!important}
`;
function fit(){const scale=viewport.clientWidth/1440;frame.style.transform=`scale(${scale})`;frame.style.height=`${current.height}px`;viewport.style.height=`${current.height*scale+2}px`;}
function measure(){const doc=frame.contentDocument;if(!doc)return;current.height=Math.ceil(focusMode?doc.querySelector('.workspace').getBoundingClientRect().height+2:Math.max(900,doc.body.scrollHeight+2));fit();}
function prepareFrame(){
  const doc=frame.contentDocument;if(!doc?.querySelector('.workspace'))return;
  doc.getElementById('comparison-focus')?.remove();
  if(focusMode){const style=doc.createElement('style');style.id='comparison-focus';style.textContent=componentCSS;doc.head.append(style);}
  const scenarioButton=doc.querySelector(`[data-scenario="${comparisonScenario}"]`);
  const scenarioChanged=scenarioButton?.getAttribute('aria-pressed')!=='true';
  if(scenarioChanged)scenarioButton.click();
  if(comparisonScenario==='history'&&currentKey==='horizon'&&scenarioChanged){
    const fold=doc.getElementById('collapse-all');if(fold?.getAttribute('aria-label')==='Replier toutes les lignes')fold.click();
  }
  doc.querySelector(`.segmented button[data-density="${comparisonDensity}"]`)?.click();
  measure();
}
function choose(key){
  currentKey=key;current=views[key];
  componentSizeObserver?.disconnect();
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===key)));
  frame.src=`${current.file}?study=geometry-3`;frame.title=`${current.name} — ${focusMode?'timeline seule':'interface complète'}`;
  for(const [id,value] of [['preview-name',current.name],['preview-description',current.description],['detail-title',current.title],['detail-copy',current.copy],['detail-structure',current.structure],['detail-structure-copy',current.structureCopy]])document.getElementById(id).textContent=value;
  document.getElementById('open-link').href=current.file;fit();history.replaceState(null,'',`#${key}`);
}
frame.addEventListener('load',async()=>{const doc=frame.contentDocument;if(!doc)return;await doc.fonts.ready;prepareFrame();componentSizeObserver=new ResizeObserver(measure);componentSizeObserver.observe(doc.querySelector('.workspace'));});
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>choose(button.dataset.view));
document.querySelectorAll('[data-comparison-scenario]').forEach(button=>button.onclick=()=>{
  comparisonScenario=button.dataset.comparisonScenario;document.querySelectorAll('[data-comparison-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));prepareFrame();
});
document.querySelectorAll('[data-comparison-density]').forEach(button=>button.onclick=()=>{
  comparisonDensity=button.dataset.comparisonDensity;document.querySelectorAll('[data-comparison-density]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));prepareFrame();
});
document.getElementById('full-interface').onchange=event=>{focusMode=!event.target.checked;choose(currentKey);};
new ResizeObserver(fit).observe(viewport);choose(currentKey);
