// The Kona mark: the face of the orange cat, drawn in pixels (art/build-logo.mjs, 16 x 16). Shown at 16, 32 or 64 px so every pixel stays square.
import logo from "../assets/logo.png";

export function KonaMark({ size = 24, title }: { size?: number; title?: string }) {
  const s = size < 24 ? 16 : size < 48 ? 32 : 64;
  return <img src={logo} width={s} height={s} alt={title ?? ""} aria-hidden={title ? undefined : true} draggable={false} className="pixel shrink-0" />;
}
