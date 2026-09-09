// =====================================================================
// UI / COLOR PICKER — HSV wheel + hex/rgb + opacity + render style
// =====================================================================
const ColorPicker = (() => {
  let pop, svBox, svCursor, hueSlider, hueCursor, hexField, rgbField, opField, opVal, presetRow;
  let curRow = null, onChangeCb = null, hsv = [220,0.64,1];
  let inited = false;

  function init(){
    if(inited) return; inited = true;
    pop = document.getElementById('color-popover');
    svBox = document.getElementById('sv-box'); svCursor = document.getElementById('sv-cursor');
    hueSlider = document.getElementById('hue-slider'); hueCursor = document.getElementById('hue-cursor');
    hexField = document.getElementById('hex-field'); rgbField = document.getElementById('rgb-field');
    opField = document.getElementById('opacity-field'); opVal = document.getElementById('opacity-val');
    presetRow = document.getElementById('preset-swatches');
    Utils.PALETTE.forEach(c=>{
      const sw = document.createElement('div'); sw.className='swatch'; sw.style.background=c;
      sw.addEventListener('click', ()=>{ setFromHex(c); commit(); });
      presetRow.appendChild(sw);
    });

    let draggingSV=false, draggingHue=false;
    svBox.addEventListener('pointerdown', e=>{ draggingSV=true; svBox.setPointerCapture(e.pointerId); handleSV(e); });
    svBox.addEventListener('pointermove', e=>{ if(draggingSV) handleSV(e); });
    svBox.addEventListener('pointerup', ()=>{ draggingSV=false; commit(); });
    hueSlider.addEventListener('pointerdown', e=>{ draggingHue=true; hueSlider.setPointerCapture(e.pointerId); handleHue(e); });
    hueSlider.addEventListener('pointermove', e=>{ if(draggingHue) handleHue(e); });
    hueSlider.addEventListener('pointerup', ()=>{ draggingHue=false; commit(); });

    hexField.addEventListener('change', ()=>{ setFromHex(hexField.value); commit(); });
    rgbField.addEventListener('change', ()=>{
      const parts = rgbField.value.split(',').map(s=>parseInt(s.trim()));
      if(parts.length===3 && parts.every(n=>!isNaN(n))){ setFromHex(Utils.rgbToHex(...parts)); commit(); }
    });
    opField.addEventListener('input', ()=>{
      opVal.textContent = opField.value+'%';
      if(curRow){ curRow.style.opacity = (+opField.value)/100; }
      commit(false);
    });

    pop.querySelectorAll('[data-style]').forEach(pill=>{
      pill.addEventListener('click', ()=>{
        pop.querySelectorAll('[data-style]').forEach(p=>p.classList.remove('active'));
        pill.classList.add('active');
        if(curRow) curRow.style.renderStyle = pill.dataset.style;
        commit();
      });
    });
    pop.querySelectorAll('[data-color-mode]').forEach(pill=>{
      pill.addEventListener('click', ()=>{
        pop.querySelectorAll('[data-color-mode]').forEach(p=>p.classList.remove('active'));
        pill.classList.add('active');
        if(curRow) curRow.style.colorMode = pill.dataset.colorMode;
        commit();
      });
    });

    document.addEventListener('pointerdown', e=>{
      if(!pop.classList.contains('hidden') && !pop.contains(e.target) && !e.target.closest('.idx-badge')){
        close();
      }
    });
  }

  function handleSV(e){
    const rect = svBox.getBoundingClientRect();
    const s = Utils.clamp((e.clientX-rect.left)/rect.width,0,1);
    const v = 1-Utils.clamp((e.clientY-rect.top)/rect.height,0,1);
    hsv[1]=s; hsv[2]=v;
    updateFromHSV();
  }
  function handleHue(e){
    const rect = hueSlider.getBoundingClientRect();
    const h = Utils.clamp((e.clientX-rect.left)/rect.width,0,1)*360;
    hsv[0]=h;
    updateFromHSV();
  }
  function setFromHex(hex){
    const rgb = Utils.hexToRgb(hex);
    hsv = Utils.rgbToHsv(...rgb);
    updateFromHSV();
  }
  function updateFromHSV(){
    const [h,s,v] = hsv;
    svBox.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${h},100%,50%)`;
    svCursor.style.left = (s*100)+'%'; svCursor.style.top = ((1-v)*100)+'%';
    hueCursor.style.left = (h/360*100)+'%';
    hueSlider.style.setProperty('--h', h);
    const rgb = Utils.hsvToRgb(h,s,v);
    const hex = Utils.rgbToHex(...rgb);
    hexField.value = hex; rgbField.value = rgb.join(',');
    if(curRow) curRow.style.color = hex;
  }

  function commit(needsRecompute){
    if(onChangeCb) onChangeCb(needsRecompute!==false);
  }

  function open(row, anchorEl, onChange){
    init();
    curRow = row; onChangeCb = onChange;
    const style = row.style;
    setFromHex(style.color || '#5b9bff');
    opField.value = Math.round((style.opacity!==undefined?style.opacity:0.9)*100);
    opVal.textContent = opField.value+'%';

    const showStyleControls = row.kind !== 'table';
    pop.querySelectorAll('.style-row').forEach(sr=>sr.style.display = showStyleControls?'flex':'none');
    if(showStyleControls){
      pop.querySelectorAll('[data-style]').forEach(p=>p.classList.toggle('active', p.dataset.style===style.renderStyle));
      pop.querySelectorAll('[data-color-mode]').forEach(p=>p.classList.toggle('active', p.dataset.colorMode===style.colorMode));
    }

    const r = anchorEl.getBoundingClientRect();
    pop.classList.remove('hidden');
    const popW = 230, popH = pop.offsetHeight || 380;
    let left = r.right+8, top = r.top;
    if(left+popW > window.innerWidth-8) left = r.left-popW-8;
    if(top+popH > window.innerHeight-8) top = window.innerHeight-popH-8;
    pop.style.left = Math.max(8,left)+'px';
    pop.style.top = Math.max(8,top)+'px';
  }
  function close(){ if(pop) pop.classList.add('hidden'); curRow=null; }

  return { open, close };
})();
