/* ==================================================================
   Dashboard — top-left 3D/2D mode switcher + workspace tabs.
   Both workspaces stay mounted in the DOM at all times; switching modes
   only toggles which one is visible, so all state (expressions, camera,
   LP constraints, geometry) is preserved across toggles with nothing to
   save/restore. Workspace tabs (General / Example 1 / Example 2) load
   presets on top of that.
   ================================================================== */
(() => {
  let currentMode = '3d';
  let geometry2dReady = false;

  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('main').classList.toggle('hidden', mode !== '3d');
    document.getElementById('main-2d').classList.toggle('hidden', mode !== '2d');

    if (mode === '2d') {
      if (!geometry2dReady) { Geometry2D.init(); geometry2dReady = true; }
      // svg had zero size while display:none — recompute now that it's visible
      requestAnimationFrame(() => Geometry2D.refreshLayout());
    } else {
      // canvas-host had zero size while display:none — resize the WebGL
      // renderer back to its real box now that it's visible again
      requestAnimationFrame(() => { if (window.EngineRenderer && EngineRenderer.onResize) EngineRenderer.onResize(); });
    }
  }

  function setWorkspaceTab(ws) {
    document.querySelectorAll('.ws-tab').forEach(b => b.classList.toggle('active', b.dataset.ws === ws));

    const problemCard1 = document.getElementById('g2d-problem-card');
    const problemCard2 = document.getElementById('g2d-problem-card-2');
    const problemCard3 = document.getElementById('g2d-problem-card-3');
    const problemCard4 = document.getElementById('g2d-problem-card-4');
    if (problemCard1) problemCard1.classList.toggle('hidden', ws !== 'example1');
    if (problemCard2) problemCard2.classList.toggle('hidden', ws !== 'example2');
    if (problemCard3) problemCard3.classList.toggle('hidden', ws !== 'example3');
    if (problemCard4) problemCard4.classList.toggle('hidden', ws !== 'example4');

    if (ws === 'general') {
      if (!geometry2dReady) { Geometry2D.init(); geometry2dReady = true; }
      Geometry2D.loadBlank();
    } else if (ws === 'example1') {
      setMode('2d');
      if (!geometry2dReady) { Geometry2D.init(); geometry2dReady = true; }
      Geometry2D.loadProductMixPreset();
    } else if (ws === 'example2') {
      setMode('2d');
      if (!geometry2dReady) { Geometry2D.init(); geometry2dReady = true; }
      Geometry2D.loadBottlingPlantPreset();
    } else if (ws === 'example3') {
      setMode('2d');
      if (!geometry2dReady) { Geometry2D.init(); geometry2dReady = true; }
      Geometry2D.loadTwoPlantPreset();
    } else if (ws === 'example4') {
      setMode('2d');
      if (!geometry2dReady) { Geometry2D.init(); geometry2dReady = true; }
      Geometry2D.loadRadioComponentsPreset();
    }
  }

  function init() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    document.querySelectorAll('.ws-tab').forEach(btn => {
      btn.addEventListener('click', () => setWorkspaceTab(btn.dataset.ws));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
