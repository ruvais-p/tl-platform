/* ==================================================================
   Geometry2D — 2D LP / Dynamic Geometry workspace
   A from-scratch SVG-based linear-programming + geometric-construction
   engine: half-plane clipping for feasible regions, segment/ray/vector/
   circle/polygon/midpoint construction, reflect/rotate transforms, and
   an objective-function (Z) evaluator over the feasible region's
   vertices. Ported/adapted 1:1 from the "General Workspace" engine and
   re-namespaced (g2d- prefixed ids/classes) so it can live side-by-side
   with the 3D engine in one page.
   ================================================================== */
const Geometry2D = (() => {

  const state = {
    view: { xMin: -5, xMax: 15, yMin: -5, yMax: 15 },
    showFeasibleRegion: true,
    constraints: [
      { a: 1, b: 1, cz: 0, op: '<=', d: 10, color: '#ef4444', visible: true }
    ],
    points: [
      { name: 'P1', x: 2, y: 3 },
      { name: 'P2', x: 6, y: 1 }
    ],
    geometries: [],
    zSlice: 0,
    nonNegativity: true,
    objective: { type: 'max', c1: 1, c2: 1, c3: 0 },
    activeTool: 'select',
    toolBuffer: [],
    dragState: null,
    panState: null
  };

  const COLORS = ['#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];
  let colorIdx = 1;
  let els = null; // cached DOM refs, filled in init()
  let initialized = false;

  function q(id) { return document.getElementById(id); }

  function cacheEls() {
    els = {
      svg: q('g2d-graph'),
      canvasWrapper: q('g2d-canvas-wrapper'),
      gridLayer: q('g2d-grid-layer'),
      feasibleLayer: q('g2d-feasible-layer'),
      linesLayer: q('g2d-lines-layer'),
      geometryLayer: q('g2d-geometry-layer'),
      pointsLayer: q('g2d-points-layer'),
      overlayMsg: q('g2d-overlay-msg')
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    cacheEls();
    setupEventListeners();
    render();
  }

  /* ---------------- coordinate transforms ---------------- */
  function getCanvasSize() {
    const rect = els.svg.getBoundingClientRect();
    return { width: rect.width || 600, height: rect.height || 600 };
  }
  function toSvgX(x) { return ((x - state.view.xMin) / (state.view.xMax - state.view.xMin)) * getCanvasSize().width; }
  function toSvgY(y) { return getCanvasSize().height - ((y - state.view.yMin) / (state.view.yMax - state.view.yMin)) * getCanvasSize().height; }
  function toMathX(px) { return state.view.xMin + (px / getCanvasSize().width) * (state.view.xMax - state.view.xMin); }
  function toMathY(py) { return state.view.yMin + ((getCanvasSize().height - py) / getCanvasSize().height) * (state.view.yMax - state.view.yMin); }

  function getPoint(name) { return state.points.find(p => p.name === name); }

  function updateDependencies() {
    state.points.forEach(pt => {
      if (pt.type === 'midpoint') {
        const p1 = getPoint(pt.parents[0]), p2 = getPoint(pt.parents[1]);
        if (p1 && p2) { pt.x = (p1.x + p2.x) / 2; pt.y = (p1.y + p2.y) / 2; }
      }
    });
  }

  function fmtCoeff(n) {
    // Round to ~4 significant figures for display so values like 1/60
    // don't spam a raw floating-point tail (0.016666666666666666) —
    // the full-precision value is still what's actually used for math.
    if (Number.isInteger(n)) return String(n);
    const r = parseFloat(n.toPrecision(4));
    return String(r);
  }

  function fmtCoeffTerm(coeff, sym) {
    if (!coeff) return null;
    if (coeff === 1) return sym;
    if (coeff === -1) return `-${sym}`;
    return `${fmtCoeff(coeff)}${sym}`;
  }

  function formatConstraintEq(c) {
    const opSym = c.op === '<=' ? '≤' : (c.op === '>=' ? '≥' : '=');
    const terms = [fmtCoeffTerm(c.a, 'x'), fmtCoeffTerm(c.b, 'y'), fmtCoeffTerm(c.cz, 'z')].filter(Boolean);
    const lhs = terms.length ? terms.join(' + ').replace(/\+ -/g, '- ') : '0';
    return `${lhs} ${opSym} ${c.d}`;
  }

  /* ---------------- main render pipeline ---------------- */
  function render() {
    if (!initialized) return;
    updateDependencies();
    renderGrid();
    const vertices = computeFeasibleRegion();
    renderLines();
    renderGeometries();
    renderPoints(vertices);
    renderUILists(vertices);
  }

  // Picks a "nice" 1/2/5 x10^n grid step that yields roughly
  // `targetDivisions` lines across `range` — matters a lot once views can
  // span anywhere from a few units (a plain segment) to hundreds of
  // thousands (the bottling-plant example's marketing/production caps):
  // a fixed step of 1 or 10 across a 300,000-unit range would try to draw
  // tens of thousands of grid lines and hang the tab.
  function niceStep(range, targetDivisions) {
    if (!isFinite(range) || range <= 0) return 1;
    const rough = range / (targetDivisions || 12);
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return niceNorm * mag;
  }

  function fmtAxisNum(n, step) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 0.0001 > 0 ? -Math.floor(Math.log10(step)) : 0);
    const rounded = decimals > 0 ? parseFloat(n.toFixed(decimals)) : Math.round(n);
    return rounded.toLocaleString();
  }

  function renderGrid() {
    els.gridLayer.innerHTML = '';
    const { width, height } = getCanvasSize();
    const xRange = state.view.xMax - state.view.xMin, yRange = state.view.yMax - state.view.yMin;
    const stepX = niceStep(xRange, width / 70);
    const stepY = niceStep(yRange, height / 50);
    const MAX_LINES = 400; // hard safety cap regardless of step math above

    let n = 0;
    for (let x = Math.ceil(state.view.xMin / stepX) * stepX; x <= state.view.xMax && n < MAX_LINES; x += stepX, n++) {
      const sx = toSvgX(x);
      els.gridLayer.appendChild(createSvgElement('line', { x1: sx, y1: 0, x2: sx, y2: height, class: Math.abs(x) < stepX * 1e-6 ? 'g2d-axis-line' : 'g2d-grid-line' }));
      if (Math.abs(x) > stepX * 1e-6) {
        const txt = createSvgElement('text', { x: sx + 2, y: toSvgY(0) + 12, class: 'g2d-axis-text' });
        txt.textContent = fmtAxisNum(x, stepX);
        els.gridLayer.appendChild(txt);
      }
    }
    n = 0;
    for (let y = Math.ceil(state.view.yMin / stepY) * stepY; y <= state.view.yMax && n < MAX_LINES; y += stepY, n++) {
      const sy = toSvgY(y);
      els.gridLayer.appendChild(createSvgElement('line', { x1: 0, y1: sy, x2: width, y2: sy, class: Math.abs(y) < stepY * 1e-6 ? 'g2d-axis-line' : 'g2d-grid-line' }));
      if (Math.abs(y) > stepY * 1e-6) {
        const txt = createSvgElement('text', { x: toSvgX(0) + 4, y: sy - 2, class: 'g2d-axis-text' });
        txt.textContent = fmtAxisNum(y, stepY);
        els.gridLayer.appendChild(txt);
      }
    }
  }

  function computeFeasibleRegion() {
    els.feasibleLayer.innerHTML = '';
    // Starting "unbounded" polygon clipped down by each constraint below —
    // sized well past any constraint magnitude a real problem is likely to
    // use (the bottling-plant example alone has bounds up to 300,000).
    let poly = [{ x: -1e8, y: -1e8 }, { x: 1e8, y: -1e8 }, { x: 1e8, y: 1e8 }, { x: -1e8, y: 1e8 }];
    const activePlanes = [];

    if (state.nonNegativity) {
      activePlanes.push({ a: -1, b: 0, c: 0 });
      activePlanes.push({ a: 0, b: -1, c: 0 });
    }
    state.constraints.forEach(cons => {
      if (!cons.visible) return;
      const effC = cons.d - (cons.cz * state.zSlice);
      if (cons.op === '<=') activePlanes.push({ a: cons.a, b: cons.b, c: effC });
      else if (cons.op === '>=') activePlanes.push({ a: -cons.a, b: -cons.b, c: -effC });
      else if (cons.op === '=') {
        activePlanes.push({ a: cons.a, b: cons.b, c: effC });
        activePlanes.push({ a: -cons.a, b: -cons.b, c: -effC });
      }
    });

    activePlanes.forEach(plane => { poly = clipPolygonByHalfPlane(poly, plane.a, plane.b, plane.c); });
    poly = cleanPolygonVertices(poly);
    if (poly.length < 3) { state._lastVertices = []; return []; }

    poly = orderVerticesCCW(poly);
    if (state.showFeasibleRegion) {
      const ptsString = poly.map(p => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');
      els.feasibleLayer.appendChild(createSvgElement('polygon', { points: ptsString, class: 'g2d-feasible-region' }));
    }
    state._lastVertices = poly; // cached for the "Zoom: Feasible Region" button
    return poly;
  }

  // Fit the view to show every plotted constraint line (their axis
  // intercepts), useful when — as in problems with a mix of loose and
  // tight constraints — the interesting feasible region is much smaller
  // than the full set of drawn lines.
  function zoomToConstraints() {
    let maxX = 0, maxY = 0;
    state.constraints.forEach(c => {
      if (!c.visible) return;
      const effD = c.d - (c.cz * state.zSlice);
      if (c.a) { const xi = effD / c.a; if (isFinite(xi) && xi > maxX) maxX = xi; }
      if (c.b) { const yi = effD / c.b; if (isFinite(yi) && yi > maxY) maxY = yi; }
    });
    if (maxX <= 0) maxX = state.view.xMax - state.view.xMin || 10;
    if (maxY <= 0) maxY = state.view.yMax - state.view.yMin || 10;
    state.view = { xMin: -maxX * 0.06, xMax: maxX * 1.1, yMin: -maxY * 0.06, yMax: maxY * 1.1 };
    render();
  }

  // Fit the view tightly around the last-computed feasible region, so a
  // feasible area that's tiny relative to the constraint lines (because
  // some constraints aren't binding) is still easy to inspect up close.
  function zoomToFeasible() {
    const verts = state._lastVertices || [];
    if (verts.length < 3) { zoomToConstraints(); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    verts.forEach(v => { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); });
    const padX = (maxX - minX) * 0.22 || Math.max(maxX, 1) * 0.15 || 1;
    const padY = (maxY - minY) * 0.22 || Math.max(maxY, 1) * 0.15 || 1;
    state.view = { xMin: minX - padX, xMax: maxX + padX, yMin: minY - padY, yMax: maxY + padY };
    render();
  }

  function clipPolygonByHalfPlane(poly, a, b, c) {
    if (poly.length === 0) return [];
    const output = [];
    const isInside = (p) => (a * p.x + b * p.y) <= c + 1e-7;
    let s = poly[poly.length - 1];
    for (let i = 0; i < poly.length; i++) {
      const e = poly[i];
      if (isInside(e)) {
        if (isInside(s)) output.push(e);
        else { output.push(lineIntersection(s, e, a, b, c)); output.push(e); }
      } else if (isInside(s)) output.push(lineIntersection(s, e, a, b, c));
      s = e;
    }
    return output;
  }

  function lineIntersection(p1, p2, a, b, c) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y, denom = a * dx + b * dy;
    if (Math.abs(denom) < 1e-9) return p1;
    const t = (c - a * p1.x - b * p1.y) / denom;
    return { x: p1.x + t * dx, y: p1.y + t * dy };
  }

  function cleanPolygonVertices(poly) {
    const res = [];
    poly.forEach(p => { if (!res.some(q2 => Math.hypot(p.x - q2.x, p.y - q2.y) < 1e-4)) res.push(p); });
    return res;
  }

  function orderVerticesCCW(poly) {
    const cx = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
    const cy = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;
    return poly.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  }

  function renderLines() {
    els.linesLayer.innerHTML = '';
    state.constraints.forEach(cons => {
      if (!cons.visible) return;
      let x1, y1, x2, y2, { a, b, cz, d, color, op } = cons, effC = d - (cz * state.zSlice);
      if (Math.abs(b) > 1e-5) {
        x1 = state.view.xMin; y1 = (effC - a * x1) / b;
        x2 = state.view.xMax; y2 = (effC - a * x2) / b;
      } else { x1 = effC / a; x2 = effC / a; y1 = state.view.yMin; y2 = state.view.yMax; }

      els.linesLayer.appendChild(createSvgElement('line', { x1: toSvgX(x1), y1: toSvgY(y1), x2: toSvgX(x2), y2: toSvgY(y2), stroke: color, class: 'g2d-constraint-line' }));

      const midX = (state.view.xMin + state.view.xMax) / 2;
      const midY = Math.abs(b) > 1e-5 ? (effC - a * midX) / b : (state.view.yMin + state.view.yMax) / 2;
      const eqText = createSvgElement('text', { x: toSvgX(midX) + 8, y: toSvgY(midY) - 8, fill: color, class: 'g2d-equation-label' });
      eqText.textContent = formatConstraintEq(cons);
      els.linesLayer.appendChild(eqText);
    });
  }

  function renderGeometries() {
    els.geometryLayer.innerHTML = '';
    state.geometries.forEach(g => {
      if (g.type === 'segment') {
        const p1 = getPoint(g.p1), p2 = getPoint(g.p2);
        if (p1 && p2) els.geometryLayer.appendChild(createSvgElement('line', { x1: toSvgX(p1.x), y1: toSvgY(p1.y), x2: toSvgX(p2.x), y2: toSvgY(p2.y), stroke: '#3b82f6', 'stroke-width': 2.5 }));
      } else if (g.type === 'vector') {
        const p1 = getPoint(g.p1), p2 = getPoint(g.p2);
        if (p1 && p2) els.geometryLayer.appendChild(createSvgElement('line', { x1: toSvgX(p1.x), y1: toSvgY(p1.y), x2: toSvgX(p2.x), y2: toSvgY(p2.y), stroke: '#3b82f6', 'stroke-width': 2.5, 'marker-end': 'url(#g2d-arrow)' }));
      } else if (g.type === 'ray') {
        const p1 = getPoint(g.p1), p2 = getPoint(g.p2);
        if (p1 && p2) {
          const dx = p2.x - p1.x, dy = p2.y - p1.y, scale = 1000;
          els.geometryLayer.appendChild(createSvgElement('line', { x1: toSvgX(p1.x), y1: toSvgY(p1.y), x2: toSvgX(p1.x + scale * dx), y2: toSvgY(p1.y + scale * dy), stroke: '#6366f1', 'stroke-width': 2.5 }));
        }
      } else if (g.type === 'circle') {
        const p1 = getPoint(g.p1), p2 = getPoint(g.p2);
        if (p1 && p2) {
          const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const rSvg = (r / (state.view.xMax - state.view.xMin)) * getCanvasSize().width;

          els.geometryLayer.appendChild(createSvgElement('circle', {
            cx: toSvgX(p1.x), cy: toSvgY(p1.y), r: rSvg, stroke: '#8b5cf6', fill: 'none', 'stroke-width': 2.5
          }));

          const eqText = createSvgElement('text', {
            x: toSvgX(p1.x) + rSvg + 6, y: toSvgY(p1.y), fill: '#8b5cf6', class: 'g2d-equation-label'
          });
          const hStr = p1.x >= 0 ? `- ${p1.x.toFixed(1)}` : `+ ${Math.abs(p1.x).toFixed(1)}`;
          const kStr = p1.y >= 0 ? `- ${p1.y.toFixed(1)}` : `+ ${Math.abs(p1.y).toFixed(1)}`;
          eqText.textContent = `(x ${hStr})² + (y ${kStr})² = ${(r * r).toFixed(1)}`;
          els.geometryLayer.appendChild(eqText);
        }
      } else if (g.type === 'polygon') {
        const pts = g.pts.map(pName => { const p = getPoint(pName); return p ? `${toSvgX(p.x)},${toSvgY(p.y)}` : ''; }).join(' ');
        els.geometryLayer.appendChild(createSvgElement('polygon', { points: pts, fill: 'rgba(99, 102, 241, 0.2)', stroke: '#6366f1', 'stroke-width': 2.5 }));
      }
    });
  }

  function renderPoints(vertices) {
    els.pointsLayer.innerHTML = '';
    state.points.forEach((pt, idx) => {
      const circle = createSvgElement('circle', { cx: toSvgX(pt.x), cy: toSvgY(pt.y), r: 5, fill: pt.type === 'midpoint' ? '#059669' : '#2563eb', class: 'g2d-point-dot', 'data-type': 'user-point', 'data-index': idx });
      els.pointsLayer.appendChild(circle);
      const label = createSvgElement('text', { x: toSvgX(pt.x) + 8, y: toSvgY(pt.y) - 8, class: 'g2d-point-label' });
      label.textContent = `${pt.name} (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`;
      els.pointsLayer.appendChild(label);
    });

    vertices.forEach((v, idx) => {
      els.pointsLayer.appendChild(createSvgElement('circle', { cx: toSvgX(v.x), cy: toSvgY(v.y), r: 6, fill: '#16a34a', stroke: '#ffffff', 'stroke-width': 2 }));
      const label = createSvgElement('text', { x: toSvgX(v.x) + 8, y: toSvgY(v.y) - 8, class: 'g2d-point-label', fill: '#15803d' });
      label.textContent = `V${idx + 1}`;
      els.pointsLayer.appendChild(label);
    });
  }

  function renderUILists(vertices) {
    q('g2d-res-area').textContent = computePolygonArea(vertices).toFixed(2);

    const cList = q('g2d-constraint-list');
    cList.innerHTML = '';
    state.constraints.forEach((c, idx) => {
      const li = document.createElement('li');
      li.className = 'g2d-item-row g2d-constraint-edit-row';
      // Displayed rounded to 4 sig figs (fmtCoeff) so a value like 1/60
      // shows as 0.01667 instead of its raw float tail; the full-precision
      // number stays in state.constraints until the user actually edits it.
      const mkNum = (field, val, width) => `<input type="number" class="g2d-input g2d-num-input g2d-c-edit" style="width:${width}px" data-idx="${idx}" data-field="${field}" value="${fmtCoeff(val)}">`;
      li.innerHTML = `
        <span class="g2d-c-lhs">
          <span class="g2d-color-indicator" style="background-color: ${c.color}"></span>
          ${mkNum('a', c.a, 48)}<span class="g2d-c-var">x +</span>
          ${mkNum('b', c.b, 48)}<span class="g2d-c-var">y +</span>
          ${mkNum('cz', c.cz, 48)}<span class="g2d-c-var">z</span>
        </span>
        <span class="g2d-c-rhs">
          <select class="g2d-input g2d-c-edit" data-idx="${idx}" data-field="op">
            <option value="<=" ${c.op === '<=' ? 'selected' : ''}>&le;</option>
            <option value=">=" ${c.op === '>=' ? 'selected' : ''}>&ge;</option>
            <option value="=" ${c.op === '=' ? 'selected' : ''}>=</option>
          </select>
          ${mkNum('d', c.d, 44)}
          <button class="g2d-btn g2d-btn-sm g2d-btn-danger" data-g2d-action="del-c" data-idx="${idx}" title="Delete constraint">✕</button>
        </span>`;
      cList.appendChild(li);
    });

    const geomList = q('g2d-geom-expression-list');
    geomList.innerHTML = '';
    state.geometries.forEach((g, idx) => {
      const li = document.createElement('li');
      li.className = 'g2d-item-row';
      let exprText = '';
      if (g.type === 'segment') exprText = `Segment (${g.p1}, ${g.p2})`;
      else if (g.type === 'ray') exprText = `Ray (${g.p1} -> ${g.p2})`;
      else if (g.type === 'vector') exprText = `Vector (${g.p1} -> ${g.p2})`;
      else if (g.type === 'circle') {
        const p1 = getPoint(g.p1), p2 = getPoint(g.p2);
        if (p1 && p2) {
          const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const rSquared = (r * r).toFixed(1);
          const yMax = (p1.y + r).toFixed(2), yMin = (p1.y - r).toFixed(2);
          const xMax = (p1.x + r).toFixed(2), xMin = (p1.x - r).toFixed(2);
          const hStr = p1.x >= 0 ? `- ${p1.x.toFixed(1)}` : `+ ${Math.abs(p1.x).toFixed(1)}`;
          const kStr = p1.y >= 0 ? `- ${p1.y.toFixed(1)}` : `+ ${Math.abs(p1.y).toFixed(1)}`;
          exprText = `<div style="line-height:1.4;">
            <strong>Circle (${g.p1})</strong>: (x ${hStr})² + (y ${kStr})² = ${rSquared}<br>
            <span style="font-size:0.72rem; color:var(--text-faint);">
              <strong>Y-Limits:</strong> Min: ${yMin}, Max: ${yMax}<br>
              <strong>X-Limits:</strong> Min: ${xMin}, Max: ${xMax}
            </span>
          </div>`;
        } else exprText = `<span>Circle Center: ${g.p1}</span>`;
      } else if (g.type === 'polygon') exprText = `Polygon [${g.pts.join(', ')}]`;

      li.innerHTML = `<span>${exprText}</span>
        <button class="g2d-btn g2d-btn-sm g2d-btn-danger" data-g2d-action="del-g" data-idx="${idx}">✕</button>`;
      geomList.appendChild(li);
    });

    const maxEl = q('g2d-obj-val-max'), minEl = q('g2d-obj-val-min');
    if (vertices.length > 0 && state.objective.c1 !== null && state.objective.c2 !== null) {
      let maxZ = -Infinity, minZ = Infinity;
      vertices.forEach(v => {
        const zVal = (state.objective.c1 * v.x) + (state.objective.c2 * v.y) + ((state.objective.c3 || 0) * state.zSlice);
        if (zVal > maxZ) maxZ = zVal;
        if (zVal < minZ) minZ = zVal;
      });
      if (maxEl) maxEl.textContent = maxZ.toFixed(2);
      if (minEl) minEl.textContent = minZ.toFixed(2);
    } else {
      if (maxEl) maxEl.textContent = '-';
      if (minEl) minEl.textContent = '-';
    }

    const pList = q('g2d-point-list');
    pList.innerHTML = '';
    state.points.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'g2d-item-row';
      li.innerHTML = `<span><strong>${p.name}</strong>: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})</span>
        <button class="g2d-btn g2d-btn-sm g2d-btn-danger" data-g2d-action="del-p" data-idx="${idx}">✕</button>`;
      pList.appendChild(li);
    });

    const tbody = q('g2d-vertex-tbody');
    tbody.innerHTML = '';
    vertices.forEach((v, idx) => {
      let zVal = '-';
      if (state.objective.c1 !== null && state.objective.c2 !== null) {
        const val = (state.objective.c1 * v.x) + (state.objective.c2 * v.y) + ((state.objective.c3 || 0) * state.zSlice);
        zVal = val.toFixed(2);
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>V${idx + 1}</strong></td><td>(${v.x.toFixed(2)}, ${v.y.toFixed(2)})</td><td>${zVal}</td>`;
      tbody.appendChild(tr);
    });
  }

  function computePolygonArea(vertices) {
    if (vertices.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  }

  /* ---------------- tools / interaction ---------------- */
  function setToolMode(tool, msg) {
    state.activeTool = tool;
    state.toolBuffer = [];
    document.querySelectorAll('.g2d-tool-palette-btn').forEach(b => b.classList.remove('g2d-active-tool'));
    const btn = document.querySelector(`.g2d-tool-palette-btn[data-tool="${tool}"]`);
    if (btn) btn.classList.add('g2d-active-tool');
    q('g2d-btn-finish-poly').style.display = tool === 'polygon' ? 'inline-flex' : 'none';
    els.overlayMsg.textContent = msg;

    document.querySelectorAll('#g2d-tool-select, #g2d-tool-point').forEach(b => b.classList.remove('active'));
    if (tool === 'select') q('g2d-tool-select').classList.add('active');
    if (tool === 'point') q('g2d-tool-point').classList.add('active');
  }

  function setupEventListeners() {
    els.svg.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    els.svg.addEventListener('wheel', handleWheel, { passive: false });

    const syncRegionToggle = (e) => {
      state.showFeasibleRegion = e.target.checked;
      q('g2d-toggle-region').checked = state.showFeasibleRegion;
      q('g2d-top-toggle-region').checked = state.showFeasibleRegion;
      render();
    };
    q('g2d-toggle-region').addEventListener('change', syncRegionToggle);
    q('g2d-top-toggle-region').addEventListener('change', syncRegionToggle);

    document.querySelectorAll('.g2d-tool-palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'segment') setToolMode('segment', 'Click 2 points for Segment');
        else if (tool === 'ray') setToolMode('ray', 'Click 2 points for Ray');
        else if (tool === 'vector') setToolMode('vector', 'Click 2 points for Vector');
        else if (tool === 'circle') setToolMode('circle', 'Click Center point then Radius point');
        else if (tool === 'polygon') setToolMode('polygon', 'Click points sequentially then click Finish Polygon');
        else if (tool === 'midpoint') setToolMode('midpoint', 'Click 2 points to generate Midpoint');
        else if (tool === 'reflect') setToolMode('reflect', 'Click Point to reflect across Y-Axis');
        else if (tool === 'rotate') setToolMode('rotate', 'Click Point to rotate 90° CCW');
      });
    });

    q('g2d-btn-finish-poly').addEventListener('click', () => {
      if (state.toolBuffer.length >= 3) {
        state.geometries.push({ type: 'polygon', pts: [...state.toolBuffer] });
        state.toolBuffer = [];
        render();
      }
    });

    q('g2d-btn-clear-geom').addEventListener('click', () => { state.geometries = []; render(); });

    q('g2d-btn-add-constraint').addEventListener('click', () => {
      state.constraints.push({
        a: parseFloat(q('g2d-c-a').value) || 0,
        b: parseFloat(q('g2d-c-b').value) || 0,
        cz: parseFloat(q('g2d-c-cz').value) || 0,
        op: q('g2d-c-op').value,
        d: parseFloat(q('g2d-c-d').value) || 0,
        color: COLORS[colorIdx++ % COLORS.length], visible: true
      });
      render();
    });

    q('g2d-btn-add-point').addEventListener('click', () => {
      let name = q('g2d-pt-name').value.trim() || `P${state.points.length + 1}`;
      state.points.push({ name, x: parseFloat(q('g2d-pt-x').value) || 0, y: parseFloat(q('g2d-pt-y').value) || 0 });
      render();
    });

    q('g2d-z-slice').addEventListener('input', (e) => {
      state.zSlice = parseFloat(e.target.value) || 0;
      q('g2d-z-slice-badge').textContent = state.zSlice;
      render();
    });
    q('g2d-non-negativity').addEventListener('change', (e) => { state.nonNegativity = e.target.checked; render(); });

    const updateObj = () => {
      state.objective.c1 = parseFloat(q('g2d-obj-c1').value);
      state.objective.c2 = parseFloat(q('g2d-obj-c2').value);
      state.objective.c3 = parseFloat(q('g2d-obj-c3').value);
      state.objective.type = q('g2d-obj-type').value;
      render();
    };
    ['g2d-obj-c1', 'g2d-obj-c2', 'g2d-obj-c3', 'g2d-obj-type'].forEach(id => q(id).addEventListener('input', updateObj));

    document.addEventListener('click', (e) => {
      const action = e.target.dataset.g2dAction, idx = parseInt(e.target.dataset.idx, 10);
      if (action === 'del-c') { state.constraints.splice(idx, 1); render(); }
      else if (action === 'del-p') { state.points.splice(idx, 1); render(); }
      else if (action === 'del-g') { state.geometries.splice(idx, 1); render(); }
    });

    // Inline editing of existing constraint coefficients/operator/RHS —
    // fires on change (blur/Enter/select-pick), not every keystroke, so
    // the field being typed into isn't torn down mid-edit by a re-render.
    document.addEventListener('change', (e) => {
      if (!e.target.classList.contains('g2d-c-edit')) return;
      const idx = parseInt(e.target.dataset.idx, 10), field = e.target.dataset.field;
      const cons = state.constraints[idx];
      if (!cons) return;
      if (field === 'op') cons.op = e.target.value;
      else cons[field] = parseFloat(e.target.value) || 0;
      render();
    });

    q('g2d-tool-select').addEventListener('click', () => setToolMode('select', 'Mode: Select/Move Canvas'));
    q('g2d-tool-point').addEventListener('click', () => setToolMode('point', 'Click canvas to add point'));

    q('g2d-btn-reset').addEventListener('click', () => {
      state.view = { xMin: -5, xMax: 15, yMin: -5, yMax: 15 };
      render();
    });

    q('g2d-btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) els.canvasWrapper.requestFullscreen(); else document.exitFullscreen();
    });

    q('g2d-btn-zoom-constraints').addEventListener('click', zoomToConstraints);
    q('g2d-btn-zoom-feasible').addEventListener('click', zoomToFeasible);
  }

  function handleMouseDown(e) {
    const rect = els.svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
    const mathX = toMathX(clickX), mathY = toMathY(clickY);

    if (state.activeTool === 'select') {
      if (e.target.dataset.type === 'user-point') {
        state.dragState = { pointIndex: parseInt(e.target.dataset.index, 10) };
      } else {
        state.panState = { startX: e.clientX, startY: e.clientY, viewStart: { ...state.view } };
      }
    } else if (state.activeTool === 'point') {
      state.points.push({ name: `P${state.points.length + 1}`, x: mathX, y: mathY });
      render();
    } else if (e.target.dataset.type === 'user-point') {
      const pName = state.points[parseInt(e.target.dataset.index, 10)].name;

      if (state.activeTool === 'polygon') {
        state.toolBuffer.push(pName);
        els.overlayMsg.textContent = `Polygon Points: ${state.toolBuffer.join(', ')}`;
      } else {
        state.toolBuffer.push(pName);

        if (['segment', 'vector', 'ray', 'circle', 'midpoint'].includes(state.activeTool) && state.toolBuffer.length === 2) {
          const [p1, p2] = state.toolBuffer;
          if (state.activeTool === 'midpoint') {
            const pt1 = getPoint(p1), pt2 = getPoint(p2);
            state.points.push({ name: `M${state.points.length + 1}`, type: 'midpoint', parents: [p1, p2], x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 });
          } else {
            state.geometries.push({ type: state.activeTool, p1, p2 });
          }
          state.toolBuffer = [];
          render();
        } else if (state.activeTool === 'reflect') {
          const pt = getPoint(pName);
          state.points.push({ name: `${pt.name}'`, x: -pt.x, y: pt.y });
          state.toolBuffer = [];
          render();
        } else if (state.activeTool === 'rotate') {
          const pt = getPoint(pName);
          state.points.push({ name: `${pt.name}'`, x: -pt.y, y: pt.x });
          state.toolBuffer = [];
          render();
        }
      }
    }
  }

  function handleMouseMove(e) {
    if (!initialized) return;
    if (state.dragState) {
      const rect = els.svg.getBoundingClientRect();
      const pt = state.points[state.dragState.pointIndex];
      pt.x = toMathX(e.clientX - rect.left);
      pt.y = toMathY(e.clientY - rect.top);
      render();
    } else if (state.panState) {
      const dx = (e.clientX - state.panState.startX) / getCanvasSize().width * (state.panState.viewStart.xMax - state.panState.viewStart.xMin);
      const dy = (e.clientY - state.panState.startY) / getCanvasSize().height * (state.panState.viewStart.yMax - state.panState.viewStart.yMin);
      state.view.xMin = state.panState.viewStart.xMin - dx; state.view.xMax = state.panState.viewStart.xMax - dx;
      state.view.yMin = state.panState.viewStart.yMin + dy; state.view.yMax = state.panState.viewStart.yMax + dy;
      render();
    }
  }

  function handleMouseUp() { state.dragState = null; state.panState = null; }

  function handleWheel(e) {
    e.preventDefault();
    const zoom = e.deltaY > 0 ? 1.1 : 0.9;
    const rect = els.svg.getBoundingClientRect();
    const mx = toMathX(e.clientX - rect.left), my = toMathY(e.clientY - rect.top);
    state.view.xMin = mx + (state.view.xMin - mx) * zoom; state.view.xMax = mx + (state.view.xMax - mx) * zoom;
    state.view.yMin = my + (state.view.yMin - my) * zoom; state.view.yMax = my + (state.view.yMax - my) * zoom;
    render();
  }

  function createSvgElement(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (let k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* ---------------- public API ---------------- */

  // Called whenever the 2D workspace becomes visible again (mode switch) —
  // the SVG had zero layout size while display:none, so re-render once its
  // real box is available.
  function refreshLayout() { render(); }

  // Reset to a blank default state (used by the "General Workspace" tab).
  function loadBlank() {
    state.view = { xMin: -5, xMax: 15, yMin: -5, yMax: 15 };
    state.showFeasibleRegion = true;
    state.constraints = [{ a: 1, b: 1, cz: 0, op: '<=', d: 10, color: '#ef4444', visible: true }];
    state.points = [{ name: 'P1', x: 2, y: 3 }, { name: 'P2', x: 6, y: 1 }];
    state.geometries = [];
    state.zSlice = 0;
    state.nonNegativity = true;
    state.objective = { type: 'max', c1: 1, c2: 1, c3: 0 };
    colorIdx = 1;
    syncInputsFromState({
      zMin: -10, zMax: 10, step: 0.5,
      label: 'Fixed Slice: <strong>z</strong>',
      hint: 'Projects any 3D plane <code>ax+by+cz=d</code> onto this 2D view at the chosen z.',
      units: ''
    });
    render();
  }

  // Product-mix LP preset — the textbook "Example 1" problem: a company
  // producing three products A, B, C (x1, x2, x3) sharing 100 daily
  // assembly man-hours, each capped by production capacity, with order
  // commitments, maximizing profit Z = 12x1 + 20x2 + 45x3. Plotted with
  // x1->x, x2->y, and x3 driven by the "Fixed Slice z" control (its own
  // x3 <= 30 bound is enforced by clamping that control's range, since a
  // constraint on z alone has no line to draw in the x-y plane).
  function loadProductMixPreset() {
    state.view = { xMin: -5, xMax: 60, yMin: -5, yMax: 35 };
    state.showFeasibleRegion = true;
    state.constraints = [
      { a: 0.8, b: 1.7, cz: 2.5, op: '<=', d: 100, color: COLORS[1 % COLORS.length], visible: true }, // labour & materials
      { a: 1,   b: 0,   cz: 0,   op: '<=', d: 50,  color: COLORS[2 % COLORS.length], visible: true }, // x1 capacity
      { a: 0,   b: 1,   cz: 0,   op: '<=', d: 25,  color: COLORS[3 % COLORS.length], visible: true }, // x2 capacity
      { a: 1,   b: 0,   cz: 0,   op: '>=', d: 20,  color: COLORS[4 % COLORS.length], visible: true }, // x1 order commitment
      { a: 0,   b: 1,   cz: 1,   op: '>=', d: 15,  color: COLORS[5 % COLORS.length], visible: true }  // x2 + x3 order commitment
    ];
    colorIdx = 6;
    state.points = [];
    state.geometries = [];
    state.zSlice = 15;
    state.nonNegativity = true;
    state.objective = { type: 'max', c1: 12, c2: 20, c3: 45 };
    syncInputsFromState({
      zMin: 0, zMax: 30, step: 1,
      label: 'Product C (x&#8323;) Parameter',
      hint: 'x&#8323; is projected as the Fixed Slice above — drag to see how much of product C shifts the feasible region (x&#8323; &le; 30 per the capacity table).',
      units: ' units'
    });
    render();
  }

  // Bottling-plant LP preset — the textbook "Example 2" problem: two
  // machines producing 8oz (x1) and 16oz (x2) bottles. Deliberately a
  // 2-variable problem (no x3/z term) where the machine-time and total-
  // production constraints turn out NOT to be binding — the two
  // marketing caps (x1<=25000, x2<=7000) alone define a feasible region
  // that's tiny next to the ~300,000-unit scale of the other lines. Loads
  // zoomed out to the full picture; the "Zoom: Feasible Region" button
  // hones in on the actual (much smaller) optimum.
  function loadBottlingPlantPreset() {
    state.showFeasibleRegion = true;
    state.constraints = [
      { a: 1 / 100, b: 1 / 40, cz: 0, op: '<=', d: 2400,   color: COLORS[1 % COLORS.length], visible: true }, // Machine A time
      { a: 1 / 60,  b: 1 / 75, cz: 0, op: '<=', d: 2400,   color: COLORS[2 % COLORS.length], visible: true }, // Machine B time
      { a: 1,       b: 1,      cz: 0, op: '<=', d: 300000, color: COLORS[3 % COLORS.length], visible: true }, // Production ceiling
      { a: 1,       b: 0,      cz: 0, op: '<=', d: 25000,  color: COLORS[4 % COLORS.length], visible: true }, // Marketing: 8oz
      { a: 0,       b: 1,      cz: 0, op: '<=', d: 7000,   color: COLORS[5 % COLORS.length], visible: true }  // Marketing: 16oz
    ];
    colorIdx = 6;
    state.points = [];
    state.geometries = [];
    state.zSlice = 0;
    state.nonNegativity = true;
    state.objective = { type: 'max', c1: 0.15, c2: 0.25, c3: 0 };
    syncInputsFromState({
      zMin: -10, zMax: 10, step: 0.5,
      label: 'Fixed Slice: <strong>z</strong> (unused)',
      hint: 'This problem has only 2 decision variables (x&#8321;, x&#8322;) — the slice has no effect here.',
      units: ''
    });
    zoomToConstraints(); // also renders
  }

  // Two-plant production preset — the textbook "Example 2" min-cost problem:
  // two plants each producing products A and B (x1..x4), minimizing total
  // cost. The two products share no constraint and don't interact in the
  // objective, so the true 4-variable problem separates cleanly into two
  // independent 2-variable LPs. This engine plots 2 (+1 sliced) variables at
  // a time, so it graphs the Product A subproblem (x1, x2) live; Product B's
  // parallel subproblem is solved the same way and stated in the problem
  // card, since it has no relationship to x1/x2 worth forcing onto one graph.
  function loadTwoPlantPreset() {
    state.view = { xMin: -2, xMax: 18, yMin: -2, yMax: 18 };
    state.showFeasibleRegion = true;
    state.constraints = [
      { a: 3, b: 1, cz: 0, op: '<=', d: 16, color: COLORS[1 % COLORS.length], visible: true }, // Plant 1 prep time (product A)
      { a: 1, b: 1, cz: 0, op: '>=', d: 10, color: COLORS[2 % COLORS.length], visible: true }  // Min daily production of A
    ];
    colorIdx = 3;
    state.points = [];
    state.geometries = [];
    state.zSlice = 0;
    state.nonNegativity = true;
    state.objective = { type: 'min', c1: 15000, c2: 18000, c3: 0 };
    syncInputsFromState({
      zMin: -10, zMax: 10, step: 0.5,
      label: 'Fixed Slice: <strong>z</strong> (unused)',
      hint: 'This graphed half of the problem (Product A) has only 2 decision variables (x&#8321;, x&#8322;) — the slice has no effect here. Product B (x&#8323;, x&#8324;) is an independent second LP, solved the same way (see the note above the graph).',
      units: ''
    });
    render();
  }

  // Radio-components preset — the textbook "Example 3" max-profit problem: an
  // electronics company producing components C1/C2, budget-constrained. Like
  // the Bottling Plant example, this one teaches that not every listed
  // constraint ends up binding: the machine-time and assembly-time lines
  // never actually cross the budget line anywhere in the positive quadrant,
  // so the budget constraint alone shapes the entire feasible region.
  function loadRadioComponentsPreset() {
    state.showFeasibleRegion = true;
    state.constraints = [
      { a: 10, b: 40, cz: 0, op: '<=', d: 4000, color: COLORS[1 % COLORS.length], visible: true }, // Budget
      { a: 3,  b: 2,  cz: 0, op: '<=', d: 2000, color: COLORS[2 % COLORS.length], visible: true }, // Machine time
      { a: 2,  b: 3,  cz: 0, op: '<=', d: 1400, color: COLORS[3 % COLORS.length], visible: true }  // Assembly time
    ];
    colorIdx = 4;
    state.points = [];
    state.geometries = [];
    state.zSlice = 0;
    state.nonNegativity = true;
    state.objective = { type: 'max', c1: 20, c2: 30, c3: 0 };
    syncInputsFromState({
      zMin: -10, zMax: 10, step: 0.5,
      label: 'Fixed Slice: <strong>z</strong> (unused)',
      hint: 'This problem has only 2 decision variables (x&#8321;, x&#8322;) — the slice has no effect here.',
      units: ''
    });
    zoomToConstraints(); // also renders — shows all three lines so the redundant two are visible
  }

  function syncInputsFromState(zBounds) {
    if (!els) cacheEls();
    q('g2d-toggle-region').checked = state.showFeasibleRegion;
    q('g2d-top-toggle-region').checked = state.showFeasibleRegion;
    const zEl = q('g2d-z-slice');
    // Set min/max/step BEFORE value — a <input type=range> clamps any value
    // assignment to its *current* min/max, so setting value first (while old
    // bounds from a previous preset are still active) would silently clamp
    // and desync the visible thumb position from state.zSlice.
    const zMin = (zBounds && zBounds.zMin != null) ? zBounds.zMin : -10;
    const zMax = (zBounds && zBounds.zMax != null) ? zBounds.zMax : 10;
    zEl.min = zMin; zEl.max = zMax; zEl.step = (zBounds && zBounds.step) || 0.5;
    zEl.value = state.zSlice;
    const units = (zBounds && zBounds.units) || '';
    q('g2d-z-slice-badge').textContent = state.zSlice + units;
    q('g2d-z-slice-minlabel').textContent = zMin + units;
    q('g2d-z-slice-maxlabel').textContent = 'Max ' + zMax + units;
    if (zBounds && zBounds.label) q('g2d-z-slice-label').innerHTML = zBounds.label;
    if (zBounds && zBounds.hint) q('g2d-z-slice-hint').innerHTML = zBounds.hint;
    q('g2d-non-negativity').checked = state.nonNegativity;
    q('g2d-obj-type').value = state.objective.type;
    q('g2d-obj-c1').value = state.objective.c1;
    q('g2d-obj-c2').value = state.objective.c2;
    q('g2d-obj-c3').value = state.objective.c3;
    setToolMode('select', 'Mode: Select/Move Canvas');
  }

  return { init, refreshLayout, loadBlank, loadProductMixPreset, loadBottlingPlantPreset, loadTwoPlantPreset, loadRadioComponentsPreset, zoomToConstraints, zoomToFeasible };
})();
