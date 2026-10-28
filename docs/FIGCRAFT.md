# FigCraft: what Claude can do, and must do

FigCraft is the design tool Kona's design is drawn in (version 0.7.0, early alpha, installed on this PC). Claude drives it through a local control port. This file is what was learned by doing it, so a later session does not have to find out again. Tags: (seen) tried on this PC, (read) from FigCraft's own command help.

## How it is driven

- Start the app with a control port, on this PC only: `figcraft --control 7979 <file>`. Without `--control` there is no port and nothing can be driven. If the port is closed, check `netstat` for 7979 first. (seen)
- Claude talks to it through `figcraft-cli mcp --attach 7979` (JSON-RPC over stdio). The helper in `docs/design/build/fig.mjs` does this. (seen)
- A second FigCraft window can be started on the control port while the owner's own window stays open. Each window uses about 450 to 600 MB of RAM, so two cost about 1 GB on a 7.3 GB PC. Say so before starting one, and never close the owner's window without asking. (seen)
- The headless command line (`figcraft-cli export`, `render`, `run`, `commands`) works without a window. `commands --filter TEXT` lists every command with its parameters; use it before guessing a name. (read)

## What Claude can do

| Area | What works | Notes |
|---|---|---|
| Layers | Create frames, text, rectangles, ellipses, vectors (SVG path data) with `create_node`; change anything with `set_properties` | Auto layout (`layout`, `gap`, `padding`, `sizingH` and `sizingV` of hug, fill or fixed, `mainAlign`, `crossAlign`, `wrap`) works well. Pass `sizingH: 'fill'` when creating a child |
| Text | Font family and style, size, line height, `features: {tnum: true}` for even digits | The built-in Nunito Sans has only Regular and Bold; any other weight renders as Regular |
| Pages | `page.add`, `page.select`, `page.delete`, `page.setBackground` | |
| Components | `component.create` on a frame, then `component.combineVariants` on several components makes a set | Name each frame like `State=default` or `State=default, Badge=on` **before** creating the component; the names become the variant properties |
| Instances | `instance.create` with a component or variant id and a `parent` | In an auto layout parent it is appended. Text inside an instance can be overridden, but it was not needed here |
| Prototype | `proto.interaction.add` with triggers (click, hover, mouse enter, mouse leave, after a delay, a key press) and actions (navigate, back, change to a variant, open or close an overlay, set a variable); `proto.flow.add` for flow starting points; `proto.settings`; `proto.present` and `proto.preview` | Hover looks need component variants (`changeTo`). Plain frames can only navigate |
| Scrolling | `overflow` on a frame: `none`, `horizontal`, `vertical` or `both` | The frame must have a fixed or fill size, with content larger than it. `get_node` does not report the value back |
| Variables | Collections of colours and others (`variable.createCollection`, `variable.bind`) | A collection that already exists makes the create command fail. The build script skips it |
| Output | `screenshot` (returns a PNG), `export` (png, jpg, svg, webp, pdf, fig), `file.save` | `file.save` returns the byte size, handy as proof it saved |
| Batches and undo | `batch` runs many commands as one undo step; `undo` and `redo` | |
| Mouse and keys | `pointer`, `key`, `type_text` drive the canvas like a person | Not used so far |

## What Claude must do

1. **Use the tokens only.** Every colour, size and radius comes from `docs/DESIGN.md` and `docs/design/build/kona-lib.mjs`. No off-token colours. Read `C:\miralis-canon\DESIGN.md` before judging a screen, and follow Kona's rules (state as glyph plus word, one accent, flat at rest, plain words, no marks borrowed from Miralis).
2. **Draw parts first, then screens from the parts.** A screen never invents a button. Anything that reacts in the prototype must be an instance of a component in the Interactive parts frame.
3. **Rebuild by script, not by hand.** The design file is made by the scripts in `docs/design/build/`. Change the script and run `run-all.sh`, so the file and the scripts never drift apart. A hand edit in FigCraft will be lost on the next rebuild unless it is also made in the script.
4. **Save after every build** (`file.save`) and report the byte size. Re-export the previews with `build-previews.mjs`.
5. **Look at the result.** Take a screenshot of every new part and screen and read it before saying it is done. Report what was not checked (for example scrolling and hover were not tried in the presenter).
6. **Compute contrast, do not guess.** `contrast.mjs` and `lightcheck.mjs` hold the WCAG calculations. Text needs 4.5 to 1, control borders 3 to 1.
7. **Ask first** before starting a second FigCraft window, closing one, deleting a page that holds work, or overwriting a design file the owner may have edited. Check `dirty` in `inspect_document` before overwriting.
8. **Keep the owner's words plain** when reporting: say what was drawn, what was not, and what could not be checked.

## Traps found

- `fill: 'none'` is rejected in `create_node`. Use `fills: []`. The helper converts it. (seen)
- Text `truncate` makes text wrap and overlap. Set a fixed width and shorten the words instead. (seen)
- Two text layers side by side lose the space between them. In code lines, use non-breaking spaces (U+00A0) inside each piece. (seen)
- `whiteSpace` is not a property. Do not pass it. (seen)
- `page.delete` cannot remove the current page. Select another page first. `ensurePage` in `kona-lib.mjs` deletes and re-adds a page, so every id on it changes. Build in the order of `run-all.sh`. (seen)
- A rebuilt page gets new ids. The registry file (`docs/design/build/registry.json`) is regenerated each run; do not keep ids from an older run. (seen)
- Component sets are created from frames that already sit on the page. Create all sets once, early, on the Parts page, then only make instances in the screens. (seen)
- `get_node` with a large `depth` on a whole screen is slow but fine; `inspect_document` with `depth` 1 lists a page's top frames. (seen)
- Node ids stayed the same after saving and reopening the file, so the registry survived a restart. (seen)
- FigCraft is alpha software. If a command fails, read its error: it names the allowed values. (seen)
- In the Bash tool, a heredoc that contains triple quotes can break. Write a script file with the Write tool and run that. A heredoc with an unbalanced quote or a backslash-u also broke on 2026-10-27, and so did `sed` with `\u` in its replacement. (seen)
- Frames clip their children by default. A tooltip that sticks out of its box (a hover look on a rail item) needs `clip: false` on the component, on every frame above it, and on the component set. (seen)
- Setting `gap` on a component set turns auto layout on and scrambles the variants. Set `layout: null` and give each variant an explicit `x` and `y`, then set the set's `width` and `height`. (seen)
- `edit.duplicate {ids}` copies a screen with its links and returns the new ids. `node.reorder {id, index}` puts a layer first (index 0). `edit.delete {ids}` removes layers. (seen)
- Redrawing one screen in an open file: keep the frame (delete its children, not the frame) so links that point at it survive, drop the old links of the deleted children from `registry.json`, and attach only the new links. A script that runs after the wiring step must attach its own links. `build-brain.mjs` (`INPLACE=1`) and `build-rail.mjs` do this. (seen)
- A build script that writes screenshots needs its output folder to exist. `kona-lib.mjs` `shot` now creates it; several older scripts still point at a scratch folder from an older session, so edit the `OUT` line before a full run. (seen)
- No `git init` yet, so a rebuild in place can lose the previous look. Copy `kona-design.figcraft` and `registry.json` somewhere before a big change. (seen)

- A small drawing (the logo options) can be built with no window at all: write a list of `node.create` steps and run `figcraft-cli run steps.json --out file.figcraft`, then `figcraft-cli render file -o out.png`. It costs no extra memory. `stroke: 'none'` is rejected there, so leave the stroke out. See `docs/design/build/build-logo.mjs`. (seen)

## Where the pieces are

| What | File |
|---|---|
| Design file and prototype | `docs/design/kona-design.figcraft` |
| Rules, tokens, screens, flow | `docs/DESIGN.md` |
| Driver and helpers | `docs/design/build/fig.mjs`, `kona-lib.mjs`, `kona-parts.mjs`, `kona-parts2.mjs`, `kona-interactive.mjs`, `kona-shell.mjs`, `layout.mjs`, `reg.mjs` |
| Build steps | `docs/design/build/run-all.sh` and the `build-*.mjs` files it calls |
| Previews | `docs/design/previews/` |
