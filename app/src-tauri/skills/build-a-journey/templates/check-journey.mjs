// Checks a journey note: node check-journey.mjs <the file that holds the note's text>
// It prints each mistake in plain words with the step it is about, and ends with a count. Exit code: 1 when there is an error, 0 otherwise.
// This file is made from Kona's own journey reader (app/src/lib/brain/journey.ts), so it finds exactly what the Journey page finds. Do not edit it.
// The journey of a project (decision 91, ticket T-0035): one note of kind `journey` holds the whole map as one block of JSON, and everything that
// draws it (the Brain's Journey view, the status table, the Mockups page) reads it through this file, so nothing is ever drawn from a copy.
// The note is plain markdown with the usual front matter; the map sits in one fenced block opened with ```journey. Reading never throws: a note
// that cannot be read gives a list of problems in plain words, each with the step it is about.
// Plain TypeScript, no model and no network: the checks are exact.

                                                          
/** who acts in a step: a person, the system, an AI, or one person talking to another person */
export const ACTORS          = ["person", "system", "ai", "people"];
                                                           
export const STATUSES           = ["built", "in-progress", "not-built"];
                                         

                                                                                                                                    
/** a kind of user of the product (a guest, a candidate, an admin): who can reach a step. Not a Kona role. `system` names the way of giving access it belongs to
 *  (Role, Branch duty, Plan): a product may have more than one, and the picker groups the kinds by it. Empty: the one plain list. */
                                                                    
/** a part of the product with its own screens and menu (a login panel, the main panel, the admin panel): the map can show one layer at a time */
                                                 
                                                   
                                                   
                                                                 
                                                    

                    
             
               
               
                                                                                                 
                
                 
                      
                   
                                                                                                                                 
                 
                 
                 
               
                 
                                                                                                  
                  
                 
                    
                  
             
                                                                                                                          
                   
                    
                    
                                                         
                                             
  

                                                                                                          
                                                                                                                    
                                                                    

export const DEFAULT_LANES         = [
  { id: "person", name: "Person", actor: "person" },
  { id: "app", name: "App", actor: "system" },
  { id: "server", name: "Server", actor: "system" },
];

const MAX_BLOCK = 600_000; // characters
const MAX_STEPS = 2000;
const ID = /^[a-z0-9][a-z0-9-]*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const STEP_KEYS = new Set(["id", "name", "lane", "layer", "limits", "kind", "actor", "access", "next", "start", "end", "status", "updated", "mockup", "tickets", "notes", "see", "fields", "buttons", "errors", "ai"]);

// ---- finding the block ----

/** The text of the one ```journey block of a note, and the line (counting from 1) its first line of JSON is on. */
export function journeyBlock(text        )                                                       {
  const lines = text.replace(/\r/g, "").split("\n");
  const found                                   = [];
  let open                                                            = null;
  lines.forEach((l, i) => {
    const m = l.match(/^\s*```+\s*(.*)$/);
    if (!m) { if (open) open.body.push(l); return; }
    if (open) { if (open.journey) found.push({ json: open.body.join("\n"), line: open.line }); open = null; return; }
    open = { journey: m[1].trim().split(/\s+/).includes("journey"), line: i + 2, body: [] };
  });
  if (found.length === 0) return { problem: "The note has no journey block. The map goes between a line that starts with three backticks and the word journey, and a line of three backticks." };
  if (found.length > 1) return { problem: `The note has ${found.length} journey blocks. A journey note holds exactly one.` };
  return found[0];
}

function jsonProblem(e         , json        , line        )         {
  const msg = e instanceof Error ? e.message : String(e);
  const at = /\(line (\d+)/.exec(msg);
  let n = at ? Number(at[1]) : 0;
  if (!n) {
    const p = /position (\d+)/.exec(msg);
    if (p) n = json.slice(0, Number(p[1])).split("\n").length;
  }
  return `The journey block is not valid JSON${n ? `, near line ${line + n - 1} of the note` : ""}. ${msg.split(/ in JSON| \(line/)[0]}.`;
}

// ---- reading what was written, forgivingly ----

const isObj = (v         )                               => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v         )         => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const list = (v         )            => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);
const strs = (v         )           => list(v).map(str).filter(Boolean);

/** Read a journey from the text of a note. Never throws. */
export function parseJourney(text        )       {
  const problems            = [];
  const err = (step        , t        ) => problems.push({ level: "error", step, text: t });
  const warn = (step        , t        ) => problems.push({ level: "warning", step, text: t });
  const block = journeyBlock(text);
  if ("problem" in block) { err("", block.problem); return { journey: null, problems }; }
  if (block.json.length > MAX_BLOCK) { err("", "The journey block is too big to read. Split the product into more than one journey."); return { journey: null, problems }; }
  let root         ;
  try { root = JSON.parse(block.json); } catch (e) { err("", jsonProblem(e, block.json, block.line)); return { journey: null, problems }; }
  if (!isObj(root)) { err("", "The journey block must be one object with a list called steps."); return { journey: null, problems }; }
  if (!Array.isArray(root.steps)) { err("", "The journey block has no list called steps."); return { journey: null, problems }; }
  if (root.steps.length > MAX_STEPS) { err("", `The journey has more than ${MAX_STEPS} steps. Split the product into more than one journey.`); return { journey: null, problems }; }

  // lanes: the project's own, or Person, App and Server
  let lanes         = [];
  if (root.lanes === undefined) lanes = DEFAULT_LANES.map((l) => ({ ...l }));
  else if (!Array.isArray(root.lanes) || root.lanes.length === 0) err("", "lanes must be a list with at least one lane.");
  else for (const raw of root.lanes) {
    const o                          = isObj(raw) ? raw : { id: raw };
    const id = str(o.id), name = str(o.name) || id;
    const a = str(o.actor);
    if (!ID.test(id)) { err("", `A lane has the id "${id}". An id is lower case letters, numbers and dashes.`); continue; }
    if (lanes.some((l) => l.id === id)) { err("", `Two lanes have the id "${id}".`); continue; }
    if (a && !ACTORS.includes(a         )) err("", `Lane "${id}" says its actor is "${a}". Use one of: ${ACTORS.join(", ")}.`);
    lanes.push({ id, name, actor: ACTORS.includes(a         ) ? (a         ) : null });
  }

  // layers: optional parts of the product shown one at a time (login, main, admin)
  const layers          = [];
  for (const raw of list(root.layers)) {
    const o                          = isObj(raw) ? raw : { id: raw };
    const id = str(o.id);
    if (!ID.test(id)) { err("", `A layer has the id "${id}". An id is lower case letters, numbers and dashes.`); continue; }
    if (layers.some((l) => l.id === id)) { err("", `Two layers have the id "${id}".`); continue; }
    layers.push({ id, name: str(o.name) || id });
  }

  const users             = [];
  for (const raw of list(root.users)) {
    const o                          = isObj(raw) ? raw : { id: raw };
    const id = str(o.id);
    if (!ID.test(id)) { err("", `A user kind has the id "${id}". An id is lower case letters, numbers and dashes.`); continue; }
    if (users.some((u) => u.id === id)) { err("", `Two user kinds have the id "${id}".`); continue; }
    users.push({ id, name: str(o.name) || id, system: str(o.system) });
  }

  const steps         = [];
  root.steps.forEach((raw, i) => {
    const where = `Step number ${i + 1}`;
    if (!isObj(raw)) { err("", `${where} is not an object.`); return; }
    const id = str(raw.id);
    if (!ID.test(id)) { err(id, `${where} has the id "${id}". An id is lower case letters, numbers and dashes, such as upload-cv.`); return; }
    if (steps.some((s) => s.id === id)) { err(id, `Two steps have the id "${id}".`); return; }
    const name = str(raw.name);
    if (!name) err(id, `Step "${id}" has no name. Write it in plain words, such as Upload CV.`);
    for (const k of Object.keys(raw)) if (!STEP_KEYS.has(k)) warn(id, `Step "${id}" has a key Kona does not know: "${k}". It is ignored.`);

    const kind = str(raw.kind) || "step";
    if (kind !== "step" && kind !== "screen") err(id, `Step "${id}" says its kind is "${kind}". Use step or screen.`);
    const status = str(raw.status) || "not-built";
    if (!STATUSES.includes(status          )) err(id, `Step "${id}" says its status is "${status}". Use one of: ${STATUSES.join(", ")}.`);
    const actor = str(raw.actor);
    if (actor && !ACTORS.includes(actor         )) err(id, `Step "${id}" says its actor is "${actor}". Use one of: ${ACTORS.join(", ")}.`);
    const updated = str(raw.updated);
    if (updated && !(DAY.test(updated) && !Number.isNaN(Date.parse(updated)) && new Date(updated).toISOString().slice(0, 10) === updated)) err(id, `Step "${id}" has the date "${updated}". Write a day as 2026-11-13.`);

    const next           = list(raw.next).map((n) => (isObj(n) ? { to: str(n.to), label: str(n.label) } : { to: str(n), label: "" })).filter((b) => b.to);
    const buttons           = list(raw.buttons).map((b) => (isObj(b) ? { label: str(b.label), to: str(b.to) } : { label: str(b), to: "" })).filter((b) => b.label);
    const errors            = list(raw.errors).map((e) => (isObj(e) ? { text: str(e.text), when: str(e.when), to: str(e.to) } : { text: str(e), when: "", to: "" })).filter((e) => e.text || e.when);
    const see        = list(raw.see).map((s) => (isObj(s) ? { diagram: str(s.diagram), note: str(s.note) } : { diagram: str(s), note: "" })).filter((s) => s.diagram || s.note);
    let ai             = null;
    if (isObj(raw.ai)) ai = { does: str(raw.ai.does), model: str(raw.ai.model) };
    else if (str(raw.ai)) ai = { does: str(raw.ai), model: "" };

    steps.push({
      id, name: name || id, lane: str(raw.lane), layer: str(raw.layer), kind: kind === "screen" ? "screen" : "step",
      actor: ACTORS.includes(actor         ) ? (actor         ) : null, access: strs(raw.access), limits: str(raw.limits), next,
      start: raw.start === true, end: raw.end === true,
      status: STATUSES.includes(status          ) ? (status          ) : "not-built",
      updated, mockup: str(raw.mockup), tickets: strs(raw.tickets), notes: strs(raw.notes), see,
      fields: strs(raw.fields), buttons, errors, ai,
    });
  });

  const journey          = { title: str(root.title), lanes, layers, users, steps };
  problems.push(...checkJourney(journey));
  return { journey, problems };
}

// ---- the exact checks ----

/** Where a step leads: its next steps, and the buttons and errors that name a step. */
export function leavesTo(s      )           {
  return [...new Set([...s.next.map((b) => b.to), ...s.buttons.map((b) => b.to), ...s.errors.map((e) => e.to)].filter(Boolean))];
}

/** What can be wrong with a journey that was read, found without any model. An error means the map would be drawn wrong; a warning means it is probably incomplete. */
export function checkJourney(j         )            {
  const out            = [];
  const err = (step        , text        ) => out.push({ level: "error", step, text });
  const warn = (step        , text        ) => out.push({ level: "warning", step, text });
  const ids = new Set(j.steps.map((s) => s.id));
  const lanes = new Map(j.lanes.map((l) => [l.id, l]));
  const kinds = new Set(j.users.map((u) => u.id));
  const layerIds = new Set(j.layers.map((l) => l.id));
  const into = new Map                ();
  for (const s of j.steps) for (const to of leavesTo(s)) if (to !== s.id) into.set(to, (into.get(to) ?? 0) + 1);

  for (const s of j.steps) {
    const lane = lanes.get(s.lane);
    if (!s.lane) err(s.id, `Step "${s.id}" has no lane.`);
    else if (!lane) err(s.id, `Step "${s.id}" is in the lane "${s.lane}", which is not one of the lanes (${j.lanes.map((l) => l.id).join(", ")}).`);
    for (const k of s.access) if (!kinds.has(k)) err(s.id, `Step "${s.id}" can be seen by "${k}", which is not a user kind of this journey.`);
    if (s.layer && !layerIds.has(s.layer)) err(s.id, `Step "${s.id}" is in the layer "${s.layer}", which is not one of the layers (${j.layers.map((l) => l.id).join(", ") || "none"}).`);
    for (const b of s.next) if (!ids.has(b.to)) err(s.id, `Step "${s.id}" leads to "${b.to}", which is not in the map.`);
    for (const b of s.buttons) if (b.to && !ids.has(b.to)) err(s.id, `The button "${b.label}" of step "${s.id}" leads to "${b.to}", which is not in the map.`);
    for (const e of s.errors) if (e.to && !ids.has(e.to)) err(s.id, `An error of step "${s.id}" leads to "${e.to}", which is not in the map.`);

    if (!s.actor && !lane?.actor) warn(s.id, `Step "${s.id}" does not say who acts, and its lane has no usual actor.`);
    if (leavesTo(s).length === 0 && !s.end) warn(s.id, `Step "${s.id}" leads nowhere. Add the next step, or mark it as an end.`);
    if (!into.get(s.id) && !s.start) warn(s.id, `Nothing leads to step "${s.id}". Point a step at it, or mark it as a start.`);
    if (s.kind === "screen" && !s.mockup) warn(s.id, `The screen "${s.id}" has no mockup.`);
    if (s.status === "built" && s.tickets.length === 0 && s.notes.length === 0) warn(s.id, `Step "${s.id}" is built but names no ticket and no note that explains it.`);
    if ((s.actor ?? lane?.actor) === "ai" && !s.ai?.does) warn(s.id, `Step "${s.id}" is done by an AI, but does not say what the AI does.`);
    if (s.kind !== "screen" && (s.fields.length || s.buttons.length || s.errors.length)) warn(s.id, `Step "${s.id}" lists fields, buttons or errors but is not a screen. Set its kind to screen.`);
    for (const x of s.see) if (!x.diagram) warn(s.id, `A link from step "${s.id}" to another diagram does not name the diagram.`);
  }
  if (j.steps.length > 0 && !j.steps.some((s) => s.start)) warn("", "No step is marked as a start.");
  return out;
}

/** A step that was last checked before the mockup or a ticket it points to changed is stale; this is the date part of that test (a hint, see decision 91). */
export function olderThan(updated        , other        )          {
  return DAY.test(updated) && DAY.test(other) && updated < other;
}

// ---- who can reach a step, in a few words ----

/**
 * The kinds of user that can reach a step, as the short words a card shows. Everyone when every kind can; "All but X, Y" when only one or two cannot; the names
 * when one or two can; otherwise the kinds grouped by their access system, with a system written as "any duty" when all its kinds can ("Super Admin or any duty").
 * A step that names no kind is for everyone: nothing was said to hide it.
 */
export function accessWords(access          , users            )         {
  if (users.length === 0) return "";
  const can = users.filter((u) => access.includes(u.id));
  if (can.length === 0 || can.length === users.length) return "Everyone";
  const cannot = users.filter((u) => !can.includes(u));
  if (can.length <= 2 && can.length <= cannot.length) return can.map((u) => u.name).join(", "); // few can: name them (with two kinds, "Guest", not "All but Member")
  if (cannot.length <= 2) return `All but ${cannot.map((u) => u.name).join(", ")}`;
  if (can.length <= 2) return can.map((u) => u.name).join(", ");
  const systems = [...new Set(users.map((u) => u.system))];
  const parts           = [];
  for (const sys of systems) {
    const all = users.filter((u) => u.system === sys), some = can.filter((u) => u.system === sys);
    if (some.length === 0) continue;
    if (some.length === all.length && all.length > 1 && sys) parts.push(`any ${sys.toLowerCase()}`);
    else if (some.length <= 2) parts.push(some.map((u) => u.name).join(", "));
    else parts.push(`${some.length} of ${all.length}${sys ? " " + sys.toLowerCase() + "s" : ""}`);
  }
  const text = parts.join(" or ");
  return text[0].toUpperCase() + text.slice(1);
}

// ---- finding the journey notes of a project ----

/** The notes of a project that are journeys: the kind says so, and only the project's own notes count (a starter note shows the format and is no journey). */
export function journeyNotes                                           (notes             )      {
  return [...notes].filter((n) => n.kind === "journey" && n.layer === "project");
}

// ---- run from a terminal ----
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node check-journey.mjs <the file that holds the note's text>"); process.exit(2); }
  const { journey, problems } = parseJourney(readFileSync(file, "utf8"));
  for (const p of problems) console.log((p.level === "error" ? "ERROR   " : "warning ") + p.text);
  const errors = problems.filter((p) => p.level === "error").length;
  console.log(journey ? `${journey.steps.length} steps, ${errors} errors, ${problems.length - errors} warnings.` : "The journey could not be read.");
  process.exit(errors > 0 ? 1 : 0);
}
