/* fx.js — wires GSAP (+ScrollTrigger, SplitText), Lenis and React Bits together.
   Everything degrades gracefully: if a library is missing, app.js falls back to its plain behaviour. */
window.FX = (() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const FX = { lenis: null, gsap: hasGsap };

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);
    document.documentElement.classList.add('fx-gsap');
  }

  /* ---- Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync ---- */
  if (window.Lenis && hasGsap && !reduce) {
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      autoRaf: false,
      // let these scroll natively: demo-mode slides, the TOC drawer, tables, the lightbox
      prevent: node =>
        document.body.classList.contains('presenting') ||
        node.id === 'drawer' || node.id === 'lightbox' ||
        (node.classList && node.classList.contains('tbl-wrap')),
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    FX.lenis = lenis;
  }

  // smooth scroll to an element or a y position. Lenis applies the page's CSS scroll-padding-top,
  // which already leaves room for the sticky header + chapter chips.
  FX.scrollTo = (target, { immediate = false } = {}) => {
    if (FX.lenis) {
      FX.lenis.scrollTo(target, {
        duration: immediate ? 0 : 1.1,
        immediate,
        force: true,
      });
      return;
    }
    if (typeof target === 'number') window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
  };

  /* ---- GSAP reveal for .rv elements (replaces the IntersectionObserver + CSS transition) ---- */
  FX.reveal = els => {
    if (!hasGsap || reduce || !els.length) return false;
    gsap.set(els, { opacity: 0, y: 24 });
    ScrollTrigger.batch(els, {
      start: 'top 92%',
      once: true,
      onEnter: batch => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true,
        clearProps: 'transform',
      }),
    });
    return true;
  };

  // drop scroll triggers from the previous view before rendering a new one
  FX.reset = () => {
    if (!hasGsap) return;
    ScrollTrigger.getAll().forEach(st => st.kill());
    FX.unmountAll();
  };
  FX.refresh = () => { if (hasGsap) ScrollTrigger.refresh(); if (FX.lenis) FX.lenis.resize(); };

  /* ---- React Bits islands ---- */
  const roots = [];
  FX.mount = (container, Component, props) => {
    if (!window.React || !window.ReactDOM || !Component) return false;
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(Component, props));
    roots.push(root);
    return true;
  };
  FX.unmountAll = () => { while (roots.length) roots.pop().unmount(); };

  // animated heading via React Bits <SplitText>
  FX.splitTitle = (container, text, props = {}) => {
    const C = window.ReactBits && window.ReactBits.SplitText;
    if (!hasGsap || !C) return false;
    container.textContent = '';
    return FX.mount(container, C, {
      text, tag: 'span', splitType: 'chars', delay: 70, duration: 0.9,
      effect: 'rise', trigger: 'load', textAlign: 'left', hoverEffect: 'lift', ...props,
    });
  };

  return FX;
})();
