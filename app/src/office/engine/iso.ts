// The camera. The building is drawn from four sides (a quarter turn each). In the camera's own space u runs down-right on the screen and v runs down-left; a tile of
// the plan (i, j) is a tile of that space (u, v), and `rot` / `unrot` say which. A tile is 32 x 16 pixels, a unit of height is a step of 4 pixels.
export const TILE_W = 32, TILE_H = 16, STEP = 4;
export const WALL = 8 * STEP; // a tall brick wall (the back of the building)
export const LOW = 2 * STEP; // a low wall (everything else: a cut-away, so a wall hides little)
export const OY = WALL + 10; // room above the highest wall

/** positions snap to 1/8 of a tile: a slanted edge then has clean, even steps */
export const q = (v: number) => Math.round(v * 8) / 8;

export class Iso {
  cols: number;
  rows: number;
  view: number;
  /** the size of the camera's grid */
  U: number;
  V: number;
  OX: number;
  width: number;
  height: number;
  constructor(cols: number, rows: number, view: number) {
    this.cols = cols; this.rows = rows; this.view = ((view % 4) + 4) % 4;
    [this.U, this.V] = this.view % 2 ? [rows, cols] : [cols, rows];
    this.OX = this.V * 16 + 16;
    this.width = (this.U + this.V) * 16 + 32;
    this.height = OY + (this.U + this.V) * 8 + 16;
  }
  /** where a point of the plan lies for the camera */
  rot = (i: number, j: number): [number, number] => {
    const { view, cols, rows } = this;
    return view === 0 ? [i, j] : view === 1 ? [rows - j, i] : view === 2 ? [cols - i, rows - j] : [j, cols - i];
  };
  /** the tile of the camera's grid for a tile of the plan, and back */
  cell = (i: number, j: number): [number, number] => {
    const { view, cols, rows } = this;
    return view === 0 ? [i, j] : view === 1 ? [rows - 1 - j, i] : view === 2 ? [cols - 1 - i, rows - 1 - j] : [j, cols - 1 - i];
  };
  unCell = (u: number, v: number): [number, number] => {
    const { view, cols, rows } = this;
    return view === 0 ? [u, v] : view === 1 ? [v, rows - 1 - u] : view === 2 ? [cols - 1 - u, rows - 1 - v] : [cols - 1 - v, u];
  };
  /** the screen place of a point of the camera's space, at height z */
  PR = (u: number, v: number, z = 0): [number, number] => [this.OX + (q(u) - q(v)) * 16, OY + (q(u) + q(v)) * 8 - Math.round(z)];
  /** the screen place of a point of the plan */
  P = (i: number, j: number, z = 0): [number, number] => this.PR(...this.rot(i, j), z);
  /** how far from the back a point of the plan is: the order of drawing */
  D = (i: number, j: number): number => { const [u, v] = this.rot(i, j); return u + v; };
  /** the box on the ground of a rectangle of the plan [i, j, width, depth], in the camera's space: [u0, u1, v0, v1] */
  foot = (i: number, j: number, w: number, d: number, shrink = 0): [number, number, number, number] => {
    const c = [[i, j], [i + w, j], [i, j + d], [i + w, j + d]].map(([a, b]) => this.rot(a, b));
    return [Math.min(...c.map((p) => p[0])) + shrink, Math.max(...c.map((p) => p[0])) - shrink, Math.min(...c.map((p) => p[1])) + shrink, Math.max(...c.map((p) => p[1])) - shrink];
  };
}
