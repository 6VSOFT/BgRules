/* 菜单本 — a flip-through menu book for the home page. Always opens on the 目录 (table of contents).
   Book model: a static left page, a static right "end" page, and a stack of leaves on the right.
   Each leaf has a front (right-hand page) and a back (the left-hand page once turned). Turning leaf j
   moves from spread j to spread j+1.
     Desktop: static left = 目录; leaf j front = game j's menu page, back = game j+1's cover
              (last leaf: "下一款" closing page). Spread 0 = 目录 | game 0, spread j = cover j | menu j.
     Phone:   only right-hand pages are visible, so an extra first leaf carries the 目录.
   MenuBook.mount(el, games) → { destroy() } */
window.MenuBook = (() => {
  'use strict';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PHONE = '(max-width: 720px)';

  const coverPage = g => `
    <div class="mb-cover">
      <div class="mb-cover-bg" style="background-image:url('${g.cover}')"></div>
      <img src="${g.cover}" alt="${esc(g.title)} 封面" draggable="false">
    </div>`;

  const menuPage = (g, i, n, first) => `
    <div class="mb-page-in${first ? ' mb-first' : ''}">
      <p class="mb-folio">— ${i + 1} / ${n} —</p>
      <div class="mb-inline-cover"><img src="${g.cover}" alt="" draggable="false" style="object-position:${esc(g.coverPos || '50% 50%')}"></div>
      <p class="mb-en">${esc((g.en || '').toUpperCase())}</p>
      <h3 class="mb-title">${esc(g.title)}</h3>
      <p class="mb-orn" aria-hidden="true">❦</p>
      <p class="mb-tag">${esc(g.tagline || '')}</p>
      <ul class="mb-meta">${(g.meta || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      <a class="mb-open" href="#/g/${g.id}">打开规则书 <span aria-hidden="true">→</span></a>
      <i class="mb-corner" aria-hidden="true"></i>
    </div>`;

  const closingPage = () => `
    <div class="mb-page-in mb-closing">
      <p class="mb-orn big" aria-hidden="true">❦</p>
      <h3 class="mb-title">下一款</h3>
      <p class="mb-tag">规则整理中，敬请期待</p>
    </div>`;

  const endPage = () => `
    <div class="mb-page-in mb-closing">
      <p class="mb-en">THE END</p>
      <h3 class="mb-title">已经翻到最后啦</h3>
      <p class="mb-orn" aria-hidden="true">❦</p>
      <button class="mb-restart" data-go="toc">↺ 回到目录</button>
    </div>`;

  // `pageOf(i)` = spread index where game i's menu page is on the right
  const tocPage = (games, pageOf) => `
    <div class="mb-page-in mb-toc">
      <p class="mb-en">MENU</p>
      <h3 class="mb-title">目录</h3>
      <p class="mb-orn" aria-hidden="true">❦</p>
      <ol>${games.map((g, i) => `<li><button data-go="${pageOf(i)}"><span>${esc(g.title)}</span><i></i><b>${i + 1}</b></button></li>`).join('')}</ol>
      <p class="mb-hint">← 翻页或点选游戏 →</p>
      <i class="mb-corner" aria-hidden="true"></i>
    </div>`;

  function mount(root, all) {
    const games = all.filter(g => g.rules);
    const N = games.length;
    if (!N) return null;
    const mq = matchMedia(PHONE);
    let phone = mq.matches;
    let L = 0;            // number of leaves
    let k = 0;            // leaves turned so far = current spread (0 = 目录)
    let leaves = [], anim = null, busy = false, cast = null;
    const $ = s => root.querySelector(s);

    function build() {
      phone = mq.matches;
      const pageOf = i => (phone ? i + 1 : i);
      const gameLeaves = games.map((g, j) => `
        <div class="mb-leaf">
          <div class="mb-face front">${menuPage(g, j, N, !phone && j === 0)}<i class="mb-shade"></i></div>
          <div class="mb-face back">${j < N - 1 ? coverPage(games[j + 1]) : closingPage()}<i class="mb-shade"></i></div>
        </div>`).join('');
      const tocLeaf = phone ? `
        <div class="mb-leaf">
          <div class="mb-face front">${tocPage(games, pageOf)}<i class="mb-shade"></i></div>
          <div class="mb-face back">${coverPage(games[0])}<i class="mb-shade"></i></div>
        </div>` : '';
      L = N + (phone ? 1 : 0);
      const labels = phone ? ['目录', ...games.map(g => g.title), '最后一页'] : [`目录 · ${games[0].title}`, ...games.slice(1).map(g => g.title), '最后一页'];

      root.innerHTML = `
        <div class="mb-book">
          <div class="mb-left">${phone ? '' : tocPage(games, pageOf)}</div>
          <div class="mb-right mb-end">${endPage()}</div>
          ${tocLeaf}${gameLeaves}
          <i class="mb-cast" aria-hidden="true"></i>
          <i class="mb-spine" aria-hidden="true"></i>
        </div>
        <button class="mb-arrow prev" aria-label="上一页"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <button class="mb-arrow next" aria-label="下一页"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
        <div class="mb-dots">${labels.map((t, i) => `<button data-go="${i}" aria-label="${esc(t)}"></button>`).join('')}</div>`;
      leaves = [...root.querySelectorAll('.mb-leaf')];
      cast = $('.mb-cast');
      k = clamp(k, 0, L);
      settle();
    }

    // angle 0 = lying on the right, -180 = turned over to the left
    function setAngle(leaf, a) {
      leaf.style.transform = `rotateY(${a}deg)`;
      leaf.style.setProperty('--fold', Math.sin(Math.abs(a) / 180 * Math.PI).toFixed(3));
    }
    function castFor(a) {
      cast.style.opacity = (Math.sin(Math.abs(a) / 180 * Math.PI) * 0.55).toFixed(3);
      cast.style.transform = `scaleX(${(1 - Math.abs(a) / 180).toFixed(3)})`;
    }

    // stacking: unturned leaves — lower index on top; turned leaves — higher index on top
    function restack(active = -1) {
      leaves.forEach((leaf, j) => {
        const turned = j < k;
        leaf.style.zIndex = j === active ? 100 : (turned ? 10 + j : 60 - j);
        leaf.classList.toggle('turned', turned);
      });
      root.querySelectorAll('.mb-dots button').forEach((d, i) => d.classList.toggle('on', i === k));
      $('.prev').disabled = k === 0;
      $('.next').disabled = k === L;
    }

    function settle() {
      leaves.forEach((leaf, j) => setAngle(leaf, j < k ? -180 : 0));
      cast.style.opacity = 0;
      restack();
    }

    function turn(j, a0, a1, onDone, dur) {
      if (anim) anim.kill();
      busy = true;
      restack(j);
      const leaf = leaves[j];
      const state = { a: a0 };
      const duration = reduce() ? 0 : (dur ?? 0.9 * Math.abs(a1 - a0) / 180 + 0.15);
      const tick = () => { setAngle(leaf, state.a); castFor(state.a); };
      const done = () => { busy = false; anim = null; onDone && onDone(); settle(); };
      if (window.gsap) anim = gsap.to(state, { a: a1, duration, ease: 'power2.inOut', onUpdate: tick, onComplete: done });
      else { state.a = a1; tick(); done(); }
    }

    const next = () => { if (!busy && k < L) turn(k, 0, -180, () => { k += 1; }); };
    const prev = () => { if (!busy && k > 0) turn(k - 1, -180, 0, () => { k -= 1; }); };

    // jump several spreads: quick flips one after another
    function goTo(t) {
      t = clamp(t, 0, L);
      if (busy || t === k) return;
      const step = () => {
        if (k === t) return;
        if (t > k) turn(k, 0, -180, () => { k += 1; setTimeout(step, 0); }, 0.42);
        else turn(k - 1, -180, 0, () => { k -= 1; setTimeout(step, 0); }, 0.42);
      };
      step();
    }

    /* ---- input (delegated on root so it survives rebuilds) ---- */
    root.addEventListener('click', e => {
      if (e.target.closest('.mb-arrow.next')) return next();
      if (e.target.closest('.mb-arrow.prev')) return prev();
      const g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); goTo(g.dataset.go === 'toc' ? 0 : +g.dataset.go); }
    });
    root.tabIndex = 0;
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });

    // drag a page: it follows the finger, then completes or falls back
    let drag = null;
    root.addEventListener('pointerdown', e => {
      if (busy || !e.target.closest('.mb-book') || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('a,button')) return;
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, axis: null, leaf: -1, dir: 0, a: 0 };
    });
    root.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'x') {
          drag.dir = dx < 0 ? 1 : -1;
          drag.leaf = drag.dir > 0 ? (k < L ? k : -1) : (k > 0 ? k - 1 : -1);
          if (drag.leaf < 0) { drag = null; return; }
          try { root.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
          restack(drag.leaf);
        }
      }
      if (!drag || drag.axis !== 'x') return;
      const w = leaves[drag.leaf].getBoundingClientRect().width || 1;
      drag.a = clamp((drag.dir > 0 ? 0 : -180) + (dx / w) * 180, -180, 0);
      setAngle(leaves[drag.leaf], drag.a);
      castFor(drag.a);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (d.axis !== 'x') return;
      const v = (e.clientX - d.x) / Math.max(1, performance.now() - d.t); // px/ms
      const commit = d.dir > 0 ? (d.a < -70 || v < -0.5) : (d.a > -110 || v > 0.5);
      if (d.dir > 0) turn(d.leaf, d.a, commit ? -180 : 0, () => { if (commit) k += 1; });
      else turn(d.leaf, d.a, commit ? 0 : -180, () => { if (commit) k -= 1; });
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    // crossing the phone/desktop width changes the page list: rebuild on the 目录
    const onMq = () => { if (anim) anim.kill(); busy = false; k = 0; build(); };
    mq.addEventListener('change', onMq);

    build();
    return { destroy() { if (anim) anim.kill(); mq.removeEventListener('change', onMq); } };
  }

  return { mount };
})();
