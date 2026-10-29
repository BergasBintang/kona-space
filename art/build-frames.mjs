import { buildFrames } from "./frame.mjs";
for (const set of ["paper", "teal", "red"]) for (const size of ["lg", "sm"]) buildFrames("out", set, "#f2e9d4", size);
console.log("frames ok");
