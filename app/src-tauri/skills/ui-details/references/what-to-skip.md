# What to leave out

The easiest way to make a screen worse is to add a spectacular effect. Most libraries of animated parts are built for landing pages that people look at once. A tool people use all day needs small, fast, quiet details.

## What heavy effects really cost

Measured on one ordinary Windows PC with graphics acceleration off (this happens inside some desktop wrappers, on remote desktops and on old machines):

| What is drawn | Result |
|---|---|
| A small shader, 800 by 500, light | 60 frames a second |
| A full window shader, 1920 by 1080, light | 20 frames a second |
| The same, medium weight | 9 frames a second |
| The same, rich | 5 frames a second |
| A 2D canvas with 1,500 moving dots, 800 by 500 | 60 frames a second |

Meaning: **a full-window shader or a 3D background is a gamble.** On a machine with a good graphics card it is smooth; on the machine of half your users it is a slideshow. A plain page and a small 2D canvas stay smooth everywhere. In one large library of animated parts, about half the parts and nearly all of its backgrounds draw with shaders. Do not copy that.

## Do not reach for these

- **Full-window animated backgrounds** (aurora, galaxy, plasma, waves, liquid, particles). If a screen needs a background, use a flat colour, a still texture or a very slow CSS gradient.
- **Three-dimensional libraries and physics engines** for decoration.
- **A big animation library when CSS can do it.** Most of what is in these files is CSS transitions, a small timeline, or a few lines of JavaScript. Add a library only if the project already has one, or when the work really needs it (a drag with physics, a complex timeline). If you add one, say why and what it costs in size.
- **Gradient or glowing text, neon edges, glass blur on everything.** They age fast, cost speed and fight the project's own look.
- **Playful physics for daily tools:** a jelly radio, a tearing ticket, a crumpling paper, a shredder. Charming once, tiring the hundredth time. A single celebratory moment (a finished big job) may use one, once, and can be skipped.
- **Looping decoration** that has no meaning. A loop must mean "still working".
- **Motion on every change.** If everything moves, nothing is noticed.
- **Anything that delays the person.** Feedback answers at once; transitions finish in under about 300 ms for things people repeat.

## When a bigger effect is fine

- It happens rarely (a first run, a finished big job, an empty-to-full change).
- It carries meaning (it shows what changed or where something went).
- It can be skipped or is gone with reduced motion.
- It is cheap: HTML, CSS or a small 2D canvas, paused when hidden.
- The project's look wants it, and the person who owns the look said yes.

## Keep the project's look first

The timings here give a screen life. They do not give it a style. If the project is dark, light, soft, sharp or pixel based, keep that. Take colours, shapes and type from the project and use these details only for how things move and answer.

## Licences

Other people's component libraries often allow use inside a product but forbid reselling or bundling the parts. Write your own version of an idea (the timings and ideas here are free to use); do not paste someone else's files into a project without reading their licence.
