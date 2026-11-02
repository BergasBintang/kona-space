// A picture of a piece of furniture for the editor's list: the real drawing, cut out, shown at a whole number of screen pixels for each pixel of the drawing. A cat is drawn from the cat sheet.
import { useEffect, useRef, useState } from "react";
import { canvasOf, loadSheets, type Sheets } from "./Office";
import { CAT_H, CAT_W, FRAME_NAMES, catRow } from "./ui";
import { thumbOf, type Thumb as Picture } from "../office/engine/thumb";
import type { Obj } from "../office/engine/types";

const BOX_W = 84, BOX_H = 60;

/** A piece of furniture. */
export function Thumb({ obj, dim = false }: { obj: Obj; dim?: boolean }) {
  return <Pic t={thumbOf(obj)} dim={dim} fallback={String(obj.c ?? "#c6ece2")} />;
}

/** Any picture made by engine/thumb.ts: furniture, a wall, a doorway, something on a wall. */
export function Pic({ t, dim = false, fallback = "#c6ece2" }: { t: Picture | null; dim?: boolean; fallback?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [art, setArt] = useState<Sheets | null>(null);
  useEffect(() => { if (!t?.cat) return; let live = true; loadSheets().then((a) => { if (live) setArt(a); }).catch(() => {}); return () => { live = false; }; }, [t]);
  const x0 = t ? Math.min(t.img?.ox ?? 1e9, t.cat?.x ?? 1e9) : 0, y0 = t ? Math.min(t.img?.oy ?? 1e9, t.cat?.y ?? 1e9) : 0;
  const x1 = t ? Math.max(t.img ? t.img.ox + t.img.w : -1e9, t.cat ? t.cat.x + CAT_W : -1e9) : 1, y1 = t ? Math.max(t.img ? t.img.oy + t.img.h : -1e9, t.cat ? t.cat.y + CAT_H : -1e9) : 1;
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), k = Math.max(1, Math.min(2, Math.floor(Math.min(BOX_W / w, BOX_H / h))));
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !t) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    if (t.img) ctx.drawImage(canvasOf(t.img), t.img.ox - x0, t.img.oy - y0);
    if (t.cat && art) ctx.drawImage(art.sheet, FRAME_NAMES.indexOf("idle") * CAT_W, catRow(t.cat.role, t.cat.dir) * CAT_H, CAT_W, CAT_H, t.cat.x - x0, t.cat.y - y0, CAT_W, CAT_H);
  }, [t, art, w, h, x0, y0]);
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden border border-line-subtle bg-ground" style={{ width: BOX_W, height: BOX_H, opacity: dim ? 0.4 : 1, filter: dim ? "grayscale(1)" : undefined }}>
      {t ? <canvas ref={canvas} width={w} height={h} className="pixel" aria-hidden style={{ width: w * k, height: h * k, imageRendering: "pixelated" }} /> : <i className="inline-block size-6 border border-line-strong" style={{ background: fallback }} />}
    </span>
  );
}
