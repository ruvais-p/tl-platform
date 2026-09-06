// =====================================================================
// UTILITIES
// =====================================================================
const Utils = (() => {
  let idCounter = 1;
  function uid(prefix){ return (prefix||'id') + '_' + (idCounter++) + '_' + Math.random().toString(36).slice(2,7); }

  function debounce(fn, ms){
    let t = null;
    return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), ms); };
  }

  function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  function hsvToRgb(h,s,v){
    h = ((h%360)+360)%360;
    const c = v*s, x = c*(1-Math.abs((h/60)%2-1)), m = v-c;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
    else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
    return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
  }
  function rgbToHsv(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h=0;
    if(d!==0){
      if(max===r) h = ((g-b)/d)%6;
      else if(max===g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h *= 60; if(h<0) h+=360;
    }
    const s = max===0?0:d/max, v = max;
    return [h,s,v];
  }
  function rgbToHex(r,g,b){
    return '#'+[r,g,b].map(v=>Utils.clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
  }
  function hexToRgb(hex){
    hex = hex.replace('#','');
    if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
    const n = parseInt(hex,16);
    if(isNaN(n)) return [91,155,255];
    return [(n>>16)&255, (n>>8)&255, n&255];
  }

  // spectral / rainbow colormap: t in [0,1]
  function spectralColor(t){
    t = clamp(t,0,1);
    const stops = [
      [0.0,[59,76,192]],   // blue
      [0.25,[97,174,253]], // light blue
      [0.5,[221,221,221]], // white-ish
      [0.75,[247,156,101]],// orange
      [1.0,[180,4,38]]     // red
    ];
    for(let i=0;i<stops.length-1;i++){
      const [t0,c0] = stops[i], [t1,c1] = stops[i+1];
      if(t>=t0 && t<=t1){
        const f = (t-t0)/(t1-t0 || 1);
        return [
          Math.round(lerp(c0[0],c1[0],f)),
          Math.round(lerp(c0[1],c1[1],f)),
          Math.round(lerp(c0[2],c1[2],f)),
        ];
      }
    }
    return stops[stops.length-1][1];
  }

  function fmtNum(n, digits){
    if(!isFinite(n)) return n>0?'∞':'-∞';
    if(Number.isNaN(n)) return 'NaN';
    digits = digits===undefined?3:digits;
    if(Math.abs(n) < 1e-10) return '0';
    if(Math.abs(n) >= 1e5 || Math.abs(n) < 1e-4) return n.toExponential(2);
    return (Math.round(n*Math.pow(10,digits))/Math.pow(10,digits)).toString();
  }

  function download(){ /* intentionally unused: artifact sandbox blocks download triggers */ }

  async function copyToClipboard(text){
    try{ await navigator.clipboard.writeText(text); return true; }
    catch(e){
      try{
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        return true;
      }catch(e2){ return false; }
    }
  }

  const PALETTE = ['#5b9bff','#ff6b6b','#4ecb71','#ffb84d','#c77dff','#3ddbd9','#ff7ab6','#e0c341'];
  let paletteIdx = 0;
  function nextColor(){ const c = PALETTE[paletteIdx % PALETTE.length]; paletteIdx++; return c; }

  return { uid, debounce, clamp, lerp, hsvToRgb, rgbToHsv, rgbToHex, hexToRgb, spectralColor, fmtNum, copyToClipboard, nextColor, PALETTE };
})();
