# Signature: how the practice system works

## Files (in `app/`)
- `signature-db.js`: the practice copy of CelestiaRetailLab (Pantry rows + generated rows). "Today" is 2025-06-30.
- `signature-engine.js`: runs T-SQL on a fresh copy of the data (SQLite via `vendor/sql-wasm.*`),
  compares results with the reference answer, points at slips, and writes the explanations and outlines for hints.
- `signature-gen.js`: the question generator (sets, a new question like this one, mixed review, validation).
- `signature-q1.js` (Phases 1–2), `signature-q2.js` (Phases 3–4): five template slots per tool.
- `index.html`: the app. It handles locked progression, the four hint layers, slips, completion and unlock, the hints slider, and resuming.

## Scope decisions
- Generated questions cover Phases 1–4 (Days 1–33). Phases 5–6 use their fixed requests (3 each),
  checked by key parts. After the walkthrough there, the same request is tried again.
- Saved data is version 3. Older saves keep their history; progression starts at Day 1.

## Checking changes
Run the template checker and browser tests from a Claude session. When adding files, list them in `app/sw.js`.

## Ideas for later
Run button to preview results, spaced review, SQL keyboard shortcuts, generated questions for Phases 5–6.
