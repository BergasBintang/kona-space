import { buildFrames } from "./frame.mjs";
buildFrames("out", "wood", "#2b3340");
for (const set of ["paper", "teal", "red"]) for (const size of ["lg", "sm"]) buildFrames("out", set, "#f2e9d4", size);
console.log("frames ok");
