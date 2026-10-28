// Add a project: pick the folder, name it. Kona adds a hidden folder for its notes and tells Git to ignore it.
import { useState } from "react";
import { addProject, baseName, pickFolder, type AddResult } from "../lib/api";
import { Button, Glyph } from "./ui";
import { Help } from "./Help";
import { KonaMark } from "./KonaMark";

export function AddProject({ first, onDone, onCancel }: { first: boolean; onDone: (r: AddResult) => void; onCancel: () => void }) {
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [github, setGithub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    const p = await pickFolder("Pick the folder of the project");
    if (p) { setFolder(p); setName((n) => n || baseName(p)); setError(null); }
  };
  const add = async () => {
    setBusy(true); setError(null);
    try { onDone(await addProject(folder, name.trim() || undefined, github.trim() || undefined)); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-1 overflow-y-auto p-8">
      <div className="m-auto flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex items-center gap-3"><KonaMark size={36} /><h1 className="m-0 text-[30px] leading-[38px] font-bold">{first ? "Add your first project" : "Add a project"}</h1><Help title="What a project is"><p className="m-0">A project is one folder with your code in it.</p><p className="m-0">Kona adds a hidden folder inside it for notes and tickets, and tells Git to ignore that folder. Nothing else in your project is changed.</p></Help></div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Folder</span>
          <div className="flex gap-3">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-control border border-line-strong bg-inset px-3.5 font-mono text-[14px]">
              <span className={`truncate ${folder ? "" : "text-text-tertiary"}`}>{folder || "No folder picked yet"}</span>
            </div>
            <Button variant="quiet" onClick={choose}>Choose a folder</Button>
          </div>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="shop-api" className="h-11 rounded-control border border-line-strong bg-inset px-3.5 text-[15px] text-text placeholder:text-text-tertiary" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] leading-5 font-bold text-text-secondary">GitHub address (optional)</span>
          <input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="owner/name" aria-label="GitHub address" className="h-11 rounded-control border border-line-strong bg-inset px-3.5 font-mono text-[15px] text-text placeholder:text-text-tertiary" />
        </label>
        {error && <div className="flex items-start gap-2.5 text-[13px] leading-5 text-state-left"><Glyph state="left" size={16} /> {error}</div>}
        <div className="flex justify-end gap-3">
          {!first && <Button variant="quiet" onClick={onCancel}>Cancel</Button>}
          <Button onClick={add} disabled={!folder || busy}>{busy ? "Adding…" : "Add project"}</Button>
        </div>
      </div>
    </div>
  );
}
