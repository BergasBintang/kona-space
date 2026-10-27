// A page that shows the base pickers with sample data, so they can be tried by hand and by script. Development only:
// open the window and add #kit to the address (or run `location.hash = "kit"`). A release build never shows it.
import { useState } from "react";
import { MultiSelect, Select, SmartSearch, type Option } from "./pick";

const MODELS: Option[] = [{ value: "sonnet", label: "Sonnet", hint: "The usual choice" }, { value: "opus", label: "Opus", hint: "The most capable, slower" }, { value: "haiku", label: "Haiku", hint: "The quickest and cheapest" }, { value: "old", label: "Older model", hint: "Not available", disabled: true }];
const PLACES = ["Bumi Serpong Damai", "Bandung", "Banjarmasin", "Balikpapan", "Batam", "Bekasi", "Bogor", "Cirebon", "Denpasar", "Depok", "Jakarta Selatan", "Jakarta Utara", "Jayapura", "Kupang", "Makassar", "Malang", "Manado", "Medan", "Padang", "Palembang", "Pontianak", "Semarang", "Serang", "Surabaya", "Surakarta", "Tangerang Selatan", "Yogyakarta"];
const CITIES: Option[] = PLACES.map((p, i) => ({ value: `c${i}`, label: p, hint: i % 3 === 0 ? "Java" : i % 3 === 1 ? "Sumatra" : "Elsewhere" }));
const SKILLS: Option[] = ["Frontend design", "Backend audit", "Code review", "Security review", "Write copy", "Deck builder", "Figma sync", "Release notes"].map((l) => ({ value: l.toLowerCase().replace(/ /g, "-"), label: l }));

// a stand-in for a server: slow, and answers by the first letters
const fakeFetch = (q: string, signal: AbortSignal) => new Promise<Option[]>((resolve, reject) => {
  const t = setTimeout(() => resolve(CITIES.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).slice(0, 20)), 400);
  signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); });
});

export function Kit() {
  const [model, setModel] = useState("sonnet");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<string[]>(["code-review"]);
  const [local, setLocal] = useState<Option | null>(null);
  const [remote, setRemote] = useState<Option | null>(null);
  const [free, setFree] = useState<Option | null>(null);
  return (
    <div className="mx-auto flex h-full w-full max-w-[640px] flex-col gap-6 overflow-y-auto px-8 py-8" data-kit>
      <h1 className="m-0 text-[30px] leading-[38px] font-bold">Base pickers</h1>
      <Select label="Single select (4 options)" value={model} onChange={setModel} options={MODELS} />
      <p data-out="single" className="m-0 font-mono text-[13px] text-text-tertiary">{model}</p>
      <Select label="Single select with search (27 options)" value={city} onChange={setCity} placeholder="Choose a city" options={CITIES} />
      <p data-out="city" className="m-0 font-mono text-[13px] text-text-tertiary">{city || "nothing"}</p>
      <MultiSelect label="Multi select" values={skills} onChange={setSkills} placeholder="Choose skills" options={SKILLS} />
      <p data-out="multi" className="m-0 font-mono text-[13px] text-text-tertiary">{skills.join(", ") || "nothing"}</p>
      <SmartSearch label="Smart search, list in the page" where="cities" options={CITIES} value={local} onChange={setLocal} />
      <p data-out="local" className="m-0 font-mono text-[13px] text-text-tertiary">{local?.value ?? "nothing"}</p>
      <SmartSearch label="Smart search, list from a server" where="cities" fetch={fakeFetch} value={remote} onChange={setRemote} />
      <p data-out="remote" className="m-0 font-mono text-[13px] text-text-tertiary">{remote?.value ?? "nothing"}</p>
      <SmartSearch label="Smart search, typed text allowed" where="cities" options={CITIES} free value={free} onChange={setFree} />
      <p data-out="free" className="m-0 font-mono text-[13px] text-text-tertiary">{free?.value ?? "nothing"}</p>
    </div>
  );
}
