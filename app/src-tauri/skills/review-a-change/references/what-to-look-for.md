# What to look for

**Does it do the right thing**
- Empty, zero, one, very many, very long, odd characters.
- Off by one, wrong comparison, the opposite condition.
- Failure paths: the network drops, the file is missing, the answer is malformed.
- Two people or two tabs at once; the same action twice.
- Time zones, dates, money rounding.

**Does it break what exists**
- Other callers of what changed.
- Old saved data, old files, old settings.
- Things removed that something still needs.

**Is it safe**
- Input from outside reaches a query, a command, a path or the page unescaped.
- Each action checks who is asking, and whether this record is theirs.
- No secrets in code or logs.
- See the skill `security-check` if it touches logins, money or personal data.

**Will it hold up**
- A query per row in a loop, no limit on a list, a missing index.
- Work that is never cleaned up: listeners, timers, open files.
- An error swallowed silently.

**Can it be trusted later**
- Tests that would fail if the code were wrong.
- A name that says what the thing does.
- A copy of something the project already has.
