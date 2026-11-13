// The Journey view of the Brain (ticket T-0037, decision 91): the path a person takes through the product, drawn from the one note of kind `journey`.
// Lanes run left to right as rows (Person, App, Server by default); each step is a box whose shape, mark and word say who acts; a line is the way on, with the
// choice written on it; a dashed line is an error branch. A click on a box opens its details in a dialog. The table under the map lists the same steps.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Brain } from "../../lib/brain/engine.ts";
import { journeyNotes, parseJourney, type Actor, type Journey, type Problem, type Step } from "../../lib/brain/journey.ts";
import { layoutJourney, stepsFor } from "../../lib/brain/journeylayout.ts";
import { Button, Glyph } from "../ui";
import { Confirm } from "../Confirm";
import { Chevron } from "../Files";
import { IconButton } from "../Icon";
import { Select } from "../pick";
import { Help } from "../Help";
import { ACTOR_WORD, ActorMark, Defs, EdgeLabel, EdgeLine, labelFree, STATUS_GLYPH, STATUS_WORD, StepBox } from "./JourneyArt";
import { JourneyTable } from "./JourneyTable";
import { checkText, staleness, ticketFact, type CardFact, type Stale, type TicketFact } from "../../lib/brain/journeystale.ts";
import { compareMarkers, placeOf, withDrafts, type Marker, type Scan } from "../../lib/brain/journeymarks.ts";
import { journeyCheck, journeyMarkers, listTickets, mockCards, mockPageText } from "../../lib/api";
import { journeyCheckPrompt, pagesToRead, readJourneyCheck, type Verdicts } from "../../lib/brain/journeyai.ts";

/** the last scan of each project's code, kept while Kona is open so leaving the page and coming back does not scan again */
const scans = new Map<string, Scan>();

const KINDS_ALL = "";
const KIND_H = 30; // room under the last lane for a loop line
const LANE_W = 104; // the column with the names of the lanes
const GROUP_MIN = 4; // the same warning about this many steps is shown as one line

export function JourneyView({ projectId, accountId, brain, onOpen }: { projectId: string; accountId: string | null; brain: Brain; onOpen: (id: string) => void }) {
  const notes = useMemo(() => journeyNotes(brain.notes.values()).sort((a, b) => a.title.localeCompare(b.title)), [brain]);
  const [which, setWhich] = useState<string | null>(null);
  const [kind, setKind] = useState(KINDS_ALL);
  const note = notes.find((n) => n.id === which) ?? notes[0] ?? null;
  const read = useMemo(() => (note ? parseJourney(note.raw) : null), [note]);
  const journey = read?.journey ?? null;
  const [scan, setScan] = useState<Scan | null>(() => scans.get(projectId) ?? null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  useEffect(() => { setScan(scans.get(projectId) ?? null); setScanError(null); }, [projectId]);
  const marks = useMemo(() => (journey && scan ? compareMarkers(journey, scan) : null), [journey, scan]);
  // a marker the map does not know is drawn as a draft step, in a lane of its own
  const shown = useMemo(() => (journey && marks ? withDrafts(journey, marks.missing) : journey), [journey, marks]);
  const draftIds = useMemo(() => new Set(marks?.missing.map((m) => m.id) ?? []), [marks]);
  // a kind of user is picked: only the steps that kind can reach are drawn and laid out again, so the map shrinks to that person's path
  const drawn = useMemo(() => (shown ? (kind === KINDS_ALL ? shown : { ...shown, steps: stepsFor(shown, kind) }) : null), [shown, kind]);
  // the table lists the steps of the note (not the drafts found in the code), for the kind of user that is picked
  const tableOf = useMemo(() => (journey ? (kind === KINDS_ALL ? journey : { ...journey, steps: stepsFor(journey, kind) }) : null), [journey, kind]);
  const layout = useMemo(() => (drawn ? layoutJourney(drawn) : null), [drawn]);
  const problems = read?.problems ?? [];
  const errors = problems.filter((p) => p.level === "error");
  // what the staleness rule needs from outside the note: the project's tickets and its Mockups cards (a project with neither just has nothing to compare)
  const [facts, setFacts] = useState<{ tickets: TicketFact[]; cards: CardFact[] }>({ tickets: [], cards: [] });
  useEffect(() => {
    let live = true;
    Promise.all([listTickets(projectId).catch(() => []), mockCards(projectId).catch(() => [])]).then(([t, c]) => {
      if (live) setFacts({ tickets: t.map(ticketFact), cards: c.map((x) => ({ id: x.id, modified: x.modified ?? null })) });
    });
    return () => { live = false; };
  }, [projectId, brain]);
  const stale = useMemo<Stale[]>(() => {
    if (!journey || !note) return [];
    const noPage = (marks?.noPage ?? []).map((id): Stale => ({ step: id, level: "flag", text: `No page found: no file says kona-step: ${id}` }));
    return [...staleness(journey, { stamped: note.tickets, ...facts }), ...noPage];
  }, [journey, note, facts, marks]);
  const checks = useMemo(() => checkText(stale), [stale]);
  const flagged = useMemo(() => new Set([...problems.map((p) => p.step), ...stale.filter((s) => s.level === "flag").map((s) => s.step)].filter(Boolean)), [problems, stale]);

  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showMarks, setShowMarks] = useState(false);
  // the on-request check of the names (decision 91, T-0041): one cheap Haiku call, asked first because it uses a little of the plan
  const [ai, setAi] = useState<null | { stage: "ask" | "running" | "done"; error?: string; answer?: string; verdicts?: Verdicts; pages?: Map<string, string> }>(null);
  const runAi = async () => {
    if (!journey) return;
    setAi({ stage: "running" });
    try {
      const pages = new Map<string, string>();
      await Promise.all(pagesToRead(journey).map(async (s) => { const text = await mockPageText(projectId, s.mockup).catch(() => null); if (text) pages.set(s.id, text); }));
      const { prompt, withText } = journeyCheckPrompt(journey, pages);
      const answer = await journeyCheck(projectId, accountId, prompt);
      setAi({ stage: "done", answer, pages, verdicts: readJourneyCheck(answer, withText, journey.steps.map((s) => s.id)) });
    } catch (e) { setAi({ stage: "ask", error: String(e) }); }
  };
  const [zoom, setZoom] = useState<number | null>(null); // null: the readable size, fitted to the width
  const [width, setWidth] = useState(0);
  const [high, setHigh] = useState(typeof window === "undefined" ? 900 : window.innerHeight);
  useEffect(() => { const f = () => setHigh(window.innerHeight); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setPicked(null); setHover(null); setKind(KINDS_ALL); setZoom(null); }, [note?.id]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout === null, drawn?.steps.length === 0]);

  if (notes.length === 0) {
    return <p className="m-0 text-text-tertiary">There is no journey in this project yet.</p>;
  }
  if (!note || !read) return null;
  if (!journey || !layout) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> <span>The journey note “{note.title}” cannot be read: {errors[0]?.text ?? "it has a mistake"}</span></div>
        <div><Button variant="quiet" onClick={() => onOpen(note.id)}>Open the note</Button></div>
      </div>
    );
  }

  // a map that does not fit at a readable size is shown at that size and scrolls inside its box (a long path of 120 steps is wider than any window)
  const fit = width > 0 ? Math.min(1, Math.max(0.55, (width - LANE_W - 8) / layout.width)) : 1;
  // the whole map in the window, however small that makes it: the box is at most 62% of the window high
  const fitAll = width > 0 ? Math.max(0.1, Math.min(1, (width - LANE_W - 8) / layout.width, (Math.max(280, high * 0.62) - 4) / (layout.height + KIND_H))) : 1;
  const scale = zoom ?? fit;
  const atAll = Math.abs(scale - fitAll) < 0.005;
  const active = hover ?? picked;
  // a menu is pointed at: its lines are fine and have no words, and the steps it opens are marked while the rest is paler, so the many lines read as one fan
  const hubActive = active !== null && (layout.hidden.get(active) ?? 0) > 0;
  const linked = new Set<string>();
  if (hubActive) for (const e of layout.edges) if (e.hub && (e.from === active || e.to === active)) { linked.add(e.from); linked.add(e.to); }
  // the lanes run the whole width of the box, not only as far as the last step
  const roomW = width > 0 ? Math.max(layout.width, (width - LANE_W) / scale) : layout.width;
  const view = shown ?? journey;
  const stepOf = (id: string) => view.steps.find((s) => s.id === id);
  const runScan = () => {
    setScanning(true); setScanError(null);
    journeyMarkers(projectId).then((s) => { scans.set(projectId, s); setScan(s); }).catch((e) => setScanError(String(e))).finally(() => setScanning(false));
  };
  const pickedStep = picked ? stepOf(picked) ?? null : null;
  const laneActor = (s: Step) => s.actor ?? journey.lanes.find((l) => l.id === s.lane)?.actor ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="m-0 truncate text-[20px] leading-7 font-bold">{journey.title || note.title}</h2>
          <Help title="Journey">
            <p className="m-0">The path a person takes through the product, drawn from one note. Each row is a lane. Read the Person lane to follow what someone sees and clicks; read all lanes for the screens and the work behind them.</p>
            <p className="m-0">A box says who acts with a mark and a word: Person, System, AI or People (one person talking to another). The mark at its right says if it is built. A dashed line is a branch for an error.</p>
            <p className="m-0">Click a box for its details. Pick a kind of user to see only what that kind can reach. A menu that links to many steps does not draw all its lines: point at it, or click it, and they appear.</p>
          </Help>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {notes.length > 1 && <div className="w-[220px]"><Select ariaLabel="Journey" value={note.id} onChange={setWhich} search={false} options={notes.map((n) => ({ value: n.id, label: n.title }))} /></div>}
          {journey.users.length > 0 && (
            <div className="w-[220px]"><Select ariaLabel="Who can see it" value={kind} onChange={setKind} search={false}
              options={[{ value: KINDS_ALL, label: "All kinds of user" }, ...journey.users.map((u) => ({ value: u.id, label: u.name }))]} /></div>
          )}
          {problems.length > 0 && (
            <Button variant="quiet" small onClick={() => setShowProblems(true)}><Glyph state={errors.length ? "left" : "waiting"} size={16} />{problems.length} to check</Button>
          )}
          {marks && (marks.missing.length > 0 || marks.noPage.length > 0) && (
            <Button variant="quiet" small onClick={() => setShowMarks(true)}><Glyph state="waiting" size={16} />{marks.missing.length + marks.noPage.length} markers to check</Button>
          )}
          <Button variant="quiet" small onClick={() => setAi({ stage: "ask" })} title="Check the names: ask whether the names of the steps fit their mockup pages, and whether two steps are one">Check names</Button>
          <Button variant="quiet" small onClick={runScan} disabled={scanning} title="Scan the code: look for the kona-step markers in the project's files">{scanning ? "Scanning…" : scan ? "Scan again" : "Scan code"}</Button>
          <div role="group" aria-label="Zoom" className="flex items-center gap-1.5">
            <IconButton icon="zoomOut" label="Zoom out" onClick={() => setZoom(Math.max(0.1, scale / 1.25))} />
            <IconButton icon="zoomIn" label="Zoom in" onClick={() => setZoom(Math.min(2, scale * 1.25))} />
            <IconButton icon="centre" label={atAll && fitAll < fit - 0.005 ? "Back to a readable size" : "Fit all of the map in the window"} disabled={fitAll >= fit - 0.005 && (zoom === null || atAll)} onClick={() => setZoom(atAll ? null : fitAll)} />
          </div>
        </div>
      </div>

      {scanError && <div className="flex items-start gap-2.5 text-[14px] leading-5 text-state-left"><Glyph state="left" size={16} /> {scanError}</div>}
      {scan && (
        <p className="m-0 text-[13px] leading-5 text-text-secondary">
          Scanned {scan.files} files in {scan.ms < 1000 ? `${scan.ms} ms` : `${(scan.ms / 1000).toFixed(1)} s`}: {scan.markers.length} step markers found.
          {scan.truncated ? " The scan stopped early, so a missing marker is not reported." : ""}
        </p>
      )}
      {journey.steps.length === 0 && draftIds.size === 0 ? (
        <p className="m-0 text-text-tertiary">This journey has no steps yet.</p>
      ) : (
        <div ref={box} className="max-h-[62vh] min-h-[280px] overflow-auto border border-line-subtle bg-inset" role="group" aria-label="Journey map">
          <div className="flex" style={{ width: LANE_W + roomW * scale, height: (layout.height + KIND_H) * scale }}>
            <div className="sticky left-0 z-10 w-[104px] shrink-0 border-r border-line-subtle bg-surface-1">
              {layout.lanes.map((l) => (
                <div key={l.id || "none"} className="absolute right-0 left-0 flex items-start px-3 pt-3 text-[13px] leading-4 font-bold text-text-secondary" style={{ top: l.y * scale, height: l.h * scale }}>
                  <span className="break-words">{l.name}</span>
                </div>
              ))}
            </div>
            <svg width={roomW * scale} height={(layout.height + KIND_H) * scale} viewBox={`0 0 ${roomW} ${layout.height + KIND_H}`} role="img" aria-label={`Journey map with ${drawn!.steps.length} steps`}
              onClick={(e) => { if (e.target === e.currentTarget) setPicked(null); }}>
              <Defs />
              {layout.lanes.map((l, i) => <rect key={l.id || "none"} x={0} y={l.y} width={roomW} height={l.h} fill={i % 2 ? "var(--color-surface-2)" : "var(--color-inset)"} stroke="var(--color-line-subtle)" />)}
              {layout.edges.map((e) => {
                const a = layout.nodes.get(e.from), b = layout.nodes.get(e.to);
                if (!a || !b) return null;
                const touches = active !== null && (e.from === active || e.to === active);
                if (e.hub && !touches) return null; // the lines of a menu show only when it is pointed at
                return <EdgeLine key={e.from + ">" + e.to} edge={e} from={a} to={b} bright={touches} dim={active !== null && !touches} thin={e.hub && touches} />;
              })}
              {drawn!.steps.map((s) => (
                <g key={s.id} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)}>
                  <StepBox step={s} at={layout.nodes.get(s.id)!} actor={laneActor(s)} on={active === s.id || linked.has(s.id)} dim={false} faint={hubActive && !linked.has(s.id)} flagged={flagged.has(s.id)} draft={draftIds.has(s.id)} onPick={() => setPicked(s.id)} />
                  {(layout.hidden.get(s.id) ?? 0) > 0 && active !== s.id && (
                    <text x={layout.nodes.get(s.id)!.x + 4} y={layout.nodes.get(s.id)!.y + layout.nodes.get(s.id)!.h + 14} fontSize={11} fill="var(--color-text-tertiary)" fontFamily="var(--font-sans)">{layout.hidden.get(s.id)} {layout.hidden.get(s.id) === 1 ? "line" : "lines"} hidden</text>
                  )}
                </g>
              ))}
              {layout.edges.map((e) => {
                const a = layout.nodes.get(e.from), b = layout.nodes.get(e.to);
                if (!a || !b || !e.label) return null;
                const touches = active !== null && (e.from === active || e.to === active);
                if (e.hub && !touches) return null;
                if (e.hub && touches) return null; // a menu's lines carry no words
                if (!touches && !labelFree(e, a, b, layout.nodes.values())) return null;
                return <EdgeLabel key={e.from + ">" + e.to} edge={e} from={a} to={b} dim={active !== null && !touches} />;
              })}
            </svg>
          </div>
        </div>
      )}

      <JourneyTable journey={tableOf ?? journey} flags={checks} />

      {pickedStep && <StepDialog journey={view} step={pickedStep} draft={draftIds.has(pickedStep.id)} places={marks?.found.get(pickedStep.id) ?? marks?.missing.find((m) => m.id === pickedStep.id)?.at ?? []} actor={laneActor(pickedStep)} problems={problems.filter((p) => p.step === pickedStep.id)} stale={stale.filter((s) => s.step === pickedStep.id)} noteExists={(id) => brain.notes.has(id)} onOpenNote={(id) => { setPicked(null); onOpen(id); }} onGo={setPicked} onClose={() => setPicked(null)} />}
      {ai && ai.stage !== "done" && (() => {
        const n = pagesToRead(journey).length;
        return (
          <Confirm title="Check the names of the steps?" confirmLabel="Check" busy={ai.stage === "running"} error={ai.error} onConfirm={() => void runAi()} onCancel={() => setAi(null)}>
            <p className="m-0">One cheap Haiku call reads the names of the steps and the words on {n === 1 ? "the mockup page" : `${n} mockup pages`} they name. It says which name does not fit its page and which steps may be one step under two names. It uses a little of your plan. Anything that looks like a secret is hidden first, and nothing is saved. It can miss things and can be wrong.</p>
          </Confirm>
        );
      })()}
      {ai?.stage === "done" && ai.verdicts && (
        <NamesDialog journey={journey} verdicts={ai.verdicts} answer={ai.answer ?? ""} pages={ai.pages ?? new Map()} onGo={(id) => { setAi(null); setPicked(id); }} onClose={() => setAi(null)} />
      )}
      {showMarks && marks && <MarksDialog missing={marks.missing} noPage={marks.noPage.map((id) => ({ id, name: journey.steps.find((s) => s.id === id)?.name ?? id }))} onGo={(id) => { setShowMarks(false); setPicked(id); }} onClose={() => setShowMarks(false)} />}
      {showProblems && <ProblemsDialog problems={problems} journey={journey} onGo={(id) => { setShowProblems(false); setPicked(id); }} onClose={() => setShowProblems(false)} />}
    </div>
  );
}

const Label = ({ children }: { children: string }) => <span className="text-[12px] leading-4 font-bold tracking-normal text-text-tertiary">{children}</span>;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><Label>{label}</Label><div className="text-[14px] leading-5 text-text">{children}</div></div>;
}

function StepDialog({ journey, step, actor, problems, stale, draft, places, noteExists, onOpenNote, onGo, onClose }: {
  journey: Journey; step: Step; actor: Actor | null; problems: Problem[]; stale: Stale[]; draft: boolean; places: Marker[]; noteExists: (id: string) => boolean; onOpenNote: (id: string) => void; onGo: (id: string) => void; onClose: () => void;
}) {
  const a: Actor = actor ?? "system";
  const nameOf = (id: string) => journey.steps.find((s) => s.id === id)?.name ?? id;
  const lane = journey.lanes.find((l) => l.id === step.lane)?.name ?? step.lane;
  const kinds = step.access.map((k) => journey.users.find((u) => u.id === k)?.name ?? k);
  const go = (id: string, label?: string) => (
    <Button variant="ghost" tiny onClick={() => onGo(id)}>{label ? `${label}: ` : ""}{nameOf(id)}</Button>
  );
  return (
    <Confirm title={step.name} cancelLabel="Close" noConfirm confirmLabel="" onConfirm={onClose} onCancel={onClose}>
      <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] leading-5 text-text">
          <span className="inline-flex items-center gap-2"><ActorMark actor={a} />{ACTOR_WORD[a]}</span>
          <span className="inline-flex items-center gap-2"><Glyph state={draft ? "idle" : STATUS_GLYPH[step.status]} size={16} still />{draft ? "Not confirmed" : STATUS_WORD[step.status]}</span>
          <span className="text-text-secondary">{lane} lane{step.kind === "screen" ? ", a screen" : ""}</span>
        </div>
        {draft && <p className="m-0 text-[14px] leading-5 text-text-secondary">A file says this page exists, but the journey note does not have it yet. Ask a worker to write it into the note, with where the person goes next.</p>}
        {places.length > 0 && <Row label={draft ? "Found in" : "Page"}><ul className="m-0 flex list-none flex-col gap-0.5 p-0">{places.map((m, i) => <li key={i} className="font-mono text-[13px]">{placeOf(m)}</li>)}</ul></Row>}
        <Row label="Who can see it">{kinds.length ? kinds.join(", ") : "Everyone (no kind of user is named)"}</Row>
        {step.ai && <Row label="What the AI does">{step.ai.does || "Not said"}{step.ai.model ? `. Model: ${step.ai.model}` : ""}</Row>}
        {step.fields.length > 0 && <Row label="Fields">{step.fields.join(", ")}</Row>}
        {step.buttons.length > 0 && (
          <Row label="Buttons and links">
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{step.buttons.map((b, i) => <li key={i} className="flex flex-wrap items-center gap-1">{b.label}{b.to ? <>{" leads to "}{go(b.to)}</> : null}</li>)}</ul>
          </Row>
        )}
        {step.errors.length > 0 && (
          <Row label="Errors the person can meet">
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{step.errors.map((e, i) => <li key={i} className="flex flex-wrap items-center gap-1">{e.when ? `${e.when}: ` : ""}{e.text}{e.to ? <>{" leads to "}{go(e.to)}</> : null}</li>)}</ul>
          </Row>
        )}
        {step.next.length > 0 && (
          <Row label="Leads to">
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{step.next.map((b, i) => <li key={i} className="flex flex-wrap items-center gap-1">{b.label ? `${b.label}: ` : ""}{go(b.to)}</li>)}</ul>
          </Row>
        )}
        <Row label="Last checked">{step.updated || "Never"}</Row>
        {step.mockup && <Row label="Mockup"><span className="font-mono text-[13px]">{step.mockup}</span></Row>}
        {step.tickets.length > 0 && <Row label="Tickets">{step.tickets.join(", ")}</Row>}
        {step.notes.length > 0 && (
          <Row label="Notes that decide it">
            <div className="flex flex-wrap gap-2">{step.notes.map((n) => noteExists(n) ? <Button key={n} variant="quiet" tiny onClick={() => onOpenNote(n)}>{n}</Button> : <span key={n} className="font-mono text-[13px] text-text-tertiary">{n}</span>)}</div>
          </Row>
        )}
        {step.see.length > 0 && (
          <Row label="Other diagrams">
            <div className="flex flex-wrap gap-2">{step.see.map((s, i) => s.note && noteExists(s.note) ? <Button key={i} variant="quiet" tiny onClick={() => onOpenNote(s.note)}>{s.diagram || s.note}</Button> : <span key={i}>{s.diagram || s.note}</span>)}</div>
          </Row>
        )}
        {(problems.length > 0 || stale.length > 0) && (
          <div className="flex flex-col gap-1.5">
            {problems.map((p, i) => <div key={i} className="flex items-start gap-2 text-[13px] leading-5 text-state-left"><Glyph state={p.level === "error" ? "left" : "waiting"} size={16} />{p.text}</div>)}
            {stale.map((s, i) => <div key={`s${i}`} className={`flex items-start gap-2 text-[13px] leading-5 ${s.level === "flag" ? "text-state-left" : "text-text-secondary"}`}><Glyph state={s.level === "flag" ? "left" : "idle"} size={16} />{s.level === "hint" ? `Hint: ${s.text}` : s.text}</div>)}
          </div>
        )}
      </div>
    </Confirm>
  );
}

function ProblemsDialog({ problems, journey, onGo, onClose }: { problems: Problem[]; journey: Journey; onGo: (id: string) => void; onClose: () => void }) {
  const known = new Set(journey.steps.map((s) => s.id));
  const nameOf = (id: string) => journey.steps.find((s) => s.id === id)?.name ?? id;
  const [open, setOpen] = useState<Set<string>>(new Set());
  // the same sentence about many steps ("The screen X has no mockup", sixty times) is one line with the steps under it
  const groups = useMemo(() => {
    const by = new Map<string, Problem[]>();
    for (const p of problems) { const k = p.level + "|" + (p.step ? p.text.split(`"${p.step}"`).join(`"…"`) : p.text); (by.get(k) ?? by.set(k, []).get(k)!).push(p); }
    return [...by.entries()].map(([key, list]) => ({ key, list, many: list.length >= GROUP_MIN && list.every((p) => p.step && known.has(p.step) && p.text.includes(`"${p.step}"`)) }));
  }, [problems]);
  const sentence = (p: Problem) => p.text.replace(`"${p.step}"`, "…").replace(/^The screen … /, "A screen ");
  return (
    <Confirm title="To check in this journey" cancelLabel="Close" noConfirm confirmLabel="" onConfirm={onClose} onCancel={onClose}>
      <ul className="m-0 flex max-h-[56vh] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
        {groups.map((g) => g.many ? (
          <li key={g.key} className="flex flex-col gap-1.5">
            <button type="button" aria-expanded={open.has(g.key)} aria-label={`${g.list.length} steps: ${sentence(g.list[0])}`} className="flex w-full cursor-pointer items-start gap-2 border-0 bg-transparent p-0 text-left text-[14px] leading-5 text-text"
              onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
              <Glyph state={g.list[0].level === "error" ? "left" : "waiting"} size={16} />
              <span className="min-w-0 flex-1"><b>{g.list.length} steps:</b> {sentence(g.list[0])}</span>
              <Chevron open={open.has(g.key)} />
            </button>
            {open.has(g.key) && (
              <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 pl-6">
                {g.list.map((p, i) => <li key={i}><Button variant="ghost" tiny onClick={() => onGo(p.step)}>{nameOf(p.step)}</Button></li>)}
              </ul>
            )}
          </li>
        ) : g.list.map((p, i) => (
          <li key={g.key + i} className="flex items-start gap-2 text-[14px] leading-5 text-text">
            <Glyph state={p.level === "error" ? "left" : "waiting"} size={16} />
            <span className="min-w-0 flex-1">{p.text}{p.step && known.has(p.step) ? <> <Button variant="ghost" tiny onClick={() => onGo(p.step)}>Open the step</Button></> : null}</span>
          </li>
        )))}
      </ul>
    </Confirm>
  );
}

function MarksDialog({ missing, noPage, onGo, onClose }: { missing: { id: string; at: Marker[] }[]; noPage: { id: string; name: string }[]; onGo: (id: string) => void; onClose: () => void }) {
  return (
    <Confirm title="Step markers to check" cancelLabel="Close" noConfirm confirmLabel="" onConfirm={onClose} onCancel={onClose}>
      <div className="flex max-h-[56vh] flex-col gap-4 overflow-y-auto pr-1">
        {missing.length > 0 && (
          <Row label="In the code, not in the journey note">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {missing.map((m) => (
                <li key={m.id} className="flex flex-col gap-0.5">
                  <Button variant="ghost" tiny onClick={() => onGo(m.id)}>{m.id}</Button>
                  {m.at.map((p, i) => <span key={i} className="pl-1.5 font-mono text-[13px] text-text-secondary">{placeOf(p)}</span>)}
                </li>
              ))}
            </ul>
          </Row>
        )}
        {noPage.length > 0 && (
          <Row label="Built screens with no page found">
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{noPage.map((s) => <li key={s.id}><Button variant="ghost" tiny onClick={() => onGo(s.id)}>{s.name}</Button></li>)}</ul>
          </Row>
        )}
      </div>
    </Confirm>
  );
}

function NamesDialog({ journey, verdicts, answer, pages, onGo, onClose }: { journey: Journey; verdicts: Verdicts; answer: string; pages: Map<string, string>; onGo: (id: string) => void; onClose: () => void }) {
  const name = (id: string) => journey.steps.find((s) => s.id === id)?.name ?? id;
  const title = !verdicts.readable ? "Haiku did not answer as asked" : verdicts.none ? "No problem found" : "These names may not fit";
  return (
    <Confirm title={title} confirmLabel="" noConfirm cancelLabel="Close" onConfirm={() => {}} onCancel={onClose}>
      {!verdicts.readable && (
        <>
          <p className="m-0">The answer was not in the shape that can be read, so nothing is reported. Try again.</p>
          <pre className="m-0 max-h-[30vh] overflow-auto font-sans text-[13px] leading-5 whitespace-pre-wrap text-text-secondary">{answer.slice(0, 1500)}</pre>
        </>
      )}
      {verdicts.none && <p className="m-0">Haiku found no name that does not fit its page, and no two steps that are one step under two names. It can miss things, so this is a help, not a proof.</p>}
      {verdicts.readable && !verdicts.none && (
        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
          {verdicts.different.length > 0 && (
            <Row label="The name may not fit the page">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {verdicts.different.map((id) => (
                  <li key={id} className="flex flex-col gap-0.5">
                    <span><Button variant="ghost" tiny onClick={() => onGo(id)}>{name(id)}</Button></span>
                    <span className="pl-1.5 text-[13px] leading-5 text-text-secondary">The page says: {(pages.get(id) ?? "").slice(0, 160)}</span>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {verdicts.same.length > 0 && (
            <Row label="May be one step under two names">
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {verdicts.same.map(([a, b]) => <li key={a + b} className="flex flex-wrap items-center gap-1"><Button variant="ghost" tiny onClick={() => onGo(a)}>{name(a)}</Button> and <Button variant="ghost" tiny onClick={() => onGo(b)}>{name(b)}</Button></li>)}
              </ul>
            </Row>
          )}
        </div>
      )}
    </Confirm>
  );
}
