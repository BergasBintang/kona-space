// The floor styles Kona ships (decision 59). A floor tile of a map names one of these (a map keeps the definitions it uses, so it still draws on its own); the owner paints with these
// and with nothing else, so the colours of the office stay Kona's own. A style is two colours and a pattern. The first sixteen are the floors the standard office has always had.
import type { FloorStyle } from "./types.ts";

export const STYLES: FloorStyle[] = [
  { id: "cream-tiles", name: "Cream tiles", floor: ["#e9e2d3", "#e1dac9"], pattern: "tiles", grout: "#cfc7b4" },
  { id: "white-tiles", name: "White tiles", floor: ["#f4f1ea", "#ebe7dd"], pattern: "tiles", grout: "#d9d4c6" },
  { id: "sky-tiles", name: "Sky tiles", floor: ["#a6bfd9", "#9eb7d1"], pattern: "tiles", grout: "#86a3c2" },
  { id: "sea-tiles", name: "Sea tiles", floor: ["#7fb1c4", "#76a8bc"], pattern: "tiles", grout: "#5f93a8" },
  { id: "slate-tiles", name: "Slate tiles", floor: ["#8c93a0", "#838a97"], pattern: "tiles", grout: "#6f7683" },
  { id: "midnight-tiles", name: "Midnight tiles", floor: ["#4a5565", "#424d5c"], pattern: "tiles", grout: "#303949" },
  { id: "grey-checker", name: "Grey checker", floor: ["#b9bfc6", "#a9b0b8"], pattern: "checker" },
  { id: "stone-checker", name: "Stone checker", floor: ["#aaa497", "#a29c8f"], pattern: "checker" },
  { id: "olive-checker", name: "Olive checker", floor: ["#a8b38a", "#9ea980"], pattern: "checker" },
  { id: "sand-planks", name: "Sand planks", floor: ["#dcbf8f", "#d4b787"], pattern: "planks" },
  { id: "honey-planks", name: "Honey planks", floor: ["#efd68c", "#e7ce84"], pattern: "planks" },
  { id: "oak-planks", name: "Oak planks", floor: ["#c99a62", "#c0915a"], pattern: "planks" },
  { id: "walnut-planks", name: "Walnut planks", floor: ["#8e633f", "#855b38"], pattern: "planks" },
  { id: "blush-planks", name: "Blush planks", floor: ["#e8c4bc", "#e0bab2"], pattern: "planks" },
  { id: "periwinkle-stripes", name: "Periwinkle stripes", floor: ["#9aa6cc", "#8f9bc3"], pattern: "stripeI" },
  { id: "apricot-stripes", name: "Apricot stripes", floor: ["#efc88f", "#e6bd82"], pattern: "stripeI" },
  { id: "plum-stripes", name: "Plum stripes", floor: ["#a98bc0", "#9f80b8"], pattern: "stripeI" },
  { id: "sage-carpet", name: "Sage carpet", floor: ["#9fb59a", "#97ae92"], pattern: "carpet" },
  { id: "mint-carpet", name: "Mint carpet", floor: ["#93d3c3", "#8bcbbb"], pattern: "carpet" },
  { id: "lavender-carpet", name: "Lavender carpet", floor: ["#cdb4dc", "#c4abd4"], pattern: "carpet" },
  { id: "mauve-carpet", name: "Mauve carpet", floor: ["#b3a8bd", "#aaa0b5"], pattern: "carpet" },
  { id: "rose-carpet", name: "Rose carpet", floor: ["#eba596", "#e39d8e"], pattern: "carpet" },
  { id: "butter-carpet", name: "Butter carpet", floor: ["#f2e3a6", "#ebdb9c"], pattern: "carpet" },
  { id: "charcoal-carpet", name: "Charcoal carpet", floor: ["#5a5f69", "#525760"], pattern: "carpet" },
];

export const styleById = (id: string): FloorStyle | undefined => STYLES.find((s) => s.id === id);

/** The rug colours Kona offers, a fill and an edge: the ones the office has always had, and one more. */
export const RUG_PAIRS: { name: string; c: string; c2: string }[] = [
  { name: "Mint", c: "#c6ece2", c2: "#2f8f7c" },
  { name: "Lilac", c: "#e6d6ee", c2: "#8d6aa8" },
  { name: "Plum", c: "#7f5a8a", c2: "#5c3f66" },
  { name: "Sky", c: "#d3e1ef", c2: "#4f7aa6" },
  { name: "Peach", c: "#f3c9bd", c2: "#c4574a" },
  { name: "Cream", c: "#f7e9b8", c2: "#b8922a" },
  { name: "Terracotta", c: "#b56a4a", c2: "#8f4f36" },
  { name: "Sage", c: "#7f9a8e", c2: "#5e7a6e" },
  { name: "Walnut", c: "#8b5e3c", c2: "#5e3f27" },
  { name: "Slate", c: "#b6bcc8", c2: "#5a6478" },
];
