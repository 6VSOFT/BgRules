(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');
  const chips = $('#chips');
  const progress = $('#progress');
  const toc = $('#toc');
  const drawer = $('#drawer');
  const scrim = $('#scrim');

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  let games = [];
  let current = null;      // { game, sections }
  let observer = null;
  let revealer = null;
  let presentIdx = 0;

  /* ---------------- data ---------------- */
  async function loadGames() {
    if (games.length) return games;
    const res = await fetch('games/index.json');
    games = (await res.json()).games;
    return games;
  }

  /* ---------------- router ---------------- */
  async function route() {
    exitPresent(false);
    closeToc();
    const hash = location.hash.replace(/^#\/?/, '');
    const [kind, id, mode] = hash.split('/');
    await loadGames();
    if (kind === 'g' && id) {
      const game = games.find(g => g.id === id);
      if (game && game.rules) return openGame(game, mode === 'present');
    }
    renderLibrary();
  }

  function setChrome(game) {
    const inGame = !!game;
    $('#backBtn').hidden = !inGame;
    $('#presentBtn').hidden = !inGame;
    $('#tocBtn').hidden = !inGame;
    chips.hidden = !inGame;
    progress.hidden = !inGame;
    $('#brandText').textContent = inGame ? game.title : '桌游规则书';
    $('#brand img').hidden = inGame;
    document.title = inGame ? `${game.title} · 规则书` : '桌游规则书';
  }

  /* ---------------- library ---------------- */
  function renderLibrary() {
    current = null;
    teardownObservers();
    setChrome(null);
    const last = store.get('lastGame');
    const cards = games.map(g => {
      if (!g.rules) {
        return `<div class="game soon"><div class="placeholder">${esc(g.title)}</div>
          <div class="body"><h3>${esc(g.title)}</h3><p>规则整理中</p></div></div>`;
      }
      const pos = store.get('pos:' + g.id);
      return `<a class="game rv" href="#/g/${g.id}">
        <img class="cover" src="${g.cover}" alt="${esc(g.title)} 封面" loading="lazy"${g.coverPos ? ` style="object-position:${esc(g.coverPos)}"` : ''}>
        <div class="body">
          <h3>${esc(g.title)}<small>${esc(g.en || '')}</small></h3>
          <p>${esc(g.tagline || '')}</p>
          <div class="meta">
            ${g.id === last && pos ? '<span class="hot">继续阅读</span>' : ''}
            ${(g.meta || []).map(m => `<span>${esc(m)}</span>`).join('')}
          </div>
        </div></a>`;
    }).join('');
    view.innerHTML = `<div class="library">
      <p class="eyebrow">GET! BOARDGAME · 规则书</p>
      <h1><span>桌游规则书</span></h1>
      <p class="lead">翻开一本，几分钟上手。装到主屏幕后可离线使用，桌边随时查。</p>
      <div class="shelf">${cards}</div>
      <p class="foot-note">规则图片来自各游戏官方规则书，仅用于学习交流。</p>
    </div>`;
    window.scrollTo(0, 0);
    setupReveal();
  }

  /* ---------------- game ---------------- */
  async function openGame(game, present) {
    setChrome(game);
    if (!current || current.game.id !== game.id) {
      view.innerHTML = '<p class="loading">加载规则中…</p>';
      let html;
      try {
        const res = await fetch(game.rules);
        if (!res.ok) throw new Error(res.status);
        html = await res.text();
      } catch (e) {
        view.innerHTML = '<p class="loading">规则加载失败，请联网后重试。</p>';
        return;
      }
      const base = new URL(game.rules, location.href);
      const doc = document.createElement('article');
      doc.className = 'rules-doc';
      doc.innerHTML = html;
      $$('img[src]', doc).forEach(img => {
        img.src = new URL(img.getAttribute('src'), base).href;
        img.decoding = 'async';
        if (!img.closest('.cover')) img.loading = 'lazy';
      });
      const sections = $$(':scope > section', doc);
      sections.forEach((s, i) => {
        s.id = s.id || 'sec-' + i;
        if (!s.classList.contains('cover')) {
          const n = document.createElement('p');
          n.className = 'pagenum';
          n.textContent = `${i + 1} / ${sections.length}`;
          s.appendChild(n);
        }
        $$('.card, .rule, .pic, .swatch, h3, .lead, .callout', s).forEach(el => el.classList.add('rv'));
      });
      view.replaceChildren(doc);
      const pager = document.createElement('div');
      pager.className = 'pager';
      pager.innerHTML = '<button class="back-top" type="button">↑ 回到顶部</button>';
      pager.firstChild.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      view.appendChild(pager);
      current = { game, sections };
      buildNav(sections);
      setupReveal();
      setupSpy();
      store.set('lastGame', game.id);
      const pos = store.get('pos:' + game.id);
      const target = pos != null && sections[pos];
      if (target && pos > 0 && !present) {
        requestAnimationFrame(() => target.scrollIntoView());
        toast(`已回到上次的位置：${title(target)}`);
      } else {
        window.scrollTo(0, 0);
      }
    }
    if (present) enterPresent(store.get('pos:' + game.id) || 0);
  }

  function title(sec) {
    return sec.dataset.title || ($('h2', sec) || $('h1', sec) || {}).textContent || '';
  }
  function num(sec, i) {
    return sec.dataset.num || String(i).padStart(2, '0');
  }

  function buildNav(sections) {
    chips.innerHTML = sections.map((s, i) =>
      `<button class="chip" data-i="${i}"><b>${num(s, i)}</b>${esc(title(s))}</button>`).join('');
    toc.innerHTML = sections.map((s, i) =>
      `<li><button data-i="${i}"><b>${num(s, i)}</b><span>${esc(title(s))}</span></button></li>`).join('');
  }

  function goTo(i) {
    if (!current) return;
    if (document.body.classList.contains('presenting')) return showSlide(i);
    current.sections[i]?.scrollIntoView({ behavior: 'smooth' });
  }

  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b) goTo(+b.dataset.i);
  });
  toc.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    closeToc();
    goTo(+b.dataset.i);
  });

  function setActive(i) {
    if (!current) return;
    $$('.chip', chips).forEach((c, k) => c.classList.toggle('on', k === i));
    $$('button', toc).forEach((c, k) => c.classList.toggle('on', k === i));
    const chip = chips.children[i];
    if (chip) {
      const left = chip.offsetLeft - chips.clientWidth / 2 + chip.clientWidth / 2;
      chips.scrollTo({ left, behavior: 'smooth' });
    }
    store.set('pos:' + current.game.id, i);
  }

  function setupSpy() {
    if (observer) observer.disconnect();
    const visible = new Map();
    observer = new IntersectionObserver(entries => {
      entries.forEach(en => visible.set(en.target, en.isIntersecting ? en.intersectionRect.height : 0));
      let best = -1, bestH = 0;
      current.sections.forEach((s, i) => { const h = visible.get(s) || 0; if (h > bestH) { bestH = h; best = i; } });
      if (best >= 0 && !document.body.classList.contains('presenting')) setActive(best);
    }, { threshold: [0, 0.15, 0.3, 0.5, 0.75, 1], rootMargin: '-120px 0px -30% 0px' });
    current.sections.forEach(s => observer.observe(s));
  }

  function setupReveal() {
    if (revealer) revealer.disconnect();
    revealer = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const sibs = el.parentElement ? [...el.parentElement.children].filter(c => c.classList.contains('rv')) : [];
        el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 80 + 'ms';
        el.classList.add('in');
        revealer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv', view).forEach(el => revealer.observe(el));
  }

  function teardownObservers() {
    observer?.disconnect(); observer = null;
  }

  // reading progress bar
  addEventListener('scroll', () => {
    if (!current) return;
    const h = document.documentElement.scrollHeight - innerHeight;
    progress.firstElementChild.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%';
  }, { passive: true });

  /* ---------------- TOC drawer ---------------- */
  function openToc() { drawer.classList.add('on'); scrim.classList.add('on'); }
  function closeToc() { drawer.classList.remove('on'); scrim.classList.remove('on'); }
  $('#tocBtn').onclick = openToc;
  $('#closeToc').onclick = closeToc;
  scrim.onclick = closeToc;
  $('#backBtn').onclick = () => { location.hash = '#/'; };

  /* ---------------- present mode ---------------- */
  const isPresenting = () => document.body.classList.contains('presenting');
  const moreHint = $('#pMore');
  let wakeLock = null;

  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release(); wakeLock = null;
      }
    } catch { /* not supported or denied */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isPresenting()) keepAwake(true);
  });

  function enterPresent(i) {
    if (!current) return;
    $('#pSegs').innerHTML = current.sections.map(() => '<i></i>').join('');
    document.body.classList.add('presenting');
    showSlide(i || 0, 0);
    // Fullscreen only on large screens; on phones it fights the browser's own UI.
    if (matchMedia('(min-width: 900px) and (pointer: fine)').matches) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    keepAwake(true);
  }
  function exitPresent(updateHash = true) {
    if (!isPresenting()) return;
    document.body.classList.remove('presenting');
    current?.sections.forEach(s => { s.classList.remove('current'); s.style.transform = ''; s.style.opacity = ''; });
    moreHint.classList.remove('on');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    keepAwake(false);
    if (current) {
      current.sections[presentIdx]?.scrollIntoView();
      if (updateHash) history.replaceState(null, '', `#/g/${current.game.id}`);
    }
  }
  function updateMore() {
    const s = current?.sections[presentIdx];
    if (!s || !isPresenting()) return moreHint.classList.remove('on');
    moreHint.classList.toggle('on', s.scrollHeight - s.clientHeight - s.scrollTop > 40);
  }
  function showSlide(i, dir) {
    const n = current.sections.length;
    i = Math.max(0, Math.min(n - 1, i));
    if (dir === undefined) dir = i >= presentIdx ? 1 : -1;
    current.sections.forEach((s, k) => {
      s.classList.toggle('current', k === i);
      s.style.transform = ''; s.style.opacity = '';
    });
    const s = current.sections[i];
    s.style.setProperty('--dir', dir * 40 + 'px');
    s.scrollTop = 0;
    s.onscroll = updateMore;
    presentIdx = i;
    const cnt = $('#pCount');
    cnt.textContent = `${i + 1} / ${n}`;
    cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
    $('#pTitle').textContent = `${num(s, i)} · ${title(s)}`;
    $$('#pSegs i').forEach((seg, k) => { seg.classList.toggle('done', k < i); seg.classList.toggle('now', k === i); });
    $('#pPrev').disabled = i === 0;
    $('#pNext').disabled = i === n - 1;
    setActive(i);
    // images may still be loading; re-check overflow once they settle
    updateMore();
    setTimeout(updateMore, 400);
    $$('img', s).forEach(img => { if (!img.complete) img.addEventListener('load', updateMore, { once: true }); });
  }
  $('#presentBtn').onclick = () => {
    history.replaceState(null, '', `#/g/${current.game.id}/present`);
    enterPresent(store.get('pos:' + current.game.id) || 0);
  };
  $('#pPrev').onclick = () => showSlide(presentIdx - 1);
  $('#pNext').onclick = () => showSlide(presentIdx + 1);
  $('#pExit').onclick = () => exitPresent();
  $('#pSegs').addEventListener('click', e => {
    const k = [...e.currentTarget.children].indexOf(e.target);
    if (k >= 0) showSlide(k);
  });
  moreHint.onclick = () => {
    const s = current.sections[presentIdx];
    s.scrollBy({ top: s.clientHeight * 0.7, behavior: 'smooth' });
  };
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isPresenting()) exitPresent();
  });
  addEventListener('resize', updateMore);

  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLightbox(); closeToc(); }
    if (!isPresenting()) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); showSlide(presentIdx + 1); }
    if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); showSlide(presentIdx - 1); }
    if (e.key === 'Home') showSlide(0);
    if (e.key === 'End') showSlide(current.sections.length - 1);
    if (e.key === 'Escape') exitPresent();
  });

  // swipe: the slide follows the finger horizontally; vertical drags scroll as usual
  let tx = 0, ty = 0, tt = 0, axis = null;
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); axis = null;
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!isPresenting() || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - tx, dy = t.clientY - ty;
    if (!axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (axis !== 'x') return;
    const s = current.sections[presentIdx];
    const atEdge = (dx > 0 && presentIdx === 0) || (dx < 0 && presentIdx === current.sections.length - 1);
    const d = atEdge ? dx * 0.2 : dx * 0.6;
    s.style.animation = 'none';
    s.style.transform = `translateX(${d}px)`;
    s.style.opacity = String(1 - Math.min(Math.abs(d) / innerWidth, 0.5));
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!isPresenting() || axis !== 'x') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tx;
    const s = current.sections[presentIdx];
    const fast = Date.now() - tt < 300 && Math.abs(dx) > 30;
    const step = dx < 0 ? 1 : -1;
    const target = presentIdx + step;
    s.style.animation = '';
    if ((Math.abs(dx) > innerWidth * 0.22 || fast) && target >= 0 && target < current.sections.length) {
      showSlide(target, step);
    } else {
      s.style.transition = 'transform .25s ease, opacity .25s ease';
      s.style.transform = ''; s.style.opacity = '';
      setTimeout(() => { s.style.transition = ''; }, 260);
    }
    axis = null;
  }, { passive: true });

  /* ---------------- lightbox ---------------- */
  const lb = $('#lightbox');
  view.addEventListener('click', e => {
    const img = e.target.closest('img.pic');
    if (!img) return;
    $('img', lb).src = img.currentSrc || img.src;
    $('p', lb).textContent = img.alt || '';
    lb.classList.add('on');
  });
  function closeLightbox() { lb.classList.remove('on'); }
  lb.onclick = closeLightbox;

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.onclick = action.run;
      t.appendChild(b);
    }
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), action ? 10000 : 2600);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('规则书有更新', { label: '刷新', run: () => location.reload() });
          }
        });
      });
    }).catch(() => {});
  }

  addEventListener('hashchange', route);
  route();
})();
