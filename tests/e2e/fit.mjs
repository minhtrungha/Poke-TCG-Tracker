// Does everything fit inside the box it is drawn in?
//
// overflow.mjs already proves nothing escapes the PAGE. This suite proves
// nothing escapes its own CONTAINER: the per-game tiles whose value spilled
// past the tile edge, and the sealed rows whose name was squeezed to ~40px
// until a single word stuck out of the card.
//
// It looks at real child rectangles rather than scrollWidth, because
// scrollWidth also counts decorative absolutely-positioned pseudo-elements
// (.hero::after is a 340px glow parked at right:-80px and clipped on purpose)
// and would report those as breakage forever.
import { launch, sleep } from './cdp.mjs';

const B = process.env.BASE || 'http://localhost:5144/';
const PAGES = ['index', 'cards', 'sealed', 'sets', 'wishlist'];
// phones (incl. the iPhone sizes), tablets, laptops, desktop
const VPS = [[320, 568], [360, 740], [375, 667], [390, 844], [393, 852], [414, 896],
             [430, 932], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]];

const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };

const PROBE = `(()=>{
  const sel=(e)=>{let s=e.tagName.toLowerCase(); if(e.id)s+='#'+e.id;
    if(e.className&&typeof e.className==='string'){const c=e.className.trim().split(/\\s+/).filter(Boolean).slice(0,3); if(c.length)s+='.'+c.join('.');}
    return s;};
  const scrolls=(e)=>{const o=getComputedStyle(e);
    return ['auto','scroll'].includes(o.overflowX)||['auto','scroll'].includes(o.overflowY);};
  const spill=[], cut=[], small=[];
  const W=document.documentElement.clientWidth;
  for(const e of document.querySelectorAll('body *')){
    const cs=getComputedStyle(e);
    if(cs.display==='none'||cs.visibility==='hidden')continue;
    const r=e.getBoundingClientRect();
    if(r.width<=1&&r.height<=1)continue;             // visually-hidden helper
    if(cs.clip&&cs.clip!=='auto')continue;           // clip:rect(0 0 0 0)
    if(scrolls(e))continue;
    let n=e.parentElement,inScroll=false;
    for(;n&&n!==document.body;n=n.parentElement){if(scrolls(n)){inScroll=true;break;}}
    if(inScroll)continue;
    const ell=cs.textOverflow==='ellipsis';
    const pl=parseFloat(cs.paddingLeft)||0, pr=parseFloat(cs.paddingRight)||0;
    const bl=parseFloat(cs.borderLeftWidth)||0, br=parseFloat(cs.borderRightWidth)||0;
    const pt=parseFloat(cs.paddingTop)||0, pb=parseFloat(cs.paddingBottom)||0;
    const bt=parseFloat(cs.borderTopWidth)||0, bb=parseFloat(cs.borderBottomWidth)||0;
    const box={l:r.left+bl, rt:r.right-br, t:r.top+bt, bt:r.bottom-bb};
    const kids=[...e.children].filter(c=>{
      const k=getComputedStyle(c);
      return k.display!=='none'&&k.visibility!=='hidden'&&k.position!=='absolute'&&k.position!=='fixed';});
    for(const c of kids){
      const k=c.getBoundingClientRect(); if(!k.width&&!k.height)continue;
      const overR=k.right-box.rt, overB=k.bottom-box.bt;
      if(overR>1.5||overB>1.5){
        const where=sel(e)+' > '+sel(c);
        (cs.overflowX==='visible'&&cs.overflowY==='visible'?spill:(ell?[]:cut))
          .push?.(where+' by '+Math.round(Math.max(overR,overB))+'px');
      }
    }
    // text-only node: scrollWidth is trustworthy (no element children to confuse it)
    if(!kids.length&&!ell&&e.scrollWidth>e.clientWidth+1&&e.clientWidth>0&&cs.overflowX!=='visible')
      cut.push(sel(e)+' text '+e.scrollWidth+'/'+e.clientWidth);
    // tap targets on phones
    if(W<=430&&e.matches('.btn,.chip,select,input,.tab,.bt,.theme-btn,button.lnk-btn')&&r.height>0&&r.height<30)
      small.push(sel(e)+' h='+Math.round(r.height));
  }
  return {W, sw:document.documentElement.scrollWidth,
    spill:[...new Set(spill)].slice(0,6), cut:[...new Set(cut)].slice(0,6), small:[...new Set(small)].slice(0,5)};
})()`;

for (const [w, h] of VPS) {
  await b.viewport(w, h, w <= 430, 2);
  for (const p of PAGES) {
    await b.send('Page.navigate', { url: B + p + '.html' });
    await sleep(900);
    // settle: let lazy images load at THIS viewport, then return to the top
    await b.ev(`(async()=>{window.scrollTo(0,document.body.scrollHeight);
      await new Promise(r=>setTimeout(r,500));
      await Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})));
      if(document.fonts&&document.fonts.ready)await document.fonts.ready;
      window.scrollTo(0,0);})()`);
    await sleep(450);
    const r = await b.ev(PROBE);
    t(`[${w}x${h}] ${p}: nothing spills out of its container`, !r.spill.length, r.spill.join(', '));
    t(`[${w}x${h}] ${p}: no text silently cut off`, !r.cut.length, r.cut.join(', '));
    t(`[${w}x${h}] ${p}: no page-wide sideways scroll`, r.sw <= r.W + 1, `scrollWidth ${r.sw}/${r.W}`);
    if (w <= 430) t(`[${w}x${h}] ${p}: controls stay tappable (≥30px)`, !r.small.length, r.small.join(', '));
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
b.close();
process.exit(fail ? 1 : 0);
