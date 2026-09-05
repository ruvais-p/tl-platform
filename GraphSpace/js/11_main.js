// =====================================================================
// MAIN — bootstrap, example gallery, keyboard UX, animation driver
// =====================================================================
(function(){
  function boot(){
    EngineRenderer.init(document.getElementById('canvas-host'), document.getElementById('axis-gizmo'), {
      fps: document.getElementById('status-fps'), tris: document.getElementById('status-tris'), cam: document.getElementById('status-cam')
    });
    Sidebar.init();
    ViewportUI.init();
    ExportUI.init();

    const loaded = ExportUI.loadFromHash();
    if(!loaded){
      seedStarterGraph();
    }

    document.getElementById('btn-example').addEventListener('click', ()=>{
      if(State.getRows().length===0 || confirm('Replace current graph with the example gallery?')){
        loadExampleGallery();
      }
    });

    attachKeyboardUX();

    function animLoop(){ requestAnimationFrame(animLoop); State.tickAnimation(); }
    requestAnimationFrame(animLoop);
  }

  function seedStarterGraph(){
    const r1 = State.addRow('expr', {});
    r1.text = 'z = sin(sqrt(x^2+y^2)+0.001)*3';
    r1.style.colorMode = 'height'; r1.style.color = '#5b9bff';
    State.classifyRow(r1); State.recomputeAll(); Sidebar.render();
  }

  function loadExampleGallery(){
    State.clearAll();
    const mk = (text, opts)=>{
      const r = State.addRow('expr', {});
      r.text = text;
      if(opts){
        if(opts.color) r.style.color = opts.color;
        if(opts.colorMode) r.style.colorMode = opts.colorMode;
        if(opts.opacity!==undefined) r.style.opacity = opts.opacity;
      }
      State.classifyRow(r);
      if(opts && opts.domain) Object.assign(r.domain, opts.domain);
      return r;
    };
    // Only the hero surface starts visible — everything else lives in the
    // sidebar, toggle-able, so the gallery reads as a tour rather than a
    // pile-up of overlapping geometry.
    const fWave = mk('z = sin(sqrt(x^2+y^2)+0.001)*3', { colorMode:'spectral' });
    const fFolder1 = State.addRow('folder', { overrides:{ name:'Explicit & sliders' } });
    const k = mk('k = 3', {});
    k.folderId = fFolder1.id;
    const kSurf = mk('z = sin(k*x)*cos(y)', { color:'#ff6b6b', colorMode:'height' });
    kSurf.folderId = fFolder1.id; kSurf.visible = false;

    const fFolder2 = State.addRow('folder', { overrides:{ name:'Implicit surfaces', collapsed:true } });
    const sphere = mk('x^2+y^2+z^2-9=0', { color:'#4ecb71', colorMode:'height', opacity:0.85 });
    sphere.folderId = fFolder2.id; sphere.visible = false;
    const torus = mk('(sqrt(x^2+y^2)-3.2)^2+z^2-1=0', { color:'#c77dff', colorMode:'spectral', opacity:0.9,
      domain:{xmin:-6,xmax:6,ymin:-6,ymax:6,zmin:-3,zmax:3,resolution:38} });
    torus.folderId = fFolder2.id; torus.visible = false;

    const fFolder3 = State.addRow('folder', { overrides:{ name:'Curves, points & vectors', collapsed:true } });
    const helix = mk('[3*cos(t), 3*sin(t), t/2]', { color:'#ffb84d' });
    helix.folderId = fFolder3.id; helix.visible = false; Object.assign(helix.domain, { tMin:0, tMax:4*Math.PI, tubeRadius:0.09 });
    const pt = mk('(4, 4, 4)', { color:'#3ddbd9' }); pt.folderId = fFolder3.id; pt.visible = false;
    const vec = mk('vector(3,3,3)', { color:'#ff7ab6' }); vec.folderId = fFolder3.id; vec.visible = false;
    const field = mk('[-y, x, 0.4]', { color:'#e0c341' });
    field.folderId = fFolder3.id; field.visible = false; Object.assign(field.domain, { xmin:-6,xmax:6,ymin:-6,ymax:6,zmin:-2,zmax:2, gridN:5 });

    const fFolder4 = State.addRow('folder', { overrides:{ name:'Regions', collapsed:true } });
    const region = mk('x^2+y^2+(z-1)^2 < 4 {z<3}', { color:'#ff5a52', opacity:0.5,
      domain:{xmin:-4,xmax:4,ymin:-4,ymax:4,zmin:-3,zmax:5,resolution:16} });
    region.folderId = fFolder4.id; region.visible = false;

    State.recomputeAll();
    Sidebar.render();
    EngineRenderer.resetCamera();
  }

  function attachKeyboardUX(){
    const list = document.getElementById('expr-list');
    list.addEventListener('keydown', e=>{
      if(!e.target.matches('.expr-input')) return;
      const rowWrap = e.target.closest('[data-row-id]');
      const rowId = rowWrap.dataset.rowId;
      if(e.key==='Enter' && !e.shiftKey){
        e.preventDefault();
        const r = State.addRow('expr', { afterId: rowId });
        Sidebar.render();
        requestAnimationFrame(()=>{
          const ta = list.querySelector(`.expr-row[data-row-id="${r.id}"] .expr-input`);
          if(ta) ta.focus();
        });
      } else if(e.key==='Backspace' && e.target.value===''){
        const rows = State.getRows();
        if(rows.length>1){
          e.preventDefault();
          const idx = rows.findIndex(r=>r.id===rowId);
          State.removeRow(rowId);
          Sidebar.render();
          requestAnimationFrame(()=>{
            const prev = rows[idx-1];
            if(prev){
              const ta = list.querySelector(`.expr-row[data-row-id="${prev.id}"] .expr-input`);
              if(ta){ ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
            }
          });
        }
      }
    });
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); }
  else boot();
})();
