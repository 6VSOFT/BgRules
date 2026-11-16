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
        <img class="cover" src="${g.cover}" alt="${esc(g.title)} 封面" loading="lazy">
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
  function enterPresent(i) {
    if (!current) return;
    document.body.classList.add('presenting');
    showSlide(i || 0, 0);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function exitPresent(updateHash = true) {
    if (!document.body.classList.contains('presenting')) return;
    document.body.classList.remove('presenting');
    current?.sections.forEach(s => s.classList.remove('current'));
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (current) {
      current.sections[presentIdx]?.scrollIntoView();
      if (updateHash) history.replaceState(null, '', `#/g/${current.game.id}`);
    }
  }
  function showSlide(i, dir) {
    const n = current.sections.length;
    i = Math.max(0, Math.min(n - 1, i));
    if (dir === undefined) dir = i >= presentIdx ? 1 : -1;
    current.sections.forEach((s, k) => s.classList.toggle('current', k === i));
    const s = current.sections[i];
    s.style.setProperty('--dir', dir * 24 + 'px');
    s.scrollTop = 0;
    presentIdx = i;
    const cnt = $('#pCount');
    cnt.textContent = `${i + 1} / ${n}`;
    cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
    $('#pPrev').disabled = i === 0;
    $('#pNext').disabled = i === n - 1;
    setActive(i);
  }
  $('#presentBtn').onclick = () => {
    history.replaceState(null, '', `#/g/${current.game.id}/present`);
    enterPresent(store.get('pos:' + current.game.id) || 0);
  };
  $('#pPrev').onclick = () => showSlide(presentIdx - 1);
  $('#pNext').onclick = () => showSlide(presentIdx + 1);
  $('#pExit').onclick = () => exitPresent();
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('presenting')) exitPresent();
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLightbox(); closeToc(); }
    if (!document.body.classList.contains('presenting')) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); showSlide(presentIdx + 1); }
    if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); showSlide(presentIdx - 1); }
    if (e.key === 'Home') showSlide(0);
    if (e.key === 'End') showSlide(current.sections.length - 1);
    if (e.key === 'Escape') exitPresent();
  });

  // swipe
  let tx = 0, ty = 0, tt = 0;
  addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
  addEventListener('touchend', e => {
    if (!document.body.classList.contains('presenting')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tx, dy = t.clientY - ty;
    if (Date.now() - tt < 600 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showSlide(presentIdx + (dx < 0 ? 1 : -1));
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
