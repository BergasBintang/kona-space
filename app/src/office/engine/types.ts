// The map of the office, as it is saved: plain data, one map for each project (decision 57). A map is a grid of tiles. Each tile has a floor (the id of a floor style, which says
// the colour and pattern) and may hold a wall (a block as big as the tile). Things on a wall (a window, a door, a board) and things on the floor (furniture, rugs, a cat with its
// desk) are lists with a place. i runs along a row (to the right of the plan), j runs down the plan. Rows and columns are counted from 0.
export type Pattern = "tiles" | "checker" | "planks" | "stripeI" | "carpet";

/** A floor style: two colours and a pattern (decision 59). Kona ships the palette (engine/styles.ts); a map keeps the definition of every style it uses, so it draws on its own. */
export type FloorStyle = {
  id: string;
  name: string;
  floor: [string, string];
  pattern: Pattern;
  grout?: string;
};

/** The face of a wall tile a thing is on: `i+` looks towards +i, `i-` towards -i, `j+` towards +j, `j-` towards -j. */
export type Face = "i+" | "i-" | "j+" | "j-";
export type AttachKind = "window" | "door" | "art" | "doorway";
/** window, door and art hang on a wall tile (a door and art may cover `span` tiles along the wall, towards +i or +j); a doorway is an opening in a wall line, on a floor tile. */
export type Attach = { i: number; j: number; face: Face; kind: AttachKind; art?: string; span?: number };

export type Facing = 0 | 1 | 2 | 3;
/** What stands on the floor. `kind` is a key of the catalog (engine/furniture.ts); the other fields are that kind's own (size, material, role of a cat, ...). */
export type Obj = { kind: string; i: number; j: number; facing?: Facing } & Record<string, unknown>;

export type OfficeMap = {
  version: 1;
  cols: number;
  rows: number;
  /** the floor styles this map uses */
  styles: FloorStyle[];
  /** floor[j][i]: the id of a floor style, or null for no ground */
  floor: (string | null)[][];
  /** walls[j][i]: a wall block stands here */
  walls: boolean[][];
  attach: Attach[];
  objects: Obj[];
};

export const FACES: Face[] = ["i+", "i-", "j+", "j-"];
/** the plan direction a face looks towards */
export const FACE_N: Record<Face, [number, number]> = { "i+": [1, 0], "i-": [-1, 0], "j+": [0, 1], "j-": [0, -1] };
