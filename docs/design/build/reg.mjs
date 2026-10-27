// A small file that remembers ids between build scripts: screens, component sets and pending prototype links.
import fs from 'node:fs';
const FILE = new URL('./registry.json', import.meta.url);
export const blank = () => ({ screens: {}, sets: {}, pending: [], stage: null });
export const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return blank(); } };
export const save = (r) => fs.writeFileSync(FILE, JSON.stringify(r, null, 1));
export const reset = () => save(blank());
