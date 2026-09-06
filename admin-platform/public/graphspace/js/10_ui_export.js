// =====================================================================
// UI / EXPORT — PNG capture, OBJ/STL mesh export, share-URL state hash
// =====================================================================
const ExportUI = (() => {
  function init(){
    document.getElementById('btn-export').addEventListener('click', ()=>toggleOverlay('export-overlay', true));
    document.getElementById('btn-share').addEventListener('click', ()=>{ toggleOverlay('share-overlay', true); refreshShareUrl(); });
    document.getElementById('btn-help').addEventListener('click', ()=>{ buildHelp(); toggleOverlay('help-overlay', true); });
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', e=>{
      toggleOverlay(e.target.closest('.overlay').id, false);
    }));
    document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click', e=>{ if(e.target===ov) toggleOverlay(ov.id,false); }));

    document.querySelectorAll('[data-export-tab]').forEach(tab=>{
      tab.addEventListener('click', ()=>{
        document.querySelectorAll('[data-export-tab]').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        ['png','obj','stl'].forEach(k=>document.getElementById('export-pane-'+k).classList.toggle('hidden', k!==tab.dataset.exportTab));
      });
    });

    document.getElementById('btn-do-png').addEventListener('click', ()=>{
      const url = EngineRenderer.captureImage(2.2);
      const img = document.getElementById('export-img-preview');
      img.src = url; img.classList.remove('hidden');
    });
    document.getElementById('btn-do-obj').addEventListener('click', ()=>{
      document.getElementById('obj-output').value = generateOBJ();
    });
    document.getElementById('btn-do-stl').addEventListener('click', ()=>{
      document.getElementById('stl-output').value = generateSTL();
    });
    document.getElementById('btn-copy-obj').addEventListener('click', async ()=>{
      const ok = await Utils.copyToClipboard(document.getElementById('obj-output').value);
      flashBtn('btn-copy-obj', ok);
    });
    document.getElementById('btn-copy-stl').addEventListener('click', async ()=>{
      const ok = await Utils.copyToClipboard(document.getElementById('stl-output').value);
      flashBtn('btn-copy-stl', ok);
    });
    document.getElementById('btn-copy-share').addEventListener('click', async ()=>{
      const ok = await Utils.copyToClipboard(document.getElementById('share-url-output').value);
      flashBtn('btn-copy-share', ok);
    });
  }

  function flashBtn(id, ok){
    const b = document.getElementById(id);
    const old = b.textContent;
    b.textContent = ok ? 'Copied ✓' : 'Copy failed — select & copy manually';
    setTimeout(()=>b.textContent=old, 1600);
  }

  function toggleOverlay(id, show){ document.getElementById(id).classList.toggle('hidden', !show); }

  // ---------------- mesh collection ----------------
  function collectTriangles(){
    const tris = [];
    EngineRenderer.getRowGroup().traverse(o=>{
      if(!o.isMesh || !o.visible || !o.geometry) return;
      o.updateMatrixWorld(true);
      const geo = o.geometry;
      const pos = geo.attributes.position;
      if(!pos) return;
      const idx = geo.index;
      const mw = o.matrixWorld;
      const getV = (i)=> new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(mw);
      if(idx){
        for(let i=0;i<idx.count;i+=3){
          tris.push([getV(idx.getX(i)), getV(idx.getX(i+1)), getV(idx.getX(i+2))]);
        }
      } else {
        for(let i=0;i<pos.count;i+=3){
          tris.push([getV(i), getV(i+1), getV(i+2)]);
        }
      }
    });
    return tris;
  }

  function generateOBJ(){
    const tris = collectTriangles();
    if(tris.length===0) return '# No visible surface/curve geometry to export.\n# (Point/vector/voxel-region objects are not included in mesh export.)\n';
    let out = '# GraphSpace 3D — exported mesh\n# ' + tris.length + ' triangles\no Scene\n';
    const vlines = [], flines = [];
    let n=1;
    tris.forEach(tri=>{
      tri.forEach(v=>vlines.push(`v ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}`));
      flines.push(`f ${n} ${n+1} ${n+2}`); n+=3;
    });
    return out + vlines.join('\n') + '\n' + flines.join('\n') + '\n';
  }

  function generateSTL(){
    const tris = collectTriangles();
    if(tris.length===0) return 'solid scene\nendsolid scene\n';
    let out = 'solid scene\n';
    tris.forEach(([a,b,c])=>{
      const n = new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
      out += `facet normal ${fx(n.x)} ${fx(n.y)} ${fx(n.z)}\nouter loop\n`;
      [a,b,c].forEach(v=>{ out += `vertex ${fx(v.x)} ${fx(v.y)} ${fx(v.z)}\n`; });
      out += 'endloop\nendfacet\n';
    });
    out += 'endsolid scene\n';
    return out;
  }
  function fx(n){ return (Math.abs(n)<1e-9?0:n).toFixed(6); }

  // ---------------- share URL / state hash ----------------
  function serializeState(){
    const rows = State.getRows().map(r=>{
      const base = { id:r.id, kind:r.kind, folderId:r.folderId };
      if(r.kind==='expr') Object.assign(base, { text:r.text, style:r.style, domain:r.domain, visible:r.visible, sliderMeta:r.sliderMeta });
      if(r.kind==='folder') Object.assign(base, { name:r.name, collapsed:r.collapsed });
      if(r.kind==='table') Object.assign(base, { name:r.name, style:r.style, connect:r.connect, data:r.data, visible:r.visible });
      if(r.kind==='note') Object.assign(base, { text:r.text });
      return base;
    });
    const sliders = {}; State.getAutoSliders().forEach((s,name)=>{ sliders[name] = {value:s.value,min:s.min,max:s.max,step:s.step,loop:s.loop}; });
    const b = EngineRenderer.getBounds();
    const sph = EngineRenderer.sph;
    return { v:1, rows, sliders, bounds:b, theta:sph.theta, phi:sph.phi, radius:sph.radius };
  }

  function buildShareURL(){
    const json = JSON.stringify(serializeState());
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = location.origin + location.pathname + '#s=' + b64;
    return url;
  }
  function refreshShareUrl(){
    document.getElementById('share-url-output').value = buildShareURL();
  }

  function loadFromHash(){
    if(!location.hash.startsWith('#s=')) return false;
    try{
      const json = decodeURIComponent(escape(atob(location.hash.slice(3))));
      const st = JSON.parse(json);
      if(!st || !st.rows) return false;
      State.clearAll();
      st.rows.forEach(r=>{
        const row = State.addRow(r.kind, {});
        Object.assign(row, r, { id: row.id }); // keep new id, adopt rest
        row.folderId = null; // reassign below after ids mapped
      });
      // second pass to fix folderId references (old id -> new id mapping)
      const rows = State.getRows();
      st.rows.forEach((orig, i)=>{
        if(orig.folderId){
          const oldIdxParent = st.rows.findIndex(x=>x.id===orig.folderId);
          if(oldIdxParent>=0) rows[i].folderId = rows[oldIdxParent].id;
        }
      });
      if(st.sliders){
        const as = State.getAutoSliders();
        Object.keys(st.sliders).forEach(name=>{ /* populated by recompute; override after */ });
        State.recomputeAll();
        Object.keys(st.sliders).forEach(name=>{
          const s = as.get(name);
          if(s) Object.assign(s, st.sliders[name]);
        });
      }
      if(st.bounds) EngineRenderer.setBounds(st.bounds);
      if(typeof st.theta === 'number'){ EngineRenderer.sph.theta = st.theta; EngineRenderer.sph.phi = st.phi; EngineRenderer.sph.radius = st.radius; }
      State.recomputeAll();
      Sidebar.render();
      return true;
    }catch(e){ console.warn('Failed to load shared state', e); return false; }
  }

  // ---------------- help ----------------
  function buildHelp(){
    const body = document.getElementById('help-body');
    if(body.dataset.built) return;
    body.dataset.built = '1';
    body.innerHTML = `
      <p>Type expressions using standard math notation (powered by math.js). Variables <code>x, y, z, t, u, v, r, theta, phi</code> are reserved for plotting; any other letter becomes an automatic slider.</p>
      <h4>Surfaces</h4>
      <div class="ex-line"><code>z = x^2 + y^2</code><span class="ex-desc">Explicit surface</span></div>
      <div class="ex-line"><code>r = 2 + sin(3*theta)</code><span class="ex-desc">Spherical r=f(θ,φ)</span></div>
      <div class="ex-line"><code>z = sin(r)/r</code><span class="ex-desc">Cylindrical z=f(r,θ)</span></div>
      <div class="ex-line"><code>x^2+y^2+z^2 = 16</code><span class="ex-desc">Implicit surface (marching tetrahedra)</span></div>
      <div class="ex-line"><code>[cos(u)*sin(v), sin(u)*sin(v), cos(v)]</code><span class="ex-desc">Parametric surface (u,v)</span></div>
      <h4>Curves, points &amp; vectors</h4>
      <div class="ex-line"><code>[cos(t), sin(t), t/4]</code><span class="ex-desc">Parametric space curve (helix)</span></div>
      <div class="ex-line"><code>(1, 2, 3)</code> or <code>[1,2,3]</code><span class="ex-desc">Point marker</span></div>
      <div class="ex-line"><code>vector(1,2,3)</code><span class="ex-desc">Arrow from the origin</span></div>
      <div class="ex-line"><code>grad(x^2*y+z)</code><span class="ex-desc">Gradient vector field</span></div>
      <div class="ex-line"><code>[-y, x, 0]</code><span class="ex-desc">Custom vector field</span></div>
      <h4>Regions &amp; restrictions</h4>
      <div class="ex-line"><code>x^2+y^2+z^2 < 9</code><span class="ex-desc">Volumetric inequality region</span></div>
      <div class="ex-line"><code>z=x^2+y^2 {x^2+y^2<4}</code><span class="ex-desc">Domain-clipped surface</span></div>
      <h4>Variables, sliders &amp; functions</h4>
      <div class="ex-line"><code>k = 2</code><span class="ex-desc">Constant with an inline slider</span></div>
      <div class="ex-line"><code>z = k*cos(x)*sin(y)</code><span class="ex-desc">Uses slider k automatically</span></div>
      <div class="ex-line"><code>f(x,y) = x^2 - y^2</code><span class="ex-desc">Named function (call it as f(...) elsewhere)</span></div>
      <div class="ex-line"><code>a = [1,2,3]</code><span class="ex-desc">List for batch values</span></div>
      <h4>Calculus</h4>
      <div class="ex-line"><code>d(x^2*y, x)</code><span class="ex-desc">Partial derivative ∂/∂x</span></div>
      <div class="ex-line"><code>cross([1,0,0],[0,1,0])</code><span class="ex-desc">Cross product</span></div>
      <div class="ex-line"><code>dot([1,2,3],[4,5,6])</code><span class="ex-desc">Dot product</span></div>
      <p style="margin-top:14px">Right-click (or long-press) an expression's color badge to change color, opacity, render style and coloring mode. Use the gear icon to adjust that expression's domain and mesh resolution.</p>
    `;
  }

  return { init, loadFromHash, buildShareURL };
})();
