// =====================================================================
// ENGINE / GEOMETRY — turns a classified row + scope into THREE objects
// =====================================================================
const EngineGeometry = (() => {

  function defaultDomain(cls){
    switch(cls.type){
      case 'explicit': return { d1min:-10, d1max:10, d2min:-10, d2max:10, segments:56 };
      case 'spherical': return { thetaMin:0, thetaMax:Math.PI*2, phiMin:0, phiMax:Math.PI, segments:56 };
      case 'cylindrical': return cls.mode==='r_of_ztheta'
        ? { zMin:-10, zMax:10, thetaMin:0, thetaMax:Math.PI*2, segments:56 }
        : { rMin:0, rMax:10, thetaMin:0, thetaMax:Math.PI*2, segments:56 };
      case 'curve': return { tMin:0, tMax:Math.PI*2, segments:400, tubeRadius:0.07 };
      case 'surface_param': return { uMin:0, uMax:Math.PI*2, vMin:0, vMax:Math.PI, segments:56 };
      case 'vector': return { bx:0, by:0, bz:0 };
      case 'vectorfield': return { xmin:-8,xmax:8,ymin:-8,ymax:8,zmin:-8,zmax:8, gridN:6 };
      case 'implicit': return { xmin:-8,xmax:8,ymin:-8,ymax:8,zmin:-8,zmax:8, resolution:34 };
      case 'inequality': return { xmin:-8,xmax:8,ymin:-8,ymax:8,zmin:-8,zmax:8, resolution:18 };
      default: return {};
    }
  }

  function rgbToThreeColor(rgb){ return new THREE.Color(rgb[0]/255, rgb[1]/255, rgb[2]/255); }

  function colorAt(style, t, fallbackRgb){
    t = Math.max(0,Math.min(1,t));
    if(style.colorMode === 'spectral') return Utils.spectralColor(t);
    if(style.colorMode === 'height'){
      const [r,g,b] = Utils.hsvToRgb(230-230*t, 0.72, 0.95);
      return [r,g,b];
    }
    return fallbackRgb;
  }

  function makeSurfaceMaterial(style){
    const baseRgb = Utils.hexToRgb(style.color);
    const useVC = style.colorMode !== 'fixed';
    const mat = new THREE.MeshStandardMaterial({
      color: useVC ? 0xffffff : rgbToThreeColor(baseRgb),
      vertexColors: useVC,
      side: THREE.DoubleSide,
      transparent: style.opacity < 1,
      opacity: style.opacity,
      roughness: 0.55, metalness: 0.02,
      wireframe: style.renderStyle === 'wireframe',
      flatShading: false,
    });
    return mat;
  }
  function makeWireOverlayMaterial(style){
    return new THREE.MeshBasicMaterial({ color:0x000000, wireframe:true, transparent:true, opacity:0.22, depthWrite:false });
  }

  function buildGroupWithOptionalWire(geometry, style){
    const group = new THREE.Group();
    if(style.renderStyle !== 'wireframe'){
      const mat = makeSurfaceMaterial(Object.assign({}, style, {renderStyle:'solid'}));
      group.add(new THREE.Mesh(geometry, mat));
    }
    if(style.renderStyle === 'wireframe'){
      const mat = makeSurfaceMaterial(style);
      group.add(new THREE.Mesh(geometry, mat));
    }
    if(style.renderStyle === 'both'){
      group.add(new THREE.Mesh(geometry, makeWireOverlayMaterial(style)));
    }
    return group;
  }

  function evalSafe(compiled, scope){
    try{
      const v = compiled.evaluate(scope);
      return v;
    }catch(e){ return undefined; }
  }
  function finiteXYZ(v){
    return Array.isArray(v) && v.length===3 &&
      typeof v[0]==='number' && typeof v[1]==='number' && typeof v[2]==='number' &&
      isFinite(v[0]) && isFinite(v[1]) && isFinite(v[2]);
  }

  // ---------------- explicit z=f(x,y) family ----------------
  function buildExplicit(cls, style, domain, scope){
    const N = Math.max(4, Math.min(160, Math.round(domain.segments)));
    const [v1name, v2name] = cls.of;
    const axis = cls.axis;
    const positions = [], valid = [], metric = [];
    let mn=Infinity, mx=-Infinity;
    for(let i=0;i<=N;i++){
      const u = domain.d1min + (domain.d1max-domain.d1min)*i/N;
      for(let j=0;j<=N;j++){
        const w = domain.d2min + (domain.d2max-domain.d2min)*j/N;
        scope[v1name]=u; scope[v2name]=w;
        const coord = {x:0,y:0,z:0};
        coord[v1name]=u; coord[v2name]=w;
        let ok = true;
        if(cls.restrictionFn){
          scope.x=coord.x; scope.y=coord.y; scope.z=coord.z;
          try{ ok = !!cls.restrictionFn(scope); }catch(e){ ok=false; }
        }
        let out = evalSafe(cls.compiled, scope);
        if(typeof out !== 'number' || !isFinite(out)) ok = false;
        coord[axis] = ok ? out : 0;
        positions.push(coord.x, coord.y, coord.z);
        valid.push(ok);
        if(ok){ if(out<mn)mn=out; if(out>mx)mx=out; }
      }
    }
    return gridToGeometry(positions, valid, N, N, metricFromHeightAxis(positions,N,axis), mn, mx, style);
  }

  function metricFromHeightAxis(positions, N, axis){
    const idx = axis==='x'?0:(axis==='y'?1:2);
    const out = new Float32Array((N+1)*(N+1));
    for(let k=0;k<out.length;k++) out[k] = positions[k*3+idx];
    return out;
  }

  function gridToGeometry(positions, valid, Nu, Nv, metric, mn, mx, style){
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(positions);
    geo.setAttribute('position', new THREE.BufferAttribute(posArr,3));
    const idx = [];
    const stride = Nv+1;
    for(let i=0;i<Nu;i++){
      for(let j=0;j<Nv;j++){
        const a=i*stride+j, b=(i+1)*stride+j, c=(i+1)*stride+j+1, d=i*stride+j+1;
        if(valid[a]&&valid[b]&&valid[c]){ idx.push(a,b,c); }
        if(valid[a]&&valid[c]&&valid[d]){ idx.push(a,c,d); }
      }
    }
    geo.setIndex(idx);
    if(style.colorMode !== 'fixed'){
      const baseRgb = Utils.hexToRgb(style.color);
      const colors = new Float32Array(posArr.length);
      const range = (mx-mn)||1;
      for(let k=0;k<posArr.length/3;k++){
        const t = (metric[k]-mn)/range;
        const [r,g,b] = colorAt(style, t, baseRgb);
        colors[k*3]=r/255; colors[k*3+1]=g/255; colors[k*3+2]=b/255;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
    }
    geo.computeVertexNormals();
    const triCount = idx.length/3;
    return { object: buildGroupWithOptionalWire(geo, style), triCount };
  }

  // ---------------- spherical ----------------
  function buildSpherical(cls, style, domain, scope){
    const N = Math.max(4, Math.min(160, Math.round(domain.segments)));
    const positions=[], valid=[], metric=[];
    let mn=Infinity, mx=-Infinity;
    for(let i=0;i<=N;i++){
      const theta = domain.thetaMin + (domain.thetaMax-domain.thetaMin)*i/N;
      for(let j=0;j<=N;j++){
        const phi = domain.phiMin + (domain.phiMax-domain.phiMin)*j/N;
        scope.theta=theta; scope.phi=phi;
        let ok=true;
        let r = evalSafe(cls.compiled, scope);
        if(typeof r!=='number'||!isFinite(r)) ok=false;
        const rr = ok? r : 0;
        const x = rr*Math.sin(phi)*Math.cos(theta);
        const y = rr*Math.sin(phi)*Math.sin(theta);
        const z = rr*Math.cos(phi);
        if(ok && cls.restrictionFn){
          scope.x=x; scope.y=y; scope.z=z;
          try{ ok = !!cls.restrictionFn(scope); }catch(e){ ok=false; }
        }
        positions.push(x,y,z); valid.push(ok); metric.push(rr);
        if(ok){ if(rr<mn)mn=rr; if(rr>mx)mx=rr; }
      }
    }
    return gridToGeometry(positions, valid, N, N, Float32Array.from(metric), mn, mx, style);
  }

  // ---------------- cylindrical ----------------
  function buildCylindrical(cls, style, domain, scope){
    const N = Math.max(4, Math.min(160, Math.round(domain.segments)));
    const positions=[], valid=[], metric=[];
    let mn=Infinity, mx=-Infinity;
    const mode = cls.mode;
    for(let i=0;i<=N;i++){
      let aVal;
      if(mode==='z_of_rtheta') aVal = domain.rMin + (domain.rMax-domain.rMin)*i/N;
      else aVal = domain.zMin + (domain.zMax-domain.zMin)*i/N;
      for(let j=0;j<=N;j++){
        const theta = domain.thetaMin + (domain.thetaMax-domain.thetaMin)*j/N;
        let x,y,z,ok=true;
        if(mode==='z_of_rtheta'){
          scope.r=aVal; scope.theta=theta;
          let zz = evalSafe(cls.compiled, scope);
          if(typeof zz!=='number'||!isFinite(zz)) ok=false;
          z = ok? zz:0; x = aVal*Math.cos(theta); y = aVal*Math.sin(theta);
          metric.push(z);
        } else {
          scope.z=aVal; scope.theta=theta;
          let rr = evalSafe(cls.compiled, scope);
          if(typeof rr!=='number'||!isFinite(rr)) ok=false;
          const r = ok? rr:0; x = r*Math.cos(theta); y = r*Math.sin(theta); z = aVal;
          metric.push(r);
        }
        if(ok && cls.restrictionFn){
          scope.x=x; scope.y=y; scope.z=z;
          try{ ok = !!cls.restrictionFn(scope); }catch(e){ ok=false; }
        }
        positions.push(x,y,z); valid.push(ok);
        const mval = metric[metric.length-1];
        if(ok){ if(mval<mn)mn=mval; if(mval>mx)mx=mval; }
      }
    }
    return gridToGeometry(positions, valid, N, N, Float32Array.from(metric), mn, mx, style);
  }

  // ---------------- parametric surface ----------------
  function buildParamSurface(cls, style, domain, scope){
    const N = Math.max(4, Math.min(160, Math.round(domain.segments)));
    const positions=[], valid=[], metric=[];
    let mn=Infinity, mx=-Infinity;
    for(let i=0;i<=N;i++){
      const u = domain.uMin + (domain.uMax-domain.uMin)*i/N;
      for(let j=0;j<=N;j++){
        const v = domain.vMin + (domain.vMax-domain.vMin)*j/N;
        scope.u=u; scope.v=v;
        const out = evalSafe(cls.compiled, scope);
        let ok = finiteXYZ(out);
        if(ok && cls.restrictionFn){
          scope.x=out[0]; scope.y=out[1]; scope.z=out[2];
          try{ ok = !!cls.restrictionFn(scope); }catch(e){ ok=false; }
        }
        const p = ok? out : [0,0,0];
        positions.push(p[0],p[1],p[2]); valid.push(ok); metric.push(p[2]);
        if(ok){ if(p[2]<mn)mn=p[2]; if(p[2]>mx)mx=p[2]; }
      }
    }
    return gridToGeometry(positions, valid, N, N, Float32Array.from(metric), mn, mx, style);
  }

  // ---------------- parametric curve ----------------
  function buildCurve(cls, style, domain, scope){
    const N = Math.max(8, Math.min(2000, Math.round(domain.segments)));
    const runs = []; let cur = [];
    for(let i=0;i<=N;i++){
      const t = domain.tMin + (domain.tMax-domain.tMin)*i/N;
      scope.t = t;
      const out = evalSafe(cls.compiled, scope);
      let ok = finiteXYZ(out);
      if(ok && cls.restrictionFn){
        scope.x=out[0]; scope.y=out[1]; scope.z=out[2];
        try{ ok = !!cls.restrictionFn(scope); }catch(e){ ok=false; }
      }
      if(ok){ cur.push(new THREE.Vector3(out[0],out[1],out[2])); }
      else { if(cur.length>1) runs.push(cur); cur=[]; }
    }
    if(cur.length>1) runs.push(cur);
    const group = new THREE.Group();
    const baseRgb = Utils.hexToRgb(style.color);
    let triCount = 0;
    runs.forEach(pts=>{
      if(pts.length<2) return;
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.0);
      const tubularSeg = Math.max(2, Math.min(1500, pts.length*2));
      const geo = new THREE.TubeGeometry(curve, tubularSeg, Math.max(0.005,domain.tubeRadius), 8, false);
      if(style.colorMode !== 'fixed'){
        const posAttr = geo.getAttribute('position');
        const colors = new Float32Array(posAttr.count*3);
        for(let k=0;k<posAttr.count;k++){
          const tNorm = k/(posAttr.count-1);
          const [r,g,b] = colorAt(style, tNorm, baseRgb);
          colors[k*3]=r/255; colors[k*3+1]=g/255; colors[k*3+2]=b/255;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
      }
      const mat = new THREE.MeshStandardMaterial({
        color: style.colorMode!=='fixed' ? 0xffffff : rgbToThreeColor(baseRgb),
        vertexColors: style.colorMode!=='fixed',
        roughness:0.45, metalness:0.05,
        transparent: style.opacity<1, opacity: style.opacity,
        wireframe: style.renderStyle==='wireframe'
      });
      group.add(new THREE.Mesh(geo, mat));
      triCount += geo.getIndex() ? geo.getIndex().count/3 : posAttr.count/3;
    });
    return { object: group, triCount };
  }

  // ---------------- point ----------------
  function buildPoint(cls, style, scope){
    const out = evalSafe(cls.compiled, scope);
    if(!finiteXYZ(out)) return { object:new THREE.Group(), triCount:0, error:'Point does not evaluate to 3 real numbers.' };
    const geo = new THREE.SphereGeometry(0.14, 20, 16);
    const mat = new THREE.MeshStandardMaterial({ color: rgbToThreeColor(Utils.hexToRgb(style.color)), roughness:0.35, metalness:0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(out[0],out[1],out[2]);
    mesh.userData.pointCoord = out;
    return { object: mesh, triCount: geo.attributes.position.count/3 };
  }

  // ---------------- vector ----------------
  function buildVector(cls, style, domain, scope){
    const out = evalSafe(cls.compiled, scope);
    if(!finiteXYZ(out)) return { object:new THREE.Group(), triCount:0, error:'Vector does not evaluate to 3 real numbers.' };
    const base = new THREE.Vector3(domain.bx||0, domain.by||0, domain.bz||0);
    const dir = new THREE.Vector3(out[0],out[1],out[2]);
    const len = dir.length() || 0.0001;
    dir.normalize();
    const color = rgbToThreeColor(Utils.hexToRgb(style.color));
    const arrow = new THREE.ArrowHelper(dir, base, len, color, Math.min(0.35, len*0.25), Math.min(0.2, len*0.16));
    arrow.userData.vectorEnd = [base.x+out[0], base.y+out[1], base.z+out[2]];
    return { object: arrow, triCount: 40 };
  }

  // ---------------- vector field ----------------
  function buildVectorField(cls, style, domain, scope){
    const gN = Math.max(2, Math.min(10, Math.round(domain.gridN)));
    const group = new THREE.Group();
    const baseRgb = Utils.hexToRgb(style.color);
    const cellSize = Math.min((domain.xmax-domain.xmin), (domain.ymax-domain.ymin), (domain.zmax-domain.zmin)) / gN;
    const samples = [];
    let maxMag = 1e-6;
    for(let i=0;i<gN;i++){
      const x = domain.xmin + (domain.xmax-domain.xmin)*(i+0.5)/gN;
      for(let j=0;j<gN;j++){
        const y = domain.ymin + (domain.ymax-domain.ymin)*(j+0.5)/gN;
        for(let k=0;k<gN;k++){
          const z = domain.zmin + (domain.zmax-domain.zmin)*(k+0.5)/gN;
          scope.x=x; scope.y=y; scope.z=z;
          const out = evalSafe(cls.compiled, scope);
          if(!finiteXYZ(out)) continue;
          const mag = Math.hypot(out[0],out[1],out[2]);
          if(mag < 1e-9) continue;
          samples.push({x,y,z,vx:out[0],vy:out[1],vz:out[2],mag});
          if(mag>maxMag) maxMag = mag;
        }
      }
    }
    samples.forEach(s=>{
      const dir = new THREE.Vector3(s.vx,s.vy,s.vz).normalize();
      const len = cellSize * 0.85 * (0.35 + 0.65*(s.mag/maxMag));
      let rgb = baseRgb;
      if(style.colorMode!=='fixed') rgb = colorAt(style, s.mag/maxMag, baseRgb);
      const color = rgbToThreeColor(rgb);
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(s.x,s.y,s.z), len, color, len*0.32, len*0.18);
      group.add(arrow);
    });
    return { object: group, triCount: samples.length*40 };
  }

  // ---------------- table (points / path) ----------------
  function buildTable(rows, style, connect){
    const pts = rows.filter(r=>r.ok).map(r=>new THREE.Vector3(r.x,r.y,r.z));
    const group = new THREE.Group();
    const color = rgbToThreeColor(Utils.hexToRgb(style.color));
    if(pts.length===0) return { object: group, triCount:0 };
    if(connect && pts.length>=2){
      const curve = new THREE.CatmullRomCurve3(pts, false);
      const geo = new THREE.TubeGeometry(curve, Math.max(8,pts.length*8), 0.06, 8, false);
      const mat = new THREE.MeshStandardMaterial({ color, roughness:0.5 });
      group.add(new THREE.Mesh(geo,mat));
    }
    const pgeo = new THREE.SphereGeometry(0.11,16,12);
    const pmat = new THREE.MeshStandardMaterial({ color, roughness:0.3 });
    pts.forEach(p=>{
      const m = new THREE.Mesh(pgeo,pmat);
      m.position.copy(p);
      group.add(m);
    });
    return { object: group, triCount: pts.length*pgeo.attributes.position.count/3 };
  }

  // ---------------- implicit surface (async) ----------------
  function buildImplicitAsync(cls, style, domain, scope, callbacks){
    const fieldFn = (x,y,z)=>{ scope.x=x; scope.y=y; scope.z=z; return cls.compiled.evaluate(scope); };
    EngineMarching.computeAsync(fieldFn, {
      xmin:domain.xmin,xmax:domain.xmax,ymin:domain.ymin,ymax:domain.ymax,zmin:domain.zmin,zmax:domain.zmax
    }, domain.resolution, cls.restrictionFn, scope, {
      onProgress: callbacks.onProgress,
      onDone: (tris)=>{
        if(tris.length===0){ callbacks.onDone({ object:new THREE.Group(), triCount:0, empty:true }); return; }
        const positions = new Float32Array(tris.length*3);
        let mn=Infinity, mx=-Infinity;
        for(let i=0;i<tris.length;i++){
          positions[i*3]=tris[i][0]; positions[i*3+1]=tris[i][1]; positions[i*3+2]=tris[i][2];
          if(tris[i][2]<mn) mn=tris[i][2]; if(tris[i][2]>mx) mx=tris[i][2];
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
        if(style.colorMode !== 'fixed'){
          const baseRgb = Utils.hexToRgb(style.color);
          const colors = new Float32Array(positions.length);
          const range = (mx-mn)||1;
          for(let k=0;k<positions.length/3;k++){
            const t = (positions[k*3+2]-mn)/range;
            const [r,g,b] = colorAt(style, t, baseRgb);
            colors[k*3]=r/255; colors[k*3+1]=g/255; colors[k*3+2]=b/255;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
        }
        geo.computeVertexNormals();
        callbacks.onDone({ object: buildGroupWithOptionalWire(geo, style), triCount: tris.length/3 });
      }
    });
  }

  // ---------------- inequality region (async, voxel cloud) ----------------
  function buildInequalityAsync(cls, style, domain, scope, callbacks){
    const res = Math.max(4, Math.min(48, Math.round(domain.resolution)));
    const dx=(domain.xmax-domain.xmin)/res, dy=(domain.ymax-domain.ymin)/res, dz=(domain.zmax-domain.zmin)/res;
    const cellSize = Math.max(dx,dy,dz)*1.02;
    const matrices = [];
    let i=0;
    const budgetMs = 12;
    function step(){
      const t0 = performance.now();
      while(i<res && performance.now()-t0 < budgetMs){
        const x = domain.xmin + (i+0.5)*dx;
        for(let j=0;j<res;j++){
          const y = domain.ymin + (j+0.5)*dy;
          for(let k=0;k<res;k++){
            const z = domain.zmin + (k+0.5)*dz;
            scope.x=x; scope.y=y; scope.z=z;
            let ok = true;
            if(cls.restrictionFn){ try{ ok = !!cls.restrictionFn(scope); }catch(e){ ok=false; } }
            if(ok){
              let v;
              try{ v = cls.compiled.evaluate(scope); }catch(e){ v = 1; }
              if(typeof v==='number' && v<=0) matrices.push([x,y,z]);
            }
          }
        }
        i++;
        if(callbacks.onProgress) callbacks.onProgress(i/res);
      }
      if(i<res) setTimeout(step,0);
      else finish();
    }
    function finish(){
      if(matrices.length===0){ callbacks.onDone({ object:new THREE.Group(), triCount:0, empty:true }); return; }
      const geo = new THREE.BoxGeometry(cellSize*0.92, cellSize*0.92, cellSize*0.92);
      const mat = new THREE.MeshStandardMaterial({
        color: rgbToThreeColor(Utils.hexToRgb(style.color)),
        transparent:true, opacity: Math.min(0.85, Math.max(0.08, style.opacity*0.55)),
        roughness:0.6, depthWrite:false, side:THREE.DoubleSide
      });
      const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
      const m4 = new THREE.Matrix4();
      matrices.forEach((p,idx)=>{ m4.makeTranslation(p[0],p[1],p[2]); inst.setMatrixAt(idx,m4); });
      inst.instanceMatrix.needsUpdate = true;
      callbacks.onDone({ object: inst, triCount: matrices.length*12 });
    }
    setTimeout(step,0);
  }

  return {
    defaultDomain, buildExplicit, buildSpherical, buildCylindrical, buildParamSurface,
    buildCurve, buildPoint, buildVector, buildVectorField, buildTable,
    buildImplicitAsync, buildInequalityAsync, evalSafe, finiteXYZ
  };
})();
