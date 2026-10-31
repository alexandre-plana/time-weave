/*
 * Time Weave — film de démonstration (60 s, 1920×1080).
 * Toute l'image est une fonction pure du temps : TW.render(ctx, t).
 * Aucune horloge, aucun état mutable entre deux images : le rendu est déterministe.
 */
'use strict';
(function () {
  const W = 1920, H = 1080, DURATION = 60;

  /* ───────────────────────── Outils ───────────────────────── */
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const inv = (a, b, v) => clamp((v - a) / (b - a));
  const explerp = (a, b, k) => Math.exp(lerp(Math.log(a), Math.log(b), k));
  const E = {
    lin: (k) => k,
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
    outQuart: (k) => 1 - Math.pow(1 - k, 4),
    outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
    inCubic: (k) => k * k * k,
  };
  const seg = (t, a, b, e = E.outCubic) => e(inv(a, b, t));
  const pulse = (t, a, d) => (t < a || t > a + d ? 0 : Math.sin(Math.PI * (t - a) / d));
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, k) { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; }
  function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }

  /* ───────────────────────── Thèmes ───────────────────────── */
  const LIGHT = {
    name: 'light', label: 'Clair', selector: '.tw-timeline', note: 'thème par défaut', dark: false,
    bg: '#F7F8FA', panel: '#FFFFFF', surface: '#F9FAFB', line: '#E6E9EE', grid: '#F0F2F5', gridMajor: '#E1E5EB',
    ink: '#222832', muted: '#646C79', faint: '#9AA1AD', accent: '#4772E9', accentSoft: '#EDF2FF', live: '#D9483B', liveSoft: '#FCEDEB',
    key: '#C08A22', shadow: 'rgba(34,40,60,0.07)', solid: '#222832', onSolid: '#FFFFFF', backdrop: 'rgba(30,36,48,0.28)', ok: '#2E8B57', okSoft: '#E8F5EE',
    radius: 6, pr: 14, cap: '#DCE0E7',
    tints: {
      blue: { bg: '#EDF4FF', bd: '#B9CFF0', ink: '#2F5D9B', dot: '#4772E9' },
      green: { bg: '#EAF6EF', bd: '#B3DCC3', ink: '#2D7650', dot: '#3E9C68' },
      amber: { bg: '#FBF3E2', bd: '#EACB8E', ink: '#87601A', dot: '#C8952F' },
      violet: { bg: '#F1EDF9', bd: '#CDBFE9', ink: '#5F4999', dot: '#8C74CF' },
    },
    map: { land: '#EEF1F5', block: '#E2E7EE', park: '#DCEEE2', water: '#D2E2F6', road: '#FFFFFF', edge: '#D3D9E2', label: '#98A0AC' },
  };
  const DARK = {
    name: 'dark', label: 'Sombre', selector: ".tw-timeline[data-theme='dark']", note: 'prop theme="dark"', dark: true,
    bg: '#0E1014', panel: '#15181D', surface: '#1B1F26', line: '#2A303A', grid: '#1C2027', gridMajor: '#2A303A',
    ink: '#E6E9EF', muted: '#8E97A6', faint: '#5F6774', accent: '#7B9CF5', accentSoft: '#232C45', live: '#E5574A', liveSoft: '#341D1C',
    key: '#E0B25B', shadow: 'rgba(0,0,0,0.35)', solid: '#E6E9EF', onSolid: '#15181D', backdrop: 'rgba(5,6,8,0.55)', ok: '#5CBF86', okSoft: '#1A3024',
    radius: 6, pr: 14, cap: '#0A0C0F',
    tints: {
      blue: { bg: '#1F2B40', bd: '#3A5684', ink: '#A9C4F1', dot: '#7B9CF5' },
      green: { bg: '#1A3024', bd: '#2F6A48', ink: '#9AD6B1', dot: '#5CBF86' },
      amber: { bg: '#362B16', bd: '#76592A', ink: '#E7C47E', dot: '#E0B25B' },
      violet: { bg: '#2A2440', bd: '#54478A', ink: '#C4B5EF', dot: '#A48FE0' },
    },
    map: { land: '#13161B', block: '#1A1E25', park: '#15241C', water: '#13233A', road: '#252A33', edge: '#2C323C', label: '#5F6774' },
  };
  const OCEAN = {
    name: 'ocean', label: 'Océan', selector: '.tw-timeline.theme-ocean', note: 'className="theme-ocean"', dark: true,
    bg: '#07141C', panel: '#0E2230', surface: '#122A3A', line: '#1E3B4D', grid: '#14303F', gridMajor: '#21404F',
    ink: '#E3F1F6', muted: '#8FB0C0', faint: '#5A7C8C', accent: '#2EC4B6', accentSoft: '#113A3E', live: '#FF6B5A', liveSoft: '#3A2226',
    key: '#F2C14E', shadow: 'rgba(0,0,0,0.4)', solid: '#E3F1F6', onSolid: '#0E2230', backdrop: 'rgba(2,9,14,0.6)', ok: '#4FD1A1', okSoft: '#11382E',
    radius: 11, pr: 18, cap: '#061019',
    tints: {
      blue: { bg: '#12344A', bd: '#27597A', ink: '#9ED4F0', dot: '#4FB3E8' },
      green: { bg: '#0F3A35', bd: '#21695C', ink: '#8FE3CC', dot: '#2EC4B6' },
      amber: { bg: '#3A3218', bd: '#7A6428', ink: '#F5D37E', dot: '#F2C14E' },
      violet: { bg: '#25294A', bd: '#484E86', ink: '#BFC3F5', dot: '#8E95EC' },
    },
    map: { land: '#0C1F2C', block: '#112838', park: '#0F3029', water: '#083646', road: '#1A394C', edge: '#22475C', label: '#5F8597' },
  };
  const PAPER = {
    name: 'papier', label: 'Papier', selector: '.tw-timeline.theme-papier', note: 'className="theme-papier"', dark: false,
    bg: '#F3EEE4', panel: '#FFFCF6', surface: '#F8F2E8', line: '#E3D8C7', grid: '#EFE6D8', gridMajor: '#E0D3BF',
    ink: '#2B2620', muted: '#76695A', faint: '#A3968A', accent: '#C2532F', accentSoft: '#F7E3D8', live: '#A8231B', liveSoft: '#F5DCD8',
    key: '#9A7B2F', shadow: 'rgba(70,50,20,0.08)', solid: '#2B2620', onSolid: '#FFFCF6', backdrop: 'rgba(40,30,20,0.3)', ok: '#4F7A3A', okSoft: '#E6EEDB',
    radius: 2, pr: 4, cap: '#E1D6C4',
    tints: {
      blue: { bg: '#E5EDEF', bd: '#B6CBD1', ink: '#2F5866', dot: '#3F7A8C' },
      green: { bg: '#E9EFDC', bd: '#C1D2A3', ink: '#4A6327', dot: '#6B8F3A' },
      amber: { bg: '#F6EAD1', bd: '#E1C38A', ink: '#7A5A16', dot: '#B8862B' },
      violet: { bg: '#F1E5EB', bd: '#D8BDCA', ink: '#7A3E5A', dot: '#A35A7C' },
    },
    map: { land: '#EEE6D7', block: '#E5DAC8', park: '#DCE2C6', water: '#CCDBDD', road: '#FBF7EF', edge: '#D9CBB6', label: '#9B8E7C' },
  };
  let T = LIGHT;

  const FI = (w, s) => `${w} ${s}px Inter`;
  const FM = (w, s) => `${w} ${s}px "IBM Plex Mono"`;

  /* ───────────────────────── Dessin ───────────────────────── */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); }
  function txt(ctx, s, x, y, o = {}) {
    ctx.font = o.font || FI(400, 14); ctx.fillStyle = o.color || T.ink; ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'middle'; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
  }
  function tw(ctx, s, font, ls = 0) { ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }
  function fit(ctx, s, maxW, font) {
    ctx.font = font; if (ctx.measureText(s).width <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
    return lo >= 4 ? s.slice(0, lo) + '…' : '';
  }
  let HAIR = 1;
  function hl(ctx, x0, x1, y, c, w = HAIR) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  function vl(ctx, x, y0, y1, c, w = HAIR) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  function alpha(ctx, a, fn) { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= a; fn(); ctx.restore(); }
  function diamond(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
  function chip(ctx, x, y, label, o = {}) {
    const font = o.font || FI(600, 12); const pad = o.icon ? 30 : 12; const w = tw(ctx, label, font) + pad + 12; const h = o.h || 26;
    const X0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(ctx, X0, y - h / 2, w, h, Math.min(h / 2, (o.r ?? T.radius * 2 + 1))); ctx.fillStyle = o.bg || T.panel; ctx.fill();
    if (o.bd) { ctx.strokeStyle = o.bd; ctx.lineWidth = 1; ctx.stroke(); }
    if (o.icon) o.icon(X0 + 15, y);
    txt(ctx, label, X0 + pad, y + 0.5, { font, color: o.color || T.ink });
    return w;
  }

  /* ───────────────────────── Temps ───────────────────────── */
  const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR, MONTH = 30.44 * DAY, YEAR = 365.25 * DAY;
  const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function clock(t, ms = false) {
    const d = new Date(Math.floor(t));
    let s = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    if (ms) s += '.' + pad(d.getUTCMilliseconds(), 3);
    return s;
  }
  const hm = (t) => { const d = new Date(Math.floor(t)); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const dayLabel = (t) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
  const frNum = (v, dec) => v.toFixed(dec).replace('.', ',');
  function spanLabel(span) {
    if (span < SEC) return `${Math.round(span)} ms`;
    if (span < MIN) return `${frNum(span / SEC, span < 10 * SEC ? 1 : 0)} s`;
    if (span < HOUR) return `${Math.round(span / MIN)} min`;
    if (span < 2 * DAY) return `${frNum(span / HOUR, span < 10 * HOUR ? 1 : 0).replace(',0', '')} h`;
    if (span < 62 * DAY) return `${Math.round(span / DAY)} jours`;
    if (span < 2 * YEAR) return `${Math.round(span / MONTH)} mois`;
    return `${Math.round(span / YEAR)} ans`;
  }
  const STEPS = [
    [1, 'ms'], [2, 'ms'], [5, 'ms'], [10, 'ms'], [20, 'ms'], [50, 'ms'], [100, 'ms'], [200, 'ms'], [500, 'ms'],
    [SEC, 's'], [2 * SEC, 's'], [5 * SEC, 's'], [10 * SEC, 's'], [15 * SEC, 's'], [30 * SEC, 's'],
    [MIN, 'min'], [2 * MIN, 'min'], [5 * MIN, 'min'], [10 * MIN, 'min'], [15 * MIN, 'min'], [30 * MIN, 'min'],
    [HOUR, 'h'], [2 * HOUR, 'h'], [3 * HOUR, 'h'], [6 * HOUR, 'h'], [12 * HOUR, 'h'],
    [DAY, 'd'], [2 * DAY, 'd'], [7 * DAY, 'd'], [MONTH, 'mo', 1], [3 * MONTH, 'mo', 3], [6 * MONTH, 'mo', 6],
    [YEAR, 'y', 1], [2 * YEAR, 'y', 2], [5 * YEAR, 'y', 5], [10 * YEAR, 'y', 10], [20 * YEAR, 'y', 20], [50 * YEAR, 'y', 50], [100 * YEAR, 'y', 100],
  ];
  function tickTimes(step, s, e) {
    const [ms, unit, n] = step; const out = [];
    if (unit === 'mo' || unit === 'y') {
      const d = new Date(s); let y = d.getUTCFullYear(), m = unit === 'y' ? 0 : d.getUTCMonth();
      if (unit === 'y') y = Math.floor(y / n) * n; else m = Math.floor(m / n) * n;
      const inc = unit === 'y' ? 12 * n : n;
      for (let g = 0; g < 400; g++) { const t = Date.UTC(y, m, 1); if (t > e) break; if (t >= s) out.push(t); m += inc; while (m >= 12) { m -= 12; y++; } }
      return out;
    }
    const first = Math.ceil(s / ms) * ms;
    for (let t = first, g = 0; t <= e && g < 400; t += ms, g++) out.push(t);
    return out;
  }
  function tickLabel(t, unit) {
    const d = new Date(t);
    switch (unit) {
      case 'ms': return clock(t, true);
      case 's': return clock(t);
      case 'min': case 'h': return hm(t);
      case 'd': return dayLabel(t);
      case 'mo': return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      default: return String(d.getUTCFullYear());
    }
  }
  const LABEL_SAMPLE = { ms: '00:00:00.000', s: '00:00:00', min: '00:00', h: '00:00', d: '28 sept.', mo: 'sept. 2026', y: '2026' };

  /* ───────────────────────── Données : opérations (chapitres 01–02) ───────────────────────── */
  const U = (h, m = 0, s = 0, ms = 0) => Date.UTC(2026, 9, 18, h, m, s, ms);
  const T0 = U(12, 34, 56, 789);
  const DAY_VIEW = [U(12), U(15)];
  const KEYS = [U(12, 18), U(12, 52), U(13, 24), U(13, 57), U(14, 28)];

  const ROWS = [
    { id: 'conn', label: 'Connecteurs', depth: 0, tint: 'green', kids: true },
    { id: 'mqtt', label: 'Réseau MQTT', depth: 1, tint: 'green', kids: true },
    { id: 'tmp', label: 'TMP-001 · Température', depth: 2, tint: 'blue' },
    { id: 'prs', label: 'PRS-002 · Pression', depth: 2, tint: 'blue' },
    { id: 'sta', label: 'STA-003 · Statut', depth: 2, tint: 'green' },
    { id: 'lora', label: 'Réseau LoRa', depth: 1, tint: 'violet', kids: true },
    { id: 'lrl', label: 'LRL-004 · Trames', depth: 2, tint: 'violet' },
    { id: 'proc', label: 'Traitements', depth: 0, tint: 'violet' },
    { id: 'inc', label: 'Incidents & alertes', depth: 0, tint: 'amber' },
  ];
  function ranges(seed, from, to, dMin, dMax, gMin, gMax, label) {
    const r = rng(seed), out = []; let t = from + r() * gMax, i = 0;
    while (t < to) { const d = lerp(dMin, dMax, r()); out.push({ t0: t, t1: t + d, label: typeof label === 'function' ? label(i, r) : label }); t += d + lerp(gMin, gMax, r()); i++; }
    return out;
  }
  function points(seed, from, to, gMin, gMax, label) {
    const r = rng(seed), out = []; let t = from + r() * gMax, i = 0;
    while (t < to) { out.push({ t0: t, label: typeof label === 'function' ? label(i, r) : label, i }); t += lerp(gMin, gMax, r()); i++; }
    return out;
  }
  const DATA = {
    conn: ranges(11, U(10, 30), U(16), 38 * MIN, 55 * MIN, 3 * MIN, 6 * MIN, 'Acquisition continue'),
    mqtt: ranges(12, U(10, 30), U(16), 18 * MIN, 24 * MIN, 2 * MIN, 5 * MIN, (i) => `Cycle ${pad(i + 1)}`),
    tmp: ranges(13, U(10, 30), U(16), 6 * MIN, 8 * MIN, 5 * MIN, 9 * MIN, 'Mesure'),
    prs: ranges(14, U(10, 30), U(16), 5 * MIN, 7 * MIN, 9 * MIN, 14 * MIN, 'Mesure'),
    sta: ranges(15, U(10, 30), U(16), 10 * MIN, 18 * MIN, 6 * MIN, 12 * MIN, (i) => (i % 2 ? 'Synchronisation' : 'Connexion')),
    lora: ranges(16, U(10, 30), U(16), 22 * MIN, 30 * MIN, 8 * MIN, 14 * MIN, 'Fenêtre radio'),
    lrl: ranges(17, U(10, 30), U(16), 4 * MIN, 6 * MIN, 4 * MIN, 7 * MIN, 'Trame'),
    proc: ranges(18, U(10, 30), U(16), 18 * MIN, 30 * MIN, 10 * MIN, 20 * MIN, (i) => ['Agrégation', 'Normalisation', 'Export des mesures'][i % 3]),
    inc: points(19, U(10, 30), U(16), 24 * MIN, 42 * MIN, (i) => ['Latence élevée', 'Reconnexion', 'Seuil dépassé'][i % 3]),
  };

  // Événements à toutes les échelles autour de T0, pour le zoom continu.
  const LEVELS = [36, 380, 4 * SEC, 40 * SEC, 6 * MIN, HOUR, 10 * HOUR, 4 * DAY, 40 * DAY, YEAR, 10 * YEAR, 90 * YEAR];
  const VOCAB = { conn: 'Session', mqtt: 'Paquet', tmp: 'Mesure', prs: 'Mesure', sta: 'Ping', lora: 'Fenêtre', lrl: 'Trame', proc: 'Calcul', inc: 'Alerte' };
  const FRACTAL = {};
  ROWS.forEach((row, ri) => {
    const r = rng(101 + ri * 17), ev = [];
    const dens = [1.1, 1.0, 1.25, 0.9, 0.8, 0.85, 1.15, 0.7, 0.45][ri];
    LEVELS.forEach((I) => { const k = Math.max(2, Math.round((5 + r() * 7) * dens)); for (let i = 0; i < k; i++) ev.push(T0 + (r() - 0.5) * I); });
    ev.sort((a, b) => a - b);
    FRACTAL[row.id] = ev;
  });

  /* ───────────────────────── Données : intervention et flotte (chapitres 03–07) ───────────────────────── */
  const RV = [U(14, 0), U(14, 22)], RSPAN = RV[1] - RV[0], RC = (RV[0] + RV[1]) / 2, R_START = U(14, 2);
  const FKEYS = [U(14, 3, 10), U(14, 5, 40), U(14, 11, 20), U(14, 16, 50)];
  const FKEY_LABELS = ['Appel reçu', 'Unités engagées', 'Arrivée sur place', 'Zone sécurisée'];
  const FROWS = [
    { id: 'units', label: 'Unités', depth: 0, tint: 'blue', kids: true },
    { id: 'p12', label: 'P-12 · Patrouille', depth: 1, tint: 'blue' },
    { id: 'a03', label: 'A-03 · Ambulance', depth: 1, tint: 'green' },
    { id: 'd07', label: 'D-07 · Drone', depth: 1, tint: 'violet' },
    { id: 'gps', label: 'Positions GPS', depth: 1, tint: 'blue' },
    { id: 'comms', label: 'Communications', depth: 0, tint: 'violet', kids: true },
    { id: 'calls', label: 'Appels 112', depth: 1, tint: 'amber' },
    { id: 'radio', label: 'Radio', depth: 1, tint: 'violet' },
    { id: 'alerts', label: 'Alertes', depth: 0, tint: 'amber' },
  ];
  const seqR = (list) => list.map(([a, b, label]) => ({ t0: a, t1: b, label }));
  const FDATA = {
    units: seqR([[U(14, 3, 10), U(14, 18, 30), 'Intervention #2418'], [U(14, 31), U(15, 40), 'Patrouille de secteur']]),
    p12: seqR([[U(13, 40), U(14, 5, 40), 'Disponible'], [U(14, 5, 40), U(14, 11, 20), 'En route'], [U(14, 11, 20), U(14, 18), 'Sur place'], [U(14, 18), U(15, 40), 'Patrouille']]),
    a03: seqR([[U(13, 40), U(14, 6, 30), 'Disponible'], [U(14, 6, 30), U(14, 12, 40), 'En route'], [U(14, 12, 40), U(14, 17), 'Prise en charge'], [U(14, 17), U(14, 21), 'Retour'],
      [U(14, 21), U(14, 41), 'Disponible'], [U(14, 41), U(14, 47), 'Transport'], [U(14, 47), U(14, 56), 'À l’hôpital'], [U(14, 56), U(15, 2), 'Retour'], [U(15, 2), U(15, 40), 'Disponible']]),
    d07: seqR([[U(13, 40), U(14, 4, 30), 'Au sol'], [U(14, 4, 30), U(14, 5, 30), 'Décollage'], [U(14, 5, 30), U(14, 16), 'Survol'], [U(14, 16), U(14, 18), 'Retour'], [U(14, 18), U(14, 35), 'Au sol'], [U(14, 35), U(15, 40), 'Ronde']]),
    gps: (() => { const r = rng(55), out = []; for (let t = U(13, 40); t < U(15, 40); t += 2 * MIN) out.push({ t0: t + 6 * SEC, t1: t + 2 * MIN - 6 * SEC, group: 16 + Math.floor(r() * 8) }); return out; })(),
    comms: seqR([[U(14, 3, 10), U(14, 19), 'Canal TAC-2'], [U(14, 30), U(15, 40), 'Canal TAC-2']]),
    calls: [{ t0: U(14, 3, 10), label: 'Appel 112' }, { t0: U(14, 7, 50), label: 'Rappel témoin' }, ...points(61, U(14, 31), U(15, 40), 4 * MIN, 7 * MIN, 'Appel 112')],
    radio: [
      { t0: U(14, 5, 30), label: 'Engagement P-12', unit: 'p12' }, { t0: U(14, 6, 20), label: 'Départ A-03', unit: 'a03' },
      { t0: U(14, 11, 15), label: 'Arrivée sur zone', unit: 'p12' }, { t0: U(14, 14), label: 'Point de situation', unit: 'p12' }, { t0: U(14, 17, 40), label: 'Fin d’intervention', unit: 'p12' },
      ...points(62, U(14, 30), U(15, 40), 50 * SEC, 110 * SEC, (i) => ['Point de situation', 'Position confirmée', 'Demande d’info', 'RAS'][i % 4]).map((p) => ({ ...p, unit: ['p12', 'a03', 'd07'][p.i % 3] })),
    ],
    alerts: [{ t0: U(14, 3, 10), label: 'Collision signalée' }, { t0: U(14, 8, 30), label: 'Trafic bloqué' }, { t0: U(14, 16, 50), label: 'Zone sécurisée' },
      ...points(63, U(14, 33), U(15, 40), 5 * MIN, 8 * MIN, (i) => ['Ralentissement', 'Accès dégagé'][i % 2])],
  };
  for (const k in FDATA) FDATA[k].sort((a, b) => a.t0 - b.t0);
  const DS_OPS = { rows: ROWS, data: DATA, keys: KEYS, fractal: true };
  const DS_FLEET = { rows: FROWS, data: FDATA, keys: FKEYS, fractal: false };

  /* ───────────────────────── Carte : positions des unités ───────────────────────── */
  const ROAD_X = [90, 260, 440, 620, 800, 960], ROAD_Y = [90, 250, 420, 590, 720];
  const INC = [620, 250], BASE_P = [260, 590], HOSP = [800, 90], DBASE = [90, 90];
  function along(path, k) {
    const seg2 = []; let total = 0;
    for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg2.push(l); total += l; }
    let d = clamp(k) * total;
    for (let i = 0; i < seg2.length; i++) { if (d <= seg2[i] || i === seg2.length - 1) { const u = seg2[i] ? clamp(d / seg2[i]) : 0; return [lerp(path[i][0], path[i + 1][0], u), lerp(path[i][1], path[i + 1][1], u)]; } d -= seg2[i]; }
    return path[path.length - 1];
  }
  function legs(list, t) {
    let p = list[0].path[0];
    for (const lg of list) { if (t < lg.a) return p; if (t <= lg.b) return along(lg.path, (lg.e || E.inOutSine)((t - lg.a) / (lg.b - lg.a))); p = lg.path[lg.path.length - 1]; }
    return p;
  }
  const P12_LEGS = [{ a: U(14, 5, 40), b: U(14, 11, 20), path: [BASE_P, [440, 590], [440, 250], [604, 250]] }];
  const P12_LOOP = [[604, 250], [800, 250], [800, 420], [440, 420], [440, 250], [604, 250]];
  const A03_LEGS = [
    { a: U(14, 6, 30), b: U(14, 12, 40), path: [HOSP, [800, 250], [636, 256]] }, { a: U(14, 17), b: U(14, 21), path: [[636, 256], [800, 250], HOSP] },
    { a: U(14, 41), b: U(14, 47), path: [HOSP, [800, 420], [440, 420], [260, 420]] }, { a: U(14, 56), b: U(15, 2), path: [[260, 420], [440, 420], [800, 420], HOSP] },
  ];
  function posAt(unit, t) {
    if (unit === 'p12') {
      if (t < U(14, 18)) return legs(P12_LEGS, t);
      return along(P12_LOOP, ((t - U(14, 18)) / (9 * MIN)) % 1);
    }
    if (unit === 'a03') return legs(A03_LEGS, t);
    // drone
    const orbit = (tt) => { const a = Math.PI + (tt - U(14, 5, 30)) / (90 * SEC) * Math.PI * 2; return [INC[0] + Math.cos(a) * 42, INC[1] + Math.sin(a) * 42]; };
    if (t < U(14, 5, 30)) return legs([{ a: U(14, 4, 30), b: U(14, 5, 30), path: [DBASE, [578, 250]] }], t);
    if (t < U(14, 16)) return orbit(t);
    if (t < U(14, 35)) return legs([{ a: U(14, 16), b: U(14, 18), path: [orbit(U(14, 16)), DBASE] }], t);
    const E0 = [500 - 330, 400];
    if (t < U(14, 36, 30)) return legs([{ a: U(14, 35), b: U(14, 36, 30), path: [DBASE, E0] }], t);
    const a = Math.PI + (t - U(14, 36, 30)) / (5 * MIN) * Math.PI * 2; return [500 + Math.cos(a) * 330, 400 + Math.sin(a) * 230];
  }
  const UNITS = [{ id: 'p12', name: 'P-12', label: 'Patrouille', tint: 'blue', off: [-14, 22, 'right'] }, { id: 'a03', name: 'A-03', label: 'Ambulance', tint: 'green', off: [14, 22, 'left'] }, { id: 'd07', name: 'D-07', label: 'Drone', tint: 'violet', drone: true, off: [16, -20, 'left'] }];
  const latLon = (p) => `${frNum(48.8712 - p[1] * 0.000041, 4)}° N · ${frNum(2.3305 + p[0] * 0.000062, 4)}° E`;

  /* ───────────────────────── Mise en page ───────────────────────── */
  const TB = 56, AX = 44, RH = 54, FT = 40;
  const PANEL_H = TB + AX + RH * ROWS.length + FT;
  const PANEL_Y = 196;
  function panelLayout(t) {
    const split = seg(t, 21.0, 21.8, E.inOutCubic);
    return { x: 120, y: PANEL_Y, w: lerp(1680, 980, split), h: PANEL_H, labelW: lerp(318, 262, split), split };
  }
  const MAP = { x: 1124, y: PANEL_Y, w: 676, h: PANEL_H };
  const plotOf = (L) => ({ x0: L.x + L.labelW, w: L.w - L.labelW, top: L.y + TB, rowsTop: L.y + TB + AX, bottom: L.y + L.h - FT });

  function hierarchy(t) {
    const v = { conn: 1, proc: 1, inc: 1 };
    v.mqtt = seg(t, 8.55, 9.05); v.lora = seg(t, 8.65, 9.15);
    v.tmp = seg(t, 9.35, 9.85); v.prs = seg(t, 9.45, 9.95); v.sta = seg(t, 9.55, 10.05);
    v.lrl = seg(t, 10.2, 10.7);
    const chev = { conn: seg(t, 8.42, 8.72), mqtt: seg(t, 9.22, 9.52), lora: seg(t, 10.07, 10.37) };
    return { vis: v, chev };
  }
  function fleetHierarchy(t) {
    const fold = seg(t, 53.0, 53.7, E.inOutCubic); const v = {}, chev = { units: 1 - fold, comms: 1 - fold };
    for (const r of FROWS) v[r.id] = r.depth > 0 ? 1 - fold : 1;
    return { vis: v, chev };
  }
  function rowsLayout(L, rows, vis) {
    const P = plotOf(L); let y = P.rowsTop; const out = {};
    for (const r of rows) { const v = vis[r.id] ?? 1; out[r.id] = { y, h: RH * v, v }; y += RH * v; }
    return out;
  }

  /* ───────────────────────── Scénario temporel ───────────────────────── */
  const ZD = 3 * HOUR, A0 = (T0 - DAY_VIEW[0]) / ZD;
  const ZMS1 = 27, ZMS2 = 23, ZY1 = 42 * YEAR, ZY2 = 46 * YEAR;
  function zoomView(t) {
    const around = (span, a) => ({ view: [T0 - a * span, T0 + (1 - a) * span], cursor: T0, span });
    if (t < 12) return around(ZD, A0);
    if (t < 13.6) { const k = E.inOutCubic(inv(12, 13.6, t)); return around(explerp(ZD, ZMS1, k), lerp(A0, 0.5, k)); }
    if (t < 14.3) return around(explerp(ZMS1, ZMS2, E.inOutSine(inv(13.6, 14.3, t))), 0.5);
    if (t < 19.4) return around(explerp(ZMS2, ZY1, E.inOutSine(inv(14.3, 19.4, t))), 0.5);
    if (t < 20) return around(explerp(ZY1, ZY2, inv(19.4, 20, t)), 0.5);
    const k = E.inOutCubic(inv(20, 21.2, t)); const span = explerp(ZY2, RSPAN, k); const c = lerp(T0, RC, k);
    return { view: [c - span / 2, c + span / 2], cursor: lerp(T0, R_START, k), span };
  }

  // 03 Rejeu (20 → 30)
  const RR = 2 * MIN, RR3 = 6 * MIN;
  const SR = { play: 2.2, jumps: [[3.4, 1], [4.0, 2], [4.6, 3]], loop: 5.1, fast: 5.6, pause: 9.3 };
  function sceneR(τ) {
    const r = { c: R_START, playing: false, speed: '1×', loop: τ >= SR.loop + 0.04, wrapAt: null };
    if (τ < SR.play) return r;
    r.playing = τ < SR.pause;
    const tt = Math.min(τ, SR.pause);
    let c = R_START, last = SR.play;
    for (const [jt, ki] of SR.jumps) {
      if (tt < jt) { r.c = c + (tt - last) * RR; return r; }
      const from = c + (jt - last) * RR, to = FKEYS[ki]; c = to; last = jt;
      if (tt < jt + 0.36) { r.c = lerp(from, to + (tt - jt) * RR, E.outQuart((tt - jt) / 0.36)); return r; }
    }
    if (tt < SR.fast) { r.c = c + (tt - last) * RR; return r; }
    c += (SR.fast - last) * RR; r.speed = '3×';
    r.wrapAt = SR.fast + (RV[1] - c) / RR3;
    let p = c + (tt - SR.fast) * RR3; if (p >= RV[1]) p = RV[0] + (p - RV[1]);
    r.c = p; return r;
  }
  const P_PAUSE = sceneR(SR.pause).c;
  // 04 Synchronisation (30 → 37)
  const G = U(14, 12, 30);
  function sceneS(τ) {
    const r = { c: P_PAUSE, playing: false, pending: null, pendingA: 0, waiting: false };
    if (τ < 2.7) r.c = P_PAUSE;
    else if (τ < 3.8) r.c = lerp(P_PAUSE, G, E.outQuart(inv(2.7, 3.06, τ)));
    else if (τ < 4.8) { r.c = G + (τ - 3.8) * RR; r.playing = true; }
    else if (τ < 5.6) { r.c = G + RR; r.playing = true; r.waiting = true; }
    else { r.c = G + RR + (τ - 5.6) * RR; r.playing = true; }
    if (τ >= 1.0 && τ < 3.1) { r.pending = G; r.pendingA = seg(τ, 1.0, 1.25) * (1 - seg(τ, 2.7, 3.06)); r.waiting = τ < 2.7; }
    if (τ >= 4.8 && τ < 5.75) { r.pending = G + RR + 40 * SEC; r.pendingA = seg(τ, 4.8, 5.0) * (1 - seg(τ, 5.55, 5.72)); }
    return r;
  }
  const SYNC_LOAD = (τ) => (τ >= 1.3 && τ < 2.7) || (τ >= 4.9 && τ < 5.6);
  // 05 Direct (37 → 44) et suite
  const LIVE0 = U(14, 52), LSP = 30 * SEC, SPAN_L = 15 * MIN;
  const liveNow = (t) => LIVE0 + (t - 37) * LSP;
  const follow = (n) => [n - 0.82 * SPAN_L, n + 0.18 * SPAN_L];
  const DIRECT_ON = 37.6, DRAG0 = 39.5, DRAG1 = 40.3, HIST = 40.9, BACK = 42.4;
  const PLOT_S = plotOf(panelLayout(40));
  const DRAG_PX = 520, DRAG_X0 = PLOT_S.x0 + 100, HIST_X = PLOT_S.x0 + 300;
  const DRAG_DT = DRAG_PX / PLOT_S.w * SPAN_L;
  const FIXED_VIEW = follow(liveNow(DRAG0)).map((v) => v - DRAG_DT);
  const HIST_T = FIXED_VIEW[0] + (HIST_X - PLOT_S.x0) / PLOT_S.w * SPAN_L;
  const C_PRE = (t) => G + RR + (t - 35.6) * RR;

  function liveState(t) {
    const n = liveNow(t);
    const r = { view: RV.slice(), c: C_PRE(t), now: null, state: 0, redK: 0, playing: true };
    if (t < DIRECT_ON) return r;
    r.now = n; r.state = 1;
    const fv = follow(n);
    if (t < DRAG0) {
      const k = E.inOutCubic(inv(DIRECT_ON, DIRECT_ON + 1.0, t));
      r.view = [lerp(RV[0], fv[0], k), lerp(RV[1], fv[1], k)]; r.c = lerp(C_PRE(t), n, k); r.redK = k; return r;
    }
    if (t < BACK) {
      const base = follow(liveNow(DRAG0)); const off = seg(t, DRAG0, DRAG1, E.inOutCubic) * DRAG_DT;
      r.view = [base[0] - off, base[1] - off];
      const frozen = liveNow(DRAG0);
      r.c = t < HIST ? frozen : lerp(frozen, HIST_T, E.outQuart(inv(HIST, HIST + 0.38, t)));
      r.state = t < DRAG0 + 0.12 ? 1 : 2; r.redK = 1 - seg(t, DRAG0, DRAG0 + 0.3); r.playing = false; return r;
    }
    const k = E.inOutCubic(inv(BACK, BACK + 0.9, t));
    r.view = [lerp(FIXED_VIEW[0], fv[0], k), lerp(FIXED_VIEW[1], fv[1], k)];
    r.c = lerp(HIST_T, n, k); r.redK = seg(t, BACK, BACK + 0.9); r.state = 1; return r;
  }

  /* Thèmes : enchaînement et transitions (volet suivant le trait bleu) */
  const THEME_SEQ = [
    { t: -1, d: 0, th: LIGHT }, { t: 44.55, d: 0.7, th: DARK }, { t: 45.65, d: 0.7, th: OCEAN }, { t: 46.75, d: 0.7, th: PAPER },
    { t: 53.25, d: 0.8, th: LIGHT, fade: true },
  ];

  /* Clics du pointeur */
  const CLICKS = [
    { t: 8.5, target: 'chev' }, { t: 9.3, target: 'chev' }, { t: 10.15, target: 'chev' },
    { t: 22.2, target: 'play' }, { t: 23.4, target: 'next' }, { t: 24.0, target: 'next' }, { t: 24.6, target: 'next' },
    { t: 25.1, target: 'loop' }, { t: 25.6, target: 'speed' }, { t: 29.3, target: 'play' },
    { t: 31.0, target: 'plot' }, { t: 33.8, target: 'play' },
    { t: DIRECT_ON, target: 'live' }, { t: DRAG0, target: 'drag' }, { t: HIST, target: 'plot' }, { t: BACK, target: 'live' },
    { t: 44.45, target: 'theme' }, { t: 45.55, target: 'theme' }, { t: 46.65, target: 'theme' },
  ];
  const KEYSTROKES = [
    { t: 48.9, k: 'Tab', d: 'Focus sur les éléments' },
    { t: 49.35, k: '←', d: 'Élément précédent' },
    { t: 49.8, k: '←', d: 'Élément précédent' },
    { t: 50.3, k: 'Entrée', d: 'Ouvrir la fenêtre de détail' },
    { t: 51.2, k: 'Tab', d: 'Action suivante' },
    { t: 52.1, k: 'Échap', d: 'Fermer la fenêtre' },
  ];
  const MODAL_OPEN = 50.3, MODAL_CLOSE = 52.1;
  const FOCUS = (() => {
    const n0 = liveNow(48.9); const idx = FDATA.radio.map((it, i) => [it, i]).filter(([it]) => it.t0 < n0 - 30 * SEC).map(([, i]) => i);
    const p = idx.slice(-3).reverse();
    return [{ t: 48.9, row: 'radio', i: p[0] }, { t: 49.35, row: 'radio', i: p[1] }, { t: 49.8, row: 'radio', i: p[2] }];
  })();
  const MODAL_ITEM = FDATA.radio[FOCUS[2].i];

  /* ───────────────────────── État de la timeline ───────────────────────── */
  function recentClick(t, target, d = 0.28) { for (const c of CLICKS) if (c.target === target && t >= c.t && t < c.t + d) return (t - c.t) / d; return null; }

  function tlState(t) {
    const S = {
      view: DAY_VIEW.slice(), cursor: T0, cursorA: 1, redK: 0, dsK: seg(t, 20.45, 21.05, E.inOutCubic),
      ops: hierarchy(t), fleet: fleetHierarchy(t),
      dayA: 1, fracA: 0, now: null, keysOpsA: 1 - seg(t, 12.05, 12.5), keysFleetA: seg(t, 21.0, 21.6) * (1 - seg(t, DIRECT_ON, DIRECT_ON + 0.5)), itemsA: seg(t, 6.5, 7.9),
      playing: false, loop: false, speed: '1×', status: 'En pause', liveState: 0, pending: null, pendingA: 0, waiting: false,
      handleFmt: 'clock', focus: null, ghost: null, wrapK: 0, keyPulse: [], mode: 'ops',
    };
    if (t >= 12 && t < 21.2) {
      const z = zoomView(t); S.view = z.view; S.cursor = z.cursor;
      S.fracA = seg(t, 12.55, 13.25) * (1 - seg(t, 20.35, 20.9));
      S.dayA = 1 - seg(t, 12.15, 12.85);
      S.handleFmt = z.span < 2 * MIN ? 'ms' : z.span < 2 * DAY ? 'clock' : z.span < 400 * DAY ? 'day' : 'year';
      S.status = 'Zoom';
    }
    if (t >= 20) S.mode = 'fleet';
    if (t >= 21.2 && t < 30) {
      const s = sceneR(t - 20); S.view = RV.slice(); S.cursor = s.c; S.playing = s.playing; S.speed = s.speed; S.loop = s.loop;
      S.status = S.playing ? (s.loop ? 'Rejeu · boucle' : 'Rejeu') : 'Rejeu · pause';
      if (s.wrapAt != null) { const w = t - 20 - s.wrapAt; if (w >= 0 && w < 1.0) { S.wrapK = w; S.ghost = { t: RV[1], a: 1 - w / 0.45 }; } }
      for (const [jt, ki] of SR.jumps) { const d = t - 20 - jt; if (d >= 0 && d < 1.1) S.keyPulse.push({ i: ki, k: d / 1.1 }); }
    }
    if (t >= 30 && t < 37) {
      const s = sceneS(t - 30); S.view = RV.slice(); S.cursor = s.c; S.playing = s.playing; S.loop = true; S.pending = s.pending; S.pendingA = s.pendingA; S.waiting = s.waiting;
      S.status = s.waiting ? 'En attente de l’application' : s.playing ? 'Rejeu · boucle' : 'En pause';
    }
    if (t >= 37) {
      const s = liveState(t); S.view = s.view; S.cursor = s.c; S.now = s.now; S.liveState = s.state; S.redK = s.redK; S.playing = s.playing;
      S.loop = t < DIRECT_ON; S.status = s.state === 1 ? 'Direct' : s.state === 2 ? 'Historique' : 'Rejeu · boucle';
      if (t >= 48.8 && t < 53) {
        let f = null;
        for (let i = 0; i < FOCUS.length; i++) if (t >= FOCUS[i].t) f = { cur: FOCUS[i], prev: FOCUS[i - 1] || null, k: E.outCubic(inv(FOCUS[i].t, FOCUS[i].t + 0.2, t)) };
        if (f) S.focus = { ...f, a: seg(t, 48.9, 49.1) * (1 - seg(t, 52.4, 52.9)) };
      }
    }
    S.datasets = [
      { ds: DS_OPS, a: 1 - S.dsK, vis: S.ops.vis, chev: S.ops.chev, keysA: S.keysOpsA },
      { ds: DS_FLEET, a: S.dsK, vis: S.fleet.vis, chev: S.fleet.chev, keysA: S.keysFleetA },
    ];
    return S;
  }

  /* ───────────────────────── Icônes ───────────────────────── */
  function icon(ctx, name, x, y, color, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.7 / s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    switch (name) {
      case 'stop': ctx.roundRect(-5, -5, 10, 10, 2); ctx.fill(); break;
      case 'play': ctx.moveTo(-4, -6.5); ctx.lineTo(7, 0); ctx.lineTo(-4, 6.5); ctx.closePath(); ctx.fill(); break;
      case 'pause': ctx.roundRect(-5.5, -6, 4, 12, 1.2); ctx.roundRect(1.5, -6, 4, 12, 1.2); ctx.fill(); break;
      case 'prev': ctx.moveTo(-6, -6); ctx.lineTo(-6, 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(-2.5, 0); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill(); break;
      case 'next': ctx.moveTo(6, -6); ctx.lineTo(6, 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(2.5, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); break;
      case 'loop': ctx.arc(0, 0, 6.5, -Math.PI * 0.15, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(6.6, -6.2); ctx.lineTo(6.4, -1.3); ctx.lineTo(1.7, -2.2); ctx.stroke(); break;
      case 'minus': ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); break;
      case 'plus': ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke(); break;
      case 'sun': ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * 6.3, Math.sin(a) * 6.3); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } ctx.stroke(); break;
      case 'palette': ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.stroke(); for (const [px, py] of [[-3, -3], [2.5, -3.5], [4, 1.5]]) { ctx.beginPath(); ctx.arc(px, py, 1.4, 0, Math.PI * 2); ctx.fill(); } break;
      case 'check': ctx.moveTo(-4.5, 0.5); ctx.lineTo(-1.2, 3.8); ctx.lineTo(5, -3.5); ctx.stroke(); break;
      case 'close': ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke(); break;
      case 'chev': ctx.moveTo(-2.5, -5); ctx.lineTo(2.5, 0); ctx.lineTo(-2.5, 5); ctx.stroke(); break;
      case 'arrowR': ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(1, -4); ctx.lineTo(5, 0); ctx.lineTo(1, 4); ctx.stroke(); break;
      case 'arrowL': ctx.moveTo(5, 0); ctx.lineTo(-5, 0); ctx.moveTo(-1, -4); ctx.lineTo(-5, 0); ctx.lineTo(-1, 4); ctx.stroke(); break;
      case 'arrowU': ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.moveTo(-4, -1); ctx.lineTo(0, -5); ctx.lineTo(4, -1); ctx.stroke(); break;
      case 'layers': ctx.moveTo(0, -6); ctx.lineTo(7, -2.5); ctx.lineTo(0, 1); ctx.lineTo(-7, -2.5); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-7, 1.5); ctx.lineTo(0, 5); ctx.lineTo(7, 1.5); ctx.stroke(); break;
      case 'map': ctx.moveTo(-7, -5); ctx.lineTo(-2.5, -7); ctx.lineTo(2.5, -5); ctx.lineTo(7, -7); ctx.lineTo(7, 5); ctx.lineTo(2.5, 7); ctx.lineTo(-2.5, 5); ctx.lineTo(-7, 7); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-2.5, -7); ctx.lineTo(-2.5, 5); ctx.moveTo(2.5, -5); ctx.lineTo(2.5, 7); ctx.stroke(); break;
    }
    ctx.restore();
  }
  function spinner(ctx, x, y, r, t, color) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); const a = t * 7; ctx.arc(x, y, r, a, a + Math.PI * 1.4); ctx.stroke(); ctx.restore(); }

  /* ───────────────────────── Barre d'outils ───────────────────────── */
  function toolbarPos(L, S) {
    const cy = L.y + TB / 2; let x = L.x + 22; const b = {};
    b.stop = { x: x + 14, y: cy }; x += 34; b.prev = { x: x + 14, y: cy }; x += 34; b.play = { x: x + 18, y: cy }; x += 42;
    b.next = { x: x + 14, y: cy }; x += 34; b.loop = { x: x + 14, y: cy }; x += 38; b.div1 = x; x += 14;
    b.speed = { x: x + 21, y: cy }; x += 56; b.time = { x, y: cy };
    let rx = L.x + L.w - 22; b.theme = { x: rx - 16, y: cy }; rx -= 46; b.zin = { x: rx - 14, y: cy }; rx -= 32; b.zout = { x: rx - 14, y: cy }; rx -= 34;
    b.win = { x: rx, y: cy }; rx -= 70; b.div2 = rx; rx -= 14;
    const lw = S && S.liveState === 2 ? 178 : 92;
    b.live = { x: rx - lw / 2, y: cy, w: lw };
    return b;
  }
  function drawToolbar(ctx, L, S, t) {
    const b = toolbarPos(L, S);
    hl(ctx, L.x, L.x + L.w, L.y + TB - 0.5, T.line);
    const R = Math.min(15, T.radius + 2);
    const btn = (name, ic, active) => {
      const p = b[name]; const pr = recentClick(t, name); const sc = pr == null ? 1 : 1 - 0.12 * Math.sin(Math.PI * pr);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
      if (active) { rr(ctx, -15, -15, 30, 30, R); ctx.fillStyle = T.accentSoft; ctx.fill(); }
      if (pr != null) { rr(ctx, -15, -15, 30, 30, R); ctx.strokeStyle = rgba(T.accent, 0.5 * (1 - pr)); ctx.lineWidth = 3; ctx.stroke(); }
      icon(ctx, ic, 0, 0, active ? T.accent : T.muted);
      ctx.restore();
    };
    btn('stop', 'stop'); btn('prev', 'prev');
    {
      const p = b.play; const pr = recentClick(t, 'play'); const sc = pr == null ? 1 : 1 - 0.12 * Math.sin(Math.PI * pr);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
      rr(ctx, -17, -17, 34, 34, T.radius < 4 ? 4 : 17); ctx.fillStyle = T.solid; ctx.fill();
      if (pr != null) { ctx.beginPath(); ctx.arc(0, 0, 17 + 8 * pr, 0, Math.PI * 2); ctx.strokeStyle = rgba(T.accent, 0.45 * (1 - pr)); ctx.lineWidth = 3; ctx.stroke(); }
      icon(ctx, S.playing ? 'pause' : 'play', S.playing ? 0 : 1, 0, T.onSolid);
      ctx.restore();
    }
    btn('next', 'next'); btn('loop', 'loop', S.loop);
    vl(ctx, b.div1 + 0.5, L.y + 16, L.y + TB - 16, T.line);
    {
      const p = b.speed; const pr = recentClick(t, 'speed');
      rr(ctx, p.x - 20, p.y - 13, 40, 26, T.radius); ctx.fillStyle = pr != null ? T.accentSoft : T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
      txt(ctx, S.speed, p.x, p.y + 0.5, { font: FM(500, 13), color: pr != null ? T.accent : T.ink, align: 'center' });
    }
    txt(ctx, clock(S.cursor, true), b.time.x, b.time.y + 0.5, { font: FM(500, 16), color: T.ink });
    {
      const sx = b.time.x + 136; const col = S.status === 'Direct' ? T.live : S.waiting ? T.key : S.playing ? T.accent : T.faint;
      ctx.beginPath(); ctx.arc(sx + 4, b.time.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      if (S.waiting) spinner(ctx, sx + 4, b.time.y, 7, t, T.key);
      const maxW = Math.max(0, b.live.x - b.live.w / 2 - 16 - (sx + 16));
      const s = fit(ctx, S.status, maxW, FI(500, 13)); if (s) txt(ctx, s, sx + 16, b.time.y + 0.5, { font: FI(500, 13), color: T.muted });
    }
    btn('theme', 'palette');
    btn('zin', 'plus'); btn('zout', 'minus');
    txt(ctx, spanLabel(S.view[1] - S.view[0]), b.win.x, b.win.y + 0.5, { font: FM(500, 13), color: T.ink, align: 'right' });
    vl(ctx, b.div2 + 0.5, L.y + 16, L.y + TB - 16, T.line);
    {
      const p = b.live; const pr = recentClick(t, 'live'); const sc = pr == null ? 1 : 1 - 0.08 * Math.sin(Math.PI * pr);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
      const on = S.liveState === 1, away = S.liveState === 2; const r2 = Math.min(15, T.radius * 2 + 3);
      rr(ctx, -p.w / 2, -15, p.w, 30, r2);
      ctx.fillStyle = on ? T.live : away ? T.liveSoft : T.surface; ctx.fill();
      ctx.strokeStyle = on ? T.live : away ? rgba(T.live, 0.55) : T.line; ctx.lineWidth = 1; ctx.stroke();
      const label = away ? 'Revenir au Direct' : 'Direct';
      const lw = tw(ctx, label, FI(600, 13)); const x0 = -(lw + 16) / 2;
      const pul = on ? 0.55 + 0.45 * Math.sin(t * 6) : 1;
      ctx.beginPath(); ctx.arc(x0 + 4, 0, 3.8, 0, Math.PI * 2); ctx.fillStyle = on ? rgba('#FFFFFF', pul) : away ? T.live : T.faint; ctx.fill();
      txt(ctx, label, x0 + 16, 0.5, { font: FI(600, 13), color: on ? '#FFFFFF' : away ? T.live : T.muted });
      if (pr != null) { rr(ctx, -p.w / 2 - 4 * pr, -15 - 4 * pr, p.w + 8 * pr, 30 + 8 * pr, r2 + 4); ctx.strokeStyle = rgba(T.live, 0.4 * (1 - pr)); ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
    }
  }

  /* ───────────────────────── Axe & grille ───────────────────────── */
  function pickSteps(span, w, minFn) { const ppm = w / span; let i = 0; while (i < STEPS.length - 1 && STEPS[i][0] * ppm < minFn(STEPS[i])) i++; return { i, ppm }; }
  function drawGrid(ctx, P, view, y0, y1) {
    const span = view[1] - view[0]; const X = (t) => P.x0 + (t - view[0]) / span * P.w;
    const { i, ppm } = pickSteps(span, P.w, () => 26);
    for (const [si, a] of [[i, 1], [i - 1, clamp((STEPS[Math.max(0, i - 1)][0] * ppm - 12) / 14)]]) {
      if (si < 0 || a <= 0.01) continue;
      ctx.save(); ctx.globalAlpha *= a;
      for (const tt of tickTimes(STEPS[si], view[0], view[1])) vl(ctx, Math.round(X(tt)) + 0.5, y0, y1, T.grid);
      ctx.restore();
    }
    return X;
  }
  function drawAxis(ctx, P, view) {
    const span = view[1] - view[0]; const X = (t) => P.x0 + (t - view[0]) / span * P.w;
    const need = (st) => tw(ctx, LABEL_SAMPLE[st[1]], FM(500, 12)) + 34;
    const { i, ppm } = pickSteps(span, P.w, need);
    const cur = tickTimes(STEPS[i], view[0] - span * 0.1, view[1] + span * 0.1); const curSet = new Set(cur);
    const prevI = i - 1; let prevA = 0, prev = [];
    if (prevI >= 0) {
      const pxPrev = STEPS[prevI][0] * ppm; const n = need(STEPS[prevI]); prevA = clamp((pxPrev - n * 0.62) / (n * 0.38));
      const minGap = (n - 24) / ppm;
      prev = tickTimes(STEPS[prevI], view[0] - span * 0.1, view[1] + span * 0.1).filter((x) => !curSet.has(x) && !cur.some((c) => Math.abs(c - x) < minGap));
    }
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top, P.w, AX); ctx.clip();
    const drawSet = (arr, unit, a) => {
      if (a <= 0.01) return; ctx.save(); ctx.globalAlpha *= a;
      for (const tt of arr) { const x = X(tt); vl(ctx, Math.round(x) + 0.5, P.top + AX - 7, P.top + AX, T.gridMajor); txt(ctx, tickLabel(tt, unit), x + 7, P.top + AX / 2 - 1, { font: FM(500, 12), color: T.muted }); }
      ctx.restore();
    };
    drawSet(cur, STEPS[i][1], 1);
    if (prevI >= 0) drawSet(prev, STEPS[prevI][1], prevA);
    ctx.restore();
    return X;
  }

  /* ───────────────────────── Éléments ───────────────────────── */
  function pill(ctx, x0, x1, cy, label, tint, a, active, left = -1e9) {
    if (a <= 0.01) return; const w = Math.max(8, x1 - x0); const x = w === 8 ? (x0 + x1) / 2 - 4 : x0; const h = 26;
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x, cy - h / 2, w, h, T.radius); ctx.fillStyle = active ? mix(tint.bg, tint.bd, T.dark ? 0.35 : 0.25) : tint.bg; ctx.fill();
    ctx.strokeStyle = active ? tint.dot : tint.bd; ctx.lineWidth = active ? 1.5 : 1; ctx.stroke();
    if (w > 34) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, cy - h / 2, w, h); ctx.clip();
      const lx = Math.max(x, Math.min(left, x + w - 60));
      ctx.beginPath(); ctx.arc(lx + 11, cy, 3, 0, Math.PI * 2); ctx.fillStyle = tint.dot; ctx.fill();
      const s = fit(ctx, label, x + w - lx - 28, FI(500, 12.5)); if (s) txt(ctx, s, lx + 20, cy + 0.5, { font: FI(500, 12.5), color: tint.ink });
      ctx.restore();
    }
    ctx.restore();
  }
  function point(ctx, x, cy, label, tint, a, room) {
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath();
    if (T.radius < 4) ctx.rect(x - 5, cy - 5, 10, 10); else ctx.arc(x, cy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.dot; ctx.lineWidth = 1.6; ctx.stroke();
    if (label && room > 40) { const s = fit(ctx, label, room - 26, FI(500, 12.5)); if (s) txt(ctx, s, x + 12, cy + 0.5, { font: FI(500, 12.5), color: tint.ink }); }
    ctx.restore();
  }
  function groupPill(ctx, x0, x1, cy, n, tint, a, avail) {
    if (a <= 0.01) return; const label = n >= 1000 ? frNum(n / 1000, 1) + ' k' : String(n);
    const minW = tw(ctx, label, FM(600, 12)) + 34; let w = Math.max(minW, x1 - x0); if (avail) w = Math.min(w, Math.max(avail, 20)); const x = avail ? x0 : (x0 + x1) / 2 - w / 2; const h = 26;
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x, cy - h / 2, w, h, T.radius < 4 ? 2 : 13); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.dot; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(x, cy - h / 2, w, h); ctx.clip();
    const ix = x + 13; ctx.fillStyle = tint.dot;
    ctx.globalAlpha *= 0.45; ctx.beginPath(); ctx.arc(ix + 3, cy - 1, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha /= 0.45;
    ctx.beginPath(); ctx.arc(ix, cy + 1, 3.4, 0, Math.PI * 2); ctx.fill();
    txt(ctx, label, x + 23, cy + 0.5, { font: FM(600, 12), color: tint.ink });
    ctx.restore(); ctx.restore();
  }
  function fractalBuckets(ev, view, w) {
    const span = view[1] - view[0]; const ppm = w / span;
    const u = Math.log2(74 / ppm); const k = Math.floor(u); const frac = u - k;
    const sm = (v) => { const q = clamp((v - 0.3) / 0.4); return q * q * (3 - 2 * q); };
    const layers = [[Math.pow(2, k), 1 - sm(frac)], [Math.pow(2, k + 1), sm(frac)]];
    const lo = view[0] - span * 0.1, hi = view[1] + span * 0.1;
    let a = 0, b = ev.length;
    { let l = 0, r = ev.length; while (l < r) { const m = (l + r) >> 1; if (ev[m] < lo) l = m + 1; else r = m; } a = l; }
    { let l = a, r = ev.length; while (l < r) { const m = (l + r) >> 1; if (ev[m] <= hi) l = m + 1; else r = m; } b = l; }
    return layers.map(([S, al]) => {
      const out = []; const org = T0 - S / 2; let cur = null;
      for (let i = a; i < b; i++) { const bi = Math.floor((ev[i] - org) / S); if (!cur || cur.bi !== bi) { cur = { bi, n: 0, min: ev[i], max: ev[i] }; out.push(cur); } cur.n++; cur.max = ev[i]; }
      return { a: al, groups: out };
    });
  }
  function clipNow(it, S) {
    // Renvoie [t0, t1, compte] après coupure au Direct, ou null si l'élément est encore à venir.
    let t1 = it.t1; let n = it.group;
    if (S.now != null) {
      if (it.t0 > S.now) return null;
      if (t1 != null && t1 > S.now) { if (n) n = Math.max(1, Math.round(n * (S.now - it.t0) / (t1 - it.t0))); t1 = Math.max(S.now, it.t0 + 1); }
    }
    return [it.t0, t1, n];
  }
  function drawRowItems(ctx, ds, row, RL, P, S, X, t, dsA) {
    const v = RL.v; if (v <= 0.01) return; const cy = RL.y + RH * v / 2; const tint = T.tints[row.tint];
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, RL.y, P.w, RL.h); ctx.clip();
    const baseA = v * v * S.itemsA * dsA;
    const list = ds.data[row.id]; const span = S.view[1] - S.view[0];
    const itemA = ds.fractal ? S.dayA : 1;
    if (itemA > 0.01) for (let i = 0; i < list.length; i++) {
      const it = list[i]; const c = clipNow(it, S); if (!c) continue; const [t0, t1, n] = c;
      const x0 = X(t0), x1 = t1 != null ? X(t1) : x0;
      if (x1 < P.x0 - 200 || x0 > P.x0 + P.w + 20) continue;
      const enter = ds.fractal && row.depth === 0 && t < 9 ? seg(t, 6.9 + 0.7 * (x0 - P.x0) / P.w, 7.6 + 0.7 * (x0 - P.x0) / P.w) : 1;
      const a = itemA * baseA * enter;
      const active = S.cursorA > 0.5 && S.cursor >= t0 && t1 != null && S.cursor <= t1 && span < DAY;
      if (n) groupPill(ctx, x0, x1, cy, n, tint, a, x1 - x0);
      else if (t1 != null) pill(ctx, x0, x1, cy, it.label, tint, a, active, P.x0 + 2);
      else { const nx = i + 1 < list.length ? X(list[i + 1].t0) : x0 + 400; point(ctx, x0, cy, it.label, tint, a, nx - x0); }
      if (S.now != null && S.now - t0 < 0.6 * LSP && S.now >= t0 && t0 > LIVE0 - 2 * MIN) {
        const k = (S.now - t0) / (0.6 * LSP);
        ctx.save(); ctx.globalAlpha *= (1 - k) * 0.6 * dsA; ctx.beginPath(); ctx.arc(x0, cy, 6 + 16 * E.outCubic(k), 0, Math.PI * 2); ctx.strokeStyle = T.live; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      }
    }
    if (ds.fractal && S.fracA > 0.01) {
      for (const Lr of fractalBuckets(FRACTAL[row.id], S.view, P.w)) {
        if (Lr.a <= 0.01) continue; const gs = Lr.groups;
        for (let g = 0; g < gs.length; g++) {
          const G0 = gs[g]; const a = Lr.a * S.fracA * baseA;
          if (G0.n === 1) { const nx = g + 1 < gs.length ? X(gs[g + 1].min) : X(G0.min) + 400; point(ctx, X(G0.min), cy, VOCAB[row.id], tint, a, nx - X(G0.min) - 20); }
          else groupPill(ctx, X(G0.min) - 9, X(G0.max) + 9, cy, G0.n, tint, a);
        }
      }
    }
    ctx.restore();
  }
  function itemRect(ctx, rowId, idx, RLs, X, S) {
    const list = FDATA[rowId]; const it = list[idx]; const RL = RLs[rowId]; const cy = RL.y + RH / 2;
    if (it.t1 == null) { const x = X(it.t0); const room = idx + 1 < list.length ? X(list[idx + 1].t0) - x : 400; const lab = room > 40 ? fit(ctx, it.label, room - 26, FI(500, 12.5)) : ''; return { x: x - 8, y: cy - 10, w: 16 + (lab ? 6 + tw(ctx, lab, FI(500, 12.5)) : 0), h: 20 }; }
    let t1 = it.t1; if (S.now != null && t1 > S.now) t1 = S.now;
    const x0 = X(it.t0), x1 = Math.max(X(t1), x0 + 8);
    return { x: x0, y: cy - 13, w: x1 - x0, h: 26 };
  }
  function rowCount(ds, row, S) {
    if (ds.fractal && S.fracA > 0.5) { let n = 0; for (const e of FRACTAL[row.id]) if (e >= S.view[0] && e <= S.view[1]) n++; return n; }
    const lim = S.now != null ? S.now : S.view[1];
    let n = 0; for (const it of ds.data[row.id]) if (it.t0 <= lim && (ds.fractal ? ((it.t1 ?? it.t0) > DAY_VIEW[0] && it.t0 < DAY_VIEW[1]) : true)) n += it.group || 1;
    return n;
  }
  function drawRowLabel(ctx, row, RL, L, S, chev, ds, a) {
    const v = RL.v; if (v <= 0.01 || a <= 0.01) return; const cy = RL.y + RH * v / 2; const tint = T.tints[row.tint];
    ctx.save(); ctx.globalAlpha *= v * v * a; ctx.beginPath(); ctx.rect(L.x, RL.y, L.labelW, RL.h); ctx.clip();
    const slide = (1 - v) * -8 + (1 - a) * (ds.fractal ? -10 : 10);
    const x = L.x + 22 + row.depth * 22;
    for (let d = 0; d < row.depth; d++) vl(ctx, L.x + 22 + d * 22 + 6.5, RL.y, RL.y + RL.h, T.line);
    if (row.kids) { const k = chev[row.id] ?? 0; ctx.save(); ctx.translate(x + 6, cy + slide); ctx.rotate(k * Math.PI / 2); icon(ctx, 'chev', 0, 0, T.muted); ctx.restore(); }
    const ix = x + 24;
    rr(ctx, ix, cy - 10 + slide, 20, 20, Math.min(5, T.radius)); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.bd; ctx.lineWidth = 1; ctx.stroke();
    if (!row.kids && row.depth > 0) { ctx.beginPath(); ctx.arc(ix + 10, cy + slide, 3, 0, Math.PI * 2); ctx.fillStyle = tint.dot; ctx.fill(); }
    else icon(ctx, 'layers', ix + 10, cy + slide + 0.5, tint.dot, 0.72);
    const font = row.depth === 0 ? FI(600, 14) : FI(500, 13.5);
    const maxW = L.labelW - (ix + 30 - L.x) - 46;
    txt(ctx, fit(ctx, row.label, maxW, font) || row.label.slice(0, 3), ix + 30, cy + slide + 0.5, { font, color: T.ink });
    const n = rowCount(ds, row, S);
    txt(ctx, n >= 1000 ? frNum(n / 1000, 1) + ' k' : String(n), L.x + L.labelW - 18, cy + slide + 0.5, { font: FM(500, 12), color: T.faint, align: 'right' });
    ctx.restore();
  }
  function cursorHandle(ctx, x, y, label, fill, ink, outline) {
    const w = tw(ctx, label, FM(500, 12)) + 18, h = 22;
    rr(ctx, x - w / 2, y - h / 2, w, h, Math.min(6, T.radius));
    if (outline) { ctx.fillStyle = T.panel; ctx.fill(); ctx.setLineDash([]); ctx.strokeStyle = fill; ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fillStyle = fill; ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(x - 5, y + h / 2 - 0.5); ctx.lineTo(x, y + h / 2 + 5); ctx.lineTo(x + 5, y + h / 2 - 0.5); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    txt(ctx, label, x, y + 0.5, { font: FM(500, 12), color: ink, align: 'center' });
  }
  function handleText(S, tt) { return S.handleFmt === 'ms' ? clock(tt, true) : S.handleFmt === 'day' ? `${dayLabel(tt)} 2026` : S.handleFmt === 'year' ? '2026' : clock(tt); }

  /* ───────────────────────── Panneau timeline ───────────────────────── */
  function panelShell(ctx, x, y, w, h) {
    ctx.save(); ctx.shadowColor = T.shadow; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; rr(ctx, x, y, w, h, T.pr); ctx.fillStyle = T.panel; ctx.fill(); ctx.restore();
  }
  function drawPanel(ctx, L, S, t, cam) {
    const P = plotOf(L);
    const lineScale = cam ? 1 / cam.s : 1; HAIR = lineScale;
    panelShell(ctx, L.x, L.y, L.w, L.h);
    ctx.save(); rr(ctx, L.x, L.y, L.w, L.h, T.pr); ctx.clip();
    ctx.fillStyle = T.surface; ctx.fillRect(L.x, P.top, L.labelW, L.h - TB);
    drawToolbar(ctx, L, S, t);
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top, P.w, P.bottom - P.top); ctx.clip();
    const X = drawGrid(ctx, P, S.view, P.rowsTop, P.bottom);
    if (S.now != null) {
      const xn = X(S.now);
      if (xn < P.x0 + P.w) {
        ctx.save(); ctx.fillStyle = rgba(T.live, T.dark ? 0.06 : 0.035); ctx.fillRect(xn, P.top, P.x0 + P.w - xn, P.bottom - P.top);
        ctx.strokeStyle = rgba(T.live, T.dark ? 0.12 : 0.08); ctx.lineWidth = 1;
        for (let k = -40; k < (P.x0 + P.w - xn) + 600; k += 14) { ctx.beginPath(); ctx.moveTo(xn + k, P.bottom); ctx.lineTo(xn + k + (P.bottom - P.rowsTop), P.rowsTop); ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.restore();
    drawAxis(ctx, P, S.view);
    hl(ctx, L.x, L.x + L.w, P.top + AX - 0.5, T.line);
    vl(ctx, P.x0 - 0.5, P.top, P.bottom, T.line);
    txt(ctx, 'STRUCTURE', L.x + 22, P.top + AX / 2, { font: FM(500, 11), color: T.faint, ls: 1.6 });
    const layouts = [];
    for (const D of S.datasets) {
      if (D.a <= 0.01) { layouts.push(null); continue; }
      const RLs = rowsLayout(L, D.ds.rows, D.vis); layouts.push(RLs);
      for (const row of D.ds.rows) {
        const RL = RLs[row.id]; if (RL.v <= 0.01) continue;
        ctx.save(); ctx.globalAlpha *= RL.v * D.a; hl(ctx, L.x, L.x + L.w, Math.round(RL.y + RL.h) - 0.5, T.line); ctx.restore();
        drawRowLabel(ctx, row, RL, L, S, D.chev, D.ds, D.a);
        drawRowItems(ctx, D.ds, row, RL, P, S, X, t, D.a);
      }
    }
    const FL = layouts[1];
    // focus clavier
    if (S.focus && S.focus.a > 0 && FL) {
      const f = S.focus; let r = itemRect(ctx, f.cur.row, f.cur.i, FL, X, S);
      if (f.prev && f.k < 1) { const r0 = itemRect(ctx, f.prev.row, f.prev.i, FL, X, S); r = { x: lerp(r0.x, r.x, f.k), y: lerp(r0.y, r.y, f.k), w: lerp(r0.w, r.w, f.k), h: r.h }; }
      ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.rowsTop, P.w, P.bottom - P.rowsTop); ctx.clip(); ctx.globalAlpha *= f.a;
      rr(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, T.radius + 4); ctx.strokeStyle = rgba(T.accent, 0.25); ctx.lineWidth = 5; ctx.stroke();
      rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, T.radius + 2); ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // clés
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top, P.w, P.bottom - P.top); ctx.clip();
    for (const D of S.datasets) {
      const ka = D.keysA * D.a * S.itemsA; if (ka <= 0.01) continue;
      ctx.save(); ctx.globalAlpha *= ka;
      D.ds.keys.forEach((k, i) => {
        const x = X(k), y = P.top + AX - 9;
        const p = D.ds === DS_FLEET ? S.keyPulse.find((q) => q.i === i) : null;
        const sc = p ? 1 + 0.5 * Math.sin(Math.PI * Math.min(1, p.k * 2.2)) : 1;
        diamond(ctx, x, y, 5.5 * sc); ctx.fillStyle = T.key; ctx.fill();
        if (p) {
          ctx.save(); ctx.globalAlpha *= 1 - p.k; diamond(ctx, x, y, 6 + 18 * E.outCubic(p.k)); ctx.strokeStyle = T.key; ctx.lineWidth = 1.5; ctx.stroke();
          vl(ctx, x, y + 8, P.bottom, rgba(T.key, 0.5)); ctx.restore();
          const la = Math.sin(Math.PI * clamp(p.k * 1.15));
          alpha(ctx, la, () => chip(ctx, x + 10, P.top + AX + 16, FKEY_LABELS[i], { bg: T.key, color: T.dark ? '#1A1408' : '#FFFFFF', font: FI(600, 12), h: 24, icon: (cx, cy) => { diamond(ctx, cx - 2, cy, 4); ctx.fillStyle = T.dark ? '#1A1408' : '#FFFFFF'; ctx.fill(); } }));
        }
      });
      ctx.restore();
    }
    ctx.restore();
    // couches au-dessus du tracé
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top - 40, P.w, P.bottom - P.top + 80); ctx.clip();
    if (S.now != null) {
      const xn = X(S.now);
      vl(ctx, xn, P.top + AX, P.bottom, T.live, 2 * lineScale);
      if (Math.abs(X(S.cursor) - xn) > 50 || S.redK < 0.5) { const w = tw(ctx, 'DIRECT', FM(600, 11), 1) + 16; rr(ctx, xn - w / 2, P.top + AX / 2 - 10, w, 20, Math.min(5, T.radius)); ctx.fillStyle = T.live; ctx.fill(); txt(ctx, 'DIRECT', xn, P.top + AX / 2 + 0.5, { font: FM(600, 11), color: '#FFFFFF', align: 'center', ls: 1 }); }
    }
    if (S.ghost && S.ghost.a > 0) { const gx = Math.min(X(S.ghost.t), P.x0 + P.w - 1); alpha(ctx, S.ghost.a, () => vl(ctx, gx, P.top + AX, P.bottom, T.accent, 2 * lineScale)); }
    if (S.pending != null && S.pendingA > 0.01) {
      const xp = X(S.pending);
      ctx.save(); ctx.globalAlpha *= S.pendingA; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 30;
      vl(ctx, xp, P.top + AX + 4, P.bottom, T.accent, 1.6 * lineScale); ctx.setLineDash([]);
      cursorHandle(ctx, xp, P.top + AX / 2 - 2, clock(S.pending), T.accent, T.accent, true);
      ctx.restore();
    }
    if (S.cursorA > 0.01) {
      const xc = X(S.cursor); const col = S.redK > 0 ? mix(T.accent, T.live, S.redK) : T.accent;
      vl(ctx, xc, P.top + AX + 6, P.bottom, col, 2 * lineScale);
      cursorHandle(ctx, xc, P.top + AX / 2 - 2, handleText(S, S.cursor), col, T.dark && S.redK < 0.5 ? T.panel : '#FFFFFF', false);
    }
    ctx.restore();
    if (S.now != null) {
      const xn = X(S.now);
      if (xn > P.x0 + P.w + 2) {
        let added = 0; for (const id of ['calls', 'radio', 'alerts']) for (const it of FDATA[id]) if (it.t0 > S.view[1] && it.t0 <= S.now) added++;
        const label = `Direct  +${added}`; const w = tw(ctx, label, FI(600, 12)) + 36; const x = P.x0 + P.w - w - 10, y = P.top + AX / 2 - 14;
        ctx.save(); ctx.globalAlpha *= seg(t, DRAG0 + 0.4, DRAG0 + 0.8);
        rr(ctx, x, y, w, 26, Math.min(13, T.radius * 2 + 1)); ctx.fillStyle = T.live; ctx.fill(); txt(ctx, label, x + 12, y + 13.5, { font: FI(600, 12), color: '#FFFFFF' }); icon(ctx, 'arrowR', x + w - 15, y + 13, '#FFFFFF', 0.85);
        ctx.restore();
      }
    }
    // pied
    hl(ctx, L.x, L.x + L.w, P.bottom + 0.5, T.line);
    {
      const y = P.bottom + FT / 2;
      const legend = (items, a) => alpha(ctx, a, () => {
        let x = L.x + 22;
        for (const [c, l] of items) { ctx.beginPath(); ctx.arc(x + 4, y, 4, 0, Math.PI * 2); ctx.fillStyle = T.tints[c].dot; ctx.fill(); txt(ctx, l, x + 14, y + 0.5, { font: FI(500, 12), color: T.muted }); x += tw(ctx, l, FI(500, 12)) + 32; }
        diamond(ctx, x + 4, y, 4.5); ctx.fillStyle = T.key; ctx.fill(); txt(ctx, 'Clé', x + 14, y + 0.5, { font: FI(500, 12), color: T.muted });
      });
      legend([['blue', 'Communication'], ['green', 'Acquisition'], ['violet', 'Traitement'], ['amber', 'Alerte']], 1 - S.dsK);
      legend([['blue', 'Patrouille'], ['green', 'Ambulance'], ['violet', 'Drone'], ['amber', 'Alerte']], S.dsK);
      const right = S.now != null ? 'Flux · UTC' : S.dsK > 0.5 ? 'Rejeu · UTC' : 'Temps calendrier · UTC';
      if (!(S.wrapK > 0 && S.wrapK < 1)) txt(ctx, right, L.x + L.w - 22, y + 0.5, { font: FM(400, 12), color: T.faint, align: 'right' });
      if (S.wrapK > 0 && S.wrapK < 1) {
        const k = S.wrapK; ctx.save(); ctx.globalAlpha *= Math.sin(Math.PI * clamp(k / 0.9));
        const xa = P.x0 + P.w - 30, xb = P.x0 + 30; const xh = lerp(xa, xb, E.outCubic(clamp(k / 0.7)));
        ctx.setLineDash([2, 5]); hl(ctx, xh, xa, y, T.accent, 1.5); ctx.setLineDash([]);
        chip(ctx, xh - 4, y, 'Boucle · retour au début', { bd: T.accent, color: T.accent, h: 22 });
        ctx.restore();
      }
    }
    ctx.restore();
    rr(ctx, L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1, T.pr); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    HAIR = 1;
    return { P, X, FL };
  }

  /* ───────────────────────── Carte ───────────────────────── */
  function mapTransform(M) {
    const ax = M.x, ay = M.y + TB, aw = M.w, ah = M.h - TB - FT;
    const s = Math.min(aw / 1000, ah / 760) * 1.1;
    return { ax, ay, aw, ah, s, P: (p) => [ax + aw / 2 + (p[0] - 520) * s, ay + ah / 2 + (p[1] - 400) * s] };
  }
  function drawMap(ctx, M, st, t) {
    if (M.a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= M.a; ctx.translate(M.dx, 0);
    panelShell(ctx, M.x, M.y, M.w, M.h);
    ctx.save(); rr(ctx, M.x, M.y, M.w, M.h, T.pr); ctx.clip();
    const tf = mapTransform(M); const { ax, ay, aw, ah, s } = tf; const P = tf.P; const C = T.map;
    // en-tête
    rr(ctx, M.x + 20, M.y + 13, 30, 30, Math.min(8, T.radius + 2)); ctx.fillStyle = T.accentSoft; ctx.fill(); icon(ctx, 'map', M.x + 35, M.y + 28, T.accent, 0.9);
    txt(ctx, 'Carte · Secteur Nord', M.x + 62, M.y + 21, { font: FI(600, 15.5), color: T.ink });
    txt(ctx, 'Votre application · positions des unités', M.x + 62, M.y + 40, { font: FI(400, 12.5), color: T.muted });
    {
      const cy = M.y + 28, rx = M.x + M.w - 20;
      if (st.loading) chip(ctx, rx, cy, 'Chargement des positions…', { align: 'right', bg: T.surface, bd: T.line, color: T.muted, font: FM(500, 12), icon: (x, y) => spinner(ctx, x, y, 5.5, t, T.muted) });
      else if (st.flash > 0.01) chip(ctx, rx, cy, `Synchronisé · ${clock(st.time)}`, { align: 'right', bg: T.okSoft, bd: rgba(T.ok, 0.6), color: T.ok, font: FM(500, 12), icon: (x, y) => icon(ctx, 'check', x, y, T.ok, 0.9) });
      else if (st.live === 1) chip(ctx, rx, cy, `DIRECT · ${clock(st.time)}`, { align: 'right', bg: T.live, color: '#FFFFFF', font: FM(600, 12), icon: (x, y) => { ctx.beginPath(); ctx.arc(x, y, 3.8, 0, Math.PI * 2); ctx.fillStyle = rgba('#FFFFFF', 0.55 + 0.45 * Math.sin(t * 6)); ctx.fill(); } });
      else chip(ctx, rx, cy, `${st.live === 2 ? 'Historique' : 'Rejeu'} · ${clock(st.time)}`, { align: 'right', bg: T.surface, bd: T.line, color: T.ink, font: FM(500, 12), icon: (x, y) => { ctx.beginPath(); ctx.arc(x, y, 3.8, 0, Math.PI * 2); ctx.fillStyle = st.live === 2 ? T.key : T.accent; ctx.fill(); } });
    }
    hl(ctx, M.x, M.x + M.w, M.y + TB - 0.5, T.line);
    // fond de carte
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    ctx.fillStyle = C.land; ctx.fillRect(ax, ay, aw, ah);
    const xs = [-200, ...ROAD_X, 1200], ys = [-200, ...ROAD_Y, 1000];
    const PARKS = new Set(['3,0', '0,2', '4,3']);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const a = P([xs[i] + 14, ys[j] + 14]), b = P([xs[i + 1] - 14, ys[j + 1] - 14]);
      const park = PARKS.has(`${i},${j}`);
      rr(ctx, a[0], a[1], b[0] - a[0], b[1] - a[1], Math.min(T.radius + 2, 8)); ctx.fillStyle = park ? C.park : C.block; ctx.fill();
      if (!park && b[0] - a[0] > 60 && b[1] - a[1] > 60) { // sous-îlots
        const mx = (a[0] + b[0]) / 2; ctx.strokeStyle = C.land; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(mx, a[1]); ctx.lineTo(mx, b[1]); ctx.stroke();
      }
    }
    // canal
    const river = [[-120, 520], [120, 470], [300, 520], [470, 660], [700, 640], [900, 560], [1150, 610]];
    const riverPath = () => { ctx.beginPath(); const p0 = P(river[0]); ctx.moveTo(...p0); for (let i = 1; i < river.length - 1; i++) { const p = P(river[i]), q = P(river[i + 1]); ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } ctx.lineTo(...P(river[river.length - 1])); };
    riverPath(); ctx.strokeStyle = C.water; ctx.lineWidth = 46 * s; ctx.lineCap = 'round'; ctx.stroke();
    // rues
    const road = (a, b, w) => { const p = P(a), q = P(b); ctx.lineCap = 'butt'; ctx.strokeStyle = C.edge; ctx.lineWidth = (w + 3) * s; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); };
    const road2 = (a, b, w) => { const p = P(a), q = P(b); ctx.strokeStyle = C.road; ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); };
    for (const pass of [road, road2]) {
      for (const x of ROAD_X) pass([x, -200], [x, 1000], x === 440 ? 22 : 13);
      for (const y of ROAD_Y) pass([-200, y], [1200, y], y === 420 ? 22 : 13);
    }
    // libellés
    ctx.save(); ctx.globalAlpha *= 0.95;
    txt(ctx, 'BOULEVARD DE LA TRAME', P([140, 420])[0], P([140, 420])[1] - 0.5, { font: FM(500, 10), color: C.label, ls: 1.4 });
    txt(ctx, 'RUE DU SIGNAL', P([660, 250])[0] + 40, P([660, 250])[1] - 0.5, { font: FM(500, 10), color: C.label, ls: 1.4 });
    txt(ctx, 'RUE DES CAPTEURS', P([470, 590])[0], P([470, 590])[1] - 0.5, { font: FM(500, 10), color: C.label, ls: 1.4 });
    { const p = P([610, 652]); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-0.06); txt(ctx, 'Canal de la Trame', 0, 0, { font: FI(500, 12), color: mix(C.water, T.ink, 0.45), align: 'center' }); ctx.restore(); }
    ctx.restore();
    // points d'intérêt
    const poi = (p, label, glyph) => { const q = P(p); rr(ctx, q[0] - 10, q[1] - 10, 20, 20, Math.min(5, T.radius)); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke(); txt(ctx, glyph, q[0], q[1] + 0.5, { font: FI(600, 11), color: T.muted, align: 'center' }); txt(ctx, label, q[0] + 15, q[1] + 0.5, { font: FI(500, 11.5), color: T.muted }); };
    poi([BASE_P[0] - 24, BASE_P[1] + 28], 'Poste Nord', 'P'); poi([HOSP[0] + 22, HOSP[1] + 26], 'Hôpital Est', 'H'); poi([DBASE[0] + 22, DBASE[1] + 26], 'Base drones', 'D');
    // contenu dynamique (estompé pendant le chargement)
    ctx.save(); if (st.loading) ctx.globalAlpha *= 0.35;
    // incident
    if (st.time >= FKEYS[0] && st.time < U(14, 30)) {
      const q = P(INC); const done = st.time >= FKEYS[3]; const col = done ? T.ok : T.key; const k0 = seg(st.time, FKEYS[0], FKEYS[0] + 20 * SEC);
      for (let r = 0; r < 2; r++) { const ph = ((t * 0.8 + r * 0.5) % 1); ctx.beginPath(); ctx.arc(q[0], q[1], (10 + 30 * ph) * k0, 0, Math.PI * 2); ctx.strokeStyle = rgba(col, (1 - ph) * 0.5); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(q[0], q[1], 13 * k0, 0, Math.PI * 2); ctx.fillStyle = rgba(col, 0.18); ctx.fill();
      diamond(ctx, q[0], q[1], 7 * k0); ctx.fillStyle = col; ctx.fill();
      alpha(ctx, k0, () => chip(ctx, q[0] - 26, q[1] - 66, done ? 'Zone sécurisée' : 'Collision signalée', { align: 'right', bg: col, color: T.dark ? '#141008' : '#FFFFFF', font: FI(600, 12), h: 24 }));
    }
    // unités : traces puis marqueurs
    for (const u of UNITS) {
      const tint = T.tints[u.tint];
      const from = st.live ? st.time - 2 * MIN : Math.min(R_START, st.time); const steps = 90;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const q = P(posAt(u.id, lerp(from, st.time, i / steps))); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.strokeStyle = rgba(tint.dot, 0.55); ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
    for (const u of UNITS) {
      const tint = T.tints[u.tint]; const q = P(posAt(u.id, st.time));
      ctx.beginPath(); ctx.arc(q[0], q[1], 16, 0, Math.PI * 2); ctx.fillStyle = rgba(tint.dot, 0.16); ctx.fill();
      if (u.drone) diamond(ctx, q[0], q[1], 10); else { ctx.beginPath(); ctx.arc(q[0], q[1], 8.5, 0, Math.PI * 2); }
      ctx.fillStyle = tint.dot; ctx.fill(); ctx.strokeStyle = T.panel; ctx.lineWidth = 2.5; ctx.stroke();
      const [ox, oy, al] = u.off; chip(ctx, q[0] + ox, q[1] + oy, u.name, { align: al, bg: T.panel, bd: tint.bd, color: tint.ink, font: FM(600, 11.5), h: 22 });
    }
    // repère du focus clavier
    if (st.pin && st.pin.a > 0.01) {
      const q = P(st.pin.p);
      alpha(ctx, st.pin.a, () => {
        ctx.beginPath(); ctx.arc(q[0], q[1], 24 + 4 * Math.sin(t * 5), 0, Math.PI * 2); ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(q[0], q[1], 24, 0, Math.PI * 2); ctx.fillStyle = rgba(T.accent, 0.08); ctx.fill();
        chip(ctx, clamp(q[0] + 30, ax + 10, ax + aw - 230), q[1] + 44, st.pin.label, { bg: T.accent, color: T.dark ? T.panel : '#FFFFFF', font: FI(600, 12), h: 24 });
      });
    }
    ctx.restore();
    if (st.loading) { const ph = (t * 0.9) % 1; const g = ctx.createLinearGradient(ax + aw * (ph * 1.6 - 0.3), 0, ax + aw * (ph * 1.6 - 0.1), 0); g.addColorStop(0, rgba(T.panel, 0)); g.addColorStop(0.5, rgba(T.panel, 0.35)); g.addColorStop(1, rgba(T.panel, 0)); ctx.fillStyle = g; ctx.fillRect(ax, ay, aw, ah); }
    // boussole + échelle
    { const cx = ax + aw - 26, cy = ay + 26; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 4, cy + 3); ctx.lineTo(cx - 4, cy + 3); ctx.closePath(); ctx.fillStyle = T.accent; ctx.fill(); txt(ctx, 'N', cx, cy + 8, { font: FI(600, 8), color: T.muted, align: 'center' }); }
    ctx.restore();
    // pied de carte
    hl(ctx, M.x, M.x + M.w, M.y + M.h - FT + 0.5, T.line);
    { let x = M.x + 22; const y = M.y + M.h - FT / 2;
      for (const u of UNITS) { const tint = T.tints[u.tint]; if (u.drone) diamond(ctx, x + 4, y, 4.5); else { ctx.beginPath(); ctx.arc(x + 4, y, 4, 0, Math.PI * 2); } ctx.fillStyle = tint.dot; ctx.fill(); const l = `${u.name} ${u.label}`; txt(ctx, l, x + 14, y + 0.5, { font: FI(500, 12), color: T.muted }); x += tw(ctx, l, FI(500, 12)) + 30; }
      const bx = M.x + M.w - 22; const bw = 200 * s * 0.5; hl(ctx, bx - bw, bx, y + 4, T.muted, 1.2); vl(ctx, bx - bw, y, y + 4, T.muted, 1.2); vl(ctx, bx, y, y + 4, T.muted, 1.2);
      txt(ctx, '100 m', bx - bw - 8, y + 1, { font: FM(400, 11), color: T.faint, align: 'right' });
    }
    ctx.restore();
    rr(ctx, M.x + 0.5, M.y + 0.5, M.w - 1, M.h - 1, T.pr); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  /* ───────────────────────── Cartes de code ───────────────────────── */
  function codeCard(ctx, x, y, w, a, title, lines, hiLine, hiK, swatchW = 0) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= a;
    const h = 30 + 22 * lines.length + 22;
    rr(ctx, x, y, w, h, Math.max(4, T.pr - 2)); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    txt(ctx, title, x + 22, y + 22, { font: FM(500, 11), color: T.faint, ls: 1.6 });
    const ly0 = y + 50;
    if (hiK > 0 && hiLine != null) { ctx.save(); ctx.globalAlpha *= hiK; rr(ctx, x + 14, ly0 + hiLine * 22 - 11, w - 28, 22, Math.min(5, T.radius)); ctx.fillStyle = T.accentSoft; ctx.fill(); ctx.restore(); }
    lines.forEach((ln, i) => { let cx = x + 22; for (const tok of ln) { const [s, c, sw] = tok; if (sw) { rr(ctx, cx, ly0 + i * 22 - 6, 12, 12, Math.min(3, T.radius)); ctx.fillStyle = sw; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke(); cx += 18; } txt(ctx, s, cx, ly0 + i * 22, { font: FM(400, 14), color: c }); cx += tw(ctx, s, FM(400, 14)); } });
    ctx.restore();
  }
  function syntax() { return { kw: T.tints.violet.ink, fn: T.accent, id: T.ink, p: T.muted, prop: T.tints.green.ink, cm: T.faint }; }
  function drawSyncCode(ctx, a, hiK) {
    const C = syntax();
    codeCard(ctx, 120, 852, 980, a, 'CONTRAT DE PRÉPARATION', [
      [['const ', C.kw], ['controller', C.id], [' = ', C.p], ['useTimelineController', C.fn], ['({', C.p]],
      [['  prepareTime', C.prop], [': (', C.p], ['request', C.id], [') => ', C.p], ['carte', C.id], ['.', C.p], ['afficherPositionsA', C.fn], ['(', C.p], ['request', C.id], ['.target', C.prop], [', ', C.p], ['request', C.id], ['.signal', C.prop], ['),', C.p]],
      [['});', C.p]],
    ], 1, hiK);
  }
  function drawThemeCode(ctx, a) {
    const C = syntax(); const v = (name, val, sw) => [[`  ${name}: `, C.prop], [val, C.id, sw], [';  ', C.p]];
    const sel = T.selector.split(/(\[[^\]]+\]|\.theme-[a-z]+)/).filter(Boolean).map((s) => [s, s.startsWith('.theme') || s.startsWith('[') ? C.fn : C.kw]);
    codeCard(ctx, 120, 852, 1680, a, `THÈME · ${T.label.toUpperCase()}  —  ${T.note}`, [
      [...sel, [' {', C.p]],
      [...v('--tw-bg', T.panel, T.panel), ...v('--tw-ink', T.ink, T.ink), ...v('--tw-accent', T.accent, T.accent), ...v('--tw-live', T.live, T.live), ...v('--tw-key', T.key, T.key)],
      [...v('--tw-item-bg', T.tints.blue.bg, T.tints.blue.bg), ...v('--tw-group-bg', T.tints.violet.bg, T.tints.violet.bg), ...v('--tw-radius', `${T.radius}px`), ...v('--tw-font', 'Inter, sans-serif')],
      [['}', C.p], ['   /* + classes tw-item, tw-item--group… et renderItem pour aller plus loin */', C.cm]],
    ]);
  }

  /* ───────────────────────── Fenêtre de détail ───────────────────────── */
  function drawModal(ctx, k, t) {
    if (k <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = T.backdrop; ctx.fillRect(0, 0, W, H); ctx.restore();
    const w = 620, h = 452; const x = (W - w) / 2, y = 252;
    const sc = lerp(0.94, 1, E.outCubic(k)); const oy = (1 - E.outCubic(k)) * 16;
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.4);
    ctx.translate(x + w / 2, y + h / 2 + oy); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20; rr(ctx, x, y, w, h, T.pr + 2); ctx.fillStyle = T.panel; ctx.fill(); ctx.restore();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, T.pr + 2); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    const it = MODAL_ITEM; const unit = UNITS.find((u) => u.id === it.unit); const tint = T.tints.violet;
    rr(ctx, x + 28, y + 28, 40, 40, Math.min(10, T.radius + 4)); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.bd; ctx.stroke(); ctx.beginPath(); ctx.arc(x + 48, y + 48, 5, 0, Math.PI * 2); ctx.fillStyle = tint.dot; ctx.fill();
    txt(ctx, `RADIO · ${unit.name}`, x + 84, y + 38, { font: FM(500, 11.5), color: T.faint, ls: 1.4 });
    txt(ctx, `Message radio — ${it.label.toLowerCase()}`, x + 84, y + 60, { font: FI(600, 20), color: T.ink });
    rr(ctx, x + w - 60, y + 28, 32, 32, Math.min(8, T.radius + 2)); ctx.fillStyle = T.surface; ctx.fill(); icon(ctx, 'close', x + w - 44, y + 44, T.muted, 0.85);
    let px = x + 84;
    for (const [lab, tn] of [['Communication', 'violet'], [unit.label, unit.tint], ['Direct', null]]) {
      const lw = tw(ctx, lab, FI(500, 12)) + 26; rr(ctx, px, y + 80, lw, 24, Math.min(12, T.radius * 2));
      const c = tn ? T.tints[tn] : { bg: T.liveSoft, bd: T.liveSoft, ink: T.live, dot: T.live };
      ctx.fillStyle = c.bg; ctx.fill(); ctx.strokeStyle = c.bd; ctx.stroke(); ctx.beginPath(); ctx.arc(px + 11, y + 92, 3, 0, Math.PI * 2); ctx.fillStyle = c.dot; ctx.fill(); txt(ctx, lab, px + 18, y + 92.5, { font: FI(500, 12), color: c.ink });
      px += lw + 8;
    }
    hl(ctx, x, x + w, y + 124.5, T.line);
    const pos = posAt(it.unit, it.t0);
    const fields = [['Heure', clock(it.t0, true)], ['Durée du message', '18,4 s'], ['Unité', `${unit.name} · ${unit.label}`], ['Canal', 'TAC-2'], ['Ligne', 'Communications › Radio'], ['Position', latLon(pos)]];
    fields.forEach(([k2, v2], i) => { const col = i % 2, rowi = Math.floor(i / 2); const fx = x + 28 + col * 290, fy = y + 150 + rowi * 50;
      txt(ctx, k2, fx, fy, { font: FI(500, 12), color: T.faint }); txt(ctx, v2, fx, fy + 20, { font: FM(500, 14), color: T.ink }); });
    const my = y + 300; rr(ctx, x + 28, my, w - 56, 74, Math.min(8, T.radius + 2)); ctx.fillStyle = T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.stroke();
    txt(ctx, `{ "unité": "${unit.name}", "canal": "TAC-2", "qualité": "bonne",`, x + 44, my + 24, { font: FM(400, 13), color: T.muted });
    txt(ctx, '  "transcription": "Point de situation, secteur calme." }', x + 44, my + 48, { font: FM(400, 13), color: T.muted });
    const by = y + h - 56; const focusBtn = t >= 51.2 ? seg(t, 51.2, 51.4) : 0;
    { const lab = 'Aller à cet instant'; const lw = tw(ctx, lab, FI(600, 13)) + 32; const bx = x + w - 28 - lw;
      if (focusBtn > 0) { ctx.save(); ctx.globalAlpha *= focusBtn; rr(ctx, bx - 4, by - 4, lw + 8, 44, Math.min(11, T.radius + 5)); ctx.strokeStyle = rgba(T.accent, 0.35); ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      rr(ctx, bx, by, lw, 36, Math.min(8, T.radius + 2)); ctx.fillStyle = T.accent; ctx.fill(); txt(ctx, lab, bx + lw / 2, by + 18.5, { font: FI(600, 13), color: T.dark ? T.panel : '#FFFFFF', align: 'center' });
      const l2 = 'Fermer'; const w2 = tw(ctx, l2, FI(600, 13)) + 32; const bx2 = bx - 10 - w2; rr(ctx, bx2, by, w2, 36, Math.min(8, T.radius + 2)); ctx.fillStyle = T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.stroke(); txt(ctx, l2, bx2 + w2 / 2, by + 18.5, { font: FI(600, 13), color: T.ink, align: 'center' });
      txt(ctx, 'Échap pour fermer', x + 28, by + 18.5, { font: FI(400, 12.5), color: T.faint });
    }
    ctx.restore();
  }

  /* ───────────────────────── Touches ───────────────────────── */
  function keycap(ctx, x, y, label, pressK, a, glow) {
    const wide = label.length > 1; const w = wide ? tw(ctx, label, FI(600, 16)) + 40 : 56; const h = 52; const dy = pressK * 3; const r = Math.min(10, T.radius + 4);
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x - w / 2, y - h / 2 + 4, w, h, r); ctx.fillStyle = T.cap; ctx.fill();
    rr(ctx, x - w / 2, y - h / 2 + dy, w, h, r); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = glow > 0 ? mix(T.line, T.accent, glow) : T.line; ctx.lineWidth = 1 + glow; ctx.stroke();
    const cy = y + dy;
    if (label === '←') icon(ctx, 'arrowL', x, cy, T.ink, 1.3); else if (label === '↑') icon(ctx, 'arrowU', x, cy, T.ink, 1.3);
    else txt(ctx, label, x, cy + 0.5, { font: FI(600, 16), color: T.ink, align: 'center' });
    ctx.restore();
  }
  function drawKeys(ctx, t) {
    const vis = KEYSTROKES.filter((k) => t >= k.t); if (!vis.length) return;
    const hudA = seg(t, 48.8, 49.1) * (1 - seg(t, 52.6, 53.1)); if (hudA <= 0.01) return;
    const gap = 14; const widths = vis.map((k) => (k.k.length > 1 ? tw(ctx, k.k, FI(600, 16)) + 40 : 56));
    const last = vis[vis.length - 1]; const ek = E.outCubic(inv(last.t, last.t + 0.25, t));
    let total = widths.reduce((s, w) => s + w + gap, -gap); total -= (widths[widths.length - 1] + gap) * (1 - ek);
    let x = W / 2 - total / 2; const y = 920;
    ctx.save(); ctx.globalAlpha *= hudA;
    vis.forEach((k, i) => {
      const w = widths[i]; const isLast = i === vis.length - 1; const age = t - k.t;
      const a = isLast ? ek : Math.max(0.35, 1 - (vis.length - 1 - i) * 0.18);
      const press = age < 0.22 ? Math.sin(Math.PI * age / 0.22) : 0;
      keycap(ctx, x + w / 2, y + (isLast ? (1 - ek) * 18 : 0), k.k, press, a, isLast ? 1 - seg(t, k.t + 0.3, k.t + 0.9) : 0);
      x += w + gap;
    });
    const dA = E.outCubic(inv(last.t, last.t + 0.3, t));
    txt(ctx, last.d, W / 2, y + 52 + (1 - dA) * 6, { font: FI(500, 15), color: T.muted, align: 'center' });
    ctx.restore();
  }

  /* ───────────────────────── Pointeur ───────────────────────── */
  function chevPos(id, t) { const L = panelLayout(t); const RL = rowsLayout(L, ROWS, hierarchy(t).vis)[id]; const row = ROWS.find((r) => r.id === id); return [L.x + 22 + row.depth * 22 + 7, RL.y + RL.h / 2 + 2]; }
  const tb = (name, t) => { const L = panelLayout(t); const b = toolbarPos(L, { liveState: t >= DRAG0 + 0.12 && t < BACK ? 2 : 0 })[name]; return [b.x + 3, b.y + 4]; };
  const FRY = (id) => rowsLayout(panelLayout(40), FROWS, fleetHierarchy(40).vis)[id].y + RH / 2;
  const plotPt = (tt, rowId, t) => { const P = plotOf(panelLayout(t)); return [P.x0 + (tt - RV[0]) / RSPAN * P.w, FRY(rowId) + 6]; };
  const POINTER = [
    { t: 7.9, p: [1420, 1010], show: true }, { t: 8.45, p: () => chevPos('conn', 8.45), d: 0.5 }, { t: 9.25, p: () => chevPos('mqtt', 9.25), d: 0.5 },
    { t: 10.1, p: () => chevPos('lora', 10.1), d: 0.5 }, { t: 11.1, p: [1180, 720], d: 0.7 }, { t: 11.5, p: [1180, 720], hide: true },
    { t: 21.6, p: [760, 1010], show: true }, { t: 22.15, p: () => tb('play', 22.15), d: 0.5 }, { t: 23.35, p: () => tb('next', 23.35), d: 0.5 },
    { t: 25.05, p: () => tb('loop', 25.05), d: 0.35 }, { t: 25.55, p: () => tb('speed', 25.55), d: 0.4 }, { t: 29.25, p: () => tb('play', 29.25), d: 0.6 },
    { t: 30.95, p: () => plotPt(G, 'p12', 30.95), d: 0.8 }, { t: 32.4, p: [1080, 1010], d: 0.8 }, { t: 33.75, p: () => tb('play', 33.75), d: 0.7 }, { t: 34.9, p: [760, 1010], d: 0.8 },
    { t: 37.55, p: () => tb('live', 37.55), d: 0.9 }, { t: 39.4, p: () => [DRAG_X0, FRY('gps')], d: 0.7 }, { t: DRAG0, p: () => [DRAG_X0, FRY('gps')] },
    { t: DRAG1, p: () => [DRAG_X0 + DRAG_PX, FRY('gps')], d: DRAG1 - DRAG0, drag: true }, { t: HIST - 0.05, p: () => [HIST_X, FRY('p12') + 6], d: 0.5 },
    { t: BACK - 0.05, p: () => tb('live', BACK - 0.05), d: 0.7 }, { t: 44.4, p: () => tb('theme', 44.4), d: 0.9 }, { t: 47.4, p: () => [1640, 1010], d: 0.6 }, { t: 47.8, p: () => [1640, 1010], hide: true },
  ];
  POINTER.forEach((k) => { if (typeof k.p === 'function') k.p = k.p(); });
  function pointerAt(t) {
    let vis = 0;
    for (const k of POINTER) { if (k.show && t >= k.t) vis = seg(t, k.t, k.t + 0.3); if (k.hide && t >= k.t) vis = 1 - seg(t, k.t, k.t + 0.3); }
    if (vis <= 0.01) return null;
    let p = POINTER[0].p;
    for (let i = 0; i < POINTER.length - 1; i++) {
      const a = POINTER[i], b = POINTER[i + 1];
      if (t >= a.t && t < b.t) { if (b.show) { p = a.p; break; } const d = b.d ?? 0.5; const k = E.inOutCubic(inv(Math.max(a.t, b.t - d), b.t, t)); p = [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k)]; break; }
      if (t >= b.t) p = b.p;
    }
    return { x: p[0], y: p[1], a: vis, drag: t >= DRAG0 && t < DRAG1 + 0.05 };
  }
  function drawPointer(ctx, t) {
    const p = pointerAt(t); if (!p) return;
    let clickK = null; for (const c of CLICKS) if (t >= c.t && t < c.t + 0.5) clickK = (t - c.t) / 0.5;
    ctx.save(); ctx.globalAlpha *= p.a;
    if (clickK != null) { ctx.save(); ctx.globalAlpha *= 1 - clickK; ctx.beginPath(); ctx.arc(p.x, p.y, 5 + 20 * E.outCubic(clickK), 0, Math.PI * 2); ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    const sc = (clickK != null ? 1 - 0.1 * Math.sin(Math.PI * Math.min(1, clickK * 2.5)) : 1) * (p.drag ? 0.94 : 1) * 1.3;
    ctx.translate(p.x, p.y); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.2, 13.2); ctx.lineTo(7.2, 19.6); ctx.lineTo(10, 18.4); ctx.lineTo(7.1, 12.2); ctx.lineTo(12.6, 12.2); ctx.closePath();
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#1E232B'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    if (p.drag) alpha(ctx, p.a * pulse(t, DRAG0, DRAG1 - DRAG0 + 0.1), () => chip(ctx, p.x + 24, p.y + 39, 'Glisser vers l’historique', { bg: T.solid, color: T.onSolid }));
  }

  /* ───────────────────────── Légendes éditoriales ───────────────────────── */
  const CHAPTERS = [
    { from: 7.2, to: 12, n: '01', tag: 'HIÉRARCHIE', title: 'Des lignes sur plusieurs niveaux, dépliables.' },
    { from: 12, to: 20, n: '02', tag: 'ÉCHELLES', title: 'De la milliseconde aux décennies, sans rupture.' },
    { from: 20, to: 30, n: '03', tag: 'REJEU', title: 'Revivre un enchaînement passé, étape par étape, sur la carte.' },
    { from: 30, to: 37, n: '04', tag: 'SYNCHRONISATION', title: 'Le curseur attend que la carte soit prête.' },
    { from: 37, to: 44, n: '05', tag: 'DIRECT', title: 'Suivre le flux, remonter l’historique, revenir au Direct.' },
    { from: 44, to: 48.6, n: '06', tag: 'THÈMES', title: 'Entièrement thémable, bien au-delà du clair et du sombre.' },
    { from: 48.6, to: 53.1, n: '07', tag: 'CLAVIER', title: 'Navigation au clavier et fenêtre de détail.' },
  ];
  function drawCaptions(ctx, t) {
    for (const c of CHAPTERS) {
      if (t < c.from || t > c.to) continue;
      const inK = E.outCubic(inv(c.from + 0.05, c.from + 0.6, t)); const in2 = E.outCubic(inv(c.from + 0.15, c.from + 0.75, t));
      const out = 1 - E.inOutCubic(inv(c.to - 0.4, c.to - 0.02, t));
      alpha(ctx, inK * out, () => {
        const y = 104 + (1 - inK) * 10 - (1 - out) * 8;
        txt(ctx, c.n, 120, y, { font: FM(600, 14), color: T.accent, ls: 1 });
        hl(ctx, 150, 150 + 22 * inK, y, T.accent, 1.2);
        txt(ctx, c.tag, 184, y, { font: FM(500, 14), color: T.muted, ls: 2.2 });
      });
      alpha(ctx, in2 * out, () => { const y = 148 + (1 - in2) * 12 - (1 - out) * 8; txt(ctx, c.title, 118, y, { font: FI(600, 32), color: T.ink, ls: -0.6 }); });
      alpha(ctx, inK * out, () => {
        txt(ctx, `${c.n} / 07`, 1800, 104, { font: FM(500, 13), color: T.faint, align: 'right' });
        const k = clamp((t - 6) / 47); hl(ctx, 1680, 1800, 126, T.line, 2); hl(ctx, 1680, 1680 + 120 * k, 126, T.accent, 2);
        txt(ctx, 'TIME WEAVE', 1800, 148, { font: FM(500, 11), color: T.faint, align: 'right', ls: 2 });
      });
    }
  }

  /* ───────────────────────── Échelle (zoom) ───────────────────────── */
  const LADDER = [['ms', 1], ['s', SEC], ['min', MIN], ['h', HOUR], ['jour', DAY], ['mois', MONTH], ['an', YEAR], ['décennie', 10 * YEAR]];
  function drawLadder(ctx, t) {
    const a = seg(t, 12.3, 12.9) * (1 - seg(t, 20.3, 20.9)); if (a <= 0.01) return;
    const span = zoomView(t).span; const x0 = 300, x1 = 1800, y = 905;
    const LX = (ms) => lerp(x0, x1, Math.log10(ms) / 12.4);
    ctx.save(); ctx.globalAlpha *= a;
    txt(ctx, 'FENÊTRE VISIBLE', 120, y - 18, { font: FM(500, 11), color: T.faint, ls: 1.8 });
    txt(ctx, spanLabel(span), 120, y + 14, { font: FM(600, 28), color: T.ink });
    hl(ctx, x0, x1, y + 0.5, T.line, 1);
    const xm = LX(span); hl(ctx, x0, xm, y + 0.5, T.accent, 2);
    for (const [lab, ms] of LADDER) { const x = LX(ms); const passed = xm >= x - 1; vl(ctx, x + 0.5, y - 6, y + 6, passed ? T.accent : T.gridMajor, 1.5); txt(ctx, lab, x, y + 26, { font: FM(500, 13), color: passed ? T.ink : T.faint, align: 'center' }); }
    ctx.beginPath(); ctx.arc(xm, y + 0.5, 8, 0, Math.PI * 2); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = T.accent; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(xm, y + 0.5, 3, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill();
    ctx.restore();
  }
  function drawZoomHint(ctx, t, L, S) {
    const a = seg(t, 12.0, 12.4) * (1 - seg(t, 19.6, 20.1)); if (a <= 0.01) return;
    const P = plotOf(L); const x = P.x0 + (T0 - S.view[0]) / (S.view[1] - S.view[0]) * P.w; const y = 640;
    const dir = t < 13.8 ? 'Zoom avant' : 'Zoom arrière';
    ctx.save(); ctx.globalAlpha *= a;
    const lab1 = 'Ctrl + molette'; const w1 = tw(ctx, lab1, FM(500, 12)) + 20; const w2 = tw(ctx, dir, FI(600, 12)) + 20;
    rr(ctx, x + 22, y, w1 + w2, 28, 8); ctx.fillStyle = T.solid; ctx.fill();
    txt(ctx, lab1, x + 32, y + 14.5, { font: FM(500, 12), color: T.onSolid });
    vl(ctx, x + 22 + w1, y + 7, y + 21, rgba('#FFFFFF', 0.25));
    txt(ctx, dir, x + 32 + w1, y + 14.5, { font: FI(600, 12), color: T.onSolid });
    const ph = (t * 3) % 1; ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.globalAlpha *= 0.9;
    rr(ctx, x - 7, y - 22, 14, 22, 7); ctx.stroke();
    ctx.beginPath(); const wy = t < 13.8 ? lerp(y - 17, y - 9, ph) : lerp(y - 9, y - 17, ph); ctx.moveTo(x, wy); ctx.lineTo(x, wy + 3); ctx.stroke();
    ctx.restore();
  }

  /* ───────────────────────── Ouverture ───────────────────────── */
  const IX0 = 586;
  function drawIntro(ctx, t) {
    if (t > 6.2) return;
    const sweep = E.inOutCubic(inv(1.25, 2.75, t)); const outK = E.inOutCubic(inv(4.5, 5.5, t));
    let lx = lerp(IX0 - 34, IX0 + 790, sweep); lx = lerp(lx, 960, outK);
    const grow = E.outExpo(inv(0.25, 1.25, t)); const cy = 538;
    const halfH = lerp(lerp(0, 168, grow), 560, E.inOutCubic(inv(4.6, 5.6, t)));
    const lineA = 1 - seg(t, 5.75, 6.15); const textA = 1 - seg(t, 4.4, 5.1); const lift = E.inOutCubic(inv(4.4, 5.2, t)) * -18;
    alpha(ctx, textA, () => {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, t < 2.75 ? lx : W), H); ctx.clip();
      txt(ctx, 'Time Weave', IX0 - 6, 500 + lift, { font: FI(600, 132), color: T.ink, ls: -4.5, base: 'alphabetic' });
      ctx.restore();
      const words = ['des', 'timelines', 'qui', 'restent', 'synchronisées'];
      let x = IX0 + 2; const y = 574 + lift;
      hl(ctx, x, x + 40 * seg(t, 2.45, 2.95), y - 12, T.accent, 3); x += 58;
      words.forEach((w, i) => { const k = E.outCubic(inv(2.6 + i * 0.09, 3.2 + i * 0.09, t)); alpha(ctx, k, () => txt(ctx, w, x, y + (1 - k) * 14, { font: FI(400, 40), color: T.muted, base: 'alphabetic', ls: -0.6 })); x += tw(ctx, w + ' ', FI(400, 40), -0.6); });
      const fy = 640 + lift; const fx0 = IX0 - 34, fx1 = IX0 + 790; const fe = t < 2.75 ? Math.min(lx, fx1) : fx1;
      if (t > 1.2) {
        hl(ctx, fx0, Math.max(fx0, fe), fy + 0.5, T.line, 1);
        for (let x2 = fx0, i = 0; x2 <= fe; x2 += 20, i++) vl(ctx, x2 + 0.5, fy - (i % 5 === 0 ? 8 : 4), fy, i % 5 === 0 ? T.faint : T.gridMajor);
        for (let i = 0; i <= 8; i++) { const x2 = fx0 + i * 100; if (x2 > fe) break; txt(ctx, `12:34:${pad(48 + i)}`, x2 + 4, fy + 18, { font: FM(400, 11), color: T.faint }); }
      }
      const tagK = seg(t, 3.1, 3.7);
      alpha(ctx, tagK, () => txt(ctx, 'TYPESCRIPT  ·  REACT  ·  TIMELINES INTERACTIVES', IX0, 356 + lift + (1 - tagK) * 8, { font: FM(500, 14), color: T.accent, ls: 2.4 }));
    });
    alpha(ctx, lineA, () => {
      vl(ctx, lx, cy - halfH, cy + halfH, T.accent, 2.5);
      const hk = seg(t, 0.95, 1.35) * (1 - seg(t, 4.3, 4.8));
      if (hk > 0.01) alpha(ctx, hk, () => cursorHandle(ctx, lx, cy - halfH - 18 + (1 - hk) * 8, clock(T0 - 8 * SEC + sweep * 8 * SEC, true), T.accent, '#FFFFFF', false));
    });
  }

  /* ───────────────────────── Logo final ───────────────────────── */
  const STRANDS = [[[3, 5], [8, 5], [14, 19], [19, 19]], [[3, 12], [8, 12], [14, 5], [19, 5]], [[3, 19], [8, 19], [14, 12], [19, 12]]];
  function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
  const LG = 1.0; // décalage du logo
  function drawLogo(ctx, t) {
    if (t < 52.8 + LG) return;
    const markS = 7.4, markW = 22 * markS;
    const wordFont = FI(600, 104), wordFontL = FI(400, 104);
    const w1 = tw(ctx, 'time', wordFont, -4), w2 = tw(ctx, 'weave', wordFontL, -4);
    const gap = 40; const total = markW + gap + w1 + w2; const x0 = W / 2 - total / 2; const cy = 492;
    const lineIn = E.outExpo(inv(53.0 + LG, 53.6 + LG, t)); const lineOut = E.inOutCubic(inv(53.7 + LG, 54.15 + LG, t));
    const lx = lerp(W / 2, x0 + 8 * markS, E.inOutCubic(inv(53.55 + LG, 54.0 + LG, t)));
    const lh = 150 * lineIn * (1 - lineOut);
    if (lh > 0.5) vl(ctx, lx, cy - lh, cy + lh, T.accent, 2.5);
    const cols = [T.accent, T.tints.green.dot, T.tints.violet.dot];
    STRANDS.forEach((s, i) => {
      const k = E.inOutCubic(inv(53.85 + LG + i * 0.13, 54.75 + LG + i * 0.13, t)); if (k <= 0) return;
      ctx.save(); ctx.translate(x0, cy - 12 * markS); ctx.scale(markS, markS);
      ctx.beginPath(); s.forEach(([px, py], j) => (j ? ctx.lineTo(px - 2, py) : ctx.moveTo(px - 2, py)));
      const len = polyLen(s); ctx.setLineDash([len * k, len]); ctx.strokeStyle = cols[i]; ctx.lineWidth = 2.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    });
    const wk = E.outCubic(inv(54.35 + LG, 55.25 + LG, t));
    if (wk > 0) {
      const wx = x0 + markW + gap;
      ctx.save(); ctx.beginPath(); ctx.rect(wx - 10, 0, (w1 + w2 + 30) * wk, H); ctx.clip();
      const off = (1 - wk) * -24;
      txt(ctx, 'time', wx + off, cy + 2, { font: wordFont, color: T.ink, ls: -4 });
      txt(ctx, 'weave', wx + w1 + off, cy + 2, { font: wordFontL, color: T.muted, ls: -4 });
      ctx.restore();
    }
    const parts = ['TypeScript', 'React', 'Open source']; const sep = '   ·   ';
    const fw = tw(ctx, parts.join(sep), FM(500, 22), 1); let x = W / 2 - fw / 2; const y = 640;
    parts.forEach((p, i) => { const k = E.outCubic(inv(55.1 + LG + i * 0.14, 55.8 + LG + i * 0.14, t)); alpha(ctx, k, () => txt(ctx, p, x, y + (1 - k) * 10, { font: FM(500, 22), color: T.muted, ls: 1 })); x += tw(ctx, p, FM(500, 22), 1); if (i < 2) { alpha(ctx, k, () => txt(ctx, sep, x, y + (1 - k) * 10, { font: FM(500, 22), color: T.faint, ls: 1 })); x += tw(ctx, sep, FM(500, 22), 1); } });
    const fk = E.inOutCubic(inv(55.6 + LG, 56.6 + LG, t));
    if (fk > 0) {
      const fy = 708, hw = 300 * fk; hl(ctx, W / 2 - hw, W / 2 + hw, fy + 0.5, T.line, 1);
      for (let i = -15; i <= 15; i++) { if (Math.abs(i * 20) > hw) continue; const xx = W / 2 + i * 20; vl(ctx, xx + 0.5, fy - (i % 5 === 0 ? 7 : 3), fy, i % 5 === 0 ? T.faint : T.gridMajor); }
      const ck = seg(t, 56.2 + LG, 56.6 + LG); const cx = W / 2 - 300 + 360 * clamp((t - 56.2 - LG) / 2.8);
      alpha(ctx, ck, () => { vl(ctx, cx, fy - 16, fy + 8, T.accent, 2); ctx.beginPath(); ctx.arc(cx, fy - 18, 3, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill(); });
    }
  }

  /* ───────────────────────── Composition ───────────────────────── */
  function cameraAt(t, L) {
    if (t >= 8.25) return null;
    const P = plotOf(L); const fw = [P.x0 + A0 * P.w, L.y + L.h / 2];
    const k = E.inOutCubic(inv(6.0, 8.2, t)); const s = explerp(7, 1, k);
    return { s, fw, fs: [lerp(960, fw[0], k), lerp(540, fw[1], k)] };
  }
  function mapStateAt(t, S) {
    const st = { time: S.cursor, loading: false, flash: 0, live: S.liveState, pin: null };
    if (t >= 30 && t < 37) { const τ = t - 30; st.loading = SYNC_LOAD(τ); st.flash = Math.max(pulse(τ, 2.7, 1.2), pulse(τ, 5.6, 0.9)); }
    if (S.focus && S.focus.a > 0) { const it = FDATA.radio[S.focus.cur.i]; const u = UNITS.find((q) => q.id === it.unit); st.pin = { p: posAt(it.unit, it.t0), a: S.focus.a * S.focus.k, label: `Radio · ${u.name} · ${clock(it.t0)}` }; }
    return st;
  }

  function renderScene(ctx, t, theme) {
    T = theme;
    ctx.save();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const L = panelLayout(t);
    const panelA = seg(t, 4.85, 5.7) * (1 - seg(t, 53.2, 53.9, E.inOutCubic));
    let S = null, geo = null;
    if (panelA > 0.001) {
      S = tlState(t);
      const cam = cameraAt(t, L);
      ctx.save(); ctx.globalAlpha *= panelA;
      if (t >= 53.2) { const k = E.inOutCubic(inv(53.2, 53.9, t)); ctx.translate(W / 2, L.y + L.h / 2); ctx.scale(lerp(1, 0.97, k), lerp(1, 0.97, k)); ctx.translate(-W / 2, -(L.y + L.h / 2)); }
      if (cam) { ctx.translate(cam.fs[0], cam.fs[1]); ctx.scale(cam.s, cam.s); ctx.translate(-cam.fw[0], -cam.fw[1]); }
      geo = drawPanel(ctx, L, S, t, cam);
      ctx.restore();
      // carte
      const mk = seg(t, 21.35, 22.1) * (1 - seg(t, 53.2, 53.9, E.inOutCubic));
      if (mk > 0.001) drawMap(ctx, { ...MAP, a: mk, dx: (1 - seg(t, 21.35, 22.1)) * 90 }, mapStateAt(t, S), t);
    }
    // requête prepareTime entre timeline et carte
    if (geo && t >= 30 && t < 37) {
      const τ = t - 30; const P = geo.P;
      const legsR = [[1.0, 1.6, false, G], [2.4, 2.7, true, G], [4.8, 5.2, false, G + RR + 40 * SEC], [5.35, 5.6, true, G + RR + 40 * SEC]];
      for (const [a0, a1, back, tt] of legsR) {
        const showA = seg(τ, a0 - 0.05, a0 + 0.1) * (1 - seg(τ, a1 + (back ? 0.25 : 0.05), a1 + (back ? 0.5 : 0.3)));
        if (showA <= 0.01) continue;
        const p0 = [geo.X(tt), P.top + AX / 2 - 14], p3 = [MAP.x, MAP.y + 30]; const c1 = [p0[0] + 60, p0[1] - 70], c2 = [p3[0] - 150, p3[1] - 50];
        const bz = (u) => { const m = 1 - u; return [m * m * m * p0[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * p3[0], m * m * m * p0[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * p3[1]]; };
        const col = back ? T.ok : T.accent;
        ctx.save(); ctx.globalAlpha *= showA;
        ctx.setLineDash([3, 5]); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...c1, ...c2, ...p3); ctx.stroke(); ctx.setLineDash([]);
        const q = bz(back ? 1 - E.inOutCubic(inv(a0, a1, τ)) : E.inOutCubic(inv(a0, a1, τ)));
        ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, Math.PI * 2); ctx.strokeStyle = rgba(col, 0.3); ctx.lineWidth = 3; ctx.stroke();
        const m = bz(0.5); chip(ctx, m[0], m[1] - 12, back ? 'prête' : 'prepareTime(request)', { align: 'center', bd: rgba(col, 0.5), color: col, font: FM(500, 12), h: 24, r: 6 });
        ctx.restore();
      }
      const cf = Math.max(pulse(τ, 2.7, 0.9), pulse(τ, 5.6, 0.7));
      if (cf > 0.01) {
        const xc = geo.X(S.cursor); const yc = P.top + AX / 2 - 2;
        ctx.save(); ctx.globalAlpha *= cf;
        chip(ctx, xc + 14, P.top + AX + 25, 'Synchronisé', { bg: T.okSoft, bd: rgba(T.ok, 0.4), color: T.ok, icon: (x, y) => icon(ctx, 'check', x, y, T.ok, 0.85) });
        ctx.beginPath(); ctx.arc(xc, yc, 14 + 22 * (1 - cf), 0, Math.PI * 2); ctx.strokeStyle = rgba(T.ok, 0.35); ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
      const s5 = sceneS(τ);
      drawSyncCode(ctx, seg(t, 30.6, 31.1) * (1 - seg(t, 36.6, 37.1)), s5.pending != null ? s5.pendingA : 0);
    }
    drawThemeCode(ctx, seg(t, 44.2, 44.7) * (1 - seg(t, 48.2, 48.7)));
    if (S && t >= 12 && t < 20.2) drawZoomHint(ctx, t, L, S);
    drawLadder(ctx, t);
    drawCaptions(ctx, t);
    drawIntro(ctx, t);
    if (t >= MODAL_OPEN && t < MODAL_CLOSE + 0.4) { const k = t < MODAL_CLOSE ? E.outCubic(inv(MODAL_OPEN, MODAL_OPEN + 0.45, t)) : 1 - E.inOutCubic(inv(MODAL_CLOSE, MODAL_CLOSE + 0.32, t)); drawModal(ctx, k, t); }
    drawKeys(ctx, t);
    drawLogo(ctx, t);
    drawPointer(ctx, t);
    ctx.restore();
  }

  let off = null;
  function offscreen() { if (!off) { off = document.createElement('canvas'); off.width = W; off.height = H; } return off.getContext('2d'); }
  function render(ctx, t) {
    t = clamp(t, 0, DURATION);
    let i = 0; for (let j = 0; j < THEME_SEQ.length; j++) if (t >= THEME_SEQ[j].t) i = j;
    const cur = THEME_SEQ[i];
    if (i === 0 || t >= cur.t + cur.d) { renderScene(ctx, t, cur.th); return; }
    const prev = THEME_SEQ[i - 1].th; const k = E.inOutCubic(inv(cur.t, cur.t + cur.d, t));
    renderScene(ctx, t, prev); const o = offscreen(); renderScene(o, t, cur.th);
    if (cur.fade) { ctx.save(); ctx.globalAlpha = k; ctx.drawImage(off, 0, 0); ctx.restore(); return; }
    const x = lerp(-30, W + 30, k);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, x), H); ctx.clip(); ctx.drawImage(off, 0, 0); ctx.restore();
    const g = ctx.createLinearGradient(x - 60, 0, x, 0); g.addColorStop(0, rgba(cur.th.accent, 0)); g.addColorStop(1, rgba(cur.th.accent, 0.22)); ctx.fillStyle = g; ctx.fillRect(x - 60, 0, 60, H);
    vl(ctx, x, 0, H, cur.th.accent, 2.5);
  }

  /* ───────────────────────── Repères sonores ───────────────────────── */
  const CUES = [];
  CUES.push({ t: 0.25, type: 'line' }, { t: 1.25, type: 'sweep', d: 1.5 }, { t: 2.6, type: 'title' }, { t: 4.5, type: 'lift' }, { t: 5.85, type: 'pullback', d: 2.4 });
  [8.55, 8.65, 9.35, 9.45, 9.55, 10.2].forEach((x, i) => CUES.push({ t: x, type: 'unfold', i }));
  CLICKS.forEach((c) => CUES.push({ t: c.t, type: 'click', target: c.target }));
  CUES.push({ t: 20.45, type: 'swap', d: 0.6 }, { t: 21.35, type: 'mapIn' });
  SR.jumps.forEach(([jt], i) => CUES.push({ t: 20 + jt, type: 'keyjump', i }));
  CUES.push({ t: 20 + sceneR(9).wrapAt, type: 'wrap' });
  CUES.push({ t: 31.0, type: 'pending', d: 1.7 }, { t: 32.4, type: 'back' }, { t: 32.7, type: 'ready' }, { t: 34.8, type: 'pending', d: 0.8 }, { t: 35.6, type: 'ready', small: true });
  CUES.push({ t: DIRECT_ON, type: 'live' }, { t: DRAG0, type: 'drag', d: DRAG1 - DRAG0 }, { t: BACK, type: 'return', d: 0.9 });
  for (const id of ['calls', 'radio', 'alerts']) for (const it of FDATA[id]) { const tt = 37 + (it.t0 - LIVE0) / LSP; if (tt > DIRECT_ON + 0.6 && tt < 53) CUES.push({ t: tt, type: 'arrive', row: id }); }
  THEME_SEQ.slice(1, 4).forEach((s, i) => CUES.push({ t: s.t, type: 'theme', d: s.d, i }));
  KEYSTROKES.forEach((k) => CUES.push({ t: k.t, type: 'key', k: k.k }));
  CUES.push({ t: MODAL_OPEN + 0.02, type: 'modalOpen' }, { t: MODAL_CLOSE + 0.02, type: 'modalClose' });
  CUES.push({ t: 53.2, type: 'outro' }, { t: 53.0 + LG, type: 'logoLine' });
  [0, 1, 2].forEach((i) => CUES.push({ t: 53.85 + LG + i * 0.13, type: 'strand', i }));
  CUES.push({ t: 54.35 + LG, type: 'logo' }, { t: 55.1 + LG, type: 'tagline' });
  CUES.sort((a, b) => a.t - b.t);
  const ZOOM_CURVE = []; for (let t = 11.5; t <= 21.6; t += 0.01) ZOOM_CURVE.push([+t.toFixed(2), Math.log10(zoomView(t).span)]);

  window.TW = { W, H, DURATION, render, CUES, ZOOM_CURVE };
})();
