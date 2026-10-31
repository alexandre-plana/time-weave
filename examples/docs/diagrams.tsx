/**
 * Inline SVG illustrations of the documentation. Colours come from CSS classes
 * (docs.css) bound to the site tokens, so they follow the light and dark themes.
 */

function Arrow({ id, tone = 'ink' }: { id: string; tone?: 'ink' | 'blue' | 'red' | 'green' }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" className={`dg-fill-${tone}`} />
    </marker>
  );
}

/** Row tree on the left, lanes on the right: point, period, group, keys. */
export function DataModelDiagram() {
  const x = (minutes: number) => 236 + minutes * 8.4;
  const rows = [
    { y: 52, label: 'Site de Lyon', depth: 0, id: 'site' },
    { y: 104, label: 'Pompe P1', depth: 1, id: 'pompe' },
    { y: 164, label: 'Vanne V2', depth: 1, id: 'vanne' },
  ];
  return (
    <svg className="dg" viewBox="0 0 760 262" role="img" aria-labelledby="dg-model-title dg-model-desc">
      <title id="dg-model-title">Modèle de données</title>
      <desc id="dg-model-desc">
        Une arborescence de lignes à gauche ; chaque ligne visible devient une bande à droite. La ligne Pompe P1 contient un point (un instant) et une
        période dont la fin est exclue ; la ligne Vanne V2 contient un groupe de 12 éléments ; deux clés sont posées sur l’axe.
      </desc>
      <rect x="0.5" y="0.5" width="759" height="261" rx="8" className="dg-panel" />
      <text x="16" y="28" className="dg-label dg-strong">
        rows
      </text>
      <text x="58" y="28" className="dg-label dg-muted">
        hiérarchie par parentId
      </text>
      <line x1="210" y1="0" x2="210" y2="214" className="dg-line" />
      {/* axis */}
      <line x1="210" y1="40" x2="760" y2="40" className="dg-line" />
      {[0, 15, 30, 45, 60].map((m) => (
        <g key={m}>
          <line x1={x(m)} y1="34" x2={x(m)} y2="214" className="dg-grid" />
          <text x={x(m)} y="28" textAnchor="middle" className="dg-mono dg-muted">
            {`${8 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`}
          </text>
        </g>
      ))}
      {/* row bands */}
      {rows.map((row, index) => (
        <g key={row.id}>
          <line x1="0" y1={row.y - 12} x2="760" y2={row.y - 12} className="dg-grid" opacity={index === 0 ? 0 : 1} />
          {row.depth === 1 && <path d={`M30 ${row.y - 34} V${row.y + 2} H44`} className="dg-tree" />}
          <text x={row.depth ? 52 : 16} y={row.y + 6} className="dg-label">
            {row.depth === 0 ? '▾ ' : ''}
            {row.label}
          </text>
          <text x={row.depth ? 52 : 16} y={row.y + 22} className="dg-mono dg-muted">
            {row.depth ? `parentId: 'site'` : `id: '${row.id}'`}
          </text>
        </g>
      ))}
      <line x1="0" y1="214" x2="760" y2="214" className="dg-line" />
      {/* parent row: a period supplied by the application */}
      <rect x={x(0)} y="44" width={x(60) - x(0)} height="20" rx="4" className="dg-span" />
      <text x={x(1)} y="58" className="dg-item-text">
        Journée normale (fournie par l’application)
      </text>
      {/* point */}
      <circle cx={x(10)} cy="104" r="6" className="dg-point" />
      <text x={x(10)} y="126" textAnchor="middle" className="dg-mono dg-blue">
        at
      </text>
      {/* period with start included, end excluded */}
      <rect x={x(20)} y="94" width={x(50) - x(20)} height="20" rx="4" className="dg-span" />
      <text x={x(21)} y="108" className="dg-item-text">
        Cycle
      </text>
      <circle cx={x(20)} cy="134" r="3.5" className="dg-fill-blue" />
      <circle cx={x(50)} cy="134" r="3.5" className="dg-hollow" />
      <line x1={x(20) + 4} y1="134" x2={x(50) - 4} y2="134" className="dg-blue-line" />
      <text x={x(20)} y="150" textAnchor="middle" className="dg-mono dg-blue dg-halo">
        start inclus
      </text>
      <text x={x(50)} y="150" textAnchor="middle" className="dg-mono dg-blue">
        end exclu
      </text>
      {/* group */}
      <rect x={x(30)} y="154" width={x(45) - x(30)} height="20" rx="4" className="dg-group" />
      <text x={x(31)} y="168" className="dg-group-text">
        12 alertes
      </text>
      <rect x={x(45) - 22} y="157" width="20" height="14" rx="7" className="dg-badge" />
      <text x={x(45) - 12} y="167.5" textAnchor="middle" className="dg-badge-text">
        12
      </text>
      <text x={x(45) + 8} y="168" className="dg-mono dg-purple">
        group: {'{ count: 12 }'}
      </text>
      {/* keys */}
      {[20, 30].map((m) => (
        <g key={m}>
          <line x1={x(m)} y1="40" x2={x(m)} y2="214" className="dg-key-line" />
          <path d={`M${x(m)} 33 l6 7 l-6 7 l-6 -7 z`} className="dg-key" />
        </g>
      ))}
      {/* legend */}
      <g transform="translate(16 240)">
        <circle cx="6" cy="0" r="5" className="dg-point" />
        <text x="18" y="4" className="dg-label">
          Point · <tspan className="dg-mono">at</tspan>
        </text>
        <rect x="120" y="-7" width="26" height="14" rx="3" className="dg-span" />
        <text x="154" y="4" className="dg-label">
          Période · <tspan className="dg-mono">[start, end)</tspan>
        </text>
        <rect x="330" y="-7" width="26" height="14" rx="3" className="dg-group" />
        <text x="364" y="4" className="dg-label">
          Groupe · <tspan className="dg-mono">group.count</tspan>
        </text>
        <path d="M546 -7 l6 7 l-6 7 l-6 -7 z" className="dg-key" />
        <text x="560" y="4" className="dg-label">
          Clé · <tspan className="dg-mono">keys[]</tspan>
        </text>
      </g>
    </svg>
  );
}

/** The three ranges: domain, viewport, data coverage, with the cursor and the live frontier. */
export function RangesDiagram() {
  return (
    <svg className="dg" viewBox="0 0 760 236" role="img" aria-labelledby="dg-ranges-title dg-ranges-desc">
      <title id="dg-ranges-title">Les trois plages de temps</title>
      <desc id="dg-ranges-desc">
        La période complète (domain) couvre tout ; la fenêtre visible (viewport) en est une partie ; la plage chargée (data.coverage) entoure la
        fenêtre d’une marge de 25 % de chaque côté. Le curseur (time) est dans la fenêtre ; la frontière du direct (liveTime) est à la fin de la
        période.
      </desc>
      <defs>
        <Arrow id="dg-ranges-arrow" />
      </defs>
      <rect x="0.5" y="0.5" width="759" height="235" rx="8" className="dg-panel" />
      {/* domain */}
      <text x="40" y="32" className="dg-label dg-halo">
        <tspan className="dg-mono dg-strong">domain</tspan> — période complète : lecture, boucle, Stop et fin s’y rapportent
      </text>
      <rect x="40" y="42" width="680" height="22" rx="5" className="dg-domain" />
      {/* guides */}
      <line x1="300" y1="64" x2="300" y2="180" className="dg-guide" />
      <line x1="480" y1="64" x2="480" y2="180" className="dg-guide" />
      <rect x="300" y="42" width="180" height="22" className="dg-domain-window" />
      {/* viewport */}
      <text x="300" y="98" className="dg-label dg-halo">
        <tspan className="dg-mono dg-strong">viewport</tspan> — fenêtre visible
      </text>
      <rect x="300" y="106" width="180" height="24" rx="5" className="dg-viewport" />
      {/* coverage */}
      <rect x="255" y="150" width="270" height="22" rx="5" className="dg-coverage" />
      <text x="255" y="192" className="dg-label">
        <tspan className="dg-mono dg-strong">data.coverage</tspan> — plage chargée (source par fenêtre) : fenêtre + <tspan className="dg-mono">windowMargin</tspan>{' '}
        (25 %)
      </text>
      <line x1="257" y1="161" x2="298" y2="161" className="dg-measure" markerEnd="url(#dg-ranges-arrow)" />
      <line x1="523" y1="161" x2="482" y2="161" className="dg-measure" markerEnd="url(#dg-ranges-arrow)" />
      {/* cursor */}
      <line x1="372" y1="38" x2="372" y2="176" className="dg-cursor" />
      <circle cx="372" cy="38" r="4" className="dg-fill-blue" />
      <text x="378" y="124" className="dg-mono dg-blue">
        time
      </text>
      {/* live frontier */}
      <line x1="720" y1="36" x2="720" y2="76" className="dg-live" />
      <text x="716" y="90" textAnchor="end" className="dg-mono dg-red">
        liveTime
      </text>
      <text x="40" y="88" className="dg-mono dg-muted">
        start
      </text>
      <text x="40" y="222" className="dg-label dg-muted">
        Les trois plages sont indépendantes : charger moins de données ne raccourcit jamais la lecture.
      </text>
    </svg>
  );
}

/** Sequence of a time change: request, preparation by the application, confirmation; with a cancellation. */
export function SequenceDiagram() {
  const U = 90;
  const C = 380;
  const A = 664;
  const message = (y: number, from: number, to: number, text: string, variant: 'call' | 'return' | 'abort' = 'call') => (
    <g>
      <line
        x1={from}
        y1={y}
        x2={to + (to > from ? -6 : 6)}
        y2={y}
        className={variant === 'call' ? 'dg-msg' : variant === 'abort' ? 'dg-msg dg-msg--abort' : 'dg-msg dg-msg--return'}
        markerEnd={`url(#${variant === 'abort' ? 'dg-seq-arrow-red' : 'dg-seq-arrow'})`}
      />
      <text x={(from + to) / 2} y={y - 7} textAnchor="middle" className={`dg-mono ${variant === 'abort' ? 'dg-red' : ''}`}>
        {text}
      </text>
    </g>
  );
  return (
    <svg className="dg" viewBox="0 0 760 452" role="img" aria-labelledby="dg-seq-title dg-seq-desc">
      <title id="dg-seq-title">Contrat prepareTime</title>
      <desc id="dg-seq-desc">
        L’utilisateur demande t1 ; le contrôleur place t1 en attente et appelle prepareTime. L’utilisateur demande t2 avant la fin : le signal de t1
        est annulé et isCurrent devient faux. prepareTime est appelée pour t2 ; l’application attend ses données et applique son état ; quand la
        promesse se résout, t2 est confirmé, l’événement time est émis et le curseur plein se déplace.
      </desc>
      <defs>
        <Arrow id="dg-seq-arrow" />
        <Arrow id="dg-seq-arrow-red" tone="red" />
      </defs>
      <rect x="0.5" y="0.5" width="759" height="451" rx="8" className="dg-panel" />
      {[
        [U, 'Utilisateur', 'clic, lecture, clé'],
        [C, 'Contrôleur', 'TimelineController'],
        [A, 'Votre application', 'prepareTime'],
      ].map(([x, title, sub]) => (
        <g key={title as string}>
          <rect x={(x as number) - 78} y="16" width="156" height="42" rx="6" className="dg-actor" />
          <text x={x as number} y="34" textAnchor="middle" className="dg-label dg-strong">
            {title}
          </text>
          <text x={x as number} y="50" textAnchor="middle" className="dg-mono dg-muted">
            {sub}
          </text>
          <line x1={x as number} y1="58" x2={x as number} y2="436" className="dg-lifeline" />
        </g>
      ))}
      {/* controller state: pending then confirmed */}
      <rect x={C - 6} y="88" width="12" height="282" rx="2" className="dg-act-pending" />
      <rect x={C - 6} y="370" width="12" height="52" rx="2" className="dg-act-ok" />
      <text x={C - 14} y="230" textAnchor="end" className="dg-label dg-yellow">
        en attente
      </text>
      <text x={C - 14} y="246" textAnchor="end" className="dg-mono dg-muted">
        snapshot.pending
      </text>
      {/* application activations */}
      <rect x={A - 5} y="138" width="10" height="56" rx="2" className="dg-act-cancel" />
      <rect x={A - 5} y="262" width="10" height="92" rx="2" className="dg-act-app" />

      {message(92, U, C - 6, 'seek(t₁)')}
      {message(140, C + 6, A - 5, 'prepareTime({ target: t₁, signal })')}
      {message(184, U, C - 6, 'seek(t₂)')}
      {message(214, C + 6, A - 5, 'signal.abort() · isCurrent() → false', 'abort')}
      {message(264, C + 6, A - 5, 'prepareTime({ target: t₂, signal })')}
      <text x={A - 14} y="292" textAnchor="end" className="dg-mono">
        await waitForData(t₂, signal)
      </text>
      <text x={A - 14} y="312" textAnchor="end" className="dg-mono">
        if (isCurrent()) appliquer(t₂)
      </text>
      {message(352, A - 5, C + 6, 'promesse résolue', 'return')}
      <rect x={C + 14} y="364" width="218" height="40" rx="6" className="dg-note-ok" />
      <text x={C + 24} y="381" className="dg-mono dg-green">
        time = t₂ (confirmé)
      </text>
      <text x={C + 24} y="397" className="dg-mono dg-green">
        émet on(&apos;time&apos;)
      </text>
      {message(418, C - 6, U, 'curseur plein à t₂', 'return')}
    </svg>
  );
}

/** Confirmed cursor versus pending target on an axis. */
export function CursorDiagram() {
  return (
    <svg className="dg" viewBox="0 0 760 118" role="img" aria-labelledby="dg-cursor-title">
      <title id="dg-cursor-title">Curseur confirmé (trait plein) et cible en attente (pointillé)</title>
      <rect x="0.5" y="0.5" width="759" height="117" rx="8" className="dg-panel" />
      <line x1="30" y1="40" x2="730" y2="40" className="dg-line" />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={30 + i * 100} y1="34" x2={30 + i * 100} y2="94" className="dg-grid" />
      ))}
      <rect x="30" y="56" width="700" height="24" className="dg-row-band" />
      <line x1="250" y1="30" x2="250" y2="96" className="dg-cursor" />
      <circle cx="250" cy="30" r="5" className="dg-fill-blue" />
      <text x="260" y="24" className="dg-label">
        <tspan className="dg-mono dg-blue">snapshot.time</tspan> — instant confirmé, l’application l’affiche
      </text>
      <line x1="520" y1="44" x2="520" y2="96" className="dg-pending" />
      <text x="740" y="110" textAnchor="end" className="dg-label">
        <tspan className="dg-mono dg-yellow">snapshot.pending.target</tspan> — en préparation
      </text>
      <path d="M262 68 H510" className="dg-measure" markerEnd="url(#dg-cursor-arrow)" />
      <defs>
        <Arrow id="dg-cursor-arrow" />
      </defs>
      <text x="386" y="62" textAnchor="middle" className="dg-mono dg-muted">
        prepareTime(request)
      </text>
    </svg>
  );
}

/** Who owns what: application data → controller → views, and the preparation loop back to the application. */
export function ArchitectureDiagram() {
  return (
    <svg className="dg" viewBox="0 0 760 236" role="img" aria-labelledby="dg-arch-title dg-arch-desc">
      <title id="dg-arch-title">Architecture</title>
      <desc id="dg-arch-desc">
        L’application fournit lignes, clés et éléments au contrôleur. Le contrôleur, sans React, possède le temps, le transport, la fenêtre et les
        données ; il publie des instantanés immuables lus par Timeline, PlaybackControls, TimelineOverview et vos composants. Avant chaque nouvelle
        position, il appelle prepareTime de l’application, qui confirme quand son état est prêt.
      </desc>
      <defs>
        <Arrow id="dg-arch-arrow" />
        <Arrow id="dg-arch-arrow-blue" tone="blue" />
      </defs>
      <rect x="0.5" y="0.5" width="759" height="235" rx="8" className="dg-panel" />
      {/* app */}
      <rect x="20" y="40" width="190" height="128" rx="8" className="dg-actor" />
      <text x="115" y="64" textAnchor="middle" className="dg-label dg-strong">
        Votre application
      </text>
      <text x="36" y="90" className="dg-mono dg-muted">
        rows · keys · source
      </text>
      <text x="36" y="110" className="dg-mono dg-muted">
        prepareTime(request)
      </text>
      <text x="36" y="130" className="dg-mono dg-muted">
        play(), seek(), goLive()…
      </text>
      <text x="36" y="150" className="dg-mono dg-muted">
        on(&apos;time&apos;, …)
      </text>
      {/* controller */}
      <rect x="285" y="40" width="190" height="128" rx="8" className="dg-core" />
      <text x="380" y="64" textAnchor="middle" className="dg-label dg-strong">
        TimelineController
      </text>
      <text x="380" y="82" textAnchor="middle" className="dg-mono dg-muted">
        @time-weave/react/core
      </text>
      <text x="301" y="108" className="dg-label">
        temps · transport · fenêtre
      </text>
      <text x="301" y="128" className="dg-label">
        lignes · données · clés
      </text>
      <text x="301" y="148" className="dg-mono dg-blue">
        getSnapshot() immuable
      </text>
      {/* views */}
      {['<Timeline />', '<PlaybackControls />', '<TimelineOverview />', 'useTimelineSelector'].map((label, index) => (
        <g key={label}>
          <rect x="560" y={36 + index * 34} width="180" height="26" rx="6" className="dg-view" />
          <text x="650" y={53 + index * 34} textAnchor="middle" className="dg-mono">
            {label}
          </text>
        </g>
      ))}
      <path d="M210 84 H279" className="dg-msg" markerEnd="url(#dg-arch-arrow)" />
      <text x="244" y="76" textAnchor="middle" className="dg-mono dg-muted">
        options
      </text>
      <path d="M285 124 H216" className="dg-msg dg-msg--blue" markerEnd="url(#dg-arch-arrow-blue)" />
      <text x="248" y="140" textAnchor="middle" className="dg-mono dg-blue">
        prépare
      </text>
      <path d="M475 104 H554" className="dg-msg" markerEnd="url(#dg-arch-arrow)" />
      <text x="514" y="96" textAnchor="middle" className="dg-mono dg-muted">
        subscribe
      </text>
      <path d="M620 166 C 600 204, 420 204, 392 174" className="dg-msg dg-msg--return" markerEnd="url(#dg-arch-arrow)" />
      <text x="506" y="222" textAnchor="middle" className="dg-mono dg-muted">
        gestes de l’utilisateur → commandes
      </text>
    </svg>
  );
}
