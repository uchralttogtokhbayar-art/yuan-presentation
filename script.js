/* ИХ ЮАНЬ ГҮРЭН — presentation engine
   One persistent map (camera = SVG viewBox) + per-slide GSAP timelines. */
(() => {
  'use strict';
  const M = window.MAPDATA;
  const gsap = window.gsap;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1920, H = 1080;
  const P = (lon, lat) => [(lon - M.LON0) * M.KX, (M.LAT0 - lat) * M.K];
  const svgEl = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------- motion preference ---------- */
  let reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { const v = localStorage.getItem('yuan-rm'); if (v !== null) reduced = v === '1'; } catch (e) {}
  const lite = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 820;
  if (lite) document.documentElement.classList.add('lite');
  const setReducedClass = () => {
    document.documentElement.classList.toggle('rm', reduced);
    $('#bMotion').classList.toggle('on', reduced);
    $('#bMotion').textContent = reduced ? 'Хөдөлгөөн: бага' : 'Хөдөлгөөн';
  };

  /* ---------- deck scaling ---------- */
  const deck = $('#deck');
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    if (lite) { deck.style.position = 'relative'; deck.style.left = deck.style.top = 'auto'; deck.style.transform = 'none'; deck.style.zoom = s; return; }
    deck.style.position = 'absolute';
    deck.style.left = '50%'; deck.style.top = '50%';
    deck.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ---------- build the map ---------- */
  const world = $('#world');
  const gGrat = $('#gGrat'), gTerr = $('#gTerr'), gRiv = $('#gRiv'), gRoutes = $('#gRoutes'), gFx = $('#gFx'), gCities = $('#gCities');
  $('#land').setAttribute('d', lite ? M.land.replace(/L[^LMZ]*L([^LMZ]*)/g, 'L$1').replace(/L[^LMZ]*L([^LMZ]*)/g, 'L$1') : M.land);
  {
    let d = '';
    for (let lon = -10; lon <= 160; lon += 10) { const a = P(lon, 75), b = P(lon, -15); d += `M${a[0]},${a[1]}V${b[1]}`; }
    for (let lat = -10; lat <= 70; lat += 10) { const a = P(-15, lat), b = P(160, lat); d += `M${a[0]},${a[1]}H${b[0]}`; }
    svgEl('path', { d, class: 'grat' }, gGrat);
  }
  const TCLASS = {
    gh: 't-parch', chag: 't-parch', ilk: 't-parch',
    m1259: 't-red', m1227: 't-red', m1206: 't-red',
    ariq: 't-parch', kublai: 't-red',
    song: 't-blue', ming: 't-blue',
    yuan: 't-red', tibet: 't-hatch-red', goryeo: 't-hatch-parch',
    nyuan: 't-red', yunnan: 't-red-deep'
  };
  const T = {};
  for (const k in TCLASS) T[k] = svgEl('path', { d: M.terr[k], class: 'terr ' + TCLASS[k], id: 't-' + k }, gTerr);
  // conquest sweep (Song turning red from the north)
  const sweepClip = svgEl('clipPath', { id: 'sweep' }, $('#world defs'));
  const sweepRect = svgEl('rect', { x: 0, y: P(0, 35)[1], width: M.w, height: 0 }, sweepClip);
  T.songRed = svgEl('path', { d: M.terr.song, class: 'terr t-red', 'clip-path': 'url(#sweep)' }, gTerr);
  // Ming growth from Nanjing
  const mingClip = svgEl('clipPath', { id: 'mingclip' }, $('#world defs'));
  const nj = P(118.8, 32.06);
  const mingCirc = svgEl('circle', { cx: nj[0], cy: nj[1], r: 0 }, mingClip);
  T.mingGrow = svgEl('path', { d: M.terr.ming, class: 'terr t-blue', 'clip-path': 'url(#mingclip)' }, gTerr);

  const RIV = {};
  for (const k in M.rivers) RIV[k] = svgEl('path', { d: M.rivers[k], class: 'river' }, gRiv);

  const NAMES = {
    dadu: 'Дайду', shangdu: 'Шанду', karakorum: 'Хархорум', hangzhou: 'Ханжоу', xiangyang: 'Шянъян', yamen: 'Ямэн',
    quanzhou: 'Чюаньжоу', guangzhou: 'Гуанжоу', kaesong: 'Кэсон', hakata: 'Хаката', thanglong: 'Тханглонг', vijaya: 'Виджая',
    pagan: 'Паган', java: 'Ява', sakya: 'Сакья', almaliq: 'Алмалык', samarkand: 'Самарканд', tabriz: 'Тебриз', baghdad: 'Багдад',
    sarai: 'Сарай', constantinople: 'Константинополь', venice: 'Венец', rome: 'Ром', paris: 'Парис', kashgar: 'Кашгар',
    dunhuang: 'Дуньхуан', turfan: 'Турфан', hormuz: 'Хормуз', calicut: 'Каликут', nanjing: 'Нанжин', yingchang: 'Инчан',
    buir: 'Буйр нуур', maragha: 'Мараг', jingdezhen: 'Жиндэжэнь', gaoyou: 'Гаоюй', poyang: 'Поян нуур', yingzhou: 'Инжоу',
    diaoyu: 'Дяоюй', zhongdu: 'Жунду', malacca: 'Малака', quilon: 'Куилон'
  };
  const C = {};
  for (const k in M.cities) {
    const [x, y] = M.cities[k];
    const g = svgEl('g', { class: 'city', 'data-k': k }, gCities);
    const halo = svgEl('circle', { class: 'halo', cx: x, cy: y, r: 6 }, g);
    const dot = svgEl('circle', { cx: x, cy: y, r: 3 }, g);
    const t = svgEl('text', { x, y }, g); t.textContent = NAMES[k] || k;
    C[k] = { g, halo, dot, t, x, y, side: 'r' };
  }

  /* ---------- camera ---------- */
  const cam = { cx: M.w / 2, cy: 380, w: M.w };
  let invScale = 1;
  function applyCam() {
    const h = cam.w * H / W;
    world.setAttribute('viewBox', `${cam.cx - cam.w / 2} ${cam.cy - h / 2} ${cam.w} ${h}`);
    invScale = cam.w / W; // map units per screen px
    layoutCities();
    for (const r of $$('.route', gRoutes)) r.setAttribute('stroke-width', (+r.dataset.sw || 2.2) * invScale);
    for (const e of $$('[data-ssw]', gFx)) e.setAttribute('stroke-width', +e.dataset.ssw * invScale);
    for (const e of $$('[data-sr]', gFx)) e.setAttribute('r', +e.dataset.sr * invScale);
    for (const e of $$('[data-sfs]', gFx)) e.setAttribute('font-size', +e.dataset.sfs * invScale);
  }
  function layoutCities() {
    const s = invScale;
    for (const k in C) {
      const c = C[k];
      c.dot.setAttribute('r', 4.5 * s);
      c.halo.setAttribute('r', 11 * s);
      c.halo.setAttribute('stroke-width', 1);
      c.t.setAttribute('font-size', 19 * s);
      c.t.setAttribute('stroke-width', 4 * s);
      const o = 14 * s;
      const side = c.side;
      c.t.setAttribute('x', c.x + (side === 'r' ? o : side === 'l' ? -o : 0));
      c.t.setAttribute('y', c.y + (side === 't' ? -o : side === 'b' ? o + 12 * s : 6 * s));
      c.t.setAttribute('text-anchor', side === 'r' ? 'start' : side === 'l' ? 'end' : 'middle');
    }
  }
  const camFor = (lon, lat, w) => { const [x, y] = P(lon, lat); return { cx: x, cy: y, w }; };
  function toScreen(x, y, c) {
    const s = W / c.w, h = c.w * H / W;
    return [(x - (c.cx - c.w / 2)) * s, (y - (c.cy - h / 2)) * s];
  }

  /* ---------- path helpers ---------- */
  function smoothPath(pts) {
    if (pts.length < 3) return `M${pts.map(p => p.join(',')).join('L')}`;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  const ll = list => list.map(p => typeof p === 'string' ? [C[p].x, C[p].y] : P(p[0], p[1]));
  function route(list, cls, sw = 2.2, parent = gRoutes) {
    const p = svgEl('path', { d: smoothPath(ll(list)), class: 'route ' + cls, 'data-sw': sw }, parent);
    p.setAttribute('stroke-width', sw * invScale);
    return p;
  }
  function arcPath(a, b, bend = .22) {
    const [x1, y1] = a, [x2, y2] = b;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let nx = -dy / len, ny = dx / len; if (ny > 0) { nx = -nx; ny = -ny; }
    return `M${x1},${y1}Q${mx + nx * len * bend},${my + ny * len * bend} ${x2},${y2}`;
  }
  function prepDraw(path) {
    const L = path.getTotalLength();
    path.style.strokeDasharray = `${L} ${L}`;
    path.style.strokeDashoffset = L;
    return L;
  }
  function drawOn(tl, path, at, dur = 1.6, ease = 'power2.inOut') {
    prepDraw(path);
    tl.set(path, { opacity: 1 }, at);
    tl.to(path.style, { strokeDashoffset: 0, duration: dur, ease }, at);
  }
  function pulse(tl, k, at, color = '#d0563f', size = 34, repeat = 0) {
    const c = C[k];
    const ring = svgEl('circle', { cx: c.x, cy: c.y, r: 1, fill: 'none', stroke: color, 'data-ssw': 2, 'stroke-width': 2 * invScale }, gFx);
    const o = { r: 0 };
    tl.fromTo(o, { r: 2 }, { r: size, duration: 1.6, ease: 'power2.out', repeat, onUpdate: () => ring.setAttribute('r', o.r * invScale) }, at);
    tl.fromTo(ring, { opacity: .9 }, { opacity: 0, duration: 1.6, ease: 'power1.in', repeat }, at);
    return ring;
  }
  function fxLabel(lon, lat, text, cls = 'mapnote', size = 15) {
    const [x, y] = P(lon, lat);
    const t = svgEl('text', { x, y, class: cls, 'font-size': size * invScale, 'data-sfs': size, fill: '#b7ad9a' }, gFx);
    t.textContent = text; t.style.opacity = 0;
    return t;
  }
  function clearFx() { gFx.innerHTML = ''; for (const r of $$('.route', gRoutes)) r.remove(); }

  /* ---------- text helpers ---------- */
  function split(el) {
    if (el.dataset.split) return $$('.ch', el);
    const text = el.textContent; el.textContent = '';
    el.setAttribute('aria-label', text);
    text.split(/(\s+)/).forEach(part => {
      if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      for (const ch of part) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; w.appendChild(s); }
      el.appendChild(w);
    });
    el.dataset.split = '1'; el.classList.add('split');
    return $$('.ch', el);
  }
  function chars(tl, el, at, o = {}) {
    const cs = split(el);
    tl.fromTo(cs, { opacity: 0, y: o.y ?? 80, filter: `blur(${o.blur ?? 14}px)`, rotateX: o.rx ?? 0 },
      { opacity: 1, y: 0, filter: 'blur(0px)', rotateX: 0, duration: o.d ?? 1.2, ease: o.ease ?? 'power3.out', stagger: o.st ?? .05 }, at);
  }
  function up(tl, els, at, o = {}) {
    tl.fromTo(els, { opacity: 0, y: o.y ?? 30, filter: `blur(${o.blur ?? 6}px)` },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: o.d ?? 1, ease: 'power3.out', stagger: o.st ?? .12 }, at);
  }
  function count(tl, el, at, dur = 1.8) {
    const to = +el.dataset.to, dec = +(el.dataset.dec || 0), from = +(el.dataset.from || 0);
    const o = { v: from };
    const fmt = v => dec ? v.toFixed(dec) : Math.round(v).toString();
    tl.fromTo(o, { v: from }, { v: to, duration: dur, ease: 'power2.out', onUpdate: () => el.textContent = fmt(o.v) }, at);
  }

  /* ---------- ruler (progress) ---------- */
  const ruler = $('#ruler'), Y0 = 1200, Y1 = 1640;
  const rx = y => (y - Y0) / (Y1 - Y0) * 900;
  for (let y = 1200; y <= 1640; y += 20) {
    const t = document.createElement('div'); t.className = 'tk'; t.style.left = rx(y) + 'px';
    if (y % 100 === 0) { t.style.height = '13px'; t.style.top = '0'; const l = document.createElement('div'); l.className = 'tl'; l.style.left = rx(y) + 'px'; l.textContent = y; ruler.appendChild(l); }
    ruler.appendChild(t);
  }
  const rState = { y: 1271 };
  const mk = $('.mk', ruler), mky = $('.mky', ruler), done = $('.done', ruler);
  const drawRuler = () => { const x = rx(rState.y); mk.style.left = x + 'px'; mky.style.left = x + 'px'; mky.textContent = Math.round(rState.y); done.style.width = x + 'px'; };
  function rulerTo(y, dur = 1.2) { if (reduced || !dur) { rState.y = y; drawRuler(); return; } gsap.to(rState, { y, duration: dur, ease: 'power2.inOut', onUpdate: drawRuler }); }

  /* ---------- shading for map-heavy slides ---------- */
  ['s02', 's05', 's07', 's08', 's13', 's16', 's18', 's19'].forEach(id => {
    const d = document.createElement('div'); d.className = 'shade';
    d.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(12,13,15,.9) 0%,rgba(12,13,15,.55) 34%,rgba(12,13,15,0) 58%)';
    $('#' + id).prepend(d);
  });
  { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(0deg,rgba(12,13,15,.85) 0%,rgba(12,13,15,0) 30%)'; $('#s15').prepend(d); }

  /* ---------- map state ---------- */
  function setMap(st, dur, own = [], cityReveal = false) {
    const d = reduced ? 0 : dur;
    const terr = st.terr || {};
    for (const k in T) { if (own.includes(k)) { gsap.killTweensOf(T[k]); continue; } const v = terr[k] || 0; gsap.to(T[k], { opacity: v, duration: d, ease: 'power2.inOut', overwrite: 'auto' }); }
    const riv = st.rivers || {};
    for (const k in RIV) gsap.to(RIV[k], { opacity: riv[k] || 0, duration: d, overwrite: 'auto' });
    const show = st.cities || [];
    for (const k in C) {
      const c = C[k];
      c.g.classList.toggle('hot', (st.hot || []).includes(k));
      c.g.classList.toggle('gold', (st.gold || []).includes(k));
      c.side = (st.side && st.side[k]) || 'r';
      c.t.textContent = (st.rename && st.rename[k]) || NAMES[k];
      if (cityReveal && show.includes(k)) { gsap.killTweensOf(c.g); gsap.set(c.g, { opacity: 0 }); }
      else gsap.to(c.g, { opacity: show.includes(k) ? 1 : 0, duration: d * .6, overwrite: 'auto' });
    }
    gsap.to('#mapveil', { opacity: st.veil ?? .2, duration: d, ease: 'power2.inOut', overwrite: 'auto' });
    layoutCities();
  }

  /* ---------- slides ---------- */
  const S = {};
  const OTHERS = { gh: .35, chag: .35, ilk: .35 };

  S.s01 = {
    year: 1271, cam: camFor(104, 41, 640), veil: .58,
    map: { terr: { yuan: .16, tibet: .12 } },
    ambient: () => gsap.to(cam, { cx: '+=70', cy: '-=14', w: '-=40', duration: 40, ease: 'none', onUpdate: applyCam }),
    enter(tl, el) {
      up(tl, $('.t-course', el), .2);
      up(tl, $('.t-sup', el), .5, { y: 20 });
      chars(tl, $('.t-main', el), .6, { y: 120, st: .07, d: 1.6 });
      chars(tl, $('.t-main2', el), 1.3, { y: 60, st: .06, d: 1.4, blur: 8 });
      tl.fromTo($('.t-zh', el), { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out' }, 1.6);
      tl.fromTo($('.t-mn', el), { opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 2, ease: 'power2.inOut' }, 1.9);
      tl.fromTo($('.t-years', el), { opacity: 0, letterSpacing: '1.2em' }, { opacity: 1, letterSpacing: '.3em', duration: 2, ease: 'power3.out' }, 2.2);
      up(tl, $('.t-hint', el), 3.2, { y: 10 });
    }
  };

  S.s02 = {
    year: 1259, cam: { cx: 780, cy: 270, w: 1040 }, veil: .05, own: ['m1206', 'm1227', 'm1259'],
    map: { terr: {}, cities: ['karakorum'], hot: ['karakorum'] },
    enter(tl, el) {
      const yr = $('#s02yr'), st = $$('.stage', el), o = { v: 1206 };
      st.forEach(s => s.classList.remove('on'));
      tl.set(yr, { textContent: '1206' }, 0);
      up(tl, st, .2, { y: 10 });
      tl.fromTo(yr, { opacity: 0, y: 60, filter: 'blur(14px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, .3);
      up(tl, $('.yr-cap', el), .8);
      const stage = (i, at, from, to, terr) => {
        tl.call(() => st.forEach((s, j) => s.classList.toggle('on', j === i)), null, at);
        tl.fromTo(T[terr], { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.inOut' }, at);
        if (to !== from) tl.fromTo(o, { v: from }, { v: to, duration: 1.6, ease: 'power2.inOut', onUpdate: () => yr.textContent = Math.round(o.v) }, at);
      };
      stage(0, .6, 1206, 1206, 'm1206');
      pulse(tl, 'karakorum', .8);
      stage(1, 2.2, 1206, 1227, 'm1227');
      stage(2, 4.0, 1227, 1259, 'm1259');
      up(tl, $('.area', el), 4.4);
      count(tl, (() => { const e = $('#s02area'); e.dataset.to = 24; return e; })(), 4.5, 2);
      up(tl, $('.mapsrc', el), 5);
    }
  };

  S.s03 = {
    year: 1260, cam: { cx: 760, cy: 290, w: 1180 }, veil: .66, own: ['m1259', 'gh', 'chag', 'ilk', 'kublai', 'ariq'],
    map: { terr: { m1259: .5 } },
    enter(tl, el) {
      up(tl, $('.eyebrow', el), .1, { y: 10 });
      up(tl, $('.h2', el), .2, { y: 40 });
      up(tl, $('.lead', el), .7);
      const edges = $$('.edge', el);
      edges.forEach(e => { e.classList.remove('cut'); e.style.opacity = 1; });
      const ek = $('.e-k', el), ea = $('.e-a', el), ex = $$('.e-x', el), evs = $('.e-vs', el);
      ek.classList.remove('red');
      tl.fromTo($('.tn-m', el), { opacity: 0, scale: .6, transformOrigin: '420px 400px' }, { opacity: 1, scale: 1, duration: .9, ease: 'back.out(1.6)' }, .5);
      [...ex, ek, ea].forEach((e, i) => drawOn(tl, e, .9 + i * .12, 1.1));
      tl.fromTo($$('.tn-x', el), { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: .8, stagger: .12, ease: 'power3.out' }, 1.5);
      tl.fromTo([$('.tn-k', el), $('.tn-a', el)], { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: .8, stagger: .15, ease: 'power3.out' }, 1.7);
      tl.set(evs, { opacity: 0 }, 0);
      // transformation: the centre dies, outer links loosen, two claimants face each other
      tl.to($('.tn-m circle', el), { attr: { r: 12 }, opacity: .45, duration: .8 }, 3.0);
      tl.to($('.tn-m', el), { opacity: .55, duration: .8 }, 3.0);
      tl.call(() => ex.forEach(e => { e.style.strokeDasharray = ''; e.classList.add('cut'); }), null, 3.2);
      tl.to(ex, { opacity: .5, duration: .6 }, 3.2);
      tl.call(() => ek.classList.add('red'), null, 3.4);
      tl.fromTo(evs, { opacity: 0 }, { opacity: 1, duration: .8 }, 3.6);
      tl.to(T.m1259, { opacity: .12, duration: 1.2 }, 3.2);
      tl.fromTo([T.gh, T.chag, T.ilk], { opacity: 0 }, { opacity: .55, duration: 1.2, stagger: .15 }, 3.3);
      tl.fromTo(T.kublai, { opacity: 0 }, { opacity: .7, duration: 1.2 }, 3.6);
      tl.fromTo(T.ariq, { opacity: 0 }, { opacity: .7, duration: 1.2 }, 3.6);
    }
  };

  S.s04 = {
    year: 1260, cam: camFor(112, 41, 520), veil: .86,
    map: { terr: { kublai: .5, ariq: .3 } },
    ambient: () => gsap.to(cam, { cx: '+=30', duration: 30, ease: 'none', onUpdate: applyCam }),
    enter(tl, el) {
      tl.fromTo($('.sil', el), { opacity: 0, x: 80, filter: 'blur(20px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 2.4, ease: 'power3.out' }, 0);
      up(tl, $('.eyebrow', el), .4, { y: 10 });
      chars(tl, $('.name', el), .6, { y: 0, blur: 20, st: .08, d: 1.4, ease: 'power2.out' });
      up(tl, $('.alt', el), 1.5);
      up(tl, $$('.fact', el), 2, { st: .2 });
      tl.fromTo($('.mnname', el), { opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 1.8, ease: 'power2.inOut' }, 1.2);
      up(tl, $('.silcap', el), 2.8, { y: 8 });
    }
  };

  const S05TX = [
    'Хоёр хуралдай, хоёр хаан. Хубилай Кайпинд, Аригбөх Хархорум орчим хаан өргөмжлөгдөв.',
    'Хубилай Хойд Хятадаас Хархорум руу орох хүнсний урсгалыг хааж, тулалдаанд давуу байдал олов.',
    'Цагаадайн улсын Алгу Аригбөхөөс урваж, баруун талын нөөцийг нь таслав.',
    'Аригбөх бууж өгөв. Гэвч Зүчийн, Цагаадайн угсааны зарим хаад Хубилайг их хаан гэж хүлээн зөвшөөрсөнгүй.'
  ];
  let s05Fx = null;
  function s05Step(k, instant) {
    const el = $('#s05');
    $$('.chip', el).forEach((c, i) => c.classList.toggle('on', i === k));
    $('#s05yr').textContent = ['1260', '1261', '1262', '1264'][k];
    $('#s05tx').textContent = S05TX[k];
    if (s05Fx) s05Fx.kill();
    clearFx();
    const tl = gsap.timeline();
    s05Fx = tl;
    tl.fromTo(['#s05yr', '#s05tx'], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6, stagger: .08 }, 0);
    tl.to(T.ariq, { opacity: k >= 3 ? .25 : .85, duration: .8 }, 0);
    tl.to(T.kublai, { opacity: .85, duration: .8 }, 0);
    if (k === 0) { pulse(tl, 'shangdu', .1, '#d0563f', 40, 1); pulse(tl, 'karakorum', .4, '#ece4d3', 40, 1); }
    if (k >= 1) {
      const sup = route(['zhongdu', [112, 44], 'karakorum'], 'parch-r', 1.6);
      sup.style.strokeDasharray = 'none';
      drawOn(tl, sup, .1, 1.2);
      const mid = P(110.8, 44.6);
      const x = svgEl('path', { d: `M${mid[0] - 6},${mid[1] - 6}L${mid[0] + 6},${mid[1] + 6}M${mid[0] + 6},${mid[1] - 6}L${mid[0] - 6},${mid[1] + 6}`, stroke: '#d0563f', 'data-ssw': 4, 'stroke-width': 4 * invScale, fill: 'none' }, gFx);
      tl.fromTo(x, { opacity: 0 }, { opacity: 1, duration: .3 }, 1.2);
      const adv = route(['shangdu', [110, 46.5], [104.5, 47.4], 'karakorum'], 'red-r', 3);
      drawOn(tl, adv, k === 1 ? 1.3 : .2, 1.4);
      const lab = fxLabel(108.5, 43.6, 'ХҮНСНИЙ УРСГАЛ ХААГДАВ', 'mapnote', 14);
      tl.to(lab, { opacity: 1, duration: .5 }, 1.3);
    }
    if (k >= 2) {
      const al = route([[88, 44.5], [94, 46], [99, 47]], 'parch-r', 2);
      drawOn(tl, al, .3, 1.2);
      tl.to(al, { opacity: .35, duration: .6 }, 1.6);
      const lab = fxLabel(86.5, 43.2, 'АЛГУ УРВАВ', 'mapnote', 14);
      tl.to(lab, { opacity: 1, duration: .5 }, .9);
    }
    if (k >= 3) {
      const sr = route(['karakorum', [108, 45], 'shangdu'], 'parch-r', 2.4);
      drawOn(tl, sr, .5, 1.6);
      pulse(tl, 'shangdu', 1.8, '#b59a62', 50);
    }
    if (instant || reduced) tl.progress(1);
    applyCam();
  }
  S.s05 = {
    year: 1264, cam: { cx: 1050, cy: 255, w: 430 }, veil: .1, own: ['kublai', 'ariq'],
    map: { terr: { kublai: .85, ariq: .85 }, cities: ['shangdu', 'karakorum', 'zhongdu'], hot: ['shangdu'], rename: { shangdu: 'Кайпин' }, side: { zhongdu: 'b' } },
    enter(tl, el) {
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1, { st: .1 });
      up(tl, $$('.h2', el)[1], .4);
      up(tl, $$('.chip', el), .6, { y: 10, st: .06 });
      up(tl, $('.leg', el), .8, { y: 10 });
      [0, 1, 2, 3].forEach(k => tl.call(() => s05Step(k), null, .9 + k * 3.2));
    },
    leave() { if (s05Fx) s05Fx.kill(); }
  };
  $$('#s05chips .chip').forEach((b, i) => b.addEventListener('click', () => { if (cur.tl) cur.tl.kill(); s05Step(i); }));

  S.s06 = {
    year: 1271, cam: camFor(110, 40, 900), veil: .86, own: ['yuan'],
    map: { terr: { yuan: .3 } },
    enter(tl, el) {
      chars(tl, $('#s06big'), 0, { y: 200, blur: 30, st: .12, d: 1.8 });
      const a = $('#s06a'), b = $('#s06b');
      const ca = split(a), cb = split(b);
      tl.set(cb, { opacity: 0 }, 0);
      tl.fromTo(ca, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .8, stagger: .03, ease: 'power3.out' }, .8);
      tl.to(ca, { opacity: 0, y: -40, filter: 'blur(10px)', duration: .7, stagger: { each: .025, from: 'random' }, ease: 'power2.in' }, 2.6);
      tl.fromTo(cb, { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .9, stagger: .05, ease: 'power3.out' }, 3.1);
      tl.fromTo($('.zh-big', el), { opacity: 0, scale: 1.25, filter: 'blur(18px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power3.out', transformOrigin: '100% 50%' }, 3.3);
      tl.fromTo($('.quote', el), { opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.3em', duration: 1.6, ease: 'power3.out' }, 3.8);
      up(tl, $$('.zhbox p', el), 4.3);
      tl.fromTo(T.yuan, { opacity: .3 }, { opacity: .55, duration: 2 }, 3.1);
      up(tl, $('.when .debate', el), 5.1, { y: 10 });
      up(tl, $$('.when .row > div', el), 5.3, { st: .15 });
    }
  };

  S.s07 = {
    year: 1279, cam: { cx: 1020, cy: 380, w: 390 }, veil: .05, own: ['songRed'],
    map: { terr: { song: .9, kublai: .55 }, rivers: { yangtze: 1 }, cities: ['xiangyang', 'hangzhou', 'yamen'], hot: ['xiangyang'], gold: ['yamen'], side: { hangzhou: 'r', yamen: 'b' } },
    enter(tl, el) {
      const steps = $$('.step', el);
      steps.forEach(s => s.classList.remove('on'));
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      up(tl, steps, .4, { st: .1, y: 16 });
      tl.set($$('.step', el), { opacity: '' }, 1.6);
      const on = (i, at) => tl.call(() => steps.forEach((s, j) => s.classList.toggle('on', j <= i)), null, at);
      sweepRect.setAttribute('height', 0);
      const sw = { h: 0 }, top = P(0, 35)[1];
      const sweepTo = (lat, at, dur) => tl.to(sw, { h: P(0, lat)[1] - top, duration: dur, ease: 'power1.inOut', onUpdate: () => sweepRect.setAttribute('height', sw.h) }, at);
      tl.set(T.songRed, { opacity: 1 }, 0);
      on(0, 1.2);
      const a1 = route([[112.6, 36], [112.3, 34], 'xiangyang'], 'red-r', 3);
      drawOn(tl, a1, 1.2, 1.2);
      pulse(tl, 'xiangyang', 2.2, '#d0563f', 44, 2);
      sweepTo(31.6, 1.4, 2);
      on(1, 4.2);
      const a2 = route(['xiangyang', [113.2, 30.4], [114.3, 30.6], [115.8, 29.8], [117, 30.5], [118.4, 31.4], [119.7, 30.7], 'hangzhou'], 'red-r', 3);
      drawOn(tl, a2, 4.2, 2);
      pulse(tl, 'hangzhou', 6, '#d0563f', 44);
      sweepTo(27.5, 4.4, 2.2);
      on(2, 7.0);
      const a3 = route(['hangzhou', [121.2, 28.5], [120.4, 26.2], [118.6, 23.9], [116.2, 22.4], [114, 21.9], 'yamen'], 'red-r', 3);
      drawOn(tl, a3, 7.0, 2);
      sweepTo(17, 7.2, 2.4);
      // a small fleet gathers at Yamen
      const [yx, yy] = [C.yamen.x, C.yamen.y];
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2, rr = 7 + (i % 3) * 3;
        const sx = yx + Math.cos(ang) * rr * .6, sy = yy + 4 + Math.sin(ang) * rr * .35;
        const s = svgEl('path', { d: `M${sx - 1.2},${sy}L${sx + 1.2},${sy}L${sx},${sy - 2}Z`, fill: '#b7ad9a' }, gFx);
        tl.fromTo(s, { opacity: 0 }, { opacity: .9, duration: .3 }, 8.4 + i * .05);
      }
      pulse(tl, 'yamen', 9, '#b59a62', 60);
      chars(tl, $('#s07end'), 9.4, { y: 120, st: .1, d: 1.4 });
      up(tl, $('.mapsrc', el), 1, { y: 8 });
    }
  };

  const S08INFO = {
    dadu: ['Дайду', 'Өвлийн нийслэл. 1267 оноос барьж, 1272 онд нэрлэв.'],
    shangdu: ['Шанду', 'Зуны нийслэл, 1256 онд Кайпин нэрээр байгуулав. 1260 оны хуралдай энд болов.'],
    karakorum: ['Хархорум', 'Их Монгол Улсын хуучин нийслэл, Юанийн Лэнбэй мужийн төв.'],
    hangzhou: ['Ханжоу', 'Өмнөд Сүний хуучин нийслэл, Марко Пологийн «Кинсай». Жэжян мужийн төв.'],
    quanzhou: ['Чюаньжоу', 'Европчуудын «Зайтун». Далайн худалдааны томоохон боомт, далайн гаалийн газартай.'],
    guangzhou: ['Гуанжоу', 'Өмнөд тэнгисийн худалдааны боомт.'],
    kaesong: ['Кэсон', 'Гоорёгийн нийслэл.'],
    sakya: ['Сакья', 'Сакьягийн хийд. Пагва ламын шашны төв, Юанийн Төвдийн бодлогын тулгуур.']
  };
  S.s08 = {
    year: 1294, cam: { cx: 907, cy: 322, w: 730 }, veil: .04, own: ['yuan', 'tibet', 'goryeo'], cityReveal: true,
    map: { terr: { ...OTHERS }, cities: Object.keys(S08INFO), hot: ['dadu', 'shangdu'], gold: ['dadu'], side: { shangdu: 'r', dadu: 'r', kaesong: 'r', karakorum: 't', quanzhou: 'r', guangzhou: 'l', hangzhou: 'r', sakya: 'b' } },
    enter(tl, el) {
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      tl.fromTo(T.yuan, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.inOut' }, .3);
      tl.fromTo([T.tibet, T.goryeo], { opacity: 0 }, { opacity: 1, duration: 1.2, stagger: .25 }, 1.2);
      const cs = Object.keys(S08INFO);
      cs.forEach((k, i) => { tl.fromTo(C[k].g, { opacity: 0 }, { opacity: 1, duration: .5 }, 1.6 + i * .12); });
      pulse(tl, 'dadu', 1.8, '#b59a62', 50);
      up(tl, $$('.stat', el), 1.4, { st: .2 });
      $$('.cnt', el).forEach((c, i) => count(tl, c, 1.6 + i * .2, 2));
      up(tl, $('.leg', el), 2.4, { y: 10 });
      up(tl, $$('p.cap', el).slice(-1), 3, { y: 8 });
    }
  };
  // tooltips on cities (active on s08)
  const tip = $('#s08tip');
  for (const k in S08INFO) {
    const g = C[k].g;
    g.style.cursor = 'pointer';
    g.addEventListener('mouseenter', () => {
      if (cur.id !== 's08') return;
      const [sx, sy] = toScreen(C[k].x, C[k].y, cam);
      $('.t', tip).textContent = S08INFO[k][0];
      $('p', tip).textContent = S08INFO[k][1];
      tip.style.left = Math.min(sx + 24, W - 420) + 'px'; tip.style.top = Math.max(sy - 40, 80) + 'px';
      gsap.to(tip, { opacity: 1, duration: .25 });
      gsap.to(C[k].halo, { attr: { r: 22 * invScale }, duration: .3 });
    });
    g.addEventListener('mouseleave', () => { gsap.to(tip, { opacity: 0, duration: .25 }); gsap.to(C[k].halo, { attr: { r: 11 * invScale }, duration: .3 }); });
  }

  S.s09 = {
    year: 1267, cam: { cx: C.dadu.x - 6, cy: C.dadu.y, w: 34 }, camDur: 2.6, veil: .3,
    map: { terr: { yuan: .4 }, cities: ['dadu', 'shangdu'], gold: ['dadu'] },
    enter(tl, el) {
      pulse(tl, 'dadu', .2, '#b59a62', 70);
      tl.to(C.dadu.g, { opacity: 0, duration: .8 }, 1.6);
      tl.to('#mapveil', { opacity: .9, duration: 1.4, ease: 'power2.in' }, 1.4);
      up(tl, $('.h2w .eyebrow', el), .3, { y: 10 });
      chars(tl, $('#s09t'), .4, { y: 100, st: .08, d: 1.4 });
      up(tl, $('.h2w .sub', el), 1.2);
      const plan = $('.plan', el);
      tl.fromTo(plan, { opacity: 0, scale: .75, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 2.2, ease: 'power3.out' }, .2);
      drawOn(tl, $('.pl-wall', el), .5, 2.2);
      tl.fromTo($$('.pl-streets line', el), { opacity: 0 }, { opacity: 1, duration: .8, stagger: .05 }, 1.6);
      tl.fromTo([$('.pl-haizi', el), $('.pl-taiye', el)], { opacity: 0, scale: .6, transformOrigin: '50% 50%', transformBox: 'fill-box' }, { opacity: 1, scale: 1, duration: 1.2, stagger: .2, ease: 'power3.out' }, 2.2);
      drawOn(tl, $('.pl-imp', el), 2.6, 1.4);
      tl.fromTo($('.pl-pal', el), { opacity: 0, scaleY: 0, transformOrigin: '50% 100%', transformBox: 'fill-box' }, { opacity: 1, scaleY: 1, duration: 1, ease: 'power3.out' }, 3.4);
      drawOn(tl, $('.pl-axis', el), 3.6, 1.6, 'power1.inOut');
      tl.fromTo($('.pl-ctr', el), { opacity: 0, scale: 0, transformOrigin: '50% 50%', transformBox: 'fill-box' }, { opacity: 1, scale: 1, duration: .6, ease: 'back.out(2)' }, 4.2);
      tl.fromTo($$('.pl-gates rect', el), { opacity: 0, scale: 0, transformOrigin: '50% 50%', transformBox: 'fill-box' }, { opacity: 1, scale: 1, duration: .4, stagger: .08, ease: 'back.out(2)' }, 4.4);
      tl.fromTo($$('.pl-labels > *', el), { opacity: 0 }, { opacity: 1, duration: .6, stagger: .06 }, 5);
      up(tl, $$('.num', el), 1.8, { st: .25 });
      const cn = $$('.cnt', el); cn[0].dataset.from = 1200;
      cn.forEach((c, i) => count(tl, c, 2 + i * .25, 1.6));
      up(tl, $('.who', el), 5.6, { y: 8 });
    }
  };

  S.s10 = {
    year: 1300, cam: { cx: C.dadu.x, cy: C.dadu.y, w: 70 }, veil: .93,
    map: { terr: { yuan: .3 } },
    enter(tl, el) {
      const org = $('#org');
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      up(tl, $('.lead', el), .5);
      const grp = $$('.grp', org);
      const rows = [[0, 1, 2], [3, 4, 5, 6], [7, 8], [9, 10]];
      $$('.link', org).forEach(l => { l.style.opacity = 0; });
      rows.forEach((r, i) => {
        tl.fromTo(r.map(j => grp[j]), { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: .7, stagger: .1, ease: 'power3.out' }, .8 + i * .7);
      });
      $$('.link', org).forEach((l, i) => drawOn(tl, l, 1.2 + i * .6, 1));
      up(tl, $$('.chip', el), 3.6, { y: 10, st: .06 });
      up(tl, $('.side', el), 3.8, { y: 8 });
    }
  };
  $$('#s10chips .chip').forEach(b => b.addEventListener('click', () => {
    $$('#s10chips .chip').forEach(c => c.classList.toggle('on', c === b));
    const org = $('#org'); org.classList.remove('hl-mg', 'hl-zh');
    if (b.dataset.h) org.classList.add('hl-' + b.dataset.h);
  }));

  const S11V = [
    'Уламжлалт тайлбар: албан тушаал, шалгалтын квот, ял шийтгэлд бүлэг бүрт ялгаатай хандсан шатлалт тогтолцоо. 1315 оноос шалгалтын 300 цолыг дөрвөн бүлэгт тэнцүү хуваав.',
    'Фунада (2014): «сэму» гэдэг нэр зөвхөн хятад эх сурвалжид гардаг, монгол, перс эх сурвалжид байхгүй. Энэ нь татвар, захиргааны ангилал бөгөөд Монголын засаглалын хуулиар тогтоосон «дөрвөн зэрэг» биш байж болно.'
  ];
  const S11W = [['100%', '78%', '52%', '30%'], ['100%', '100%', '100%', '100%']];
  function s11View(v, animate = true) {
    $$('#s11chips .chip').forEach((c, i) => c.classList.toggle('on', i === v));
    const bars = $$('#s11 .bar'), vt = $('#s11v');
    vt.textContent = S11V[v];
    const d = animate && !reduced ? 1 : 0;
    bars.forEach((b, i) => gsap.to(b, { width: S11W[v][i], background: v ? '#7b766c' : '#d0563f', duration: d, ease: 'power3.inOut', delay: i * .06 }));
    gsap.fromTo(vt, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: d * .8 });
  }
  S.s11 = {
    year: 1315, cam: { cx: C.dadu.x, cy: C.dadu.y + 20, w: 160 }, veil: .93,
    map: {},
    enter(tl, el) {
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      up(tl, $('.lead', el), .5);
      const bands = $$('.band', el);
      tl.fromTo(bands.slice().reverse(), { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 1, stagger: .22, ease: 'power3.out' }, .6);
      tl.call(() => { $$('#s11 .bar').forEach(b => b.style.width = '0%'); }, null, 0);
      tl.call(() => s11View(0), null, 1.8);
      up(tl, $$('.chip', el), 2.2, { y: 10 });
      tl.call(() => s11View(1), null, 7);
    }
  };
  $$('#s11chips .chip').forEach((b, i) => b.addEventListener('click', () => { if (cur.tl) cur.tl.kill(); s11View(i); }));

  // build coins on the note (two strings of cash)
  {
    const g = $('#coinrow');
    for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) {
      const cx = 110 + i * 31, cy = 290 + r * 70;
      svgEl('circle', { cx, cy, r: 12 }, g);
      svgEl('rect', { x: cx - 3.5, y: cy - 3.5, width: 7, height: 7 }, g);
    }
  }
  S.s12 = {
    year: 1287, cam: { cx: C.dadu.x - 60, cy: C.dadu.y + 40, w: 420 }, veil: .92,
    map: { terr: { yuan: .3 } },
    enter(tl, el) {
      const n = $('.note', el);
      tl.fromTo(n, { opacity: 0, y: 40, rotate: -3, filter: 'blur(10px)' }, { opacity: 1, y: 0, rotate: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power3.out' }, 0);
      tl.fromTo($$('.nt-t, .nt-v, .nt-s1', n), { opacity: 0 }, { opacity: 1, duration: .8, stagger: .2 }, .8);
      tl.fromTo($$('#coinrow > *', n), { opacity: 0 }, { opacity: 1, duration: .2, stagger: .025 }, 1.3);
      tl.fromTo($$('.nt-lines rect', n), { scaleX: 0, transformOrigin: '0 50%', transformBox: 'fill-box' }, { scaleX: 1, duration: .5, stagger: .08 }, 1.8);
      tl.fromTo($$('.nt-seal', n), { opacity: 0, scale: 1.8, transformOrigin: '50% 50%', transformBox: 'fill-box' }, { opacity: .85, scale: 1, duration: .45, stagger: .35, ease: 'power4.in' }, 2.5);
      up(tl, $('.notecap', el), 3.2, { y: 8 });
      up(tl, [$('.flow .eyebrow', el), $('.flow .h2', el)], .4);
      up(tl, $$('.link-i', el), 1.4, { st: .35, y: 40 });
      up(tl, $('.regimes .tag', el), 3.4, { y: 8 });
      tl.fromTo($$('#s12reg > div'), { scaleX: 0 }, { scaleX: 1, duration: .9, stagger: .45, ease: 'power3.inOut' }, 3.6);
      up(tl, $('.reg-axis', el), 4.6, { y: 6 });
      up(tl, $('.infl', el), 5.2);
      count(tl, $('.infl .cnt', el), 5.3, 1.8);
    }
  };

  let particles = [];
  S.s13 = {
    year: 1300, cam: { cx: 590, cy: 454, w: 1548 }, veil: .12, cityReveal: true,
    map: { terr: { gh: .3, chag: .3, ilk: .3, yuan: .4, tibet: .3 },
      cities: ['dadu', 'shangdu', 'karakorum', 'dunhuang', 'turfan', 'kashgar', 'almaliq', 'samarkand', 'tabriz', 'baghdad', 'sarai', 'constantinople', 'venice', 'quanzhou', 'guangzhou', 'malacca', 'calicut', 'hormuz'],
      gold: ['dadu'], side: { shangdu: 't', karakorum: 't', turfan: 't', kashgar: 'b', almaliq: 't', samarkand: 'b', tabriz: 'b', baghdad: 'b', sarai: 't', constantinople: 'r', venice: 't', quanzhou: 'r', guangzhou: 'b', malacca: 'l', calicut: 'l', hormuz: 'b', dunhuang: 'b', dadu: 'r' } },
    enter(tl, el) {
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      up(tl, $('.pax', el), .5);
      up(tl, $('.key', el), .7, { y: 10 });
      const ks = this.map.cities;
      ks.forEach(k => tl.set(C[k].g, { opacity: 0 }, 0));
      const land1 = ['dadu', 'shangdu', 'karakorum', [92, 46], 'almaliq', 'samarkand', [56, 37.5], 'tabriz', [40, 40], 'constantinople', [21, 40.5], 'venice'];
      const land2 = ['dadu', [108, 37], [102, 37], 'dunhuang', 'turfan', [83, 41.5], 'kashgar', 'samarkand'];
      const land3 = ['samarkand', [62, 42], [53, 45], 'sarai', [40, 46.5], [33.5, 45]];
      const sea = ['quanzhou', [117.2, 22.6], [113.4, 21.7], [111, 17.5], [109.8, 13.5], [107, 8], [104.3, 1.4], [101.8, 2.2], [98, 5.3], [93, 6.3], [85, 6.2], [80.5, 5.4], [77, 7.7], 'calicut', [71, 17], [64, 23.5], [58.8, 25.6], 'hormuz'];
      const r1 = route(land1, 'land-r', 2.4), r2 = route(land2, 'land-r', 1.8), r3 = route(land3, 'land-r', 1.6), r4 = route(sea, 'sea-r', 2.4);
      const r5 = route(['dadu', [117.6, 36], [118.4, 31.6], [119.7, 28.5], 'quanzhou'], 'sea-r', 1.4);
      drawOn(tl, r1, .8, 4.2, 'power1.inOut');
      drawOn(tl, r2, 1.2, 3, 'power1.inOut');
      drawOn(tl, r3, 3.4, 1.6);
      drawOn(tl, r5, 1.4, 1.2);
      drawOn(tl, r4, 2.4, 4, 'power1.inOut');
      const seq1 = ['dadu', 'shangdu', 'karakorum', 'almaliq', 'samarkand', 'tabriz', 'constantinople', 'venice'];
      seq1.forEach((k, i) => tl.to(C[k].g, { opacity: 1, duration: .4 }, .8 + i * 4.2 / seq1.length));
      ['dunhuang', 'turfan', 'kashgar'].forEach((k, i) => tl.to(C[k].g, { opacity: 1, duration: .4 }, 1.8 + i * .7));
      ['baghdad', 'sarai'].forEach((k, i) => tl.to(C[k].g, { opacity: 1, duration: .4 }, 3.8 + i * .3));
      ['quanzhou', 'guangzhou', 'malacca', 'calicut', 'hormuz'].forEach((k, i) => tl.to(C[k].g, { opacity: 1, duration: .4 }, 2.4 + i * .85));
      up(tl, $$('.fl', el), 5, { st: .15, y: 20 });
      // travellers: dots moving along the routes
      tl.call(() => startParticles([r1, r4, r2]), null, 6.4);
    },
    leave() { stopParticles(); }
  };
  function startParticles(paths) {
    stopParticles();
    if (reduced) return;
    paths.forEach((p, pi) => {
      const L = p.getTotalLength();
      for (let i = 0; i < 4; i++) {
        const dot = svgEl('circle', { r: 3 * invScale, 'data-sr': 3, fill: pi === 1 ? '#7f97a6' : '#e6cf9a' }, gFx);
        const o = { t: i / 4 };
        const tw = gsap.to(o, { t: `+=1`, duration: 14 + pi * 3, ease: 'none', repeat: -1, onUpdate: () => {
          const pt = p.getPointAtLength((o.t % 1) * L); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
          dot.setAttribute('opacity', Math.min(1, Math.sin((o.t % 1) * Math.PI) * 3));
        } });
        particles.push(tw);
      }
    });
  }
  function stopParticles() { particles.forEach(t => t.kill()); particles = []; }

  const NET = {
    hub: { at: 'dadu', k: 'Хаанбалгас', t: 'Дайду' },
    nodes: [
      { id: 'bud', ll: [88, 28.9], k: 'Төвд', t: 'Бурхны шашин', d: '1260 онд Пагва ламыг улсын багш, 1270 онд хааны багш болгов. 1269 онд түүний зохиосон дөрвөлжин бичгийг албан ёсны бичиг болгов.' },
      { id: 'dao', ll: [108.9, 34.3], k: 'Хятад', t: 'Даоизм', d: '1258 онд Хубилайн дэргэд буддын шашинтан, даоистуудын мэтгэлцээн болов. 1281 онд «Дао дэ жин»-ээс бусад даоист судрыг шатаах зарлиг гарав.' },
      { id: 'isl', ll: [66.9, 39.6], k: 'Төв Ази', t: 'Ислам', d: 'Төв Азийн мусульманчууд санхүү, худалдаа, захиргаанд өргөн ажиллав. Юньнанийг захирсан Сайид Ажалл үүний нэг жишээ.' },
      { id: 'chr', ll: [110.3, 41.6], k: 'Онгуд', t: 'Христ', d: 'Дорнын сүм (несториан) онгуд, хэрэйд нарын дунд дэлгэрсэн. 1289 онд Чунфу сы байгуулагдав. 1307 онд Монтекорвино Хаанбалгасын хамба болов.' },
      { id: 'ast', ll: [46.2, 37.4], k: 'Мараг', t: 'Одон орон', d: 'Жамал ад-Дин 1267 онд Персийн одон орны багажуудыг авчирч, 1271 онд Лалын одон орон судлалын газар байгуулагдав. Гуо Шоужин 1281 онд «Шоуши хуанли»-г гаргав.' },
      { id: 'med', ll: [52, 32.6], k: 'Иран', t: 'Анагаах', d: 'Лалын эмийн газрууд байгуулагдав. Ху Сыхуэйн 1330 оны «Иньшань жэнъяо» нь хоол, эм зүйн Монгол, Хятад, Лалын уламжлалыг нэгтгэсэн.' },
      { id: 'art', ll: [117.2, 29.3], k: 'Жиндэжэнь', t: 'Урлаг', d: 'Жиндэжэнийн цэнхэр-цагаан шаазан Персийн кобальтаар будагдав. Жао Мэнфу, «Юанийн дөрвөн мастер» уран зургийн шинэ хэв маяг бий болгов.' },
      { id: 'lit', ll: [122.5, 37.5], k: 'Дайду', t: 'Утга зохиол', d: 'Юанийн зажү жүжиг Дайдуд цэцэглэв. Гуань Ханьчин энэ үеийн хамгийн нэртэй жүжгийн зохиолч.' },
      { id: 'tec', ll: [79, 44], k: 'Сүлжээ', t: 'Технологи', d: 'Хэвлэл, дарь, усан онгоцны мэдлэг эзэнт гүрний сүлжээгээр тархах нөхцөл бүрдсэн. Хэн хэнд шууд дамжуулсан нь маргаантай ⚖.' }
    ],
    cross: [['ast', 'med'], ['med', 'art'], ['isl', 'tec'], ['bud', 'chr']]
  };
  const s14cam = { cx: 830, cy: 330, w: 1180 };
  let s14built = false;
  function buildNet() {
    const svg = $('#s14net'); svg.innerHTML = '';
    const pos = {};
    const hub = toScreen(C.dadu.x, C.dadu.y, s14cam);
    pos.hub = hub;
    NET.nodes.forEach(n => { const [x, y] = P(n.ll[0], n.ll[1]); pos[n.id] = toScreen(x, y, s14cam); });
    const lg = svgEl('g', {}, svg);
    NET.nodes.forEach(n => { const a = pos.hub, b = pos[n.id]; svgEl('path', { class: 'lnk', d: arcPath(a, b, .18), 'data-n': n.id }, lg); });
    NET.cross.forEach(([a, b]) => svgEl('path', { class: 'lnk', d: arcPath(pos[a], pos[b], .25), 'stroke-dasharray': '3 6', 'stroke-opacity': .35 }, lg));
    const hubG = svgEl('g', { class: 'node hubn' }, svg);
    svgEl('circle', { class: 'c', cx: hub[0], cy: hub[1], r: 16, fill: '#b23a2e' }, hubG);
    const ht = svgEl('text', { x: hub[0] + 26, y: hub[1] + 8 }, hubG); ht.textContent = 'Дайду';
    NET.nodes.forEach(n => {
      const [x, y] = pos[n.id];
      const g = svgEl('g', { class: 'node', tabindex: 0, role: 'button', 'data-id': n.id, 'aria-label': n.t }, svg);
      svgEl('circle', { class: 'c', cx: x, cy: y, r: 11 }, g);
      const left = x < hub[0] - 200;
      const t = svgEl('text', { x: x + (left ? -20 : 20), y: y - 4, 'text-anchor': left ? 'end' : 'start' }, g); t.textContent = n.t;
      const k = svgEl('text', { class: 'k', x: x + (left ? -20 : 20), y: y + 18, 'text-anchor': left ? 'end' : 'start' }, g); k.textContent = n.k.toUpperCase();
      const sel = () => selectNode(n.id);
      g.addEventListener('click', sel);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); sel(); } });
    });
    s14built = true;
  }
  function selectNode(id) {
    const n = NET.nodes.find(x => x.id === id);
    $$('#s14net .node').forEach(g => g.classList.toggle('on', g.dataset.id === id));
    $$('#s14net .lnk').forEach(l => l.setAttribute('stroke-opacity', l.dataset.n === id ? 1 : (l.dataset.n ? .4 : .25)));
    $('#s14k').textContent = n.k; $('#s14t').textContent = n.t; $('#s14d').textContent = n.d;
    if (!reduced) gsap.fromTo('#s14detail > *', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, stagger: .06 });
  }
  S.s14 = {
    year: 1281, cam: s14cam, veil: .6,
    map: { terr: { yuan: .3, gh: .2, chag: .2, ilk: .2, tibet: .25 } },
    enter(tl, el) {
      if (!s14built) buildNet();
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      up(tl, $('.sub', el), .5);
      const svg = $('#s14net');
      tl.fromTo($('.hubn', svg), { opacity: 0, scale: 0, transformOrigin: 'center', transformBox: 'fill-box' }, { opacity: 1, scale: 1, duration: .8, ease: 'back.out(2)' }, .8);
      $$('.lnk', svg).forEach((l, i) => drawOn(tl, l, 1 + i * .18, 1.2));
      tl.fromTo($$('.node:not(.hubn)', svg), { opacity: 0 }, { opacity: 1, duration: .6, stagger: .18 }, 1.4);
      up(tl, $('#s14detail', el), 3.2);
      tl.call(() => selectNode('bud'), null, 3.2);
      ['ast', 'art', 'chr'].forEach((id, i) => tl.call(() => selectNode(id), null, 7 + i * 4));
    }
  };

  const S15 = {
    kaesong: [1610, 110], hakata: [1610, 400], thanglong: [1520, 620], pagan: [1030, 700], java: [1560, 830], tabriz: [520, 480], venice: [90, 330]
  };
  S.s15 = {
    year: 1290, cam: { cx: 690, cy: 470, w: 1180 }, veil: .16, cityReveal: true,
    map: { terr: { yuan: .55, tibet: .35, goryeo: .5, gh: .25, chag: .25, ilk: .3 }, cities: ['dadu', 'kaesong', 'hakata', 'thanglong', 'pagan', 'java', 'tabriz', 'venice', 'rome', 'paris', 'vijaya'], gold: ['dadu'], side: { kaesong: 'r', hakata: 'r', venice: 't', rome: 'b', paris: 'l', tabriz: 'b', java: 'b', pagan: 'l', thanglong: 'b', vijaya: 'l', dadu: 'l' } },
    enter(tl, el) {
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      $('#s15 .eyebrow').style.cssText = 'left:120px;top:auto;bottom:250px';
      $('#s15 .h2').style.cssText = 'left:120px;top:auto;bottom:130px';
      const its = $$('.it', el);
      its.forEach(it => {
        const p = S15[it.dataset.a];
        it.style.cssText = `position:absolute;left:${p[0]}px;top:${p[1]}px;width:300px;display:block;padding:14px 16px;background:rgba(12,13,15,.82);border-top:1px solid #b59a62`;
      });
      const list = $('#s15list'); list.style.cssText = 'position:absolute;inset:0;left:0;top:0;width:1920px;height:1080px;display:block;pointer-events:none';
      const keys = Object.keys(S15);
      keys.forEach(k => tl.set(C[k].g, { opacity: 0 }, 0));
      tl.set([C.rome.g, C.paris.g, C.vijaya.g], { opacity: 0 }, 0);
      pulse(tl, 'dadu', .6, '#b59a62', 50);
      keys.forEach((k, i) => {
        const at = 1 + i * .75;
        const a = [C.dadu.x, C.dadu.y], b = [C[k].x, C[k].y];
        const p = svgEl('path', { d: arcPath(a, b, k === 'venice' || k === 'tabriz' ? .16 : .3), class: 'route land-r', 'data-sw': 1.8 }, gRoutes);
        p.setAttribute('stroke-width', 1.8 * invScale);
        drawOn(tl, p, at, 1.2, 'power2.out');
        tl.to(C[k].g, { opacity: 1, duration: .4 }, at + 1);
        pulse(tl, k, at + 1, '#b59a62', 26);
        tl.fromTo(its[i], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6, ease: 'power3.out' }, at + 1.1);
      });
      // Rabban Sauma reached Rome and Paris
      const rs = route(['tabriz', 'constantinople', 'rome', 'paris'], 'parch-r', 1.4);
      drawOn(tl, rs, 6.6, 1.6);
      tl.to([C.rome.g, C.paris.g, C.vijaya.g], { opacity: 1, duration: .4, stagger: .2 }, 7.4);
    }
  };

  S.s16 = {
    year: 1351, cam: { cx: 971, cy: 360, w: 380 }, veil: .22, own: ['yuan'], cityReveal: true,
    map: { terr: { yuan: .55 }, rivers: { yellow: 1, yangtze: .6 }, cities: ['dadu', 'yingzhou', 'gaoyou', 'nanjing', 'poyang'], hot: ['yingzhou', 'gaoyou', 'poyang'], side: { dadu: 'r', yingzhou: 'l', gaoyou: 'r', nanjing: 'b', poyang: 'b' } },
    enter(tl, el) {
      const fs = $$('.f', el);
      fs.forEach(f => f.classList.remove('on'));
      up(tl, [$('.eyebrow', el), $('.h2', el)], .1);
      up(tl, fs, .4, { st: .08, y: 16 });
      tl.set(fs, { opacity: '' }, 1.4);
      const on = (i, at) => tl.call(() => fs.forEach((f, j) => f.classList.toggle('on', j <= i)), null, at);
      ['dadu', 'yingzhou', 'gaoyou', 'nanjing', 'poyang'].forEach(k => tl.set(C[k].g, { opacity: k === 'dadu' ? 1 : 0 }, 0));
      // I: succession ticks
      on(0, 1.4);
      const tk = $('#s16ticks'); tk.innerHTML = '';
      const tx = y => 10 + (y - 1307) / 26 * 740;
      svgEl('line', { x1: 10, x2: 750, y1: 40, y2: 40, stroke: '#7b766c' }, tk);
      [[1307, 'Хайсан'], [1311], [1320], [1323], [1328], [1328.5], [1329.2], [1329.7], [1332]].forEach(([y], i) => {
        const l = svgEl('line', { x1: tx(y), x2: tx(y), y1: 22, y2: 58, stroke: '#ece4d3', 'stroke-width': 2 }, tk);
        tl.fromTo(l, { opacity: 0, scaleY: 0, transformOrigin: '50% 100%', transformBox: 'fill-box' }, { opacity: 1, scaleY: 1, duration: .18 }, 1.6 + i * .16);
      });
      const tg = svgEl('line', { x1: tx(1333), x2: tx(1333), y1: 6, y2: 66, stroke: '#d0563f', 'stroke-width': 3 }, tk);
      tl.fromTo(tg, { opacity: 0 }, { opacity: 1, duration: .3 }, 3.2);
      const t1 = svgEl('text', { x: 10, y: 14, fill: '#7b766c', 'font-size': 15, 'font-family': 'IBM Plex Mono, monospace' }, tk); t1.textContent = '1307';
      const t2 = svgEl('text', { x: tx(1333) - 8, y: 14, fill: '#d0563f', 'font-size': 15, 'font-family': 'IBM Plex Mono, monospace', 'text-anchor': 'end' }, tk); t2.textContent = '1333 · Тогоонтөмөр';
      const t3 = svgEl('text', { x: 300, y: 14, fill: '#b7ad9a', 'font-size': 15, 'font-family': 'IBM Plex Mono, monospace' }, tk); t3.textContent = '26 ЖИЛД 8 ХААН';
      tl.fromTo([t1, t2, t3], { opacity: 0 }, { opacity: 1, duration: .5 }, 1.6);
      // II: money — the map dims
      on(1, 4.2);
      tl.to('#mapveil', { opacity: .4, duration: 2 }, 4.2);
      // III: Yellow River floods
      on(2, 6.6);
      tl.to(RIV.yellow, { stroke: '#d0563f', strokeOpacity: 1, strokeWidth: 4, duration: 1, yoyo: true, repeat: 3 }, 6.6);
      const fl = P(115.5, 35.2);
      const flood = svgEl('ellipse', { cx: fl[0], cy: fl[1], rx: 1, ry: 1, fill: 'url(#glow)' }, gFx);
      tl.fromTo(flood, { attr: { rx: 1, ry: 1 }, opacity: 0 }, { attr: { rx: 26, ry: 12 }, opacity: 1, duration: 2.4, ease: 'power2.out' }, 6.8);
      const lab = fxLabel(113.2, 36.6, '1344 · ШАР МӨРНИЙ ҮЕР', 'mapnote', 14);
      tl.to(lab, { opacity: 1, duration: .6 }, 7);
      // IV: rebellions ignite
      on(3, 9.4);
      tl.to('#mapveil', { opacity: .55, duration: 2 }, 9.4);
      ['yingzhou', 'gaoyou', 'poyang', 'nanjing'].forEach((k, i) => {
        tl.to(C[k].g, { opacity: 1, duration: .4 }, 9.6 + i * .5);
        pulse(tl, k, 9.6 + i * .5, '#d0563f', 40, 3);
      });
      const lab2 = fxLabel(110.2, 31.0, '1351 · УЛААН АЛЧУУРТАН', 'mapnote', 14);
      tl.to(lab2, { opacity: 1, duration: .6 }, 9.8);
      tl.to(T.yuan, { opacity: .25, duration: 3 }, 9.6);
    },
    leave() { gsap.set(RIV.yellow, { clearProps: 'stroke,strokeOpacity,strokeWidth' }); }
  };

  S.s17 = {
    year: 1333, cam: { cx: C.dadu.x, cy: C.dadu.y, w: 260 }, veil: .9,
    map: { terr: { yuan: .2 } },
    ambient: () => gsap.to(cam, { w: '+=40', duration: 30, ease: 'none', onUpdate: applyCam }),
    enter(tl, el) {
      up(tl, $('.eyebrow', el), .1, { y: 10 });
      chars(tl, $('.name', el), .2, { y: 0, blur: 16, st: .06, d: 1.6, ease: 'power2.out' });
      up(tl, $('.alt', el), 1.2);
      const svg = $('#s17line'); svg.innerHTML = '';
      const x = y => 20 + (y - 1320) / 50 * 1640, AY = 190;
      const axis = svgEl('line', { class: 'axis', x1: x(1320), x2: x(1370), y1: AY, y2: AY }, svg);
      const span = svgEl('line', { class: 'span', x1: x(1333), x2: x(1370), y1: AY, y2: AY }, svg);
      for (let y = 1320; y <= 1370; y += 10) { const t = svgEl('text', { class: 'y', x: x(y), y: AY + 30, 'text-anchor': 'middle', opacity: .55 }, svg); t.textContent = y; }
      const EV = [[1320, 'төрсөн', 'b1'], [1333, 'хаан ширээнд', 'a1'], [1340, 'Тогтох Баяныг унагав', 'b1'], [1351, 'Улаан алчууртны бослого', 'a1'], [1354, 'Гаоюй: Тогтохыг огцруулав', 'b2'], [1356, 'Жу Юаньжан Нанжинд', 'a2'], [1363, 'Поян нуур', 'b1'], [1368, 'Дайдугаас гарав', 'a1', 'end'], [1370, 'Инчанд таалал төгсөв', 'a3', 'end']];
      const ROW = { a1: 120, a2: 64, a3: 10, b1: 268, b2: 322 };
      tl.fromTo(axis, { attr: { x2: x(1320) } }, { attr: { x2: x(1370) }, duration: 1.6, ease: 'power2.inOut' }, 1.4);
      tl.fromTo(span, { attr: { x2: x(1333) } }, { attr: { x2: x(1370) }, duration: 5.6, ease: 'none' }, 2.2);
      EV.forEach(([y, lbl, row, anc], i) => {
        const ry = ROW[row];
        const g = svgEl('g', {}, svg);
        svgEl('line', { class: 'tick', x1: x(y), x2: x(y), y1: AY, y2: ry < AY ? ry + 10 : ry - 22 }, g);
        const t = svgEl('text', { x: x(y) + (anc === 'end' ? -8 : 8), y: ry, 'text-anchor': anc === 'end' ? 'end' : 'start' }, g);
        const ys = svgEl('tspan', { class: 'y', fill: '#b59a62' }, t); ys.textContent = y + '  ';
        const ls = svgEl('tspan', {}, t); ls.textContent = lbl;
        const at = y < 1333 ? 1.6 + i * .2 : 2.2 + (y - 1333) / 37 * 5.6;
        tl.fromTo(g, { opacity: 0, y: ry < AY ? 10 : -10 }, { opacity: 1, y: 0, duration: .5 }, at);
      });
      up(tl, $('.quote', el), 8);
      tl.to('#mapveil', { opacity: .96, duration: 6 }, 2);
    }
  };

  S.s18 = {
    year: 1368, cam: { cx: 1064, cy: 300, w: 560 }, veil: .1, own: ['mingGrow', 'yuan', 'nyuan', 'yunnan'],
    map: { terr: { yuan: .55 }, cities: ['nanjing', 'dadu', 'shangdu', 'yingchang', 'karakorum'], gold: ['dadu'], hot: ['yingchang'], side: { nanjing: 'r', dadu: 'l', shangdu: 'l', yingchang: 'r', karakorum: 't' } },
    enter(tl, el) {
      const steps = $$('.step', el);
      $('#s18 .eyebrow').style.cssText = 'left:120px;top:540px';
      up(tl, $('.eyebrow', el), .2, { y: 10 });
      tl.set(mingCirc, { attr: { r: 0 } }, 0);
      tl.set(T.mingGrow, { opacity: 1 }, 0);
      up(tl, steps[0], .6);
      pulse(tl, 'nanjing', .6, '#7f97a6', 40);
      tl.to(mingCirc, { attr: { r: 260 }, duration: 5.5, ease: 'power1.inOut' }, .8);
      up(tl, steps[1], 2.6);
      const adv = route(['nanjing', [117.8, 35], [116.9, 37.8], 'dadu'], 'sea-r', 3.4);
      drawOn(tl, adv, 2.6, 1.8);
      pulse(tl, 'dadu', 4.3, '#b59a62', 50);
      tl.to(T.yuan, { opacity: 0, duration: 2 }, 3.8);
      tl.fromTo(T.nyuan, { opacity: 0 }, { opacity: .85, duration: 2 }, 4.4);
      tl.fromTo(T.yunnan, { opacity: 0 }, { opacity: .9, duration: 1.4 }, 5);
      const ret = route(['dadu', 'shangdu', 'yingchang'], 'red-r', 3);
      ret.style.strokeLinecap = 'round';
      drawOn(tl, ret, 4.6, 1.8);
      up(tl, steps[2], 5.2);
      pulse(tl, 'yingchang', 6.4, '#d0563f', 40);
      chars(tl, $('#s18big'), 6.2, { y: 140, blur: 24, st: .12, d: 1.6 });
      up(tl, $$('.duo .a', el), 7.4, { st: .3 });
      up(tl, $$('p.cap', el), 8, { y: 8 });
      const lab = fxLabel(100.5, 24.8, 'ЮНЬНАНЬ · 1381–82 ХҮРТЭЛ', 'mapnote', 13);
      tl.to(lab, { opacity: 1, duration: .6 }, 6);
    }
  };

  S.s19 = {
    year: 1635, cam: { cx: 980, cy: 230, w: 700 }, veil: .5,
    map: { terr: { nyuan: .8, ming: .35 }, cities: ['karakorum', 'buir'], side: { buir: 'r' } },
    enter(tl, el) {
      up(tl, $('.h2w .eyebrow', el), .1, { y: 10 });
      tl.fromTo($('#s19t'), { opacity: 0, letterSpacing: '.2em', filter: 'blur(14px)' }, { opacity: 1, letterSpacing: '-.01em', filter: 'blur(0px)', duration: 1.6, ease: 'power3.out' }, .3);
      up(tl, $('.lead', el), 1);
      const svg = $('#s19tl'); svg.innerHTML = '';
      const x = y => 20 + (y - 1368) / (1640 - 1368) * 1640, AY = 150;
      svgEl('line', { class: 'axis', x1: x(1368), x2: x(1640), y1: AY, y2: AY }, svg);
      const span = svgEl('line', { class: 'span', x1: x(1368), x2: x(1368), y1: AY, y2: AY }, svg);
      const EV = [[1368, 'Хятадаас ухрав', 'a1'], [1370, 'Билигт хаан', 'b1'], [1372, 'Мингийн аяныг няцаав', 'a2'], [1388, 'Буйр нуур', 'b2'], [1449, 'Түмүгийн тулалдаан', 'a1'], [1480, 'XV зууны сүүл · Даян хаан', 'b1', null, 'c.'], [1578, 'Алтан хаан – Далай лам', 'a1'], [1635, 'Юанийн тамга Манжид', 'b1', 'end']];
      const ROW = { a1: 90, a2: 36, b1: 214, b2: 270 };
      tl.to(span, { attr: { x2: x(1635) }, duration: 6, ease: 'none' }, 1.6);
      EV.forEach(([y, lbl, row, anc, pre]) => {
        const ry = ROW[row], at = 1.6 + (y - 1368) / (1635 - 1368) * 6;
        const g = svgEl('g', {}, svg);
        svgEl('circle', { cx: x(y), cy: AY, r: 5 }, g);
        svgEl('line', { x1: x(y), x2: x(y), y1: AY, y2: ry < AY ? ry + 10 : ry - 20, stroke: '#7b766c' }, g);
        const t = svgEl('text', { x: x(y) + (anc === 'end' ? -8 : 8), y: ry, 'text-anchor': anc === 'end' ? 'end' : 'start' }, g);
        const ys = svgEl('tspan', { class: 'y', fill: '#b59a62' }, t); ys.textContent = (pre ? '' : y + '  ');
        const ls = svgEl('tspan', {}, t); ls.textContent = lbl;
        tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: .5 }, at);
      });
      pulse(tl, 'karakorum', 1.8, '#d0563f', 40);
      pulse(tl, 'buir', 2.4, '#7f97a6', 34);
      const ro = { y: 1368 };
      tl.fromTo(ro, { y: 1368 }, { y: 1635, duration: 6, ease: 'none', onUpdate: () => { rState.y = ro.y; drawRuler(); } }, 1.6);
      up(tl, $$('.term > div', el), 7.6, { st: .2 });
    }
  };

  S.s20 = {
    year: 1368, cam: { cx: 700, cy: 360, w: 1360 }, veil: .66,
    map: { terr: { yuan: .3, gh: .2, chag: .2, ilk: .2, tibet: .2 } },
    ambient: () => gsap.to(cam, { cx: '+=40', duration: 40, ease: 'none', onUpdate: applyCam }),
    enter(tl, el) {
      up(tl, $$('.q > *', el), .1);
      const wds = $$('.wd', el);
      const pos = [[330, 380], [960, 330], [1590, 380], [330, 800], [960, 850], [1590, 800]];
      wds.forEach((w, i) => { w.style.left = pos[i][0] + 'px'; w.style.top = pos[i][1] + 'px'; });
      tl.fromTo(wds, { opacity: 0, scale: .85, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1, stagger: .25, ease: 'power3.out' }, .6);
      // converge into one line under the statement
      wds.forEach((w, i) => {
        tl.to(w, { left: 240 + i * 288, top: 930, scale: .62, duration: 1.4, ease: 'power3.inOut' }, 4.2 + i * .05);
        tl.to($('.d', w), { opacity: 0, duration: .5 }, 4.2);
      });
      const f = $('.final .display', el);
      chars(tl, f, 5.2, { y: 24, blur: 10, st: .012, d: .9 });
      up(tl, $('.final .cap', el), 7.4, { y: 8 });
    }
  };

  /* ---------- navigation ---------- */
  const slides = $$('.slide');
  const total = slides.length;
  $('#tot').textContent = String(total).padStart(2, '0');
  const cur = { i: -1, id: null, tl: null, amb: null, camTw: null };
  const EXITS = ['fade', 'up', 'zoom', 'fade', 'left'];

  function goto(i, dir = 1) {
    i = Math.max(0, Math.min(total - 1, i));
    if (i === cur.i) return;
    const prev = cur.i >= 0 ? slides[cur.i] : null;
    const prevDef = prev ? S[prev.id] : null;
    if (cur.tl) cur.tl.kill();
    if (cur.amb) cur.amb.kill();
    if (prevDef && prevDef.leave) prevDef.leave();
    stopParticles();
    clearFx();
    gsap.to('#s08tip', { opacity: 0, duration: .2 });

    const el = slides[i], def = S[el.id];
    cur.i = i; cur.id = el.id;

    // exit previous
    if (prev) {
      const kind = EXITS[cur.i % EXITS.length];
      const to = { opacity: 0, duration: reduced ? 0 : .55, ease: 'power2.in', onComplete: () => { prev.classList.remove('is-active'); gsap.set(prev, { clearProps: 'opacity,transform,filter' }); } };
      if (!reduced) {
        if (kind === 'up') to.y = -40 * dir;
        if (kind === 'zoom') { to.scale = 1.04; to.filter = 'blur(8px)'; }
        if (kind === 'left') to.x = -60 * dir;
        if (kind === 'fade') to.filter = 'blur(6px)';
      }
      gsap.to(prev, to);
    }
    // camera + map state
    if (cur.camTw) cur.camTw.kill();
    const c = def.cam;
    if (reduced) { Object.assign(cam, c); applyCam(); }
    else cur.camTw = gsap.to(cam, { cx: c.cx, cy: c.cy, w: c.w, duration: def.camDur || 2.2, ease: 'power3.inOut', onUpdate: applyCam });
    setMap({ veil: def.veil, ...def.map }, 1.4, def.own || [], !!def.cityReveal);
    rulerTo(def.year);

    // enter
    el.classList.add('is-active');
    gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' });
    const tl = gsap.timeline({ delay: reduced ? 0 : (prev ? .45 : .2) });
    def.enter.call(def, tl, el);
    cur.tl = tl;
    if (reduced) tl.progress(1, false);
    else if (def.ambient) tl.call(() => { cur.amb = def.ambient(); }, null, 2.6);

    $('#cur').textContent = String(i + 1).padStart(2, '0');
    try { history.replaceState(null, '', '#' + el.id); } catch (e) {}
    updateNotes();
  }
  const next = () => goto(cur.i + 1, 1), prev = () => goto(cur.i - 1, -1);

  /* ---------- overlays ---------- */
  const notes = $('#notes'), src = $('#sources');
  function updateNotes() {
    const el = slides[cur.i];
    $('#notesH').textContent = `Илтгэгчийн тэмдэглэл · ${String(cur.i + 1).padStart(2, '0')} ${el.dataset.title}`;
    const a = $('.notes', el); $('#notesB').textContent = a ? a.textContent.trim() : '';
  }
  const toggleNotes = () => { notes.hidden = !notes.hidden; $('#bNotes').classList.toggle('on', !notes.hidden); };
  const toggleSrc = () => { src.hidden = !src.hidden; $('#bSrc').classList.toggle('on', !src.hidden); };
  const toggleMotion = () => {
    reduced = !reduced; setReducedClass();
    try { localStorage.setItem('yuan-rm', reduced ? '1' : '0'); } catch (e) {}
    const i = cur.i; cur.i = -1; goto(i);
  };
  const toggleFull = () => {
    const d = document;
    if (!d.fullscreenElement) { const p = d.documentElement.requestFullscreen && d.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
    else if (d.exitFullscreen) d.exitFullscreen();
  };
  $('#bNotes').addEventListener('click', toggleNotes); $('#xNotes').addEventListener('click', toggleNotes);
  $('#bSrc').addEventListener('click', toggleSrc); $('#xSrc').addEventListener('click', toggleSrc);
  $('#bMotion').addEventListener('click', toggleMotion);
  $('#bFull').addEventListener('click', toggleFull);

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('button,[role=button],input,textarea')) {
      if (e.key === ' ' || e.key === 'Enter') return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); goto(0, -1); break;
      case 'End': e.preventDefault(); goto(total - 1, 1); break;
      case 'n': case 'N': toggleNotes(); break;
      case 's': case 'S': toggleSrc(); break;
      case 'm': case 'M': toggleMotion(); break;
      case 'f': case 'F': toggleFull(); break;
      case 'Escape': notes.hidden = true; src.hidden = true; $('#bNotes').classList.remove('on'); $('#bSrc').classList.remove('on'); break;
    }
  });
  $('.navzone.l').addEventListener('click', prev);
  $('.navzone.r').addEventListener('click', next);
  let tx0 = null, ty0 = null;
  addEventListener('touchstart', e => { const t = e.changedTouches[0]; tx0 = t.clientX; ty0 = t.clientY; }, { passive: true });
  addEventListener('touchend', e => {
    if (tx0 === null) return;
    const t = e.changedTouches[0], dx = t.clientX - tx0, dy = t.clientY - ty0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) (dx < 0 ? next : prev)();
    tx0 = null;
  }, { passive: true });
  addEventListener('hashchange', () => { const j = slides.findIndex(s => '#' + s.id === location.hash); if (j >= 0 && j !== cur.i) goto(j, j > cur.i ? 1 : -1); });

  /* ---------- start ---------- */
  setReducedClass();
  applyCam(); drawRuler();
  const start = slides.findIndex(s => '#' + s.id === location.hash);
  goto(start >= 0 ? start : 0);
  window.__deck = { goto, get index() { return cur.i; }, total };
})();
