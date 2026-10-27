import { T, tint } from './kona-lib.mjs';
const lum = (hex) => { const c = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const over = (fg, bg) => { // fg may have alpha
  if (fg.length === 9) { const a = parseInt(fg.slice(7,9),16)/255; const f=[1,3,5].map(i=>parseInt(fg.slice(i,i+2),16)); const b=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16)); return '#'+f.map((v,i)=>Math.round(v*a+b[i]*(1-a)).toString(16).padStart(2,'0')).join(''); } return fg; };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1>l2?[l1,l2]:[l2,l1]; return ((hi+0.05)/(lo+0.05)); };
const rows = [
  ['text on ground', T.text, T.ground], ['text on surface 2', T.text, T.surface2],
  ['secondary on ground', T.textSecondary, T.ground], ['secondary on surface 2', T.textSecondary, T.surface2],
  ['tertiary on ground', T.textTertiary, T.ground], ['tertiary on surface 2', T.textTertiary, T.surface2], ['tertiary on surface 3', T.textTertiary, T.surface3],
  ['disabled on ground', T.textDisabled, T.ground],
  ['accent on ground', T.accent, T.ground], ['accent on surface 2', T.accent, T.surface2],
  ['on-accent on accent', T.onAccent, T.accent], ['on-accent on hover', T.onAccent, T.accentHover], ['on-accent on pressed', T.onAccent, T.accentPressed],
  ['on-danger on danger', T.onDanger, T.danger],
  ['live on its tint (over surface 1)', T.live, over(tint(T.live,14), T.surface1)],
  ['waiting on its tint', T.waiting, over(tint(T.waiting,14), T.surface1)],
  ['idle on its tint', T.idle, over(tint(T.idle,14), T.surface1)],
  ['done on its tint', T.done, over(tint(T.done,14), T.surface1)],
  ['stopped on its tint', T.stopped, over(tint(T.stopped,14), T.surface1)],
  ['left behind on its tint', T.left, over(tint(T.left,14), T.surface1)],
  ['border strong vs ground (non-text)', T.borderStrong, T.ground], ['border strong vs inset', T.borderStrong, T.inset],
  ['accent focus ring vs ground (non-text)', T.accent, T.ground],
];
for (const [n, a, b] of rows) console.log(ratio(a,b).toFixed(1).padStart(5), ' ', n);
