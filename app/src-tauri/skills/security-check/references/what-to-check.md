# What to check

**Access**
- Every action checks on the server who is asking and whether this record is theirs. Try changing an id in the URL.
- Admin pages and hidden actions are really protected, not just hidden.

**Injection**
- Queries use parameters; no input is glued into SQL.
- No input reaches a shell command, a file path (`../`), a template or `eval`.
- Text from people is escaped on the page (cross-site scripting), including `dangerouslySetInnerHTML` and `v-html`.
- The server does not fetch URLs given by people without a check (server-side request forgery).

**Logins**
- Passwords stored with bcrypt or argon2, never plain or md5.
- Limits on tries. Reset links expire and work once. Sessions end on logout.
- Cookies are `HttpOnly`, `Secure` and `SameSite`. Forms that change things are protected against forged requests.

**Secrets**
- None in code, history, logs or the front end. See `find-secrets`.

**Files**
- Uploads: type and size checked on the server, stored outside the web root, names not trusted.

**Data**
- Answers send only the fields needed. Errors do not show stack traces to the public. Logs hold no passwords or personal data.
- Personal data is kept only as long as needed. Backups are protected too.

**Settings**
- Debug off in production. CORS is not open to everyone with credentials. HTTPS everywhere. Default accounts removed. Security headers set.

**Money and rules**
- Prices and permissions come from the server, not from the page.
- Doing a step twice or out of order cannot get something for free.
- Limits on anything expensive.

**Packages**
- See `check-dependencies`.
