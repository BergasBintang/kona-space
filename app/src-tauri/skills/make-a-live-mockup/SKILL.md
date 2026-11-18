---
name: make-a-live-mockup
description: Use when the owner wants the project's REAL program as a mockup (real screens, animations, a login for every role), not a drawing. You write a small recipe and Kona runs it in the Mockups sheet.
---

# Make a live mockup

A **drawn** mockup (skill `make-a-mockup`) is a page you write by hand with made-up data. A **live** mockup is the project's own program, run for real. Nothing is redrawn, so it cannot drift from the product: it is the product, on made-up data. The owner opens it in the Mockups sheet (the big screen in the Lounge), in the same five device frames (Small phone 320 x 568, Phone 390 x 844, Tablet 768 x 1024, Laptop 1024 x 640, Desktop 1440 x 900), and can pick parts and leave notes as on any mockup.

## Draw or live

- **Live** when the product already exists and the owner wants the real thing: every screen, every role, the real animations, real validation. Also the way to get a 1:1 copy of a product: the copy is the product.
- **Draw** when the thing does not exist yet (a new idea, three options for a slot), when the project cannot run on this PC, or when the owner will send the mockup to someone as a folder (a live card needs the project's own tools on the PC that opens it).
- Never "reverse" a product by hand when it can run: `reverse-a-mockup` is for a product that cannot.

## What Kona does, so you do not build any of it

- The card is a folder `.kona/mockups/<card>/` with one file, `mockup.json`, holding a `live` recipe. Nothing else is needed: no HTML, no CSS, no copy of the app.
- The owner presses **Start the program**. Kona shows the exact commands and asks. On a yes it runs the setup command, then the start command, in the project's folder (or the `cwd` you name), waits until the port answers, and shows the program in the device frame. **Stop**, a new Start of another card, leaving the Mockups page and closing Kona all stop it, with everything it started. One live program runs at a time (the PC is small).
- The page runs on its own address, so it keeps cookies and local storage and sends forms as in a browser. It cannot reach Kona's window or commands. The web is not blocked for it (fonts and map tiles load).
- Kona runs a small web server of its own on this PC and passes the requests to the program's port. It writes the program's own address (`http://localhost:<port>`, or the same with the numeric local address) as the address the page was loaded from, in pages, scripts, JSON and redirects, and makes the program's cookies ones that a page inside Kona's frame may keep, drops the program's content policy and frame ban, and puts the sheet's helper into pages (theme off, pick mode on).

## The recipe

In `mockup.json` (open `templates/mockup.live.json` and copy its shape):

```json
{
  "name": "School, live",
  "live": {
    "setup": "php artisan migrate:fresh --seed",
    "start": "php artisan serve --host=%KONA_LIVE_HOST% --port=%KONA_LIVE_PORT%",
    "cwd": "lms/api",
    "port": 8791,
    "entry": "/login",
    "ready": "/up",
    "wait": 90,
    "env": { "DB_CONNECTION": "sqlite", "DB_DATABASE": "demo.sqlite", "APP_URL": "http://localhost:8791", "MAIL_MAILER": "log", "QUEUE_CONNECTION": "sync" }
  }
}
```

- `start` (required): one line, at most 1000 letters. `setup` (optional): one line that makes the demo data; it runs before every start and must finish (3 minutes at most).
- `port` (required, 1024 to 65535): the port the program listens on. Kona refuses to start when something already answers on it. Kona also sets the variables `KONA_LIVE_PORT` and `KONA_LIVE_HOST` (the local numeric address, which the program must listen on, not `localhost`: that may mean the IPv6 one); on Windows the command line is run by `cmd`, so write `%KONA_LIVE_PORT%` there (on other systems `$KONA_LIVE_PORT`, `$KONA_LIVE_HOST`).
- `cwd`: a folder inside the project. `entry`: the first page, default `/`. `ready`: the page Kona asks until the program answers, default `/`; use a cheap one. `wait`: seconds to wait for the program, 5 to 300, default 60.
- `env`: names and values set for both commands. Names are letters, digits and underscores.
- `allow`: a list of what the page may do besides the ordinary, each one word of `clipboard` (copy to the clipboard), `downloads` (save files), `print` (show the print window) and `location` (ask for the device's location; the browser then asks the owner and the owner answers). Nothing is allowed unless the recipe says so, the question the owner answers lists what is allowed in plain words, and a recipe that adds a word needs a new yes. Name only what the product uses (a CSV download, a print page, a copy button).
- Every command is shown to the owner and run as written. Nothing in the recipe is a secret: the file sits in `.kona`, which may be backed up or shared. **Never put a key, a token or a real password in it.**

## Steps

1. **Read how the project starts.** Its readme, its scripts, its `.env.example`, its seeders. Find the command that starts the server, the port, which database it uses, how demo data is made, and which accounts exist. Do not start anything yet.
2. **Make the data a throwaway copy.** The program must never touch a real database. Choose, in this order: SQLite in a file inside the project (the framework's own setting, set through `env`), or the project's own demo seeder on a fresh database. `setup` makes it from nothing at every start, so every start is clean and the owner has a way to reset. Never point the recipe at a real database, a real `.env` secret, or a server.
3. **Cut the outside world.** Use local drivers: mail to a log, queues run in the same process, no payment or SMS keys, no calls to live services. A program that needs a real third party cannot be a live mockup of that part; say so.
4. **Serve a built copy, not a hot-reload server.** A development server that pushes changes by a web socket (Vite's or webpack's) cannot be passed through (a connection that stays open is not supported, and Kona answers 501). Put the build in `setup` (or use the framework's production-like mode), and serve the result. Plain request and answer works, so server-rendered pages, APIs and built single-page apps all work.
5. **Make the program listen on the local numeric address and on the recipe's port** (Kona gives them to both commands as `KONA_LIVE_HOST` and `KONA_LIVE_PORT`), and set the program's own base address (often `APP_URL`) to `http://localhost:<port>`. A page asks for many files at once: a server that answers one request at a time (PHP's built-in server by default) makes the page slow, so give it workers (for PHP, `PHP_CLI_SERVER_WORKERS` in `env`, 4 is enough) or serve the static files from a faster place.
6. **Every role and every duty gets an account in the demo data.** Read the seeder for them. If a role has none, add it to the seeder only when the owner says so (that changes the project), otherwise list it as missing. The accounts are made-up (`teacher@example.test`); never a real person.
7. **Write the recipe,** and a `name`. If the project has a journey note, a journey step can name the card (`mockup`): the page text of a live card is not read by the journey checker, so say so.
8. **Check what you can without the sheet:** the commands exist, the port is free, the seeder runs on a fresh copy of the database. Running the program yourself is allowed only after you say what you will run and the owner agrees; it must be stopped again.

## A product with a separate front end and API

The card folder may hold more than `mockup.json`: a small launcher and a setup script, both plain Node files, are fine (a Vue front end built to a folder of the card plus a Laravel API worked this way: the launcher serves the build under its path and passes everything else to the API, as the project's own web server config does). Rules that came from trying it on a real product:
- The setup script builds the front end only when its sources are newer than the last build, into a folder inside the card, never into the project's own build folder.
- Never start Laravel with `php artisan serve`: it clears the variables you set and reads the project's own `.env`, so its own database. Start the PHP server directly, with the router file Laravel's own `serve` uses.
- Point the database file and the storage folder into the card folder (`DB_DATABASE`, `LARAVEL_STORAGE_PATH`), and have the setup script refuse to run when the database is anywhere else.
- Never run a seeder that holds a real account (a super admin seeder). Run only the demo seeder and add the missing roles yourself, in a script in the card folder that uses the project's own models.
- Prove nothing real was touched: hash the project's own database files before and after a run.

## Nothing real may be touched (these were all found by trying)

- **The project's cloud storage (an S3 bucket) is never used.** A product keeps its pictures and files there with the keys of its own `.env`, and so does a migration that lists it: a test picture was once sent to a real bucket, and the setup of a database had read the real one. Point every storage setting (`AWS_*`, `CLOUD_*`, `S3_*`) at a small stand-in that your launcher runs, keeping the files in the card folder, and have the setup refuse to go on when the program says its storage is anywhere else (ask it: `php artisan config:show filesystems.disks.cloud`). Look in the project's `.env` and `config/` for every outside service (mail, payment, SMS, push, a callback to another product, a folder it scans) and switch each one off or to a local stand-in.
- **A product that needs PostgreSQL** gets a database of its own in the PC's server, with a name that starts with `kona_live_`, made from nothing at every start and dropped when the program stops. The scripts read the project's own `.env` only for the address and the login of the local server, never touch any other database, and drop only names with that prefix (a product that makes databases of its own, such as one per workspace, is given the same prefix for those). Check, before and after, that the project's own database and the others of the server saw no write.
- **A product that makes its first person with a one-time link** (a command that prints a link to set a password): run the command in the setup, keep the link in the card folder, and let the person set the password in the product's own form.
- **Python products:** put the packages in a virtual environment inside the card folder (the project's pinned versions may have no build for the PC's Python: install the packages it imports at their current versions, and say so).
- **Every start has an address of its own,** so what a program left in the browser (storage, a service worker, cookies) is never seen by the next one.

## What does not work

The frame the program runs in is not a full browser window. These real things are refused in it, quietly (the program's own refusal path runs, or nothing happens), and should be named to the owner when the product uses them:
- A link or a script that wants a new window (`target="_blank"`, `window.open`) cannot open one: its address is opened in the owner's own browser instead (only just after a click), where the program's login is not known, so a file that needs the login does not open there.
- A file download (a link with `download`, a saved file made in the page): dropped, unless the recipe allows `downloads`.
- The print window: only with `print`. Native `alert`, `confirm` and `prompt` do nothing whatever the recipe says (Kona's window turns them off; a program that has its own `confirm` keeps it).
- The device's location and the clipboard: only with `location` and `clipboard` (a staff clock-in that checks where the person is shows its "location refused" path until then).
Esc pressed inside the program belongs to the program (it closes its own dialogs); it does not take the owner back to the cards.

- A program that keeps a connection open (web sockets, server-sent events, long polling): not passed through. A web socket is refused at once; an answer that never ends is cut after two minutes with a plain error, and an answer is shown only when it is whole (one sent in pieces arrives all at the end).
- A link or script that sends the visitor to another site (a hand-off to WhatsApp, a payment page) takes the whole frame away from the program; Start the page again brings it back.
- Anything that needs the real outside world: payments, SMS, push, a real mail server. The map picker works only if its tiles load from the web, which they do not guarantee.
- A program that needs a tool the PC lacks (PHP, Node, Python, a database server). Kona installs nothing. Say what is missing.
- Pick mode names a part by its words and its place in the page (a real program has no `data-part` names).

## Hand over

Tell the owner:
- the card name and where it is, and how to open it: the big screen in the Lounge, the card, **Start the program**, then say yes to the commands;
- the commands, the folder, the port, and what `setup` makes (a fresh database from which seeder);
- the accounts, one line per role or duty, and what each shows;
- what you did not check. Do not say a screen looks right unless you saw it in the sheet. If you could only read the code, say "read, not seen".
