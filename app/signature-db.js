// Signature — the practice copy of CelestiaRetailLab.
//
// Every table starts with the five rows shown in the Pantry, then fills up with
// more rows made by a fixed recipe (the same every time, on every device), so a
// question always has the same right answer. "Today" in this data is 30 June 2025.
(function () {
  const TODAY = '2025-06-30';
  const NOW = '2025-06-30 12:00:00';

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const day = 86400000;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  const ms = d => Date.parse(d + 'T00:00:00Z');
  const money = x => Math.round(x * 100) / 100;

  function build(D) {
    const R = rng(20250630);
    const pick = a => a[Math.floor(R() * a.length)];
    const wpick = (a, w) => { let r = R() * w.reduce((s, x) => s + x, 0); for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[a.length - 1]; };
    const int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
    const between = (a, b) => iso(ms(a) + Math.floor(R() * ((ms(b) - ms(a)) / day + 1)) * day);
    const P = {}; D.PANTRY.forEach(t => { P[t.name] = t.rows.map(r => r.map(v => (v === 'NULL' ? null : v))); });
    const num = (t, i) => P[t].forEach(r => { if (r[i] !== null) r[i] = Number(r[i]); });

    // ── crm.Customers
    num('crm.Customers', 0); num('crm.Customers', 8);
    const places = [['Austin', 'TX'], ['Denver', 'CO'], ['Seattle', 'WA'], ['Boston', 'MA'], ['Chicago', 'IL'], ['Portland', 'OR'], ['Atlanta', 'GA'], ['Phoenix', 'AZ'], ['Nashville', 'TN'], ['San Diego', 'CA'], ['Miami', 'FL'], ['Minneapolis', 'MN']];
    const first = ['Ava', 'Ethan', 'Mia', 'Lucas', 'Chloe', 'Mason', 'Zoe', 'Elijah', 'Layla', 'James', 'Nora', 'Henry', 'Aria', 'Leo', 'Ruby', 'Jack', 'Isla', 'Daniel', 'Maya', 'Samuel', 'Elena', 'Caleb', 'Hazel', 'Owen', 'Stella', 'Ezra', 'Violet', 'Adrian', 'Lucy', 'Felix', 'Iris', 'Julian', 'Naomi', 'Theo', 'Clara'];
    const last = ['Morgan', 'Kim', 'Alvarez', 'Bennett', 'Nguyen', 'Foster', 'Ramirez', 'Shah', 'Collins', 'Ward', 'Ito', 'Hughes', 'Romero', 'Price', 'Diaz', 'Murphy', 'Cho', 'Bailey', 'Ortiz', 'Reed', 'Gupta', 'Hayes', 'Lopez', 'Kelly', 'Sato', 'Rossi', 'Brooks', 'Flores', 'Wood', 'Ali', 'Park', 'Evans', 'Mendes', 'Cole', 'Novak'];
    const customers = P['crm.Customers'].slice();
    for (let id = 6; id <= 40; id++) {
      const name = first[id - 6] + ' ' + last[id - 6], [city, st] = places[(id * 7) % places.length];
      const handle = name.toLowerCase().replace(' ', '.');
      const email = R() < 0.15 ? null : (R() < 0.12 ? handle.toUpperCase() + '@MAIL.COM' : handle + '@mail.com');
      const phone = R() < 0.2 ? null : '555-01' + String(id).padStart(2, '0');
      const seg = id > 34 ? 'New' : wpick(['VIP', 'Loyal', 'Core', 'New'], [2, 3, 4, 2]);
      const join = id > 34 ? between('2025-04-01', '2025-06-20') : between('2022-01-10', '2024-12-20');
      customers.push([id, name, email, phone, city, st, join, seg, R() < 0.9 ? 1 : 0]);
    }
    const buyers = customers.filter(c => c[0] <= 34).map(c => c[0]); // 35–40 haven't ordered yet

    // ── catalog.Products
    num('catalog.Products', 0); [3, 4, 5].forEach(i => num('catalog.Products', i));
    const products = P['catalog.Products'].slice();
    const more = [
      ['Pocket Grid Notebook', 'Journals', 12.5], ['Leather Travel Journal', 'Journals', 42], ['Dot Planner 2025', 'Journals', 28], ['Recycled Sketch Journal', 'Journals', 19.5],
      ['Glass Cold Brew Bottle', 'Drinkware', 27.5], ['Enamel Camp Cup', 'Drinkware', 16], ['Double-Wall Tumbler', 'Drinkware', 36.5], ['Porcelain Tea Set', 'Drinkware', 68],
      ['Gel Pen Trio', 'Stationery', 9.75], ['Washi Tape Bundle', 'Stationery', 14.25], ['Walnut Desk Organizer', 'Stationery', 49], ['Wax Seal Kit', 'Stationery', 33],
      ['Gouache Starter Kit', 'Art', 38], ['Sable Brush Set', 'Art', 52.5], ['Cold-Press Paper Block', 'Art', 22.75], ['Ink Wash Palette', 'Art', 17.5],
      ['Desk LED Lamp', 'Tech', 79], ['Bamboo Phone Stand', 'Tech', 21], ['Noise-Soft Earbuds', 'Tech', 89.5], ['Cable Keeper Pouch', 'Tech', 18.25]
    ];
    more.forEach((m, i) => {
      const id = 106 + i, late = id === 125, inactive = id === 113 || id === 121;
      products.push([id, m[0], m[1], m[2], money(m[2] * (0.36 + R() * 0.12)), inactive ? 0 : 1, late ? '2025-06-15' : between('2023-01-15', '2024-10-01')]);
    });
    const sellable = products.filter(p => p[0] !== 125 && p[0] !== 121);

    // ── hr.Employees
    num('hr.Employees', 0);
    const employees = P['hr.Employees'].slice().concat([
      [6, 'Lena Fischer', 'Sales', 'Northeast', '2022-05-16'], [7, 'Marcus Webb', 'Sales', 'South', '2023-07-10'], [8, 'Aisha Rahman', 'Sales', 'West', '2024-02-05'],
      [9, 'Diego Torres', 'Marketing', 'West', '2021-09-27'], [10, 'Ruth Kowalski', 'Customer Success', 'Midwest', '2023-11-06'], [11, 'Ben Adeyemi', 'Operations', 'South', '2022-03-21'],
      [12, 'Clara Jensen', 'Marketing', 'Northeast', '2024-08-19']
    ]);
    const sellers = [1, 2, 4, 6, 7, 8];

    // ── sales.Orders + sales.OrderItems
    num('sales.Orders', 0); num('sales.Orders', 1); num('sales.Orders', 2); num('sales.Orders', 8); num('sales.Orders', 9);
    num('sales.OrderItems', 0); num('sales.OrderItems', 1); num('sales.OrderItems', 2); num('sales.OrderItems', 3); num('sales.OrderItems', 4); num('sales.OrderItems', 5);
    const orders = P['sales.Orders'].slice(), items = P['sales.OrderItems'].slice();
    const mkOrder = (id, date) => {
      const age = (ms(TODAY) - ms(date)) / day;
      const status = age > 12 ? wpick(['Delivered', 'Cancelled'], [93, 7]) : wpick(['Delivered', 'Shipped', 'Processing', 'Cancelled'], [3, 3, 4, 1]);
      const channel = wpick(['Web', 'Store', 'Mobile'], [45, 30, 25]);
      const priority = channel === 'Store' ? 'Standard' : wpick(['Standard', 'Expedited'], [8, 2]);
      const shipped = status === 'Delivered' || status === 'Shipped' ? iso(ms(date) + int(1, 6) * day) : null;
      const fee = channel === 'Store' ? 0 : priority === 'Expedited' ? 14.95 : 6.95;
      const disc = R() < 0.75 ? null : pick([5, 10, 15]);
      orders.push([id, pick(buyers), pick(R() < 0.85 ? sellers : [3, 5, 10, 11]), date, shipped && shipped > TODAY ? null : shipped, shipped && shipped > TODAY ? 'Processing' : status, channel, priority, disc, fee]);
    };
    const spread = (ids, from, to) => { const n = ids.length, a = ms(from), b = ms(to); ids.forEach((id, i) => mkOrder(id, iso(a + Math.floor(((b - a) / day) * (i + R() * 0.9) / n) * day))); };
    spread(Array.from({ length: 200 }, (_, i) => 4801 + i), '2024-01-03', '2024-12-30');
    spread(Array.from({ length: 50 }, (_, i) => 5101 + i), '2025-01-02', '2025-03-17');
    spread(Array.from({ length: 95 }, (_, i) => 5006 + i), '2025-03-19', '2025-06-29');
    orders.sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0]));
    let itemId = 6;
    orders.forEach(o => {
      if (o[0] >= 5001 && o[0] <= 5004) return;
      const avail = sellable.filter(p => p[6] <= o[3]); const n = o[0] === 5005 ? 1 : wpick([1, 2, 3, 4], [3, 4, 2, 1]);
      const chosen = []; while (chosen.length < n) { const p = pick(avail); if (!chosen.includes(p)) chosen.push(p); }
      chosen.forEach(p => items.push([itemId++, o[0], p[0], wpick([1, 2, 3, 4, 6], [10, 6, 3, 1, 0.5]), p[3], wpick([0, 0.05, 0.1, 0.15], [14, 3, 3, 1])]));
    });
    items.sort((a, b) => a[0] - b[0]);

    // ── sales.Returns
    num('sales.Returns', 0); num('sales.Returns', 1); num('sales.Returns', 2); num('sales.Returns', 5);
    const returns = P['sales.Returns'].slice();
    const omap = {}; orders.forEach(o => (omap[o[0]] = o));
    const candidates = items.filter(it => it[0] > 5 && omap[it[1]][5] === 'Delivered');
    const reasons = ['Damaged', 'Wrong item', 'Changed mind', 'Late delivery', 'Not as described'];
    const used = new Set();
    while (returns.length < 42) {
      const it = pick(candidates); if (used.has(it[0])) continue; used.add(it[0]);
      const rd = iso(ms(omap[it[1]][4]) + int(3, 25) * day); if (rd > TODAY) continue;
      returns.push([0, it[1], it[2], rd, wpick(reasons, [4, 2, 3, 2, 2]), money(it[3] * it[4] * (1 - it[5]))]);
    }
    returns.slice(5).sort((a, b) => (a[3] < b[3] ? -1 : 1)).forEach((r, i) => (r[0] = 6 + i));
    returns.sort((a, b) => a[0] - b[0]);

    // ── sales.MonthlyTargets (realistic targets, close to what each category actually sold)
    P['sales.MonthlyTargets'].forEach(r => (r[2] = Number(r[2])));
    const targets = P['sales.MonthlyTargets'].slice(), have = new Set(targets.map(t => t[0] + t[1]));
    const pmap = {}; products.forEach(p => (pmap[p[0]] = p));
    const actual = {}; items.forEach(it => { const o = omap[it[1]]; if (o[5] === 'Cancelled') return; const k = o[3].slice(0, 7) + '-01' + pmap[it[2]][2]; actual[k] = (actual[k] || 0) + it[3] * it[4] * (1 - it[5]); });
    const cats = ['Journals', 'Drinkware', 'Stationery', 'Art', 'Tech'];
    for (let y = 2024; y <= 2025; y++) for (let m = 1; m <= (y === 2025 ? 6 : 12); m++) cats.forEach(c => {
      const k = `${y}-${String(m).padStart(2, '0')}-01`; if (have.has(k + c)) return;
      targets.push([k, c, Math.round(((actual[k + c] || 300) * (0.8 + R() * 0.4)) / 50) * 50]);
    });
    targets.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : cats.indexOf(a[1]) - cats.indexOf(b[1])));

    // ── support.Tickets
    num('support.Tickets', 0); num('support.Tickets', 1);
    const tickets = P['support.Tickets'].map(r => { r = r.slice(); r[2] = r[2] + ':00'; if (r[3]) r[3] = r[3] + ':00'; return r; });
    const notes = ['Sent tracking link.', 'Issued refund.', 'Replaced item.', 'Explained return policy.', 'Updated shipping address.', 'Applied discount code.', 'Resent receipt.'];
    const mkTicket = (id, date) => {
      const opened = `${date} ${String(int(8, 18)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`;
      const recent = date >= '2025-06-10', pr = wpick(['Low', 'Medium', 'High'], [4, 4, 2]);
      const status = recent ? wpick(['Open', 'In Progress', 'Resolved'], [2, 2, 3]) : wpick(['Resolved', 'Closed'], [7, 2]);
      let resolved = null;
      if (status === 'Resolved' || status === 'Closed') { const t = Date.parse(opened.replace(' ', 'T') + 'Z') + int(20, pr === 'High' ? 1400 : 4300) * 60000; resolved = new Date(t).toISOString().slice(0, 19).replace('T', ' '); if (resolved.slice(0, 10) > TODAY) resolved = null; }
      tickets.push([id, pick(buyers), opened, resolved, pr, resolved ? status : 'In Progress', wpick(['Email', 'Phone', 'Chat'], [4, 3, 3]), resolved ? pick(notes) : null]);
    };
    for (let i = 0; i < 30; i++) mkTicket(8971 + i, between('2024-01-05', '2024-12-28'));
    for (let i = 0; i < 30; i++) mkTicket(9006 + i, between('2025-03-20', '2025-06-29'));
    tickets.sort((a, b) => a[0] - b[0]);

    // ── training.LargeSales (20,000 rows of 2024 sales, with a few accidental duplicates)
    P['training.LargeSales'].forEach(r => { [0, 2, 3, 6, 7].forEach(i => (r[i] = Number(r[i]))); });
    const large = P['training.LargeSales'].slice();
    const lsProducts = products.filter(p => p[6] <= '2024-12-31' && p[0] !== 121);
    for (let id = 6; id <= 20000; id++) {
      if (id % 1250 === 0) { const d = large[large.length - 1].slice(); d[0] = id; large.push(d); continue; }
      const p = pick(lsProducts), q = wpick([1, 2, 3, 4], [10, 5, 2, 1]);
      large.push([id, between(p[6] > '2024-01-02' ? p[6] : '2024-01-02', '2024-12-31'), int(1, 34), p[0], p[2], wpick(['Web', 'Store', 'Mobile'], [45, 30, 25]), q, money(q * p[3])]);
    }

    return {
      'crm.Customers': customers, 'catalog.Products': products, 'hr.Employees': employees, 'sales.Orders': orders.sort((a, b) => a[0] - b[0]),
      'sales.OrderItems': items, 'sales.Returns': returns, 'sales.MonthlyTargets': targets, 'support.Tickets': tickets, 'training.LargeSales': large
    };
  }

  const VIEW = `CREATE VIEW "reporting.vSalesLineDetail" AS
SELECT o.OrderID, o.OrderDate, o.Channel, o.Status, c.CustomerID, c.CustomerName, c.CustomerSegment,
       p.ProductID, p.ProductName, p.Category, i.Quantity, i.UnitPrice, i.DiscountPct,
       ROUND(i.Quantity * i.UnitPrice * (1 - i.DiscountPct), 2) AS LineRevenue
FROM "sales.Orders" o JOIN "sales.OrderItems" i ON i.OrderID = o.OrderID
JOIN "crm.Customers" c ON c.CustomerID = o.CustomerID JOIN "catalog.Products" p ON p.ProductID = i.ProductID`;

  function affinity(t) {
    t = t.toUpperCase();
    if (/^(INT|BIGINT|SMALLINT|TINYINT|BIT)/.test(t)) return 'INTEGER';
    if (/^(DECIMAL|NUMERIC|MONEY|FLOAT|REAL)/.test(t)) return 'REAL';
    return 'TEXT COLLATE NOCASE';
  }

  // Creates the tables inside an empty SQLite database and fills them.
  function load(db, D) {
    const data = build(D);
    db.run('BEGIN');
    D.PANTRY.forEach(t => {
      if (t.view) return;
      const pk = t.cols.filter(c => c[2] === 'PK').map(c => c[0]);
      const cols = t.cols.map(c => `"${c[0]}" ${affinity(c[1])}${/NULL/.test(c[1]) ? '' : ' NOT NULL'}`);
      if (pk.length) cols.push(`PRIMARY KEY (${pk.map(k => `"${k}"`).join(', ')})`);
      db.run(`CREATE TABLE "${t.name}" (${cols.join(', ')})`);
      const st = db.prepare(`INSERT INTO "${t.name}" VALUES (${t.cols.map(() => '?').join(',')})`);
      data[t.name].forEach(r => st.run(r));
      st.free();
    });
    db.run(VIEW);
    db.run('COMMIT');
    return data;
  }

  window.SIG = Object.assign(window.SIG || {}, { DB: { load, TODAY, NOW } });
})();
