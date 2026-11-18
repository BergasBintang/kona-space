// The demo logins of a Live card, shown next to its program so that nobody is left at a sign-in page without one (decision 94b). They are the made-up accounts of the card's demo data,
// listed by the card's own setup in `accounts.json` of its data folder: a copy button for each login and password, and one line when the password is the same for all.
import { useState } from "react";
import type { DemoAccount } from "../lib/api";
import { Button } from "./ui";

const kept = (): boolean => { try { return localStorage.getItem("kona.mockups.accounts") !== "closed"; } catch { return true; } };
const keep = (open: boolean) => { try { localStorage.setItem("kona.mockups.accounts", open ? "open" : "closed"); } catch { /* not kept */ } };

export function LiveAccounts({ accounts, always = false, onClose }: { accounts: DemoAccount[]; /** shown open whatever the owner folded last (the page before the program starts) */ always?: boolean; /** given: a card laid over the corner of the area of the program, so it takes no room from it, opened and closed from the toolbar (the running program) */ onClose?: () => void }) {
  const floating = !!onClose;
  const [open, setOpen] = useState(floating || always || kept());
  const [said, setSaid] = useState<string | null>(null);
  if (accounts.length === 0) return null;
  const shared = accounts[0].password !== "" && accounts.every((a) => a.password === accounts[0].password) ? accounts[0].password : null;
  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setSaid(id); setTimeout(() => setSaid((c) => (c === id ? null : c)), 1800); } catch { setSaid("failed"); }
  };
  const toggle = floating ? (
    <span className="flex items-center justify-between gap-3">
      <span className="text-[14px] leading-5 font-bold text-text-primary">Demo accounts ({accounts.length})</span>
      <Button variant="quiet" small aria-label="Close the demo accounts" onClick={onClose}>Close</Button>
    </span>
  ) : (
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); keep(!open); }} className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[14px] leading-5 font-bold text-text-primary">
      {open ? "▾" : "▸"} Demo accounts ({accounts.length})
    </button>
  );
  const sharedLine = open && shared && (
    <span className="flex items-center gap-2">
      <span>Password for all: <span className="font-mono">{shared}</span></span>
      <Button variant="quiet" small onClick={() => void copy("all", shared)}>{said === "all" ? "Copied" : "Copy"}</Button>
    </span>
  );
  const failed = said === "failed" && <span role="alert" className="text-state-left">The clipboard could not be used.</span>;
  const rows = accounts.map((a, i) => (
    <li key={`${a.login}-${i}`} className={floating ? "flex min-w-0 flex-col gap-0.5 border-t border-line-subtle pt-1.5" : "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        {a.who && <span className="font-bold">{a.who}</span>}
        {!floating && <span className="min-w-0 truncate font-mono text-[13px]" title={a.login}>{a.login}</span>}
        {!floating && <Button variant="quiet" small aria-label={`Copy the login of ${a.who || a.login}`} onClick={() => void copy(`l${i}`, a.login)}>{said === `l${i}` ? "Copied" : "Copy"}</Button>}
      </span>
      {floating && (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-mono text-[13px]" title={a.login}>{a.login}</span>
          <Button variant="quiet" small aria-label={`Copy the login of ${a.who || a.login}`} onClick={() => void copy(`l${i}`, a.login)}>{said === `l${i}` ? "Copied" : "Copy"}</Button>
        </span>
      )}
      {!shared && a.password && (
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[13px]">{a.password}</span>
          <Button variant="quiet" small aria-label={`Copy the password of ${a.who || a.login}`} onClick={() => void copy(`p${i}`, a.password)}>{said === `p${i}` ? "Copied" : "Copy"}</Button>
        </span>
      )}
      {a.note && <span className="text-[13px] leading-4 text-text-secondary">{a.note}</span>}
    </li>
  ));
  if (floating) {
    // laid over the top right corner of the area where the program is shown, so it takes no room from the program; the toolbar's key button opens and closes it
    return (
      <section aria-label="Demo accounts" className="absolute top-3 right-3 z-20 flex max-h-[72%] w-[min(360px,calc(100%-24px))] min-w-0 flex-col gap-2 overflow-y-auto border border-line-strong bg-surface-1 px-3 py-2 text-[14px] leading-5 shadow-lg">
        {toggle}
        {sharedLine}
        {failed}
        {open && <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{rows}</ul>}
      </section>
    );
  }
  return (
    <section aria-label="Demo accounts" className="flex max-h-[34vh] min-w-0 shrink-0 flex-col gap-2 overflow-y-auto border-b border-line-subtle bg-surface-1 px-6 py-2 text-[14px] leading-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {toggle}
        {!open && <span className="text-text-secondary">Made-up logins of this demo. Open the list to copy one.</span>}
        {sharedLine}
        {failed}
      </div>
      {open && <ul className="m-0 grid list-none gap-x-4 gap-y-1 p-0" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>{rows}</ul>}
    </section>
  );
}
