// Does everything stay inside the box it is drawn in?
//
// overflow.mjs already proves nothing escapes the PAGE. This suite proves
// nothing escapes a box the eye can see: the per-game tile whose value hung
// out past its rounded border, and the sealed row whose name was squeezed so
// narrow that a single word stuck out of the card.
//
// Three rules keep it honest rather than merely strict:
//
//  * Only a box that PAINTS a boundary counts — a background or a border.
//    Escaping one of those is what reads as broken. The species sprites are
//    30px stickers deliberately bleeding out of a 19px line of text with
//    negative margins, their parents paint nothing, and they are decorative
//    (aria-hidden), so they are not breakage.
//  * Every element is held to its NEAREST ancestor that paints or clips, not
//    just a painted box's direct children. The tile bug happened one level
//    down: logo and value overflowed .gsplit-top, which paints nothing and is
//    itself stretched to the tile's width, so a direct-children rule passed
//    the very bug this suite was written for. The self-test below guards it.
//  * Rectangles are compared, never scrollWidth, because scrollWidth also
//    counts absolutely-positioned decoration: .hero::after is a 340px glow
//    parked at right:-80px and clipped on purpose, and it would fail forever.
//
// Deliberate ellipsis truncation and visually-hidden helpers are not faults.
import { launch, sleep } from './cdp.mjs';

const B = process.env.BASE || 'http://localhost:5144/';
const PAGES = ['index', 'cards', 'sealed', 'sets', 'wishlist'];
// small phone -> iPhone -> big phone, the same phones on their side, then
// tablet both ways, laptop and desktop
const VPS = [[320, 568], [375, 667], [390, 844], [430, 932],
             [667, 375], [844, 390],
             [768, 1024], [1024, 768], [1280, 800], [1440, 900]];
// a phone is decided by its short side, so a landscape phone stays a phone
const phone = (w, h) => Math.min(w, h) <= 430;

const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };

const PROBE = `(()=>{
  const sel=(e)=>{let s=e.tagName.toLowerCase(); if(e.id)s+='#'+e.id;
    if(e.className&&typeof e.className==='string'){const c=e.className.trim().split(/\\s+/).filter(Boolean).slice(0,3); if(c.length)s+='.'+c.join('.');}
    return s;};
  const memo=new Map(), css=(e)=>{let c=memo.get(e); if(!c){c=getComputedStyle(e); memo.set(e,c);} return c;};
  const scrolls=(c)=>['auto','scroll'].includes(c.overflowX)||['auto','scroll'].includes(c.overflowY);
  const clips=(c)=>['hidden','clip'].includes(c.overflowX)||['hidden','clip'].includes(c.overflowY);
  // a box the eye can see: it has a fill or an edge
  const paints=(c)=>{
    const bg=(c.backgroundColor||'').replace(/\\s/g,'');
    if(bg&&bg!=='transparent'&&bg!=='rgba(0,0,0,0)')return true;
    return ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].some(k=>parseFloat(c[k])>0);
  };
  const W=document.documentElement.clientWidth;
  const spill=[], cut=[], small=[];
  // an <img> mid-flight can lay out at a size its CSS box will override
  const pending=new Set();
  for(const i of document.images) if(!i.complete){
    for(let n=i;n&&n!==document.body;n=n.parentElement) pending.add(n);}

  for(const d of document.querySelectorAll('body *')){
    const ds=css(d);
    if(ds.display==='none'||ds.visibility==='hidden')continue;
    const r=d.getBoundingClientRect();
    if(Math.min(W,innerHeight)<=430&&d.matches('.btn,.chip,select,input,.tab,.bt,.theme-btn,button.lnk-btn')&&r.height>0&&r.height<30)
      small.push(sel(d)+' h='+Math.round(r.height));
    if(ds.position==='absolute'||ds.position==='fixed')continue;   // placed on purpose
    if(r.width<=1&&r.height<=1)continue;                          // visually-hidden helper
    if(ds.clip&&ds.clip!=='auto')continue;                        // clip:rect(0 0 0 0)
    if(pending.has(d)||scrolls(ds))continue;

    // text-only node clipped without an ellipsis
    if(!d.children.length&&clips(ds)&&ds.textOverflow!=='ellipsis'&&d.clientWidth>0&&d.scrollWidth>d.clientWidth+1)
      cut.push(sel(d)+' text '+d.scrollWidth+'/'+d.clientWidth);

    // The nearest ancestor that paints a boundary or clips is the box d must
    // stay inside. Walking past unpainted wrappers is the point: the original
    // tile bug was a logo and value overflowing .gsplit-top, which paints
    // nothing and is itself stretched to the tile's width, so checking only
    // a painted box's direct children never saw it.
    let c=null;
    for(let n=d.parentElement;n&&n!==document.body;n=n.parentElement){
      const ns=css(n);
      if(scrolls(ns)||pending.has(n)){c=null;break;}               // overflow is meant to scroll
      if(paints(ns)||clips(ns)){c=n;break;}
      if(ns.position==='absolute'||ns.position==='fixed'){c=null;break;}
    }
    if(!c)continue;
    const cs=css(c), q=c.getBoundingClientRect();
    const over=Math.max(
      (q.left+(parseFloat(cs.borderLeftWidth)||0))-r.left,
      (q.top+(parseFloat(cs.borderTopWidth)||0))-r.top,
      r.right-(q.right-(parseFloat(cs.borderRightWidth)||0)),
      r.bottom-(q.bottom-(parseFloat(cs.borderBottomWidth)||0)));
    if(over>1.5)(clips(cs)?cut:spill).push(sel(c)+' ⊃ '+sel(d)+' by '+Math.round(over)+'px');
  }
  return {W, sw:document.documentElement.scrollWidth,
    spill:[...new Set(spill)].slice(0,6), cut:[...new Set(cut)].slice(0,6), small:[...new Set(small)].slice(0,5)};
})()`;

// Self-test: the probe must still see the bug this suite exists for. Put the
// per-game tile back the way it was — a value and logo that can neither wrap
// nor shrink — and require a spill. If this fails, the probe has gone blind
// and every pass below means nothing.
await b.viewport(390, 844, true, 2);
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
await b.ev(`(()=>{const s=document.createElement('style');s.textContent=
  '.gsplit-top{flex-wrap:nowrap!important;min-width:auto!important}.gsplit-v{margin-left:0!important}'+
  '.gsplit-i{flex:1 1 90px!important;min-width:90px!important}.gsplit-top .game-logo{max-width:none!important;flex:none!important}';
  document.head.appendChild(s)})()`);
await sleep(300);
const canary = await b.ev(PROBE);
t('self-test: the original tile overflow is still detected', canary.spill.length > 0,
  canary.spill.slice(0, 2).join(', ') || 'the probe saw nothing: it has gone blind');

for (const [w, h] of VPS) {
  await b.viewport(w, h, phone(w, h), 2);
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
    if (phone(w, h)) t(`[${w}x${h}] ${p}: controls stay tappable (≥30px)`, !r.small.length, r.small.join(', '));
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
b.close();
process.exit(fail ? 1 : 0);
