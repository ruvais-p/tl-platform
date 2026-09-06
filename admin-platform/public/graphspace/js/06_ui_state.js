// =====================================================================
// UI / STATE — the expression list model, scope building & recompute
// =====================================================================
const State = (() => {
  let rows = []; // flat list, order = display order. folders are rows with kind='folder'
  let autoSliders = new Map(); // name -> {value,min,max,step,animating,dir,loop}
  let listeners = { structure: [], status: [], scope: [], progress: [], slidertick: [] };
  let genCounters = new Map(); // rowId -> generation token (cancel stale async builds)
  let lastAnimT = performance.now();

  function on(evt, fn){ listeners[evt].push(fn); }
  function emit(evt, arg){ listeners[evt].forEach(fn=>fn(arg)); }

  function newRow(kind, extra){
    const base = {
      id: Utils.uid('row'), kind, folderId: null,
    };
    if(kind==='expr'){
      Object.assign(base, {
        text: '', style: { color: Utils.nextColor(), opacity:0.92, renderStyle:'solid', colorMode:'fixed' },
        domain: null, visible:true, gearOpen:false, cls:{type:'empty'}, triCount:0, lastError:null,
        sliderMeta: null, // for assignment-type inline slider: {min,max,step,animating,dir,loop}
      });
    } else if(kind==='folder'){
      Object.assign(base, { name: extra&&extra.name || 'Folder', collapsed:false });
    } else if(kind==='table'){
      Object.assign(base, {
        name: extra&&extra.name || 'Table', visible:true,
        style:{ color:Utils.nextColor(), opacity:0.95 }, connect:false,
        data: [ {x:'0',y:'0',z:'0'}, {x:'1',y:'1',z:'1'} ],
      });
    } else if(kind==='note'){
      Object.assign(base, { text: extra&&extra.text || '' });
    }
    return Object.assign(base, extra&&extra.overrides||{});
  }

  function addRow(kind, opts){
    opts = opts||{};
    const r = newRow(kind, opts);
    if(opts.afterId){
      const idx = rows.findIndex(x=>x.id===opts.afterId);
      rows.splice(idx+1,0,r);
    } else rows.push(r);
    emit('structure');
    recomputeAll();
    return r;
  }
  function removeRow(id){
    const r = getRow(id);
    if(r && r.kind==='folder'){
      rows.filter(x=>x.folderId===id).forEach(child=>child.folderId=null);
    }
    rows = rows.filter(x=>x.id!==id);
    EngineRenderer.clearRow(id);
    emit('structure');
    recomputeAll();
  }
  function clearAll(){
    rows.forEach(r=>EngineRenderer.clearRow(r.id));
    rows = []; autoSliders.clear();
    emit('structure'); emit('scope');
    recomputeAll();
  }
  function getRow(id){ return rows.find(r=>r.id===id); }
  function getRows(){ return rows; }
  function getAutoSliders(){ return autoSliders; }

  function moveRow(id, dir){
    const idx = rows.findIndex(r=>r.id===id);
    if(idx<0) return;
    const swapWith = dir<0 ? idx-1 : idx+1;
    if(swapWith<0 || swapWith>=rows.length) return;
    [rows[idx], rows[swapWith]] = [rows[swapWith], rows[idx]];
    emit('structure');
  }

  function setRowText(id, text){
    const r = getRow(id); if(!r) return;
    r.text = text;
    classifyRow(r);
    scheduleRecompute();
  }

  const knownFuncNames = ()=> new Set(rows.filter(r=>r.kind==='expr' && r.cls && r.cls.type==='funcdef').map(r=>r.cls.name));

  function classifyRow(r){
    if(r.kind!=='expr') return;
    const prevType = r.cls ? r.cls.type : null;
    r.cls = EngineMath.classify(r.text, { knownFunctions: knownFuncNames() });
    r.lastError = r.cls.type==='error' ? r.cls.error : null;
    if(r.cls.type !== prevType){
      r.domain = EngineGeometry.defaultDomain(r.cls);
    } else if(!r.domain){
      r.domain = EngineGeometry.defaultDomain(r.cls);
    }
    if(r.cls.type==='assignment'){
      const isPlainNumber = r.cls.node.type==='ConstantNode' ||
        (r.cls.node.type==='OperatorNode' && r.cls.node.op==='unaryMinus' && r.cls.node.args[0].type==='ConstantNode');
      if(isPlainNumber){
        if(!r.sliderMeta) r.sliderMeta = { min:-10, max:10, step:0.1, animating:false, dir:1, loop:true };
      } else r.sliderMeta = null;
    } else r.sliderMeta = null;
  }

  const scheduleRecompute = Utils.debounce(()=>recomputeAll(), 90);

  function collectReferencedFreeVars(){
    const set = new Set();
    rows.forEach(r=>{
      if(r.kind==='expr' && r.cls && r.cls.freeVars) r.cls.freeVars.forEach(v=>set.add(v));
    });
    return set;
  }
  function assignmentNames(){
    const set = new Set();
    rows.forEach(r=>{ if(r.kind==='expr' && r.cls && r.cls.type==='assignment') set.add(r.cls.name); });
    return set;
  }

  function syncAutoSliders(){
    const referenced = collectReferencedFreeVars();
    const assigned = assignmentNames();
    const needed = new Set([...referenced].filter(n=>!assigned.has(n)));
    for(const name of needed){
      if(!autoSliders.has(name)) autoSliders.set(name, { value:1, min:-10, max:10, step:0.1, animating:false, dir:1, loop:true });
    }
    for(const name of [...autoSliders.keys()]){
      if(!needed.has(name)) autoSliders.delete(name);
    }
    return needed;
  }

  function buildBaseScope(){
    const scope = {};
    autoSliders.forEach((s,name)=>{ scope[name]=s.value; });
    const assignRows = rows.filter(r=>r.kind==='expr' && r.cls && r.cls.type==='assignment');
    const items = assignRows.map(r=>({ name:r.cls.name, freeVars:r.cls.freeVars, compiled:r.cls.compiled, row:r }));
    const { order, cycle } = EngineMath.orderAssignments(items);
    order.forEach(item=>{
      if(cycle.has(item.name)){ item.row.lastError='Circular reference among variables.'; scope[item.name]=NaN; return; }
      try{
        const v = item.compiled.evaluate(Object.assign({}, scope));
        scope[item.name] = v;
        item.row.lastError = null;
        item.row.computedValue = v;
        if(item.row.sliderMeta && typeof v === 'number' && !item.row.sliderMeta._userSet) autoAdjustSliderRange(item.row, v);
      }catch(e){ item.row.lastError = EngineMath.shortErr(e); scope[item.name]=NaN; }
    });
    const funcRows = rows.filter(r=>r.kind==='expr' && r.cls && r.cls.type==='funcdef');
    funcRows.forEach(r=>{
      scope[r.cls.name] = (...args)=>{
        const s = Object.assign({}, scope);
        r.cls.argNames.forEach((an,i)=>{ s[an]=args[i]; });
        return r.cls.compiled.evaluate(s);
      };
    });
    return scope;
  }
  function autoAdjustSliderRange(row, v){
    const m = row.sliderMeta;
    if(v < m.min || v > m.max){
      const span = Math.max(Math.abs(v)*2, 10);
      m.min = -span; m.max = span;
    }
  }

  function nextGen(id){
    const g = (genCounters.get(id)||0)+1;
    genCounters.set(id, g);
    return g;
  }

  function recomputeAll(){
    rows.forEach(r=>{ if(r.kind==='expr') classifyRow(r); });
    syncAutoSliders();
    const baseScope = buildBaseScope();
    emit('scope');

    rows.forEach(r=>{
      if(r.kind==='table'){
        computeTableRow(r);
        emit('status', r.id);
        return;
      }
      if(r.kind!=='expr'){ return; }
      const cls = r.cls;
      if(!cls || ['empty','error','assignment','funcdef','note','scalar'].includes(cls.type)){
        EngineRenderer.clearRow(r.id);
        if(cls && cls.type==='scalar'){
          try{ r.computedValue = cls.compiled.evaluate(Object.assign({},baseScope)); r.lastError=null; }
          catch(e){ r.lastError = EngineMath.shortErr(e); }
        }
        emit('status', r.id);
        return;
      }
      if(!r.visible){ EngineRenderer.clearRow(r.id); r._lastSig=null; emit('status', r.id); return; }

      // Skip rebuilding geometry that hasn't actually changed (text/style/domain,
      // and only the scope values this specific expression depends on) — this is
      // what keeps editing one expression from re-triggering every implicit-surface
      // marching-tetrahedra pass in the whole graph.
      const sig = signatureFor(r, cls, baseScope);
      if(sig === r._lastSig && !r._forceRebuild) { emit('status', r.id); return; }
      r._lastSig = sig; r._forceRebuild = false;

      const myGen = nextGen(r.id);
      const scope = Object.assign({}, baseScope);
      try{
        buildGeometryForRow(r, scope, myGen);
      }catch(e){
        r.lastError = EngineMath.shortErr(e);
        emit('status', r.id);
      }
    });
  }

  function signatureFor(r, cls, baseScope){
    const vals = {};
    if(cls.freeVars) cls.freeVars.forEach(v=>{ vals[v] = baseScope[v]; });
    // also depend on every assignment value transitively (cheap upper bound: whole baseScope
    // for names that are plain numbers) — freeVars already covers direct references.
    return JSON.stringify({ t:r.text, s:r.style, d:r.domain, v:vals });
  }

  function buildGeometryForRow(r, scope, myGen){
    const cls = r.cls, style = r.style, domain = r.domain;
    const finish = (result)=>{
      if(genCounters.get(r.id) !== myGen) return; // stale
      if(result.error){ r.lastError = result.error; EngineRenderer.clearRow(r.id); }
      else { r.lastError = null; r.triCount = result.triCount||0; EngineRenderer.setRowObject(r.id, result.object, labelFor(r)); attachSamplePoints(r, result); }
      emit('status', r.id);
    };
    switch(cls.type){
      case 'explicit': return finish(EngineGeometry.buildExplicit(cls, style, domain, scope));
      case 'spherical': return finish(EngineGeometry.buildSpherical(cls, style, domain, scope));
      case 'cylindrical': return finish(EngineGeometry.buildCylindrical(cls, style, domain, scope));
      case 'surface_param': return finish(EngineGeometry.buildParamSurface(cls, style, domain, scope));
      case 'curve': { const res = EngineGeometry.buildCurve(cls, style, domain, scope); r._curveSamplePts = collectCurveSamples(res); return finish(res); }
      case 'point': return finish(EngineGeometry.buildPoint(cls, style, scope));
      case 'vector': return finish(EngineGeometry.buildVector(cls, style, domain, scope));
      case 'vectorfield': return finish(EngineGeometry.buildVectorField(cls, style, domain, scope));
      case 'implicit':
        emit('progress', { id:r.id, active:true, pct:0 });
        EngineGeometry.buildImplicitAsync(cls, style, domain, scope, {
          onProgress:(p)=>emit('progress', {id:r.id, active:true, pct:p}),
          onDone:(result)=>{ emit('progress', {id:r.id, active:false}); finish(result); }
        });
        return;
      case 'inequality':
        emit('progress', { id:r.id, active:true, pct:0 });
        EngineGeometry.buildInequalityAsync(cls, style, domain, scope, {
          onProgress:(p)=>emit('progress', {id:r.id, active:true, pct:p}),
          onDone:(result)=>{ emit('progress', {id:r.id, active:false}); finish(result); }
        });
        return;
    }
  }
  function collectCurveSamples(res){ return null; }
  function attachSamplePoints(r, result){ /* curves already build tube; sample snap uses raycast point directly */ }

  function labelFor(r){ return r.text.length>28 ? r.text.slice(0,28)+'…' : r.text; }

  function computeTableRow(r){
    const out = [];
    r.data.forEach(cell=>{
      let ok=true, x=0,y=0,z=0;
      try{ x = math.evaluate(String(cell.x)); }catch(e){ ok=false; }
      try{ y = math.evaluate(String(cell.y)); }catch(e){ ok=false; }
      try{ z = math.evaluate(String(cell.z)); }catch(e){ ok=false; }
      if(typeof x!=='number'||typeof y!=='number'||typeof z!=='number'||!isFinite(x)||!isFinite(y)||!isFinite(z)) ok=false;
      out.push({x,y,z,ok});
    });
    if(!r.visible){ EngineRenderer.clearRow(r.id); return; }
    const result = EngineGeometry.buildTable(out, r.style, r.connect);
    EngineRenderer.setRowObject(r.id, result.object, r.name);
    r.triCount = result.triCount;
  }

  // ---------------- slider animation loop ----------------
  function tickAnimation(){
    const now = performance.now();
    if(now-lastAnimT < 32) return;
    const dt = (now-lastAnimT)/1000; lastAnimT = now;
    let changed = false;
    autoSliders.forEach(s=>{
      if(s.animating){
        s.value += s.dir * (s.max-s.min) * 0.28 * dt;
        if(s.value>s.max){ s.value=s.max; if(s.loop) s.dir=-1; else s.animating=false; }
        if(s.value<s.min){ s.value=s.min; if(s.loop) s.dir=1; else s.animating=false; }
        changed = true;
      }
    });
    rows.forEach(r=>{
      if(r.kind==='expr' && r.sliderMeta && r.sliderMeta.animating && r.cls.type==='assignment'){
        // reflect back into text so classify picks up new constant next pass
        const m = r.sliderMeta;
        let v = (r.computedValue===undefined?0:r.computedValue) + m.dir*(m.max-m.min)*0.28*dt;
        if(v>m.max){ v=m.max; if(m.loop) m.dir=-1; else m.animating=false; }
        if(v<m.min){ v=m.min; if(m.loop) m.dir=1; else m.animating=false; }
        setAssignmentValue(r, v);
        changed = true;
      }
    });
    if(changed){ recomputeAll(); emit('slidertick'); }
  }
  function setAssignmentValue(r, v){
    const eqIdx = r.text.indexOf('=');
    const name = r.text.slice(0,eqIdx).trim();
    r.text = name + ' = ' + Utils.fmtNum(v,5);
    r.computedValue = v;
    classifyRow(r);
  }
  function setAutoSliderValue(name, v){
    const s = autoSliders.get(name); if(!s) return;
    s.value = Utils.clamp(v, s.min, s.max);
    scheduleRecompute();
  }

  return {
    on, addRow, removeRow, clearAll, getRow, getRows, getAutoSliders, moveRow,
    setRowText, classifyRow, recomputeAll, scheduleRecompute, tickAnimation,
    setAssignmentValue, setAutoSliderValue, knownFuncNames
  };
})();
