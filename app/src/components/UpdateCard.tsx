// The card that offers a new version, shows the download and says when Kona is about to restart. Nothing starts without the owner's yes.
import { Button, Glyph } from "./ui";
import { dismissUpdateError, installUpdate, postponeUpdate, useUpdate } from "../lib/update";
import { KonaMark } from "./KonaMark";

export function UpdateCard({ running }: { running: number }) {
  const u = useUpdate();
  const shown = (u.phase === "available" && !u.later) || u.phase === "downloading" || u.phase === "installing" || (u.phase === "error" && u.during === "install");
  if (!shown) return null;
  const pct = u.phase === "downloading" && u.total > 0 ? Math.min(100, Math.round((u.done / u.total) * 100)) : null;
  return (
    <div role="status" aria-label="Update" className="absolute top-6 right-6 z-10 flex w-[380px] flex-col gap-3 px-card px-shadow p-2">
      {u.phase === "available" && (
        <>
          <div className="flex items-center gap-2.5"><KonaMark size={22} /><span className="font-bold">Kona {u.version} is ready</span></div>
          {u.notes && <p className="m-0 line-clamp-3 text-[13px] leading-5 text-text-secondary">{u.notes}</p>}
          <p className="m-0 text-[14px] leading-5 text-text-secondary">
            {running > 0
              ? `${running} ${running === 1 ? "session is" : "sessions are"} running. Updating closes ${running === 1 ? "it" : "them"}, then Kona starts again by itself.`
              : "Kona closes, updates and starts again by itself. It takes about a minute."}
          </p>
          <div className="flex gap-2.5"><Button onClick={() => void installUpdate()}>Update and restart</Button><Button variant="ghost" onClick={postponeUpdate}>Later</Button></div>
        </>
      )}
      {u.phase === "downloading" && (
        <>
          <div className="flex items-center gap-2.5"><Glyph state="live" size={18} /><span className="font-bold">Downloading Kona {u.version}{pct !== null ? `: ${pct}%` : "…"}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden="true"><div className="h-full bg-accent" style={{ width: `${pct ?? 4}%` }} /></div>
        </>
      )}
      {u.phase === "error" && (
        <>
          <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={18} /><span>{u.message}</span></div>
          <p className="m-0 text-[13px] leading-5 text-text-secondary">Nothing was changed. Kona stays as it is.</p>
          <div><Button variant="ghost" onClick={dismissUpdateError}>Close</Button></div>
        </>
      )}
      {u.phase === "installing" && (
        <div className="flex items-center gap-2.5"><Glyph state="live" size={18} /><span className="font-bold">Installing Kona {u.version}. Kona restarts in a moment.</span></div>
      )}
    </div>
  );
}
