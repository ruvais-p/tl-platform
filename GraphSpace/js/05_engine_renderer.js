// =====================================================================
// ENGINE / RENDERER — scene, camera, custom orbit/pan/zoom, axes, grids
// =====================================================================
const EngineRenderer = (() => {
  let scene, rendererGL, camPersp, camOrtho, activeCam, host, canvas;
  let gizmoCanvas, gizmoCtx;
  let target = new THREE.Vector3(0,0,0);
  let sph = { radius: 30, theta: Math.PI*0.28, phi: Math.PI*0.34 };
  let projMode = 'persp';
  let rowGroup, axesGroup, gridGroup, bboxGroup, lightGroup;
  let bbox = { xmin:-10,xmax:10, ymin:-10,ymax:10, zmin:-10,zmax:10 };
  let gridPlanesVisible = false, bboxVisible = true;
  let raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.25 };
  let pickables = []; // meshes flagged pickable
  let traceMode = false;
  let hoverCallback = null;
  let fpsEl, trisEl, camEl;
  let lastFrameT = performance.now(), frameCount=0, fpsAccum=0, fps=60;
  let onTick = null;

  const PHI_MIN = 0.02, PHI_MAX = Math.PI-0.02;

  // Detect a software (non-GPU) WebGL fallback — SwiftShader, llvmpipe, Mesa
  // "Software Rasterizer", ANGLE software backends, etc — and automatically
  // trade antialiasing / pixel ratio for frame rate on those systems (remote
  // desktops, some VMs, and headless/sandboxed browsers all hit this path).
  function detectSoftwareRenderer(){
    try{
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if(!gl) return true;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
      return /swiftshader|llvmpipe|software|mesa|basic render/i.test(renderer);
    }catch(e){ return false; }
  }

  function init(hostEl, gizmoEl, statusEls){
    host = hostEl; gizmoCanvas = gizmoEl;
    gizmoCtx = gizmoCanvas.getContext('2d');
    fpsEl = statusEls.fps; trisEl = statusEls.tris; camEl = statusEls.cam;

    scene = new THREE.Scene();
    const isSoftware = detectSoftwareRenderer();
    rendererGL = new THREE.WebGLRenderer({ antialias: !isSoftware, alpha:false, powerPreference:'high-performance' });
    rendererGL.setPixelRatio(Math.min(isSoftware?1:2, window.devicePixelRatio||1));
    host.appendChild(rendererGL.domElement);
    canvas = rendererGL.domElement;

    const aspect = host.clientWidth / Math.max(1,host.clientHeight);
    camPersp = new THREE.PerspectiveCamera(45, aspect, 0.05, 2000);
    camOrtho = new THREE.OrthographicCamera(-10,10,10,-10, 0.05, 2000);
    camPersp.up.set(0,0,1); camOrtho.up.set(0,0,1);
    activeCam = camPersp;

    rowGroup = new THREE.Group(); scene.add(rowGroup);
    axesGroup = new THREE.Group(); scene.add(axesGroup);
    gridGroup = new THREE.Group(); scene.add(gridGroup);
    bboxGroup = new THREE.Group(); scene.add(bboxGroup);
    lightGroup = new THREE.Group(); scene.add(lightGroup);
    buildLights();
    rebuildAxesAndGrids();

    setBg();
    attachControls();
    window.addEventListener('resize', onResize);
    onResize();
    requestAnimationFrame(loop);
  }

  function setBg(){
    const dark = isDark();
    scene.background = new THREE.Color(dark ? 0x14161a : 0xf5f6f8);
    scene.fog = new THREE.Fog(scene.background.getHex(), 60, 140);
  }
  function isDark(){
    const el = document.documentElement;
    if(el.getAttribute('data-theme')==='dark') return true;
    if(el.getAttribute('data-theme')==='light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function buildLights(){
    lightGroup.clear();
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(18,-14,26);
    const fill = new THREE.DirectionalLight(0xffffff, 0.28);
    fill.position.set(-16,18,-10);
    lightGroup.add(amb, key, fill);
  }

  function niceStep(range){
    const raw = range/9;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw/mag;
    let step;
    if(norm<1.5) step=1; else if(norm<3.5) step=2; else if(norm<7.5) step=5; else step=10;
    return step*mag;
  }

  function makeLabelSprite(text, color){
    const cvs = document.createElement('canvas');
    cvs.width=128; cvs.height=64;
    const ctx = cvs.getContext('2d');
    ctx.font = '600 40px -apple-system,Segoe UI,Arial';
    ctx.fillStyle = color;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.1,0.55,1);
    spr.renderOrder = 999;
    return spr;
  }

  function rebuildAxesAndGrids(){
    axesGroup.clear(); gridGroup.clear(); bboxGroup.clear();
    const dark = isDark();
    const dim = dark ? 0x666f7c : 0x9aa3b0;
    const colors = { x:0xff5a52, y:0x35c463, z:0x4d8dff };
    const ends = {
      x:[[bbox.xmin,0,0],[bbox.xmax,0,0]],
      y:[[0,bbox.ymin,0],[0,bbox.ymax,0]],
      z:[[0,0,bbox.zmin],[0,0,bbox.zmax]],
    };
    ['x','y','z'].forEach(axis=>{
      const [p0,p1] = ends[axis];
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p0), new THREE.Vector3(...p1)]);
      const mat = new THREE.LineBasicMaterial({ color: colors[axis] });
      axesGroup.add(new THREE.Line(geo, mat));

      const mn = axis==='x'?bbox.xmin:(axis==='y'?bbox.ymin:bbox.zmin);
      const mx = axis==='x'?bbox.xmax:(axis==='y'?bbox.ymax:bbox.zmax);
      const step = niceStep(mx-mn);
      const tickColor = axis==='x'?'#ff5a52':(axis==='y'?'#35c463':'#4d8dff');
      for(let v = Math.ceil(mn/step)*step; v<=mx+1e-9; v+=step){
        if(Math.abs(v) < step*0.001) continue;
        const pos = axis==='x'?[v,0,0]:(axis==='y'?[0,v,0]:[0,0,v]);
        const label = makeLabelSprite(Utils.fmtNum(v,2), tickColor);
        label.position.set(pos[0],pos[1],pos[2]);
        const off = (mx-mn)*0.012;
        if(axis==='z') label.position.x += off*6; else label.position.z += off*6;
        axesGroup.add(label);
        const tgeo = new THREE.BufferGeometry();
        let tp;
        const tl = (mx-mn)*0.006;
        if(axis==='x') tp=[v,-tl,0, v,tl,0];
        else if(axis==='y') tp=[-tl,v,0, tl,v,0];
        else tp=[-tl,0,v, tl,0,v];
        tgeo.setAttribute('position', new THREE.Float32BufferAttribute(tp,3));
        axesGroup.add(new THREE.Line(tgeo, new THREE.LineBasicMaterial({color:dim})));
      }
    });

    // grid planes
    if(gridPlanesVisible){
      [['xy',bbox.xmin,bbox.xmax,bbox.ymin,bbox.ymax,0],
       ['xz',bbox.xmin,bbox.xmax,bbox.zmin,bbox.zmax,0],
       ['yz',bbox.ymin,bbox.ymax,bbox.zmin,bbox.zmax,0]].forEach(([plane,a0,a1,b0,b1])=>{
        const stepA = niceStep(a1-a0), stepB = niceStep(b1-b0);
        const pts = [];
        for(let a=Math.ceil(a0/stepA)*stepA; a<=a1+1e-9; a+=stepA){
          pts.push(mapPlane(plane,a,b0), mapPlane(plane,a,b1));
        }
        for(let b=Math.ceil(b0/stepB)*stepB; b<=b1+1e-9; b+=stepB){
          pts.push(mapPlane(plane,a0,b), mapPlane(plane,a1,b));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p)));
        const mat = new THREE.LineBasicMaterial({ color:dim, transparent:true, opacity:0.32 });
        gridGroup.add(new THREE.LineSegments(geo, mat));
      });
    }

    if(bboxVisible){
      const cx=(bbox.xmin+bbox.xmax)/2, cy=(bbox.ymin+bbox.ymax)/2, cz=(bbox.zmin+bbox.zmax)/2;
      const sx=bbox.xmax-bbox.xmin, sy=bbox.ymax-bbox.ymin, sz=bbox.zmax-bbox.zmin;
      const box = new THREE.BoxGeometry(sx,sy,sz);
      const edges = new THREE.EdgesGeometry(box);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: dim, transparent:true, opacity:0.55 }));
      line.position.set(cx,cy,cz);
      bboxGroup.add(line);
    }
  }
  function mapPlane(plane,a,b){
    if(plane==='xy') return [a,b,0];
    if(plane==='xz') return [a,0,b];
    return [0,a,b];
  }

  // ---------------- controls ----------------
  function attachControls(){
    const pointers = new Map();
    let mode = null; // 'rotate' | 'pan'
    let lastMid = null, lastDist = null;

    canvas.addEventListener('contextmenu', e=>e.preventDefault());

    canvas.addEventListener('pointerdown', e=>{
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      if(pointers.size===1){
        mode = (e.button===2 || e.shiftKey || e.ctrlKey) ? 'pan' : 'rotate';
      } else if(pointers.size===2){
        mode = 'touchpinch';
        const pts = [...pointers.values()];
        lastMid = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
        lastDist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      }
    });
    canvas.addEventListener('pointermove', e=>{
      if(!pointers.has(e.pointerId)){
        if(!mode) handleHover(e);
        return;
      }
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX-prev.x, dy = e.clientY-prev.y;
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});

      if(mode==='rotate' && pointers.size===1){
        sph.theta -= dx*0.0068;
        sph.phi = Utils.clamp(sph.phi - dy*0.0068, PHI_MIN, PHI_MAX);
      } else if(mode==='pan' && pointers.size===1){
        panBy(dx,dy);
      } else if(mode==='touchpinch' && pointers.size===2){
        const pts = [...pointers.values()];
        const mid = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
        const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
        if(lastDist){ sph.radius = Utils.clamp(sph.radius * (lastDist/Math.max(1,dist)), 1, 400); }
        if(lastMid){ panBy(mid.x-lastMid.x, mid.y-lastMid.y); }
        lastMid = mid; lastDist = dist;
      }
    });
    function endPointer(e){
      pointers.delete(e.pointerId);
      if(pointers.size===0){ mode=null; }
      else if(pointers.size===1){ mode='rotate'; lastMid=null; lastDist=null; }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', e=>{ if(pointers.size===0){ hideHoverTooltip(); } });

    canvas.addEventListener('wheel', e=>{
      e.preventDefault();
      const f = Math.pow(1.0016, e.deltaY);
      sph.radius = Utils.clamp(sph.radius*f, 0.8, 400);
    }, { passive:false });

    canvas.addEventListener('click', e=>{
      if(hoverCallback) handleHover(e, true);
    });
  }

  function panBy(dx,dy){
    const pos = getCamPos();
    const forward = target.clone().sub(pos).normalize();
    const worldUp = new THREE.Vector3(0,0,1);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const scale = sph.radius * 0.0016;
    target.addScaledVector(right, -dx*scale);
    target.addScaledVector(up, dy*scale);
  }

  function getCamPos(){
    const {radius,theta,phi} = sph;
    return new THREE.Vector3(
      target.x + radius*Math.sin(phi)*Math.cos(theta),
      target.y + radius*Math.sin(phi)*Math.sin(theta),
      target.z + radius*Math.cos(phi)
    );
  }

  function updateCamera(){
    const pos = getCamPos();
    camPersp.position.copy(pos); camPersp.lookAt(target);
    const aspect = host.clientWidth/Math.max(1,host.clientHeight);
    camPersp.aspect = aspect; camPersp.updateProjectionMatrix();

    camOrtho.position.copy(pos); camOrtho.lookAt(target);
    const h = sph.radius*0.46;
    const w = h*aspect;
    camOrtho.left=-w; camOrtho.right=w; camOrtho.top=h; camOrtho.bottom=-h;
    camOrtho.updateProjectionMatrix();

    activeCam = projMode==='persp' ? camPersp : camOrtho;
  }

  // ---------------- hover / raycast ----------------
  function handleHover(e, isClick){
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX-rect.left)/rect.width)*2-1;
    const ny = -((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera({x:nx,y:ny}, activeCam);
    const hits = raycaster.intersectObjects(pickables, false);
    if(hits.length){
      const hit = hits[0];
      let p = hit.point;
      let owner = hit.object;
      if(traceMode && owner.userData.samplePoints){
        p = nearestSample(owner.userData.samplePoints, p);
      }
      if(hoverCallback) hoverCallback({ screenX:e.clientX, screenY:e.clientY, point:p, rowId:owner.userData.rowId, label:owner.userData.rowLabel, isClick:!!isClick });
    } else if(hoverCallback){
      hoverCallback(null);
    }
  }
  function hideHoverTooltip(){ if(hoverCallback) hoverCallback(null); }
  function nearestSample(pts, p){
    let best=pts[0], bd=Infinity;
    for(const q of pts){ const d=q.distanceToSquared(p); if(d<bd){bd=d;best=q;} }
    return best;
  }

  // ---------------- public row management ----------------
  function setRowObject(rowId, object3d, label){
    clearRow(rowId);
    if(!object3d) return;
    object3d.traverse(o=>{
      if(o.isMesh || o.isPoints || o.isLineSegments){
        o.userData.rowId = rowId; o.userData.rowLabel = label;
        if(o.isMesh) pickables.push(o);
      }
      if(o.isArrowHelper){ o.userData.rowId = rowId; o.userData.rowLabel = label; }
    });
    object3d.userData.rowId = rowId;
    rowGroup.add(object3d);
  }
  function clearRow(rowId){
    const toRemove = rowGroup.children.filter(c=>c.userData.rowId===rowId);
    toRemove.forEach(obj=>{
      rowGroup.remove(obj);
      obj.traverse(o=>{
        if(o.isMesh){
          const idx = pickables.indexOf(o); if(idx>=0) pickables.splice(idx,1);
          o.geometry && o.geometry.dispose();
          if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); }
        }
      });
    });
  }
  function setRowSamplePoints(rowId, pts){
    rowGroup.children.filter(c=>c.userData.rowId===rowId).forEach(obj=>{
      obj.traverse(o=>{ if(o.isMesh) o.userData.samplePoints = pts; });
    });
  }

  // ---------------- view presets / projection ----------------
  function setProjection(mode){ projMode = mode; }
  function goToPreset(name){
    const presets = {
      iso: { theta: Math.PI*0.28, phi: Math.PI*0.34 },
      top: { theta: -Math.PI/2, phi: 0.001 },
      front: { theta: -Math.PI/2, phi: Math.PI/2 },
      side: { theta: 0, phi: Math.PI/2 },
    };
    const p = presets[name]; if(!p) return;
    animateTo(p.theta, p.phi);
  }
  function animateTo(theta, phi){
    const startT = sph.theta, startP = sph.phi, t0 = performance.now();
    let curT = ((theta-startT+Math.PI*3)%(Math.PI*2))-Math.PI;
    const targetT = startT+curT;
    function step(){
      const t = Math.min(1,(performance.now()-t0)/380);
      const e = 1-Math.pow(1-t,3);
      sph.theta = startT + (targetT-startT)*e;
      sph.phi = startP + (phi-startP)*e;
      if(t<1) requestAnimationFrame(step);
    }
    step();
  }
  function resetCamera(){ target.set(0,0,0); sph.radius=30; goToPreset('iso'); }
  function zoomBy(f){ sph.radius = Utils.clamp(sph.radius*f, 0.8, 400); }

  function setBounds(newBbox){ Object.assign(bbox,newBbox); rebuildAxesAndGrids(); }
  function getBounds(){ return Object.assign({},bbox); }
  function setGridPlanes(v){ gridPlanesVisible=v; rebuildAxesAndGrids(); }
  function setBboxVisible(v){ bboxVisible=v; rebuildAxesAndGrids(); }
  function setTraceMode(v){ traceMode=v; }
  function setHoverCallback(cb){ hoverCallback=cb; }
  function onThemeChange(){ setBg(); rebuildAxesAndGrids(); }

  function onResize(){
    const w = host.clientWidth, h = host.clientHeight;
    rendererGL.setSize(w,h,false);
  }

  function drawGizmo(){
    const w=gizmoCanvas.width=gizmoCanvas.clientWidth*2, h=gizmoCanvas.height=gizmoCanvas.clientHeight*2;
    gizmoCtx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2, R=w*0.32;
    const pos = getCamPos();
    const forward = target.clone().sub(pos).normalize();
    const worldUp = new THREE.Vector3(0,0,1);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const axes = [
      {v:new THREE.Vector3(1,0,0), c:'#ff5a52', l:'X'},
      {v:new THREE.Vector3(0,1,0), c:'#35c463', l:'Y'},
      {v:new THREE.Vector3(0,0,1), c:'#4d8dff', l:'Z'},
    ];
    const proj = axes.map(a=>{
      const sx = a.v.dot(right), sy = -a.v.dot(up), depth = a.v.dot(forward);
      return { x:cx+sx*R, y:cy+sy*R, depth, c:a.c, l:a.l };
    });
    proj.sort((a,b)=>a.depth-b.depth);
    proj.forEach(p=>{
      gizmoCtx.strokeStyle = p.c; gizmoCtx.lineWidth = 3.5;
      gizmoCtx.beginPath(); gizmoCtx.moveTo(cx,cy); gizmoCtx.lineTo(p.x,p.y); gizmoCtx.stroke();
      gizmoCtx.beginPath(); gizmoCtx.arc(p.x,p.y, p.depth>0?11:7, 0, Math.PI*2);
      gizmoCtx.fillStyle = p.depth>0 ? p.c : '#ffffff55';
      gizmoCtx.fill();
      if(p.depth>0){
        gizmoCtx.fillStyle = '#fff'; gizmoCtx.font='bold 15px sans-serif';
        gizmoCtx.textAlign='center'; gizmoCtx.textBaseline='middle';
        gizmoCtx.fillText(p.l, p.x, p.y+1);
      }
    });
  }

  function countTris(){
    let n=0;
    rowGroup.traverse(o=>{
      if(o.isMesh && o.geometry){
        const g=o.geometry;
        if(g.index) n += g.index.count/3; else if(g.attributes.position) n += g.attributes.position.count/3;
      }
      if(o.isInstancedMesh){ n += (o.geometry.index? o.geometry.index.count/3 : 0) * o.count; }
    });
    return Math.round(n);
  }

  function loop(now){
    requestAnimationFrame(loop);
    updateCamera();
    rendererGL.render(scene, activeCam);
    drawGizmo();
    frameCount++; fpsAccum += now-lastFrameT; lastFrameT = now;
    if(fpsAccum>500){ fps = Math.round(frameCount*1000/fpsAccum); frameCount=0; fpsAccum=0;
      if(fpsEl) fpsEl.textContent = fps+' fps';
      if(trisEl) trisEl.textContent = countTris().toLocaleString()+' tris';
      if(camEl) camEl.textContent = 'r='+sph.radius.toFixed(1);
    }
    if(onTick) onTick();
  }

  function captureImage(scale){
    scale = scale || 2;
    const w = host.clientWidth*scale, h = host.clientHeight*scale;
    const oldPR = rendererGL.getPixelRatio();
    rendererGL.setPixelRatio(scale);
    rendererGL.setSize(host.clientWidth, host.clientHeight, false);
    updateCamera();
    rendererGL.render(scene, activeCam);
    const url = rendererGL.domElement.toDataURL('image/png');
    rendererGL.setPixelRatio(oldPR);
    onResize();
    return url;
  }

  function getRowGroup(){ return rowGroup; }

  return {
    init, setRowObject, clearRow, setRowSamplePoints, setProjection, goToPreset, resetCamera, zoomBy,
    setBounds, getBounds, setGridPlanes, setBboxVisible, setTraceMode, setHoverCallback,
    onThemeChange, captureImage, getRowGroup, onResize, get camera(){ return activeCam; }, get sph(){return sph;}
  };
})();
