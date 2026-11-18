// The tray of open pages (decision 95): drawn INSIDE the top bar, in the empty stretch between the project's name and the plan bars, so that it takes no height from the page below it. Each chip is a
// page that is alive (the one shown, and the ones the owner minimized), a glyph, its name, and its own X to close it; its state in words is in its tooltip and its label (the glyph carries it
// in the bar). Only shown while a page is minimized. The office has no chip: it is what is there when no page is shown.
import { Glyph, type GlyphState } from "./ui";
import { IconButton } from "./Icon";

export type TrayItem = { key: string; label: string; state: GlyphState; word: string; shown: boolean };

export function PageTray({ items, minimized, max, onShow, onClose }: { items: TrayItem[]; minimized: number; max: number; onShow: (key: string) => void; onClose: (key: string) => void }) {
  return (
    <nav aria-label="Open pages" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
      <ul role="tablist" aria-label="Open pages" className="m-0 flex list-none items-center gap-1.5 p-0">
        {items.map((it) => (
          <li key={it.key} title={`${it.label}: ${it.word}${it.shown ? " (shown)" : " (minimized)"}`} className={`flex shrink-0 items-center border ${it.shown ? "border-line-strong bg-surface-2" : "border-line-subtle"}`}>
            <button type="button" role="tab" aria-selected={it.shown} aria-label={`${it.label}, ${it.shown ? "shown" : "minimized"}, ${it.word}`} onClick={() => { if (!it.shown) onShow(it.key); }}
              className="m-0 flex cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1 pr-1 pl-2 text-[13px] leading-5 font-bold whitespace-nowrap text-text-primary">
              <Glyph state={it.state} size={16} />
              <span>{it.label}</span>
            </button>
            <IconButton icon="close" label={`Close ${it.label}`} variant="ghost" onClick={() => onClose(it.key)} />
          </li>
        ))}
      </ul>
      <span data-count title={`${minimized} of ${max} pages minimized`} className="shrink-0 text-[12px] leading-4 text-text-tertiary">{minimized}/{max}</span>
    </nav>
  );
}
