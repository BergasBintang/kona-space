// The tray of open pages (decision 95): shown under the top bar only while a page is minimized. Each chip is a page that is alive (the one shown, and the ones the owner minimized), with its state
// as a glyph and a word, and its own X to close it. The office has no chip: it is what is there when no page is shown.
import { Glyph, type GlyphState } from "./ui";
import { IconButton } from "./Icon";

export type TrayItem = { key: string; label: string; state: GlyphState; word: string; shown: boolean };

export function PageTray({ items, minimized, max, onShow, onClose }: { items: TrayItem[]; minimized: number; max: number; onShow: (key: string) => void; onClose: (key: string) => void }) {
  return (
    <nav aria-label="Open pages" className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line-subtle bg-surface-1 px-5 py-1.5">
      <ul role="tablist" aria-label="Open pages" className="m-0 flex list-none items-center gap-2 p-0">
        {items.map((it) => (
          <li key={it.key} className={`flex items-center border ${it.shown ? "border-line-strong bg-surface-2" : "border-line-subtle"}`}>
            <button type="button" role="tab" aria-selected={it.shown} aria-label={`${it.label}, ${it.shown ? "shown" : "minimized"}, ${it.word}`} onClick={() => { if (!it.shown) onShow(it.key); }}
              className="m-0 flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2.5 py-1 text-[14px] leading-5 font-bold text-text-primary">
              <Glyph state={it.state} size={16} />
              <span>{it.label}</span>
              <span className="font-normal text-text-secondary">{it.word}</span>
            </button>
            <IconButton icon="close" label={`Close ${it.label}`} variant="ghost" onClick={() => onClose(it.key)} />
          </li>
        ))}
      </ul>
      <span className="ml-auto shrink-0 text-[13px] leading-5 text-text-tertiary">{minimized} of {max} minimized</span>
    </nav>
  );
}
