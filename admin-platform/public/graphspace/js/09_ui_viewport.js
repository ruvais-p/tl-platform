// =====================================================================
// UI / VIEWPORT — toolbar, presets, tooltip, hover inspection, bounds
// =====================================================================
const ViewportUI = (() => {
  let tooltip, boundsPopover;

  function init(){
    tooltip = document.getElementById('tooltip');

    document.getElementById('vp-zoom-in').addEventListener('click', ()=>EngineRenderer.zoomBy(0.8));
    document.getElementById('vp-zoom-out').addEventListener('click', ()=>EngineRenderer.zoomBy(1.25));
    document.getElementById('vp-reset').addEventListener('click', ()=>EngineRenderer.resetCamera());

    const perspBtn = document.getElementById('vp-proj-persp'), orthoBtn = document.getElementById('vp-proj-ortho');
    perspBtn.addEventListener('click', ()=>{ EngineRenderer.setProjection('persp'); perspBtn.classList.add('active'); orthoBtn.classList.remove('active'); });
    orthoBtn.addEventListener('click', ()=>{ EngineRenderer.setProjection('ortho'); orthoBtn.classList.add('active'); perspBtn.classList.remove('active'); });

    const orbitBtn = document.getElementById('vp-tool-orbit'), traceBtn = document.getElementById('vp-tool-trace');
    orbitBtn.addEventListener('click', ()=>{ EngineRenderer.setTraceMode(false); orbitBtn.classList.add('active'); traceBtn.classList.remove('active'); });
    traceBtn.addEventListener('click', ()=>{ EngineRenderer.setTraceMode(true); traceBtn.classList.add('active'); orbitBtn.classList.remove('active'); });

    const gridBtn = document.getElementById('vp-grid-toggle');
    let gridsOn = false;
    gridBtn.addEventListener('click', ()=>{ gridsOn=!gridsOn; EngineRenderer.setGridPlanes(gridsOn); gridBtn.classList.toggle('active', gridsOn); });

    const bboxBtn = document.getElementById('vp-bbox-toggle');
    let bboxOn = true;
    bboxBtn.addEventListener('click', ()=>{ bboxOn=!bboxOn; EngineRenderer.setBboxVisible(bboxOn); bboxBtn.classList.toggle('active', bboxOn); });
    bboxBtn.addEventListener('contextmenu', e=>{ e.preventDefault(); openBoundsPopover(bboxBtn); });

    document.querySelectorAll('#view-presets .preset-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>EngineRenderer.goToPreset(btn.dataset.view));
    });

    EngineRenderer.setHoverCallback(onHover);

    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    applyStoredTheme();
  }

  function onHover(info){
    if(!info){ tooltip.style.display='none'; return; }
    tooltip.style.display='block';
    tooltip.style.left = (info.screenX+16)+'px';
    tooltip.style.top = (info.screenY+16)+'px';
    const p = info.point;
    tooltip.innerHTML = `<div class="tt-title">${info.label?escapeHtml(info.label):'Point'}</div>x = ${Utils.fmtNum(p.x)}<br>y = ${Utils.fmtNum(p.y)}<br>z = ${Utils.fmtNum(p.z)}`;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function openBoundsPopover(anchorEl){
    if(!boundsPopover){
      boundsPopover = document.createElement('div');
      boundsPopover.className = 'popover hidden';
      boundsPopover.style.width = '210px';
      boundsPopover.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.03em">Bounding box</div>
        <div class="gear-panel" style="margin:0;padding:0;background:transparent;border:none">
          ${['xmin','xmax','ymin','ymax','zmin','zmax'].map(k=>`<div class="gear-field"><label>${k}</label><input type="number" data-bnd="${k}"></div>`).join('')}
        </div>`;
      document.body.appendChild(boundsPopover);
      boundsPopover.addEventListener('input', e=>{
        if(e.target.matches('[data-bnd]')){
          const b = EngineRenderer.getBounds();
          b[e.target.dataset.bnd] = parseFloat(e.target.value)||0;
          EngineRenderer.setBounds(b);
        }
      });
      document.addEventListener('pointerdown', e=>{
        if(!boundsPopover.classList.contains('hidden') && !boundsPopover.contains(e.target) && e.target.id!=='vp-bbox-toggle'){
          boundsPopover.classList.add('hidden');
        }
      });
    }
    const b = EngineRenderer.getBounds();
    boundsPopover.querySelectorAll('[data-bnd]').forEach(inp=>{ inp.value = b[inp.dataset.bnd]; });
    const r = anchorEl.getBoundingClientRect();
    boundsPopover.classList.remove('hidden');
    boundsPopover.style.right = (window.innerWidth-r.left+8)+'px';
    boundsPopover.style.top = r.top+'px';
    boundsPopover.style.left = 'auto';
  }

  function toggleTheme(){
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme');
    let next;
    if(!cur){ next = (window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark'; }
    else next = cur==='dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try{ localStorage.setItem('gs3d-theme', next); }catch(e){}
    EngineRenderer.onThemeChange();
  }
  function applyStoredTheme(){
    try{
      const saved = localStorage.getItem('gs3d-theme');
      if(saved){ document.documentElement.setAttribute('data-theme', saved); }
    }catch(e){}
  }

  return { init };
})();
