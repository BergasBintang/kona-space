// The colours of the office. A material is [top, face towards +v, face towards +u] (the light comes from the top left).
export type Material = [string, string, string];

export const M: Record<string, Material> = {
  wood: ["#e0ad6c", "#b9834a", "#936339"], darkwood: ["#b07d4f", "#8a5d36", "#6c4727"], white: ["#f4efe5", "#d6d0c2", "#b7b1a3"],
  metal: ["#c4ccd6", "#97a1ad", "#76808c"], server: ["#4a5362", "#363e4b", "#2a313c"],
  leaf: ["#8fd18a", "#5ea866", "#468651"], crate: ["#d7a566", "#b08049", "#8b6137"],
  teal: ["#8ed8c9", "#5fb4a2", "#468e80"], gold: ["#f3c978", "#d09b45", "#a87a32"], red: ["#d9786a", "#b05a4d", "#8b463c"],
  blue: ["#7fb1e0", "#5b88b8", "#456a92"], paper: ["#fffaf0", "#e7dfcf", "#cfc6b4"], black: ["#3b3f46", "#2b2e34", "#20232a"],
  rose: ["#e8a79c", "#c98378", "#a5675d"],
};
export const MATERIALS = Object.keys(M);

export const OUT = "#33241a"; // the outline of everything
export const CAP = "#f3e9d2"; // the top of a low wall
export const BRICK: [string, string] = ["#9a5a46", "#8a4e3d"]; // the faces of a tall brick wall
export const CAPC: [string, string, string] = ["#efdcb8", "#d9c39a", "#bfa97f"]; // the top of a tall wall and the band under it
export const NEUTRAL_WALL = "#d8cdb6"; // a wall that belongs to no room
export const SEE = ["#9fd0e8", "#b8dff0"]; // glass

const parse = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
export const mix = (a: string, b: string, t: number): string => {
  const x = parse(a), y = parse(b);
  return "#" + x.map((v, n) => Math.round(v + (y[n] - v) * t).toString(16).padStart(2, "0")).join("");
};
export const shade = (hex: string): Material => [hex, mix(hex, "#000000", 0.18), mix(hex, "#000000", 0.34)];
Object.setPrototypeOf(M, null); // looked up with a name from a saved map: no inherited names
