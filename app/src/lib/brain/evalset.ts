// Measuring the brain's search (ticket T-0028). A search can be wrong in four ways, and each one is counted on its own:
//   true positive (TP)   the answer is in the brain and the search shows a section that holds it;
//   false negative (FN)  the answer is in the brain and the search misses it (says "not in the brain", or shows other sections);
//   false positive (FP)  nothing in the brain answers the question and the search shows something anyway (worst when it says "Found");
//   true negative (TN)   nothing answers the question and the search says "not in the brain".
// A question says which words a right section must hold (`needles`, any one of them is enough), not which note, so the same questions still
// work after notes are merged, split or renamed. A question whose words are in no section of the brain counts as "nothing answers this".
// Plain TypeScript, no model and no network. The command is `node tests/search-eval.mjs`; the questions for Kona's own starter notes are in
// `eval/starter.json` and are run by a test, so the search cannot get worse without anyone noticing.
import { Brain, type Hit, type SearchOptions } from "./engine.ts";
import { fold } from "./text.ts";

export type Kind = "exact" | "paraphrase" | "deep" | "ambiguous" | "nothing" | "near-miss";
export type Question = {
  q: string;
  kind: Kind;
  /** a right section holds at least one of these words (any case, any spacing); empty when nothing in the brain answers the question */
  needles?: string[];
};
export type Outcome = "TP" | "FN" | "FP" | "TN";
export type Row = {
  q: string;
  kind: Kind;
  outcome: Outcome;
  state: "found" | "partly" | "none";
  /** true when the question has needles and the brain holds them somewhere */
  answerable: boolean;
  /** 1 for the first shown section, null when none of the shown sections is right */
  firstRight: number | null;
  shown: number;
  right: number;
  /** the search said "Found" and was wrong: a confident wrong answer */
  confidentWrong: boolean;
  top: string;
};
export type Summary = {
  questions: number;
  TP: number; FN: number; FP: number; TN: number;
  /** TP / (TP + FP) */ precision: number;
  /** TP / (TP + FN) */ recall: number;
  f1: number;
  /** questions where the search said "Found" and shown sections were wrong or nothing answers */
  confidentWrong: number;
  /** among the questions with an answer, how often the first shown section is right */
  top1: number;
  /** mean of 1/rank of the first right section over the questions with an answer */
  mrr: number;
  /** of all shown sections, the share that are right (answerable questions only) */
  hitPrecision: number;
  unanswerable: string[];
  byKind: Record<string, { n: number; TP: number; FN: number; FP: number; TN: number }>;
};

const squash = (s: string) => fold(s).replace(/[*_`#>|]/g, " ").replace(/\s+/g, " ").trim();

/** Does this text hold any of the needles? */
export const holds = (text: string, needles: string[]): boolean => {
  const t = squash(text);
  return needles.some((n) => t.includes(squash(n)));
};

export function evaluate(brain: Brain, questions: Question[], limit = 5, opts: SearchOptions = {}): { rows: Row[]; summary: Summary } {
  const sections = [...brain.notes.values()].flatMap((n) => n.sections.map((s) => ({ s, text: `${s.heading}\n${s.text}` })));
  const rows: Row[] = [];
  const unanswerable: string[] = [];
  for (const item of questions) {
    const needles = item.needles ?? [];
    const answerable = needles.length > 0 && sections.some((x) => holds(x.text, needles));
    if (needles.length > 0 && !answerable) unanswerable.push(item.q);
    const r = brain.search(item.q, limit, opts);
    const flags = r.hits.map((h: Hit) => holds(`${h.section.heading}\n${h.section.text}`, needles));
    const right = flags.filter(Boolean).length;
    const first = flags.indexOf(true);
    const shown = r.state !== "none";
    let outcome: Outcome;
    if (answerable) outcome = shown && right > 0 ? "TP" : "FN";
    else outcome = shown ? "FP" : "TN";
    const wrongShown = shown && (!answerable || right === 0);
    rows.push({
      q: item.q, kind: item.kind, outcome, state: r.state, answerable, firstRight: first < 0 ? null : first + 1, shown: r.hits.length, right,
      confidentWrong: r.state === "found" && wrongShown, top: r.hits[0] ? `${r.hits[0].note.id} / ${r.hits[0].section.heading}` : "",
    });
  }
  const count = (o: Outcome) => rows.filter((x) => x.outcome === o).length;
  const TP = count("TP"), FN = count("FN"), FP = count("FP"), TN = count("TN");
  // a question that has an answer and where the search showed only wrong sections is a miss (FN) and also a wrong answer given: it counts as FP for precision
  const wrongOnAnswerable = rows.filter((x) => x.answerable && x.state !== "none" && x.right === 0).length;
  const precision = TP + FP + wrongOnAnswerable ? TP / (TP + FP + wrongOnAnswerable) : 1;
  const recall = TP + FN ? TP / (TP + FN) : 1;
  const withAnswer = rows.filter((x) => x.answerable);
  const shownTotal = withAnswer.reduce((a, x) => a + x.shown, 0);
  const byKind: Summary["byKind"] = {};
  for (const x of rows) {
    const k = (byKind[x.kind] ??= { n: 0, TP: 0, FN: 0, FP: 0, TN: 0 });
    k.n++; k[x.outcome]++;
  }
  return {
    rows,
    summary: {
      questions: rows.length, TP, FN, FP, TN, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
      confidentWrong: rows.filter((x) => x.confidentWrong).length,
      top1: withAnswer.length ? withAnswer.filter((x) => x.firstRight === 1).length / withAnswer.length : 1,
      mrr: withAnswer.length ? withAnswer.reduce((a, x) => a + (x.firstRight ? 1 / x.firstRight : 0), 0) / withAnswer.length : 1,
      hitPrecision: shownTotal ? withAnswer.reduce((a, x) => a + x.right, 0) / shownTotal : 1,
      unanswerable, byKind,
    },
  };
}

/** A table of the result for the screen of the command. */
export function report(rows: Row[], summary: Summary): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const out: string[] = [];
  out.push(`${summary.questions} questions: TP ${summary.TP}  FN ${summary.FN}  FP ${summary.FP}  TN ${summary.TN}`);
  out.push(`precision ${pct(summary.precision)}  recall ${pct(summary.recall)}  F1 ${pct(summary.f1)}  top-1 ${pct(summary.top1)}  MRR ${summary.mrr.toFixed(3)}  right share of shown sections ${pct(summary.hitPrecision)}`);
  out.push(`confident wrong answers ("Found" with nothing right in it): ${summary.confidentWrong}`);
  for (const [k, v] of Object.entries(summary.byKind)) out.push(`  ${k.padEnd(10)} n=${String(v.n).padStart(2)}  TP ${v.TP}  FN ${v.FN}  FP ${v.FP}  TN ${v.TN}`);
  if (summary.unanswerable.length) out.push(`questions whose words are in no section (counted as "nothing answers this"): ${summary.unanswerable.length}`);
  const bad = rows.filter((x) => x.outcome === "FN" || x.outcome === "FP" || x.confidentWrong);
  if (bad.length) {
    out.push("", "what went wrong:");
    for (const x of bad) out.push(`  ${x.outcome}${x.confidentWrong ? " (Found, wrong)" : ""}  [${x.kind}]  ${x.q}  -> ${x.state}${x.top ? ", first: " + x.top : ""}`);
  }
  return out.join("\n");
}
