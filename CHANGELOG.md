# Changelog

Newest first. How versions are named: `docs/VERSIONING.md`.

## 0.37.0, 2026-11-07

Servers is now Connections, the Costs page shows every cut at once, and the Brain's notes read like files.

- **Connections.** The Servers screen holds two kinds of entry, a server and a GitHub repo, so it has a new name and two groups, each with a heading, a count and its own Add button. A card shows only what is true now: the address, who may use it, whether the key and the fingerprint are there. One **Copy…** button hands out the ssh config entry, the git address or the entry for a server that pulls the repo, and the copied text reads like a hand-written file (`~/.ssh/…`). Adding and editing open a dialog, not a form below the list. A GitHub repo has a **Port**: a network that blocks github.com on port 22 can use ssh.github.com and 443. Kona still never writes your ssh config.
- **A role is told which servers it may reach.** The session starts with the list, with what to type after ssh, and a refusal ends with the list that role may use.
- **Costs shows every cut at once.** A chart of dots with a smooth line (one dot per hour today, per day for 7 days, 30 days and all time up to the last 60 days), then lists by role, ticket, model and the most expensive sessions, with dollars in cents and a bar that is the share of the whole. A click on a line shows the tokens Claude read (new and from the cache) against what it wrote.
- **The Brain's Notes: a list on the left, the note on the right,** like Files, so nothing has to be closed to read the next note. A note's outline is on the left of it and closes to a thin strip with an icon that opens it again. The Report no longer says that nothing links to the page a project starts from. The ticket details open as a dialog.
- **Real buttons.** The tabs of a page, the period of Costs, the choices on a question card, the small tags and the strips that grow the office plan are buttons in the pixel frame, and the chosen one sits pressed in. The close button of a page is a button.
- **The office editor** has a **Clean the map** button (undo brings it back), an arrow for the front of every piece, and the top bar's back arrow is off while you edit.
- **Agents know the Mockups sizes.** A new starter note, and the skills that draw a mockup, say how big each of the five devices is (320 x 568, 390 x 844, 768 x 1024, 1024 x 640 and 1440 x 900), that the viewer is built into Kona, and where a mockup is saved.

## 0.36.0, 2026-11-06

The Brain map, and one source of truth for a project's notes and documents.

- **The Brain map fills the window** down to the bottom, with the same space at the bottom as at the sides. Its dots are laid out like the Miralis canon's skill graph: groups packed apart, dots held inside their group, no two dots touching. A dot has no name until the pointer is on it; a click shows its name and the names of everything it links to and dims the rest; a click on empty map puts it back. The "Start here" note sits in the exact middle with a ring.
- **A document is a note.** One page view for Files and the Brain (find, the outline of headings, the text as written). Sessions are told to write documents as notes, one fact in one note, linked and never copied; the notes are the current truth, and when two disagree a session says so and asks. A session can change one section of a note it saved. A note a session saves on a ticket always carries that ticket, written by Kona.
- **A better and safer search.** A long document no longer answers a question because the words are somewhere in it (the words must stand together). `node tests/search-eval.mjs` measures the search with labelled questions (true and false positives and negatives); a test keeps the numbers from getting worse.
- **Checks in the Brain report:** a note that links to a note that changed after it, and two decisions under one ticket on different days. A button "Check for conflicts" on a note asks one cheap Haiku call whether it disagrees with the notes it links to (it asks first and uses a little of the plan).

## 0.35.1, 2026-11-04

Reading a server's fingerprint works again, and a GitHub repo now has a card of its own on the Servers screen.

- **The fingerprint is read by Kona itself.** On Windows it failed against modern servers with "did not answer with a host key", because the ssh tool that comes with Windows is too old to talk to them. Kona now reads the server's public keys by itself and needs no tool on the PC. It still sends no login and runs nothing on the server, and it asks first.
- **A failure says why.** Connection refused, no answer within 8 seconds, no common method, or the reason the server gave. When nothing could be read, the dialog says "Could not read the fingerprint" and has only a Close button, so there is nothing to trust.
- **GitHub repo cards.** On the Servers screen, Add a GitHub repo. A card holds the repo (`owner/name`), the nickname your ssh config uses for it, the real address behind the nickname (github.com), the key for read and write on this PC, the read-only key you hand to a server, and the servers that pull the repo with where the read-only key sits on each. Buttons copy the git address, the ssh config entry, and the entry for a pulling server. The fingerprint is read from the real address.
- **The GitHub address box is gone** from Settings, Projects and from Add a project. Nothing used it. A saved value stays in the file, unread.
- **Buttons that cannot be pressed are grey,** not only faded.
- **Good to know.** A repo card is checked like a server: a role may use its nickname only when the card lists the role. Kona cannot tell whether GitHub marks a key read only (that needs a login), and it does not lock `git push`.

## 0.35.0, 2026-11-04

A meeting room: a workflow now runs by itself, and the people talk in one group chat.

- **Run a workflow.** Press Run on a workflow and its people work one after another, in the order of the steps. Each one works in a fresh session of their own, and when they finish, their last written words are handed to the next person, who starts at once. No tickets are made any more. Run asks first, and says who works in which order and that it uses your plan.
- **The Meeting.** The Lounge is the meeting room. The flow board is gone from the standard office; a long table with twelve chairs, enough for all eleven people, stands in the Lounge and opens the Meeting sheet. It has two tabs: Chat, and Workflows (the plan editor).
- **One group chat.** What each person says piles up in the order it was said, with their name and face. Their tool uses are one folded line that opens on a click. A permission or a question shows in the chat, and the meeting waits for you. You can write in the chat: to whoever is working now, or to a person by name ("Jiro, use PostgreSQL"); a person whose turn has not come reads it when they start. A finished chat can be read again later.
- **Stop and Try again.** Stop is always there. If a step fails, or Kona is closed, the run shows as stopped and Try again goes on from that step.
- **The cats sit at the table.** While a run goes on, each person's cat is on a chair at the long table, and the desk is left without it. The cat can still be clicked.
- **Good to know.** An office you saved before this version keeps its old flow board as decoration and gets the long table back with its chairs, with a notice. The steps run one after another, never at the same time. Each run is one plain file in the project's `.kona/runs` folder.

## 0.34.0, 2026-11-04

Mockups: pick a part of a page, leave a note, and turn the notes into a ticket for the designer.

- **Pick a part.** A pointer button in the Mockups toolbar turns pick mode on. The page stops answering clicks and links, the part under the pointer is outlined and named with its padding, gap, radius, border and size, and a click opens a box beside it that asks what should change. Works on a state you reached by clicking, such as after a sign-in. Esc closes the box, then pick mode, then goes back to the cards.
- **Numbered notes.** Each note becomes a numbered pin on the page. A column on the right lists them; a note can be changed there, or removed, and the numbers close up. They stay while Kona is open, also if you go back to the cards and return.
- **Send.** The arrow above the notes turns them into a ticket for the design person. One cheap Haiku call writes a draft that only uses what you pinned; you read it and change it; one button makes the ticket (Ready, worked on in the main folder) and starts her. If she is busy the ticket waits in Ready and a line says so. If Haiku cannot be reached, the draft is a plain list of your own notes. The page's text goes to Haiku only as quoted data, with anything that looks like a key hidden first. The cost is counted as a ticket draft.
- **A page that replaces its whole document still works.** The helper puts itself back after the page does that.
- **SQLite, if a mockup needs it.** The make-a-mockup skill can now give a card a small database in the page (sql.js, MIT; in memory, nothing is saved) for search, sort, unique values and linked tables with their real rules. A mockup still needs only HTML and CSS.
- **Good to know.** The pins are not shown on a picture, only on the live page. Copying the SQLite files into a card is a shell command that you are asked to approve.

## 0.33.0, 2026-11-04

Three new skills for drawing and building pages, and the window opens full screen at an 80 percent view.

- **Three skills for mockups.** `make-a-mockup` draws a page that runs by itself with made-up data (HTML and CSS required, JavaScript optional, every size a named value, unknown values marked `[TBD]`, a check script and a starter login page with three made-up accounts). `reverse-a-mockup` reads a built project's own source and copies a few pages as a static mockup, never from the live site or real data. `build-from-a-mockup` turns an agreed mockup into the project's own code, with its own values and its real API. Nokka (the Designer) and Jiro (the Frontend) have them in their trees.
- **A ticket's own copy can read what it needs.** The owner's mockups and the person's skill files live in the main folder, which the copy does not hold. The session may now read them there, and only read: it still has to ask before it writes anywhere outside its copy.
- **Opens full screen.** The middle button of the title bar brings the window back at half the width and half the height of the screen, in the middle.
- **80 percent is the default view.** Ctrl and 0 goes back to it. A copy that was already installed starts at 80 once; after that your own choice is kept.
- **Good to know.** A mockup cannot send a form, so a button that relies on the form's own submit does nothing there. The skills say so, and make buttons that work.

## 0.32.0, 2026-11-04

Mockups: a big screen in the office opens a sheet where the pages that people drew for a project can be clicked through, in drawn devices.

- **A big screen in the Lounge.** A new piece of the office, on the wall behind the meeting table, opens the Mockups sheet. An office saved before this version gets the screen back by itself, with a notice.
- **Cards.** Each folder of `.kona/mockups` in a project is a card. A click opens its page in a device; the pages of a mockup link to each other like a real site, and you move between them by clicking inside it. A card with no start page says so.
- **Five drawn devices.** Small phone (320 px wide), phone (390), tablet (768), laptop (1024) and desktop (1440); the two phones and the tablet turn on their side. The page runs at the true size of the device (its width, its height and its media queries are the device's, never the window's) and the whole device is shown smaller to fit the sheet. Zoom in with two buttons, or with Ctrl and the mouse wheel, up to twice the true size; drag the sheet to move; one button goes back to the fit.
- **Live pages.** A mockup runs its own scripts, so forms, menus and a wrong password can be tried. It cannot reach the web, Kona or anything outside its card. Start again puts the page back to its beginning; the page also loads again by itself when one of its files changes. Pictures, fonts and video are files next to the page (a video plays and can be moved around in).
- **Light and dark.** A sun and moon button switches the page between its two looks without loading it again; the next page of the card follows.
- **Esc goes back one step.** In a mockup it returns to the cards (also when the page has the keyboard); on the cards it closes the sheet.
- **The Kona mark is off while a sheet is open.** One slip of the pointer no longer takes you from the page you are working in back to the welcome page.
- **Good to know.** On a screen scaled to a fraction (125 percent, for example) a page may see a pixel or two more than the device's width, never less; at 100 or 200 percent it is exact. Nothing is read from anywhere but the card's own folder.

## 0.31.1, 2026-11-03

A tidier file reader, and the slide sheet reaches the top bar.

- **One row for the file's name and its controls.** Find, Show the text (or Show it as a page), the zoom and an info icon now sit in the title row, to the right of the file name. The zoom buttons no longer float over the picture or the page, and "Show the text" no longer sits lower than the words beside it.
- **File details in a dialog.** The row with the path, size and date is gone. The info icon opens a small dialog with where the file is, its place on this PC, its size, when it changed and what kind it is, with Copy path and Show in Explorer. The path also shows when you hover over the file name.
- **The sheet starts at the top bar.** A page that slides up (Files, Brain, a person...) now covers the whole office strip instead of leaving a band of the office above it.

## 0.31.0, 2026-11-03

Pictures and web pages zoom, web pages show the pictures drawn by their styles, Auto is a permission mode, and the buttons say what they do.

- **Zoom for pictures.** A picture in the file reader opens fitted to the window. Two buttons and the percent between them zoom it; Ctrl and the mouse wheel (or a pinch) zoom toward the pointer; a bigger picture can be dragged. The percent goes to the real size and back to fitted.
- **Zoom for web pages.** An `.html` file has the same buttons, and Ctrl and the wheel work over the page. The page lays itself out again for the new size, as a browser does. Its scripts still do not run.
- **Web pages show their background pictures.** A page that draws pictures with `url(...)` in its styles (a mock-up cut in strips of one screenshot, for example) showed none of them. They are read from the project now, also from a style sheet's own folder, and a picture used many times is carried once.
- **Auto.** A person's Set up offers a fourth permission: Auto, where a safety checker built into Claude Code decides, and you are asked only when it holds something back. Commands to a server still ask. It needs an account and a model that Claude Code allows it for.
- **Buttons.** End session is red, Resume is green (the accent colour). Plain actions (Open, Copy, Check again, Previous, Next, Cancel and Close in boxes) are real buttons, and the ticket cards on the Board are real buttons too, so the keyboard and the screen reader treat them the same way.

## 0.30.0, 2026-11-03

You can see how big a chat's memory has grown and make it smaller, links in replies open, lists count properly, and the map zooms smoothly.

- **The memory of a chat.** From 100,000 tokens a chat shows "Memory: getting long" (and "long" from 250,000) in its header, with the exact size on hover. Every step Claude takes reads the whole chat again, so a long chat costs more for each step. The Compact button (two arrows that meet) makes it smaller with Claude Code's own /compact: it keeps what matters, and what is on your screen stays until you end the conversation and start a new one. After an hour without a step the header adds "Rested over an hour: the next message costs more", because the cache has gone cold.
- **Icons.** End session, New conversation and Resume are icons now (a stop, a speech bubble with a plus, a play), each with its name on hover. The cost reads "$0.0000 (estimated)".
- **Links in replies open.** A link to a web page opens in your browser. Before, it was only shown.
- **Numbered lists count properly.** A list with blank lines between its items showed 1, 1, 1; it now shows 1, 2, 3, and a list that begins at 3 starts at 3.
- **The map zoom glides.** The first step from the whole building to a closer view was a jump to twice the size; the size now changes smoothly over a fraction of a second and settles on a whole number, so the pixels stay sharp. It holds still if Windows is set to reduce motion.

## 0.29.0, 2026-11-03

Bako joins the office, web pages open as pages in the file reader, and the cats no longer hold a card.

- **Bako, the second office boy.** Kibby's friend, in dark brown with peach stripes and gold eyes. He sweeps the floor with a broom, and now and then goes to a door on the wall, takes a bento from the delivery person and brings it to one of the workers, saying "Got it, thanks!" and "Bento for (name)!". Click him to chat: he is the social one and knows every bit of office gossip (made up cat gossip, never about you or your project). With more than one door he picks one by chance; a map with no door leaves him sweeping.
- **Web pages in the file reader.** An `.html` file opens as a page, with its style sheets and the pictures that sit next to it in the project. A switch under the file name shows the text instead. Scripts in the file do not run and nothing is loaded from the web.
- **The cats no longer hold a card with their role icon.** Every role is already its own cat, with a name and a desk.
- **Fixed:** the broom, the mug and the bento were sometimes hidden behind a wall, a shelf, a cabinet or a post next to the office boys; and on an errand Bako no longer shows the standing picture between two tiles.

## 0.28.0, 2026-11-03

The file reader becomes a real reader: tables you can sort, diagrams, a list of headings, links between files, find, and a note when an agent changes a file. Every session is also told where to keep lasting knowledge, and has a tool to save it.

- **Tables** are drawn as tables. Click a heading to sort, filter the rows when there are many, and open View to choose row spacing, stripes, long text, the first column and which columns show. Copy puts the table back as markdown.
- **Diagrams.** A block written `mermaid` is drawn as a picture: flowcharts, sequence diagrams and state diagrams. Show the source and Copy the source sit beside each. Kona draws them itself, nothing was added to the program for it.
- **Lists and notes.** Nested lists, checklists (`- [ ]`), callouts (`> **Warning:**` or `> [!WARNING]`), copy buttons on code, and the front matter of a file as a row of facts above the page.
- **In the Files place:** an "On this page" list of headings, links between files that open the file or heading and a Back button, Find in this file (Ctrl+F), and the open file and folders are looked at again every few seconds. When an agent changes the file you are reading it says "Updated just now", and a file changed since you last opened it has a dot in the tree.
- **Where lasting knowledge goes.** Every session is told that the project has a Brain, what is worth saving and what is not, and how to look first. New tools: `save_note` (never changes a note that is yours), `list_notes`. Notes a session saved show "Saved by a session".
- **Kona's rules cannot go out of date in a project.** They come inside the program, so an update replaces them for everyone, and a session is told to follow them over an older CLAUDE.md and never to copy them into one.
- **The ticket sheet's Close button** is a framed "Close ticket" with an arrow, so it is not taken for the X of the sheet.

## 0.27.1, 2026-11-03

The Brain gets a smaller header and tabs in its title bar, names on its map no longer overlap, the message box grows, and the office no longer shakes when a person's chat opens.

- **The office stays still** when you open a person who already has a chat. Before, the chat scrolled itself in a way that also moved the office behind the page.
- **The Brain page.** Map, Notes and Report are tabs in the title bar, like a person's sheet. The question box and New note sit in one row, with the note count and the "Write a note when a session ends" switch under it. The big "Brain" heading is gone, because the title bar says it. The content scrolls under a header that stays put. The tabs no longer show a count.
- **Names on the Brain map never overlap.** Each name goes under its dot, or above, or beside it, wherever there is room. A name with no room is left off and shows when you point at the dot. The dot you pick always shows its name.
- **The message box grows** from two lines up to six as you type, then scrolls.

## 0.27.0, 2026-11-02

Roles become people you click and talk to, each with their own skills. Forty skills and a skill tree come with Kona for every new project, and the office is simpler to edit.

- **People.** Each role has a name (Kiki, Nokka, Jiro, Kit, Sen, Bejo, Yuzu, Nobo, Kenn, Sora, Kupa), shown as "Kiki, Product". A person does one thing at a time in a project; a second conversation with them is refused with a plain message.
- **A sheet for each person.** Click a person in the office. Tabs: Chat, History, Skills, Tools, Set up. The first message starts the conversation. The History tab lists their earlier conversations, each with Resume; Set up uses the full width in two columns; New conversation puts the open one away. The start form, the Sessions page, the Roles page and the room lists are gone.
- **Editor with icons.** Select, Erase, Undo, Redo, Save, Close, Zoom, Center, Edit and the turn buttons are icons. One list of Things with a picture for each (floors as small swatches, walls, doorway, what hangs on a wall, furniture). A "+" strip on each edge of the plan adds a row or column. "Use the standard office" is "Default map".
- **A new default office.** Rebuilt so that things sit with what they belong to: Library next to the Archive, Planning (Kiki, Nokka, the cork board, the flow board) next to Engineering (four desks, the branch board), the Server room next to Ops (Sora, the gear console), the Storage room with the leftovers bin, Admin with the cash desk, and a Lobby with Kupa's desk, the key cabinet and the front door, next to Support. A hall joins the top rooms, a corridor leads from it to the front door, and every gap in a wall has its two posts. It is made by `art/build-standard.mjs`. A project that already has its own saved office keeps it; "Default map" in the editor switches it to the new one.
- **Board and Workflows are two separate pages**, each opened by its own piece (the cork board and the flow board); the tab switcher between them is gone, and so are the room names under page titles.
- **Kibby** no longer stands still for a moment between two tiles when he is not stopping, and he never stands inside a door post. The keyboard of the server terminal is a real box and is hidden by the screen when seen from behind.
- **Tools for each project.** In a person's empty chat, the list "Tools this session needs" has a "Not needed" button on each tool, and "Add a tool" from Kona's fixed list; the choice is kept for that person in that project. Over each piece of the office that opens a screen sits a faint picture of what the screen is about (a bulb, a folder, a server, a coin, a key, a gear, a crate, a flow chart, a ticket card, a branch).
- **Tools for each person.** A Tools tab checks the programs they need for the project (Git, Node.js ...). Hide what the project does not use, add one with a search, and add, change or remove tools of your own (a program name and a version flag).
- **Forty skills come with Kona,** inside the program. Each is a real folder with its steps, and often templates and checklists. A new project starts with all of them, and with a starting tree for each of the eleven people. An older project keeps what it has and can take the tree with one button. When a new Kona has better text, a copy you never changed is updated, and one you changed is left alone.
- **A real skill tree.** The Skills tab is the tree: the job, branches you make for each kind of work, the skills under each branch, and the files of each skill. Each has a line on when to take it, and the person is told the same tree at the start of every conversation. Move a skill between branches, or change its line.
- **Make a skill as a folder.** The dialog for a new or changed skill shows the steps and any templates, references, examples and scripts, and saves it all at once.
- **Explanations behind a round "?".** On every screen, the text explaining a section moved behind a "?" beside its heading.
- **Smaller things.** The pickers use Kona's own list instead of the system one. On a touchpad, two fingers move the map and a pinch zooms it. The pulled-out drawer and the things beside a computer on a desk are drawn right from every side.
- **A bubble over each cat**: Working, Questioning or Finish.
- **A voice for each person**, with a starting voice for each. The Voice screen is gone.
- **A question card** for Claude's multiple-choice questions.
- **Click people and pieces, not rooms.** Eight pieces of furniture and two boards open the screens that have no person.
- **One wall colour** (`#d8cdb6`, three shades). No brick, no wall colour for each room.
- **Floor styles** instead of rooms: 24 styles from Kona's palette. An old saved office reads as styles with the same colours.
- **Edit the office:** one view (a plan, or "See in 3D"), a bigger list with pictures, unique things greyed out once placed, and no saving while a person or a screen has no piece (a saved office that lacks them gets them put back when it opens).
- **Kibby** walks on any free floor.

## 0.26.1, 2026-10-31

A clearer font, a floor fix, and a tidier editor.

- **A new interface font: Jersey 20.** In the old font ("Pixelify Sans" bold) the letter c looked like o, so "Launch" read "Launoh". Jersey 20 is a free pixel font whose letters stay apart, and it is about a fifth narrower, so long labels no longer spill out of their boxes. Nineteen fonts were tried first; the study is in `docs/FONTS.md`.
- **Carpet dots stay on their carpet.** Some of the dots on a carpet were drawn on the hall tiles next to it, in the carpet's colour. A sign error in the position sum was the cause.
- **The editor's bottom is one band.** The bar for the picked thing and the warnings had lines at different heights; now one band runs under the plan and the preview.

## 0.26.0, 2026-10-31

Edit the office: a map maker, bulky walls, a map with its own zoom.

- **Edit the office.** A new screen (a button over the office) to put things where you want them: floor, walls, windows, doors and boards on the walls, doorways, furniture, and the cats with their desks (a cat and its desk move, turn and are removed as one). A plan from above, the real office beside it, undo and redo, and a list of what looks wrong (it still lets you save).
- **One office for each project.** It is kept in the project's own .kona folder. A project with none shows the standard office, and the standard office is never changed.
- **Bulky walls.** A wall is now a block as big as a tile, so the building is bigger (45 x 27 tiles).
- **The map has its own zoom.** Ctrl and the wheel (or the + and - keys) zoom the map round the pointer, whatever the percent view is; the mouse wheel moves it up and down, Shift and the wheel left and right, Ctrl and the left button drags it, and Center brings the secretary's desk back to the middle.
- **Wall joints fixed for good.** Where a tall brick wall met a low wall, the low wall was drawn over the brick from some sides of the building. A tall wall is now ordered like every other piece, and windows, doors and boards are painted into their wall tile, so they can never be out of order with it.
- **The old drawing scripts are gone.** The office is drawn by the app itself from the map, so the scripts that drew it before are removed.
- Kibby walks the hall tiles of the map, mostly straight on along a corridor, and a map that is changed changes where he walks. His forehead stripes no longer run into his eyes.

## 0.25.0, 2026-10-31

A button for the Kona mark, no more plants, and the floor under the walls lined up.

- **The Kona mark is a button.** The chevron, the mark and "Kona" in the top bar now sit in a framed button, so it is clear you can press it (it still goes back to the welcome page).
- **No more plants.** They were only decoration, so every plant is gone from the office.
- **Walls and floor line up.** The tan base under the building used to stop short of the walls, leaving a step at the corners and a strip that did not match. It now follows the outer face of the walls. Where a room's outer wall meets the open edge of the hall the base still steps by the wall's thickness.

## 0.24.2, 2026-10-31

Every page in the sheet now uses the full width.

- **Full-width pages.** Some pages in the sheet (Costs, Servers, Settings, Voice, Roles, Accounts, Worktrees, Leftovers, Brain) stopped at a fixed width and left an empty strip at the side, while others filled the sheet. All of them now fill the sheet with the same side space (32 px), and the sheet's title bar lines up with it.

## 0.24.1, 2026-10-31

Two fixes for the sheet of 0.24.0.

- **No jump when a page slides in.** The whole app jumped up for a moment while the sheet slid up (the top bar vanished), because the sheet took the keyboard focus while still below the screen. It no longer scrolls the page, and its holder clips what sticks out.
- **Wider space between letters in the pixel font**, so "Launch" reads as "Launch" and not "Launoh" ("Bug Fix" stays clear). It is a little wider than in 0.24.0, so a tight label may now be cut off; tell me where.

## 0.24.0, 2026-10-31

Pages open in a sheet that slides up over the office. Plus a plainer top bar, a grey Kibby, a street door and cleaner furniture.

- **A sheet from below.** Click a room and its page slides up over the office, under the top bar and the turn buttons. Close it with the X button or Esc. There is no zoom into a room, no preview card and no Go to list any more. While the sheet is open the building cannot be turned and its rooms cannot be clicked.
- **Asks before it throws text away.** If you typed something in the page that no button or Enter has taken yet, closing it (X, Esc, a tab, the Kona mark, or a button in the top bar) asks first. A box you filled in and saved does not ask. Limit: pressing any button in the page counts as taking the text, so a draft is not protected after that.
- **A plainer top bar.** The Kona mark has a chevron: it goes back to the welcome page, the only way to another project. The project name is plain text, not a list. The Go to list and the Office button are gone.
- **Room names only on hover.** A room shows its name while the pointer is on it (or it has the keyboard focus), not all the time.
- **Tabs and lists.** A room with two pages (Board and Workflows, Voice and Settings) shows them as tabs in the sheet. A room with cats at desks opens the list of its cats (what each is doing, Set up, start or open a session) and the pages it leads to.
- **Kibby is grey.** A light grey head with three dark stripes on the forehead and a paler grey body. His written character says so too.
- **A street door.** The Entrance has a door onto the outside, in its east wall: an opening with two posts where the wall is low, a painted double door where it is tall brick, and a doormat.
- **Furniture stays out of walls.** Every piece is cut back from the walls it touched (shelves, racks, cabinets, the control panel, two chart boards), so none sinks into a wall. The build lists them and warns about any piece lying across a wall.
- The two plants that closed the corridor to the front desk are gone, and the secretary's screen has a frame on its sides.
- A little more space between letters in the pixel font, so small words such as "Bug Fix" and "Launch" stay readable.

## 0.23.0, 2026-10-30

Kibby, the office boy, walks the hall and talks. Plus workflows that move on by themselves, better cats, and a turn lock while a room is zoomed.

- **Kibby, the office boy.** A new character: a caramel cat in a blue apron who walks the hall with a small hop and a small lean. Click him to talk about anything. He is not a role: no desk, no session, no tools and no knowledge of your project. Each message is one cheap Haiku call on the project's account, and what it costs goes in the Costs list. He starts with "Hi!", and what he says types out letter by letter. He stands still while a room is zoomed or while you talk, and when Windows "reduce motion" is on.
- While a room is zoomed in, the building cannot be turned (the two buttons are off until you go back to the office).
- Two standing boards, two shelves and a plant moved a little so nothing hides the hall.
- **Workflows move on.** When a ticket is moved to Done (or removed), the steps of a workflow that waited only for it move from Backlog to Ready by themselves, and the ticket history says so. The Workflows screen shows "Running now": the open tickets of the workflow, what each waits for, and a "Start as <role>" button on each Ready step. Kona still never starts a session unasked.
- **Better cats.** Look 0 is a true three-quarter view (eyes, muzzle and belly turned, shaded on the far side, a tail), look 2 is from behind, and the two right-hand looks are their mirror images.

## 0.22.0, 2026-10-30

Workflows: the usual steps of a kind of work, drawn as a flowchart and turned into Board tickets. Plus a tidier Set up window, formatted text and better cats.

- **Workflows.** A new place, next to the Board (the Board room's card, or the Go to list). Each workflow is a list of steps with a role on each, drawn as a flowchart you can edit: add, remove and move steps, choose the role, choose what a step comes after. Three suggestions come with every project (New feature, Bug fix, Launch). Saving writes a plain file in the project's `.kona` folder and a note in the Brain with the steps in words.
- **Start** raises one ticket on the Board for each step. A step that comes after others waits in Backlog, and its card says "Waits for T-0003". The workflow itself holds no state: the Board stays the one place that shows where the work stands.
- The Set up window uses short words; every longer explanation is behind a "?".
- The welcome page shows the version and a Check for updates button, and the update card shows there too.
- Bold, italics, code, lists, quotes, headings, code blocks and tables are drawn as formatting in the update notes and in what Claude writes in a session (a table is kept as written). A link is shown as text and never opens inside Kona.
- Room names sit in the middle of each room, a little see-through, instead of on the hall floor.
- The cats look the right way from all four sides of the building: a face turned to the left or right, and two views from behind.

## 0.21.0, 2026-10-30

Every role can be set up, skills belong to a project, and the office can be turned.

- **Set up a role.** Each cat in a room has a Set up button: a personality line, the job, the model, how much it may do on its own, the skills it may use and the connectors it may reach. A role loads only what you chose, nothing else, so a session starts with fewer tokens (measured on this PC: about 41,200 before, about 33,100 with one skill).
- **Skills belong to a project.** They live in the project's own `.kona` folder, not on the computer. You can bring one in from the computer's skill shelf. The personality, job and model are shared by all projects; the skills and connectors are per project.
- **Turn the building.** Two buttons turn the office a quarter at a time, so you see it from all four sides. Windows hang on every outer wall, and the cats look the right way from each side.
- **A new office, built from parts.** Every desk, chair, shelf, wall and plant is its own small picture on whole tiles. The walls are drawn as one structure, so corners, runs and doorways have no seams. The rooms are laid out like a real office: a hall, rooms of different sizes, one door each, onto the hall.
- Chairs, sofas and armchairs are plain seats. A piece next to a wall is ordered correctly against it, and the building has no short stubs of brick wall.
- Behind the scenes: the old flat office picture and its leftovers are gone, and the art build checks every side of the building.

## 0.20.3, 2026-10-30

The first release with the office: a welcome page, one account per project, a pixel-art office with a cat for every role instead of the sidebar, a light paper look and a pixel font. This release holds everything from 0.20.0 to 0.20.3; their entries are below.

- Opens on a welcome page with a card per project and its account; a project without an account asks which one it uses.
- An isometric pixel office with a room for every place; cats type, wave and blink from what their sessions are doing.
- Fixed roles plus a secretary, a light cream look and a clean pixel font.
- Since 0.20.2 the old design files are gone, and `docs/DESIGN.md` is rewritten (version 4). Nothing else changed in the app in this step.

## 0.20.2, 2026-10-30

The old design files are gone. Nothing in the app changed.

- Removed the FigCraft design (`docs/design`, `docs/FIGCRAFT.md`), the early test scripts (`spikes`), the notes and screenshots of the two trials (`docs/trials`, which was never in git) and the spare wood frame set. The design files and scripts stay in git history (the 0.20.1 commit still has them).
- The README, `CLAUDE.md`, `docs/DESIGN.md` and the art notes no longer point at them.
- The old `roles.json` in the data folder was deleted (it was not read any more). The old cost-ledger backup from 2026-10-28 was kept: it holds 56 cost records the live ledger no longer has.

## 0.20.1, 2026-10-30

Cleanup of what the old look left behind. Nothing new to learn.

- The leftover rounded-corner classes (100 uses) and the radius tokens of the soft look are gone, along with an unused colour token.
- A command nothing called (`running_sessions`) is removed, and the backup no longer copies the old `roles.json`.
- The README and the Accounts help now describe the office, the fixed roles and one account per project.
- Still waiting for a decision (ticket T-0003): the old design files in `docs/design`, the FigCraft guide, the early trials and spikes, and a few files outside the project.

## 0.20.0, 2026-10-30

The office: a new look, a welcome page, one account per project, and a pixel office instead of the sidebar.

- **Welcome page.** Kona opens on a page with a card for each project: its account, and whether that account is signed in. A signed-out account offers Sign in or Use another account. A project with no account yet asks "Which account does this project use?" once. The Kona mark in the top bar brings you back to it.
- **One account per project.** Every session in a project (a role, a ticket, a Brain question) uses the project's account. Adding a project asks for one of the signed-in accounts. The account of a role is gone. Removing an account clears it from the projects that used it, and they ask for another on the welcome page. Resuming an old session keeps the account it was saved under, because its transcript lives there.
- **The office.** The sidebar is replaced by one isometric pixel-art building with a room for every place (Board, Brain, Files, Servers, Git, Costs and so on). Click a room to zoom in and open what it holds. A top bar stays in view with the project, a Go to list of every place, a way back to the office, what is waiting on you, the account, and the two plan bars.
- **Cats at their desks.** Every role is its own cat, at its own desk. A cat types while its session works, raises a paw when it waits on you, and looks pleased when it is done, with a small bubble that says so in words. Cats blink when idle. Motion stops under Windows "reduce motion" and when the window is hidden.
- **A secretary.** A new role at the front desk for general questions. She turns what you say into tickets for the other roles.
- **Roles are fixed.** The ten roles and the secretary come with Kona and cannot be edited. Roles now shows them read-only. The old roles file is no longer read (it is left where it is). A custom role made before this version is no longer available: a ticket that used one asks you to choose a role again.
- **A light paper look.** Warm cream and paper colours, bright but not too bright, with dark brown text. Every pair of colours is checked by `npm run contrast` (text 4.5 to 1, borders and the focus ring 3 to 1). Hover goes darker. No rounded corners anywhere.
- **Pixel art everywhere.** A new pixel logo and app icon (the orange cat), pixel state marks, tiled pixel frames for buttons, cards, dialogs and text boxes (paper for most, teal for the main button, red for a button that cannot be undone), and a clean pixel font (Pixelify Sans, licence OFL) for headings, buttons and labels. Long text, code and paths keep plain fonts.
- Not done: the window zoom steps (90 and 80 percent) make pixels uneven, so the office and frames look slightly rough there; moving furniture and a way to add rooms; the cleanup ticket (T-0003) that removes the leftovers of the old look and design files.

## 0.19.4, 2026-10-28

A new logo, and Costs is always one project.

- A new logo: a black cat with soft pointed ears and two tilted white oval eyes, with a gold sunflower between its ears. The app icon is the cat on an ice-blue rounded square; inside the app the mark is the same cat in flat gold. It is drawn by `docs/design/build/build-logo.mjs`, which now writes plain SVG (no FigCraft needed).
- Costs is always for the open project. The This project or All projects switch from 0.19.3 is gone, and so is Group by Project (it would be one line). Open another project to see its costs. Costs of projects that are no longer in Kona stay in the ledger file but are not shown.

## 0.19.3, 2026-10-28

Costs shows the open project.

- Costs now opens on the open project only. A new switch next to the period, This project or All projects, shows the whole ledger again when you want it. Before, every project in the ledger was listed, including ones you had removed from Kona, which looked like another project's costs leaking into a new one.
- With one project shown, Group by Project is hidden (it would be a single line) and the grouping starts on Role. The ? next to Costs explains the switch.

## 0.19.2, 2026-10-28

A softer, lighter look.

- The dark theme is lifted one step: the page background goes from near-black to a soft slate, the cards and panels follow, and the text is a little warmer. Text and state colours keep their contrast (body text about 13 to 1; the state words stay readable on their tints).
- The logo's gold shows up in a few places that are not state colours: a thin marker on the active place in the sidebar, the Kona mark beside the title on Start a session and Add a project, the mark on the update card and beside the version in Settings, and the highlight of selected text. Gold is still never a button colour, because it is also the colour of waiting.
- The state colours for idle, done, stopped and left behind are a little lighter, and their tinted backgrounds a little fainter, so they stay clear on the lighter surfaces.

## 0.19.1, 2026-10-28

Help buttons, a map you can move, and a crop fix.

- Explanations are no longer shown under headings. Each one is behind a circled "?" next to the heading; pressing it opens the explanation in a small window (Esc, Close or a click outside closes it). This covers Settings, the page titles, Accounts, Scratch files, the Brain note switch and the Brain report. Messages about what is happening now (counts, errors, empty lists) stay on the page.
- The Brain map can be moved and zoomed: drag it, scroll the wheel, or use Zoom in, Zoom out and Fit all. It opens zoomed out so every group is fully inside the frame.
- Fixed Start a session and Add a project being cut off at the top when the window is short: the content is centred only when there is room, and can always be scrolled to the top.

## 0.19.0, 2026-10-28

Updates.

- Kona can update itself. A few seconds after it starts it asks GitHub (one small request, nothing about you is sent) whether a newer version is published. If there is, a card says so: Update and restart, or Later. On yes it downloads the installer, checks its signature, installs and starts again. If sessions are running the card says they will be closed. Offline or a failed check says nothing.
- Settings has a new Updates part: a switch for the start-up check, and Check now.
- Updates are signed with a key that lives outside the project, and Kona only installs what that key signed. `npm run release` builds the signed installer and the `latest.json` file; the steps to publish are in `docs/RELEASING.md`.
- Copies older than this one have no update check and need one manual install.
- Pages are wider, and they grow with the zoom: at 80% they keep the width they have at 100% instead of leaving wide empty margins. Buttons and badges ("Back up now", "Signed in") no longer wrap their words onto two lines.
- The repository is public and now has an MIT license (`LICENSE`) and a `SECURITY.md`.

## 0.18.0, 2026-10-28

An installer, and a Rust lint pass.

- An installer: `npm run tauri build` makes `Kona_<version>_x64-setup.exe` (2.66 MB, NSIS). It installs for the current user only, so it needs no administrator rights. The build is set to make this one kind of package only.
- Clippy (Rust's lint tool) was run over the whole core. 27 warnings, all about style, none about a bug; 22 were fixed automatically and the 10 tests still pass. The 5 left are three commands that take many arguments (Tauri passes them that way), one `sort_by_key` suggestion, and one false alarm on a line in the ssh check where two `if` statements sit side by side on purpose.
- `npm run smoke` can be pointed at another test port with `PORT=`.

## 0.17.0, 2026-10-28

Kona's logo.

- A logo: a cat head with pointed ears, a sunflower in its face, and two eyes in the middle of the flower (the cat is the name's owner, the sunflower is for the owner's girlfriend). It is gold on Kona's dark surface, and it replaces the ring mark in the sidebar, folded or open.
- The app icon (window, taskbar, installer) and the page icon are the same drawing, dark on a gold rounded square.
- The logo is drawn by `docs/design/build/build-logo.mjs` with no FigCraft window; its files and notes are in `docs/design/logo/`.
- Removed the unused Vite and Tauri sample pictures from `app/public`.

## 0.16.1, 2026-10-28

Size, a folding sidebar, and no window scroll.

- The whole window can no longer scroll: a focus jump had pushed the app up and left an empty strip at the bottom. Each part scrolls inside itself, and a stray scroll snaps back.
- Size: 100%, 90% or 80%, set in Settings or with Ctrl and minus or plus (Ctrl and 0 goes back to 100%). It is the web view's own zoom, so text, layout and pictures scale together, and it is remembered.
- The sidebar folds to a narrow strip of icons with its button or Ctrl+B, and remembers it. Waiting and left-behind counts stay visible on the icons.

## 0.16.0, 2026-10-28

Audit and hardening.

- The audit is written down in `docs/AUDIT.md`: what was checked, the plan against what was built, the measured budgets, what was fixed and what is still open.
- The window now has a content-security policy. Nothing was blocked in any place (seen in the release program).
- The graphics process is turned off (`--disable-gpu`): Kona's idle memory fell from about 235 MB to about 119 MB. The breathing mark is a stepped animation and the logo is still when idle, so idle CPU fell from 21% of a core to about 0%.
- The session limit is a hard 3 (was 6). Each Claude session takes about 400 MB, and the Settings text says so.
- A session's summary note waits while other sessions are working.
- A session can only be started with a permission mode Kona offers, a plain model name, a real session id and a folder inside a project. Anything else is refused by the core, whatever the screen sends. Unit test added.
- The brain's secret scan uses ASCII lower case so a letter with a longer lower case cannot shift a position. Test added.
- `npm run smoke` opens every place of a running Kona and checks nothing is blocked.

## 0.15.0, 2026-10-28

Polish: limits, settings, backups, resume.

- A Settings place: how many sessions may run at once (default 2, because each uses about 400 MB), each project's GitHub address, removing a project (its files and hidden folder are never touched), and where Kona keeps things.
- Kona refuses to start more sessions than the limit, with a plain message. Sessions that ended no longer count.
- Backups: one press copies Kona's own files, the cost ledger and each project's tickets and brain notes into a dated folder under `%APPDATA%\Kona\backups`. Kona never deletes a backup by itself; you can delete one after a confirmation.
- Earlier sessions: the sessions Claude Code saved for a project are listed under Sessions, and Resume continues one. The ledger counts only what the resumed session spends from then on.
- "Always allow here" on an approval card: Claude Code remembers the rule in the project's local settings and stops asking for the same thing. It is not offered for commands that reach a server.
- Add a project with an optional GitHub address.
- The file tree works with the arrow keys (Up, Down, Left, Right, Home, End), and a markdown file opens as a page, with a switch to the plain text.

## 0.14.0, 2026-10-28

The SSH registry.

- A Servers place: the servers each project may reach, kept as references. A server has a name, a host, a port, a user, the path of its key file, its fingerprint and the roles that may use it. Kona never opens, copies or stores a key; typing the text of a key is refused.
- A role can run ssh, scp or sftp only to a server listed for that role. A role with no server cannot run those commands at all. A host that is not on the list, the wrong user for a listed host, and any attempt to switch off the check of the server's identity are refused with a plain message Claude can read.
- A command to a listed server still asks you first, with a card that names the server (and says whether its fingerprint was checked), even if your own Claude settings would allow it without asking.
- Read a server's fingerprint after a confirmation (Kona connects to the port only to read the public host keys), compare it with the server's own record, and save it. If it later differs, Kona says it changed and warns you before you trust it again.
- Each server can give you a ready-to-paste entry for your ssh config. The key file is checked for being found, and for being inside a project folder or a cloud-synced folder.
- A message that contains a private key header is never sent to Claude.

## 0.13.0, 2026-10-28

The Brain learns from sessions.

- When a session ends, Kona writes a short note about it into the project's brain: what happened, decisions, open items and what was touched. One cheap Haiku call, after the conversation is cleaned of secrets. You can turn it off in Brain, and press "Write a note" in any session to do it by hand.
- A note says where it came from (the session, the role, the ticket, `source: summary`). Claude may link only to notes that exist; any other link it made up is turned back into plain words. The call's dollars are saved in the cost ledger under that session.
- A new session starts with a short digest from the brain: open items and recent sessions for its role and ticket, and a hint that it can look things up.
- Claude can search the brain itself with two new tools, `search_brain` and `read_note`. The answer says Found, Partly or Not in the brain, with the note and lines, and a miss goes on the wanted list. A note or section that looks like it holds a secret is never shown to it.
- "Ask Claude in a session" from the Brain now offers to save the answer as a note when it arrives.
- The sidebar scrolls when the window is short: the places scroll, the two plan bars stay in view.

## 0.12.0, 2026-10-28

The Brain.

- A Brain place: a graph of linked notes. Three layers: your own notes (plain markdown in the project's hidden `.kona/brain` folder, which you can write, edit and delete), 14 starter notes that ship with Kona (how to work with Claude Code agents and how to use Kona), and Claude's memory for the project, read in read-only.
- Ask the brain: every answer is Found in the brain, Partly in the brain, or Not in the brain, in words and a glyph. Found and partly answers show the note, the layer, the exact lines and how much of the question the section covers. A miss offers choices (ask Claude in a plan-only session, search the web after a confirmation, open the nearest topic, write the note) and never acts alone.
- A wanted list: questions the brain could not answer are kept in the project, shown in the report, and come off the list when you write the note.
- A map of the notes (dots, written and guessed links, soft groups), a notes list with a layer filter, and a note reader where `[[links]]` open notes and links to nothing are marked.
- A health report: links that go nowhere, notes nothing links to, decisions with no source, open items older than 30 days, notes that look like they hold a secret, the most connected notes, and how the notes group compared with how they are filed.
- Text that looks like a key, a password or an IP address is hidden from the search and from answers, and is never saved to the wanted list.
- Not yet: a note written by a session when it ends, a digest at the start of a session, and a search tool for Claude itself (the next version).

## 0.11.0, 2026-10-28

Leftovers.

- A Leftovers place: the programs your sessions started (dev servers, watchers) and which of them are still running after the session ended.
- Each item shows the program, the exact command, the port it listens on, which session (and role) started it and for how long. A red count on Leftovers in the sidebar, and "1 left behind" on the session row.
- Stop a program after a confirmation that shows the command, the port and what else it started. Kona only stops the very same program it listed (the same process id and start time). Ignore hides one you want to keep running.
- Scratch files: the size of Claude's temporary folder for each session, Show in Explorer, and Delete for a finished session after a confirmation.
- Removing a ticket's own copy warns when programs from that ticket's sessions are still running.
- Fixed: the first words of a session's title lost every letter s.
- Kona looks every 4 seconds only while a session is open or something is alive, and does nothing otherwise. Everything it sees is also written to `leftovers.jsonl` in Kona's data folder.

## 0.10.0, 2026-10-28

The worktree graph.

- A Worktrees place: a picture of the project's branches (where each left the main branch, how many commits ahead, how far the main branch moved on) and one card per working copy.
- Each card shows the branch, the folder, the ticket that owns it (or none), the last commit, how many files changed and are not committed, and a state: merges cleanly, would clash (with the files named), nothing to merge, or the folder is gone.
- Merge a copy's branch into the main branch from the card. Git checks for clashes first, the main folder must have no uncommitted changes, and a half-done merge is undone. The ticket history records it.
- Remove a copy from the card. A copy with uncommitted files is only removed after you tick a box that names what will be thrown away; a branch with unmerged commits is kept unless you choose to throw it away.
- Moving a ticket to Done asks first when its own copy still has commits the main branch lacks.
- A new confirmation dialog: one question, plain words, Cancel has the focus, Esc cancels.

## 0.9.0, 2026-10-28

A worktree per ticket.

- A ticket's session can work in its own copy of the repo: a separate folder inside the project's hidden `.kona/worktrees`, on its own branch `feat/T-0012-login-page`. It cannot step on your main folder or on another ticket.
- Frontend and Backend work in their own copy by default (a setting on the role), and a ticket can override it: follow the role, its own copy, or the main folder.
- A second session on the same ticket continues in the same copy. The card and the ticket show the branch, how many commits it is ahead or behind, and how many files changed and are not committed.
- The chat header says "Own copy" and shows the folder Claude is working in. Costs, the session list and the board still group by project.
- Claude is told it is in the ticket's own copy and on which branch. Merging and clean-up come with the worktree graph.

## 0.8.1, 2026-10-28

A cleaner repository for anyone who downloads it.

- A `README.md` at the top: what Kona is, what works, what you need, how to run it, where things are.
- A `.gitattributes`, so text files have the same line endings on every PC and pictures and the design file are never altered.
- The design scripts no longer point at one person's temporary folder: their screenshots go to `docs/design/build/build-output/` (ignored by Git), and `FIGCRAFT_CLI` can name FigCraft's command line tool.
- The author's own screenshots of other tools (`docs/trials/`) and the VS Code workspace file are no longer in the repository. They stay on the author's PC.
- More things are ignored by Git: local Claude Code settings, local database files, backups and temporary files.

## 0.8.0, 2026-10-27

Tickets and the board.

- A Board place with five columns: Backlog, Ready, In progress, Review, Done. Create a ticket, drag cards between columns, open a card to edit it, set its role, next step and a "waiting on you" flag.
- Tickets are plain text files in the project's hidden `.kona` folder, so you can read, edit and back them up without Kona.
- "Start session as ..." on a card opens a session as the ticket's role with the ticket told to Claude. The card moves to In progress, links the session, and shows what the session has cost.
- Claude can raise and update tickets itself through a small tool server Kona starts with each session (list, read, create and update). It can move a card up to Review, never to Done and never remove one. The history says exactly which session and role did each change. These tools run without an approval card, even in Plan only.
- The Costs place can group by ticket.
- Not yet: a separate worktree per ticket (next version), a summary written into the ticket when a session ends, drag with the keyboard (use the Column choice in the card).

## 0.7.0, 2026-10-27

The voice.

- A Voice place where you describe how Claude talks to you: a short description, language, length of answers, humor, emoji, plain words, and what to call you. The first voice is the terse operator you chose: short, plain words, no jokes, no emoji, no nickname.
- Kona's own lines on four screens (the start screen, a session starting, a session ending, near the plan limit) are in the same voice, and you can rewrite them.
- The voice is told to Claude at the start of a session, with a fixed rule that it only changes wording: never code, files, commit or ticket text, commands, warnings, errors or numbers, and never the facts or the advice.
- A "What Claude is told" box shows the exact text. When you start a session you can switch the voice off for that session.
- Permission questions, warnings and error messages always stay plain.

## 0.6.0, 2026-10-27

The needs check.

- Each role lists the tools it needs (Git, Node.js, npm, PHP, Composer, Python, Docker, Rust and Cargo, GitHub CLI, OpenSSH). The starting roles come with sensible lists, and you can change them in the Roles place.
- The start screen shows what the role and the project need, which are on this PC (with their version) and which are missing. The project's own files add to the list: for example a `package.json` suggests Node.js and npm.
- For a missing tool Kona shows the install command as text, with a Copy button. It never installs anything, and you can still start the session.

## 0.5.0, 2026-10-27

Costs.

- A Costs place: what your sessions cost, from the ledger Kona keeps. Pick a period (today, 7 days, 30 days, all time) and group it by project, role, account, model, day or session. Each line shows its share, the tokens sent and written, and the dollars.
- Dollars are an estimate at list price, not your bill, and the screen says so.
- Only sessions Kona ran are counted.

## 0.4.0, 2026-10-27

Accounts, and better lists.

- An Accounts place for two or three Claude logins. Add one, name it, sign in, rename or remove it. "Main" is the login already on this PC.
- Choose the account when you start a session, or give a role a usual account. A warning stops you starting on an account that is not signed in.
- Each account has its own plan bars, kept between runs with their age. The ledger saves the account of every turn.
- New base parts for choosing from a list: single select, multi select and a smart search box (typo-tolerant, initials, any word order, matched letters marked, a clear "nothing found" message). They replace the system dropdowns, which were white on the dark window.
- Not yet: signing in with an API key instead of a login.

## 0.3.0, 2026-10-27

Roles.

- A Roles place with ten starting roles: Product, Design, Frontend, Backend, QA, Security, DevOps, Marketing, Content and SEO, Support. Each has a mark, a model, a permission mode and a short brief.
- You can change any role, add your own and remove one. The list is kept on this PC.
- Start a session "as" a role: it starts with that role's model and permission mode, and Claude is told the role's brief. You can still change the mode for one session.
- The session list and the chat header show the role. Each paid turn in the cost ledger now records its role, ready for cost views.
- Only the three safe modes are offered (ask every time, edits free, plan only).
- Not yet: skills and tool servers per role, accounts, the board, the Brain, leftovers, resuming old sessions.

## 0.2.0, 2026-10-27

Projects and files.

- Add a project (a folder with your code). Kona makes a hidden folder inside it for its notes and tells Git to ignore it. Nothing else in the project changes.
- Switch between projects. Sessions are listed per project.
- A Files place: a folder tree and a read-only viewer for text, JSON, pictures and PDFs. Kona never changes your files from there, and it refuses any folder that is not in a project.
- Not yet: roles, accounts, the board, the Brain, leftovers, resuming old sessions.

## 0.1.0, 2026-10-27

The first Kona that works: one session, in a real window.

- Pick a folder and chat with Claude Code. Answers stream in as they are written.
- Claude asks before it runs a command or changes a file. Two buttons: Allow once, Don't allow.
- Paste or add a picture and send it along.
- Each session shows what it has cost so far in dollars (an estimate at list price, not your bill), and every turn is saved in a local cost ledger.
- The two plan bars (this 5-hour session and this week) fill in by themselves.
- Closing or killing Kona stops every Claude it started, and every program Claude started from it.
- Not yet: roles, accounts, files, the board, the Brain, leftovers, resuming old sessions.

## 0.0.2, 2026-10-27

A window opens. The build tools are in place.

- Rust and the C++ build tools are installed on D:, so Kona can be built here.
- `app/` holds the first Tauri window (React and TypeScript). It shows the starter page, not Kona yet.
- First build: 4 minutes 26 seconds. The idle window uses about 450 MB, above the 200 MB aim (see the plan, test S6).
- `VERSION` is the one place the version number is written; the app files copy it.

## 0.0.1, 2026-10-27

Before the app runs. This is the plan, the design and the first tests.

- The plan, in `kona-space-app.md`: what Kona is, 16 features, 41 decisions, the build order and the tests to run first.
- The design, in `docs/design/kona-design.figcraft`: tokens, parts, about 35 screens, a clickable prototype, a collapsed sidebar, and a Brain drawn as a graph of linked notes. Rules in `docs/DESIGN.md`.
- Three tests run in `spikes/`, all passed:
  - S1: a streaming `claude` session gives answers, exact cost, and the two plan bars with no unofficial address.
  - S3: a project's sessions can be listed from the transcript files.
  - S5: worktrees can be listed and a merge clash previewed without touching a file.
- No app yet.
