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
    outQuint: (k) => 1 - Math.pow(1 - k, 5),
    outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    inOutQuart: (k) => (k < 0.5 ? 8 * k ** 4 : 1 - Math.pow(-2 * k + 2, 4) / 2),
    inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
    inCubic: (k) => k * k * k,
    outBack: (k) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
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
    name: 'light', bg: '#F7F8FA', panel: '#FFFFFF', surface: '#F9FAFB', line: '#E6E9EE', grid: '#F0F2F5', gridMajor: '#E1E5EB',
    ink: '#222832', muted: '#646C79', faint: '#9AA1AD', accent: '#4772E9', accentSoft: '#EDF2FF', live: '#D9483B', liveSoft: '#FCEDEB',
    key: '#C08A22', shadow: 'rgba(34,40,60,0.07)', dark: '#222832', onDark: '#FFFFFF', backdrop: 'rgba(30,36,48,0.28)', ok: '#2E8B57', okSoft: '#E8F5EE',
    tints: {
      blue: { bg: '#EDF4FF', bd: '#B9CFF0', ink: '#2F5D9B', dot: '#4772E9' },
      green: { bg: '#EAF6EF', bd: '#B3DCC3', ink: '#2D7650', dot: '#3E9C68' },
      amber: { bg: '#FBF3E2', bd: '#EACB8E', ink: '#87601A', dot: '#C8952F' },
      violet: { bg: '#F1EDF9', bd: '#CDBFE9', ink: '#5F4999', dot: '#8C74CF' },
    },
  };
  const DARK = {
    name: 'dark', bg: '#0E1014', panel: '#15181D', surface: '#1B1F26', line: '#2A303A', grid: '#1C2027', gridMajor: '#2A303A',
    ink: '#E6E9EF', muted: '#8E97A6', faint: '#5F6774', accent: '#7B9CF5', accentSoft: '#232C45', live: '#E5574A', liveSoft: '#341D1C',
    key: '#E0B25B', shadow: 'rgba(0,0,0,0.35)', dark: '#E6E9EF', onDark: '#15181D', backdrop: 'rgba(5,6,8,0.55)', ok: '#5CBF86', okSoft: '#1A3024',
    tints: {
      blue: { bg: '#1F2B40', bd: '#3A5684', ink: '#A9C4F1', dot: '#7B9CF5' },
      green: { bg: '#1A3024', bd: '#2F6A48', ink: '#9AD6B1', dot: '#5CBF86' },
      amber: { bg: '#362B16', bd: '#76592A', ink: '#E7C47E', dot: '#E0B25B' },
      violet: { bg: '#2A2440', bd: '#54478A', ink: '#C4B5EF', dot: '#A48FE0' },
    },
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

  /* ───────────────────────── Données ───────────────────────── */
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
    { id: 'proc', label: 'Traitements', depth: 0, tint: 'violet', kids: false },
    { id: 'inc', label: 'Incidents & alertes', depth: 0, tint: 'amber', kids: false },
  ];

  function ranges(seed, from, to, dMin, dMax, gMin, gMax, label, set) {
    const r = rng(seed), out = []; let t = from + r() * gMax, i = 0;
    while (t < to) { const d = lerp(dMin, dMax, r()); out.push({ t0: t, t1: t + d, label: typeof label === 'function' ? label(i, r) : label, set }); t += d + lerp(gMin, gMax, r()); i++; }
    return out;
  }
  function points(seed, from, to, gMin, gMax, label, set) {
    const r = rng(seed), out = []; let t = from + r() * gMax, i = 0;
    while (t < to) { out.push({ t0: t, label: typeof label === 'function' ? label(i, r) : label, set }); t += lerp(gMin, gMax, r()); i++; }
    return out;
  }
  const DATA = {
    conn: ranges(11, U(10, 30), U(16), 38 * MIN, 55 * MIN, 3 * MIN, 6 * MIN, 'Acquisition continue', 'both'),
    mqtt: ranges(12, U(10, 30), U(16), 18 * MIN, 24 * MIN, 2 * MIN, 5 * MIN, (i) => `Cycle ${pad(i + 1)}`, 'both'),
    tmp: [...ranges(13, U(10, 30), U(16), 6 * MIN, 8 * MIN, 5 * MIN, 9 * MIN, 'Mesure', 'day'),
      ...ranges(23, U(14, 20), U(15, 40), 30 * SEC, 46 * SEC, 40 * SEC, 70 * SEC, 'Mesure', 'live')],
    prs: [...ranges(14, U(10, 30), U(16), 5 * MIN, 7 * MIN, 9 * MIN, 14 * MIN, 'Mesure', 'day'),
      ...ranges(24, U(14, 20), U(15, 40), 26 * SEC, 38 * SEC, 60 * SEC, 100 * SEC, 'Mesure', 'live')],
    sta: [...ranges(15, U(10, 30), U(16), 10 * MIN, 18 * MIN, 6 * MIN, 12 * MIN, (i) => (i % 2 ? 'Synchronisation' : 'Connexion'), 'day'),
      ...points(25, U(14, 20), U(15, 40), 35 * SEC, 70 * SEC, 'Ping', 'live')],
    lora: ranges(16, U(10, 30), U(16), 22 * MIN, 30 * MIN, 8 * MIN, 14 * MIN, 'Fenêtre radio', 'both'),
    lrl: [...ranges(17, U(10, 30), U(16), 4 * MIN, 6 * MIN, 4 * MIN, 7 * MIN, 'Trame', 'day'),
      ...ranges(27, U(14, 20), U(15, 40), 16 * SEC, 26 * SEC, 24 * SEC, 44 * SEC, 'Trame', 'live')],
    proc: ranges(18, U(10, 30), U(16), 18 * MIN, 30 * MIN, 10 * MIN, 20 * MIN, (i) => ['Agrégation', 'Normalisation', 'Export des mesures'][i % 3], 'both'),
    inc: [...points(19, U(10, 30), U(16), 24 * MIN, 42 * MIN, (i) => ['Latence élevée', 'Reconnexion', 'Seuil dépassé'][i % 3], 'day'),
      ...points(29, U(14, 20), U(15, 40), 150 * SEC, 260 * SEC, (i) => ['Latence élevée', 'Reconnexion'][i % 2], 'live')],
  };
  for (const k in DATA) DATA[k].sort((a, b) => a.t0 - b.t0);

  // Données « fractales » pour le zoom continu : des événements à toutes les échelles autour de T0.
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

  /* ───────────────────────── Mise en page ───────────────────────── */
  const TB = 56, AX = 44, RH = 54, FT = 40;
  const PANEL_H = TB + AX + RH * ROWS.length + FT;
  const PANEL_Y = 196;

  function panelLayout(t) {
    const split = seg(t, 28.0, 28.9, E.inOutCubic) - seg(t, 36.0, 36.8, E.inOutCubic);
    return { x: 120, y: PANEL_Y, w: lerp(1680, 1010, split), h: PANEL_H, labelW: lerp(318, 268, split), split };
  }
  const plotOf = (L) => ({ x0: L.x + L.labelW, w: L.w - L.labelW, top: L.y + TB, rowsTop: L.y + TB + AX, bottom: L.y + L.h - FT });

  /* ───────────────────────── Hiérarchie ───────────────────────── */
  function hierarchy(t) {
    const v = { conn: 1, proc: 1, inc: 1 };
    v.mqtt = seg(t, 8.55, 9.05); v.lora = seg(t, 8.65, 9.15);
    v.tmp = seg(t, 9.35, 9.85); v.prs = seg(t, 9.45, 9.95); v.sta = seg(t, 9.55, 10.05);
    v.lrl = seg(t, 10.2, 10.7);
    const chev = { conn: seg(t, 8.42, 8.72), mqtt: seg(t, 9.22, 9.52), lora: seg(t, 10.07, 10.37) };
    const fold = seg(t, 52.0, 52.7, E.inOutCubic);
    for (const r of ROWS) if (r.depth > 0) v[r.id] *= 1 - fold;
    chev.conn *= 1 - fold; chev.mqtt *= 1 - fold; chev.lora *= 1 - fold;
    return { vis: v, chev };
  }
  function rowsLayout(L, vis) {
    const P = plotOf(L); let y = P.rowsTop; const out = {};
    for (const r of ROWS) { const v = vis[r.id]; out[r.id] = { y, h: RH * v, v }; y += RH * v; }
    return out;
  }

  /* ───────────────────────── Scénario temporel ───────────────────────── */
  const ZD = 3 * HOUR, A0 = (T0 - DAY_VIEW[0]) / ZD;
  const ZMS1 = 27, ZMS2 = 23, ZY1 = 42 * YEAR, ZY2 = 46 * YEAR;
  function zoomSpan(t) {
    if (t < 12) return { span: ZD, a: A0 };
    if (t < 13.6) { const k = E.inOutCubic(inv(12, 13.6, t)); return { span: explerp(ZD, ZMS1, k), a: lerp(A0, 0.5, k) }; }
    if (t < 14.3) return { span: explerp(ZMS1, ZMS2, E.inOutSine(inv(13.6, 14.3, t))), a: 0.5 };
    if (t < 19.4) return { span: explerp(ZMS2, ZY1, E.inOutSine(inv(14.3, 19.4, t))), a: 0.5 };
    if (t < 20) return { span: explerp(ZY1, ZY2, inv(19.4, 20, t)), a: 0.5 };
    if (t < 21.2) { const k = E.inOutCubic(inv(20, 21.2, t)); return { span: explerp(ZY2, ZD, k), a: lerp(0.5, A0, k) }; }
    return { span: ZD, a: A0 };
  }

  const R1 = 10 * MIN, R4 = 40 * MIN;
  const S4 = { play: 1.4, jumps: [[2.6, 1], [3.1, 2], [3.6, 3]], loop: 4.1, fast: 4.6, pause: 7.3 };
  function scene4(τ) {
    const r = { c: T0, playing: false, speed: '1×', loop: τ >= S4.loop + 0.04, wrapAt: null };
    if (τ < S4.play) return r;
    r.playing = τ < S4.pause;
    const tt = Math.min(τ, S4.pause);
    let c = T0, last = S4.play;
    for (const [jt, ki] of S4.jumps) {
      if (tt < jt) { r.c = c + (tt - last) * R1; return r; }
      const from = c + (jt - last) * R1, to = KEYS[ki]; c = to; last = jt;
      if (tt < jt + 0.34) { r.c = lerp(from, to + (tt - jt) * R1, E.outQuart((tt - jt) / 0.34)); return r; }
    }
    if (tt < S4.fast) { r.c = c + (tt - last) * R1; return r; }
    c += (S4.fast - last) * R1; r.speed = '4×';
    const wrapAt = S4.fast + (DAY_VIEW[1] - c) / R4; r.wrapAt = wrapAt;
    let p = c + (tt - S4.fast) * R4;
    if (p >= DAY_VIEW[1]) p = DAY_VIEW[0] + (p - DAY_VIEW[1]);
    r.c = p; return r;
  }
  const P_PAUSE = scene4(S4.pause).c;
  const G = U(14, 5);
  function scene5(τ) {
    const r = { c: P_PAUSE, playing: false, pending: null, pendingA: 0, waiting: false };
    if (τ < 3.0) r.c = P_PAUSE;
    else if (τ < 4.2) r.c = lerp(P_PAUSE, G, E.outQuart(inv(3.0, 3.36, τ)));
    else if (τ < 5.2) { r.c = G + (τ - 4.2) * R1; r.playing = true; }
    else if (τ < 6.0) { r.c = G + 1.0 * R1; r.playing = true; r.waiting = true; }
    else { r.c = G + R1 + (τ - 6.0) * R1; r.playing = true; }
    if (τ >= 1.35 && τ < 3.4) { r.pending = G; r.pendingA = seg(τ, 1.35, 1.6) * (1 - seg(τ, 3.0, 3.36)); r.waiting = τ < 3.0; }
    if (τ >= 5.2 && τ < 6.1) { r.pending = G + R1 + 1.6 * MIN; r.pendingA = seg(τ, 5.2, 5.4) * (1 - seg(τ, 5.95, 6.1)); }
    return r;
  }
  const LIVE0 = U(14, 50), LSP = 30 * SEC, SPAN_L = 15 * MIN;
  const liveNow = (t) => LIVE0 + (t - 36) * LSP;
  const follow = (n) => [n - 0.82 * SPAN_L, n + 0.18 * SPAN_L];
  const DIRECT_ON = 36.8, DRAG0 = 39.25, DRAG1 = 40.15, HIST = 40.75, BACK = 42.2;
  const DRAG_PX = 860, DRAG_X0 = 640, HIST_X = 1080;
  const plotFull = plotOf(panelLayout(40));
  const DRAG_DT = DRAG_PX / plotFull.w * SPAN_L;
  const FIXED_VIEW = follow(liveNow(DRAG0)).map((v) => v - DRAG_DT);
  const HIST_T = FIXED_VIEW[0] + (HIST_X - plotFull.x0) / plotFull.w * SPAN_L;
  const C_DIRECT = U(14, 35) + (DIRECT_ON - 36) * R1;

  function liveState(t) {
    // Renvoie vue, curseur et état du Direct pour t ≥ 36.
    const n = liveNow(t);
    const r = { view: DAY_VIEW.slice(), c: U(14, 35) + (t - 36) * R1, now: null, liveA: 0, liveClip: 0, state: 0, redK: 0, playing: true };
    if (t < DIRECT_ON) return r;
    r.now = n; r.liveA = seg(t, DIRECT_ON, DIRECT_ON + 0.6); r.liveClip = seg(t, DIRECT_ON, DIRECT_ON + 0.6, E.inOutCubic); r.state = 1;
    const fv = follow(n);
    if (t < DRAG0) {
      const k = E.inOutCubic(inv(DIRECT_ON, DIRECT_ON + 1.0, t));
      r.view = [lerp(DAY_VIEW[0], fv[0], k), lerp(DAY_VIEW[1], fv[1], k)];
      r.c = lerp(C_DIRECT + (t - DIRECT_ON) * R1, n, k); r.redK = k; return r;
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

  /* Clics du pointeur et cibles de la barre d'outils */
  const CLICKS = [
    { t: 8.5, target: 'chev' }, { t: 9.3, target: 'chev' }, { t: 10.15, target: 'chev' },
    { t: 21.4, target: 'play' }, { t: 22.6, target: 'next' }, { t: 23.1, target: 'next' }, { t: 23.6, target: 'next' },
    { t: 24.1, target: 'loop' }, { t: 24.6, target: 'speed' }, { t: 27.3, target: 'play' },
    { t: 29.35, target: 'plot' }, { t: 32.2, target: 'play' },
    { t: DIRECT_ON, target: 'live' }, { t: DRAG0, target: 'drag' }, { t: HIST, target: 'plot' }, { t: BACK, target: 'live' },
    { t: 44.4, target: 'theme' },
  ];
  const KEYSTROKES = [
    { t: 46.1, k: 'Tab', d: 'Focus sur les éléments' },
    { t: 46.6, k: '←', d: 'Élément précédent' },
    { t: 47.0, k: '←', d: 'Élément précédent' },
    { t: 47.4, k: '↑', d: 'Ligne précédente' },
    { t: 47.9, k: 'Entrée', d: 'Ouvrir la fenêtre de détail' },
    { t: 49.3, k: 'Tab', d: 'Action suivante' },
    { t: 50.4, k: 'Échap', d: 'Fermer la fenêtre' },
  ];
  const MODAL_OPEN = 47.9, MODAL_CLOSE = 50.4;

  /* Cibles de focus clavier (scène 07), calculées à l'avance */
  const FOCUS = (() => {
    const liveIdx = (id, cond) => DATA[id].map((it, i) => [it, i]).filter(([it]) => it.set === 'live' && cond(it)).map(([, i]) => i);
    const n0 = liveNow(46.1);
    const prs = liveIdx('prs', (it) => it.t1 < n0 - 25 * SEC);
    const p0 = prs[prs.length - 1];
    const p1 = prs[prs.length - 2], p2 = prs[prs.length - 3];
    const seq = [{ t: 46.1, row: 'prs', i: p0 }, { t: 46.6, row: 'prs', i: p1 }, { t: 47.0, row: 'prs', i: p2 }];
    const ref = DATA.prs[p2]; const mid = (ref.t0 + ref.t1) / 2;
    const tmp = liveIdx('tmp', () => true);
    let best = tmp[0]; for (const i of tmp) if (Math.abs((DATA.tmp[i].t0 + DATA.tmp[i].t1) / 2 - mid) < Math.abs((DATA.tmp[best].t0 + DATA.tmp[best].t1) / 2 - mid)) best = i;
    seq.push({ t: 47.4, row: 'tmp', i: best });
    return seq;
  })();
  const MODAL_ITEM = DATA.tmp[FOCUS[3].i];

  /* ───────────────────────── État de la timeline ───────────────────────── */
  function recentClick(t, target, d = 0.28) { for (const c of CLICKS) if (c.target === target && t >= c.t && t < c.t + d) return (t - c.t) / d; return null; }

  function tlState(t, L) {
    const h = hierarchy(t);
    const S = {
      view: DAY_VIEW.slice(), cursor: T0, cursorA: 1, redK: 0, vis: h.vis, chev: h.chev,
      dayA: 1, liveA: 0, fracA: 0, now: null, liveClip: 0, keysA: 1, itemsA: 1,
      playing: false, loop: false, speed: '1×', status: 'En pause', liveState: 0, pending: null, pendingA: 0, waiting: false,
      handleFmt: 'clock', focus: null, ghost: null, wrapK: 0, theme: T.name,
    };
    S.itemsA = seg(t, 6.5, 7.9);
    // Zoom (12 → 21.2)
    if (t >= 12 && t < 21.2) {
      const z = zoomSpan(t); S.view = [T0 - z.a * z.span, T0 + (1 - z.a) * z.span];
      S.fracA = seg(t, 12.55, 13.25) * (1 - seg(t, 20.45, 21.0));
      S.dayA = 1 - seg(t, 12.15, 12.85) + seg(t, 20.65, 21.15);
      S.keysA = 1 - seg(t, 12.05, 12.5) + seg(t, 20.8, 21.3);
      const sp = z.span; S.handleFmt = sp < 2 * MIN ? 'ms' : sp < 2 * DAY ? 'clock' : sp < 400 * DAY ? 'day' : 'year';
      S.status = 'Zoom';
    }
    if (t >= 20 && t < 28) {
      const s = scene4(t - 20); S.cursor = s.c; S.playing = s.playing; S.speed = s.speed; S.loop = s.loop;
      if (S.playing) S.status = s.loop ? 'Lecture · boucle' : 'Lecture';
      if (s.wrapAt != null) { const w = t - 20 - s.wrapAt; if (w >= 0 && w < 1.0) { S.wrapK = w; S.ghost = { t: DAY_VIEW[1], a: 1 - w / 0.45 }; } }
      S.keyPulse = [];
      for (const [jt, ki] of S4.jumps) { const d = t - 20 - jt; if (d >= 0 && d < 0.9) S.keyPulse.push({ i: ki, k: d / 0.9 }); }
    }
    if (t >= 28 && t < 36) {
      const s = scene5(t - 28); S.cursor = s.c; S.playing = s.playing; S.loop = true; S.pending = s.pending; S.pendingA = s.pendingA; S.waiting = s.waiting;
      S.status = s.waiting ? 'En attente de l’application' : s.playing ? 'Lecture · boucle' : 'En pause';
    }
    if (t >= 36) {
      const s = liveState(t); S.view = s.view; S.cursor = s.c; S.now = s.now; S.liveA = s.liveA; S.liveClip = s.liveClip; S.liveState = s.state; S.redK = s.redK;
      S.loop = t < DIRECT_ON; S.playing = s.playing;
      S.dayA = 1 - seg(t, DIRECT_ON, DIRECT_ON + 0.5); S.keysA = 1 - seg(t, DIRECT_ON, DIRECT_ON + 0.5);
      S.status = s.state === 1 ? 'Direct' : s.state === 2 ? 'Historique' : 'Lecture · boucle';
      if (t >= 46.0 && t < 51.6) {
        let f = null;
        for (let i = 0; i < FOCUS.length; i++) if (t >= FOCUS[i].t) f = { cur: FOCUS[i], prev: FOCUS[i - 1] || null, k: E.outCubic(inv(FOCUS[i].t, FOCUS[i].t + 0.2, t)) };
        if (f) S.focus = { ...f, a: seg(t, 46.1, 46.3) * (1 - seg(t, 51.0, 51.5)) };
      }
    }
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
      case 'loop':
        ctx.arc(0, 0, 6.5, -Math.PI * 0.15, Math.PI * 1.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6.6, -6.2); ctx.lineTo(6.4, -1.3); ctx.lineTo(1.7, -2.2); ctx.stroke(); break;
      case 'minus': ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); break;
      case 'plus': ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke(); break;
      case 'sun':
        ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * 6.3, Math.sin(a) * 6.3); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); }
        ctx.stroke(); break;
      case 'moon':
        ctx.arc(0, 0, 7, Math.PI * 0.32, Math.PI * 1.68 + 0.02, false);
        ctx.arc(3.3, -2.2, 5.6, Math.PI * 1.32, Math.PI * 0.52, true); ctx.closePath(); ctx.fill(); break;
      case 'check': ctx.moveTo(-4.5, 0.5); ctx.lineTo(-1.2, 3.8); ctx.lineTo(5, -3.5); ctx.stroke(); break;
      case 'close': ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke(); break;
      case 'chev': ctx.moveTo(-2.5, -5); ctx.lineTo(2.5, 0); ctx.lineTo(-2.5, 5); ctx.stroke(); break;
      case 'arrowR': ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(1, -4); ctx.lineTo(5, 0); ctx.lineTo(1, 4); ctx.stroke(); break;
      case 'arrowL': ctx.moveTo(5, 0); ctx.lineTo(-5, 0); ctx.moveTo(-1, -4); ctx.lineTo(-5, 0); ctx.lineTo(-1, 4); ctx.stroke(); break;
      case 'arrowU': ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.moveTo(-4, -1); ctx.lineTo(0, -5); ctx.lineTo(4, -1); ctx.stroke(); break;
      case 'layers': ctx.moveTo(0, -6); ctx.lineTo(7, -2.5); ctx.lineTo(0, 1); ctx.lineTo(-7, -2.5); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-7, 1.5); ctx.lineTo(0, 5); ctx.lineTo(7, 1.5); ctx.stroke(); break;
      case 'station': ctx.arc(0, 1, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 1, 6, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 1, 9.5, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); break;
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
    let rx = L.x + L.w - 22; b.theme = { x: rx - 16, y: cy }; rx -= 46; b.zin = { x: rx - 14, y: cy }; rx -= 32; b.zout = { x: rx - 14, y: cy }; rx -= 40;
    b.win = { x: rx, y: cy }; rx -= 118; b.div2 = rx; rx -= 14;
    const wOff = 92, wAway = 178; const lw = S ? (S.liveState === 2 ? wAway : wOff) : wOff;
    b.live = { x: rx - lw / 2, y: cy, w: lw };
    return b;
  }

  function drawToolbar(ctx, L, S, t) {
    const b = toolbarPos(L, S);
    hl(ctx, L.x, L.x + L.w, L.y + TB - 0.5, T.line);
    const btn = (name, ic, active) => {
      const p = b[name]; const pr = recentClick(t, name); const sc = pr == null ? 1 : 1 - 0.12 * Math.sin(Math.PI * pr);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
      if (active) { rr(ctx, -15, -15, 30, 30, 7); ctx.fillStyle = T.accentSoft; ctx.fill(); }
      if (pr != null) { rr(ctx, -15, -15, 30, 30, 7); ctx.strokeStyle = rgba(T.accent.length === 7 ? T.accent : '#4772E9', 0.5 * (1 - pr)); ctx.lineWidth = 3; ctx.stroke(); }
      icon(ctx, ic, 0, 0, active ? T.accent : T.muted);
      ctx.restore();
    };
    btn('stop', 'stop'); btn('prev', 'prev');
    { // lecture
      const p = b.play; const pr = recentClick(t, 'play'); const sc = pr == null ? 1 : 1 - 0.12 * Math.sin(Math.PI * pr);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fillStyle = T.dark; ctx.fill();
      if (pr != null) { ctx.beginPath(); ctx.arc(0, 0, 17 + 8 * pr, 0, Math.PI * 2); ctx.strokeStyle = rgba('#4772E9', 0.45 * (1 - pr)); ctx.lineWidth = 3; ctx.stroke(); }
      icon(ctx, S.playing ? 'pause' : 'play', S.playing ? 0 : 1, 0, T.onDark);
      ctx.restore();
    }
    btn('next', 'next'); btn('loop', 'loop', S.loop);
    vl(ctx, b.div1 + 0.5, L.y + 16, L.y + TB - 16, T.line);
    { // vitesse
      const p = b.speed; const pr = recentClick(t, 'speed');
      rr(ctx, p.x - 20, p.y - 13, 40, 26, 6); ctx.fillStyle = pr != null ? T.accentSoft : T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
      txt(ctx, S.speed, p.x, p.y + 0.5, { font: FM(500, 13), color: pr != null ? T.accent : T.ink, align: 'center' });
    }
    txt(ctx, clock(S.cursor, true), b.time.x, b.time.y + 0.5, { font: FM(500, 16), color: T.ink });
    { // statut
      const sx = b.time.x + 136; const live = S.status === 'Direct'; const waitK = S.waiting ? 1 : 0;
      const col = live ? T.live : waitK ? T.key : S.playing ? T.accent : T.faint;
      ctx.beginPath(); ctx.arc(sx + 4, b.time.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      if (S.waiting) spinner(ctx, sx + 4, b.time.y, 7, t, T.key);
      txt(ctx, S.status, sx + 16, b.time.y + 0.5, { font: FI(500, 13), color: T.muted });
    }
    // côté droit
    btn('theme', T.name === 'dark' ? 'moon' : 'sun');
    btn('zin', 'plus'); btn('zout', 'minus');
    txt(ctx, 'Fenêtre', b.win.x - 112, b.win.y + 0.5, { font: FI(500, 12), color: T.faint });
    txt(ctx, spanLabel(S.view[1] - S.view[0]), b.win.x, b.win.y + 0.5, { font: FM(500, 13), color: T.ink, align: 'right' });
    vl(ctx, b.div2 + 0.5, L.y + 16, L.y + TB - 16, T.line);
    { // Direct
      const p = b.live; const pr = recentClick(t, 'live'); const sc = pr == null ? 1 : 1 - 0.08 * Math.sin(Math.PI * pr);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
      const on = S.liveState === 1, away = S.liveState === 2;
      rr(ctx, -p.w / 2, -15, p.w, 30, 15);
      ctx.fillStyle = on ? T.live : away ? T.liveSoft : T.surface; ctx.fill();
      ctx.strokeStyle = on ? T.live : away ? rgba('#D9483B', 0.55) : T.line; ctx.lineWidth = 1; ctx.stroke();
      const label = away ? 'Revenir au Direct' : 'Direct';
      const lw = tw(ctx, label, FI(600, 13));
      const x0 = -(lw + 16) / 2;
      const pul = on ? 0.55 + 0.45 * Math.sin(t * 6) : 1;
      ctx.beginPath(); ctx.arc(x0 + 4, 0, 3.8, 0, Math.PI * 2); ctx.fillStyle = on ? rgba('#FFFFFF', pul) : away ? T.live : T.faint; ctx.fill();
      txt(ctx, label, x0 + 16, 0.5, { font: FI(600, 13), color: on ? '#FFFFFF' : away ? T.live : T.muted });
      if (pr != null) { rr(ctx, -p.w / 2 - 4 * pr, -15 - 4 * pr, p.w + 8 * pr, 30 + 8 * pr, 19); ctx.strokeStyle = rgba('#D9483B', 0.4 * (1 - pr)); ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
    }
  }

  /* ───────────────────────── Axe & grille ───────────────────────── */
  function pickSteps(span, w, minFn) {
    const ppm = w / span; let i = 0;
    while (i < STEPS.length - 1 && STEPS[i][0] * ppm < minFn(STEPS[i])) i++;
    return { i, ppm };
  }
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
  function drawAxis(ctx, P, view, labelsA = 1) {
    const span = view[1] - view[0]; const X = (t) => P.x0 + (t - view[0]) / span * P.w;
    const need = (st) => tw(ctx, LABEL_SAMPLE[st[1]], FM(500, 12)) + 34;
    const { i, ppm } = pickSteps(span, P.w, need);
    const cur = tickTimes(STEPS[i], view[0] - span * 0.1, view[1] + span * 0.1);
    const curSet = new Set(cur);
    const prevI = i - 1; let prevA = 0, prev = [];
    if (prevI >= 0) { const pxPrev = STEPS[prevI][0] * ppm; const n = need(STEPS[prevI]); prevA = clamp((pxPrev - n * 0.62) / (n * 0.38)); const minGap = (n - 24) / ppm;
      prev = tickTimes(STEPS[prevI], view[0] - span * 0.1, view[1] + span * 0.1).filter((x) => !curSet.has(x) && !cur.some((c) => Math.abs(c - x) < minGap)); }
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top, P.w, AX); ctx.clip();
    const drawSet = (arr, unit, a) => {
      if (a <= 0.01) return; ctx.save(); ctx.globalAlpha *= a * labelsA;
      for (const tt of arr) { const x = X(tt); vl(ctx, Math.round(x) + 0.5, P.top + AX - 7, P.top + AX, T.gridMajor); txt(ctx, tickLabel(tt, unit), x + 7, P.top + AX / 2 - 1, { font: FM(500, 12), color: T.muted }); }
      ctx.restore();
    };
    drawSet(cur, STEPS[i][1], 1);
    if (prevI >= 0) drawSet(prev, STEPS[prevI][1], prevA);
    ctx.restore();
    return { X, labelStep: STEPS[i] };
  }

  /* ───────────────────────── Éléments ───────────────────────── */
  function pill(ctx, x0, x1, cy, label, tint, a, active) {
    if (a <= 0.01) return; const w = Math.max(8, x1 - x0); const x = w === 8 ? (x0 + x1) / 2 - 4 : x0; const h = 26;
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x, cy - h / 2, w, h, 6); ctx.fillStyle = active ? mix(tint.bg, tint.bd, T.name === 'dark' ? 0.35 : 0.25) : tint.bg; ctx.fill();
    ctx.strokeStyle = active ? tint.dot : tint.bd; ctx.lineWidth = active ? 1.5 : 1; ctx.stroke();
    if (w > 34) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, cy - h / 2, w, h); ctx.clip();
      ctx.beginPath(); ctx.arc(x + 11, cy, 3, 0, Math.PI * 2); ctx.fillStyle = tint.dot; ctx.fill();
      const s = fit(ctx, label, w - 28, FI(500, 12.5)); if (s) txt(ctx, s, x + 20, cy + 0.5, { font: FI(500, 12.5), color: tint.ink });
      ctx.restore();
    }
    ctx.restore();
  }
  function point(ctx, x, cy, label, tint, a, room) {
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(x, cy, 5.5, 0, Math.PI * 2); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.dot; ctx.lineWidth = 1.6; ctx.stroke();
    if (label && room > 40) { const s = fit(ctx, label, room - 26, FI(500, 12.5)); if (s) txt(ctx, s, x + 12, cy + 0.5, { font: FI(500, 12.5), color: tint.ink }); }
    ctx.restore();
  }
  function groupPill(ctx, x0, x1, cy, n, tint, a) {
    if (a <= 0.01) return; const label = n >= 1000 ? frNum(n / 1000, 1) + ' k' : String(n);
    const minW = tw(ctx, label, FM(600, 12)) + 34; let w = Math.max(minW, x1 - x0); const x = (x0 + x1) / 2 - w / 2; const h = 26;
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x, cy - h / 2, w, h, 13); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.dot; ctx.lineWidth = 1.2; ctx.stroke();
    // petit empilement
    const ix = x + 13; ctx.fillStyle = tint.dot;
    ctx.globalAlpha *= 0.45; ctx.beginPath(); ctx.arc(ix + 3, cy - 1, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha /= 0.45;
    ctx.beginPath(); ctx.arc(ix, cy + 1, 3.4, 0, Math.PI * 2); ctx.fill();
    txt(ctx, label, x + 23, cy + 0.5, { font: FM(600, 12), color: tint.ink });
    ctx.restore();
  }

  function fractalBuckets(ev, view, w) {
    const span = view[1] - view[0]; const ppm = w / span;
    const u = Math.log2(74 / ppm); const k = Math.floor(u); const frac = u - k;
    const sm = (v) => { const q = clamp((v - 0.3) / 0.4); return q * q * (3 - 2 * q); };
    const layers = [[Math.pow(2, k), 1 - sm(frac)], [Math.pow(2, k + 1), sm(frac)]];
    const lo = view[0] - span * 0.1, hi = view[1] + span * 0.1;
    // recherche binaire des bornes
    let a = 0, b = ev.length; { let l = 0, r = ev.length; while (l < r) { const m = (l + r) >> 1; if (ev[m] < lo) l = m + 1; else r = m; } a = l; }
    { let l = a, r = ev.length; while (l < r) { const m = (l + r) >> 1; if (ev[m] <= hi) l = m + 1; else r = m; } b = l; }
    return layers.map(([S, al]) => {
      const out = []; const org = T0 - S / 2; let cur = null;
      for (let i = a; i < b; i++) { const bi = Math.floor((ev[i] - org) / S); if (!cur || cur.bi !== bi) { cur = { bi, n: 0, min: ev[i], max: ev[i] }; out.push(cur); } cur.n++; cur.max = ev[i]; }
      return { S, a: al, groups: out };
    });
  }

  function drawRowItems(ctx, row, RL, P, S, X, t) {
    const v = RL.v; if (v <= 0.01) return; const cy = RL.y + RH * v / 2; const tint = T.tints[row.tint];
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, RL.y, P.w, RL.h); ctx.clip();
    const baseA = v * v * S.itemsA;
    // Apparition progressive des éléments de gauche à droite (hiérarchie)
    const xr = (x) => (P.x0 + P.w - x) / P.w;
    const list = DATA[row.id];
    const span = S.view[1] - S.view[0];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      let a = it.set === 'live' ? S.liveA : it.set === 'day' ? S.dayA : Math.max(S.dayA, S.liveA > 0 ? 1 : 0) * (1 - S.fracA * 0.999);
      if (it.set === 'both' && S.fracA > 0) a = S.dayA;
      if (a <= 0.01) continue;
      let t0 = it.t0, t1 = it.t1;
      if (S.now != null) {
        if (t0 > S.now) { if (it.set === 'live') continue; a *= 1 - S.liveClip; }
        else if (t1 != null && t1 > S.now) t1 = lerp(t1, Math.max(S.now, t0 + 1), S.liveClip);
        if (it.set === 'live') a *= clamp((S.now - t0) / (0.35 * LSP));
      }
      const x0 = X(t0), x1 = t1 != null ? X(t1) : x0;
      if (x1 < P.x0 - 200 || x0 > P.x0 + P.w + 20) continue;
      const enter = row.depth === 0 && t < 9 ? seg(t, 6.9 + 0.7 * (1 - xr(x0)), 7.6 + 0.7 * (1 - xr(x0))) : 1;
      const active = S.cursorA > 0.5 && S.cursor >= t0 && t1 != null && S.cursor <= t1 && span < DAY;
      if (t1 != null) pill(ctx, x0, x1, cy, it.label, tint, a * baseA * enter, active);
      else { const nx = i + 1 < list.length ? X(list[i + 1].t0) : x0 + 400; point(ctx, x0, cy, it.label, tint, a * baseA * enter, nx - x0); }
      // flash d'arrivée en Direct
      if (it.set === 'live' && S.now != null && S.now - t0 < 0.6 * LSP && S.now >= t0) {
        const k = (S.now - t0) / (0.6 * LSP);
        ctx.save(); ctx.globalAlpha *= (1 - k) * 0.6 * S.liveA; ctx.beginPath(); ctx.arc(x0, cy, 6 + 16 * E.outCubic(k), 0, Math.PI * 2); ctx.strokeStyle = T.live; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      }
    }
    if (S.fracA > 0.01) {
      const layers = fractalBuckets(FRACTAL[row.id], S.view, P.w);
      for (const L of layers) {
        if (L.a <= 0.01) continue;
        const gs = L.groups;
        for (let g = 0; g < gs.length; g++) {
          const G0 = gs[g]; const a = L.a * S.fracA * baseA;
          if (G0.n === 1) { const nx = g + 1 < gs.length ? X(gs[g + 1].min) : X(G0.min) + 400; point(ctx, X(G0.min), cy, VOCAB[row.id], tint, a, nx - X(G0.min) - 20); }
          else groupPill(ctx, X(G0.min) - 9, X(G0.max) + 9, cy, G0.n, tint, a);
        }
      }
    }
    ctx.restore();
  }

  function itemRect(rowId, idx, RLs, X, S) {
    const it = DATA[rowId][idx]; const RL = RLs[rowId]; let t1 = it.t1 ?? it.t0;
    if (S.now != null && t1 > S.now) t1 = S.now;
    const x0 = X(it.t0), x1 = Math.max(X(t1), x0 + 8); const cy = RL.y + RH / 2;
    return { x: x0, y: cy - 13, w: x1 - x0, h: 26 };
  }

  function rowCount(row, S) {
    if (S.fracA > 0.5) { const ev = FRACTAL[row.id]; let n = 0; for (const e of ev) if (e >= S.view[0] && e <= S.view[1]) n++; return n; }
    if (S.now != null && S.liveA > 0.5) return DATA[row.id].filter((it) => it.t0 <= S.now && (it.set !== 'day')).length;
    return DATA[row.id].filter((it) => it.set !== 'live' && it.t0 < DAY_VIEW[1] && (it.t1 ?? it.t0) > DAY_VIEW[0]).length;
  }

  function drawRowLabel(ctx, row, RL, L, S, t) {
    const v = RL.v; if (v <= 0.01) return; const cy = RL.y + RH * v / 2; const tint = T.tints[row.tint];
    ctx.save(); ctx.globalAlpha *= v * v; ctx.beginPath(); ctx.rect(L.x, RL.y, L.labelW, RL.h); ctx.clip();
    const slide = (1 - v) * -8;
    const x = L.x + 22 + row.depth * 22;
    // guides d'arborescence
    for (let d = 0; d < row.depth; d++) vl(ctx, L.x + 22 + d * 22 + 6.5, RL.y, RL.y + RL.h, T.line);
    if (row.kids) {
      const k = S.chev[row.id] ?? 0; const pr = null;
      ctx.save(); ctx.translate(x + 6, cy + slide); ctx.rotate(k * Math.PI / 2); icon(ctx, 'chev', 0, 0, T.muted); ctx.restore();
    }
    const ix = x + 24;
    rr(ctx, ix, cy - 10 + slide, 20, 20, 5); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.bd; ctx.lineWidth = 1; ctx.stroke();
    if (row.depth === 2) { ctx.beginPath(); ctx.arc(ix + 10, cy + slide, 3, 0, Math.PI * 2); ctx.fillStyle = tint.dot; ctx.fill(); }
    else icon(ctx, 'layers', ix + 10, cy + slide + 0.5, tint.dot, 0.72);
    const font = row.depth === 0 ? FI(600, 14) : FI(500, 13.5);
    const maxW = L.labelW - (ix + 30 - L.x) - 46;
    txt(ctx, fit(ctx, row.label, maxW, font), ix + 30, cy + slide + 0.5, { font, color: row.depth === 0 ? T.ink : T.ink });
    const n = rowCount(row, S);
    txt(ctx, n >= 1000 ? frNum(n / 1000, 1) + ' k' : String(n), L.x + L.labelW - 18, cy + slide + 0.5, { font: FM(500, 12), color: T.faint, align: 'right' });
    ctx.restore();
  }

  function cursorHandle(ctx, x, y, label, fill, ink, outline) {
    const w = tw(ctx, label, FM(500, 12)) + 18, h = 22;
    rr(ctx, x - w / 2, y - h / 2, w, h, 6);
    if (outline) { ctx.fillStyle = T.panel; ctx.fill(); ctx.setLineDash([]); ctx.strokeStyle = fill; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = fill; ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(x - 5, y + h / 2 - 0.5); ctx.lineTo(x, y + h / 2 + 5); ctx.lineTo(x + 5, y + h / 2 - 0.5); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    txt(ctx, label, x, y + 0.5, { font: FM(500, 12), color: ink, align: 'center' });
    return w;
  }
  function handleText(S, tt) {
    switch (S.handleFmt) {
      case 'ms': return clock(tt, true);
      case 'day': return `${dayLabel(tt)} 2026`;
      case 'year': return '2026';
      default: return clock(tt);
    }
  }

  /* ───────────────────────── Panneau timeline ───────────────────────── */
  function drawPanel(ctx, L, S, t, cam) {
    const P = plotOf(L); const span = S.view[1] - S.view[0];
    const lineScale = cam ? 1 / cam.s : 1; HAIR = lineScale;
    // ombre + fond
    ctx.save(); ctx.shadowColor = T.shadow; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    rr(ctx, L.x, L.y, L.w, L.h, 14); ctx.fillStyle = T.panel; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, L.x, L.y, L.w, L.h, 14); ctx.clip();
    // colonne de structure
    ctx.fillStyle = T.surface; ctx.fillRect(L.x, P.top, L.labelW, L.h - TB);
    drawToolbar(ctx, L, S, t);
    const RLs = rowsLayout(L, S.vis);
    const rowsEnd = Object.values(RLs).reduce((m, r) => Math.max(m, r.y + r.h), P.rowsTop);
    // grille
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top, P.w, P.bottom - P.top); ctx.clip();
    const X = drawGrid(ctx, P, S.view, P.rowsTop, P.bottom);
    // zone « à venir » en Direct
    if (S.now != null && S.liveA > 0) {
      const xn = X(S.now);
      if (xn < P.x0 + P.w) { ctx.save(); ctx.globalAlpha *= S.liveA; ctx.fillStyle = T.name === 'dark' ? 'rgba(229,87,74,0.05)' : 'rgba(217,72,59,0.035)'; ctx.fillRect(xn, P.top, P.x0 + P.w - xn, P.bottom - P.top);
        ctx.strokeStyle = T.name === 'dark' ? 'rgba(229,87,74,0.10)' : 'rgba(217,72,59,0.08)'; ctx.lineWidth = 1;
        for (let k = -40; k < (P.x0 + P.w - xn) + 600; k += 14) { ctx.beginPath(); ctx.moveTo(xn + k, P.bottom); ctx.lineTo(xn + k + (P.bottom - P.rowsTop), P.rowsTop); ctx.stroke(); }
        ctx.restore(); }
    }
    ctx.restore();
    drawAxis(ctx, P, S.view);
    // séparateurs
    hl(ctx, L.x, L.x + L.w, P.top + AX - 0.5, T.line);
    vl(ctx, P.x0 - 0.5, P.top, P.bottom, T.line);
    txt(ctx, 'STRUCTURE', L.x + 22, P.top + AX / 2, { font: FM(500, 11), color: T.faint, ls: 1.6 });
    // lignes
    for (const row of ROWS) {
      const RL = RLs[row.id]; if (RL.v <= 0.01) continue;
      ctx.save(); ctx.globalAlpha *= RL.v; hl(ctx, L.x, L.x + L.w, Math.round(RL.y + RL.h) - 0.5, T.line); ctx.restore();
      drawRowLabel(ctx, row, RL, L, S, t);
      drawRowItems(ctx, row, RL, P, S, X, t);
    }
    // focus clavier
    if (S.focus && S.focus.a > 0) {
      const f = S.focus; let r = itemRect(f.cur.row, f.cur.i, RLs, X, S);
      if (f.prev && f.k < 1) { const r0 = itemRect(f.prev.row, f.prev.i, RLs, X, S); r = { x: lerp(r0.x, r.x, f.k), y: lerp(r0.y, r.y, f.k), w: lerp(r0.w, r.w, f.k), h: r.h }; }
      ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.rowsTop, P.w, P.bottom - P.rowsTop); ctx.clip(); ctx.globalAlpha *= f.a;
      rr(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, 10); ctx.strokeStyle = rgba(T.name === 'dark' ? '#7B9CF5' : '#4772E9', 0.25); ctx.lineWidth = 5; ctx.stroke();
      rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8); ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // clés
    if (S.keysA > 0.01) {
      ctx.save(); ctx.beginPath(); ctx.rect(P.x0, P.top, P.w, P.bottom - P.top); ctx.clip(); ctx.globalAlpha *= S.keysA * S.itemsA;
      KEYS.forEach((k, i) => {
        const x = X(k), y = P.top + AX - 9;
        const p = (S.keyPulse || []).find((q) => q.i === i);
        const sc = p ? 1 + 0.5 * Math.sin(Math.PI * Math.min(1, p.k * 2.2)) : 1;
        diamond(ctx, x, y, 5.5 * sc); ctx.fillStyle = T.key; ctx.fill();
        if (p) { ctx.save(); ctx.globalAlpha *= 1 - p.k; diamond(ctx, x, y, 6 + 18 * E.outCubic(p.k)); ctx.strokeStyle = T.key; ctx.lineWidth = 1.5; ctx.stroke();
          vl(ctx, x, y + 8, P.bottom, rgba(T.name === 'dark' ? '#E0B25B' : '#C08A22', 0.5 * (1 - p.k))); ctx.restore(); }
      });
      ctx.restore();
    }
    // plot clip for overlays
    ctx.save(); ctx.beginPath(); ctx.rect(P.x0 - 60, P.top, P.w + 120, P.bottom - P.top); ctx.clip();
    ctx.beginPath(); ctx.rect(P.x0, P.top - 40, P.w, P.bottom - P.top + 80); ctx.clip();
    // frontière Direct
    if (S.now != null && S.liveA > 0.01) {
      const xn = X(S.now);
      ctx.save(); ctx.globalAlpha *= S.liveA;
      vl(ctx, xn, P.top + AX, P.bottom, T.live, 2 * lineScale);
      const far = Math.abs(X(S.cursor) - xn) > 50 || S.redK < 0.5;
      if (far) { const w = tw(ctx, 'DIRECT', FM(600, 11), 1) + 16; rr(ctx, xn - w / 2, P.top + AX / 2 - 10, w, 20, 5); ctx.fillStyle = T.live; ctx.fill(); txt(ctx, 'DIRECT', xn, P.top + AX / 2 + 0.5, { font: FM(600, 11), color: '#FFFFFF', align: 'center', ls: 1 }); }
      ctx.restore();
    }
    // curseur fantôme (boucle)
    if (S.ghost && S.ghost.a > 0) { const gx = Math.min(X(S.ghost.t), P.x0 + P.w - 1); alpha(ctx, S.ghost.a, () => vl(ctx, gx, P.top + AX, P.bottom, T.accent, 2 * lineScale)); }
    // attente (pointillés)
    if (S.pending != null && S.pendingA > 0.01) {
      const xp = X(S.pending);
      ctx.save(); ctx.globalAlpha *= S.pendingA; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 30;
      vl(ctx, xp, P.top + AX + 4, P.bottom, T.accent, 1.6 * lineScale); ctx.setLineDash([]);
      cursorHandle(ctx, xp, P.top + AX / 2 - 2, clock(S.pending), T.accent, T.accent, true);
      ctx.restore();
    }
    // curseur
    if (S.cursorA > 0.01) {
      const xc = X(S.cursor); const col = S.redK > 0 ? mix(T.accent, T.live, S.redK) : T.accent;
      ctx.save(); ctx.globalAlpha *= S.cursorA;
      vl(ctx, xc, P.top + AX + 6, P.bottom, col, 2 * lineScale);
      cursorHandle(ctx, xc, P.top + AX / 2 - 2, handleText(S, S.cursor), col, '#FFFFFF', false);
      if (S.waiting && (S.pending == null || Math.abs(X(S.pending) - xc) > 4)) { /* sablier discret */ }
      ctx.restore();
    }
    ctx.restore();
    // Direct hors champ
    if (S.now != null && S.liveA > 0.01) {
      const xn = X(S.now);
      if (xn > P.x0 + P.w + 2) {
        const added = DATA.tmp.concat(DATA.prs, DATA.sta, DATA.lrl, DATA.inc).filter((it) => it.set === 'live' && it.t0 > S.view[1] && it.t0 <= S.now).length;
        const label = `Direct  +${added}`; const w = tw(ctx, label, FI(600, 12)) + 36; const x = P.x0 + P.w - w - 10, y = P.top + AX / 2 - 14;
        ctx.save(); ctx.globalAlpha *= S.liveA * seg(t, DRAG0 + 0.4, DRAG0 + 0.8);
        rr(ctx, x, y, w, 26, 13); ctx.fillStyle = T.live; ctx.fill(); txt(ctx, label, x + 12, y + 13.5, { font: FI(600, 12), color: '#FFFFFF' }); icon(ctx, 'arrowR', x + w - 15, y + 13, '#FFFFFF', 0.85);
        ctx.restore();
      }
    }
    // pied : légende
    hl(ctx, L.x, L.x + L.w, P.bottom + 0.5, T.line);
    { let x = L.x + 22; const y = P.bottom + FT / 2;
      for (const [c, l] of [['blue', 'Communication'], ['green', 'Acquisition'], ['violet', 'Traitement'], ['amber', 'Alerte']]) {
        ctx.beginPath(); ctx.arc(x + 4, y, 4, 0, Math.PI * 2); ctx.fillStyle = T.tints[c].dot; ctx.fill(); txt(ctx, l, x + 14, y + 0.5, { font: FI(500, 12), color: T.muted }); x += tw(ctx, l, FI(500, 12)) + 36;
      }
      diamond(ctx, x + 4, y, 4.5); ctx.fillStyle = T.key; ctx.fill(); txt(ctx, 'Clé', x + 14, y + 0.5, { font: FI(500, 12), color: T.muted });
      txt(ctx, S.now != null && S.liveA > 0.5 ? 'Flux · temps calendrier · UTC' : 'Temps calendrier · UTC', L.x + L.w - 22, y + 0.5, { font: FM(400, 12), color: T.faint, align: 'right' });
      // indication de boucle
      if (S.wrapK > 0 && S.wrapK < 1) {
        const k = S.wrapK; ctx.save(); ctx.globalAlpha *= Math.sin(Math.PI * clamp(k / 0.9));
        const xa = P.x0 + P.w - 30, xb = P.x0 + 30; const yy = P.bottom + FT / 2; const xh = lerp(xa, xb, E.outCubic(clamp(k / 0.7)));
        ctx.strokeStyle = T.accent; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]); hl(ctx, xh, xa, yy, T.accent, 1.5); ctx.setLineDash([]);
        ctx.fillStyle = T.panel; const lw = tw(ctx, 'Boucle · retour au début', FI(600, 12)) + 22; rr(ctx, xh - 4, yy - 11, lw, 22, 11); ctx.fill(); ctx.strokeStyle = T.accent; ctx.lineWidth = 1; ctx.stroke();
        txt(ctx, 'Boucle · retour au début', xh + 7, yy + 0.5, { font: FI(600, 12), color: T.accent });
        ctx.restore();
      }
    }
    ctx.restore();
    // bordure
    rr(ctx, L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1, 14); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    HAIR = 1;
    return { P, X, RLs };
  }

  /* ───────────────────────── Tableau de bord applicatif ───────────────────────── */
  const temp = (t) => 21.2 + 1.6 * Math.sin((t - U(12)) / (2.1 * HOUR) * Math.PI * 2) + 0.35 * Math.sin((t - U(12)) / (17 * MIN) * Math.PI * 2);
  const pres = (t) => 1012.4 + 3.1 * Math.sin((t - U(12)) / (2.9 * HOUR) * Math.PI * 2 + 1.2);
  const flow = (t) => 124 + 26 * Math.sin((t - U(12)) / (1.15 * HOUR) * Math.PI * 2 + 0.4) + 9 * Math.sin((t - U(12)) / (13 * MIN) * Math.PI * 2);

  function drawDashboard(ctx, D, st, t) {
    if (D.a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= D.a; ctx.translate(D.dx, 0);
    const { x, y, w, h } = D;
    ctx.save(); ctx.shadowColor = T.shadow; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; rr(ctx, x, y, w, h, 14); ctx.fillStyle = T.panel; ctx.fill(); ctx.restore();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 14); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    // en-tête
    rr(ctx, x + 22, y + 14, 30, 30, 8); ctx.fillStyle = T.accentSoft; ctx.fill(); icon(ctx, 'station', x + 37, y + 30, T.accent, 0.9);
    txt(ctx, 'Station Nord', x + 64, y + 22, { font: FI(600, 16), color: T.ink });
    txt(ctx, 'Votre application · tableau de bord', x + 64, y + 41, { font: FI(400, 12.5), color: T.muted });
    { // état
      const ready = !st.loading; const label = ready ? `Synchronisé · ${clock(st.time)}` : 'Préparation…';
      const lw = tw(ctx, label, FM(500, 12)) + 36; const cx = x + w - 22 - lw; const cy = y + 29;
      const flash = st.flash;
      rr(ctx, cx, cy - 13, lw, 26, 13); ctx.fillStyle = ready ? T.okSoft : T.surface; ctx.fill(); ctx.strokeStyle = ready ? rgba(T.name === 'dark' ? '#5CBF86' : '#2E8B57', 0.35 + 0.5 * flash) : T.line; ctx.lineWidth = 1 + flash; ctx.stroke();
      if (ready) icon(ctx, 'check', cx + 15, cy, T.ok, 0.9); else spinner(ctx, cx + 15, cy, 5.5, t, T.muted);
      txt(ctx, label, cx + 27, cy + 0.5, { font: FM(500, 12), color: ready ? T.ok : T.muted });
    }
    hl(ctx, x, x + w, y + 60.5, T.line);
    // indicateurs
    const tiles = [['Température', frNum(temp(st.time), 1), '°C', 'blue'], ['Pression', frNum(pres(st.time), 1), 'hPa', 'violet'], ['Débit', frNum(flow(st.time), 0), 'm³/h', 'green']];
    const tw3 = (w - 44 - 24) / 3;
    tiles.forEach(([lab, val, unit, tn], i) => {
      const tx = x + 22 + i * (tw3 + 12), ty = y + 78;
      rr(ctx, tx, ty, tw3, 98, 10); ctx.fillStyle = T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(tx + 18, ty + 22, 3.5, 0, Math.PI * 2); ctx.fillStyle = T.tints[tn].dot; ctx.fill();
      txt(ctx, lab, tx + 28, ty + 22.5, { font: FI(500, 12.5), color: T.muted });
      if (st.loading) {
        const sh = 0.5 + 0.5 * Math.sin(t * 8 - i);
        rr(ctx, tx + 16, ty + 48, tw3 * 0.55, 26, 6); ctx.fillStyle = mix(T.line, T.surface, sh * 0.6); ctx.fill();
      } else {
        const vw = tw(ctx, val, FM(500, 30));
        txt(ctx, val, tx + 16, ty + 62, { font: FM(500, 30), color: T.ink });
        txt(ctx, unit, tx + 22 + vw, ty + 65, { font: FI(500, 13), color: T.muted });
      }
    });
    // graphique
    const gx = x + 22, gy = y + 196, gw = w - 44, gh = 210;
    rr(ctx, gx, gy, gw, gh, 10); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    txt(ctx, 'Débit · m³/h', gx + 16, gy + 22, { font: FI(600, 13), color: T.ink });
    txt(ctx, '12:00 — 15:00', gx + gw - 16, gy + 22, { font: FM(400, 12), color: T.faint, align: 'right' });
    const cx0 = gx + 16, cx1 = gx + gw - 16, cy0 = gy + 44, cy1 = gy + gh - 30;
    const CX = (tt) => cx0 + (tt - DAY_VIEW[0]) / (DAY_VIEW[1] - DAY_VIEW[0]) * (cx1 - cx0);
    const CY = (v) => cy1 - (v - 80) / 90 * (cy1 - cy0);
    for (let i = 0; i <= 3; i++) { const yy = lerp(cy0, cy1, i / 3); hl(ctx, cx0, cx1, Math.round(yy) + 0.5, T.grid); }
    for (let i = 0; i <= 3; i++) txt(ctx, `${12 + i}:00`, CX(U(12 + i)), cy1 + 16, { font: FM(400, 11), color: T.faint, align: i === 0 ? 'left' : i === 3 ? 'right' : 'center' });
    ctx.beginPath(); for (let i = 0; i <= 180; i++) { const tt = lerp(DAY_VIEW[0], DAY_VIEW[1], i / 180); const px = CX(tt), py = CY(flow(tt)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.strokeStyle = T.tints.green.dot; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(cx1, cy1); ctx.lineTo(cx0, cy1); ctx.closePath(); const grd = ctx.createLinearGradient(0, cy0, 0, cy1); grd.addColorStop(0, rgba(T.name === 'dark' ? '#5CBF86' : '#3E9C68', 0.16)); grd.addColorStop(1, rgba(T.name === 'dark' ? '#5CBF86' : '#3E9C68', 0)); ctx.fillStyle = grd; ctx.fill();
    if (st.pending != null && st.pendingA > 0) { const xp = CX(st.pending); alpha(ctx, st.pendingA, () => { ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 30; vl(ctx, xp, cy0 - 6, cy1, T.accent, 1.5); ctx.setLineDash([]); }); }
    { const xm = CX(st.time); vl(ctx, xm, cy0 - 6, cy1, T.accent, 2); ctx.beginPath(); ctx.arc(xm, CY(flow(st.time)), 5, 0, Math.PI * 2); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.stroke(); }
    // événements récents
    const ly = gy + gh + 22;
    txt(ctx, 'Derniers événements', gx, ly + 6, { font: FI(600, 13), color: T.ink });
    const evs = [];
    for (const id of ['tmp', 'sta', 'proc', 'inc', 'lrl']) for (const it of DATA[id]) if (it.set !== 'live' && it.t0 <= st.time) evs.push([it, id]);
    evs.sort((a, b) => b[0].t0 - a[0].t0);
    evs.slice(0, 3).forEach(([it, id], i) => {
      const yy = ly + 34 + i * 30; const row = ROWS.find((r) => r.id === id);
      alpha(ctx, st.loading ? 0.35 : 1, () => {
        txt(ctx, clock(it.t0), gx, yy, { font: FM(500, 12.5), color: T.muted });
        ctx.beginPath(); ctx.arc(gx + 86, yy, 3.5, 0, Math.PI * 2); ctx.fillStyle = T.tints[row.tint].dot; ctx.fill();
        txt(ctx, `${it.label}`, gx + 98, yy + 0.5, { font: FI(500, 13), color: T.ink });
        txt(ctx, row.label.split(' · ')[0], gx + gw, yy + 0.5, { font: FM(400, 12), color: T.faint, align: 'right' });
      });
      if (i < 2) hl(ctx, gx, gx + gw, yy + 15.5, T.grid);
    });
    ctx.restore();
  }

  /* ───────────────────────── Carte de code ───────────────────────── */
  function drawCode(ctx, x, y, w, a, hiK, t) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= a;
    const h = 118;
    rr(ctx, x, y, w, h, 12); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    txt(ctx, 'CONTRAT DE PRÉPARATION', x + 22, y + 22, { font: FM(500, 11), color: T.faint, ls: 1.6 });
    const C = { kw: T.tints.violet.ink, fn: T.accent, id: T.ink, p: T.muted, prop: T.tints.green.ink };
    const lines = [
      [['const ', C.kw], ['controller', C.id], [' = ', C.p], ['useTimelineController', C.fn], ['({', C.p]],
      [['  prepareTime', C.prop], [': (', C.p], ['request', C.id], [') => ', C.p], ['application', C.id], ['.', C.p], ['afficherEtatA', C.fn], ['(', C.p], ['request', C.id], ['.target', C.prop], [', ', C.p], ['request', C.id], ['.signal', C.prop], ['),', C.p]],
      [['});', C.p]],
    ];
    const lh = 22; const ly0 = y + 50;
    if (hiK > 0) { ctx.save(); ctx.globalAlpha *= hiK; rr(ctx, x + 14, ly0 + lh - 11, w - 28, 22, 5); ctx.fillStyle = T.accentSoft; ctx.fill(); ctx.restore(); }
    lines.forEach((ln, i) => { let cx = x + 22; for (const [s, c] of ln) { txt(ctx, s, cx, ly0 + i * lh, { font: FM(400, 14), color: c }); cx += tw(ctx, s, FM(400, 14)); } });
    ctx.restore();
  }

  /* ───────────────────────── Fenêtre de détail ───────────────────────── */
  function drawModal(ctx, k, t, from) {
    if (k <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = T.backdrop; ctx.fillRect(0, 0, W, H); ctx.restore();
    const w = 600, h = 452; const x = (W - w) / 2, y = 252;
    const sc = lerp(0.94, 1, E.outCubic(k)); const oy = (1 - E.outCubic(k)) * 16;
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.4);
    ctx.translate(x + w / 2, y + h / 2 + oy); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20; rr(ctx, x, y, w, h, 16); ctx.fillStyle = T.panel; ctx.fill(); ctx.restore();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16); ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.stroke();
    const it = MODAL_ITEM; const tint = T.tints.blue;
    rr(ctx, x + 28, y + 28, 40, 40, 10); ctx.fillStyle = tint.bg; ctx.fill(); ctx.strokeStyle = tint.bd; ctx.stroke(); ctx.beginPath(); ctx.arc(x + 48, y + 48, 5, 0, Math.PI * 2); ctx.fillStyle = tint.dot; ctx.fill();
    txt(ctx, 'TMP-001 · MESURE', x + 84, y + 38, { font: FM(500, 11.5), color: T.faint, ls: 1.4 });
    txt(ctx, 'Transmission de télémétrie', x + 84, y + 60, { font: FI(600, 20), color: T.ink });
    rr(ctx, x + w - 60, y + 28, 32, 32, 8); ctx.fillStyle = T.surface; ctx.fill(); icon(ctx, 'close', x + w - 44, y + 44, T.muted, 0.85);
    // pastilles
    let px = x + 84; for (const [lab, tn] of [['Communication', 'blue'], ['Direct', null]]) {
      const lw = tw(ctx, lab, FI(500, 12)) + 26; rr(ctx, px, y + 80, lw, 24, 12);
      if (tn) { ctx.fillStyle = T.tints[tn].bg; ctx.fill(); ctx.strokeStyle = T.tints[tn].bd; ctx.stroke(); ctx.beginPath(); ctx.arc(px + 11, y + 92, 3, 0, Math.PI * 2); ctx.fillStyle = T.tints[tn].dot; ctx.fill(); txt(ctx, lab, px + 18, y + 92.5, { font: FI(500, 12), color: T.tints[tn].ink }); }
      else { ctx.fillStyle = T.liveSoft; ctx.fill(); ctx.beginPath(); ctx.arc(px + 11, y + 92, 3, 0, Math.PI * 2); ctx.fillStyle = T.live; ctx.fill(); txt(ctx, lab, px + 18, y + 92.5, { font: FI(500, 12), color: T.live }); }
      px += lw + 8;
    }
    hl(ctx, x, x + w, y + 124.5, T.line);
    const d = it.t1 - it.t0;
    const fields = [['Début', clock(it.t0, true)], ['Fin', clock(it.t1, true)], ['Durée', `${frNum(d / SEC, 1)} s`], ['Source', 'TMP-001'], ['Ligne', 'Réseau MQTT › TMP-001'], ['Valeur', `${frNum(temp(it.t0), 2)} °C`]];
    fields.forEach(([k2, v], i) => { const col = i % 2, rowi = Math.floor(i / 2); const fx = x + 28 + col * 280, fy = y + 150 + rowi * 50;
      txt(ctx, k2, fx, fy, { font: FI(500, 12), color: T.faint }); txt(ctx, v, fx, fy + 20, { font: FM(500, 14.5), color: T.ink }); });
    // métadonnées
    const my = y + 300; rr(ctx, x + 28, my, w - 56, 74, 8); ctx.fillStyle = T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.stroke();
    txt(ctx, '{ "topic": "capteurs/tmp-001", "qualité": "bonne",', x + 44, my + 24, { font: FM(400, 13), color: T.muted });
    txt(ctx, '  "séquence": 48 112, "latence_ms": 42 }', x + 44, my + 48, { font: FM(400, 13), color: T.muted });
    // boutons
    const by = y + h - 56; const focusBtn = t >= 49.3 ? seg(t, 49.3, 49.5) : 0;
    { const lab = 'Aller à cet instant'; const lw = tw(ctx, lab, FI(600, 13)) + 32; const bx = x + w - 28 - lw;
      if (focusBtn > 0) { ctx.save(); ctx.globalAlpha *= focusBtn; rr(ctx, bx - 4, by - 4, lw + 8, 44, 11); ctx.strokeStyle = rgba(T.name === 'dark' ? '#7B9CF5' : '#4772E9', 0.35); ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      rr(ctx, bx, by, lw, 36, 8); ctx.fillStyle = T.accent; ctx.fill(); txt(ctx, lab, bx + lw / 2, by + 18.5, { font: FI(600, 13), color: T.name === 'dark' ? '#0E1014' : '#FFFFFF', align: 'center' });
      const l2 = 'Fermer'; const w2 = tw(ctx, l2, FI(600, 13)) + 32; const bx2 = bx - 10 - w2; rr(ctx, bx2, by, w2, 36, 8); ctx.fillStyle = T.surface; ctx.fill(); ctx.strokeStyle = T.line; ctx.stroke(); txt(ctx, l2, bx2 + w2 / 2, by + 18.5, { font: FI(600, 13), color: T.ink, align: 'center' });
      txt(ctx, 'Échap pour fermer', x + 28, by + 18.5, { font: FI(400, 12.5), color: T.faint });
    }
    ctx.restore();
  }

  /* ───────────────────────── Touches ───────────────────────── */
  function keycap(ctx, x, y, label, pressK, a, glow) {
    const wide = label.length > 1; const w = wide ? tw(ctx, label, FI(600, 16)) + 40 : 56; const h = 52;
    const dy = pressK * 3;
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x - w / 2, y - h / 2 + 4, w, h, 10); ctx.fillStyle = T.name === 'dark' ? '#0A0C0F' : '#DCE0E7'; ctx.fill();
    rr(ctx, x - w / 2, y - h / 2 + dy, w, h, 10); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = glow > 0 ? mix(T.line, T.name === 'dark' ? '#7B9CF5' : '#4772E9', glow) : T.line; ctx.lineWidth = 1 + glow; ctx.stroke();
    const cy = y + dy;
    if (label === '←') icon(ctx, 'arrowL', x, cy, T.ink, 1.3); else if (label === '↑') icon(ctx, 'arrowU', x, cy, T.ink, 1.3); else if (label === '→') icon(ctx, 'arrowR', x, cy, T.ink, 1.3);
    else txt(ctx, label, x, cy + 0.5, { font: FI(600, 16), color: T.ink, align: 'center' });
    ctx.restore();
    return w;
  }
  function drawKeys(ctx, t) {
    const vis = KEYSTROKES.filter((k) => t >= k.t);
    if (!vis.length) return; const hudA = seg(t, 46.0, 46.3) * (1 - seg(t, 51.4, 52.0));
    if (hudA <= 0.01) return;
    const gap = 14; const widths = vis.map((k) => (k.k.length > 1 ? tw(ctx, k.k, FI(600, 16)) + 40 : 56));
    // largeur animée : la dernière touche entre en glissant
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
  function chevPos(id, t) { const L = panelLayout(t); const RL = rowsLayout(L, hierarchy(t).vis)[id]; const row = ROWS.find((r) => r.id === id); return [L.x + 22 + row.depth * 22 + 7, RL.y + RL.h / 2 + 2]; }
  const tb = (name, t) => { const L = panelLayout(t); const S = { liveState: t >= DRAG0 + 0.12 && t < BACK ? 2 : 0 }; const b = toolbarPos(L, S)[name]; return [b.x + 3, b.y + 4]; };
  const plotPt = (tt, rowId, t) => { const L = panelLayout(t); const P = plotOf(L); const RL = rowsLayout(L, hierarchy(t).vis)[rowId]; return [P.x0 + (tt - DAY_VIEW[0]) / (DAY_VIEW[1] - DAY_VIEW[0]) * P.w, RL.y + RH / 2 + 6]; };
  const RY = (id) => { const L = panelLayout(40); return rowsLayout(L, hierarchy(40).vis)[id].y + RH / 2; };
  const POINTER = [
    { t: 7.9, p: [1420, 1010], show: true }, { t: 8.45, p: () => chevPos('conn', 8.45), d: 0.5 }, { t: 9.25, p: () => chevPos('mqtt', 9.25), d: 0.5 },
    { t: 10.1, p: () => chevPos('lora', 10.1), d: 0.5 }, { t: 11.1, p: [1180, 720], d: 0.7 }, { t: 11.5, p: [1180, 720], hide: true },
    { t: 20.9, p: [1300, 1000], show: true }, { t: 21.35, p: () => tb('play', 21.35), d: 0.45 }, { t: 22.55, p: () => tb('next', 22.55), d: 0.45 },
    { t: 24.05, p: () => tb('loop', 24.05), d: 0.35 }, { t: 24.55, p: () => tb('speed', 24.55), d: 0.4 }, { t: 27.25, p: () => tb('play', 27.25), d: 0.6 },
    { t: 29.3, p: () => plotPt(G, 'prs', 29.3), d: 0.8 }, { t: 32.15, p: () => tb('play', 32.15), d: 0.7 }, { t: 33.4, p: [760, 1000], d: 0.9 },
    { t: 36.75, p: () => tb('live', 36.75), d: 0.9 }, { t: 39.15, p: () => [DRAG_X0, RY('sta')], d: 0.7 }, { t: DRAG0, p: () => [DRAG_X0, RY('sta')] },
    { t: DRAG1, p: () => [DRAG_X0 + DRAG_PX, RY('sta')], d: DRAG1 - DRAG0, drag: true }, { t: HIST - 0.05, p: () => [HIST_X, RY('tmp') + 6], d: 0.5 },
    { t: BACK - 0.05, p: () => tb('live', BACK - 0.05), d: 0.7 }, { t: 44.35, p: () => tb('theme', 44.35), d: 0.9 }, { t: 45.0, p: () => [1640, 1000], d: 0.6 }, { t: 45.4, p: () => [1640, 1000], hide: true },
  ];
  POINTER.forEach((k) => { if (typeof k.p === 'function') k.p = k.p(); });
  function pointerAt(t) {
    // visibilité
    let vis = 0;
    for (let i = 0; i < POINTER.length; i++) { const k = POINTER[i]; if (k.show && t >= k.t) vis = seg(t, k.t, k.t + 0.3); if (k.hide && t >= k.t) vis = 1 - seg(t, k.t, k.t + 0.3); }
    if (vis <= 0.01) return null;
    let p = POINTER[0].p;
    for (let i = 0; i < POINTER.length - 1; i++) {
      const a = POINTER[i], b = POINTER[i + 1];
      if (t >= a.t && t < b.t) { if (b.show) { p = a.p; break; } const d = b.d ?? 0.5; const k = (b.drag ? E.inOutCubic : E.inOutCubic)(inv(Math.max(a.t, b.t - d), b.t, t)); p = [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k)]; break; }
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
    if (p.drag) { // indication de glissement
      ctx.save(); ctx.globalAlpha *= p.a * pulse(t, DRAG0, DRAG1 - DRAG0 + 0.1);
      const lab = 'Glisser vers l’historique'; const lw = tw(ctx, lab, FI(600, 12)) + 24;
      rr(ctx, p.x + 24, p.y + 26, lw, 26, 13); ctx.fillStyle = T.dark; ctx.fill(); txt(ctx, lab, p.x + 36, p.y + 39.5, { font: FI(600, 12), color: T.onDark });
      ctx.restore();
    }
  }

  /* ───────────────────────── Légendes éditoriales ───────────────────────── */
  const CHAPTERS = [
    { from: 7.2, to: 12, n: '01', tag: 'HIÉRARCHIE', title: 'Des lignes sur plusieurs niveaux, dépliables.' },
    { from: 12, to: 20, n: '02', tag: 'ÉCHELLES', title: 'De la milliseconde aux décennies, sans rupture.' },
    { from: 20, to: 28, n: '03', tag: 'LECTURE', title: 'Lecture, sauts entre clés, boucle sur la période.' },
    { from: 28, to: 36, n: '04', tag: 'SYNCHRONISATION', title: 'Le curseur attend que votre application soit prête.' },
    { from: 36, to: 44, n: '05', tag: 'DIRECT', title: 'Suivre le flux, remonter l’historique, revenir au Direct.' },
    { from: 44, to: 52.1, n: '06', tag: 'THÈMES & CLAVIER', title: 'Thème sombre, fenêtre de détail, navigation au clavier.' },
  ];
  function drawCaptions(ctx, t) {
    for (const c of CHAPTERS) {
      if (t < c.from || t > c.to) continue;
      const inK = E.outCubic(inv(c.from + 0.05, c.from + 0.6, t)); const in2 = E.outCubic(inv(c.from + 0.15, c.from + 0.75, t));
      const out = 1 - E.inOutCubic(inv(c.to - 0.4, c.to - 0.02, t));
      alpha(ctx, inK * out, () => {
        const y = 104 + (1 - inK) * 10 - (1 - out) * 8;
        txt(ctx, `${c.n}`, 120, y, { font: FM(600, 14), color: T.accent, ls: 1 });
        hl(ctx, 150, 150 + 22 * inK, y, T.accent, 1.2);
        txt(ctx, c.tag, 184, y, { font: FM(500, 14), color: T.muted, ls: 2.2 });
      });
      alpha(ctx, in2 * out, () => { const y = 148 + (1 - in2) * 12 - (1 - out) * 8; txt(ctx, c.title, 118, y, { font: FI(600, 32), color: T.ink, ls: -0.6 }); });
      alpha(ctx, inK * out, () => {
        txt(ctx, `${c.n} / 06`, 1800, 104, { font: FM(500, 13), color: T.faint, align: 'right' });
        const k = clamp((t - 6) / 46); hl(ctx, 1680, 1800, 126, T.line, 2); hl(ctx, 1680, 1680 + 120 * k, 126, T.accent, 2);
        txt(ctx, 'TIME WEAVE', 1800, 148, { font: FM(500, 11), color: T.faint, align: 'right', ls: 2 });
      });
    }
  }

  /* ───────────────────────── Échelle (zoom) ───────────────────────── */
  const LADDER = [['ms', 1], ['s', SEC], ['min', MIN], ['h', HOUR], ['jour', DAY], ['mois', MONTH], ['an', YEAR], ['décennie', 10 * YEAR]];
  function drawLadder(ctx, t) {
    const a = seg(t, 12.3, 12.9) * (1 - seg(t, 20.5, 21.1)); if (a <= 0.01) return;
    const span = zoomSpan(t).span; const x0 = 300, x1 = 1800, y = 905;
    const LX = (ms) => lerp(x0, x1, Math.log10(ms) / 12.4);
    ctx.save(); ctx.globalAlpha *= a;
    txt(ctx, 'FENÊTRE VISIBLE', 120, y - 18, { font: FM(500, 11), color: T.faint, ls: 1.8 });
    txt(ctx, spanLabel(span), 120, y + 14, { font: FM(600, 28), color: T.ink });
    hl(ctx, x0, x1, y + 0.5, T.line, 1);
    const xm = LX(span);
    hl(ctx, x0, xm, y + 0.5, T.accent, 2);
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
    rr(ctx, x + 22, y, w1 + w2, 28, 8); ctx.fillStyle = T.dark; ctx.fill();
    txt(ctx, lab1, x + 32, y + 14.5, { font: FM(500, 12), color: T.onDark });
    vl(ctx, x + 22 + w1, y + 7, y + 21, rgba('#FFFFFF', 0.25));
    txt(ctx, dir, x + 32 + w1, y + 14.5, { font: FI(600, 12), color: T.onDark });
    // molette animée
    const ph = (t * 3) % 1; ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.globalAlpha *= 0.9;
    rr(ctx, x - 7, y - 22, 14, 22, 7); ctx.stroke();
    ctx.beginPath(); const wy = t < 13.8 ? lerp(y - 17, y - 9, ph) : lerp(y - 9, y - 17, ph); ctx.moveTo(x, wy); ctx.lineTo(x, wy + 3); ctx.stroke();
    ctx.restore();
  }

  /* ───────────────────────── Ouverture ───────────────────────── */
  const IX0 = 586;
  function drawIntro(ctx, t) {
    if (t > 6.2) return;
    const sweep = E.inOutCubic(inv(1.25, 2.75, t));
    const outK = E.inOutCubic(inv(4.5, 5.5, t));
    const lineX0 = IX0 - 34, lineX1 = IX0 + 790;
    let lx = lerp(lineX0, lineX1, sweep); lx = lerp(lx, 960, outK);
    const grow = E.outExpo(inv(0.25, 1.25, t));
    const cy = 538; const halfH = lerp(lerp(0, 168, grow), 560, E.inOutCubic(inv(4.6, 5.6, t)));
    const lineA = 1 - seg(t, 5.75, 6.15);
    // titre révélé par le curseur
    const textA = 1 - seg(t, 4.4, 5.1);
    const lift = E.inOutCubic(inv(4.4, 5.2, t)) * -18;
    alpha(ctx, textA, () => {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, (t < 2.75 ? lx : W)), H); ctx.clip();
      txt(ctx, 'Time Weave', IX0 - 6, 500 + lift, { font: FI(600, 132), color: T.ink, ls: -4.5, base: 'alphabetic' });
      ctx.restore();
      const words = ['des', 'timelines', 'qui', 'restent', 'synchronisées'];
      let x = IX0 + 2; const y = 574 + lift;
      const dashK = seg(t, 2.45, 2.95);
      hl(ctx, x, x + 40 * dashK, y - 12, T.accent, 3);
      x += 58;
      words.forEach((w, i) => { const k = E.outCubic(inv(2.6 + i * 0.09, 3.2 + i * 0.09, t)); alpha(ctx, k, () => txt(ctx, w, x, y + (1 - k) * 14, { font: FI(400, 40), color: T.muted, base: 'alphabetic', ls: -0.6 })); x += tw(ctx, w + ' ', FI(400, 40), -0.6); });
      // filet gradué
      const fy = 640 + lift; const fx0 = IX0 - 34, fx1 = IX0 + 790; const fx = Math.min(lx, fx1);
      if (t > 1.2) { hl(ctx, fx0, Math.max(fx0, t < 2.75 ? fx : fx1), fy + 0.5, T.line, 1);
        for (let x2 = fx0, i = 0; x2 <= (t < 2.75 ? fx : fx1); x2 += 20, i++) vl(ctx, x2 + 0.5, fy - (i % 5 === 0 ? 8 : 4), fy, i % 5 === 0 ? T.faint : T.gridMajor);
        for (let i = 0; i <= 8; i++) { const x2 = fx0 + i * 100; if (x2 > (t < 2.75 ? fx : fx1)) break; txt(ctx, `12:34:${pad(48 + i)}`, x2 + 4, fy + 18, { font: FM(400, 11), color: T.faint }); }
      }
      const tagK = seg(t, 3.1, 3.7);
      alpha(ctx, tagK, () => txt(ctx, 'TYPESCRIPT  ·  REACT  ·  TIMELINES INTERACTIVES', IX0, 356 + lift + (1 - tagK) * 8, { font: FM(500, 14), color: T.accent, ls: 2.4 }));
    });
    // le trait bleu
    alpha(ctx, lineA, () => {
      vl(ctx, lx, cy - halfH, cy + halfH, T.accent, 2.5);
      const hk = seg(t, 0.95, 1.35) * (1 - seg(t, 4.3, 4.8));
      if (hk > 0.01) alpha(ctx, hk, () => {
        const tt = T0 - 8 * SEC + sweep * 8 * SEC; const lab = clock(tt, true);
        const yH = cy - halfH - 18 + (1 - hk) * 8;
        cursorHandle(ctx, lx, yH, lab, T.accent, '#FFFFFF', false);
      });
    });
  }

  /* ───────────────────────── Logo final ───────────────────────── */
  const STRANDS = [[[3, 5], [8, 5], [14, 19], [19, 19]], [[3, 12], [8, 12], [14, 5], [19, 5]], [[3, 19], [8, 19], [14, 12], [19, 12]]];
  function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
  function drawLogo(ctx, t) {
    if (t < 52.8) return;
    const markS = 7.4, markW = 22 * markS;
    const wordFont = FI(600, 104), wordFontL = FI(400, 104);
    const w1 = tw(ctx, 'time', wordFont, -4), w2 = tw(ctx, 'weave', wordFontL, -4);
    const gap = 40; const total = markW + gap + w1 + w2; const x0 = W / 2 - total / 2; const cy = 492;
    // trait vertical (écho de l'ouverture)
    const lineIn = E.outExpo(inv(53.0, 53.6, t)); const lineOut = E.inOutCubic(inv(53.7, 54.15, t));
    const lx = lerp(W / 2, x0 + 8 * markS, E.inOutCubic(inv(53.55, 54.0, t)));
    const lh = 150 * lineIn * (1 - lineOut);
    if (lh > 0.5) vl(ctx, lx, cy - lh, cy + lh, T.accent, 2.5);
    // brins
    const cols = [T.accent, T.tints.green.dot, T.tints.violet.dot];
    STRANDS.forEach((s, i) => {
      const k = E.inOutCubic(inv(53.85 + i * 0.13, 54.75 + i * 0.13, t)); if (k <= 0) return;
      ctx.save(); ctx.translate(x0, cy - 12 * markS); ctx.scale(markS, markS);
      ctx.beginPath(); s.forEach(([px, py], j) => (j ? ctx.lineTo(px - 2, py) : ctx.moveTo(px - 2, py)));
      const len = polyLen(s); ctx.setLineDash([len * k, len]); ctx.strokeStyle = cols[i]; ctx.lineWidth = 2.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    });
    // mot-symbole
    const wk = E.outCubic(inv(54.35, 55.25, t));
    if (wk > 0) {
      const wx = x0 + markW + gap;
      ctx.save(); ctx.beginPath(); ctx.rect(wx - 10, 0, (w1 + w2 + 30) * wk, H); ctx.clip();
      const off = (1 - wk) * -24;
      txt(ctx, 'time', wx + off, cy + 2, { font: wordFont, color: T.ink, ls: -4, base: 'middle' });
      txt(ctx, 'weave', wx + w1 + off, cy + 2, { font: wordFontL, color: T.muted, ls: -4, base: 'middle' });
      ctx.restore();
    }
    // signature
    const tg = E.outCubic(inv(55.1, 55.9, t));
    const parts = ['TypeScript', 'React', 'Open source'];
    const sep = '   ·   '; const full = parts.join(sep); const fw = tw(ctx, full, FM(500, 22), 1);
    let x = W / 2 - fw / 2; const y = 640;
    parts.forEach((p, i) => { const k = E.outCubic(inv(55.1 + i * 0.14, 55.8 + i * 0.14, t)); alpha(ctx, k, () => txt(ctx, p, x, y + (1 - k) * 10, { font: FM(500, 22), color: T.muted, ls: 1 })); x += tw(ctx, p, FM(500, 22), 1); if (i < 2) { alpha(ctx, k, () => txt(ctx, sep, x, y + (1 - k) * 10, { font: FM(500, 22), color: T.faint, ls: 1 })); x += tw(ctx, sep, FM(500, 22), 1); } });
    // filet + curseur qui continue d'avancer
    const fk = E.inOutCubic(inv(55.6, 56.6, t));
    if (fk > 0) {
      const fy = 708, hw = 300 * fk; hl(ctx, W / 2 - hw, W / 2 + hw, fy + 0.5, T.line, 1);
      for (let i = -15; i <= 15; i++) { const xx = W / 2 + i * 20; if (Math.abs(i * 20) > hw) continue; vl(ctx, xx + 0.5, fy - (i % 5 === 0 ? 7 : 3), fy, i % 5 === 0 ? T.faint : T.gridMajor); }
      const ck = seg(t, 56.2, 56.6); const cx = W / 2 - 300 + 600 * clamp((t - 56.2) / 3.8) * 0.6 + 0;
      alpha(ctx, ck, () => { vl(ctx, cx, fy - 16, fy + 8, T.accent, 2); ctx.beginPath(); ctx.arc(cx, fy - 18, 3, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill(); });
    }
  }

  /* ───────────────────────── Composition ───────────────────────── */
  function cameraAt(t, L) {
    if (t >= 8.25) return null;
    const P = plotOf(L); const fw = [P.x0 + A0 * P.w, L.y + L.h / 2];
    const k = E.inOutCubic(inv(6.0, 8.2, t)); const s = explerp(7, 1, k);
    const fs = [lerp(960, fw[0], k), lerp(540, fw[1], k)];
    return { s, fw, fs };
  }

  function renderScene(ctx, t, theme) {
    T = theme;
    ctx.save();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const L = panelLayout(t);
    const panelA = seg(t, 4.85, 5.7) * (1 - seg(t, 52.2, 52.9, E.inOutCubic));
    let S = null, geo = null;
    if (panelA > 0.001) {
      S = tlState(t, L);
      const cam = cameraAt(t, L);
      ctx.save(); ctx.globalAlpha *= panelA;
      if (t >= 52.2) { const k = E.inOutCubic(inv(52.2, 52.9, t)); ctx.translate(W / 2, L.y + L.h / 2); ctx.scale(lerp(1, 0.97, k), lerp(1, 0.97, k)); ctx.translate(-W / 2, -(L.y + L.h / 2)); }
      if (cam) { ctx.translate(cam.fs[0], cam.fs[1]); ctx.scale(cam.s, cam.s); ctx.translate(-cam.fw[0], -cam.fw[1]); }
      geo = drawPanel(ctx, L, S, t, cam);
      ctx.restore();
    }
    // tableau de bord (écran partagé)
    if (t >= 28 && t < 37) {
      const k = seg(t, 28.62, 29.4, E.outCubic) * (1 - seg(t, 35.55, 36.1, E.inOutCubic));
      const τ = t - 28; const s5 = scene5(τ);
      const loading = (τ >= 1.65 && τ < 3.0) || (τ >= 5.3 && τ < 6.0);
      const flash = Math.max(pulse(τ, 3.0, 0.9), pulse(τ, 6.0, 0.7));
      const D = { x: 1154, y: PANEL_Y, w: 646, h: PANEL_H, a: k, dx: (1 - k) * 90 };
      drawDashboard(ctx, D, { time: s5.c, loading, flash, pending: s5.pending, pendingA: s5.pendingA }, t);
      // requête prepareTime : aller-retour entre timeline et application
      if (geo && k > 0.5) {
        const P = geo.P; const legs = [[1.35, 1.95, false, G], [2.7, 3.0, true, G], [5.2, 5.6, false, G + R1 + 1.6 * MIN], [5.75, 6.0, true, G + R1 + 1.6 * MIN]];
        for (const [a0, a1, back, tt] of legs) {
          const showA = seg(τ, a0 - 0.05, a0 + 0.1) * (1 - seg(τ, a1 + (back ? 0.25 : 0.05), a1 + (back ? 0.5 : 0.3)));
          if (showA <= 0.01) continue;
          const p0 = [geo.X(tt), P.top + AX / 2 - 14], p3 = [D.x, D.y + 30]; const c1 = [p0[0] + 70, p0[1] - 62], c2 = [p3[0] - 150, p3[1] - 44];
          const bz = (u) => { const m = 1 - u; return [m * m * m * p0[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * p3[0], m * m * m * p0[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * p3[1]]; };
          ctx.save(); ctx.globalAlpha *= showA * k;
          ctx.setLineDash([3, 5]); ctx.strokeStyle = back ? T.ok : T.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...c1, ...c2, ...p3); ctx.stroke(); ctx.setLineDash([]);
          const u = E.inOutCubic(inv(a0, a1, τ)); const q = bz(back ? 1 - u : u);
          ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, Math.PI * 2); ctx.fillStyle = back ? T.ok : T.accent; ctx.fill();
          ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, Math.PI * 2); ctx.strokeStyle = rgba(back ? '#2E8B57' : '#4772E9', 0.3); ctx.lineWidth = 3; ctx.stroke();
          const m = bz(0.5); const lab = back ? 'prête' : 'prepareTime(request)'; const lw = tw(ctx, lab, FM(500, 12)) + 20;
          rr(ctx, m[0] - lw / 2, m[1] - 24, lw, 24, 6); ctx.fillStyle = T.panel; ctx.fill(); ctx.strokeStyle = back ? rgba('#2E8B57', 0.5) : rgba('#4772E9', 0.45); ctx.lineWidth = 1; ctx.stroke();
          txt(ctx, lab, m[0], m[1] - 11.5, { font: FM(500, 12), color: back ? T.ok : T.accent, align: 'center' });
          ctx.restore();
        }
        // confirmation simultanée
        const cf = Math.max(pulse(τ, 3.0, 0.8), pulse(τ, 6.0, 0.6));
        if (cf > 0.01) {
          const xc = geo.X(s5.c); const yc = P.top + AX / 2 - 2;
          ctx.save(); ctx.globalAlpha *= cf;
          const lab = 'Synchronisé'; const lw = tw(ctx, lab, FI(600, 12)) + 34; const bx = xc + 14, by = P.top + AX + 12;
          rr(ctx, bx, by, lw, 26, 13); ctx.fillStyle = T.okSoft; ctx.fill(); ctx.strokeStyle = rgba('#2E8B57', 0.4); ctx.stroke(); icon(ctx, 'check', bx + 14, by + 13, T.ok, 0.85); txt(ctx, lab, bx + 25, by + 13.5, { font: FI(600, 12), color: T.ok });
          ctx.beginPath(); ctx.arc(xc, yc, 14 + 22 * (1 - cf), 0, Math.PI * 2); ctx.strokeStyle = rgba('#2E8B57', 0.35); ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
        }
      }
      const codeA = seg(t, 28.9, 29.5) * (1 - seg(t, 35.8, 36.4));
      drawCode(ctx, 120, 852, 1010, codeA, (s5.pending != null ? s5.pendingA : 0), t);
    }
    if (S && t >= 12 && t < 20.2) drawZoomHint(ctx, t, L, S);
    drawLadder(ctx, t);
    drawCaptions(ctx, t);
    drawIntro(ctx, t);
    // fenêtre de détail
    if (t >= MODAL_OPEN && t < MODAL_CLOSE + 0.4) { const k = t < MODAL_CLOSE ? E.outCubic(inv(MODAL_OPEN, MODAL_OPEN + 0.45, t)) : 1 - E.inOutCubic(inv(MODAL_CLOSE, MODAL_CLOSE + 0.32, t)); drawModal(ctx, k, t); }
    drawKeys(ctx, t);
    drawLogo(ctx, t);
    drawPointer(ctx, t);
    ctx.restore();
  }

  let off = null;
  function offscreen() { if (!off) { off = document.createElement('canvas'); off.width = W; off.height = H; } return off.getContext('2d'); }
  const WIPE0 = 44.55, WIPE1 = 45.75, FADE0 = 52.45, FADE1 = 53.25;
  function render(ctx, t) {
    t = clamp(t, 0, DURATION);
    if (t < WIPE0) renderScene(ctx, t, LIGHT);
    else if (t < WIPE1) {
      const k = E.inOutCubic(inv(WIPE0, WIPE1, t)); const x = lerp(-30, W + 30, k);
      renderScene(ctx, t, LIGHT); const o = offscreen(); renderScene(o, t, DARK);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, x), H); ctx.clip(); ctx.drawImage(off, 0, 0); ctx.restore();
      const g = ctx.createLinearGradient(x - 60, 0, x, 0); g.addColorStop(0, 'rgba(123,156,245,0)'); g.addColorStop(1, 'rgba(123,156,245,0.22)'); ctx.fillStyle = g; ctx.fillRect(x - 60, 0, 60, H);
      vl(ctx, x, 0, H, '#4772E9', 2.5);
    } else if (t < FADE0) renderScene(ctx, t, DARK);
    else if (t < FADE1) { const k = E.inOutSine(inv(FADE0, FADE1, t)); renderScene(ctx, t, LIGHT); const o = offscreen(); renderScene(o, t, DARK); ctx.save(); ctx.globalAlpha = 1 - k; ctx.drawImage(off, 0, 0); ctx.restore(); }
    else renderScene(ctx, t, LIGHT);
  }

  /* ───────────────────────── Repères sonores ───────────────────────── */
  const CUES = [];
  CUES.push({ t: 0.25, type: 'line' }, { t: 1.25, type: 'sweep', d: 1.5 }, { t: 2.6, type: 'title' }, { t: 4.5, type: 'lift' }, { t: 5.85, type: 'pullback', d: 2.4 });
  [8.55, 8.65, 9.35, 9.45, 9.55, 10.2].forEach((x, i) => CUES.push({ t: x, type: 'unfold', i }));
  CLICKS.forEach((c) => CUES.push({ t: c.t, type: 'click', target: c.target }));
  S4.jumps.forEach(([jt], i) => CUES.push({ t: 20 + jt, type: 'keyjump', i }));
  { const w = scene4(7).wrapAt; CUES.push({ t: 20 + w, type: 'wrap' }); }
  CUES.push({ t: 29.35, type: 'pending', d: 1.65 }, { t: 30.7, type: 'back' }, { t: 31.0, type: 'ready' }, { t: 33.2, type: 'pending', d: 0.8 }, { t: 34.0, type: 'ready', small: true });
  CUES.push({ t: DIRECT_ON, type: 'live' }, { t: DRAG0, type: 'drag', d: DRAG1 - DRAG0 }, { t: BACK, type: 'return', d: 0.9 });
  for (const id of ['tmp', 'prs', 'sta', 'lrl', 'inc']) for (const it of DATA[id]) if (it.set === 'live') { const tt = 36 + (it.t0 - LIVE0) / LSP; if (tt > DIRECT_ON + 0.6 && tt < 52) CUES.push({ t: tt, type: 'arrive', row: id }); }
  CUES.push({ t: WIPE0, type: 'wipe', d: WIPE1 - WIPE0 });
  KEYSTROKES.forEach((k) => CUES.push({ t: k.t, type: 'key', k: k.k }));
  CUES.push({ t: MODAL_OPEN + 0.02, type: 'modalOpen' }, { t: MODAL_CLOSE + 0.02, type: 'modalClose' });
  CUES.push({ t: 52.2, type: 'outro' }, { t: 53.0, type: 'logoLine' });
  [0, 1, 2].forEach((i) => CUES.push({ t: 53.85 + i * 0.13, type: 'strand', i }));
  CUES.push({ t: 54.35, type: 'logo' }, { t: 55.1, type: 'tagline' });
  CUES.sort((a, b) => a.t - b.t);
  const ZOOM_CURVE = []; for (let t = 11.5; t <= 21.6; t += 0.01) ZOOM_CURVE.push([+t.toFixed(2), Math.log10(zoomSpan(t).span)]);

  window.TW = { W, H, DURATION, render, CUES, ZOOM_CURVE };
})();
