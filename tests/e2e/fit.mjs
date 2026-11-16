// Does everything stay inside the box it is drawn in?
//
// overflow.mjs already proves nothing escapes the PAGE. This suite proves
// nothing escapes a box the eye can see: the per-game tile whose value hung
// out past its rounded border, and the sealed row whose name was squeezed so
// narrow that a single word stuck out of the card.
//
// Two rules keep it honest rather than merely strict:
//
//  * Only a box that PAINTS a boundary counts — a background or a border.
//    Escaping one of those is what reads as broken. The species sprites are
//    30px stickers deliberately bleeding out of a 19px line of text with
//    negative margins, their parents paint nothing, and they are decorative
//    (aria-hidden), so they are not breakage.
//  * Rectangles of real children are compared, never scrollWidth, because
//    scrollWidth also counts absolutely-positioned decoration: .hero::after
//    is a 340px glow parked at right:-80px and clipped on purpose, and it
//    would fail this suite forever.
//
// Deliberate ellipsis truncation and visually-hidden helpers are not faults.
import { launch, sleep } from './cdp.mjs';

const B = process.env.BASE || 'http://localhost:5144/';
const PAGES = ['index', 'cards', 'sealed', 'sets', 'wishlist'];
// small phone -> iPhone -> big phone -> tablet both ways -> laptop -> desktop
const VPS = [[320, 568], [375, 667], [390, 844], [430, 932],
             [768, 1024], [1024, 768], [1280, 800], [1440, 900]];

const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };

const PROBE = `(()=>{
  const sel=(e)=>{let s=e.tagName.toLowerCase(); if(e.id)s+='#'+e.id;
    if(e.className&&typeof e.className==='string'){const c=e.className.trim().split(/\\s+/).filter(Boolean).slice(0,3); if(c.length)s+='.'+c.join('.');}
    return s;};
  const scrolls=(e)=>{const o=getComputedStyle(e);
    return ['auto','scroll'].includes(o.overflowX)||['auto','scroll'].includes(o.overflowY);};
  // a box the eye can see: it has a fill or an edge
  const paints=(cs)=>{
    const bg=(cs.backgroundColor||'').replace(/\\s/g,'');
    if(bg&&bg!=='transparent'&&bg!=='rgba(0,0,0,0)')return true;
    return ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth']
      .some(k=>parseFloat(cs[k])>0);
  };
  const W=document.documentElement.clientWidth;
  const spill=[], cut=[], small=[];
  // an <img> mid-flight can lay out at a size its CSS box will override
  const pending=new Set();
  for(const i of document.images) if(!i.complete){
    for(let n=i;n&&n!==document.body;n=n.parentElement) pending.add(n);}

  for(const e of document.querySelectorAll('body *')){
    const cs=getComputedStyle(e);
    if(cs.display==='none'||cs.visibility==='hidden')continue;
    const r=e.getBoundingClientRect();
    if(r.width<=1&&r.height<=1)continue;            // visually-hidden helper
    if(cs.clip&&cs.clip!=='auto')continue;          // clip:rect(0 0 0 0)
    if(scrolls(e)||pending.has(e))continue;
    let n=e.parentElement,inScroll=false;
    for(;n&&n!==document.body;n=n.parentElement){if(scrolls(n)){inScroll=true;break;}}
    if(inScroll)continue;

    const ell=cs.textOverflow==='ellipsis';
    const clips=cs.overflowX==='hidden'||cs.overflowX==='clip'||cs.overflowY==='hidden'||cs.overflowY==='clip';
    const inner={
      r:r.right-(parseFloat(cs.borderRightWidth)||0),
      b:r.bottom-(parseFloat(cs.borderBottomWidth)||0)};

    if(paints(cs)||clips){
      for(const c of e.children){
        const k=getComputedStyle(c);
        if(k.display==='none'||k.visibility==='hidden')continue;
        if(k.position==='absolute'||k.position==='fixed')continue;
        if(pending.has(c))continue;
        const q=c.getBoundingClientRect(); if(!q.width&&!q.height)continue;
        const over=Math.max(q.right-inner.r,q.bottom-inner.b);
        if(over>1.5)(clips&&!ell?cut:spill).push(sel(e)+' > '+sel(c)+' by '+Math.round(over)+'px');
      }
    }
    // text-only node: no element children to confuse scrollWidth
    if(!e.children.length&&!ell&&clips&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+1)
      cut.push(sel(e)+' text '+e.scrollWidth+'/'+e.clientWidth);
    if(W<=430&&e.matches('.btn,.chip,select,input,.tab,.bt,.theme-btn,button.lnk-btn')&&r.height>0&&r.height<30)
      small.push(sel(e)+' h='+Math.round(r.height));
  }
  return {W, sw:document.documentElement.scrollWidth,
    spill:[...new Set(spill)].slice(0,6), cut:[...new Set(cut)].slice(0,6), small:[...new Set(small)].slice(0,5)};
})()`;

for (const [w, h] of VPS) {
  await b.viewport(w, h, w <= 430, 2);
  await sleep(150);                       // let the new metrics apply before loading
  for (const p of PAGES) {
    await b.send('Page.navigate', { url: B + p + '.html' });
    await sleep(900);
    // fonts only: awaiting every lazy image made a run take 19 minutes, since
    // the card pages hold ~150 images each. Two frames settle the relayout.
    await b.ev(`(async()=>{if(document.fonts&&document.fonts.ready)await document.fonts.ready;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    await sleep(300);
    const r = await b.ev(PROBE);
    t(`[${w}x${h}] ${p}: nothing escapes a painted box`, !r.spill.length, r.spill.join(', '));
    t(`[${w}x${h}] ${p}: nothing clipped away`, !r.cut.length, r.cut.join(', '));
    t(`[${w}x${h}] ${p}: no page-wide sideways scroll`, r.sw <= r.W + 1, `scrollWidth ${r.sw}/${r.W}`);
    if (w <= 430) t(`[${w}x${h}] ${p}: controls stay tappable (≥30px)`, !r.small.length, r.small.join(', '));
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
b.close();
process.exit(fail ? 1 : 0);
