---
name: find-secrets
description: Use when checking whether keys, passwords or tokens have leaked into code, git history, logs or the front end, or before making a repository public. Finds them without ever copying the secret itself.
---

# Find secrets

**Never repeat a secret.** Report the file, the line and the kind, with only the first few letters. Do not write the full value in a reply, a ticket, a note or a command.

1. **Open `references/patterns.md`** and search the files for its patterns. Also look at `.env` files, settings, scripts, sample files and test data.
2. **Check they are ignored.** `.env` and key files must be in `.gitignore`. Run `git ls-files` to see whether any are tracked anyway.
3. **Look in the history.** Removing a secret from the latest version does not remove it from history. Search with `git log -p -S "<start of the pattern>"` for the patterns that matter. Say how far back you looked.
4. **Look in what ships.** Anything in the front-end code or a public folder can be read by everyone. Check for keys there, and whether a "public" key really is meant to be public.
5. **Judge each find:** real or sample? Live or old? What can it reach? Do not test it against the service to find out. If you cannot tell, treat it as real.

**Report,** worst first: where, what kind, what it could reach, and whether it is in history.

**What to do about a real one** (for the owner to decide):
1. Replace it at the service, first. A leaked secret stays leaked; deleting the line does not help.
2. Move the new one to where secrets belong (an environment variable or a secrets store).
3. Look at the service's logs for strange use.
4. Clean the history only if the owner wants it, because it rewrites the history for everybody.
