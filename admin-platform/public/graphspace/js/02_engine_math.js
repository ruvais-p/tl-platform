// =====================================================================
// ENGINE / MATH — parsing, classification, symbolic derivatives, scope
// =====================================================================
const EngineMath = (() => {
  const PLOT_VARS = ['x','y','z','t','u','v','r','theta','phi'];
  const PLOT_VAR_SET = new Set(PLOT_VARS);
  let BUILTIN_NAMES = new Set(PLOT_VARS);
  try{ Object.keys(math).forEach(k=>BUILTIN_NAMES.add(k)); }catch(e){}

  // ---- symbol collection (skips function-name identifiers) ----
  function collectSymbols(node, set){
    if(!node) return;
    if(node.type === 'FunctionNode'){
      (node.args||[]).forEach(a=>collectSymbols(a,set));
      return;
    }
    if(node.type === 'SymbolNode'){ set.add(node.name); return; }
    if(typeof node.forEach === 'function'){
      node.forEach(child=>collectSymbols(child,set));
    }
  }
  function freeSymbols(node){ const s = new Set(); collectSymbols(node,s); return s; }
  function isSubset(a,b){ for(const x of a) if(!b.has(x)) return false; return true; }
  function hasAny(a,list){ return list.some(x=>a.has(x)); }
  // true if `syms` contains none of the *other* reserved plot variables besides `allowed`
  // (extra free/slider variables are always fine)
  function onlyPlotVars(syms, allowed){
    for(const s of syms){ if(PLOT_VAR_SET.has(s) && !allowed.has(s)) return false; }
    return true;
  }
  // "(a,b,c)" (a single wrapping parenthesis with top-level commas) -> "[a,b,c]"
  // so users can write point/vector/curve tuples with either bracket style.
  function tupleParensToBracket(s){
    s = s.trim();
    if(s[0] !== '(') return s;
    let depth = 0, commaAtTop = false;
    for(let i=0;i<s.length;i++){
      const c = s[i];
      if(c==='(') depth++;
      else if(c===')'){ depth--; if(depth===0 && i!==s.length-1) return s; }
      else if(c===',' && depth===1) commaAtTop = true;
    }
    if(depth===0 && s[s.length-1]===')' && commaAtTop) return '['+s.slice(1,-1)+']';
    return s;
  }

  // ---- bracket-depth-aware top-level scanning ----
  function topLevelSplitEquation(text){
    let depth=0;
    for(let i=0;i<text.length;i++){
      const c = text[i];
      if('([{'.includes(c)) depth++;
      else if(')]}'.includes(c)) depth--;
      else if(c==='=' && depth===0){
        const prev = text[i-1], next = text[i+1];
        if(prev==='<'||prev==='>'||prev==='!'||prev==='=') continue;
        if(next==='=') continue;
        return { left: text.slice(0,i).trim(), right: text.slice(i+1).trim() };
      }
    }
    return null;
  }
  function topLevelSplitInequality(text){
    let depth=0;
    for(let i=0;i<text.length;i++){
      const c = text[i];
      if('([{'.includes(c)) depth++;
      else if(')]}'.includes(c)) depth--;
      else if((c==='<'||c==='>') && depth===0){
        let op = c;
        let end = i+1;
        if(text[i+1]==='='){ op += '='; end = i+2; }
        return { left:text.slice(0,i).trim(), op, right:text.slice(end).trim() };
      }
    }
    return null;
  }
  function stripDomainRestriction(text){
    text = text.trim();
    if(text.endsWith('}')){
      let depth=0;
      for(let i=text.length-1;i>=0;i--){
        const c = text[i];
        if(c==='}') depth++;
        else if(c==='{'){ depth--; if(depth===0){
          return { main: text.slice(0,i).trim(), restriction: text.slice(i+1,text.length-1).trim() };
        }}
      }
    }
    return { main:text, restriction:null };
  }

  function safeParse(str){
    return math.parse(str);
  }

  // Build a JS predicate function(scope)->boolean from a restriction string (e.g. "x^2+y^2<4")
  function compileRestriction(str){
    if(!str) return null;
    const eq = topLevelSplitInequality(str);
    if(eq){
      const l = safeParse(eq.left).compile(), r = safeParse(eq.right).compile();
      const op = eq.op;
      return (scope)=>{
        const a = l.evaluate(scope), b = r.evaluate(scope);
        if(typeof a !== 'number' || typeof b !== 'number') return true;
        switch(op){ case '<': return a<b; case '<=': return a<=b; case '>': return a>b; case '>=': return a>=b; }
        return true;
      };
    }
    // also allow != / == restrictions loosely
    const compiled = safeParse(str).compile();
    return (scope)=>{ const v = compiled.evaluate(scope); return !!v; };
  }

  // ---- classify a single row's raw text ----
  // returns {type, error, ...typeSpecificFields, freeVars:Set}
  function classify(rawText, opts){
    opts = opts || {};
    const knownFns = opts.knownFunctions || new Set(); // user-defined function names available
    const text0 = rawText.trim();
    if(!text0) return { type:'empty' };

    let { main, restriction } = stripDomainRestriction(text0);
    main = tupleParensToBracket(main);
    let restrictionFn = null;
    try{ restrictionFn = compileRestriction(restriction); }
    catch(e){ return { type:'error', error:'Domain restriction error: '+shortErr(e) }; }

    // ---- 1. equation (contains a top-level =) ----
    const eqParts = topLevelSplitEquation(main);
    if(eqParts){
      let leftNode, rightNode;
      try{ leftNode = safeParse(eqParts.left); rightNode = safeParse(eqParts.right); }
      catch(e){ return { type:'error', error: shortErr(e) }; }

      // function definition:  f(x,y) = expr
      if(leftNode.type === 'FunctionNode' && leftNode.args.every(a=>a.type==='SymbolNode')){
        const fname = leftNode.fn.name;
        const argNames = leftNode.args.map(a=>a.name);
        let compiledRHS;
        try{ compiledRHS = rightNode.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
        return {
          type:'funcdef', name:fname, argNames, node:rightNode, compiled:compiledRHS,
          freeVars: setDiff(freeSymbols(rightNode), new Set(argNames)),
          restrictionFn
        };
      }

      const rightSyms = freeSymbols(rightNode);
      const leftSyms = freeSymbols(leftNode);

      if(leftNode.type === 'SymbolNode' && PLOT_VAR_SET.has(leftNode.name) && !rightSyms.has(leftNode.name)){
        const lname = leftNode.name;
        let compiled;
        try{ compiled = rightNode.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
        const freeVars = collectFreeVarsForPlot(rightSyms, knownFns);

        if(lname==='z' && onlyPlotVars(rightSyms, new Set(['x','y'])) ) {
          return { type:'explicit', axis:'z', of:['x','y'], compiled, node:rightNode, freeVars, restrictionFn };
        }
        if(lname==='y' && onlyPlotVars(rightSyms, new Set(['x','z'])) ) {
          return { type:'explicit', axis:'y', of:['x','z'], compiled, node:rightNode, freeVars, restrictionFn };
        }
        if(lname==='x' && onlyPlotVars(rightSyms, new Set(['y','z'])) ) {
          return { type:'explicit', axis:'x', of:['y','z'], compiled, node:rightNode, freeVars, restrictionFn };
        }
        if(lname==='z' && onlyPlotVars(rightSyms, new Set(['r','theta'])) ){
          return { type:'cylindrical', mode:'z_of_rtheta', compiled, node:rightNode, freeVars, restrictionFn };
        }
        if(lname==='r' && onlyPlotVars(rightSyms, new Set(['z','theta'])) ){
          return { type:'cylindrical', mode:'r_of_ztheta', compiled, node:rightNode, freeVars, restrictionFn };
        }
        if(lname==='r' && onlyPlotVars(rightSyms, new Set(['theta','phi'])) ){
          return { type:'spherical', compiled, node:rightNode, freeVars, restrictionFn };
        }
        // plain slider/constant assignment, e.g. "a = 5" caught below since lname might not be x/y/z/r anyway
      }

      if(leftNode.type === 'SymbolNode' && !PLOT_VAR_SET.has(leftNode.name)){
        // constant / list assignment:  a = 5   or   a = [1,2,3]
        let compiled;
        try{ compiled = rightNode.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
        return {
          type:'assignment', name:leftNode.name, node:rightNode, compiled,
          freeVars: collectFreeVarsForPlot(rightSyms, knownFns),
          restrictionFn
        };
      }

      // fallback: general equation -> implicit surface  f(x,y,z)=0
      let diffNode;
      try{ diffNode = safeParse('('+eqParts.left+')-('+eqParts.right+')'); }
      catch(e){ return { type:'error', error: shortErr(e) }; }
      const allSyms = freeSymbols(diffNode);
      let compiled;
      try{ compiled = diffNode.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
      if(hasAny(allSyms, ['x','y','z'])){
        return { type:'implicit', compiled, node:diffNode, freeVars: collectFreeVarsForPlot(allSyms, knownFns), restrictionFn };
      }
      return { type:'error', error:'Equation must relate x, y and/or z, or start with a single variable like z=…' };
    }

    // ---- 2. inequality ----
    const ineq = topLevelSplitInequality(main);
    if(ineq){
      let leftNode, rightNode;
      try{ leftNode = safeParse(ineq.left); rightNode = safeParse(ineq.right); }
      catch(e){ return { type:'error', error: shortErr(e) }; }
      // normalize: field <= 0 means "inside" (flip sign per operator)
      let exprStr;
      if(ineq.op==='<' || ineq.op==='<=') exprStr = '('+ineq.left+')-('+ineq.right+')';
      else exprStr = '('+ineq.right+')-('+ineq.left+')';
      let diffNode;
      try{ diffNode = safeParse(exprStr); }catch(e){ return {type:'error', error:shortErr(e)}; }
      const allSyms = freeSymbols(diffNode);
      let compiled;
      try{ compiled = diffNode.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
      if(hasAny(allSyms, ['x','y','z'])){
        return { type:'inequality', compiled, node:diffNode, strict: ineq.op.length===1,
          freeVars: collectFreeVarsForPlot(allSyms, knownFns), restrictionFn };
      }
      return { type:'error', error:'Inequality must involve x, y and/or z.' };
    }

    // ---- 3. plain expression (no = or comparison at top level) ----
    let node;
    try{ node = safeParse(main); }
    catch(e){ return { type:'error', error: shortErr(e) }; }

    if(node.type === 'ArrayNode' && node.items.length === 3){
      const syms = freeSymbols(node);
      let compiled;
      try{ compiled = node.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
      const freeVars = collectFreeVarsForPlot(syms, knownFns);
      if(syms.has('t') && !syms.has('u') && !syms.has('v')){
        return { type:'curve', compiled, node, freeVars, restrictionFn };
      }
      if((syms.has('u') || syms.has('v'))){
        return { type:'surface_param', compiled, node, freeVars, restrictionFn };
      }
      if(hasAny(syms, ['x','y','z'])){
        return { type:'vectorfield', compiled, node, freeVars, restrictionFn };
      }
      return { type:'point', compiled, node, freeVars, restrictionFn };
    }

    if(node.type === 'FunctionNode' && (node.fn.name==='vector' || node.fn.name==='vec')){
      let compiled;
      const argsNode = { type:'ArrayNode', items:node.args, compile: ()=>({evaluate:(scope)=>node.args.map(a=>a.compile().evaluate(scope))}) };
      try{
        const compiledArgs = node.args.map(a=>a.compile());
        compiled = { evaluate:(scope)=> compiledArgs.map(c=>c.evaluate(scope)) };
      }catch(e){ return {type:'error', error:shortErr(e)}; }
      const syms = freeSymbols(node);
      return { type:'vector', compiled, node, freeVars: collectFreeVarsForPlot(syms, knownFns), restrictionFn };
    }

    if(node.type === 'FunctionNode' && node.fn.name==='grad' && node.args.length===1){
      const inner = node.args[0];
      const innerSyms = freeSymbols(inner);
      const vars = ['x','y','z'].filter(v=>innerSyms.has(v));
      if(vars.length===0) return { type:'error', error:'grad(...) needs x, y or z inside.' };
      let derivs;
      try{ derivs = vars.map(v=>math.derivative(inner, v).compile()); }
      catch(e){ return { type:'error', error:'Could not differentiate: '+shortErr(e) }; }
      const compiled = { evaluate:(scope)=>{
        const out=[0,0,0];
        vars.forEach((v,i)=>{ const idx = {x:0,y:1,z:2}[v]; out[idx] = derivs[i].evaluate(scope); });
        return out;
      }};
      return { type:'vectorfield', compiled, node, freeVars: collectFreeVarsForPlot(innerSyms, knownFns), restrictionFn, isGradient:true };
    }

    // bare scalar / calculator line
    {
      const syms = freeSymbols(node);
      let compiled;
      try{ compiled = node.compile(); }catch(e){ return {type:'error', error:shortErr(e)}; }
      const freeVars = collectFreeVarsForPlot(syms, knownFns);
      if(freeVars.size===0 && !hasAny(syms,['x','y','z','t','u','v','r','theta','phi'])){
        return { type:'scalar', compiled, node, freeVars, restrictionFn };
      }
      return { type:'error', error:'Could not classify this expression as a surface, curve, point or region. See Help for syntax.' };
    }
  }

  function setDiff(a,b){ const out = new Set(); for(const x of a) if(!b.has(x)) out.add(x); return out; }

  function collectFreeVarsForPlot(symSet, knownFns){
    const out = new Set();
    symSet.forEach(s=>{
      if(PLOT_VAR_SET.has(s)) return;
      if(BUILTIN_NAMES.has(s)) return;
      if(knownFns && knownFns.has(s)) return;
      out.add(s);
    });
    return out;
  }

  function shortErr(e){
    let m = (e && e.message) ? e.message : String(e);
    m = m.replace(/\s*\(char \d+\)/,'');
    return m.length>110 ? m.slice(0,110)+'…' : m;
  }

  // topological sort of assignment rows by dependency on each other
  function orderAssignments(list){
    // list: [{name, freeVars:Set}]
    const names = new Set(list.map(l=>l.name));
    const visited = new Set(), temp = new Set(), order = [], cycle = new Set();
    const byName = {}; list.forEach(l=>byName[l.name]=l);
    function visit(n){
      if(visited.has(n)) return;
      if(temp.has(n)){ cycle.add(n); return; }
      temp.add(n);
      const item = byName[n];
      if(item){
        item.freeVars.forEach(dep=>{ if(names.has(dep)) visit(dep); });
      }
      temp.delete(n); visited.add(n); order.push(n);
    }
    list.forEach(l=>visit(l.name));
    return { order: order.filter(n=>byName[n]).map(n=>byName[n]), cycle };
  }

  return {
    PLOT_VARS, PLOT_VAR_SET, BUILTIN_NAMES,
    classify, freeSymbols, collectSymbols, orderAssignments, shortErr,
    topLevelSplitEquation, topLevelSplitInequality
  };
})();
