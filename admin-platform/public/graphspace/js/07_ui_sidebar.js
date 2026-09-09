// =====================================================================
// UI / SIDEBAR — DOM rendering + interaction for the expression list
// =====================================================================
const Sidebar = (() => {
  let listEl, autoSliderNamesRendered = [];
  let activeColorRow = null;

  const TYPE_LABELS = {
    empty:'', error:'ERROR', explicit:'SURFACE z=f(x,y)', spherical:'SPHERICAL r=f(θ,φ)',
    cylindrical:'CYLINDRICAL', curve:'SPACE CURVE', surface_param:'PARAMETRIC SURFACE',
    point:'POINT', vector:'VECTOR', vectorfield:'VECTOR FIELD', implicit:'IMPLICIT SURFACE',
    inequality:'REGION', assignment:'VARIABLE', funcdef:'FUNCTION', scalar:'VALUE'
  };

  function init(){
    listEl = document.getElementById('expr-list');
    attachEvents();
    State.on('structure', render);
    State.on('status', refreshRow);
    State.on('scope', updateAutoSliderBlock);
    State.on('progress', onProgress);
    render();
  }

  function el(tag, cls, attrs){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(attrs) for(const k in attrs){ if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
    return e;
  }

  function render(){
    const rows = State.getRows();
    listEl.innerHTML = '';
    const sliderBlock = el('div',''); sliderBlock.id='auto-sliders-block';
    listEl.appendChild(sliderBlock);
    autoSliderNamesRendered = [];
    updateAutoSliderBlock();

    const top = rows.filter(r=>!r.folderId);
    top.forEach(r=>{
      if(r.kind==='folder'){
        listEl.appendChild(renderFolder(r, rows.filter(c=>c.folderId===r.id)));
      } else {
        listEl.appendChild(renderRow(r));
      }
    });
    if(top.length===0){
      const empty = el('div','', {html:'<div style="padding:30px 20px;text-align:center;color:var(--text-faint);font-size:12px;line-height:1.6">No expressions yet.<br>Click <b>Expr</b> above or load the example gallery to get started.</div>'});
      listEl.appendChild(empty);
    }
    requestAnimationFrame(()=>{
      listEl.querySelectorAll('.expr-input, textarea[data-action="note-text"]').forEach(autogrow);
    });
  }

  function renderFolder(folder, children){
    const wrap = el('div','');
    const header = el('div', 'folder-header'+(folder.collapsed?' collapsed':''), { 'data-row-id':folder.id, 'data-action':'toggle-folder' });
    header.innerHTML = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>
      <span class="fname" contenteditable="true" data-action="rename-folder" spellcheck="false">${escapeHtml(folder.name)}</span>
      <span class="fcount">${children.length}</span>
      <button class="icon-btn" data-action="delete-row" title="Delete folder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button>`;
    wrap.appendChild(header);
    const childWrap = el('div','folder-children'+(folder.collapsed?' collapsed':''));
    childWrap.dataset.folderChildrenOf = folder.id;
    children.forEach(c=>{
      childWrap.appendChild(c.kind==='folder' ? document.createTextNode('') : renderRow(c));
    });
    wrap.appendChild(childWrap);
    return wrap;
  }

  function renderRow(r){
    if(r.kind==='table') return renderTableRow(r);
    if(r.kind==='note') return renderNoteRow(r);
    return renderExprRow(r);
  }

  function badgeStyle(r){
    return r.visible ? `background:${r.style.color};color:${r.style.color}` : '';
  }

  function renderExprRow(r){
    const row = el('div','expr-row'+(r.lastError?' has-error':''), {'data-row-id':r.id});
    const badge = el('div','idx-badge'+(r.visible?'':' hidden-badge'), {
      'data-action':'toggle-visible', style: r.visible ? `background:${r.style.color}` : '', title:'Click: show/hide · Right-click: color & style'
    });
    badge.innerHTML = r.visible ? '' : '<span class="visdot"></span>';
    row.appendChild(badge);

    const body = el('div','row-body');
    const inputWrap = el('div','expr-input-wrap');
    const ta = el('textarea','expr-input', {rows:'1', spellcheck:'false', placeholder:'z = x^2 + y^2   (see Help for syntax)'});
    ta.value = r.text;
    inputWrap.appendChild(ta);
    body.appendChild(inputWrap);

    const meta = el('div','expr-meta-row', {id:'meta-'+r.id});
    body.appendChild(meta);

    const gear = el('div','gear-panel hidden', {id:'gear-'+r.id});
    body.appendChild(gear);

    if(r.sliderMeta){ body.appendChild(renderInlineSlider(r)); }

    row.appendChild(body);

    const actions = el('div','row-actions');
    actions.innerHTML = `
      <button class="icon-btn" data-action="toggle-gear" title="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/></svg></button>
      <button class="icon-btn" data-action="delete-row" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    row.appendChild(actions);

    updateMetaAndGear(r, meta, gear);
    return row;
  }

  function renderInlineSlider(r){
    const wrap = el('div','slider-row', {id:'sliderrow-'+r.id});
    const eqIdx = r.text.indexOf('=');
    const name = eqIdx>=0 ? r.text.slice(0,eqIdx).trim() : '?';
    const m = r.sliderMeta;
    const v = r.computedValue!==undefined ? r.computedValue : 0;
    wrap.innerHTML = `
      <button class="icon-btn" data-action="slider-play" title="${m.animating?'Pause':'Play'}">${m.animating?ICON_PAUSE:ICON_PLAY}</button>
      <span class="svar">${escapeHtml(name)}</span>
      <input type="number" class="sminmax" data-action="slider-min" value="${fmtInput(m.min)}">
      <input type="range" min="${m.min}" max="${m.max}" step="${m.step}" value="${v}" data-action="slider-range">
      <input type="number" class="sminmax" data-action="slider-max" value="${fmtInput(m.max)}">
      <span class="sval">${Utils.fmtNum(v,3)}</span>
      <button class="icon-btn" data-action="slider-loop" title="Loop: ${m.loop?'on':'off'}" style="opacity:${m.loop?1:.4}">${ICON_LOOP}</button>`;
    return wrap;
  }
  function fmtInput(v){ return (Math.round(v*1000)/1000).toString(); }

  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const ICON_LOOP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function updateMetaAndGear(r, meta, gear){
    meta.innerHTML='';
    if(r.cls && r.cls.type && r.cls.type!=='empty' && r.cls.type!=='error'){
      const chip = el('span','type-chip'); chip.textContent = TYPE_LABELS[r.cls.type]||r.cls.type;
      meta.appendChild(chip);
      if(r.triCount) { const t=el('span',''); t.style.cssText='font-size:9.5px;color:var(--text-faint)'; t.textContent = r.triCount.toLocaleString()+' tri'; meta.appendChild(t); }
      if(r.cls.type==='scalar' && r.computedValue!==undefined){
        const v = el('span',''); v.style.cssText='font-size:11px;color:var(--text-dim);font-family:var(--mono)'; v.textContent='= '+Utils.fmtNum(r.computedValue,6); meta.appendChild(v);
      }
      if(r.cls.type==='assignment' && r.computedValue!==undefined && !r.sliderMeta){
        const v = el('span',''); v.style.cssText='font-size:11px;color:var(--text-dim);font-family:var(--mono)'; v.textContent='= '+Utils.fmtNum(r.computedValue,6); meta.appendChild(v);
      }
      const pid = 'prog-'+r.id;
      const p = el('span',''); p.id=pid; meta.appendChild(p);
    }
    if(r.lastError){
      const err = el('div','err-msg'); err.textContent = '⚠ ' + r.lastError;
      meta.parentElement && meta.after(err);
      meta.appendChild(Object.assign(el('span',''),{})); // noop
      // place error under meta row visually
      const existing = meta.parentElement.querySelector('.err-msg');
      if(existing && existing!==err) existing.remove();
      meta.insertAdjacentElement('afterend', err);
    }
    renderGear(r, gear);
  }

  function renderGear(r, gear){
    gear.classList.toggle('hidden', !r.gearOpen);
    if(!r.gearOpen) return;
    gear.innerHTML = '';
    const fields = domainFieldsFor(r.cls ? r.cls.type : null, r);
    fields.forEach(f=>{
      const fw = el('div','gear-field'+(f.span2?' span2':''));
      const lab = el('label'); lab.textContent = f.label;
      const inp = el('input', null, { type:'number', step:f.step||'any', value:f.value, 'data-domain-key':f.key });
      fw.appendChild(lab); fw.appendChild(inp);
      gear.appendChild(fw);
    });
    if(fields.length===0){
      const note = el('div','gear-field span2');
      note.innerHTML = '<span style="color:var(--text-faint)">No adjustable domain for this type.</span>';
      gear.appendChild(note);
    }
  }

  function domainFieldsFor(type, r){
    const d = r.domain || {};
    switch(type){
      case 'explicit': {
        const [a,b] = r.cls.of;
        return [
          {key:'d1min',label:a+' min',value:d.d1min}, {key:'d1max',label:a+' max',value:d.d1max},
          {key:'d2min',label:b+' min',value:d.d2min}, {key:'d2max',label:b+' max',value:d.d2max},
          {key:'segments',label:'Resolution',value:d.segments,step:'1'},
        ];
      }
      case 'spherical': return [
        {key:'thetaMin',label:'θ min',value:d.thetaMin},{key:'thetaMax',label:'θ max',value:d.thetaMax},
        {key:'phiMin',label:'φ min',value:d.phiMin},{key:'phiMax',label:'φ max',value:d.phiMax},
        {key:'segments',label:'Resolution',value:d.segments,step:'1'},
      ];
      case 'cylindrical': return r.cls.mode==='r_of_ztheta' ? [
        {key:'zMin',label:'z min',value:d.zMin},{key:'zMax',label:'z max',value:d.zMax},
        {key:'thetaMin',label:'θ min',value:d.thetaMin},{key:'thetaMax',label:'θ max',value:d.thetaMax},
        {key:'segments',label:'Resolution',value:d.segments,step:'1'},
      ] : [
        {key:'rMin',label:'r min',value:d.rMin},{key:'rMax',label:'r max',value:d.rMax},
        {key:'thetaMin',label:'θ min',value:d.thetaMin},{key:'thetaMax',label:'θ max',value:d.thetaMax},
        {key:'segments',label:'Resolution',value:d.segments,step:'1'},
      ];
      case 'surface_param': return [
        {key:'uMin',label:'u min',value:d.uMin},{key:'uMax',label:'u max',value:d.uMax},
        {key:'vMin',label:'v min',value:d.vMin},{key:'vMax',label:'v max',value:d.vMax},
        {key:'segments',label:'Resolution',value:d.segments,step:'1'},
      ];
      case 'curve': return [
        {key:'tMin',label:'t min',value:d.tMin},{key:'tMax',label:'t max',value:d.tMax},
        {key:'segments',label:'Segments',value:d.segments,step:'1'},
        {key:'tubeRadius',label:'Thickness',value:d.tubeRadius,step:'0.01'},
      ];
      case 'vector': return [
        {key:'bx',label:'Base x',value:d.bx},{key:'by',label:'Base y',value:d.by},{key:'bz',label:'Base z',value:d.bz},
      ];
      case 'vectorfield': return [
        {key:'xmin',label:'x min',value:d.xmin},{key:'xmax',label:'x max',value:d.xmax},
        {key:'ymin',label:'y min',value:d.ymin},{key:'ymax',label:'y max',value:d.ymax},
        {key:'zmin',label:'z min',value:d.zmin},{key:'zmax',label:'z max',value:d.zmax},
        {key:'gridN',label:'Arrows/axis',value:d.gridN,step:'1',span2:true},
      ];
      case 'implicit': return [
        {key:'xmin',label:'x min',value:d.xmin},{key:'xmax',label:'x max',value:d.xmax},
        {key:'ymin',label:'y min',value:d.ymin},{key:'ymax',label:'y max',value:d.ymax},
        {key:'zmin',label:'z min',value:d.zmin},{key:'zmax',label:'z max',value:d.zmax},
        {key:'resolution',label:'Resolution (voxels/axis)',value:d.resolution,step:'1',span2:true},
      ];
      case 'inequality': return [
        {key:'xmin',label:'x min',value:d.xmin},{key:'xmax',label:'x max',value:d.xmax},
        {key:'ymin',label:'y min',value:d.ymin},{key:'ymax',label:'y max',value:d.ymax},
        {key:'zmin',label:'z min',value:d.zmin},{key:'zmax',label:'z max',value:d.zmax},
        {key:'resolution',label:'Resolution (voxels/axis)',value:d.resolution,step:'1',span2:true},
      ];
      default: return [];
    }
  }

  function refreshRow(rowId){
    const r = State.getRow(rowId);
    if(!r) return;
    const rowEl = listEl.querySelector(`.expr-row[data-row-id="${rowId}"]`);
    if(!rowEl){
      // table/other row type — just re-render structurally (cheap, tables are few)
      return;
    }
    rowEl.classList.toggle('has-error', !!r.lastError);
    const badge = rowEl.querySelector('.idx-badge');
    badge.className = 'idx-badge'+(r.visible?'':' hidden-badge');
    badge.style.cssText = r.visible ? `background:${r.style.color}` : '';
    badge.innerHTML = r.visible ? '' : '<span class="visdot"></span>';
    const meta = document.getElementById('meta-'+rowId);
    const gear = document.getElementById('gear-'+rowId);
    if(meta && gear) updateMetaAndGear(r, meta, gear);

    let sliderRow = document.getElementById('sliderrow-'+rowId);
    if(r.sliderMeta){
      const fresh = renderInlineSlider(r);
      if(sliderRow) sliderRow.replaceWith(fresh); else rowEl.querySelector('.row-body').appendChild(fresh);
    } else if(sliderRow){ sliderRow.remove(); }
  }

  function onProgress(evt){
    const p = document.getElementById('prog-'+evt.id);
    if(!p) return;
    p.style.cssText = 'font-size:9.5px;color:var(--accent)';
    p.textContent = evt.active ? ('computing… '+Math.round((evt.pct||0)*100)+'%') : '';
  }

  function updateAutoSliderBlock(){
    const block = document.getElementById('auto-sliders-block');
    if(!block) return;
    const sliders = State.getAutoSliders();
    const names = [...sliders.keys()];
    const sameSet = names.length===autoSliderNamesRendered.length && names.every(n=>autoSliderNamesRendered.includes(n));
    if(!sameSet){
      block.innerHTML='';
      if(names.length){
        const head = el('div',''); head.style.cssText='padding:6px 12px 2px;font-size:10.5px;color:var(--text-faint);font-weight:700;text-transform:uppercase;letter-spacing:.04em';
        head.textContent = 'Sliders'; block.appendChild(head);
      }
      names.forEach(name=>{
        const s = sliders.get(name);
        const wrap = el('div','slider-row', {id:'auto-'+name, 'data-slider-name':name, style:'margin:3px 10px'});
        wrap.innerHTML = `
          <button class="icon-btn" data-action="auto-play" title="Play/Pause">${s.animating?ICON_PAUSE:ICON_PLAY}</button>
          <span class="svar">${escapeHtml(name)}</span>
          <input type="number" class="sminmax" data-action="auto-min" value="${fmtInput(s.min)}">
          <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}" data-action="auto-range">
          <input type="number" class="sminmax" data-action="auto-max" value="${fmtInput(s.max)}">
          <span class="sval">${Utils.fmtNum(s.value,3)}</span>
          <button class="icon-btn" data-action="auto-loop" title="Loop" style="opacity:${s.loop?1:.4}">${ICON_LOOP}</button>`;
        block.appendChild(wrap);
      });
      autoSliderNamesRendered = names;
    } else {
      names.forEach(name=>{
        const s = sliders.get(name);
        const wrap = document.getElementById('auto-'+name);
        if(!wrap) return;
        const range = wrap.querySelector('[data-action="auto-range"]');
        if(document.activeElement !== range){ range.min=s.min; range.max=s.max; range.value=s.value; }
        wrap.querySelector('.sval').textContent = Utils.fmtNum(s.value,3);
        const playBtn = wrap.querySelector('[data-action="auto-play"]');
        playBtn.innerHTML = s.animating?ICON_PAUSE:ICON_PLAY;
      });
    }
  }

  // ---------------- table & note rows ----------------
  function renderTableRow(r){
    const row = el('div','expr-row', {'data-row-id':r.id});
    const badge = el('div','idx-badge'+(r.visible?'':' hidden-badge'), { 'data-action':'toggle-visible', style: r.visible?`background:${r.style.color}`:'' });
    badge.innerHTML = r.visible?'':'<span class="visdot"></span>';
    row.appendChild(badge);
    const body = el('div','row-body');
    const nameRow = el('div',''); nameRow.style.cssText='display:flex;align-items:center;gap:6px;margin-bottom:2px';
    nameRow.innerHTML = `<input data-action="table-name" value="${escapeHtml(r.name)}" style="background:transparent;border:none;color:var(--text);font-weight:600;font-size:12.5px;width:100%;padding:4px 6px">`;
    body.appendChild(nameRow);
    const tw = el('div','table-row-wrap');
    const table = el('table','table-grid');
    table.innerHTML = `<thead><tr><th>x</th><th>y</th><th>z</th><th></th></tr></thead>`;
    const tbody = el('tbody');
    r.data.forEach((cell,i)=>{
      const tr = el('tr');
      tr.innerHTML = `<td><input data-action="table-cell" data-i="${i}" data-k="x" value="${escapeHtml(cell.x)}"></td>
        <td><input data-action="table-cell" data-i="${i}" data-k="y" value="${escapeHtml(cell.y)}"></td>
        <td><input data-action="table-cell" data-i="${i}" data-k="z" value="${escapeHtml(cell.z)}"></td>
        <td><button class="icon-btn" data-action="table-delrow" data-i="${i}" style="width:18px;height:18px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tw.appendChild(table);
    const addLink = el('span','table-add-row', {'data-action':'table-addrow'}); addLink.textContent = '+ add row';
    tw.appendChild(addLink);
    const connectRow = el('label',''); connectRow.style.cssText='display:flex;align-items:center;gap:5px;margin-top:5px;font-size:11px;color:var(--text-dim)';
    connectRow.innerHTML = `<input type="checkbox" data-action="table-connect" ${r.connect?'checked':''}> Connect points (path)`;
    tw.appendChild(connectRow);
    body.appendChild(tw);
    row.appendChild(body);
    const actions = el('div','row-actions');
    actions.innerHTML = `<button class="icon-btn" data-action="delete-row" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    row.appendChild(actions);
    return row;
  }

  function renderNoteRow(r){
    const row = el('div','expr-row note-row', {'data-row-id':r.id});
    const spacer = el('div','idx-badge hidden-badge', {style:'background:transparent;border-color:transparent'});
    spacer.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:.5"><path d="M5 4h14v16l-3.5-2.5L12 20l-3.5-2.5L5 20V4z"/></svg>';
    row.appendChild(spacer);
    const body = el('div','row-body');
    const ta = el('textarea',null,{rows:'1',placeholder:'Add a note…'});
    ta.value = r.text;
    ta.dataset.action='note-text';
    body.appendChild(ta);
    row.appendChild(body);
    const actions = el('div','row-actions');
    actions.innerHTML = `<button class="icon-btn" data-action="delete-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    row.appendChild(actions);
    return row;
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function autogrow(ta){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight)+'px'; }

  // ---------------- events ----------------
  function attachEvents(){
    document.querySelectorAll('#sb-toolbar [data-add]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const kind = btn.dataset.add;
        const r = State.addRow(kind, {});
        if(kind==='expr') focusRow(r.id);
      });
    });

    listEl.addEventListener('input', e=>{
      const t = e.target;
      if(t.matches('.expr-input')){
        autogrow(t);
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        State.setRowText(rowId, t.value);
      } else if(t.matches('[data-action="note-text"]')){
        autogrow(t);
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId); if(r){ r.text = t.value; }
      } else if(t.matches('[data-domain-key]')){
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId);
        if(r){ r.domain[t.dataset.domainKey] = parseFloat(t.value)||0; State.scheduleRecompute(); }
      } else if(t.matches('[data-action="table-name"]')){
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId); if(r) r.name = t.value;
      } else if(t.matches('[data-action="table-cell"]')){
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId);
        if(r){ r.data[+t.dataset.i][t.dataset.k] = t.value; State.scheduleRecompute(); }
      } else if(t.matches('[data-action="auto-range"]')){
        const name = t.closest('[data-slider-name]').dataset.sliderName;
        State.setAutoSliderValue(name, parseFloat(t.value));
        t.closest('.slider-row').querySelector('.sval').textContent = Utils.fmtNum(parseFloat(t.value),3);
      } else if(t.matches('[data-action="slider-range"]')){
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId);
        State.setAssignmentValue(r, parseFloat(t.value));
        t.closest('.slider-row').querySelector('.sval').textContent = Utils.fmtNum(parseFloat(t.value),3);
        State.scheduleRecompute();
      } else if(t.matches('[data-action="auto-min"],[data-action="auto-max"]')){
        const name = t.closest('[data-slider-name]').dataset.sliderName;
        const s = State.getAutoSliders().get(name); if(!s) return;
        if(t.dataset.action==='auto-min') s.min = parseFloat(t.value); else s.max = parseFloat(t.value);
        State.scheduleRecompute();
      } else if(t.matches('[data-action="slider-min"],[data-action="slider-max"]')){
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId); if(!r||!r.sliderMeta) return;
        r.sliderMeta._userSet = true;
        if(t.dataset.action==='slider-min') r.sliderMeta.min = parseFloat(t.value); else r.sliderMeta.max = parseFloat(t.value);
      }
    });

    listEl.addEventListener('change', e=>{
      const t = e.target;
      if(t.matches('[data-action="table-connect"]')){
        const rowId = t.closest('[data-row-id]').dataset.rowId;
        const r = State.getRow(rowId); if(r){ r.connect = t.checked; State.scheduleRecompute(); }
      }
    });

    listEl.addEventListener('click', e=>{
      const actionEl = e.target.closest('[data-action]');
      const rowWrap = e.target.closest('[data-row-id]');
      const rowId = rowWrap && rowWrap.dataset.rowId;
      if(!actionEl) return;
      const action = actionEl.dataset.action;
      const r = rowId ? State.getRow(rowId) : null;

      switch(action){
        case 'toggle-visible': if(r){ r.visible = !r.visible; State.scheduleRecompute(); refreshRow(r.id);} break;
        case 'delete-row': if(rowId) State.removeRow(rowId); break;
        case 'toggle-gear': if(r){ r.gearOpen = !r.gearOpen; refreshRow(r.id);} break;
        case 'toggle-folder': {
          const f = State.getRow(rowId); if(f){ f.collapsed = !f.collapsed; render(); }
          break;
        }
        case 'table-addrow': if(r){ r.data.push({x:'0',y:'0',z:'0'}); render(); State.scheduleRecompute(); } break;
        case 'table-delrow': if(r){ r.data.splice(+actionEl.dataset.i,1); render(); State.scheduleRecompute(); } break;
        case 'slider-play': if(r&&r.sliderMeta){ r.sliderMeta.animating=!r.sliderMeta.animating; refreshRow(r.id);} break;
        case 'slider-loop': if(r&&r.sliderMeta){ r.sliderMeta.loop=!r.sliderMeta.loop; refreshRow(r.id);} break;
        case 'auto-play': {
          const name = actionEl.closest('[data-slider-name]').dataset.sliderName;
          const s = State.getAutoSliders().get(name); if(s){ s.animating=!s.animating; actionEl.innerHTML = s.animating?ICON_PAUSE:ICON_PLAY; }
          break;
        }
        case 'auto-loop': {
          const name = actionEl.closest('[data-slider-name]').dataset.sliderName;
          const s = State.getAutoSliders().get(name); if(s){ s.loop=!s.loop; actionEl.style.opacity = s.loop?1:.4; }
          break;
        }
      }
    });

    listEl.addEventListener('contextmenu', e=>{
      const badge = e.target.closest('.idx-badge');
      if(badge){ e.preventDefault(); const rowWrap = badge.closest('[data-row-id]'); openColorPopover(State.getRow(rowWrap.dataset.rowId), badge); }
    });
    let pressTimer=null;
    listEl.addEventListener('touchstart', e=>{
      const badge = e.target.closest('.idx-badge');
      if(!badge) return;
      pressTimer = setTimeout(()=>{ const rowWrap = badge.closest('[data-row-id]'); openColorPopover(State.getRow(rowWrap.dataset.rowId), badge); }, 480);
    }, {passive:true});
    listEl.addEventListener('touchend', ()=>{ clearTimeout(pressTimer); });

    // double-click badge also opens color popover (desktop convenience)
    listEl.addEventListener('dblclick', e=>{
      const badge = e.target.closest('.idx-badge');
      if(badge){ const rowWrap = badge.closest('[data-row-id]'); openColorPopover(State.getRow(rowWrap.dataset.rowId), badge); }
    });

    document.getElementById('btn-clear').addEventListener('click', ()=>{
      if(confirm('Clear all expressions?')) State.clearAll();
    });
    document.getElementById('sb-collapse-tab').addEventListener('click', ()=>{
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
  }

  function focusRow(id){
    requestAnimationFrame(()=>{
      const rowEl = listEl.querySelector(`.expr-row[data-row-id="${id}"] .expr-input`);
      if(rowEl) rowEl.focus();
    });
  }

  function openColorPopover(row, anchorEl){
    ColorPicker.open(row, anchorEl, ()=>{ refreshRow(row.id); State.scheduleRecompute(); });
  }

  return { init, render, refreshRow };
})();
