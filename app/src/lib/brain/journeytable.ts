// The status table under the journey map (ticket T-0038): one row for each step, as the same table type the reader uses for markdown tables, so it sorts,
// filters and copies like every other table in Kona (MdTable). Plain functions, no drawing.
import type { Journey } from "./journey.ts";
import type { Table } from "./table.ts";

export const TABLE_HEAD = ["Step", "Lane", "Status", "Ticket", "Mockup", "Last updated"];
export const STATUS_TEXT: Record<string, string> = { built: "Built", "in-progress": "In progress", "not-built": "Not built" };

/** The rows of the status table. `flags` says, per step id, why a step may be out of date; when any step has one, a Check column is added at the end. */
export function journeyTable(j: Journey, flags: ReadonlyMap<string, string> = new Map()): Table {
  const lane = new Map(j.lanes.map((l) => [l.id, l.name]));
  const withCheck = [...flags.values()].some(Boolean);
  const head = withCheck ? [...TABLE_HEAD, "Check"] : TABLE_HEAD;
  const rows = j.steps.map((s) => {
    const r = [s.name, lane.get(s.lane) ?? (s.lane || "No lane"), STATUS_TEXT[s.status] ?? s.status, s.tickets.join(", ") || "none", s.mockup || "none", s.updated || "never"];
    if (withCheck) r.push(flags.get(s.id) ?? "");
    return r;
  });
  return { head, align: head.map(() => null), rows };
}

/** The table as markdown, so Copy puts a table on the clipboard that is still a table in a note. A pipe or a line break inside a cell is kept from breaking it. */
export function tableSource(t: Table): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
  return [t.head, t.head.map(() => "---"), ...t.rows].map((r) => "| " + r.map(cell).join(" | ") + " |").join("\n");
}
