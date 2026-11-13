// Is a step of the journey out of date? (ticket T-0038, decision 91.) Two kinds of answer, kept apart on purpose:
//   a flag  is the rule: a ticket that a step names is finished (in Review or Done), yet the journey note was not saved under that ticket (Kona stamps `ticket:` on a
//           note a session saves) and the ticket does not say "Journey: no change". The ticket must update the journey in the same ticket, or say there is nothing to change.
//   a hint  is only a date: the mockup the step names changed after the day the step was last checked. A colour change in a mockup would mark every step, so a hint is
//           shown quietly and never counts as an error.
// Plain functions, no drawing and no model.
import type { Journey, Step } from "./journey.ts";
import { localDate } from "./text.ts";

/** What the stamp rule needs to know about a ticket: its status, its last day, and its own words (the title, the description, what it must reach, its history). */
export type TicketFact = { id: string; status: string; updated: string; text: string };
export type CardFact = { id: string; /** seconds since 1970 */ modified: number | null };
export type Stale = { step: string; level: "flag" | "hint"; text: string };

export const FINISHED = ["review", "done"];

/** `Journey: no change` as a line of a ticket, with or without a list dash or a tick box, in any case. */
export function saysNoChange(text: string): boolean {
  return /^[ \t]*(?:[-*][ \t]+)?(?:\[[ xX]\][ \t]*)?journey:[ \t]*no[ -]change\b/im.test(text);
}

/** The card a step's mockup names: its first part, so `photo-albums/sign-in.html` is the card `photo-albums`. */
export function cardOf(mockup: string): string {
  return mockup.split("/")[0].trim();
}

const day = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");

export function staleness(j: Journey, input: { stamped: readonly string[]; tickets: readonly TicketFact[]; cards: readonly CardFact[] }): Stale[] {
  const out: Stale[] = [];
  const byTicket = new Map(input.tickets.map((t) => [t.id, t]));
  const byCard = new Map(input.cards.map((c) => [c.id, c]));
  const stamped = new Set(input.stamped);
  for (const s of j.steps) {
    flagTickets(s, byTicket, stamped, out);
    if (s.mockup && input.cards.length > 0) {
      const card = byCard.get(cardOf(s.mockup));
      if (!card) out.push({ step: s.id, level: "hint", text: `No card named ${cardOf(s.mockup)} in Mockups` });
      else if (card.modified !== null && s.updated && day(localDate(new Date(card.modified * 1000))) > s.updated) out.push({ step: s.id, level: "hint", text: `Mockup changed ${localDate(new Date(card.modified * 1000))}, after the step was checked on ${s.updated}` });
    }
    if (!s.updated && (s.mockup || s.tickets.length > 0)) out.push({ step: s.id, level: "hint", text: "Never checked against the product" });
  }
  return out;
}

function flagTickets(s: Step, byTicket: Map<string, TicketFact>, stamped: Set<string>, out: Stale[]) {
  for (const id of s.tickets) {
    const t = byTicket.get(id);
    if (!t || !FINISHED.includes(t.status)) continue;
    if (stamped.has(id) || saysNoChange(t.text)) continue;
    out.push({ step: s.id, level: "flag", text: `Ticket ${id} is finished, but the journey was not updated under it and it does not say "Journey: no change"` });
  }
}

/** One line for each step, for the table's Check column: the flags first, then the hints, each step's lines joined. */
export function checkText(stale: readonly Stale[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const level of ["flag", "hint"] as const) {
    for (const x of stale) {
      if (x.level !== level) continue;
      out.set(x.step, [out.get(x.step), (level === "hint" ? "Hint: " : "") + x.text].filter(Boolean).join(" · "));
    }
  }
  return out;
}

/** Make the facts from the screen's own data: a ticket's text is everything it says. */
export function ticketFact(t: { id: string; status: string; updated: string; title: string; description: string; acceptance: string; history: string[] }): TicketFact {
  return { id: t.id, status: t.status, updated: day(t.updated), text: [t.title, t.description, t.acceptance, ...t.history].join("\n") };
}
