// =====================================================================
// ENGINE / MARCHING TETRAHEDRA — robust implicit-surface triangulation
// (Cube -> 6 tetrahedra decomposition; each tet resolved analytically —
//  no giant case tables needed, so correctness doesn't depend on a
//  256-entry lookup table being transcribed perfectly.)
// =====================================================================
const EngineMarching = (() => {
  const CORNER_OFFSETS = [
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ];
  const TETS = [
    [0,5,1,6],[0,1,2,6],[0,2,3,6],
    [0,3,7,6],[0,7,4,6],[0,4,5,6]
  ];

  function interpEdge(p1,val1,p2,val2){
    let t = 0.5;
    const denom = (val2-val1);
    if(Math.abs(denom) > 1e-12) t = (0-val1)/denom;
    t = Math.max(0,Math.min(1,t));
    return [
      p1[0]+(p2[0]-p1[0])*t,
      p1[1]+(p2[1]-p1[1])*t,
      p1[2]+(p2[2]-p1[2])*t
    ];
  }

  function triangulateTet(pos, val, out){
    const inside = [val[0]<0, val[1]<0, val[2]<0, val[3]<0];
    const count = inside[0]+inside[1]+inside[2]+inside[3];
    if(count===0 || count===4) return;
    if(count===1 || count===3){
      const want = count===1;
      let lone = -1;
      for(let i=0;i<4;i++) if(inside[i]===want){ lone=i; break; }
      const others = [0,1,2,3].filter(i=>i!==lone);
      const p0 = interpEdge(pos[lone],val[lone],pos[others[0]],val[others[0]]);
      const p1 = interpEdge(pos[lone],val[lone],pos[others[1]],val[others[1]]);
      const p2 = interpEdge(pos[lone],val[lone],pos[others[2]],val[others[2]]);
      out.push(p0,p1,p2);
      return;
    }
    // count === 2
    const ins = [0,1,2,3].filter(i=>inside[i]);
    const outs = [0,1,2,3].filter(i=>!inside[i]);
    const a=ins[0], b=ins[1], c=outs[0], d=outs[1];
    const P_ac = interpEdge(pos[a],val[a],pos[c],val[c]);
    const P_ad = interpEdge(pos[a],val[a],pos[d],val[d]);
    const P_bd = interpEdge(pos[b],val[b],pos[d],val[d]);
    const P_bc = interpEdge(pos[b],val[b],pos[c],val[c]);
    out.push(P_ac,P_ad,P_bd,  P_ac,P_bd,P_bc);
  }

  // Async, chunked (z-slab at a time) implicit surface extraction.
  // fieldFn(x,y,z) -> number.  bounds = {xmin,xmax,ymin,ymax,zmin,zmax}. res = cells per axis.
  // restrictionFn(scope)->bool may be null.
  function computeAsync(fieldFn, bounds, res, restrictionFn, scope, callbacks){
    res = Math.max(4, Math.min(72, Math.round(res)));
    const {xmin,xmax,ymin,ymax,zmin,zmax} = bounds;
    const dx=(xmax-xmin)/res, dy=(ymax-ymin)/res, dz=(zmax-zmin)/res;
    const nx=res+1, ny=res+1;

    function sampleLayer(kz){
      const layer = new Float32Array(nx*ny);
      const zz = zmin + kz*dz;
      for(let i=0;i<nx;i++){
        const xx = xmin+i*dx;
        for(let j=0;j<ny;j++){
          const yy = ymin+j*dy;
          let v;
          if(restrictionFn){
            scope.x=xx; scope.y=yy; scope.z=zz;
            if(!restrictionFn(scope)){ layer[i*ny+j] = Number.NaN; continue; }
          }
          try{ v = fieldFn(xx,yy,zz); }catch(e){ v = Number.NaN; }
          layer[i*ny+j] = (typeof v === 'number' && isFinite(v)) ? v : Number.NaN;
        }
      }
      return layer;
    }

    const triOut = [];
    let kz = 0;
    let layerLo = sampleLayer(0);
    let cancelled = false;
    const budgetMs = 12;

    function cellCorners(i,j,k,layerLo,layerHi){
      const pos = new Array(8), val = new Array(8);
      for(let c=0;c<8;c++){
        const [ox,oy,oz] = CORNER_OFFSETS[c];
        const ii=i+ox, jj=j+oy;
        const layer = oz===0 ? layerLo : layerHi;
        const v = layer[ii*ny+jj];
        pos[c] = [xmin+ii*dx, ymin+jj*dy, zmin+(k+oz)*dz];
        val[c] = v;
      }
      return {pos,val};
    }

    function step(){
      if(cancelled) return;
      const t0 = performance.now();
      while(kz < res && performance.now()-t0 < budgetMs){
        const layerHi = sampleLayer(kz+1);
        for(let i=0;i<res;i++){
          for(let j=0;j<res;j++){
            const {pos,val} = cellCorners(i,j,kz,layerLo,layerHi);
            let bad=false;
            for(let c=0;c<8;c++) if(Number.isNaN(val[c])){ bad=true; break; }
            if(bad) continue;
            // skip cells fully outside field range quickly
            let mn=val[0],mx=val[0];
            for(let c=1;c<8;c++){ if(val[c]<mn)mn=val[c]; if(val[c]>mx)mx=val[c]; }
            if(mn>0 || mx<0) continue;
            for(let t=0;t<TETS.length;t++){
              const idx = TETS[t];
              triangulateTet(
                [pos[idx[0]],pos[idx[1]],pos[idx[2]],pos[idx[3]]],
                [val[idx[0]],val[idx[1]],val[idx[2]],val[idx[3]]],
                triOut
              );
            }
          }
        }
        layerLo = layerHi;
        kz++;
        if(callbacks.onProgress) callbacks.onProgress(kz/res);
      }
      if(kz < res){
        setTimeout(step, 0);
      } else {
        callbacks.onDone(triOut);
      }
    }
    setTimeout(step,0);
    return { cancel(){ cancelled = true; } };
  }

  return { computeAsync };
})();
