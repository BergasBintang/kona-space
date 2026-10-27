const lum = (hex) => { const c = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1>l2?[l1,l2]:[l2,l1]; return ((hi+0.05)/(lo+0.05)); };
export const L = { ground:'#F6F3EC', surface1:'#EFEBE2', surface2:'#FFFFFF', surface3:'#E7E2D6', inset:'#FBF9F4', lineSubtle:'#DDD6C8', lineStrong:'#857F73', text:'#1C2124', secondary:'#474C4F', tertiary:'#5E6366', disabled:'#A7A397', accent:'#17705F', accentHover:'#1F8672', onAccent:'#FFFFFF', live:'#17705F', waiting:'#8A5700', idle:'#4C6270', done:'#3A7129', stopped:'#5B6266', left:'#B03427' };
export const pairs = [
 ['text on ground', L.text, L.ground], ['text on surface 2', L.text, L.surface2], ['secondary on ground', L.secondary, L.ground], ['tertiary on ground', L.tertiary, L.ground], ['tertiary on surface 3', L.tertiary, L.surface3],
 ['accent on ground', L.accent, L.ground], ['on-accent on accent', L.onAccent, L.accent], ['on-accent on hover', L.onAccent, L.accentHover],
 ['waiting on ground', L.waiting, L.ground], ['idle on ground', L.idle, L.ground], ['done on ground', L.done, L.ground], ['stopped on ground', L.stopped, L.ground], ['left behind on ground', L.left, L.ground],
 ['line strong vs ground (non-text)', L.lineStrong, L.ground], ['line strong vs inset', L.lineStrong, L.inset],
];
if (process.argv[1].endsWith('lightcheck.mjs')) for (const [n,a,b] of pairs) console.log(ratio(a,b).toFixed(1).padStart(5), n);
export { ratio };
