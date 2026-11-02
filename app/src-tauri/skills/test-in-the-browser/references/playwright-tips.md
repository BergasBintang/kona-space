# Tips for Playwright tests

**Finding things**
- First choice: `getByRole('button', { name: 'Save' })`.
- Then `getByLabel`, `getByPlaceholder`, `getByText`.
- `getByTestId` when nothing else is stable.
- Avoid CSS paths and generated class names.

**Waiting**
- Use `await expect(locator).toBeVisible()` and friends; they retry by themselves.
- Never `waitForTimeout` as a fix; it only hides timing faults and slows the run.
- After a click that loads data, wait for the result on the screen, not for a time.

**Seeing what went wrong**
- Collect console errors: `page.on('console', ...)`, `page.on('pageerror', ...)`.
- Run with `--headed` or `--debug` when it is hard to follow.
- `page.screenshot({ path, fullPage: true })` for evidence.
- Keep traces on failure: `trace: 'retain-on-failure'`.

**Keeping tests solid**
- Each test makes its own data and does not need another test first.
- Log in once and reuse the saved state, instead of logging in for every test.
- Fake only outside services (payments, mail), not your own screens.
- Test a narrow window too: `page.setViewportSize({ width: 390, height: 800 })`.

**What to test**
A few full journeys that matter most. Details belong in smaller, faster tests.
