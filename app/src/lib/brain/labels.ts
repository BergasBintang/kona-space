// Where the names go on the Brain map, so that no two names and no name and another dot sit on top of each other (decision: names never overlap).
// Each name tries under its dot, above it, to the right and to the left, then a little further under, over and to the sides, so the many names of a picked dot find room; a name that fits nowhere is left off
// (it still shows in the side panel). The chosen dot is placed first, then the others in the order given (the most connected first), so the names that matter win a crowded spot.

export type Box = [number, number, number, number]; // x0, y0, x1, y1 in map units
export type Placed = { x: number; y: number; anchor: "start" | "middle" | "end" };

/** What a name of this many letters needs, in map units (the map writes names at size 12, bold). */
export const nameWidth = (letters: number): number => Math.min(letters, 28) * 7.2;

const hit = (a: Box, b: Box): boolean => a[0] < b[2] + 3 && b[0] < a[2] + 3 && a[1] < b[3] + 2 && b[1] < a[3] + 2;

export function placeNames(opts: {
  pos: Map<string, { x: number; y: number }>;
  /** the dot's radius */
  radius: (id: string) => number;
  /** the dots to name, most important first; `chosen` goes before all of them and is always named */
  order: string[];
  chosen: string | null;
  /** how many letters the name of a dot has */
  letters: (id: string) => number;
  /** boxes that are already taken (the names of the groups) */
  taken?: Box[];
}): { names: Map<string, Placed>; boxes: Box[] } {
  const { pos, radius, chosen, letters } = opts;
  const taken: Box[] = [...(opts.taken ?? [])];
  const dots = [...pos].map(([id, p]) => ({ id, box: [p.x - radius(id) - 3, p.y - radius(id) - 3, p.x + radius(id) + 3, p.y + radius(id) + 3] as Box }));
  const names = new Map<string, Placed>();
  const boxes: Box[] = [];
  for (const id of [...(chosen ? [chosen] : []), ...opts.order.filter((i) => i !== chosen)]) {
    const p = pos.get(id);
    if (!p) continue;
    const r = radius(id), w = nameWidth(letters(id));
    const tries: Placed[] = [
      { x: p.x, y: p.y + r + 14, anchor: "middle" }, { x: p.x, y: p.y - r - 7, anchor: "middle" },
      { x: p.x + r + 6, y: p.y + 4, anchor: "start" }, { x: p.x - r - 6, y: p.y + 4, anchor: "end" },
      { x: p.x, y: p.y + r + 29, anchor: "middle" }, { x: p.x, y: p.y - r - 22, anchor: "middle" },
      { x: p.x + r + 6, y: p.y + 20, anchor: "start" }, { x: p.x - r - 6, y: p.y + 20, anchor: "end" }, { x: p.x + r + 6, y: p.y - 12, anchor: "start" }, { x: p.x - r - 6, y: p.y - 12, anchor: "end" },
      { x: p.x, y: p.y + r + 44, anchor: "middle" }, { x: p.x, y: p.y - r - 37, anchor: "middle" },
    ];
    const boxOf = (t: Placed): Box => { const x0 = t.anchor === "middle" ? t.x - w / 2 : t.anchor === "start" ? t.x : t.x - w; return [x0, t.y - 11, x0 + w, t.y + 3]; };
    const free = tries.find((t) => { const b = boxOf(t); return !taken.some((o) => hit(b, o)) && !dots.some((d) => d.id !== id && hit(b, d.box)); });
    const pick = free ?? (id === chosen ? tries[0] : null);
    if (!pick) continue;
    names.set(id, pick); taken.push(boxOf(pick)); boxes.push(boxOf(pick));
  }
  return { names, boxes };
}
