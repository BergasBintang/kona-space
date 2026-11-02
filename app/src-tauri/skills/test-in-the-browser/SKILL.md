---
name: test-in-the-browser
description: Use when checking a web page or app by actually running and clicking it, such as checking a flow end to end, taking screenshots, or writing a Playwright test. Sees what a person would see.
---

# Test it in the browser

Reading the code does not show what a person sees. Open it.

1. **Start it.** Find how the project runs (its README, its scripts). Say what you will start, and stop it again when finished. If it cannot run here, say so and do not pretend.
2. **See what tools exist.** The project may already use Playwright or Cypress: use those. If nothing is there, ask before installing anything.
3. **Walk the job as a person would:** open the page, wait until it has really loaded, click, type, and read what comes back. Follow the "done when" lines.
4. **Watch the sides:** the browser console for errors, failed network calls, and how long things take.
5. **Try these every time:** narrow window, empty state, wrong input, refresh halfway, the back button.
6. **Keep evidence.** A screenshot of each thing you claim, named after the step.

**Writing a lasting test** (open `references/playwright-tips.md` first): find things as a person does, by their role and visible words, and never by position or generated class names. Wait for what you expect rather than for a fixed time. Each test sets up its own data and can run alone.

Never run this against real users' data or a live site without being told to. Report what you did, what you saw with screenshots, each problem as a `bug-report`, and what you did not check.
