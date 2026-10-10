// Signature — the question generator.
//
// Every tool has five slots of question templates:
//   Q1–2  the new tool on its own, in its simplest form
//   Q3–4  the new tool combined with tools you've already completed
//   Q5    a small real-world challenge
// A template has "parameters" (a city, a category, a month, a price…) picked at
// random, so each time a set is shown again the questions are new. Before a
// question is used, its answer is run against the practice data to make sure it
// returns something sensible (not empty, no ties at a TOP cut-off).
(function () {
  const SIG = window.SIG;
  const TPL = {};      // tool id → [[slot 1 templates], … [slot 5 templates]]
  const BY_ID = {};    // template id → template

  function rng(seed) { let a = seed >>> 0; const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.some = (arr, k) => { const a = arr.slice(), out = []; while (out.length < k && a.length) out.push(a.splice(Math.floor(f() * a.length), 1)[0]); return out; };
    return f; }

  // G(tool, slot, template) registers a template.
  function G(tool, slot, t) {
    TPL[tool] = TPL[tool] || [[], [], [], [], []];
    const list = TPL[tool][slot - 1];
    t.tool = tool; t.slot = slot; t.id = `${tool}-${slot}${String.fromCharCode(97 + list.length)}`;
    list.push(t); BY_ID[t.id] = t;
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = n => String(n).padStart(2, '0');
  const monthRange = (y, m) => ({ y, m, name: `${MONTHS[m - 1]} ${y}`, mon: MONTHS[m - 1], start: `${y}-${pad(m)}-01`, next: m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`, last: `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}` });
  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";

  // Values from the practice data, so parameters always exist.
  let D = null;
  function domain() {
    if (D) return D;
    const E = SIG.Engine, col = sql => E.query(sql).map(r => r[0]);
    D = {
      cities: col('SELECT City FROM "crm.Customers" GROUP BY City HAVING COUNT(*) >= 3 ORDER BY City'),
      allCities: col('SELECT DISTINCT City FROM "crm.Customers" ORDER BY City'),
      segments: ['VIP', 'Loyal', 'Core', 'New'], categories: ['Journals', 'Drinkware', 'Stationery', 'Art', 'Tech'],
      channels: ['Web', 'Store', 'Mobile'], depts: ['Sales', 'Customer Success', 'Operations', 'Marketing'], regions: ['West', 'South', 'Northeast', 'Midwest'],
      reasons: ['Damaged', 'Wrong item', 'Changed mind', 'Late delivery', 'Not as described'], tprio: ['Low', 'Medium', 'High'], tchan: ['Email', 'Phone', 'Chat'],
      products: E.query('SELECT ProductID, ProductName, Category, UnitPrice FROM "catalog.Products" ORDER BY ProductID').map(r => ({ id: r[0], name: r[1], cat: r[2], price: r[3] })),
      customers: E.query('SELECT CustomerID, CustomerName, City, CustomerSegment FROM "crm.Customers" ORDER BY CustomerID').map(r => ({ id: r[0], name: r[1], city: r[2], seg: r[3] })),
      buyers: col('SELECT DISTINCT CustomerID FROM "sales.Orders" ORDER BY 1'),
      employees: E.query('SELECT EmployeeID, EmployeeName, Department, Region FROM "hr.Employees" ORDER BY EmployeeID').map(r => ({ id: r[0], name: r[1], dept: r[2], region: r[3] })),
      months: [], months24: [], months25: []
    };
    for (let y = 2024; y <= 2025; y++) for (let m = 1; m <= (y === 2025 ? 6 : 12); m++) { const x = monthRange(y, m); D.months.push(x); (y === 2024 ? D.months24 : D.months25).push(x); }
    return D;
  }

  // Builds one question from a template and a seed.
  function build(t, seed) {
    const r = rng(seed); const p = t.p ? t.p(r, domain()) : {};
    const ask = t.ask(p), sol = t.sol(p).trim();
    let clues = t.clue ? [].concat(t.clue(p)) : [];
    clues = clues.filter(c => c && ask.includes(c));
    return {
      t: t.id, s: seed, tool: t.tool, slot: t.slot, ask, clues, sol, p,
      need: t.need || [t.tool], ok: t.ok || [],
      nudge: t.nudge ? t.nudge(p) : null, why: t.why ? t.why(p) : null,
      before: t.before ? [].concat(t.before(p)) : undefined, after: t.after ? [].concat(t.after(p)) : undefined,
      checks: t.checks ? t.checks(p) : undefined, ordered: t.ordered, notes: t.notes ? t.notes(p) : null,
      skeleton: t.skeleton ? t.skeleton(p) : null, distract: t.distract || null, mode: t.checks ? 'state' : 'rows'
    };
  }
  function spec(qn) { return { sol: qn.sol, before: qn.before, after: qn.after, checks: qn.checks, ordered: qn.ordered }; }

  // Does the answer give a sensible result on the practice data?
  function valid(qn, tpl) {
    const E = SIG.Engine;
    const r = E.run(qn.sol, { before: qn.before, after: qn.after });
    try { return validInner(qn, tpl, r); } finally { E.close(r); }
  }
  function validInner(qn, tpl, r) {
    const E = SIG.Engine;
    if (r.error) return false;
    if (qn.checks) return true;
    const res = r.env.results[r.env.results.length - 1];
    if (!res) return false;
    if (res.values.length < (tpl.min || 1)) return false;
    if (tpl.max && res.values.length > tpl.max) return false;
    const m = /TOP\s*\(\s*(\d+)\s*\)/i.exec(qn.sol);
    if (m && /ORDER\s+BY/i.test(qn.sol)) {
      const n = +m[1]; const more = E.run(qn.sol.replace(m[0], `TOP (${n + 1})`), { before: qn.before }); E.close(more);
      const ok = E.orderKeys(qn.sol);
      const rows = more.env.results.length ? more.env.results[more.env.results.length - 1].values : [];
      if (ok && !ok.unmapped && rows.length > n) { const key = row => ok.keys.map(k => String(row[k.col])).join('|'); if (key(rows[n - 1]) === key(rows[n])) return false; }
      if (rows.length <= n - 0 && res.values.length < n) return false;
    }
    if (tpl.valid && !tpl.valid(res.values, qn.p)) return false;
    return true;
  }

  // A fresh question from a template: tries seeds until the answer is sensible.
  function fresh(t, seed) {
    seed = seed === undefined ? Math.floor(Math.random() * 1e9) : seed;
    for (let i = 0; i < 40; i++) { const qn = build(t, seed + i * 7919); if (valid(qn, t)) return qn; }
    return build(t, seed);
  }
  function rebuild(ref) { const t = BY_ID[ref.t]; return t ? build(t, ref.s) : null; }

  // The five questions of a tool's set.
  function makeSet(tool) {
    return TPL[tool].map(slot => { const t = slot[Math.floor(Math.random() * slot.length)]; const qn = fresh(t); return { t: qn.t, s: qn.s }; });
  }
  // A new question like this one (same template, new details).
  function sibling(ref) {
    const t = BY_ID[ref.t]; if (!t) return ref;
    for (let i = 0; i < 6; i++) { const qn = fresh(t); if (qn.ask !== rebuild(ref).ask) return { t: qn.t, s: qn.s }; }
    const qn = fresh(t); return { t: qn.t, s: qn.s };
  }
  // A question for mixed review, from a completed tool (slots 2–5 lean toward combining).
  function review(tool) {
    const slots = TPL[tool]; const pick = slots[1 + Math.floor(Math.random() * 4)];
    const t = pick[Math.floor(Math.random() * pick.length)]; const qn = fresh(t); return { t: qn.t, s: qn.s };
  }

  // What the first hint says when a template doesn't write its own.
  const NUDGE = {
    d01: 'Is this about the data itself, or about how the tables are built?', d02: 'Which columns does it name, and which table holds them?',
    d03a: 'Does it want every row, or each value just once?', d03b: 'Does it care about order, or about only the first few?',
    d04: 'Is this about the data, or about the shape of a table?', d05: 'Is this reading data, or changing it?',
    d06: 'Are you keeping every row, or only some?', d07: 'Is it a range, a short list, a pattern, or something missing?',
    d08: 'Does the answer need columns from more than one table?', d09: 'Should rows with no match still be kept?',
    d10: 'Is it two separate lists that need stacking or comparing?', d11: 'Does a value need reshaping before it’s shown?',
    d12: 'Does it ask about one part of a date: the year, month or day?', d13: 'Is it measuring time between dates, or moving a date?',
    d14: 'Could some of these values be missing?', d15: 'Should a missing value be shown as something else?',
    d16a: 'Does each row need a label based on a rule?', d16b: 'Does it want one row per group, with a total?',
    d17: 'Does every row need to stay, while also seeing its group?', d18: 'Does each row need a group total next to it?',
    d19: 'Is it adding up as you go, row after row?', d20: 'Does it want a position: 1st, 2nd, 3rd?',
    d21: 'Is it the top few inside each group, or splitting into equal bands?', d22: 'Does each row need the one before or after it?',
    d23: 'Does each row need the first or last value of its group?', d24: 'Does the filter depend on another query’s answer?',
    d25: 'Is it only asking whether a match exists?', d26: 'Would it be easier as named steps, one after another?',
    d28: 'Should this query be saved for others to reuse?', d30: 'Does a middle result need keeping for the next step?',
    d31: 'What’s the simplest technique that answers it?', d32: 'Does someone want to run this again with different values?',
    d33: 'Should something happen automatically when the table changes?', d34: 'Is the table slow to search by one column?',
    d35: 'Does the query filter on more than one column, or need extra columns?', d36: 'How would you see what the query costs?',
    d37: 'Could the big table be split into slices by date?', d38: 'Is the column hidden inside a function in WHERE?',
    d40: 'What does the query really return, row by row?', d41: 'Which layer does this belong in: bronze, silver or gold?',
    d43: 'Is this a raw copy, or a cleaned one?', d46: 'Is it a fact (an event) or a dimension (who, what, when)?',
    d47: 'Which single number answers the question?', d49: 'Is it a trend over time, or a group of similar customers?'
  };

  SIG.GEN = { G, TPL, BY_ID, rng, build, fresh, rebuild, makeSet, sibling, review, spec, valid, domain, NUDGE, util: { MONTHS, monthRange, money, list, q, pad } };
})();
