# Work in progress: locked progression + generated practice

Started from the request to add generated questions, locked progression, layered hints,
flexible answer checking and richer progress. **Not yet live in the app.** These files are
in place but `app/index.html` doesn't load them yet.

## Done (and tested)
- `app/signature-db.js`: practice copy of CelestiaRetailLab (Pantry rows + generated rows;
  350 orders, 736 items, 20,000 LargeSales rows). "Today" is fixed at 2025-06-30.
- `app/signature-engine.js`: runs T-SQL on a fresh copy of the data (SQLite via
  `app/vendor/sql-wasm.*`) and compares the results:
  - Translates TOP, schema names, #temp, GETDATE/DATEADD/DATEDIFF, + for text, CAST/CONVERT,
    variables, procedures, triggers, indexes, partitions, UPDATE/DELETE with JOIN.
  - Accepts any equivalent query (JOIN vs subquery vs EXISTS, aliases, column order).
  - Points at slips: misspelled keyword/column/value, missing comma, missing schema,
    ambiguous column, nickname used in WHERE/HAVING, extra columns, wrong sort order.
  - Builds line-by-line explanations and fill-in-the-blank skeletons from any answer.
  - 126 of 132 old answers run (the other 6 need objects made by earlier questions).
  - 44 of 45 grading test cases behave as intended.

## Still to do
1. `app/signature-gen.js`: question templates, 5 per tool (Q1–2 new tool alone,
   Q3–4 combined with earlier tools, Q5 challenge), fresh parameters each time.
2. UI in `app/index.html`: locked tools (faded cards, gold padlock, handwritten note),
   layered hints (nudge → tool → shape → walkthrough + new similar question), slip card,
   completion celebration with unlock reveal, hints slider on menu cards, reopening on the
   exact question, saved-data upgrade from v2.
3. Add the new files to `app/sw.js`, test on an emulated iPhone, then merge to main.
