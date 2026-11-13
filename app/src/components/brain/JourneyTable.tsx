// The status table under the journey map (ticket T-0038): step, lane, status, ticket, mockup and last updated, one row for each step. It is the same table as every
// table in the Brain (MdTable): click a heading to sort, type to filter, choose the columns.
import { useMemo } from "react";
import type { Journey } from "../../lib/brain/journey.ts";
import { journeyTable, tableSource } from "../../lib/brain/journeytable.ts";
import { MdTable } from "./MdTable";

export function JourneyTable({ journey, flags }: { journey: Journey; flags?: ReadonlyMap<string, string> }) {
  const table = useMemo(() => journeyTable(journey, flags), [journey, flags]);
  const source = useMemo(() => tableSource(table), [table]);
  if (journey.steps.length === 0) return null;
  return <MdTable key={`${table.head.length}-${table.rows.length}`} table={table} source={source} cell={(text, key) => <span key={key}>{text}</span>} />;
}
