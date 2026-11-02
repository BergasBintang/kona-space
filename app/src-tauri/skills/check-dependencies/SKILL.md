---
name: check-dependencies
description: Use when checking the packages a project depends on for known security holes, abandoned or suspicious packages, or before upgrading or adding one. Finds what truly matters without changing anything by itself.
---

# Check dependencies

Look and report. Do not upgrade or install anything without the owner's yes: an upgrade can break things, and installing runs other people's code.

1. **Find the lists:** `package.json`, `composer.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, and their lock files. Is the lock file committed?
2. **Run the audit tool that is already there,** if it is: `npm audit`, `composer audit`, `pip-audit`, `cargo audit`. Say what you ran. If it would need installing, ask first.
3. **Judge each finding; a scanner does not know your project:**
   - Is the package used in the running program, or only in development?
   - Is the faulty part actually called?
   - Is there a fixed version, and is the jump small?
4. **Look for what scanners miss:**
   - Names that nearly match a famous package (typos used as traps).
   - Packages with no updates for years and open security reports.
   - Install scripts doing surprising things.
   - One package pulling in a huge tree for one small job.
5. **Rank:** reachable and exploitable first. A long list of unreachable "high" findings is noise; say so.

**Before adding a new package:** do we already have something that does this? Is it maintained, and how widely used? What is its licence? How much does it bring along?

Report: what you ran, what matters (package, version, what it allows, the fixed version), what can wait and why. Upgrades get a ticket with a way to check nothing broke.
