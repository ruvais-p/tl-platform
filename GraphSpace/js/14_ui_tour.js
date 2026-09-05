/* ==================================================================
   GraphSpaceTour — a first-visit guided walkthrough of the dashboard.
   Spotlights real UI elements in place (no separate slides/images to
   maintain) and switches mode/workspace tab as needed so every step
   points at something actually on screen. Runs once automatically on
   a student's first visit (tracked via localStorage) and can always
   be replayed from the "Take Tour" button in the topbar.
   ================================================================== */
const GraphSpaceTour = (() => {
  const SEEN_KEY = 'graphspace_tour_seen_v1';

  function q(id) { return document.getElementById(id); }
  function click(sel) { const el = document.querySelector(sel); if (el) el.click(); }

  const STEPS = [
    {
      title: 'Welcome to GraphSpace 👋',
      body: `A quick tour of what's here — a dozen short stops, about a minute. Click <em>Next</em> to
             start, or <em>Skip</em> to jump straight in. You can replay this anytime from the
             <strong>Take Tour</strong> button in the top bar.`,
    },
    {
      title: '3D ↔ 2D workspaces',
      body: `GraphSpace has two workspaces sharing one page: a full <strong>3D grapher</strong>
             (surfaces, curves, vector fields) and a <strong>2D linear-programming &amp; geometry</strong>
             workspace. Switch between them here at any time — nothing you've built is lost.`,
      target: '#mode-switch',
    },
    {
      title: 'Worked examples',
      body: `<strong>General Workspace</strong> is a blank canvas. Every <strong>Example</strong> tab
             loads a complete, ready-to-study textbook LP problem — problem statement, data tables,
             and the constraints already graphed.`,
      target: '#workspace-tabs',
    },
    {
      title: 'Build your own 3D plot',
      before: () => { click('#mode-btn-3d'); click('[data-ws="general"]'); },
      body: `In the 3D workspace, add expressions, sliders, data tables and notes here. Type
             math directly — e.g. <code>z = x^2 + y^2</code> — and any unrecognized letter
             automatically becomes a slider.`,
      target: '#sb-toolbar',
    },
    {
      title: 'Syntax help, anytime',
      body: `Not sure how to write something? This button has a full reference — surfaces,
             curves, vectors, regions, derivatives — with copy-pasteable examples.`,
      target: '#btn-help',
    },
    {
      title: 'Worked example, in full',
      before: () => { click('[data-ws="example1"]'); },
      body: `Opening an example switches to the 2D workspace and loads the textbook problem
             here: the original question text plus its data tables, right above the graph
             controls.`,
      target: '#g2d-problem-card',
    },
    {
      title: 'Every constraint is editable',
      body: `These aren't fixed — click any coefficient, operator or right-hand side and the
             graph, feasible region and optimum all update live. Use <strong>+</strong> to add
             a new constraint of your own.`,
      target: '#g2d-constraint-list',
      widen: 'parent-card',
    },
    {
      title: 'Two one-click zooms',
      body: `<strong>Zoom: All Constraints</strong> fits every line in view — handy for seeing
             which constraints actually matter. <strong>Zoom: Feasible Region</strong> snaps in
             tight on just the solution area, however small it is.`,
      target: '#g2d-btn-zoom-constraints',
      widen: 'parent',
    },
    {
      title: 'Slicing a 3-variable problem',
      body: `Some problems have three decision variables. This slider fixes one of them so its
             plane can be projected onto the 2D graph — drag it to see the feasible region
             change shape as that variable changes.`,
      target: '#g2d-z-slice',
      widen: 'parent-card',
    },
    {
      title: 'Your objective function',
      body: `Set your own coefficients and choose Maximize or Minimize — the graph shades the
             feasible region and reports both the best vertex and its value automatically.`,
      target: '#g2d-obj-c1',
      widen: 'parent-card',
    },
    {
      title: 'Results, computed for you',
      body: `Every vertex of the feasible region is listed here with its Z-value, so you can
             check the optimum by hand and compare — great for verifying textbook answers.`,
      target: '#g2d-vertex-tbody',
      widen: 'parent-card',
    },
    {
      title: 'Graph toolbar',
      body: `Pan and zoom by dragging, drop new points onto the graph, toggle the shaded
             region, reset the view, or go fullscreen — all from here.`,
      target: '.g2d-toolbar',
    },
    {
      title: "That's the tour!",
      body: `Explore freely from here — Example 1, Example 2, or a blank workspace of your own.
             Click <strong>Take Tour</strong> in the top bar whenever you want to see this again.`,
    },
  ];

  let idx = 0;
  let els = {};
  let resizeHandler = null;

  function build() {
    if (els.backdrop) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'tour-backdrop';
    backdrop.className = 'tour-backdrop';

    const spot = document.createElement('div');
    spot.id = 'tour-spotlight';
    spot.className = 'tour-spotlight hidden';

    const tip = document.createElement('div');
    tip.id = 'tour-tooltip';
    tip.className = 'tour-tooltip';
    tip.innerHTML = `
      <div class="tour-counter" id="tour-counter"></div>
      <div class="tour-title" id="tour-title"></div>
      <div class="tour-body" id="tour-body"></div>
      <div class="tour-dots" id="tour-dots"></div>
      <div class="tour-actions">
        <button class="tour-btn tour-btn-text" id="tour-skip">Skip tour</button>
        <div class="tour-actions-right">
          <button class="tour-btn tour-btn-secondary" id="tour-back">Back</button>
          <button class="tour-btn tour-btn-primary" id="tour-next">Next</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(spot);
    document.body.appendChild(tip);

    els = {
      backdrop, spot, tip,
      counter: tip.querySelector('#tour-counter'),
      title: tip.querySelector('#tour-title'),
      body: tip.querySelector('#tour-body'),
      dots: tip.querySelector('#tour-dots'),
      skip: tip.querySelector('#tour-skip'),
      back: tip.querySelector('#tour-back'),
      next: tip.querySelector('#tour-next'),
    };

    els.skip.addEventListener('click', end);
    els.back.addEventListener('click', () => goTo(idx - 1));
    els.next.addEventListener('click', () => {
      if (idx >= STEPS.length - 1) end(); else goTo(idx + 1);
    });
    backdrop.addEventListener('click', () => {}); // swallow clicks on the dimmed page
    document.addEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (!els.tip || els.tip.classList.contains('hidden')) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight') { if (idx < STEPS.length - 1) goTo(idx + 1); }
    else if (e.key === 'ArrowLeft') { if (idx > 0) goTo(idx - 1); }
  }

  function resolveTarget(step) {
    if (!step.target) return null;
    const base = document.querySelector(step.target);
    if (!base) return null;
    if (step.widen === 'parent-card') return base.closest('.g2d-card') || base;
    if (step.widen === 'parent') return base.parentElement || base;
    return base;
  }

  function placeSpotlight(el) {
    if (!el) {
      // no specific target (welcome/finish steps) — still show a full-viewport dim via
      // the spotlight's own huge box-shadow spread, just with a negligible "hole"
      els.spot.classList.remove('hidden');
      els.spot.style.left = (window.innerWidth / 2) + 'px';
      els.spot.style.top = (window.innerHeight / 2) + 'px';
      els.spot.style.width = '0px';
      els.spot.style.height = '0px';
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { els.spot.classList.add('hidden'); return; }
    const pad = 6;
    els.spot.classList.remove('hidden');
    els.spot.style.left = Math.max(4, r.left - pad) + 'px';
    els.spot.style.top = Math.max(4, r.top - pad) + 'px';
    els.spot.style.width = (r.width + pad * 2) + 'px';
    els.spot.style.height = (r.height + pad * 2) + 'px';
  }

  function placeTooltip(el) {
    const tip = els.tip;
    tip.style.left = '';
    tip.style.top = '';
    tip.style.right = '';
    tip.style.bottom = '';
    tip.style.transform = '';

    if (!el) {
      tip.classList.add('tour-centered');
      return;
    }
    tip.classList.remove('tour-centered');

    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth || 340;
    const th = tip.offsetHeight || 180;
    const margin = 14;
    const vw = window.innerWidth, vh = window.innerHeight;

    let top, left;
    const spaceBelow = vh - r.bottom, spaceAbove = r.top;
    if (spaceBelow >= th + margin || spaceBelow >= spaceAbove) {
      top = Math.min(r.bottom + margin, vh - th - margin);
    } else {
      top = Math.max(margin, r.top - th - margin);
    }
    top = Math.max(margin, Math.min(top, vh - th - margin));

    left = r.left + r.width / 2 - tw / 2;
    left = Math.max(margin, Math.min(left, vw - tw - margin));

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function renderDots() {
    els.dots.innerHTML = STEPS.map((_, i) =>
      `<span class="tour-dot${i === idx ? ' active' : ''}"></span>`).join('');
  }

  function goTo(i) {
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    const step = STEPS[idx];

    if (typeof step.before === 'function') { try { step.before(); } catch (e) {} }

    els.counter.textContent = `Step ${idx + 1} of ${STEPS.length}`;
    els.title.textContent = step.title;
    els.body.innerHTML = step.body;
    els.back.disabled = idx === 0;
    els.next.textContent = idx === STEPS.length - 1 ? 'Finish' : 'Next';
    renderDots();

    // let mode/tab switches (and their requestAnimationFrame resize calls) settle
    // before measuring where things actually landed on screen
    const delay = typeof step.before === 'function' ? 260 : 30;
    setTimeout(() => {
      const el = resolveTarget(step);
      placeSpotlight(el);
      placeTooltip(el);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, delay);
  }

  function start() {
    build();
    els.backdrop.classList.add('show');
    els.spot.classList.add('show');
    els.tip.classList.add('show');
    resizeHandler = () => { const el = resolveTarget(STEPS[idx]); placeSpotlight(el); placeTooltip(el); };
    window.addEventListener('resize', resizeHandler);
    goTo(0);
  }

  function end() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    if (els.backdrop) {
      els.backdrop.classList.remove('show');
      els.spot.classList.remove('show', 'hidden');
      els.spot.classList.add('hidden');
      els.tip.classList.remove('show');
    }
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  }

  function replay() {
    // Take Tour always just (re)starts — no confirmation dialog. The tour does switch
    // workspaces/tabs as it goes (that's how it demonstrates each one live), but nothing
    // it touches is destructive: examples reload from their fixed preset on demand, so
    // there's nothing here worth gating behind an easy-to-miss native browser dialog.
    start();
  }

  function maybeAutoStart() {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
    if (!seen) setTimeout(start, 700);
  }

  function init() {
    const btn = q('btn-tour');
    if (btn) btn.addEventListener('click', replay);
    if (document.readyState === 'complete') maybeAutoStart();
    else window.addEventListener('load', maybeAutoStart);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { start, replay, end };
})();
