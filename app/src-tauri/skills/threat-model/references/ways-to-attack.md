# Ways things get attacked

For each crossing of trust, ask each of these.

**Pretending to be someone (spoofing)**
Can someone act as another person or service? Stolen sessions, weak resets, webhooks that are not verified.

**Changing things (tampering)**
Can someone alter data on the way or at rest? Prices from the page, ids in URLs, unsigned files, changing another's record.

**Denying it (repudiation)**
Could someone do damage and leave no trace? Are important actions logged, and can logs be altered?

**Seeing things (information disclosure)**
Can someone read what they should not? Other people's records, error messages, backups, logs, public storage folders, guessable links.

**Breaking it (denial of service)**
Can one person make it unusable or expensive? No limits, huge uploads, costly searches, paid calls triggered by anyone.

**Gaining power (elevation of privilege)**
Can a normal user become an admin? Hidden admin routes, role in a form field, a helper tool running with too many rights.

**Also ask**
- **The supply chain:** what if a package or an outside service turns bad?
- **People:** what can a tricked or careless admin do? Can one person do it alone?
- **AI tools:** if a model reads outside text, can that text give it orders? What can it reach when it obeys?
- **After a breach:** how would we notice, and what could we shut off?
