// Kona design tokens and small drawing helpers for FigCraft (attached over MCP).
import fs from 'node:fs';

export const FONT = 'Nunito Sans';
export const MONO = 'Consolas'; // stand-in; the shipped app will bundle an open-licence mono face

export const T = {
  // Surfaces: warm-neutral basalt, darkest to lightest.
  canvas: '#0B0E10',
  ground: '#101417',
  surface1: '#151A1E',
  surface2: '#1B2126',
  surface3: '#242B31',
  inset: '#0E1215',
  // Borders
  borderSubtle: '#2A3238',
  borderStrong: '#5C666D',
  // Text: warm cream, then greys
  text: '#ECE6DA',
  textSecondary: '#B9B4AA',
  textTertiary: '#8E9396',
  textDisabled: '#5F666B',
  // The one accent: sea glass
  accent: '#6CC6B4',
  accentHover: '#86D4C4',
  accentPressed: '#58AE9D',
  onAccent: '#0D1517',
  // States (always a glyph plus a word)
  live: '#6CC6B4',
  waiting: '#E8B25A',
  idle: '#8FA3AD',
  done: '#8FBF7F',
  stopped: '#8A9297',
  left: '#E5776B',
  danger: '#E5776B',
  onDanger: '#1A0E0C',
};

// The starting team. Shape, not colour, tells roles apart. group is the column on the Roles page.
export const ROLES = [
  { key: 'Product', name: 'Product', group: 'Plan', does: 'Turns ideas into tickets and plans.', mode: 'plan' },
  { key: 'Design', name: 'Design', group: 'Plan', does: 'Screens, copy fit and the look of the product.', mode: 'default' },
  { key: 'Frontend', name: 'Frontend', group: 'Build', does: 'Builds what people see and click.', mode: 'acceptEdits' },
  { key: 'Backend', name: 'Backend', group: 'Build', does: 'Writes the code behind the screens.', mode: 'acceptEdits' },
  { key: 'QA', name: 'QA', group: 'Build', does: 'Tests and reviews before anything ships.', mode: 'default' },
  { key: 'Security', name: 'Security', group: 'Build', does: 'Looks for holes and risky changes.', mode: 'default' },
  { key: 'DevOps', name: 'DevOps', group: 'Ship', does: 'Servers, deploys, backups and databases.', mode: 'default' },
  { key: 'Marketing', name: 'Marketing', group: 'Grow', does: 'Campaigns, landing pages and launch plans.', mode: 'default' },
  { key: 'Content', name: 'Content and SEO', group: 'Grow', does: 'Articles, search words and page copy.', mode: 'default' },
  { key: 'Support', name: 'Support', group: 'Grow', does: 'Answers customers and fixes what they report.', mode: 'default' },
];
export const MODE_WORDS = { plan: 'Plan only', default: 'Ask every time', acceptEdits: 'Edits free, commands asked', auto: 'Let Claude decide' };

export const tint = (hex, pct = 14) => hex + Math.round((pct / 100) * 255).toString(16).padStart(2, '0');

export const SHADOW_OVERLAY = [{ type: 'dropShadow', color: '#00000066', offset: [0, 16], radius: 40, spread: -8 }];

export const TYPE = {
  display: { size: 30, lh: 38, style: 'Bold' },
  title: { size: 22, lh: 30, style: 'Bold' },
  heading: { size: 17, lh: 24, style: 'Bold' },
  body: { size: 15, lh: 24, style: 'Regular' },
  bodyStrong: { size: 15, lh: 24, style: 'Bold' },
  small: { size: 13, lh: 20, style: 'Regular' },
  smallStrong: { size: 13, lh: 20, style: 'Bold' },
  mono: { size: 13, lh: 20, style: 'Regular', mono: true },
  monoStrong: { size: 13, lh: 20, style: 'Bold', mono: true },
};

export function makeKit(f) {
  const call = async (name, args) => (await f.tool(name, args)).json;

  async function create(type, parent, name, props = {}, extra = {}) {
    props = { ...props };
    if (props.fill === 'none') { delete props.fill; props.fills = []; }
    if (props.stroke === 'none') { delete props.stroke; props.strokes = []; }
    const j = await call('create_node', { type, parent, name, props, select: false, ...extra });
    const id = j?.id ?? j?.node?.id;
    if (id == null) throw new Error('create_node gave no id for ' + name + ': ' + JSON.stringify(j));
    return id;
  }

  const frame = (parent, name, props = {}, extra = {}) => create('frame', parent, name, { fill: 'none', ...props }, extra);
  const row = (parent, name, o = {}) => frame(parent, name, { layout: 'horizontal', sizingH: 'hug', sizingV: 'hug', crossAlign: 'center', ...o });
  const col = (parent, name, o = {}) => frame(parent, name, { layout: 'vertical', sizingH: 'hug', sizingV: 'hug', ...o });

  async function text(parent, str, o = {}) {
    const ty = TYPE[o.type || 'body'];
    const props = {
      fontFamily: ty.mono ? MONO : FONT,
      fontStyle: o.style || ty.style,
      fontSize: o.size || ty.size,
      lineHeight: (o.lh || ty.lh) + 'px',
      fill: o.color || T.text,
      textAutoResize: o.fixedWidth ? 'height' : 'widthAndHeight',
      ...(ty.mono ? {} : { features: { tnum: o.tnum !== false } }),
      ...(o.align ? { textAlign: o.align } : {}),
      ...(o.sizingH ? { sizingH: o.sizingH } : {}),
      ...(o.props || {}),
    };
    const extra = { text: str };
    if (o.fixedWidth) extra.width = o.fixedWidth;
    return create('text', parent, o.name || str.slice(0, 40), props, extra);
  }

  const rect = (parent, name, w, h, props = {}) => create('rectangle', parent, name, { ...props }, { width: w, height: h });
  const ellipse = (parent, name, w, h, props = {}, extra = {}) => create('ellipse', parent, name, { ...props }, { width: w, height: h, ...extra });
  const vec = (parent, name, path, props = {}, extra = {}) => create('vector', parent, name, { fill: 'none', strokeCap: 'round', strokeJoin: 'round', ...props }, { path, ...extra });

  async function shot(ids, path, scale = 1, maxSize = 2400) {
    const r = await f.tool('screenshot', { ids, scale, maxSize });
    const img = r.images[0];
    if (!img) throw new Error('no image: ' + r.text.slice(0, 200));
    fs.mkdirSync(path.replace(/[\\/][^\\/]*$/, ''), { recursive: true });
    fs.writeFileSync(path, Buffer.from(img.data, 'base64'));
    return path;
  }

  // ---- state glyphs: a ring plus one inner mark. Colour is passed in; the word always sits beside it.
  async function glyph(parent, state, size = 16, color) {
    const c = color || T[state === 'left' ? 'left' : state];
    const u = size / 16;
    const g = await frame(parent, 'Glyph / ' + state, {}, { width: size, height: size });
    const ringProps = { fill: 'none', stroke: c, strokeWeight: 1.75 * u, strokeAlign: 'inside' };
    await ellipse(g, 'ring', 14 * u, 14 * u, state === 'idle' ? { ...ringProps, dashes: [2.4 * u, 2.2 * u] } : ringProps, { x: 1 * u, y: 1 * u });
    const solid = { fill: c, stroke: 'none' };
    if (state === 'live') await ellipse(g, 'core', 6 * u, 6 * u, solid, { x: 5 * u, y: 5 * u });
    if (state === 'waiting') {
      await rect(g, 'bar L', 1.9 * u, 6 * u, { ...solid, cornerRadius: 1 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 5.2 * u, y: 5 * u } }));
      await rect(g, 'bar R', 1.9 * u, 6 * u, { ...solid, cornerRadius: 1 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 8.9 * u, y: 5 * u } }));
    }
    if (state === 'done') await vec(g, 'check', `M${5 * u} ${8.2 * u} L${7.2 * u} ${10.4 * u} L${11 * u} ${5.8 * u}`, { stroke: c, strokeWeight: 1.75 * u });
    if (state === 'stopped') await rect(g, 'square', 5 * u, 5 * u, { ...solid, cornerRadius: 1 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 5.5 * u, y: 5.5 * u } }));
    if (state === 'left') {
      await rect(g, 'bar', 1.9 * u, 5 * u, { ...solid, cornerRadius: 1 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 7.05 * u, y: 3.8 * u } }));
      await ellipse(g, 'dot', 2 * u, 2 * u, solid, { x: 7 * u, y: 10.2 * u });
    }
    return g;
  }

  // ---- role marks: neutral tile plus one shape per role. Shape, not colour, tells roles apart.
  async function roleMark(parent, role, size = 32) {
    const u = size / 32;
    const tile = await frame(parent, 'Role / ' + role, { fill: T.surface3, cornerRadius: 9 * u }, { width: size, height: size });
    const c = T.text;
    if (role === 'Product') await ellipse(tile, 'shape', 14 * u, 14 * u, { fill: 'none', stroke: c, strokeWeight: 2 * u, strokeAlign: 'inside' }, { x: 9 * u, y: 9 * u });
    if (role === 'Backend') await rect(tile, 'shape', 12 * u, 12 * u, { fill: c, cornerRadius: 2.5 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 10 * u, y: 10 * u } }));
    if (role === 'QA') await vec(tile, 'shape', `M${16 * u} ${8.5 * u} L${23.5 * u} ${21.5 * u} L${8.5 * u} ${21.5 * u} Z`, { stroke: c, strokeWeight: 2 * u });
    if (role === 'DevOps') await vec(tile, 'shape', `M${16 * u} ${8 * u} L${24 * u} ${16 * u} L${16 * u} ${24 * u} L${8 * u} ${16 * u} Z`, { fill: c, stroke: c, strokeWeight: 1 * u });
    if (role === 'Design') await vec(tile, 'shape', `M${9 * u} ${20 * u} L${9 * u} ${17.5 * u} C${9 * u} ${9.5 * u} ${23 * u} ${9.5 * u} ${23 * u} ${17.5 * u} L${23 * u} ${20 * u} Z`, { fill: c, stroke: c, strokeWeight: 1 * u });
    if (role === 'Frontend') await rect(tile, 'shape', 13 * u, 13 * u, { fill: 'none', stroke: c, strokeWeight: 2 * u, strokeAlign: 'inside', cornerRadius: 3.5 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 9.5 * u, y: 9.5 * u } }));
    if (role === 'Security') await vec(tile, 'shape', `M${16 * u} ${9 * u} L${16 * u} ${23 * u} M${9 * u} ${16 * u} L${23 * u} ${16 * u}`, { stroke: c, strokeWeight: 2.4 * u });
    if (role === 'Marketing') { await ellipse(tile, 'ring', 15 * u, 15 * u, { fill: 'none', stroke: c, strokeWeight: 2 * u, strokeAlign: 'inside' }, { x: 8.5 * u, y: 8.5 * u }); await ellipse(tile, 'dot', 4.5 * u, 4.5 * u, { fill: c }, { x: 13.75 * u, y: 13.75 * u }); }
    if (role === 'Content') await vec(tile, 'shape', `M${9 * u} ${11 * u} L${23 * u} ${11 * u} M${9 * u} ${16 * u} L${23 * u} ${16 * u} M${9 * u} ${21 * u} L${17 * u} ${21 * u}`, { stroke: c, strokeWeight: 2.2 * u });
    if (role === 'Support') await ellipse(tile, 'shape', 13 * u, 13 * u, { fill: c }, { x: 9.5 * u, y: 9.5 * u });
    return tile;
  }

  async function icon(parent, kind, size = 16, color) {
    const c = color || T.textSecondary;
    const u = size / 16;
    const g = await frame(parent, 'Icon / ' + kind, {}, { width: size, height: size });
    const p = { stroke: c, strokeWeight: 1.75 * u };
    if (kind === 'chevron') await vec(g, 'chevron', `M${4 * u} ${6 * u} L${8 * u} ${10 * u} L${12 * u} ${6 * u}`, p);
    if (kind === 'check') await vec(g, 'check', `M${3.5 * u} ${8.5 * u} L${6.5 * u} ${11.5 * u} L${12.5 * u} ${4.5 * u}`, p);
    if (kind === 'plus') { await vec(g, 'h', `M${3 * u} ${8 * u} L${13 * u} ${8 * u}`, p); await vec(g, 'v', `M${8 * u} ${3 * u} L${8 * u} ${13 * u}`, p); }
    if (kind === 'send') await vec(g, 'send', `M${2.5 * u} ${8 * u} L${13.5 * u} ${8 * u} M${9 * u} ${3.5 * u} L${13.5 * u} ${8 * u} L${9 * u} ${12.5 * u}`, p);
    if (kind === 'image') {
      await rect(g, 'frame', 12 * u, 10 * u, { fill: 'none', stroke: c, strokeWeight: 1.75 * u, strokeAlign: 'inside', cornerRadius: 2.5 * u }).then((id) => call('set_properties', { ids: [id], props: { x: 2 * u, y: 3 * u } }));
      await vec(g, 'hill', `M${3 * u} ${12 * u} L${6.5 * u} ${8 * u} L${9 * u} ${10.5 * u} L${11 * u} ${8.8 * u} L${13 * u} ${11 * u}`, { stroke: c, strokeWeight: 1.5 * u });
    }
    if (kind === 'folder') await vec(g, 'folder', `M${2 * u} ${5 * u} L${2 * u} ${12.5 * u} L${14 * u} ${12.5 * u} L${14 * u} ${6 * u} L${7.5 * u} ${6 * u} L${6.5 * u} ${4 * u} L${2 * u} ${4 * u} Z`, { stroke: c, strokeWeight: 1.6 * u });
    return g;
  }

  async function ensurePage(name) {
    const doc = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
    const hit = (doc.pages || []).find((p) => p.name === name);
    if (hit) {
      if ((doc.pages || []).length > 1) await f.run('page.select', { id: hit.id });
      // wipe: delete the page and add it back
      const others = (doc.pages || []).filter((p) => p.id !== hit.id);
      if (others.length) {
        await f.run('page.select', { id: others[0].id });
        await f.run('page.delete', { id: hit.id });
      }
    }
    const added = await f.run('page.add', { name });
    const doc2 = (await f.tool('inspect_document', { depth: 0, allPages: true })).json;
    const page = (doc2.pages || []).find((p) => p.name === name);
    await f.run('page.select', { id: page.id });
    await f.run('page.setBackground', { id: page.id, color: T.canvas });
    return page.id;
  }

  return { call, create, frame, row, col, text, rect, ellipse, vec, shot, glyph, roleMark, icon, ensurePage };
}
