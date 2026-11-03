// Kona's small icons, in the same pixel look as the glyphs of ui.tsx: each one is drawn on a 16 x 16 grid with hard edges, in one colour (the text colour of its button),
// and shown at 16 px or 32 px so that every pixel stays square. An icon has no words: the button that holds it carries the name (aria-label and title).
import type { ButtonHTMLAttributes } from "react";
import { Button } from "./ui";

type Draw = (p: (x: number, y: number) => void) => void;
const N = 16;

// the pixels of a drawing, moved so that the drawing sits in the middle of the 16 x 16 square (a drawing of an odd width is one pixel left of the middle)
const path = (draw: Draw) => {
  const pts: [number, number][] = [];
  draw((x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) pts.push([x, y]); });
  if (pts.length === 0) return "";
  const x0 = Math.min(...pts.map((q) => q[0])), x1 = Math.max(...pts.map((q) => q[0])), y0 = Math.min(...pts.map((q) => q[1])), y1 = Math.max(...pts.map((q) => q[1]));
  const dx = Math.floor((N - (x1 - x0 + 1)) / 2) - x0, dy = Math.floor((N - (y1 - y0 + 1)) / 2) - y0;
  const on = new Set(pts.map(([x, y]) => (y + dy) * N + (x + dx)));
  let d = "";
  for (const v of on) d += `M${v % N} ${Math.floor(v / N)}h1v1h-1z`;
  return d;
};
const rect = (p: (x: number, y: number) => void, x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p(x, y); };
const line = (p: (x: number, y: number) => void, x0: number, y0: number, x1: number, y1: number) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) p(x0 + ((x1 - x0) * k) / (n || 1), y0 + ((y1 - y0) * k) / (n || 1)); };
const art = (rows: string[]): Draw => (p) => rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") p(x, y); }));
const flip = (d: Draw): Draw => (p) => d((x, y) => p(N - 1 - x, y));

/** a magnifier; `plus` puts a plus in it, otherwise a minus */
const magnifier = (plus: boolean): Draw => (p) => {
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const d = Math.hypot(x + 0.5 - 6.5, y + 0.5 - 6.5); if (d >= 3.7 && d <= 5.5) p(x, y); }
  for (let k = 0; k < 4; k++) { p(10 + k, 10 + k); p(11 + k, 10 + k); p(10 + k, 11 + k); }
  rect(p, 4, 6, 9, 7);
  if (plus) rect(p, 6, 4, 7, 9);
};

/** an arrow that goes round, clockwise: the head is at the end of the arc */
const turnRight: Draw = art([
  "................",
  "....#####.......",
  "..###...###.....",
  ".##.......##....",
  ".##........##...",
  ".##........##...",
  ".##........##...",
  ".##......######.",
  ".##.......####..",
  ".##........##...",
  ".##.............",
  "..###...........",
  "....#####.......",
  "................",
  "................",
  "................",
]);

const undo: Draw = art([
  "................",
  "................",
  "...#............",
  "..##............",
  ".########.......",
  "..##.....##.....",
  "...#......##....",
  "..........##....",
  "..........##....",
  ".........##.....",
  "......####......",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

const ICONS = {
  select: art([
    "#...............",
    "##..............",
    "###.............",
    "####............",
    "#####...........",
    "######..........",
    "#######.........",
    "########........",
    "#########.......",
    "######..........",
    "##.###..........",
    "#..###..........",
    "....###.........",
    "....###.........",
    ".....##.........",
    "................",
  ]),
  trash: art([
    "................",
    ".....######.....",
    ".....#....#.....",
    "..############..",
    "..############..",
    "................",
    "...##########...",
    "...##.#..#.##...",
    "...##.#..#.##...",
    "...##.#..#.##...",
    "...##.#..#.##...",
    "...##.#..#.##...",
    "...##.#..#.##...",
    "...##########...",
    "................",
    "................",
  ]),
  zoomIn: magnifier(true),
  zoomOut: magnifier(false),
  undo,
  redo: flip(undo),
  turnLeft: flip(turnRight),
  turnRight,
  save: (p) => { // a floppy disk: the outline, the shutter at the top and the label at the bottom
    for (let k = 2; k <= 13; k++) { p(k, 2); p(k, 13); p(2, k); p(13, k); }
    rect(p, 5, 2, 10, 5); rect(p, 4, 8, 11, 8); rect(p, 4, 8, 4, 13); rect(p, 11, 8, 11, 13);
  },
  close: (p) => { for (let k = 0; k < 2; k++) { line(p, 3 + k, 3, 12 + k, 12); line(p, 12 + k, 3, 3 + k, 12); } },
  centre: (p) => { // a small square with a plus in it, and a tick on each side
    for (let k = 4; k <= 11; k++) { p(k, 4); p(k, 11); p(4, k); p(11, k); }
    rect(p, 6, 7, 9, 8); rect(p, 7, 6, 8, 9);
    rect(p, 7, 0, 8, 2); rect(p, 7, 13, 8, 15); rect(p, 0, 7, 2, 8); rect(p, 13, 7, 15, 8);
  },
  pen: (p) => { // a pencil on a slant (the end that rubs out, then the body, then the point at the lower left), and the line it writes
    for (let k = 0; k <= 6; k++) { if (k === 1) continue; const x = 12 - k, y = 1 + k; for (let d = 0; d < 4; d++) p(x + d, y); }
    for (let d = 0; d < 3; d++) p(5 + d, 8); for (let d = 0; d < 2; d++) p(4 + d, 9); p(3, 10); p(4, 10);
    rect(p, 2, 13, 13, 14);
  },
  required: (p) => { // a ring with an asterisk in it: this part is needed
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); if (d >= 5.6 && d <= 7.6) p(x, y); }
    rect(p, 7, 4, 8, 11); rect(p, 4, 7, 11, 8); p(5, 5); p(10, 5); p(5, 10); p(10, 10);
  },
  // the clues over the pieces of the office that open a screen: what the screen is about, drawn small
  bulb: (p) => { // the brain: an idea
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 6); if (d >= 3.6 && d <= 5.2 && !(y > 8 && Math.abs(x - 7.5) < 3.2)) p(x, y); }
    rect(p, 6, 10, 9, 10); rect(p, 6, 12, 9, 12); rect(p, 7, 14, 8, 14); rect(p, 6, 10, 6, 12); rect(p, 9, 10, 9, 12);
  },
  folder: (p) => { for (let k = 2; k <= 13; k++) { p(k, 5); p(k, 13); } for (let k = 5; k <= 13; k++) { p(2, k); p(13, k); } for (let k = 2; k <= 6; k++) p(k, 3); p(2, 4); p(7, 4); p(6, 4); rect(p, 4, 8, 11, 8); },
  server: (p) => { for (const y0 of [2, 6, 10]) { for (let k = 2; k <= 13; k++) { p(k, y0); p(k, y0 + 3); } p(2, y0 + 1); p(2, y0 + 2); p(13, y0 + 1); p(13, y0 + 2); p(4, y0 + 1); p(4, y0 + 2); rect(p, 9, y0 + 1, 11, y0 + 1); } },
  coin: (p) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); if (d >= 5.6 && d <= 7.5) p(x, y); }
    rect(p, 7, 3, 8, 4); rect(p, 6, 5, 9, 5); rect(p, 6, 6, 6, 7); rect(p, 6, 7, 9, 7); rect(p, 9, 8, 9, 9); rect(p, 6, 10, 9, 10); rect(p, 7, 11, 8, 12);
  },
  key: (p) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 5, y + 0.5 - 5); if (d >= 1.7 && d <= 3.6) p(x, y); }
    for (let k = 0; k <= 6; k++) { p(8 + k, 8 + k); p(9 + k, 8 + k); } p(11, 14); p(11, 13); p(13, 12); p(14, 12);
  },
  gear: (p) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); if (d >= 2.4 && d <= 5.2) p(x, y); }
    rect(p, 7, 1, 8, 3); rect(p, 7, 12, 8, 14); rect(p, 1, 7, 3, 8); rect(p, 12, 7, 14, 8); for (const [x, y] of [[3, 3], [4, 3], [3, 4], [11, 3], [12, 3], [12, 4], [3, 11], [3, 12], [4, 12], [12, 11], [11, 12], [12, 12]]) p(x, y);
  },
  crate: (p) => { // leftovers: a box with things sticking out of it
    for (let k = 2; k <= 13; k++) { p(k, 7); p(k, 13); } for (let k = 7; k <= 13; k++) { p(2, k); p(13, k); } rect(p, 2, 10, 13, 10);
    line(p, 5, 6, 7, 2); line(p, 6, 6, 8, 2); line(p, 10, 6, 11, 3); line(p, 11, 6, 12, 3);
  },
  flow: (p) => {
    for (const [x0, y0, x1, y1] of [[1, 2, 5, 6], [10, 2, 14, 6], [5, 10, 10, 14]]) { for (let k = x0; k <= x1; k++) { p(k, y0); p(k, y1); } for (let k = y0; k <= y1; k++) { p(x0, k); p(x1, k); } }
    rect(p, 6, 4, 9, 4); p(8, 3); p(8, 5); rect(p, 12, 7, 12, 8); rect(p, 7, 8, 12, 8); rect(p, 7, 8, 7, 9);
  },
  board: (p) => { // the tickets: a card with a pin and notes
    for (let k = 2; k <= 13; k++) { p(k, 3); p(k, 13); } for (let k = 3; k <= 13; k++) { p(2, k); p(13, k); }
    rect(p, 7, 1, 8, 2); rect(p, 4, 5, 6, 7); rect(p, 8, 5, 11, 6); rect(p, 8, 8, 11, 8); rect(p, 4, 9, 7, 11);
  },
  branch: (p) => { line(p, 8, 14, 8, 8); line(p, 8, 8, 4, 3); line(p, 8, 8, 12, 3); rect(p, 3, 1, 5, 2); rect(p, 11, 1, 13, 2); rect(p, 7, 14, 9, 15); },
  plus: (p) => { rect(p, 7, 3, 8, 12); rect(p, 3, 7, 12, 8); },
  // the buttons of a conversation: end it, start a new one, open an old one again
  stop: (p) => { // a ring with a square in it: stop
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); if (d >= 5.6 && d <= 7.5) p(x, y); }
    rect(p, 5, 5, 10, 10);
  },
  newChat: (p) => { // a speech bubble with a plus in it: a new conversation
    for (let k = 1; k <= 14; k++) { p(k, 1); p(k, 11); } for (let k = 1; k <= 11; k++) { p(1, k); p(14, k); }
    rect(p, 3, 12, 5, 12); rect(p, 3, 13, 4, 13); p(3, 14);
    rect(p, 7, 3, 8, 9); rect(p, 4, 5, 11, 6);
  },
  compress: art([ // two arrows that meet in the middle: make the memory smaller
    "................",
    ".......##.......",
    ".......##.......",
    "....########....",
    ".....######.....",
    "......####......",
    ".......##.......",
    "................",
    "................",
    ".......##.......",
    "......####......",
    ".....######.....",
    "....########....",
    ".......##.......",
    ".......##.......",
    "................",
  ]),
  play: (p) => { for (let y = 0; y < 12; y++) rect(p, 4, 2 + y, 4 + Math.ceil(Math.min(y + 1, 12 - y) * 1.4) - 1, 2 + y); }, // a triangle that points on: pick it up again
} satisfies Record<string, Draw>;

export type IconName = keyof typeof ICONS;
const cache = new Map<string, string>();
const dOf = (n: IconName) => { let d = cache.get(n); if (d === undefined) { d = path(ICONS[n]); cache.set(n, d); } return d; };

export function Icon({ name, size = 16 }: { name: IconName; size?: 16 | 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0" shapeRendering="crispEdges" fill="currentColor">
      <path d={dOf(name)} />
    </svg>
  );
}

/** A square button that holds only an icon. `label` names it for the screen reader and the hover. */
export function IconButton({ icon, label, variant = "quiet", ...rest }: { icon: IconName; label: string; variant?: "primary" | "quiet" | "ghost" | "danger" } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <Button small variant={variant} aria-label={label} title={rest.title ?? label} {...rest} className={`w-11 px-0! ${rest.className ?? ""}`}><Icon name={icon} /></Button>
  );
}
