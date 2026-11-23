# English before and after

Each pair keeps every fact. Only the habits change. The examples are made up for this guide.

## 1. A product update

**Before**

> We're thrilled to announce a game-changing update that fundamentally transforms how teams collaborate. It's not just a new feature, it's a whole new way of working. With seamless integrations, robust security, and an intuitive interface, there's something for everyone. Let us know what you think!

**Tells:** inflation (game-changing, seamless, robust), not-X-but-Y, triad, "something for everyone", chat-style closer.

**After**

> Version 4.2 adds shared task lists. Two people can now edit the same list at once, and changes show up in about a second. It also connects to the calendar you already use. Tell us what is missing by replying to this message.

What happened: the claim became a fact (shared lists, a second), the vague "integrations" became the one that exists, the closer became a way to answer. Where the source had no number, no number was added.

## 2. An explanation

**Before**

> Caching is crucial for performance. At its core, caching is about storing frequently accessed data so that it can be retrieved faster, reducing latency, improving user experience, and lowering costs. Let's dive in and explore how it works.

**After**

> A cache keeps a copy of data you read often, so the next read does not go back to the slow source. The cost is that the copy can go stale. Most of the design work is deciding when to throw a copy away.

What happened: the run-up and the saying are gone, the triad of benefits went (none was shown), and the one real trade-off was said.

## 3. A short answer to a colleague

**Before**

> Great question! There are several factors to consider when choosing between the two options. On the one hand, Postgres offers robust features. On the other hand, SQLite is lightweight. Ultimately, the best choice depends on your specific needs. I hope this helps!

**After**

> Use SQLite while one program writes to it. Move to Postgres when two servers need the same data. You are at the first case today.

What happened: the answer first; the "it depends" became the condition it depends on. If you do not know the person's case, ask one question instead of guessing.

## 4. A bio

**Before**

> Maria is a passionate and dedicated designer who has played a pivotal role in shaping the digital landscape. Her work has been featured in numerous publications, highlighting her commitment to excellence.

**After**

> Maria Santos designs interfaces for banking apps. Her redesign of the transfer screen cut abandoned transfers, and the Design Weekly profile of her work ran in March.

If the source does not say what she designed, which screen, or which publication, **do not write the "after" above**. Write only what the source supports ("Maria Santos is a designer.") and ask for the details. Inventing specifics to avoid vagueness is worse than the vagueness.

## 5. A reply that rebuilds what the reader knows

**Before**

> To summarize the situation: the deployment failed at 14:02 because of a missing environment variable, which we first noticed in the logs, which showed an undefined value for the database URL. After investigating, we confirmed the variable was missing from the staging configuration. Therefore, I recommend adding it and redeploying.

**After**

> Add `DATABASE_URL` to the staging config and redeploy. The 14:02 deploy failed because it was missing.

The reader asked for the decision. The proof stays in the log, one click away.

## 6. Leave it alone

> "We're thrilled to announce," the headline read, and the crowd laughed.

This is a quotation inside a story about the phrase. Do not edit it.
