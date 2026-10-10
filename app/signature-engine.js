// Signature — the practice kitchen: runs your T-SQL against a private copy of
// CelestiaRetailLab and compares what comes back with what the request needs.
//
// The database engine underneath is SQLite (vendor/sql-wasm.js). SQL Server's
// dialect is translated on the way in: TOP, schema names (sales.Orders), #temp
// tables, GETDATE / DATEADD / DATEDIFF, + for joining text, CAST / CONVERT,
// variables, stored procedures and triggers. Nothing leaves the phone.
(function () {
  const SIG = window.SIG;
  const TODAY = SIG.DB.TODAY, NOW = SIG.DB.NOW;
  let SQL = null, BYTES = null, BASE = null;
  const META = { tables: {}, textCols: new Set(), allCols: {}, values: {} };

  // ───────────────────────── dates
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function toDate(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') { const s = String(v); if (/^\d{8}$/.test(s)) v = s; else return null; }
    const s = String(v).trim();
    let m = /^(\d{4})-?(\d{2})-?(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/.exec(s);
    if (!m) { m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) return { d: new Date(Date.UTC(+m[3], +m[1] - 1, +m[2])), t: false }; return null; }
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    return isNaN(d) ? null : { d, t: m[4] !== undefined };
  }
  const p2 = n => String(n).padStart(2, '0');
  function fmt(d, withTime) { const s = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; return withTime ? `${s} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}` : s; }
  const PART = { year: 'year', yy: 'year', yyyy: 'year', quarter: 'quarter', qq: 'quarter', q: 'quarter', month: 'month', mm: 'month', m: 'month', dayofyear: 'dayofyear', dy: 'dayofyear', y: 'dayofyear', day: 'day', dd: 'day', d: 'day', week: 'week', wk: 'week', ww: 'week', weekday: 'weekday', dw: 'weekday', w: 'weekday', hour: 'hour', hh: 'hour', minute: 'minute', mi: 'minute', n: 'minute', second: 'second', ss: 'second', s: 'second', iso_week: 'isoweek', isowk: 'isoweek', isoww: 'isoweek' };
  const part = p => { const k = PART[String(p).toLowerCase()]; if (!k) throw new Error(`“${p}” isn’t a date part SQL Server knows. Try day, month, quarter or year.`); return k; };
  function datepart(p, v) {
    const x = toDate(v); if (!x) return null; const d = x.d;
    switch (part(p)) {
      case 'year': return d.getUTCFullYear(); case 'quarter': return Math.floor(d.getUTCMonth() / 3) + 1; case 'month': return d.getUTCMonth() + 1;
      case 'day': return d.getUTCDate(); case 'weekday': return d.getUTCDay() + 1; case 'hour': return d.getUTCHours(); case 'minute': return d.getUTCMinutes(); case 'second': return d.getUTCSeconds();
      case 'dayofyear': return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;
      case 'week': { const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1), off = new Date(jan1).getUTCDay(); return Math.floor((Math.floor((d - jan1) / 864e5) + off) / 7) + 1; }
      case 'isoweek': { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3); const fy = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - fy) / 864e5 - 3 + ((fy.getUTCDay() + 6) % 7)) / 7); }
    }
  }
  function dateadd(p, n, v) {
    const x = toDate(v); if (!x || n === null) return null; const d = new Date(x.d.getTime()); n = Math.trunc(Number(n));
    switch (part(p)) {
      case 'year': case 'quarter': case 'month': {
        const months = part(p) === 'year' ? n * 12 : part(p) === 'quarter' ? n * 3 : n;
        const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
        const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); break;
      }
      case 'week': d.setUTCDate(d.getUTCDate() + 7 * n); break;
      case 'day': case 'dayofyear': case 'weekday': d.setUTCDate(d.getUTCDate() + n); break;
      case 'hour': d.setUTCHours(d.getUTCHours() + n); break; case 'minute': d.setUTCMinutes(d.getUTCMinutes() + n); break; case 'second': d.setUTCSeconds(d.getUTCSeconds() + n); break;
    }
    return fmt(d, x.t);
  }
  function datediff(p, a, b) {
    const x = toDate(a), y = toDate(b); if (!x || !y) return null; const A = x.d, B = y.d;
    const dayNum = d => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 864e5);
    switch (part(p)) {
      case 'year': return B.getUTCFullYear() - A.getUTCFullYear();
      case 'quarter': return (B.getUTCFullYear() * 4 + Math.floor(B.getUTCMonth() / 3)) - (A.getUTCFullYear() * 4 + Math.floor(A.getUTCMonth() / 3));
      case 'month': return (B.getUTCFullYear() * 12 + B.getUTCMonth()) - (A.getUTCFullYear() * 12 + A.getUTCMonth());
      case 'week': return Math.floor((dayNum(B) + 4) / 7) - Math.floor((dayNum(A) + 4) / 7);
      case 'hour': return Math.floor(B / 36e5) - Math.floor(A / 36e5);
      case 'minute': return Math.floor(B / 6e4) - Math.floor(A / 6e4);
      case 'second': return Math.floor(B / 1e3) - Math.floor(A / 1e3);
      default: return dayNum(B) - dayNum(A);
    }
  }

  // ───────────────────────── CAST / CONVERT
  function typeInfo(t) {
    t = String(t).toUpperCase().replace(/\s+/g, '');
    const m = /^([A-Z0-9_]+)(?:\((\w+)(?:,(\d+))?\))?$/.exec(t) || [t, t];
    return { base: m[1], a: m[2], b: m[3] };
  }
  function tcast(v, type, style, tryMode) {
    if (v === null || v === undefined) return null;
    const { base, a, b } = typeInfo(type);
    const fail = () => { if (tryMode) return null; throw new Error(`SQL Server couldn’t turn “${v}” into ${type}.`); };
    if (/^(INT|BIGINT|SMALLINT|TINYINT)$/.test(base)) { const n = Number(String(v).trim()); if (String(v).trim() === '' ) return 0; if (isNaN(n)) return fail(); if (typeof v === 'string' && /\./.test(v)) return fail(); return Math.trunc(n); }
    if (base === 'BIT') { if (/^(true|1)$/i.test(String(v))) return 1; if (/^(false|0)$/i.test(String(v))) return 0; const n = Number(v); return isNaN(n) ? fail() : n ? 1 : 0; }
    if (/^(DECIMAL|NUMERIC|MONEY|SMALLMONEY)$/.test(base)) { const n = Number(String(v).trim()); if (isNaN(n)) return fail(); const s = b !== undefined ? +b : base === 'MONEY' ? 4 : 0; const f = Math.pow(10, s); return Math.round(n * f) / f; }
    if (/^(FLOAT|REAL)$/.test(base)) { const n = Number(v); return isNaN(n) ? fail() : n; }
    if (base === 'DATE' || /^(DATETIME|DATETIME2|SMALLDATETIME|DATETIMEOFFSET)$/.test(base)) { const x = toDate(v); if (!x) return fail(); return fmt(x.d, base !== 'DATE'); }
    if (base === 'TIME') { const x = toDate(v); return x ? fmt(x.d, true).slice(11) : fail(); }
    if (/CHAR|TEXT/.test(base)) {
      let s;
      if (typeof v === 'number') s = Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
      else s = String(v);
      const x = typeof v === 'string' && style !== undefined && style !== null ? toDate(v) : null;
      if (x) {
        const d = x.d, Y = d.getUTCFullYear(), M = p2(d.getUTCMonth() + 1), D = p2(d.getUTCDate()), mon = MONTHS[d.getUTCMonth()].slice(0, 3);
        const st = Number(style);
        s = st === 101 ? `${M}/${D}/${Y}` : st === 103 ? `${D}/${M}/${Y}` : st === 104 ? `${D}.${M}.${Y}` : st === 110 ? `${M}-${D}-${Y}` : st === 112 ? `${Y}${M}${D}` : st === 106 ? `${D} ${mon} ${Y}` : st === 107 ? `${mon} ${D}, ${Y}` : st === 120 || st === 121 ? fmt(d, true) : st === 126 ? fmt(d, true).replace(' ', 'T') : fmt(d, false);
      }
      const len = a === undefined ? 30 : a === 'MAX' ? Infinity : +a;
      return s.length > len ? s.slice(0, len) : s;
    }
    return v;
  }

  function fmtNumber(v, f) {
    if (v === null) return null; const n = Number(v);
    const m = /^([NCP])(\d*)$/i.exec(f || '');
    if (m) {
      const k = m[1].toUpperCase(), dp = m[2] === '' ? 2 : +m[2];
      const x = k === 'P' ? n * 100 : n;
      const s = Math.abs(x).toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (x < 0 ? '-' : '') + (k === 'C' ? '$' : '') + s + (k === 'P' ? '%' : '');
    }
    const x = toDate(v);
    if (x && typeof v === 'string') {
      const d = x.d;
      return String(f).replace(/yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|mm|ss/g, t => ({ yyyy: d.getUTCFullYear(), yy: String(d.getUTCFullYear()).slice(2), MMMM: MONTHS[d.getUTCMonth()], MMM: MONTHS[d.getUTCMonth()].slice(0, 3), MM: p2(d.getUTCMonth() + 1), M: d.getUTCMonth() + 1, dddd: DAYS[d.getUTCDay()], ddd: DAYS[d.getUTCDay()].slice(0, 3), dd: p2(d.getUTCDate()), d: d.getUTCDate(), HH: p2(d.getUTCHours()), mm: p2(d.getUTCMinutes()), ss: p2(d.getUTCSeconds()) })[t]);
    }
    return String(v);
  }

  // ───────────────────────── functions SQL Server has and SQLite doesn't
  function arity(fn, n) { const args = Array.from({ length: n }, (_, i) => 'a' + i).join(','); return new Function('f', `return function(${args}){return f(${args})}`)(fn); }
  function reg(db, name, fn, counts) { (counts || [fn.length]).forEach(n => db.create_function(name, arity(fn, n))); }
  const num = v => (v === null || v === undefined ? null : Number(v));
  function register(db) {
    reg(db, 't_getdate', () => NOW); reg(db, 'GETDATE', () => NOW); reg(db, 'SYSDATETIME', () => NOW); reg(db, 'GETUTCDATE', () => NOW); reg(db, 'SYSUTCDATETIME', () => NOW);
    reg(db, 'DATEADD', dateadd); reg(db, 'DATEDIFF', datediff); reg(db, 'DATEDIFF_BIG', datediff); reg(db, 'DATEPART', datepart);
    reg(db, 'DATENAME', (p, v) => { const k = part(p), x = toDate(v); if (!x) return null; if (k === 'month') return MONTHS[x.d.getUTCMonth()]; if (k === 'weekday') return DAYS[x.d.getUTCDay()]; return String(datepart(p, v)); });
    reg(db, 'DATETRUNC', (p, v) => { const x = toDate(v); if (!x) return null; const d = x.d, k = part(p); const r = k === 'year' ? Date.UTC(d.getUTCFullYear(), 0, 1) : k === 'quarter' ? Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1) : k === 'month' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return fmt(new Date(r), x.t); });
    reg(db, 'YEAR', v => datepart('year', v)); reg(db, 'MONTH', v => datepart('month', v)); reg(db, 'DAY', v => datepart('day', v));
    reg(db, 'EOMONTH', (v, n) => { const x = toDate(v); if (!x) return null; return fmt(new Date(Date.UTC(x.d.getUTCFullYear(), x.d.getUTCMonth() + 1 + (n || 0), 0)), false); }, [1, 2]);
    reg(db, 'DATEFROMPARTS', (y, m, d) => (y === null || m === null || d === null ? null : fmt(new Date(Date.UTC(y, m - 1, d)), false)));
    reg(db, 'ISDATE', v => (toDate(v) ? 1 : 0));
    reg(db, 't_isnull', (a, b) => (a === null ? b : a));
    reg(db, 't_cast', (v, t) => tcast(v, t)); reg(db, 't_trycast', (v, t) => tcast(v, t, null, true));
    reg(db, 't_convert', (t, v, s) => tcast(v, t, s), [2, 3]); reg(db, 't_tryconvert', (t, v, s) => tcast(v, t, s, true), [2, 3]);
    reg(db, 't_format', (v, f) => fmtNumber(v, f));
    reg(db, 'LEN', v => (v === null ? null : String(v).replace(/\s+$/, '').length)); reg(db, 'DATALENGTH', v => (v === null ? null : String(v).length));
    reg(db, 'LEFT', (s, n) => (s === null ? null : String(s).slice(0, Math.max(0, n)))); reg(db, 'RIGHT', (s, n) => (s === null ? null : n <= 0 ? '' : String(s).slice(-n)));
    reg(db, 'CHARINDEX', (f, s, st) => { if (f === null || s === null) return null; return String(s).toLowerCase().indexOf(String(f).toLowerCase(), Math.max(0, (st || 1) - 1)) + 1; }, [2, 3]);
    reg(db, 'PATINDEX', (p, s) => { if (p === null || s === null) return null; const re = new RegExp(String(p).replace(/[.*+?^${}()|\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.'), 'i'); const m = re.exec(String(s)); return m ? m.index + 1 : 0; });
    reg(db, 'REVERSE', s => (s === null ? null : String(s).split('').reverse().join(''))); reg(db, 'REPLICATE', (s, n) => (s === null ? null : String(s).repeat(Math.max(0, n)))); reg(db, 'SPACE', n => ' '.repeat(Math.max(0, n)));
    reg(db, 'STUFF', (s, st, n, r) => (s === null ? null : String(s).slice(0, st - 1) + (r || '') + String(s).slice(st - 1 + n)));
    reg(db, 'STR', (v, l) => (v === null ? null : String(Math.round(v)).padStart(l || 10)), [1, 2]);
    reg(db, 'QUOTENAME', s => (s === null ? null : '[' + s + ']'));
    reg(db, 'CONCAT_WS', function (sep, ...xs) { return xs.filter(x => x !== null).join(sep); }, [3, 4, 5, 6, 7]);
    reg(db, 'CEILING', v => (v === null ? null : Math.ceil(v))); reg(db, 'FLOOR', v => (v === null ? null : Math.floor(v))); reg(db, 'POWER', (a, b) => (a === null ? null : Math.pow(a, b)));
    reg(db, 'SQRT', v => (v === null ? null : Math.sqrt(v))); reg(db, 'SQUARE', v => (v === null ? null : v * v)); reg(db, 'EXP', v => (v === null ? null : Math.exp(v)));
    reg(db, 'LOG', v => (v === null ? null : Math.log(v))); reg(db, 'LOG10', v => (v === null ? null : Math.log10(v))); reg(db, 'PI', () => Math.PI);
    reg(db, 'SIGN', v => (v === null ? null : Math.sign(v)));
    reg(db, 'CHOOSE', function (i, ...xs) { return xs[i - 1] === undefined ? null : xs[i - 1]; }, [2, 3, 4, 5, 6, 7, 8]);
    reg(db, 'ISNUMERIC', v => (v !== null && String(v).trim() !== '' && !isNaN(Number(v)) ? 1 : 0));
    reg(db, 'NEWID', () => Math.random().toString(16).slice(2, 10).toUpperCase());
    reg(db, 'ROUND3', (v, n, t) => (v === null ? null : t ? Math.trunc(v * Math.pow(10, n)) / Math.pow(10, n) : Math.round(v * Math.pow(10, n)) / Math.pow(10, n)));
    reg(db, 't_error_message', () => LAST_ERROR.msg); reg(db, 'ERROR_MESSAGE', () => LAST_ERROR.msg); reg(db, 'ERROR_NUMBER', () => 50000);
  }
  const LAST_ERROR = { msg: null };

  // ───────────────────────── tokens
  const KW = new Set('SELECT FROM WHERE GROUP BY HAVING ORDER AND OR NOT IN IS NULL LIKE BETWEEN JOIN INNER LEFT RIGHT FULL OUTER CROSS ON AS DISTINCT TOP UNION ALL EXCEPT INTERSECT CASE WHEN THEN ELSE END INSERT INTO VALUES UPDATE SET DELETE CREATE ALTER DROP TABLE VIEW INDEX WITH EXISTS ASC DESC OVER PARTITION ROWS RANGE PRECEDING FOLLOWING UNBOUNDED CURRENT ROW PROCEDURE PROC TRIGGER BEGIN DECLARE EXEC EXECUTE IF RETURN PRINT TRUNCATE PRIMARY KEY FOREIGN REFERENCES DEFAULT CONSTRAINT CHECK UNIQUE CLUSTERED NONCLUSTERED INCLUDE SCHEMA OFFSET FETCH NEXT ONLY PERCENT TIES GO USE APPLY PIVOT MERGE OUTPUT'.split(' '));
  function tokenize(src) {
    const out = []; let i = 0; const n = src.length;
    while (i < n) {
      const c = src[i], s = i;
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && src[i + 1] === '-') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === "'" || ((c === 'N' || c === 'n') && src[i + 1] === "'")) {
        i += c === "'" ? 1 : 2; let v = '', closed = false;
        while (i < n) { if (src[i] === "'") { if (src[i + 1] === "'") { v += "'"; i += 2; continue; } i++; closed = true; break; } v += src[i++]; }
        out.push({ t: 'str', v, p: s, e: i, open: !closed }); continue;
      }
      if (c === '[') { const e = src.indexOf(']', i + 1); const end = e < 0 ? n : e; out.push({ t: 'id', v: src.slice(i + 1, end), q: true, p: s, e: end + 1, open: e < 0 }); i = end + 1; continue; }
      if (c === '"') { const e = src.indexOf('"', i + 1); const end = e < 0 ? n : e; out.push({ t: 'id', v: src.slice(i + 1, end), q: true, p: s, e: end + 1 }); i = end + 1; continue; }
      if (c === '@') { let j = i + 1; while (j < n && /[@\w$#]/.test(src[j])) j++; out.push({ t: 'var', v: src.slice(i, j), p: s, e: j }); i = j; continue; }
      if (c === '#') { let j = i + 1; while (j < n && /[#\w$]/.test(src[j])) j++; out.push({ t: 'tmp', v: src.slice(i, j), p: s, e: j }); i = j; continue; }
      if (/[A-Za-z_\u00C0-\uFFFF]/.test(c)) { let j = i + 1; while (j < n && /[\w$#\u00C0-\uFFFF]/.test(src[j])) j++; const v = src.slice(i, j); out.push({ t: 'id', v, u: v.toUpperCase(), p: s, e: j }); i = j; continue; }
      if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] || ''))) { let j = i; while (j < n && /[\d.]/.test(src[j])) j++; if (/[eE]/.test(src[j] || '') && /[\d+-]/.test(src[j + 1] || '')) { j += 2; while (j < n && /\d/.test(src[j])) j++; } out.push({ t: 'num', v: src.slice(i, j), p: s, e: j }); i = j; continue; }
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '<>', '!=', '||', '!<', '!>', '::', '+=', '-=', '*=', '/='].includes(two)) { out.push({ t: 'op', v: two, p: s, e: i + 2 }); i += 2; continue; }
      out.push({ t: 'op', v: c, p: s, e: i + 1 }); i++;
    }
    out.forEach(t => { if (t.t === 'id' && t.q) t.u = t.v.toUpperCase(); });
    return out;
  }
  const isKw = (t, w) => t && t.t === 'id' && !t.q && t.u === w;
  const isOp = (t, v) => t && t.t === 'op' && t.v === v;
  function match(toks, i) { let d = 0; for (let j = i; j < toks.length; j++) { if (isOp(toks[j], '(')) d++; else if (isOp(toks[j], ')')) { d--; if (d === 0) return j; } } return -1; }
  function matchBack(toks, i) { let d = 0; for (let j = i; j >= 0; j--) { if (isOp(toks[j], ')')) d++; else if (isOp(toks[j], '(')) { d--; if (d === 0) return j; } } return -1; }
  function emit(toks) {
    let s = '';
    toks.forEach((t, i) => {
      let x;
      if (t.t === 'str') x = "'" + t.v.replace(/'/g, "''") + "'";
      else if (t.t === 'id') x = t.q ? '"' + t.v.replace(/"/g, '""') + '"' : t.v;
      else if (t.t === 'raw') x = t.v;
      else x = t.v;
      const prev = toks[i - 1];
      const tight = !prev || isOp(prev, '.') || isOp(t, '.') || isOp(t, ',') || isOp(t, ')') || isOp(prev, '(') || (isOp(t, '(') && prev && (prev.t === 'id' && !KW.has(prev.u || '') || prev.fn));
      s += (tight ? '' : ' ') + x;
    });
    return s;
  }
  const raw = (v, p) => ({ t: 'raw', v, p: p || 0, e: p || 0 });
  const id = (v, q, p) => ({ t: 'id', v, q: !!q, u: String(v).toUpperCase(), p: p || 0, e: p || 0 });
  const op = (v, p) => ({ t: 'op', v, p: p || 0, e: p || 0 });

  // ───────────────────────── names
  const BASE_SCHEMAS = ['crm', 'catalog', 'hr', 'sales', 'support', 'training', 'reporting', 'information_schema', 'sys', 'bronze', 'silver', 'gold', 'staging', 'stg', 'dw', 'mart'];
  // Joins dotted names into one token: sales.Orders → "sales.Orders", c.CustomerName stays.
  function resolveNames(toks, env) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'tmp') { out.push(Object.assign({}, t, { t: 'id', v: t.v, q: true, u: t.v.toUpperCase(), tbl: true })); continue; }
      if (t.t !== 'id') { out.push(t); continue; }
      const parts = [t]; let j = i;
      while (isOp(toks[j + 1], '.') && toks[j + 2] && (toks[j + 2].t === 'id' || isOp(toks[j + 2], '*'))) { parts.push(toks[j + 2]); j += 2; }
      if (parts.length === 1) { out.push(t); continue; }
      let names = parts.map(x => x.v);
      const isSchema = n => env.schemas.has(String(n).toLowerCase());
      if (names.length >= 3 && !isSchema(names[0]) && isSchema(names[names.length - 2])) names = names.slice(-2);
      if (names.length >= 3 && !isSchema(names[0]) && isSchema(names[1])) names = names.slice(1);
      if (isSchema(names[0])) {
        const sch = names[0].toLowerCase();
        const tbl = sch === 'dbo' ? names[1] : sch + '.' + names[1];
        const tok = Object.assign({}, t, { t: 'id', v: tbl, q: true, u: tbl.toUpperCase(), e: parts[1].e, tbl: true, orig: names.slice(0, 2).join('.') });
        out.push(tok);
        if (names.length > 2) { out.push(op('.')); names.slice(2).forEach((nm, k) => { if (k) out.push(op('.')); out.push(Object.assign({}, parts[k + 2])); }); }
      } else {
        parts.forEach((x, k) => { if (k) out.push(Object.assign({}, toks[i + 2 * k - 1])); out.push(x); });
      }
      i = j;
    }
    return out;
  }

  // ───────────────────────── text-ness of an operand, for + → ||
  const TEXT_FN = new Set('UPPER LOWER LTRIM RTRIM TRIM LEFT RIGHT SUBSTRING SUBSTR REPLACE CONCAT CONCAT_WS T_FORMAT FORMAT DATENAME STR REPLICATE SPACE REVERSE STUFF CHAR NCHAR QUOTENAME STRING_AGG T_ISNULL ISNULL COALESCE NULLIF IIF'.split(' '));
  function textual(toks, a, b, env) {
    // a..b inclusive is an operand
    const t0 = toks[a], tl = toks[b];
    if (a === b) {
      if (t0.t === 'str') return true;
      if (t0.t === 'id') return env.textCols.has(t0.v.toLowerCase());
      return false;
    }
    if (isOp(tl, ')')) {
      const o = matchBack(toks, b);
      const fn = toks[o - 1];
      if (o === a) { for (let k = a + 1; k < b; k++) if (isOp(toks[k], '||') || toks[k].t === 'str') return true; return textual(toks, a + 1, b - 1, env); }
      if (fn && fn.t === 'id') {
        const u = fn.u;
        if (u === 'T_CAST' || u === 'T_CONVERT' || u === 'T_TRYCAST' || u === 'T_TRYCONVERT') { for (let k = o; k < b; k++) if (toks[k].t === 'str' && /CHAR|TEXT/i.test(toks[k].v)) return true; return false; }
        if (u === 'T_ISNULL' || u === 'COALESCE' || u === 'NULLIF' || u === 'IIF') { for (let k = o + 1; k < b; k++) { if (toks[k].t === 'str') return true; if (toks[k].t === 'id' && env.textCols.has(toks[k].v.toLowerCase())) return true; } return false; }
        return TEXT_FN.has(u);
      }
    }
    if (isKw(tl, 'END')) { for (let k = a; k < b; k++) if (isKw(toks[k], 'THEN') || isKw(toks[k], 'ELSE')) { if (toks[k + 1].t === 'str') return true; } return false; }
    if (tl.t === 'id' && isOp(toks[b - 1], '.')) return env.textCols.has(tl.v.toLowerCase());
    return false;
  }
  function operandLeft(toks, k) {
    let b = k - 1; if (b < 0) return null; let a = b;
    if (isOp(toks[b], ')')) { a = matchBack(toks, b); if (a > 0 && toks[a - 1].t === 'id' && !KW.has(toks[a - 1].u)) a--; }
    else if (isKw(toks[b], 'END')) { let d = 0; for (let j = b; j >= 0; j--) { if (isKw(toks[j], 'END')) d++; if (isKw(toks[j], 'CASE')) { d--; if (d === 0) { a = j; break; } } } }
    else if (toks[b].t === 'id' && isOp(toks[b - 1], '.')) a = b - 2;
    return [a, b];
  }
  function operandRight(toks, k) {
    let a = k + 1; if (a >= toks.length) return null; let b = a;
    if (isOp(toks[a], '(')) b = match(toks, a);
    else if (toks[a].t === 'id' && isOp(toks[a + 1], '(')) b = match(toks, a + 1);
    else if (isKw(toks[a], 'CASE')) { let d = 0; for (let j = a; j < toks.length; j++) { if (isKw(toks[j], 'CASE')) d++; if (isKw(toks[j], 'END')) { d--; if (d === 0) { b = j; break; } } } }
    else if (toks[a].t === 'id' && isOp(toks[a + 1], '.')) b = a + 2;
    return b < 0 ? null : [a, b];
  }

  // ───────────────────────── statement translation (one T-SQL statement → SQLite SQL)
  const FN_RENAME = { ISNULL: 't_isnull', FORMAT: 't_format', COUNT_BIG: 'COUNT', LEN: 'LEN', SUBSTR: 'SUBSTR' };
  const DATE_FNS = new Set(['DATEADD', 'DATEDIFF', 'DATEDIFF_BIG', 'DATEPART', 'DATENAME', 'DATETRUNC']);
  class Unsupported extends Error {}
  function typeText(toks, a, b) { return toks.slice(a, b + 1).map(t => (t.t === 'str' ? t.v : t.v)).join('').replace(/\s+/g, ''); }

  function rewriteExpr(toks, env) {
    toks = toks.slice();
    // functions & keywords
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'id' && !t.q && t.u === 'CURRENT_TIMESTAMP') { toks.splice(i, 1, id('t_getdate'), op('('), op(')')); continue; }
      if (t.t === 'id' && !t.q && t.u === 'SYSDATETIME' && !isOp(toks[i + 1], '(')) { toks.splice(i, 1, id('t_getdate'), op('('), op(')')); continue; }
      if (t.t !== 'id' || t.q || !isOp(toks[i + 1], '(')) continue;
      const u = t.u;
      if (FN_RENAME[u]) { toks[i] = Object.assign({}, t, { v: FN_RENAME[u], u: FN_RENAME[u].toUpperCase(), fn: true }); continue; }
      if (DATE_FNS.has(u)) { const a = toks[i + 2]; if (a && a.t === 'id' && !a.q) toks[i + 2] = Object.assign({}, a, { t: 'str', v: a.v }); continue; }
      if (u === 'CAST' || u === 'TRY_CAST') {
        const close = match(toks, i + 1); if (close < 0) continue;
        let d = 0, asAt = -1; for (let k = i + 2; k < close; k++) { if (isOp(toks[k], '(')) d++; else if (isOp(toks[k], ')')) d--; else if (d === 0 && isKw(toks[k], 'AS')) asAt = k; }
        if (asAt < 0) continue;
        const ty = typeText(toks, asAt + 1, close - 1);
        toks.splice(i, close - i + 1, Object.assign(id(u === 'CAST' ? 't_cast' : 't_trycast', false, t.p), { fn: true }), op('('), ...toks.slice(i + 2, asAt), op(','), { t: 'str', v: ty, p: toks[asAt + 1].p, e: toks[close - 1].e }, op(')'));
        continue;
      }
      if (u === 'CONVERT' || u === 'TRY_CONVERT') {
        const close = match(toks, i + 1); if (close < 0) continue;
        let d = 0, comma = -1; for (let k = i + 2; k < close; k++) { if (isOp(toks[k], '(')) d++; else if (isOp(toks[k], ')')) d--; else if (d === 0 && isOp(toks[k], ',')) { comma = k; break; } }
        if (comma < 0) continue;
        const ty = typeText(toks, i + 2, comma - 1);
        toks.splice(i, comma - i + 1, Object.assign(id(u === 'CONVERT' ? 't_convert' : 't_tryconvert', false, t.p), { fn: true }), op('('), { t: 'str', v: ty, p: toks[i + 2].p, e: toks[comma - 1].e }, op(','));
        continue;
      }
      if (u === 'STRING_AGG') {
        const close = match(toks, i + 1);
        if (close > 0 && isKw(toks[close + 1], 'WITHIN') && isKw(toks[close + 2], 'GROUP') && isOp(toks[close + 3], '(')) {
          const c2 = match(toks, close + 3); const inner = toks.slice(close + 4, c2);
          toks.splice(close, c2 - close + 1, ...inner, op(')'));
        }
        continue;
      }
      if (u === 'OBJECT_ID') {
        const close = match(toks, i + 1); const a = toks[i + 2];
        if (a && a.t === 'str') { const nm = canonical(a.v.replace(/^#/, '#'), env); toks.splice(i, close - i + 1, raw(env.exists(nm) ? '1' : 'NULL', t.p)); }
        continue;
      }
      if (u === 'SCOPE_IDENTITY') { const close = match(toks, i + 1); toks.splice(i, close - i + 1, raw('last_insert_rowid()', t.p)); continue; }
    }
    // !< !> and LIKE with [..] classes
    for (let i = 0; i < toks.length; i++) {
      if (isOp(toks[i], '!<')) toks[i] = op('>=', toks[i].p); else if (isOp(toks[i], '!>')) toks[i] = op('<=', toks[i].p);
      if (isKw(toks[i], 'LIKE') && toks[i + 1] && toks[i + 1].t === 'str' && /\[/.test(toks[i + 1].v)) {
        const g = toks[i + 1].v.replace(/\*/g, '[*]').replace(/\?/g, '[?]').replace(/%/g, '*').replace(/_/g, '?');
        toks[i] = Object.assign({}, toks[i], { v: 'GLOB', u: 'GLOB' }); toks[i + 1] = Object.assign({}, toks[i + 1], { v: g });
      }
    }
    // + between text → ||
    for (let k = 0; k < toks.length; k++) {
      if (!isOp(toks[k], '+')) continue;
      const L = operandLeft(toks, k), R = operandRight(toks, k);
      if (!L || !R || L[0] < 0) continue;
      if (textual(toks, L[0], L[1], env) || textual(toks, R[0], R[1], env)) toks[k] = op('||', toks[k].p);
    }
    return toks;
  }

  // SELECT scopes: where each SELECT starts and ends, and its clause positions.
  function scopes(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      if (!isKw(toks[i], 'SELECT')) continue;
      let d = 0, end = toks.length;
      const cl = { select: i };
      for (let j = i + 1; j < toks.length; j++) {
        const t = toks[j];
        if (isOp(t, '(')) d++;
        else if (isOp(t, ')')) { if (d === 0) { end = j; break; } d--; }
        else if (d === 0 && (isOp(t, ';') || isKw(t, 'UNION') || isKw(t, 'EXCEPT') || isKw(t, 'INTERSECT'))) { end = j; break; }
        else if (d === 0 && t.t === 'id' && !t.q) {
          if (t.u === 'INTO' && cl.from === undefined && cl.into === undefined) cl.into = j;
          else if (t.u === 'FROM' && cl.from === undefined) cl.from = j;
          else if (t.u === 'WHERE' && cl.where === undefined) cl.where = j;
          else if (t.u === 'GROUP' && isKw(toks[j + 1], 'BY')) cl.group = j;
          else if (t.u === 'HAVING') cl.having = j;
          else if (t.u === 'ORDER' && isKw(toks[j + 1], 'BY')) cl.order = j;
          else if (t.u === 'OFFSET') cl.offset = j;
          else if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'DECLARE', 'EXEC', 'PRINT', 'TRUNCATE'].includes(t.u) && j > i + 1 && !isKw(toks[j - 1], 'UNION') && !isKw(toks[j - 1], 'ALL')) { end = j; break; }
        }
      }
      cl.end = end; out.push(cl);
    }
    return out;
  }

  function rewriteTop(toks) {
    for (let guard = 0; guard < 50; guard++) {
      const sc = scopes(toks); let done = true;
      for (const s of sc) {
        let k = s.select + 1;
        if (isKw(toks[k], 'DISTINCT') || isKw(toks[k], 'ALL')) k++;
        // OFFSET … FETCH
        if (s.offset !== undefined) {
          const o = s.offset; let j = o + 1; const offE = []; while (j < s.end && !isKw(toks[j], 'ROWS') && !isKw(toks[j], 'ROW')) offE.push(toks[j++]);
          j++; let fetch = null;
          if (isKw(toks[j], 'FETCH')) { j += 2; const f = []; while (j < s.end && !isKw(toks[j], 'ROWS') && !isKw(toks[j], 'ROW')) f.push(toks[j++]); j += 2; fetch = f; }
          toks.splice(o, j - o, raw('LIMIT'), ...(fetch || [raw('-1')]), raw('OFFSET'), ...offE);
          done = false; break;
        }
        if (!isKw(toks[k], 'TOP')) continue;
        let n, e;
        if (isOp(toks[k + 1], '(')) { const c = match(toks, k + 1); n = toks.slice(k + 2, c); e = c + 1; } else { n = [toks[k + 1]]; e = k + 2; }
        if (isKw(toks[e], 'PERCENT')) throw new Unsupported('TOP … PERCENT isn’t available in the practice kitchen. Use TOP (n) with a number instead.');
        if (isKw(toks[e], 'WITH') && isKw(toks[e + 1], 'TIES')) e += 2;
        const end = s.end;
        toks.splice(end, 0, raw('LIMIT'), raw('('), ...n, raw(')'));
        toks.splice(k, e - k);
        done = false; break;
      }
      if (done) break;
    }
    return toks;
  }

  function stripHints(toks) {
    for (let i = 0; i < toks.length; i++) if (isKw(toks[i], 'WITH') && isOp(toks[i + 1], '(') && toks[i + 2] && toks[i + 2].t === 'id' && /^(NOLOCK|READUNCOMMITTED|INDEX|FORCESEEK|ROWLOCK|UPDLOCK|HOLDLOCK|TABLOCK)$/i.test(toks[i + 2].v)) { const c = match(toks, i + 1); toks.splice(i, c - i + 1); i--; }
    for (let i = 0; i < toks.length; i++) if (isKw(toks[i], 'OPTION') && isOp(toks[i + 1], '(')) { const c = match(toks, i + 1); toks.splice(i, c - i + 1); i--; }
    return toks;
  }

  function canonical(name, env) {
    const toks = resolveNames(tokenize(name.startsWith('#') ? name : name.replace(/^\[|\]$/g, '')), env);
    const t = toks[0]; if (!t) return name;
    return t.tbl || t.t === 'id' ? t.v : name;
  }

  // Turns one T-SQL statement (tokens) into SQLite statements.
  function translate(toks, env) {
    toks = stripHints(resolveNames(toks, env));
    const head = toks[0] ? toks[0].u : '';
    const sqlOf = ts => emit(rewriteTop(rewriteExpr(ts, env)));
    if (!toks.length) return [];
    // SELECT … INTO new_table
    const sc = scopes(toks);
    if ((head === 'SELECT' || head === 'WITH') && sc.length) {
      const top = sc.find(s => s.into !== undefined && toks[s.into + 1]);
      if (top) {
        const target = toks[top.into + 1];
        const rest = toks.slice(0, top.into).concat(toks.slice(top.into + 2));
        if (env.exists(target.v)) throw Object.assign(new Error(`There is already an object named ${target.v} in the database.`), { at: target });
        return [{ sql: `CREATE TABLE "${target.v.replace(/"/g, '')}" AS ${sqlOf(rest)}`, kind: 'ddl', created: target.v }];
      }
      return [{ sql: sqlOf(toks), kind: 'select' }];
    }
    if (head === 'INSERT') {
      const outIdx = toks.findIndex(t => isKw(t, 'OUTPUT')); if (outIdx > 0) throw new Unsupported('OUTPUT clauses aren’t available in the practice kitchen. Run a SELECT afterwards to see the new rows.');
      if (!isKw(toks[1], 'INTO')) toks.splice(1, 0, id('INTO'));
      return [{ sql: sqlOf(toks), kind: 'dml', table: toks[2].v, verb: 'INSERT' }];
    }
    if (head === 'UPDATE') return [updateJoin(toks, env, sqlOf)];
    if (head === 'DELETE') return [deleteJoin(toks, env, sqlOf)];
    if (head === 'TRUNCATE') return [{ sql: `DELETE FROM ${emit([toks[2]])}`, kind: 'dml', table: toks[2].v, verb: 'DELETE' }];
    if (head === 'CREATE' || head === 'ALTER') return createAlter(toks, env, sqlOf);
    if (head === 'DROP') {
      const what = toks[1].u;
      if (what === 'INDEX') { let nm = toks[2]; if (isKw(toks[2], 'IF')) nm = toks[4]; const on = toks.findIndex(t => isKw(t, 'ON')); const idx = on > 0 ? `"${toks[on + 1].v}.${nm.v}"` : `"${nm.v}"`; env.indexes = env.indexes.filter(x => x.name.toLowerCase() !== String(nm.v).toLowerCase()); return [{ sql: `DROP INDEX IF EXISTS ${idx}`, kind: 'ddl' }]; }
      if (what === 'SCHEMA') { env.schemas.delete(String(toks[toks.length - 1].v).toLowerCase()); return []; }
      if (what === 'PROCEDURE' || what === 'PROC') { delete env.procs[String(toks[toks.length - 1].v).toLowerCase()]; return []; }
      if (what === 'TRIGGER') { const nm = String(toks[toks.length - 1].v).toLowerCase(); env.triggers = env.triggers.filter(t => t.name.toLowerCase() !== nm); return []; }
      return [{ sql: sqlOf(toks), kind: 'ddl' }];
    }
    if (head === 'MERGE') throw new Unsupported('MERGE isn’t available in the practice kitchen. Try an UPDATE and an INSERT instead.');
    return [{ sql: sqlOf(toks), kind: 'other' }];
  }

  function aliasMap(toks, from, to) {
    // FROM t a JOIN u b … → { a: 'sales.Orders', … }
    const m = {};
    for (let i = from; i < to; i++) if (toks[i].tbl || (toks[i].t === 'id' && toks[i].q && (isKw(toks[i - 1], 'FROM') || isKw(toks[i - 1], 'JOIN') || isKw(toks[i - 1], 'UPDATE')))) {
      let a = toks[i + 1]; if (isKw(a, 'AS')) a = toks[i + 2];
      m[toks[i].v.toLowerCase()] = toks[i].v;
      if (a && a.t === 'id' && !KW.has(a.u) && !a.tbl) m[a.v.toLowerCase()] = toks[i].v;
    }
    return m;
  }
  function fromItems(toks, from, to) {
    // [{ table, ref }] for each table in FROM / JOIN, where ref is its nickname (or its name)
    const out = [];
    for (let i = from; i < to; i++) {
      const t = toks[i];
      if (!(t.t === 'id' && (t.tbl || t.q) && (isKw(toks[i - 1], 'FROM') || isKw(toks[i - 1], 'JOIN') || isOp(toks[i - 1], ',')))) continue;
      let a = toks[i + 1]; if (isKw(a, 'AS')) a = toks[i + 2];
      const alias = a && a.t === 'id' && !a.q && !KW.has(a.u) ? a.v : null;
      out.push({ table: t.v, ref: alias || `"${t.v}"`, alias });
    }
    return out;
  }
  function tableCols(env, table) { const r = env.db.exec(`PRAGMA table_info("${String(table).replace(/"/g, '')}")`); return r.length ? r[0].values.map(v => String(v[1]).toLowerCase()) : []; }
  function updateJoin(toks, env, sqlOf) {
    const target = toks[1];
    const fromAt = toks.findIndex((t, i) => i > 2 && isKw(t, 'FROM') && depthAt(toks, i) === 0);
    if (fromAt < 0) {
      const sets = toks.filter((t, i) => !(i > 2 && t.t === 'id' && isOp(toks[i + 1], '.') && t.v.toLowerCase() === target.v.toLowerCase()) && !(isOp(t, '.') && toks[i - 1] && toks[i - 1].t === 'id' && toks[i - 1].v.toLowerCase() === target.v.toLowerCase() && i > 2));
      return { sql: sqlOf(sets), kind: 'dml', table: target.v, verb: 'UPDATE' };
    }
    const whereAt = toks.findIndex((t, i) => i > fromAt && isKw(t, 'WHERE') && depthAt(toks, i) === 0);
    const items = fromItems(toks, fromAt, whereAt < 0 ? toks.length : whereAt);
    const me = items.find(x => (x.alias || '').toLowerCase() === target.v.toLowerCase() || x.table.toLowerCase() === target.v.toLowerCase()) || { table: target.v, ref: `"${target.v}"`, alias: null };
    const others = items.filter(x => x !== me);
    const myCols = new Set(tableCols(env, me.table));
    const isMe = v => v.toLowerCase() === (me.alias || '').toLowerCase() || v.toLowerCase() === me.table.toLowerCase();
    const sets = splitTop(toks.slice(3, fromAt)).map(it => {
      let k = 0; if (isOp(it[1], '.')) k = 2;
      const lhs = it[k];
      const rhs = [];
      for (let i = k + 2; i < it.length; i++) {
        const t = it[i];
        if (t.t === 'id' && isOp(it[i + 1], '.') && it[i + 2]) { rhs.push(id(isMe(t.v) ? '__t' : '__j'), op('.'), it[i + 2]); i += 2; continue; }
        if (t.t === 'id' && !t.q && !KW.has(t.u) && !isOp(it[i + 1], '(') && myCols.has(t.v.toLowerCase()) && !isOp(it[i - 1], '.')) { rhs.push(id('__t'), op('.'), t); continue; }
        rhs.push(t);
      }
      return [lhs, op('=')].concat(rhs);
    });
    const setSql = sets.map(s => sqlOf(s)).join(', ');
    const fromSql = sqlOf(toks.slice(fromAt));
    if (!others.length) return { sql: `UPDATE "${me.table}" AS __t SET ${setSql} WHERE __t.rowid IN (SELECT ${me.ref}.rowid ${fromSql})`, kind: 'dml', table: me.table, verb: 'UPDATE' };
    return { sql: `UPDATE "${me.table}" AS __t SET ${setSql} FROM (SELECT ${me.ref}.rowid AS __rid, ${others.map(o => o.ref + '.*').join(', ')} ${fromSql}) AS __j WHERE __t.rowid = __j.__rid`, kind: 'dml', table: me.table, verb: 'UPDATE' };
  }
  function deleteJoin(toks, env, sqlOf) {
    if (isKw(toks[1], 'TOP')) throw new Unsupported('DELETE TOP isn’t available in the practice kitchen.');
    const hasFrom1 = isKw(toks[1], 'FROM');
    const target = hasFrom1 ? toks[2] : toks[1];
    const second = toks.findIndex((x, k) => k > (hasFrom1 ? 2 : 1) && isKw(x, 'FROM') && depthAt(toks, k) === 0);
    if (second < 0) {
      const rest = toks.slice(hasFrom1 ? 3 : 2);
      return { sql: `DELETE FROM ${sqlOf([target])} ${sqlOf(rest)}`, kind: 'dml', table: target.v, verb: 'DELETE' };
    }
    const whereAt = toks.findIndex((t, i) => i > second && isKw(t, 'WHERE') && depthAt(toks, i) === 0);
    const items = fromItems(toks, second, whereAt < 0 ? toks.length : whereAt);
    const me = items.find(x => (x.alias || '').toLowerCase() === target.v.toLowerCase() || x.table.toLowerCase() === target.v.toLowerCase()) || { table: target.v, ref: `"${target.v}"` };
    return { sql: `DELETE FROM "${me.table}" WHERE rowid IN (SELECT ${me.ref}.rowid ${sqlOf(toks.slice(second))})`, kind: 'dml', table: me.table, verb: 'DELETE' };
  }
  function depthAt(toks, i) { let d = 0; for (let k = 0; k < i; k++) { if (isOp(toks[k], '(')) d++; else if (isOp(toks[k], ')')) d--; } return d; }

  function createAlter(toks, env, sqlOf) {
    let i = 1, orAlter = false;
    if (isKw(toks[i], 'OR') && isKw(toks[i + 1], 'ALTER')) { orAlter = true; i += 2; }
    const alter = toks[0].u === 'ALTER';
    let unique = false, clustered = null;
    while (['UNIQUE', 'CLUSTERED', 'NONCLUSTERED', 'COLUMNSTORE'].includes(toks[i] && toks[i].u)) { if (toks[i].u === 'UNIQUE') unique = true; else if (toks[i].u !== 'COLUMNSTORE') clustered = toks[i].u === 'CLUSTERED'; i++; }
    const what = toks[i] && toks[i].u;
    if (what === 'SCHEMA') { env.schemas.add(String(toks[i + 1].v).toLowerCase()); env.created.push({ kind: 'schema', name: toks[i + 1].v }); return []; }
    if (what === 'VIEW') {
      const nm = toks[i + 1]; let asAt = toks.findIndex((t, k) => k > i + 1 && isKw(t, 'AS'));
      const body = toks.slice(asAt + 1).filter((t, k, a) => !(isKw(t, 'WITH') && isKw(a[k + 1], 'CHECK')) && !(isKw(t, 'CHECK') && isKw(a[k + 1], 'OPTION')) && !(isKw(t, 'OPTION') && isKw(a[k - 1], 'CHECK')));
      const sc = scopes(body); const outer = sc[0];
      if (outer && outer.order !== undefined && !body.slice(outer.select, outer.order).some(t => isKw(t, 'TOP'))) throw Object.assign(new Error('SQL Server doesn’t allow ORDER BY inside a view (unless TOP is used). Sort when you SELECT from the view instead.'), { at: body[outer.order], slip: 'view-order' });
      const cols = isOp(toks[i + 2], '(') ? '(' + emit(toks.slice(i + 3, match(toks, i + 2))) + ')' : '';
      env.created.push({ kind: 'view', name: nm.v });
      return (alter || orAlter ? [{ sql: `DROP VIEW IF EXISTS "${nm.v}"`, kind: 'ddl' }] : []).concat([{ sql: `CREATE VIEW "${nm.v}"${cols} AS ${sqlOf(body)}`, kind: 'ddl', created: nm.v }]);
    }
    if (what === 'INDEX') {
      const nm = toks[i + 1], on = toks.findIndex(t => isKw(t, 'ON')), tbl = toks[on + 1];
      const c = match(toks, on + 2); const keys = []; let cur = [];
      toks.slice(on + 3, c).forEach(t => { if (isOp(t, ',')) { keys.push(cur); cur = []; } else cur.push(t); }); if (cur.length) keys.push(cur);
      const keyCols = keys.map(k => ({ col: k[0].v, desc: k.some(t => isKw(t, 'DESC')) }));
      let inc = [], where = null, j = c + 1;
      if (isKw(toks[j], 'INCLUDE')) { const c2 = match(toks, j + 1); inc = toks.slice(j + 2, c2).filter(t => t.t === 'id').map(t => t.v); j = c2 + 1; }
      if (isKw(toks[j], 'WHERE')) { let k = j + 1; while (k < toks.length && !isKw(toks[k], 'WITH') && !isKw(toks[k], 'ON')) k++; where = toks.slice(j + 1, k); j = k; }
      if (!env.exists(tbl.v)) throw Object.assign(new Error(`Cannot find the object “${tbl.orig || tbl.v}”.`), { at: tbl });
      env.indexes = env.indexes.filter(x => x.name.toLowerCase() !== String(nm.v).toLowerCase());
      env.indexes.push({ name: nm.v, table: tbl.v, keys: keyCols, include: inc, clustered: clustered === true, unique, filter: where ? emit(where) : null });
      return [{ sql: `CREATE ${unique ? 'UNIQUE ' : ''}INDEX "${tbl.v}.${nm.v}" ON "${tbl.v}" (${keyCols.map(k => `"${k.col}"${k.desc ? ' DESC' : ''}`).join(', ')})${where ? ' WHERE ' + sqlOf(where) : ''}`, kind: 'ddl' }];
    }
    if (what === 'TABLE' && alter) return alterTable(toks, i + 1, env, sqlOf);
    if (what === 'TABLE') {
      const nm = toks[i + 1]; const open = i + 2, close = match(toks, open);
      if (env.exists(nm.v)) throw Object.assign(new Error(`There is already an object named ${nm.orig || nm.v} in the database.`), { at: nm });
      const inner = toks.slice(open + 1, close);
      const defs = []; let cur = [], d = 0;
      inner.forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { defs.push(cur); cur = []; } else cur.push(t); }); if (cur.length) defs.push(cur);
      const out = defs.map(def => {
        def = def.filter(t => !isKw(t, 'CLUSTERED') && !isKw(t, 'NONCLUSTERED'));
        const ix = def.findIndex(t => isKw(t, 'IDENTITY'));
        if (ix >= 0) { const c2 = isOp(def[ix + 1], '(') ? match(def, ix + 1) : ix; def.splice(ix, c2 - ix + 1); if (def.some(t => isKw(t, 'PRIMARY')) && /^(INT|BIGINT|SMALLINT)$/i.test(def[1].v)) def[1] = Object.assign({}, def[1], { v: 'INTEGER', declared: def[1].v }); }
        for (let k = 0; k < def.length; k++) {
          if (isOp(def[k], '(') && isKw(def[k + 1], 'MAX')) def[k + 1] = raw('2147483647');
          if (isKw(def[k], 'DEFAULT') && def[k + 1] && def[k + 1].t === 'id' && /^(GETDATE|SYSDATETIME|GETUTCDATE|CURRENT_TIMESTAMP)$/i.test(def[k + 1].v)) { const e = isOp(def[k + 2], '(') ? k + 3 : k + 1; def.splice(k + 1, e - k, { t: 'str', v: NOW }); }
          if (isKw(def[k], 'DEFAULT') && isOp(def[k + 1], '(') && def[k + 2] && /^(GETDATE|SYSDATETIME)$/i.test(def[k + 2].v)) { const e = match(def, k + 1); def.splice(k + 1, e - k, { t: 'str', v: NOW }); }
        }
        const typ = def[1];
        if (def[0].t === 'id' && !['PRIMARY', 'CONSTRAINT', 'FOREIGN', 'UNIQUE', 'CHECK', 'INDEX'].includes(def[0].u) && typ && /CHAR|TEXT/i.test(typ.v)) env.textCols.add(def[0].v.toLowerCase());
        if (isKw(def[0], 'INDEX')) return null;
        return sqlOf(def);
      }).filter(Boolean);
      let after = close + 1; if (isKw(toks[after], 'ON')) after += isOp(toks[after + 2], '(') ? match(toks, after + 2) - after + 1 : 2;
      env.created.push({ kind: 'table', name: nm.v });
      return [{ sql: `CREATE TABLE "${nm.v}" (${out.join(', ')})`, kind: 'ddl', created: nm.v }];
    }
    if (what === 'PARTITION') {
      const kind = toks[i + 1].u, nm = toks[i + 2].v;
      if (kind === 'FUNCTION') {
        const ty = typeText(toks, i + 4, match(toks, i + 3) - 1); const r = toks.findIndex(t => isKw(t, 'RANGE'));
        const side = isKw(toks[r + 1], 'LEFT') ? 'LEFT' : 'RIGHT'; const v = toks.findIndex(t => isKw(t, 'VALUES'));
        const vals = toks.slice(v + 2, match(toks, v + 1)).filter(t => t.t === 'str' || t.t === 'num').map(t => String(t.v));
        env.partitions[nm.toLowerCase()] = { kind: 'function', name: nm, type: ty, side, values: vals };
      } else {
        const asAt = toks.findIndex(t => isKw(t, 'PARTITION') && isKw(toks[toks.indexOf(t) - 1], 'AS'));
        env.partitions[nm.toLowerCase()] = { kind: 'scheme', name: nm, fn: toks[asAt + 1] ? toks[asAt + 1].v : null };
      }
      return [];
    }
    if (what === 'STATISTICS') return [];
    if (what === 'FUNCTION') throw new Unsupported('User-defined functions aren’t available in the practice kitchen yet. Try a view or a CTE.');
    throw new Unsupported(`CREATE ${what || ''} isn’t available in the practice kitchen.`);
  }
  function alterTable(toks, i, env, sqlOf) {
    const nm = toks[i]; const verb = toks[i + 1].u;
    if (!env.exists(nm.v)) throw Object.assign(new Error(`Cannot find the object “${nm.orig || nm.v}”.`), { at: nm });
    if (verb === 'ADD') {
      if (isKw(toks[i + 2], 'CONSTRAINT') || isKw(toks[i + 2], 'PRIMARY') || isKw(toks[i + 2], 'FOREIGN') || isKw(toks[i + 2], 'CHECK') || isKw(toks[i + 2], 'UNIQUE')) { env.constraints.push({ table: nm.v, def: emit(toks.slice(i + 2)) }); return []; }
      const defs = []; let cur = [], d = 0;
      toks.slice(i + 2).forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { defs.push(cur); cur = []; } else cur.push(t); }); if (cur.length) defs.push(cur);
      return defs.map(def => { if (isKw(def[0], 'COLUMN')) def = def.slice(1); if (def[1] && /CHAR|TEXT/i.test(def[1].v)) env.textCols.add(def[0].v.toLowerCase()); for (let k = 0; k < def.length; k++) if (isOp(def[k], '(') && isKw(def[k + 1], 'MAX')) def[k + 1] = raw('2147483647'); return { sql: `ALTER TABLE "${nm.v}" ADD COLUMN ${sqlOf(def)}`, kind: 'ddl' }; });
    }
    if (verb === 'DROP') {
      if (isKw(toks[i + 2], 'CONSTRAINT')) return [];
      const cols = toks.slice(isKw(toks[i + 2], 'COLUMN') ? i + 3 : i + 2).filter(t => t.t === 'id' && !KW.has(t.u));
      return cols.map(c => ({ sql: `ALTER TABLE "${nm.v}" DROP COLUMN "${c.v}"`, kind: 'ddl' }));
    }
    if (verb === 'ALTER') {
      // ALTER COLUMN: rebuild the table with the new type
      const col = toks[i + 3], typeToks = toks.slice(i + 4).filter(t => !isKw(t, 'NULL') && !isKw(t, 'NOT'));
      const notNull = toks.slice(i + 4).some((t, k, a) => isKw(t, 'NOT') && isKw(a[k + 1], 'NULL'));
      return [{ alterColumn: { table: nm.v, col: col.v, type: emit(typeToks).replace(/\(\s*MAX\s*\)/i, '(2147483647)'), notNull }, kind: 'ddl' }];
    }
    throw new Unsupported(`ALTER TABLE … ${verb} isn’t available in the practice kitchen.`);
  }

  // ───────────────────────── splitting a batch into statements, with blocks
  const STARTERS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'DECLARE', 'SET', 'EXEC', 'EXECUTE', 'PRINT', 'TRUNCATE', 'IF', 'BEGIN', 'COMMIT', 'ROLLBACK', 'RETURN', 'WITH', 'USE', 'MERGE', 'THROW', 'RAISERROR', 'WHILE']);
  function stmtEnd(toks, i) {
    const first = toks[i].u; let d = 0, caseD = 0, mainSeen = first !== 'WITH', selects = 0, sawSet = false, sawValues = false;
    for (let j = i + 1; j < toks.length; j++) {
      const t = toks[j], prev = toks[j - 1];
      if (isOp(t, '(')) { d++; continue; } if (isOp(t, ')')) { d--; if (d < 0) return j; continue; }
      if (d !== 0) continue;
      if (isOp(t, ';')) return j;
      if (t.t !== 'id' || t.q) continue;
      const u = t.u;
      if (u === 'VALUES') sawValues = true;
      if (u === 'CASE') { caseD++; continue; }
      if (u === 'END') { if (caseD > 0) { caseD--; continue; } return j; }
      if (u === 'ELSE' && caseD > 0) continue;
      if (u === 'ELSE') return j;
      if (isOp(prev, '.')) continue;
      if (!STARTERS.has(u)) continue;
      if (u === 'IF' && prev && prev.t === 'id' && /^(TABLE|VIEW|INDEX|PROC|PROCEDURE|SCHEMA|TRIGGER|FUNCTION|COLUMN|CONSTRAINT)$/.test(prev.u || '')) continue;
      if (first === 'ALTER' && (u === 'DROP' || u === 'ALTER') && !isKw(toks[i + 1], 'VIEW') && !isKw(toks[i + 1], 'PROC') && !isKw(toks[i + 1], 'PROCEDURE')) continue;
      if (u === 'SET' && first === 'UPDATE' && !sawSet) { sawSet = true; continue; }
      if (u === 'WITH' && (isOp(toks[j + 1], '(') || isKw(toks[j + 1], 'TIES') || isKw(toks[j + 1], 'CHECK') || isKw(toks[j + 1], 'SCHEMABINDING') || first === 'CREATE' || first === 'ALTER')) continue;
      if (u === 'SELECT') {
        if (prev && (isKw(prev, 'UNION') || isKw(prev, 'ALL') || isKw(prev, 'EXCEPT') || isKw(prev, 'INTERSECT'))) continue;
        if (first === 'WITH' && !mainSeen) { mainSeen = true; continue; }
        if (first === 'WITH' && mainSeen === 'INSERT' && selects === 0) { selects++; continue; }
        if (first === 'INSERT' && !sawValues && selects === 0) { selects++; continue; }
        if ((first === 'CREATE' || first === 'ALTER') && selects === 0 && isKw(prev, 'AS')) { selects++; continue; }
        return j;
      }
      if ((u === 'INSERT' || u === 'UPDATE' || u === 'DELETE' || u === 'MERGE') && first === 'WITH' && !mainSeen) { mainSeen = u; continue; }
      if (u === 'EXEC' || u === 'EXECUTE') { if (first === 'INSERT') continue; }
      return j;
    }
    return toks.length;
  }
  function parseBlock(toks, i, stop) {
    const list = [];
    while (i < toks.length) {
      const t = toks[i];
      if (isOp(t, ';')) { i++; continue; }
      if (stop && stop(t, i)) break;
      const r = parseStmt(toks, i); list.push(r.node); i = r.i;
    }
    return { list, i };
  }
  function parseStmt(toks, i) {
    if (!toks[i]) throw Object.assign(new Error('The query ends before it’s finished.'), { slip: 'syntax' });
    const t = toks[i], u = t.t === 'id' && !t.q ? t.u : '';
    if (u === 'BEGIN') {
      const n = toks[i + 1] && toks[i + 1].u;
      if (n === 'TRAN' || n === 'TRANSACTION') { let j = i + 2; if (toks[j] && toks[j].t === 'id' && !STARTERS.has(toks[j].u)) j++; return { node: { type: 'tx', op: 'BEGIN', at: t }, i: j }; }
      if (n === 'TRY') {
        const b = parseBlock(toks, i + 2, x => isKw(x, 'END'));
        let j = b.i + 2; let c = { list: [], i: j };
        if (isKw(toks[j], 'BEGIN') && isKw(toks[j + 1], 'CATCH')) { c = parseBlock(toks, j + 2, x => isKw(x, 'END')); j = c.i + 2; }
        return { node: { type: 'try', body: b.list, katch: c.list, at: t }, i: j };
      }
      const b = parseBlock(toks, i + 1, x => isKw(x, 'END'));
      return { node: { type: 'block', body: b.list, at: t }, i: b.i + 1 };
    }
    if (u === 'COMMIT' || u === 'ROLLBACK') { let j = i + 1; while (toks[j] && toks[j].t === 'id' && (toks[j].u === 'TRAN' || toks[j].u === 'TRANSACTION' || toks[j].u === 'WORK' || (!STARTERS.has(toks[j].u) && !isOp(toks[j], ';') && isKw(toks[j - 1], 'TRAN')))) j++; return { node: { type: 'tx', op: u, at: t }, i: j }; }
    if (u === 'IF') {
      let j = i + 1, d = 0;
      for (; j < toks.length; j++) { const x = toks[j]; if (isOp(x, '(')) d++; else if (isOp(x, ')')) d--; else if (d === 0 && x.t === 'id' && !x.q && STARTERS.has(x.u) && x.u !== 'SET' || (d === 0 && x.t === 'id' && x.u === 'SET' && toks[j + 1] && toks[j + 1].t === 'var')) break; }
      const cond = toks.slice(i + 1, j);
      const a = parseStmt(toks, j); let k = a.i, b = null;
      while (isOp(toks[k], ';')) k++;
      if (isKw(toks[k], 'ELSE')) { const r = parseStmt(toks, k + 1); b = r.node; k = r.i; }
      return { node: { type: 'if', cond, then: a.node, else: b, at: t }, i: k };
    }
    if (u === 'WHILE') throw Object.assign(new Unsupported('WHILE loops aren’t available in the practice kitchen. Most requests can be answered with one set-based query.'), { at: t });
    if (u === 'USE' || u === 'GO') return { node: { type: 'noop' }, i: i + 2 };
    if ((u === 'CREATE' || u === 'ALTER') && (procAt(toks, i) || triggerAt(toks, i))) return parseRoutine(toks, i);
    const e = stmtEnd(toks, i);
    const body = toks.slice(i, e);
    if (u === 'DECLARE') return { node: { type: 'declare', toks: body, at: t }, i: e };
    if (u === 'SET' && toks[i + 1] && toks[i + 1].t === 'var') return { node: { type: 'set', toks: body, at: t }, i: e };
    if (u === 'SET') return { node: { type: 'option', toks: body, at: t }, i: e };
    if (u === 'PRINT') return { node: { type: 'print', toks: body.slice(1), at: t }, i: e };
    if (u === 'RETURN') return { node: { type: 'return', at: t }, i: e };
    if (u === 'EXEC' || u === 'EXECUTE') return { node: { type: 'exec', toks: body, at: t }, i: e };
    if (u === 'THROW' || u === 'RAISERROR') return { node: { type: 'throw', toks: body, at: t }, i: e };
    if (!STARTERS.has(u) && !(t.t === 'op' && t.v === '(')) {
      const at = t;
      throw Object.assign(new Error(t.t === 'id' ? `SQL Server doesn’t know how to start a statement with “${t.v}”.` : `Something unexpected near “${t.v}”.`), { at, slip: 'start' });
    }
    return { node: { type: 'sql', toks: body, at: t }, i: Math.max(e, i + 1) };
  }
  function procAt(toks, i) { let j = i + 1; if (isKw(toks[j], 'OR')) j += 2; return isKw(toks[j], 'PROCEDURE') || isKw(toks[j], 'PROC'); }
  function triggerAt(toks, i) { let j = i + 1; if (isKw(toks[j], 'OR')) j += 2; return isKw(toks[j], 'TRIGGER'); }
  function parseRoutine(toks, i) {
    let j = i + 1; if (isKw(toks[j], 'OR')) j += 2;
    const kind = toks[j].u === 'TRIGGER' ? 'trigger' : 'proc';
    const nameToks = resolveNames(toks.slice(j + 1, j + 4), { schemas: CUR_ENV.schemas });
    const nm = nameToks[0];
    let k = j + 2; while (isOp(toks[k], '.') ) k += 2;
    const asAt = toks.findIndex((t, x) => x > k - 1 && isKw(t, 'AS') && depthAt(toks, x) === depthAt(toks, i) && (kind === 'trigger' || !toks[x - 1] || toks[x - 1].t !== 'var'));
    let header = toks.slice(k, asAt);
    let bodyToks = toks.slice(asAt + 1);
    if (isKw(bodyToks[0], 'BEGIN') && !isKw(bodyToks[1], 'TRAN') && !isKw(bodyToks[1], 'TRY') && !isKw(bodyToks[1], 'TRANSACTION')) { const b = parseBlock(bodyToks, 1, x => isKw(x, 'END')); bodyToks = bodyToks.slice(1, b.i); }
    const body = parseBlock(bodyToks, 0).list;
    if (kind === 'proc') {
      if (isOp(header[0], '(')) header = header.slice(1, match(header, 0));
      const params = []; let cur = [], d = 0;
      header.forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { params.push(cur); cur = []; } else cur.push(t); }); if (cur.length) params.push(cur);
      const ps = params.filter(p => p.length && p[0].t === 'var').map(p => { const eq = p.findIndex(t => isOp(t, '=')); return { name: p[0].v.toLowerCase(), type: emit(p.slice(1, eq < 0 ? p.length : eq).filter(t => !isKw(t, 'AS') && !isKw(t, 'OUTPUT') && !isKw(t, 'OUT'))), def: eq < 0 ? undefined : p.slice(eq + 1).filter(t => !isKw(t, 'OUTPUT')) }; });
      return { node: { type: 'defproc', name: nm.v, params: ps, body, at: toks[i] }, i: toks.length };
    }
    // trigger: ON table AFTER|FOR|INSTEAD OF events
    const on = header.findIndex(t => isKw(t, 'ON'));
    const tbl = resolveNames(header.slice(on + 1, on + 4), { schemas: CUR_ENV.schemas })[0];
    const events = header.filter(t => ['INSERT', 'UPDATE', 'DELETE'].includes(t.u)).map(t => t.u);
    const instead = header.some(t => isKw(t, 'INSTEAD'));
    return { node: { type: 'deftrigger', name: nm.v, table: tbl.v, events, instead, body, at: toks[i] }, i: toks.length };
  }

  // ───────────────────────── running
  let CUR_ENV = null;
  function newEnv(db) {
    const env = {
      db, vars: {}, procs: {}, triggers: [], indexes: [], partitions: {}, constraints: [], options: {}, prints: [], results: [], created: [],
      schemas: new Set(BASE_SCHEMAS.concat(['dbo'])), textCols: new Set(META.textCols), altered: [],
      exists(name) { const n = String(name).replace(/"/g, ''); return !!db.exec(`SELECT 1 FROM sqlite_master WHERE lower(name) = lower('${n.replace(/'/g, "''")}')`).length; }
    };
    return env;
  }
  function fresh() { const db = new SQL.Database(BYTES); register(db); return db; }
  function literal(v) { if (v === null || v === undefined) return raw('NULL'); if (typeof v === 'number') return { t: 'num', v: String(v) }; return { t: 'str', v: String(v) }; }
  function bindVars(toks, env) {
    return toks.map(t => {
      if (t.t !== 'var') return t;
      const k = t.v.toLowerCase();
      if (k === '@@rowcount') return literal(env.rowcount || 0);
      if (k === '@@error') return literal(0);
      if (k === '@@identity') return raw('last_insert_rowid()');
      if (env.tableVars && env.tableVars[k]) return Object.assign({}, t, { t: 'id', v: env.tableVars[k], q: true, u: env.tableVars[k].toUpperCase(), tbl: true });
      if (!(k in env.vars)) throw Object.assign(new Error(`Must declare the scalar variable “${t.v}”.`), { at: t });
      return Object.assign(literal(env.vars[k]), { p: t.p, e: t.e });
    });
  }
  function evalExpr(toks, env) {
    if (!toks.length) return null;
    const sql = 'SELECT ' + emit(rewriteTop(rewriteExpr(resolveNames(bindVars(toks, env), env), env)));
    const r = env.db.exec(sql); return r.length ? r[0].values[0][0] : null;
  }
  function snapshot(db, table) { const r = db.exec(`SELECT rowid AS __rid, * FROM "${table}"`); return r.length ? r[0] : { columns: [], values: [] }; }

  function execSql(node, env) {
    // SELECT @x = col … : assignment form
    const toks = bindVarsAssign(node.toks, env);
    if (toks === null) return;
    const stmts = translate(toks, env);
    for (const s of stmts) {
      if (s.alterColumn) { alterColumn(env, s.alterColumn); continue; }
      const trig = s.kind === 'dml' && env.triggers.filter(t => t.table.toLowerCase() === String(s.table).toLowerCase() && t.events.includes(s.verb));
      const before = trig && trig.length ? snapshot(env.db, s.table) : null;
      const res = env.db.exec(s.sql);
      env.rowcount = env.db.getRowsModified();
      if (s.kind === 'select' && res.length) env.results.push({ columns: res[res.length - 1].columns, values: res[res.length - 1].values, at: node.at });
      else if (s.kind === 'select') { const cols = selectColumns(env, s.sql); env.results.push({ columns: cols, values: [], at: node.at }); }
      if (before) fireTriggers(env, s, before, trig);
    }
  }
  function selectColumns(env, sql) { try { const st = env.db.prepare(sql); const c = st.getColumnNames(); st.free(); return c; } catch (e) { return []; } }
  function bindVarsAssign(toks, env) {
    if (!(isKw(toks[0], 'SELECT') && toks[1] && toks[1].t === 'var' && isOp(toks[2], '='))) return bindVars(toks, env);
    // SELECT @a = expr, @b = expr FROM …
    const fromAt = toks.findIndex((t, i) => isKw(t, 'FROM') && depthAt(toks, i) === 0);
    const list = toks.slice(1, fromAt < 0 ? toks.length : fromAt); const items = []; let cur = [], d = 0;
    list.forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { items.push(cur); cur = []; } else cur.push(t); }); if (cur.length) items.push(cur);
    const names = items.map(it => it[0].v.toLowerCase());
    const sel = [id('SELECT')].concat(...items.map((it, k) => (k ? [op(',')] : []).concat(it.slice(2)))).concat(fromAt < 0 ? [] : toks.slice(fromAt));
    const stmts = translate(bindVars(sel, env), env); const r = env.db.exec(stmts[0].sql);
    if (r.length && r[0].values.length) { const row = r[0].values[r[0].values.length - 1]; names.forEach((n, k) => (env.vars[n] = row[k])); }
    return null;
  }
  function alterColumn(env, a) {
    const info = env.db.exec(`PRAGMA table_info("${a.table}")`)[0]; if (!info) return;
    const cols = info.values.map(r => ({ name: r[1], type: String(r[1]).toLowerCase() === a.col.toLowerCase() ? a.type : r[2], nn: String(r[1]).toLowerCase() === a.col.toLowerCase() ? a.notNull : !!r[3], pk: r[5] }));
    const pk = cols.filter(c => c.pk).sort((x, y) => x.pk - y.pk).map(c => `"${c.name}"`);
    const tmp = `__alter_${Date.now()}`;
    env.db.run(`ALTER TABLE "${a.table}" RENAME TO "${tmp}"`);
    env.db.run(`CREATE TABLE "${a.table}" (${cols.map(c => `"${c.name}" ${c.type}${c.nn ? ' NOT NULL' : ''}`).join(', ')}${pk.length ? `, PRIMARY KEY (${pk.join(', ')})` : ''})`);
    env.db.run(`INSERT INTO "${a.table}" SELECT * FROM "${tmp}"`); env.db.run(`DROP TABLE "${tmp}"`);
    env.altered.push(a);
  }
  function fireTriggers(env, s, before, trigs) {
    const after = snapshot(env.db, s.table);
    const key = r => r[0];
    const bmap = new Map(before.values.map(r => [key(r), r])), amap = new Map(after.values.map(r => [key(r), r]));
    const ins = [], del = [];
    after.values.forEach(r => { const b = bmap.get(key(r)); if (!b) ins.push(r); else if (JSON.stringify(b) !== JSON.stringify(r)) { ins.push(r); del.push(b); } });
    before.values.forEach(r => { if (!amap.has(key(r))) del.push(r); });
    if (!ins.length && !del.length) return;
    const cols = after.columns.slice(1);
    const mk = (nm, rows) => { env.db.run(`DROP TABLE IF EXISTS "${nm}"`); env.db.run(`CREATE TABLE "${nm}" (${cols.map(c => `"${c}"`).join(', ')})`); const st = env.db.prepare(`INSERT INTO "${nm}" VALUES (${cols.map(() => '?').join(',')})`); rows.forEach(r => st.run(r.slice(1))); st.free(); };
    mk('inserted', ins); mk('deleted', del);
    trigs.forEach(t => runList(t.body, Object.assign(Object.create(env), { vars: {}, inTrigger: true })));
    env.db.run('DROP TABLE IF EXISTS "inserted"'); env.db.run('DROP TABLE IF EXISTS "deleted"');
  }
  class Return extends Error {}
  function runList(list, env) { for (const n of list) runNode(n, env); }
  function runNode(n, env) {
    switch (n.type) {
      case 'noop': return;
      case 'sql': return execSql(n, env);
      case 'block': return runList(n.body, env);
      case 'tx': if (n.op === 'BEGIN') { try { env.db.run('SAVEPOINT tsql'); env.tx = (env.tx || 0) + 1; } catch (e) {} } else if (n.op === 'COMMIT') { try { env.db.run('RELEASE tsql'); env.tx--; } catch (e) {} } else { try { env.db.run('ROLLBACK TO tsql'); env.db.run('RELEASE tsql'); env.tx--; } catch (e) {} } return;
      case 'try': try { runList(n.body, env); } catch (e) { if (e instanceof Return) throw e; LAST_ERROR.msg = e.message; runList(n.katch, env); } return;
      case 'if': { const v = evalExpr([id('CASE'), id('WHEN')].concat(n.cond, [id('THEN'), raw('1'), id('ELSE'), raw('0'), id('END')]), env); if (v) runNode(n.then, env); else if (n.else) runNode(n.else, env); return; }
      case 'declare': {
        const items = []; let cur = [], d = 0;
        n.toks.slice(1).forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { items.push(cur); cur = []; } else cur.push(t); }); if (cur.length) items.push(cur);
        items.forEach(it => {
          const nm = it[0].v.toLowerCase();
          let k = 1; if (isKw(it[k], 'AS')) k++;
          if (isKw(it[k], 'TABLE')) { const tn = '@' + nm.slice(1); env.tableVars = env.tableVars || {}; env.tableVars[nm] = tn; env.db.run(`DROP TABLE IF EXISTS "${tn}"`); env.db.run(`CREATE TABLE "${tn}" ${emit(it.slice(k + 1))}`); return; }
          const eq = it.findIndex(t => isOp(t, '='));
          env.vars[nm] = eq < 0 ? null : coerce(evalExpr(it.slice(eq + 1), env), emit(it.slice(k, eq)));
          env.varTypes = env.varTypes || {}; env.varTypes[nm] = emit(it.slice(k, eq < 0 ? it.length : eq));
        });
        return;
      }
      case 'set': {
        const nm = n.toks[1].v.toLowerCase(); const o = n.toks[2].v; let ex = n.toks.slice(3);
        if (!(nm in env.vars)) throw Object.assign(new Error(`Must declare the scalar variable “${n.toks[1].v}”.`), { at: n.toks[1] });
        if (o !== '=') ex = [n.toks[1], op(o[0])].concat([op('(')], ex, [op(')')]);
        env.vars[nm] = coerce(evalExpr(ex, env), env.varTypes && env.varTypes[nm]); return;
      }
      case 'option': { const words = n.toks.slice(1).map(t => t.u || t.v).join(' '); env.options[words.replace(/\s+(ON|OFF)$/, '')] = /ON$/.test(words); return; }
      case 'print': env.prints.push(String(evalExpr(n.toks, env))); return;
      case 'return': throw new Return();
      case 'throw': { const s = n.toks.find(t => t.t === 'str'); throw new Error(s ? s.v : 'An error was raised.'); }
      case 'defproc': env.procs[n.name.toLowerCase()] = n; env.created.push({ kind: 'proc', name: n.name }); return;
      case 'deftrigger': env.triggers = env.triggers.filter(t => t.name.toLowerCase() !== n.name.toLowerCase()).concat([n]); env.created.push({ kind: 'trigger', name: n.name }); return;
      case 'exec': return execProc(n, env);
    }
  }
  function coerce(v, type) { if (v === null || !type) return v; try { return tcast(v, type); } catch (e) { return v; } }
  function execProc(n, env) {
    const toks = resolveNames(n.toks.slice(1), env);
    let k = 0; if (toks[0] && toks[0].t === 'var' && isOp(toks[1], '=')) k = 2;
    const nameTok = toks[k]; if (!nameTok) return;
    if (/^sp_/i.test(nameTok.v)) return;
    const proc = env.procs[String(nameTok.v).toLowerCase()];
    if (!proc) throw Object.assign(new Error(`Could not find stored procedure “${nameTok.orig || nameTok.v}”.`), { at: nameTok });
    const args = []; let cur = [], d = 0;
    toks.slice(k + 1).forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { args.push(cur); cur = []; } else cur.push(t); }); if (cur.length) args.push(cur);
    const vars = {};
    args.forEach((a, i) => {
      if (a[0] && a[0].t === 'var' && isOp(a[1], '=')) vars[a[0].v.toLowerCase()] = evalExpr(a.slice(2).filter(t => !isKw(t, 'OUTPUT')), env);
      else if (proc.params[i]) vars[proc.params[i].name] = evalExpr(a.filter(t => !isKw(t, 'OUTPUT')), env);
    });
    const inner = Object.assign(Object.create(env), { vars: {}, varTypes: {} });
    proc.params.forEach(p => {
      if (p.name in vars) inner.vars[p.name] = coerce(vars[p.name], p.type);
      else if (p.def) inner.vars[p.name] = evalExpr(p.def, env);
      else throw Object.assign(new Error(`The procedure ${proc.name} expects the parameter ${p.name}, which wasn’t supplied.`), { at: nameTok });
      inner.varTypes[p.name] = p.type;
    });
    try { runList(proc.body, inner); } catch (e) { if (!(e instanceof Return)) throw e; }
  }

  // Runs a whole batch on a fresh copy of the data.
  function run(src, opts) {
    opts = opts || {};
    const db = fresh(); const env = newEnv(db); CUR_ENV = env;
    const out = { env, error: null };
    if (opts.before) { try { opts.before.forEach(s => runList(parseBlock(tokenize(s), 0).list, env)); env.results.length = 0; env.created.length = 0; } catch (e) { out.error = Object.assign(new Error('Setup failed: ' + e.message), { setupFailed: true }); return out; } }
    try {
      const batches = String(src).split(/^\s*GO\s*;?\s*$/im);
      for (const b of batches) {
        const toks = tokenize(b);
        const open = toks.find(t => t.open); if (open) throw Object.assign(new Error(open.t === 'str' ? 'A quote is opened here but never closed.' : 'A [ bracket is opened here but never closed.'), { at: open, slip: 'quote' });
        const list = parseBlock(toks, 0).list;
        runList(list, env);
      }
      (opts.after || []).forEach(s => { const toks = tokenize(s); runList(parseBlock(toks, 0).list, env); });
    } catch (e) {
      if (e && e.setupFailed) throw e;
      if (!(e instanceof Return)) out.error = e;
    }
    return out;
  }

  // ───────────────────────── comparing results
  function norm(v) {
    if (v === null || v === undefined) return '∅';
    if (typeof v === 'number') return (Math.round(v * 100) / 100).toFixed(2);
    const s = String(v);
    if (/^-?\d+(\.\d+)?$/.test(s.trim())) return (Math.round(Number(s) * 100) / 100).toFixed(2);
    if (/^\d{4}-\d{2}-\d{2} 00:00:00(\.0+)?$/.test(s)) return s.slice(0, 10);
    return s.replace(/\s+$/, '');
  }
  function compareSets(exp, act, opt) {
    opt = opt || {};
    const E = exp.values.map(r => r.map(norm)), A = act.values.map(r => r.map(norm));
    const k = exp.columns.length, m = act.columns.length;
    const sig = (rows, c) => rows.map(r => r[c]).sort().join('\u0001');
    const es = Array.from({ length: k }, (_, c) => sig(E, c)), as = Array.from({ length: m }, (_, c) => sig(A, c));
    const cands = es.map(s => as.map((x, j) => (x === s ? j : -1)).filter(j => j >= 0));
    const rowKey = (r, map) => map.map(j => r[j]).join('\u0001');
    let mapping = null;
    const used = new Set(), cur = [];
    const expRows = E.map(r => r.join('\u0001')).sort().join('\n');
    (function bt(c) {
      if (mapping) return;
      if (c === k) { const got = A.map(r => rowKey(r, cur)).sort().join('\n'); if (got === expRows) mapping = cur.slice(); return; }
      for (const j of cands[c]) { if (used.has(j)) continue; used.add(j); cur.push(j); bt(c + 1); cur.pop(); used.delete(j); }
    })(0);
    if (E.length !== A.length) return { ok: false, kind: 'count', exp: E.length, got: A.length, missingCols: cands.map((c, i) => (c.length ? null : exp.columns[i])).filter(Boolean) };
    if (!mapping) {
      const missing = cands.map((c, i) => (c.length ? null : exp.columns[i])).filter(Boolean);
      return { ok: false, kind: m < k ? 'fewer-cols' : 'values', missingCols: missing };
    }
    if (m > k) return { ok: false, kind: 'extra-cols', extra: act.columns.filter((_, j) => !mapping.includes(j)) };
    if (opt.order && opt.order.length) {
      const keys = opt.order.map(o => ({ j: mapping[o.col], desc: o.desc }));
      const cmp = (a, b) => { const na = Number(a), nb = Number(b); if (a === '∅' || b === '∅') return a === b ? 0 : a === '∅' ? -1 : 1; if (!isNaN(na) && !isNaN(nb) && a !== '' && b !== '') return na - nb; return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0; };
      for (let i = 1; i < A.length; i++) for (const key of keys) {
        const c = cmp(A[i - 1][key.j], A[i][key.j]) * (key.desc ? -1 : 1);
        if (c < 0) break; if (c > 0) return { ok: false, kind: 'order', col: act.columns[key.j], desc: key.desc };
      }
    }
    return { ok: true };
  }

  // ORDER BY keys of a reference SELECT, as output column positions.
  function orderKeys(sol) {
    const toks = tokenize(sol); const sc = scopes(toks);
    const tops = sc.filter(x => depthAt(toks, x.select) === 0);
    const s = tops.slice().reverse().find(x => x.order !== undefined);
    if (!s) return null;
    let first = s, k = tops.indexOf(s);
    while (k > 0 && /^(UNION|EXCEPT|INTERSECT)$/.test((toks[tops[k - 1].end] || {}).u || '')) { k--; first = tops[k]; }
    const names = selectItems(toks, first).map(it => String(it.name).toLowerCase());
    const items = splitTop(toks.slice(s.order + 2, s.offset !== undefined ? s.offset : s.end));
    const keys = [];
    for (const it of items) {
      const desc = it.some(t => isKw(t, 'DESC')); const body = it.filter(t => !isKw(t, 'DESC') && !isKw(t, 'ASC'));
      let col = -1;
      if (body.length === 1 && body[0].t === 'num') col = Number(body[0].v) - 1;
      else { const last = body[body.length - 1]; const simple = body.length === 1 || (body.length === 3 && isOp(body[1], '.')); col = simple ? names.indexOf(String(last.v).toLowerCase()) : names.indexOf(emit(body).toLowerCase()); }
      if (col < 0) return { unmapped: true, keys };
      keys.push({ col, desc });
    }
    return { keys };
  }
  function splitTop(toks) { const out = []; let cur = [], d = 0; toks.forEach(t => { if (isOp(t, '(')) d++; if (isOp(t, ')')) d--; if (d === 0 && isOp(t, ',')) { out.push(cur); cur = []; } else cur.push(t); }); if (cur.length) out.push(cur); return out; }
  function selectItems(toks, s) {
    let a = s.select + 1; if (isKw(toks[a], 'DISTINCT') || isKw(toks[a], 'ALL')) a++;
    if (isKw(toks[a], 'TOP')) a += isOp(toks[a + 1], '(') ? match(toks, a + 1) - a + 1 : 2;
    if (isKw(toks[a], 'WITH') && isKw(toks[a + 1], 'TIES')) a += 2;
    const e = [s.into, s.from, s.where, s.group, s.having, s.order, s.end].filter(x => x !== undefined && x > a).sort((x, y) => x - y)[0];
    return splitTop(toks.slice(a, e)).map(it => {
      let name = '', expr = it;
      const asAt = it.map((t, i) => (isKw(t, 'AS') && depthAt(it, i) === 0 ? i : -1)).filter(i => i >= 0).pop();
      if (asAt !== undefined && asAt >= 0) { name = it[asAt + 1] ? (it[asAt + 1].t === 'str' ? it[asAt + 1].v : it[asAt + 1].v) : ''; expr = it.slice(0, asAt); }
      else if (it.length >= 3 && it[0].t === 'id' && isOp(it[1], '=') && !isOp(it[2], '=')) { name = it[0].v; expr = it.slice(2); }
      else if (it.length === 2 && it[0].t === 'id' && it[1].t === 'id' && !KW.has(it[1].u)) { name = it[1].v; expr = [it[0]]; }
      else { const l = it[it.length - 1]; name = l.t === 'id' ? l.v : emit(it); }
      return { name, expr, toks: it };
    });
  }

  // ───────────────────────── slips and gentle notes
  function lev(a, b) { a = a.toLowerCase(); b = b.toLowerCase(); const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[m][n]; }
  const SQL_WORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'DISTINCT', 'BETWEEN', 'UNION', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DESC', 'COUNT', 'WHEN', 'THEN', 'ELSE', 'CASE', 'LIKE', 'NULL', 'EXISTS', 'PARTITION', 'OVER', 'WITH', 'INTO', 'SET', 'AND', 'NOT', 'TOP', 'AS', 'ON', 'BY'];
  function findTok(src, word, after) {
    const toks = tokenize(src); const w = String(word).toLowerCase().replace(/^"|"$/g, '');
    return toks.find(t => (t.p >= (after || 0)) && ((t.t === 'id' && (t.v.toLowerCase() === w || w.endsWith('.' + t.v.toLowerCase()))) || (t.t !== 'str' && String(t.v).toLowerCase() === w))) || null;
  }
  function pantryTables() { return SIG.PANTRY; }
  function tablesIn(src) {
    const env = { schemas: new Set(BASE_SCHEMAS.concat(['dbo'])) }; const toks = resolveNames(tokenize(src), env);
    const out = []; toks.forEach(t => { if (t.tbl && META.tables[t.v.toLowerCase()] && !out.includes(META.tables[t.v.toLowerCase()].name)) out.push(META.tables[t.v.toLowerCase()].name); });
    return out;
  }
  function explainError(e, src, env) {
    const msg = String(e.message || e);
    const at = e.at ? { start: e.at.p, end: e.at.e } : null;
    let m;
    if (e instanceof Unsupported) return { slip: 'unsupported', msg, at };
    if (e.slip) return { slip: e.slip, msg, at };
    if ((m = /no such table: (.+)$/.exec(msg))) {
      const raw = m[1].replace(/^main\./, ''); const low = raw.toLowerCase(); const tk = findTok(src, raw.includes('.') ? raw.split('.').pop() : raw);
      const short = low.includes('.') ? low.split('.')[1] : low;
      const real = pantryTables().find(t => t.name.split('.')[1].toLowerCase() === short);
      if (real && !low.includes('.')) return { slip: 'schema', pantry: true, msg: `In CelestiaRetailLab, ${real.name.split('.')[1]} lives in the ${real.name.split('.')[0]} schema, so write it as ${real.name}.`, at: tk && { start: tk.p, end: tk.e } };
      if (real) return { slip: 'schema', pantry: true, msg: `There’s no ${raw} in the Pantry. ${real.name.split('.')[1]} lives in the ${real.name.split('.')[0]} schema, so write it as ${real.name}.`, at: tk && { start: tk.p, end: tk.e } };
      const near = pantryTables().map(t => t.name).concat(env ? env.created.map(c => c.name) : []).find(n => lev(n.split('.').pop(), short.split('.').pop()) <= 2);
      return { slip: 'table', pantry: true, msg: near ? `There’s no table called ${raw}. Did you mean ${near}?` : `There’s no table called ${raw} in the Pantry. Peek inside to see what’s on the shelves.`, at: tk && { start: tk.p, end: tk.e } };
    }
    if ((m = /no such column: (.+)$/.exec(msg)) || (m = /has no column named (.+)$/.exec(msg))) {
      const col = m[1].split('.').pop(), tk = findTok(src, col);
      const tbls = tablesIn(src).map(n => META.tables[n.toLowerCase()]);
      const all = tbls.flatMap(t => t.cols.map(c => ({ c: c.name, t: t.name })));
      const near = all.map(x => ({ x, d: lev(x.c, col) })).filter(x => x.d <= 2).sort((a, b) => a.d - b.d)[0];
      if (near) return { slip: 'column', pantry: true, msg: `There’s no column called ${col} in ${near.x.t}. Did you mean ${near.x.c}?`, at: tk && { start: tk.p, end: tk.e } };
      const syn = SIG.SYNONYMS[col.toLowerCase()];
      if (syn) { const t = tbls.find(x => syn[x.name]) ; if (t && !/^no /.test(syn[t.name])) return { slip: 'column', pantry: true, msg: `There’s no column called ${col} in ${t.name}. It’s stored as ${syn[t.name]}.`, at: tk && { start: tk.p, end: tk.e } }; if (t) return { slip: 'column', pantry: true, msg: `There’s ${syn[t.name]}.`, at: tk && { start: tk.p, end: tk.e } }; }
      const elsewhere = Object.values(META.tables).find(t => t.cols.some(c => c.name.toLowerCase() === col.toLowerCase()) && !tbls.includes(t));
      if (elsewhere) return { slip: null, concept: 'needs-table', pantry: true, msg: `${col} isn’t in ${tbls.map(t => t.name).join(' or ') || 'the tables you used'}. It lives in ${elsewhere.name}, so that table needs to come into the query.`, at: tk && { start: tk.p, end: tk.e } };
      if (tbls.length === 1) return { slip: 'column', pantry: true, msg: `There’s no column called ${col} in ${tbls[0].name}. Its columns are ${tbls[0].cols.map(c => c.name).join(', ')}.`, at: tk && { start: tk.p, end: tk.e } };
      return { slip: 'column', pantry: true, msg: `SQL Server doesn’t recognise ${col} as a column here. If it’s a nickname from SELECT, remember WHERE runs before SELECT and can’t see it yet.`, at: tk && { start: tk.p, end: tk.e } };
    }
    if ((m = /ambiguous column name: (.+)$/.exec(msg))) { const col = m[1].split('.').pop(), tk = findTok(src, col); return { slip: 'ambiguous', msg: `${col} is in more than one of your tables, so SQL Server can’t tell which one you mean. Put the table’s nickname in front, like o.${col}.`, at: tk && { start: tk.p, end: tk.e } }; }
    if ((m = /near "(.+?)": syntax error/.exec(msg))) {
      const typo = tokenize(src).find(t => t.t === 'id' && !t.q && !KW.has(t.u) && !META.allCols[t.v.toLowerCase()] && t.v.length > 2 && SQL_WORDS.some(k => lev(k, t.v) <= (t.v.length > 4 ? 2 : 1) && k !== t.u && !/^(AS|ON|BY|IN)$/.test(k)));
      if (typo) { const kw = SQL_WORDS.filter(k => k !== typo.u).map(k => ({ k, d: lev(k, typo.v) })).sort((a, b) => a.d - b.d)[0].k; return { slip: 'keyword', msg: `Looks like “${typo.v}” should be ${kw}.`, at: { start: typo.p, end: typo.e } }; }
      const w = m[1].replace(/^"|"$/g, ''); const tk = w === 'LIMIT' ? findTok(src, 'TOP') : findTok(src, w);
      const kw = SQL_WORDS.find(k => w.length > 2 && lev(k, w) <= (w.length > 4 ? 2 : 1) && k !== w.toUpperCase());
      if (kw) return { slip: 'keyword', msg: `Looks like “${w}” should be ${kw}.`, at: tk && { start: tk.p, end: tk.e } };
      const before = tk ? prevWord(src, tk) : null;
      if (before && /^(FROM|WHERE|JOIN|ON|BY|SELECT|AND|OR|=|,)$/i.test(before.v)) return { slip: 'syntax', msg: `Something is missing between “${before.v}” and “${w}”.`, at: tk && { start: before.p, end: tk.e } };
      if (w === ')' ) return { slip: 'syntax', msg: 'There’s an extra closing bracket here, or something missing just before it.', at: tk && { start: tk.p, end: tk.e } };
      if (w === ',') return { slip: 'syntax', msg: 'There’s a comma here with nothing after it, or one too many.', at: tk && { start: tk.p, end: tk.e } };
      return { slip: 'syntax', msg: `SQL Server stops near “${w}”. Something just before it is missing or out of place.`, at: tk && { start: tk.p, end: tk.e } };
    }
    if (/incomplete input/.test(msg)) return { slip: 'syntax', msg: 'The query ends before it’s finished. Check for a missing closing bracket, or a clause with nothing after it.', at: null };
    if ((m = /misuse of aggregate(?: function)?: (\w+)/.exec(msg))) { const tk = findTok(src, m[1]); return { slip: null, concept: 'agg-where', msg: `${m[1].toUpperCase()} works on piles of rows, but WHERE looks at one row at a time, before any piles exist. To filter on a total, use HAVING after GROUP BY.`, at: tk && { start: tk.p, end: tk.e } }; }
    if (/a GROUP BY clause is required before HAVING/.test(msg)) { const tk = findTok(src, 'HAVING'); return { slip: null, concept: 'having-no-group', msg: 'HAVING filters piles, so it needs a GROUP BY before it. For single rows, use WHERE.', at: tk && { start: tk.p, end: tk.e } }; }
    if ((m = /no such function: (\w+)/.exec(msg))) { const tk = findTok(src, m[1]); const known = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'UPPER', 'LOWER', 'ROUND', 'YEAR', 'MONTH', 'DATEADD', 'DATEDIFF', 'COALESCE', 'ISNULL', 'LEN', 'TRIM', 'REPLACE', 'SUBSTRING', 'CONCAT', 'GETDATE', 'CAST', 'CONVERT', 'RANK', 'ROW_NUMBER', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD'].find(k => lev(k, m[1]) <= 2); return { slip: 'function', msg: known ? `There’s no function called ${m[1]}. Did you mean ${known}?` : `SQL Server doesn’t have a function called ${m[1]}.`, at: tk && { start: tk.p, end: tk.e } }; }
    if ((m = /wrong number of arguments to function (\w+)/.exec(msg))) { const tk = findTok(src, m[1].replace(/^t_/, '')); return { slip: 'args', msg: `${m[1].replace(/^t_/, '').toUpperCase()} has the wrong number of values inside its brackets.`, at: tk && { start: tk.p, end: tk.e } }; }
    if (/do not have the same number of result columns/.test(msg)) { const tk = findTok(src, 'UNION') || findTok(src, 'EXCEPT') || findTok(src, 'INTERSECT'); return { slip: 'union', msg: 'Both halves of the stack need the same number of columns, in the same order.', at: tk && { start: tk.p, end: tk.e } }; }
    if ((m = /(\d+) values for (\d+) columns|has (\d+) columns but (\d+) values were supplied/.exec(msg))) { const tk = findTok(src, 'VALUES'); return { slip: 'values', msg: 'The number of values doesn’t match the number of columns you listed.', at: tk && { start: tk.p, end: tk.e } }; }
    if ((m = /(UNIQUE|PRIMARY KEY) constraint failed: (.+)$/.exec(msg))) return { slip: null, concept: 'duplicate-key', msg: `That would create a duplicate key in ${m[2].replace(/"/g, '')}. Each key value can only appear once.`, at: null };
    if ((m = /NOT NULL constraint failed: (.+)$/.exec(msg))) return { slip: 'not-null', msg: `${m[1].replace(/"/g, '').split('.').pop()} can’t be left empty (it’s NOT NULL), so it needs a value.`, at: null };
    if (/already exists/.test(msg)) return { slip: 'exists', msg: msg.replace(/^table "?(.+?)"? already exists$/, 'There is already a table called $1. Drop it first, or use a new name.'), at: null };
    if (/unrecognized token: "(.+)"/.test(msg)) { const w = /unrecognized token: "(.+)"/.exec(msg)[1]; const tk = findTok(src, w); return { slip: 'syntax', msg: `SQL Server doesn’t understand “${w}”. Check for a stray symbol or a missing quote.`, at: tk && { start: tk.p, end: tk.e } }; }
    return { slip: 'other', msg: msg.replace(/"(\w+)\.(\w+)"/g, '$1.$2'), at: null };
  }
  function prevWord(src, tk) { const toks = tokenize(src); const i = toks.findIndex(t => t.p === tk.p); return i > 0 ? toks[i - 1] : null; }

  // Static checks on how SQL Server would read the query (things SQLite lets slide).
  const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STRING_AGG', 'COUNT_BIG', 'STDEV', 'VAR', 'STDEVP', 'VARP']);
  function topLevel(ex) { const out = []; for (let i = 0; i < ex.length; i++) { if (isOp(ex[i], '(') && isKw(ex[i + 1], 'SELECT')) { i = match(ex, i); out.push(raw('0')); continue; } out.push(ex[i]); } return out; }
  function lint(src, env) {
    const notes = [];
    let toks; try { toks = resolveNames(tokenize(src), { schemas: env ? env.schemas : new Set(BASE_SCHEMAS.concat(['dbo'])) }); } catch (e) { return notes; }
    const sc = scopes(toks);
    const allCols = new Set(Object.values(META.tables).flatMap(t => t.cols.map(c => c.name.toLowerCase())));
    for (const s of sc) {
      const items = selectItems(toks, s);
      const aliases = items.filter(it => it.toks.some(t => isKw(t, 'AS')) || (it.toks[0] && it.toks[0].t === 'id' && isOp(it.toks[1], '='))).map(it => it.name.toLowerCase());
      // nickname used in WHERE / GROUP BY / HAVING
      [['where', 'WHERE'], ['group', 'GROUP BY'], ['having', 'HAVING']].forEach(([k, label]) => {
        if (s[k] === undefined) return;
        const end = [s.where, s.group, s.having, s.order, s.end].filter(x => x !== undefined && x > s[k]).sort((a, b) => a - b)[0];
        let d = 0;
        for (let i = s[k] + 1; i < end; i++) {
          const t = toks[i]; if (isOp(t, '(')) d++; if (isOp(t, ')')) d--;
          if (isKw(t, 'SELECT')) break;
          if (t.t === 'id' && !t.tbl && !isOp(toks[i - 1], '.') && !isOp(toks[i + 1], '.') && !isOp(toks[i + 1], '(') && aliases.includes(t.v.toLowerCase()) && !allCols.has(t.v.toLowerCase()))
            notes.push({ slip: 'alias-order', msg: `SQL Server reads ${label} before SELECT, so it doesn’t know the nickname “${t.v}” yet. Repeat the calculation itself in ${label}${k === 'where' ? ', or wrap the query in a CTE' : ''}.`, at: { start: t.p, end: t.e } });
        }
      });
      // a plain column next to totals, but not grouped
      const hasAgg = items.some(it => { const ex = topLevel(it.expr); return ex.some((t, i) => t.t === 'id' && AGG.has(t.u) && isOp(ex[i + 1], '(') && !ex.some(x => isKw(x, 'OVER'))); });
      if (s.group !== undefined || hasAgg) {
        const gEnd = [s.having, s.order, s.end].filter(x => x !== undefined && x > (s.group || 0)).sort((a, b) => a - b)[0];
        const groups = s.group !== undefined ? splitTop(toks.slice(s.group + 2, gEnd)).map(g => emit(g).toLowerCase().replace(/\s+/g, '').replace(/^\w+\./, '')) : [];
        const gcols = new Set(s.group !== undefined ? toks.slice(s.group + 2, gEnd).filter(t => t.t === 'id').map(t => t.v.toLowerCase()) : []);
        items.forEach(it => {
          const ex = topLevel(it.expr); if (!ex.length) return;
          if (ex.some((t, i) => t.t === 'id' && AGG.has(t.u) && isOp(ex[i + 1], '('))) return;
          if (ex.some(t => isKw(t, 'OVER'))) return;
          if (ex.length === 1 && (ex[0].t === 'num' || ex[0].t === 'str' || isOp(ex[0], '*') && s.group === undefined)) { if (isOp(ex[0], '*')) notes.push({ concept: 'not-grouped', msg: 'SELECT * can’t sit next to a total. Name the columns you’re grouping by instead.', at: { start: ex[0].p, end: ex[0].e } }); return; }
          const txt = emit(ex).toLowerCase().replace(/\s+/g, '').replace(/^\w+\./, '');
          if (groups.includes(txt)) return;
          const cols = ex.filter((t, i) => t.t === 'id' && !isOp(ex[i + 1], '(') && !isOp(ex[i + 1], '.') && !KW.has(t.u) && !t.tbl);
          if (cols.length && cols.every(c => gcols.has(c.v.toLowerCase()))) return;
          if (!cols.length) return;
          const bad = cols.find(c => !gcols.has(c.v.toLowerCase())) || cols[0];
          notes.push({ concept: 'not-grouped', msg: s.group !== undefined ? `${bad.v} is in SELECT but isn’t in GROUP BY or inside a total, so SQL Server won’t know which value to show for each pile. Add it to GROUP BY, or wrap it in a total like MAX().` : `${bad.v} sits next to a total, but there’s no GROUP BY. SQL Server needs to know the piles: add GROUP BY ${bad.v}.`, at: { start: bad.p, end: bad.e } });
        });
      }
      // a missing comma: SELECT CustomerName City
      items.forEach(it => {
        const t = it.toks; if (t.length !== 2 || t[0].t !== 'id' || t[1].t !== 'id' || KW.has(t[1].u)) return;
        if (allCols.has(t[1].v.toLowerCase())) notes.push({ slip: 'comma', soft: true, msg: `Looks like a comma is missing between ${t[0].v} and ${t[1].v}. Without it, SQL Server treats ${t[1].v} as a nickname for ${t[0].v}.`, at: { start: t[0].e, end: t[1].e } });
      });
    }
    // = NULL never matches
    toks.forEach((t, i) => { if ((isOp(t, '=') || isOp(t, '<>') || isOp(t, '!=')) && isKw(toks[i + 1], 'NULL') && !isKw(toks[i - 2], 'SET') && !(toks[i - 1] && toks[i - 1].t === 'var')) notes.push({ concept: 'eq-null', soft: true, msg: `${t.v} NULL is never true, because NULL means “unknown”. To find missing values, write IS ${t.v === '=' ? '' : 'NOT '}NULL.`, at: { start: t.p, end: toks[i + 1].e } }); });
    return notes;
  }

  // A text value in WHERE that isn't in the data, e.g. City = 'Austn'
  function valueSlips(src) {
    const out = []; const toks = tokenize(src);
    toks.forEach((t, i) => {
      if (t.t !== 'str') return;
      let colTok = null;
      if (isOp(toks[i - 1], '=') || isOp(toks[i - 1], '<>') || isOp(toks[i - 1], '!=')) colTok = toks[i - 2];
      else { let k = i - 1; while (k > 0 && (toks[k].t === 'str' || isOp(toks[k], ','))) k--; if (isOp(toks[k], '(') && isKw(toks[k - 1], 'IN')) colTok = toks[k - 2]; }
      if (!colTok || colTok.t !== 'id') return;
      const vals = META.values[colTok.v.toLowerCase()]; if (!vals) return;
      if (vals.some(v => v.toLowerCase() === t.v.toLowerCase())) return;
      const near = vals.map(v => ({ v, d: lev(v, t.v) })).sort((a, b) => a.d - b.d)[0];
      if (near && near.d <= Math.max(2, Math.floor(t.v.length / 4))) out.push({ slip: 'value', msg: `There’s no ${colTok.v} called '${t.v}' in the data. Did you mean '${near.v}'?`, at: { start: t.p, end: t.e } });
    });
    return out;
  }

  // ───────────────────────── grading
  // spec: { sol, checks?: [...], after?: [...], order?: true|false }
  const close = r => { try { r && r.env && r.env.db && r.env.db.close(); } catch (e) {} };
  function grade(user, spec) {
    const out = { refRun: null, userRun: null };
    try { return gradeInner(user, spec, out); } finally { close(out.refRun); close(out.userRun); }
  }
  function gradeInner(user, spec, out) {
    const ref = out.refRun = run(spec.sol, { after: spec.after, before: spec.before });
    if (ref.error) return { status: 'error', msg: 'The reference answer didn’t run: ' + ref.error.message };
    const u = out.userRun = run(user, { after: spec.after, before: spec.before });
    const notes = lint(user, u.env);
    const hard = notes.filter(n => n.slip && !n.soft);
    if (u.error) {
      const ex = explainError(u.error, user, u.env);
      if (ex.slip) return { status: 'slip', key: ex.slip, msg: ex.msg, at: ex.at, pantry: !!ex.pantry };
      return { status: 'wrong', key: ex.concept || 'error', note: ex.msg, at: ex.at, pantry: !!ex.pantry, error: true, why: ex.msg };
    }
    const concepts = notes.filter(n => n.concept && !n.soft);
    if (hard.length) return Object.assign({ status: 'slip', key: hard[0].slip }, hard[0]);
    if (concepts.length) return { status: 'wrong', key: concepts[0].concept, note: concepts[0].msg, at: concepts[0].at, why: concepts[0].msg };
    const checks = spec.checks && spec.checks.length ? spec.checks : [{ kind: 'last' }];
    for (const c of checks) {
      const r = runCheck(c, ref.env, u.env, spec, user);
      if (r.ok) continue;
      // turn a near-miss into a slip
      if (r.kind === 'extra-cols') return { status: 'slip', key: 'extra-cols', msg: `Everything you need is there, plus ${r.extra.length === 1 ? 'an extra column' : 'some extra columns'} (${r.extra.join(', ')}) the request didn’t ask for. Trim the SELECT list to just what was asked.`, at: atSelect(user) };
      if (r.kind === 'order') return { status: 'slip', key: 'order', msg: `The rows are right, just in the wrong order. The request wants them ${r.desc ? 'highest (or newest) first, so sort with DESC' : 'lowest (or A to Z) first'}${r.col ? ` by ${r.col}` : ''}.`, at: atOrder(user) };
      const soft = notes.filter(n => n.soft && n.slip);
      if (soft.length) return Object.assign({ status: 'slip', key: soft[0].slip }, soft[0]);
      const vs = valueSlips(user); if (vs.length) return Object.assign({ status: 'slip', key: 'value' }, vs[0]);
      const eqn = notes.find(n => n.concept === 'eq-null');
      return { status: 'wrong', key: r.kind, diff: r, why: describe(r, c), note: eqn ? eqn.msg : null, at: eqn ? eqn.at : null };
    }
    return { status: 'right', notes: notes.filter(n => n.soft && n.concept !== 'eq-null') };
  }
  function atSelect(src) { const t = findTok(src, 'SELECT'); return t ? { start: t.p, end: t.e } : null; }
  function atOrder(src) { const t = findTok(src, 'ORDER'); return t ? { start: t.p, end: t.e + 3 } : atSelect(src); }
  function describe(r, c) {
    if (r.kind === 'missing-result') return 'Your query ran, but it didn’t show any rows to taste. Finish with a SELECT.';
    if (r.kind === 'count') {
      const more = r.got > r.exp;
      return `Your query brings back ${r.got} row${r.got === 1 ? '' : 's'}, but this request needs ${r.exp}. ${more ? 'That usually means a filter is missing, or a join is repeating rows.' : 'That usually means a filter is too strict, or an INNER JOIN is dropping rows that have no match.'}${r.missingCols && r.missingCols.length ? ` Also, the request needs ${r.missingCols.join(', ')}.` : ''}`;
    }
    if (r.kind === 'fewer-cols') return `Your query is missing ${r.missingCols.length ? r.missingCols.join(', ') : 'a column the request asked for'}.`;
    if (r.kind === 'values') return `You have the right number of rows, but some values differ${r.missingCols && r.missingCols.length ? `, in ${r.missingCols.join(', ')}` : ''}. Check the calculation or the filter.`;
    if (r.kind === 'table') return r.msg;
    if (r.kind === 'missing-object') return r.msg;
    return r.msg || 'The result doesn’t match what the request needs yet.';
  }
  function lastResult(env) { return env.results.length ? env.results[env.results.length - 1] : null; }
  function runCheck(c, re, ue, spec, user) {
    if (c.kind === 'last') {
      const e = lastResult(re), a = lastResult(ue);
      if (!a) return { ok: false, kind: 'missing-result' };
      const ok = orderKeys(spec.sol);
      return compareSets(e, a, { order: spec.ordered === false ? null : ok && !ok.unmapped ? ok.keys : null });
    }
    if (c.kind === 'rows') {
      const q = env => { try { const r = run2(env, c.sql); return r; } catch (e) { return { error: e }; } };
      const e = q(re), a = q(ue);
      if (a.error) return { ok: false, kind: 'missing-object', msg: c.missing || 'The table or view the request asked for isn’t there yet.' };
      return compareSets(e, a, {});
    }
    if (c.kind === 'table') {
      const info = env => { const r = env.db.exec(`PRAGMA table_info("${String(c.name).replace(/"/g, '')}")`); return r.length ? r[0].values.map(v => ({ name: v[1], type: v[2], nn: !!v[3], pk: !!v[5] })) : null; };
      const e = info(re), a = info(ue);
      if (!a) return { ok: false, kind: 'table', msg: `There’s no table called ${c.show || c.name} yet.` };
      const fam = t => { t = String(t).toUpperCase(); return /INT/.test(t) ? 'int' : /CHAR|TEXT/.test(t) ? 'text' : /DEC|NUM|MONEY/.test(t) ? 'dec' : /DATETIME|SMALLDATETIME/.test(t) ? 'datetime' : /DATE/.test(t) ? 'date' : /BIT/.test(t) ? 'bit' : t; };
      for (const col of e) {
        const x = a.find(y => y.name.toLowerCase() === col.name.toLowerCase());
        if (!x) return { ok: false, kind: 'table', msg: `The table needs a column called ${col.name}.` };
        if (fam(x.type) !== fam(col.type)) return { ok: false, kind: 'table', msg: `${col.name} should be a ${col.type} column, not ${x.type}.` };
        if (col.pk && !x.pk) return { ok: false, kind: 'table', msg: `${col.name} should be the PRIMARY KEY.` };
        if (col.nn && !col.pk && !x.nn) return { ok: false, kind: 'table', msg: `${col.name} should be NOT NULL.` };
      }
      if (a.length > e.length) return { ok: false, kind: 'table', msg: `The table has ${a.length - e.length === 1 ? 'a column' : 'columns'} the request didn’t ask for: ${a.filter(x => !e.some(y => y.name.toLowerCase() === x.name.toLowerCase())).map(x => x.name).join(', ')}.` };
      return { ok: true };
    }
    if (c.kind === 'index') {
      const find = env => env.indexes.filter(x => x.table.toLowerCase() === String(c.table).toLowerCase());
      const e = find(re)[0], as = find(ue);
      if (!as.length) return { ok: false, kind: 'table', msg: `There’s no index on ${c.table} yet.` };
      const a = as[as.length - 1];
      if (e.clustered !== a.clustered) return { ok: false, kind: 'table', msg: `This one should be a ${e.clustered ? 'CLUSTERED' : 'NONCLUSTERED'} index.` };
      const ek = e.keys.map(k => k.col.toLowerCase()), ak = a.keys.map(k => k.col.toLowerCase());
      if (ek.join() !== ak.join()) return { ok: false, kind: 'table', msg: ek.length > 1 && ek.slice().sort().join() === ak.slice().sort().join() ? `The right columns, but the order matters: put ${e.keys[0].col} first, because it’s the one filtered most.` : `The index should be keyed on ${e.keys.map(k => k.col).join(', ')}.` };
      const ei = e.include.map(x => x.toLowerCase()).sort().join(), ai = a.include.map(x => x.toLowerCase()).sort().join();
      if (ei !== ai) return { ok: false, kind: 'table', msg: e.include.length ? `To cover the query, INCLUDE (${e.include.join(', ')}).` : 'This index doesn’t need an INCLUDE list.' };
      if (!!e.unique !== !!a.unique) return { ok: false, kind: 'table', msg: e.unique ? 'This index should be UNIQUE.' : 'This index shouldn’t be UNIQUE.' };
      return { ok: true };
    }
    if (c.kind === 'partition') {
      const e = Object.values(re.partitions), a = Object.values(ue.partitions);
      const ef = e.find(x => x.kind === 'function'), af = a.find(x => x.kind === 'function');
      if (ef && !af) return { ok: false, kind: 'table', msg: 'There’s no partition function yet.' };
      if (ef) {
        if (ef.side !== af.side) return { ok: false, kind: 'table', msg: `Use RANGE ${ef.side}, so each boundary date starts ${ef.side === 'RIGHT' ? 'a new' : 'the end of a'} partition.` };
        const nv = v => (toDate(v) ? fmt(toDate(v).d, false) : String(v));
        if (ef.values.map(nv).join() !== af.values.map(nv).join()) return { ok: false, kind: 'table', msg: `The boundary values should be ${ef.values.map(v => `'${v}'`).join(', ')}.` };
      }
      const es = e.find(x => x.kind === 'scheme'), as = a.find(x => x.kind === 'scheme');
      if (es && !as) return { ok: false, kind: 'table', msg: 'The function is ready. Now a partition scheme needs to use it.' };
      if (es && af && String(as.fn).toLowerCase() !== String(af.name).toLowerCase()) return { ok: false, kind: 'table', msg: `The scheme should be AS PARTITION ${af.name}.` };
      return { ok: true };
    }
    if (c.kind === 'pattern') { const toks = tokenize(user); const hit = new RegExp(c.re, 'i').test(toks.filter(t => t.t !== 'str').map(t => t.v).join(' ')); return hit ? { ok: true } : { ok: false, kind: 'table', msg: c.msg }; }
    if (c.kind === 'option') { return ue.options[c.name] ? { ok: true } : { ok: false, kind: 'table', msg: c.msg || `Turn on ${c.name} first.` }; }
    if (c.kind === 'schemas') { const miss = c.names.filter(n => !ue.created.some(x => x.kind === 'schema' && x.name.toLowerCase() === n.toLowerCase())); return miss.length ? { ok: false, kind: 'table', msg: `The ${miss.join(' and ')} schema${miss.length > 1 ? 's are' : ' is'} still missing.` } : { ok: true }; }
    if (c.kind === 'sargable') { const bad = sargIssue(user); return bad ? Object.assign({ ok: false, kind: 'table' }, bad) : { ok: true }; }
    if (c.kind === 'noStar') { const t = findTok(user, '*'); const toks = tokenize(user); const star = toks.find((x, i) => isOp(x, '*') && (isKw(toks[i - 1], 'SELECT') || isOp(toks[i - 1], ',') || (isOp(toks[i - 1], '.') ))); return star ? { ok: false, kind: 'table', msg: 'Name just the columns you need instead of *. Fewer columns means less to read.' } : { ok: true }; }
    return { ok: true };
  }
  function run2(env, sql) {
    const toks = tokenize(sql); const list = parseBlock(toks, 0).list; const before = env.results.length;
    runList(list, env); const r = env.results.slice(before).pop(); env.results.length = before; if (!r) throw new Error('no result'); return r;
  }
  function sargIssue(src) {
    const toks = tokenize(src); const sc = scopes(toks);
    for (const s of sc) {
      if (s.where === undefined) continue;
      const end = [s.group, s.having, s.order, s.end].filter(x => x !== undefined && x > s.where).sort((a, b) => a - b)[0];
      for (let i = s.where + 1; i < end; i++) {
        const t = toks[i];
        if (t.t === 'id' && isOp(toks[i + 1], '(') && /^(YEAR|MONTH|DAY|DATEPART|CAST|CONVERT|UPPER|LOWER|LTRIM|RTRIM|TRIM|LEFT|SUBSTRING|ISNULL|COALESCE|DATEDIFF|FORMAT)$/i.test(t.v)) {
          const c = match(toks, i + 1); const inner = toks.slice(i + 2, c);
          if (inner.some(x => x.t === 'id' && META.allCols[x.v.toLowerCase()])) {
            const col = inner.find(x => x.t === 'id' && META.allCols[x.v.toLowerCase()]);
            return { msg: `${t.v.toUpperCase()}(${col.v}) wraps the column in a function, so SQL Server has to work it out for every row and can’t use an index. Compare the bare column to a range instead, like ${col.v} >= '2025-01-01' AND ${col.v} < '2026-01-01'.`, at: { start: t.p, end: toks[c].e } };
          }
        }
        if (isKw(t, 'LIKE') && toks[i + 1] && toks[i + 1].t === 'str' && /^%/.test(toks[i + 1].v)) return { msg: `A pattern that starts with % (like '${toks[i + 1].v}') can’t use an index, because the start of the value is unknown. If you can, match the start instead.`, at: { start: t.p, end: toks[i + 1].e } };
      }
    }
    return null;
  }

  // ───────────────────────── tools used in a query (for gentle notes)
  function detectTools(src) {
    const toks = tokenize(src); const u = toks.filter(t => t.t === 'id' && !t.q).map(t => t.u); const has = w => u.includes(w); const set = new Set();
    const fnCall = w => toks.some((t, i) => t.t === 'id' && t.u === w && isOp(toks[i + 1], '('));
    if (has('SELECT')) set.add('d02');
    if (has('DISTINCT') && !toks.some((t, i) => isKw(t, 'DISTINCT') && isOp(toks[i - 1], '('))) set.add('d03a');
    if (has('TOP') || (has('ORDER') && !has('OVER'))) set.add('d03b');
    if (/\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|\bDROP\s+TABLE\b/i.test(src)) set.add('d04');
    if (has('INSERT') || has('UPDATE') || (has('DELETE'))) set.add('d05');
    if (has('WHERE')) set.add('d06');
    if (has('BETWEEN') || has('LIKE') || (has('IN') && toks.some((t, i) => isKw(t, 'IN') && isOp(toks[i + 1], '(') && !isKw(toks[i + 2], 'SELECT'))) || (has('IS') && has('NULL'))) set.add('d07');
    if (has('JOIN') && !has('LEFT') && !has('RIGHT') && !has('FULL')) set.add('d08');
    if (has('LEFT') && has('JOIN') || has('RIGHT') && has('JOIN') || has('FULL') && has('JOIN')) set.add('d09');
    if (has('UNION') || has('EXCEPT') || has('INTERSECT')) set.add('d10');
    if (['UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'LEFT', 'RIGHT', 'SUBSTRING', 'LEN', 'REPLACE', 'ROUND', 'ABS', 'CONCAT', 'CHARINDEX'].some(fnCall)) set.add('d11');
    if (['YEAR', 'MONTH', 'DAY', 'DATEPART', 'DATENAME', 'EOMONTH', 'DATEFROMPARTS'].some(fnCall)) set.add('d12');
    if (['DATEADD', 'DATEDIFF'].some(fnCall) || (fnCall('CAST') && /AS\s+DATE/i.test(src)) || fnCall('CONVERT')) set.add('d13');
    if (['ISNULL', 'COALESCE', 'NULLIF'].some(fnCall)) set.add('d15');
    if (has('CASE') || fnCall('IIF')) set.add('d16a');
    if (has('GROUP') || has('HAVING') || ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].some(w => toks.some((t, i) => t.u === w && isOp(toks[i + 1], '(') && !overAfter(toks, i)))) set.add('d16b');
    if (has('OVER')) {
      set.add('d17');
      if (['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].some(w => toks.some((t, i) => t.u === w && overAfter(toks, i)))) set.add('d18');
      if (has('ROWS') || has('RANGE') || toks.some((t, i) => t.u === 'SUM' && overAfter(toks, i) && (() => { const o = match(toks, i + 1) + 2; const c = match(toks, o); return toks.slice(o, c).some(x => isKw(x, 'ORDER')); })())) set.add('d19');
      if (['ROW_NUMBER', 'RANK', 'DENSE_RANK'].some(fnCall)) set.add('d20');
      if (fnCall('NTILE')) set.add('d21');
      if (fnCall('LAG') || fnCall('LEAD')) set.add('d22');
      if (fnCall('FIRST_VALUE') || fnCall('LAST_VALUE')) set.add('d23');
    }
    if (toks.some((t, i) => isKw(t, 'SELECT') && isOp(toks[i - 1], '(') && !isKw(toks[i - 2], 'EXISTS') && !isKw(toks[i - 2], 'AS'))) set.add('d24');
    if (toks.some((t, i) => isKw(t, 'EXISTS') && !isKw(toks[i - 1], 'IF'))) set.add('d25');
    if (has('WITH') && toks.some((t, i) => isKw(t, 'AS') && isOp(toks[i + 1], '(') && isKw(toks[i + 2], 'SELECT'))) set.add('d26');
    if (/\b(CREATE|ALTER)\s+(OR\s+ALTER\s+)?VIEW\b/i.test(src)) set.add('d28');
    if (/\bINTO\s+#/i.test(src) || toks.some(t => t.t === 'tmp')) set.add('d30');
    if (/\bCREATE\s+(OR\s+ALTER\s+)?PROC/i.test(src)) set.add('d32');
    if (/\bCREATE\s+(OR\s+ALTER\s+)?TRIGGER/i.test(src)) set.add('d33');
    if (/\bINDEX\b/i.test(src)) set.add(/INCLUDE|\(\s*\w+\s*,/i.test(src) ? 'd35' : 'd34');
    if (/STATISTICS\s+(IO|TIME)/i.test(src)) set.add('d36');
    if (/PARTITION\s+(FUNCTION|SCHEME)/i.test(src)) set.add('d37');
    if (/CREATE\s+SCHEMA/i.test(src)) set.add('d41');
    if (/\b(bronze|silver)\./i.test(src)) set.add('d43');
    if (/\bgold\.(dim|fact)_/i.test(src)) set.add('d46');
    return set;
  }
  function overAfter(toks, i) { if (!isOp(toks[i + 1], '(')) return false; const c = match(toks, i + 1); return isKw(toks[c + 1], 'OVER'); }

  // ───────────────────────── the query, explained line by line
  function human(toks) {
    let s = emit(toks.map(t => (t.tbl ? Object.assign({}, t, { q: false, v: t.orig || t.v }) : t)));
    return s.replace(/"(\w+)\.(\w+)"/g, '$1.$2');
  }
  function sayCond(s) {
    return s.replace(/\bIS NOT NULL\b/gi, 'has a value').replace(/\bIS NULL\b/gi, 'is missing').replace(/\s>=\s/g, ' is at least ').replace(/\s<=\s/g, ' is at most ').replace(/\s<>\s|\s!=\s/g, ' isn’t ')
      .replace(/\s>\s/g, ' is more than ').replace(/\s<\s/g, ' is less than ').replace(/\s=\s/g, ' is ').replace(/\bNOT LIKE\s+'%(.+?)%'/gi, 'doesn’t contain “$1”').replace(/\bLIKE\s+'%(.+?)%'/gi, 'contains “$1”').replace(/\bLIKE\s+'(.+?)%'/gi, 'starts with “$1”')
      .replace(/\bLIKE\s+'%(.+?)'/gi, 'ends with “$1”').replace(/\bNOT IN\b/gi, 'isn’t one of').replace(/\bIN\b/g, 'is one of').replace(/\bBETWEEN\b/gi, 'is between');
  }
  function explainLine(line, ctx) {
    const t = line.trim(), u = t.toUpperCase();
    const toks = tokenize(t);
    const tables = SIG.PANTRY;
    const about = nm => { const x = tables.find(p => p.name.toLowerCase() === nm.toLowerCase()); return x ? x.name : nm; };
    const fnNotes = [];
    const fnSay = { 'COUNT(*)': 'COUNT(*) counts the rows', 'COUNT(DISTINCT': 'COUNT(DISTINCT …) counts each different value once', 'SUM(': 'SUM adds the values up', 'AVG(': 'AVG takes the average', 'MIN(': 'MIN finds the smallest', 'MAX(': 'MAX finds the largest', 'ROUND(': 'ROUND tidies the decimals', 'ROW_NUMBER()': 'ROW_NUMBER numbers the rows 1, 2, 3…', 'DENSE_RANK()': 'DENSE_RANK ranks with no gaps after ties', ' RANK()': 'RANK gives ties the same number, then skips', 'NTILE(': 'NTILE splits the rows into equal groups', 'LAG(': 'LAG reads the value from the row before', 'LEAD(': 'LEAD reads the value from the row after', 'FIRST_VALUE(': 'FIRST_VALUE picks the first value in each window', 'LAST_VALUE(': 'LAST_VALUE picks the last value in each window', 'DATEADD(': 'DATEADD moves a date forward or back', 'DATEDIFF(': 'DATEDIFF counts the time between two dates', 'GETDATE()': 'GETDATE() is today', 'YEAR(': 'YEAR pulls out the year', 'MONTH(': 'MONTH pulls out the month number', 'DATENAME(': 'DATENAME gives the name, like “March”', 'DATEPART(': 'DATEPART pulls out one part of the date', 'ISNULL(': 'ISNULL swaps a missing value for a stand-in', 'COALESCE(': 'COALESCE takes the first value that isn’t missing', 'NULLIF(': 'NULLIF turns a value into NULL', 'UPPER(': 'UPPER makes capitals', 'LOWER(': 'LOWER makes small letters', 'TRIM(': 'TRIM removes spaces at the ends', 'LEN(': 'LEN counts characters', 'LEFT(': 'LEFT keeps the first few characters', 'SUBSTRING(': 'SUBSTRING cuts out a piece of text', 'REPLACE(': 'REPLACE swaps one bit of text for another', 'CAST(': 'CAST changes the type', 'CONVERT(': 'CONVERT changes the type (and can format dates)', 'DATEFROMPARTS(': 'DATEFROMPARTS builds a date from year, month and day', 'STRING_AGG(': 'STRING_AGG joins values into one line', 'EOMONTH(': 'EOMONTH finds the last day of the month', 'CONCAT(': 'CONCAT joins text together', 'IIF(': 'IIF picks one of two values' };
    Object.keys(fnSay).forEach(k => { if (u.includes(k)) fnNotes.push(fnSay[k]); });
    const extra = fnNotes.length ? ' ' + fnNotes.slice(0, 2).join('; ') + '.' : '';
    const nick = (() => { const m = /\bAS\s+(\[[^\]]+\]|\w+)\s*,?$/i.exec(t); return m ? ` and calls it ${m[1]}` : ''; })();
    let m;
    if ((m = /^(?:;?WITH|,)\s*(\w+)\s+AS\s*\($/i.exec(t))) return `Name a step “${m[1]}” so the next part can use it like a table.`;
    if (/^\)\s*,?$/.test(t)) return '';
    if (/^\)\s*(AS\s+)?\w+$/i.test(t)) return 'Close the inner query and give its result a name.';
    if (/^SELECT\b/i.test(t)) {
      const top = /TOP\s*\(\s*(\d+)\s*\)/i.exec(t); const dist = /^SELECT\s+DISTINCT/i.test(t);
      const body = t.replace(/^SELECT\s+(DISTINCT\s+)?(TOP\s*\(\s*\d+\s*\)\s*)?/i, '').replace(/,\s*$/, '');
      if (body === '*') return `Show every column${top ? `, but only the first ${top[1]} rows` : ''}.`;
      if (/^1$/.test(body)) return 'Inside EXISTS the columns don’t matter, so SELECT 1 is the usual shorthand.';
      return `Choose what to show${body && !/\($/.test(body) ? `: ${body.length > 60 ? 'these columns' : body}` : ''}${dist ? ', each combination only once' : ''}${top ? `, keeping just the first ${top[1]} rows` : ''}.${extra}`;
    }
    if ((m = /^FROM\s+([\w.#\[\]]+)(?:\s+(?:AS\s+)?(\w+))?/i.exec(t)) && !/\(/.test(t)) return `Start from ${about(m[1])}${m[2] && !/^(WHERE|GROUP|ORDER)$/i.test(m[2]) ? `, nicknamed ${m[2]}` : ''}.`;
    if (/^FROM\s*\($/i.test(t)) return 'Start from the result of an inner query (a table made on the fly).';
    if ((m = /^(INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+|FULL\s+(?:OUTER\s+)?|CROSS\s+)?JOIN\s+([\w.#\[\]]+)(?:\s+(?:AS\s+)?(\w+))?(?:\s+ON\s+(.+))?$/i.exec(t))) {
      const kind = (m[1] || '').trim().toUpperCase();
      const on = m[4] ? `, matching rows where ${m[4].replace(/\s*=\s*/g, ' equals ').replace(/\bAND\b/gi, 'and')}` : '';
      if (/^LEFT/.test(kind)) return `Bring in ${about(m[2])}${m[3] ? ` (as ${m[3]})` : ''}${on}, keeping every row from the left even when there’s no match.`;
      return `Bring in ${about(m[2])}${m[3] ? ` (as ${m[3]})` : ''}${on}. Only rows with a match on both sides stay.`;
    }
    if ((m = /^ON\s+(.+)$/i.exec(t))) return `Match the rows where ${m[1].replace(/\s*=\s*/g, ' equals ')}.`;
    if ((m = /^WHERE\s+(NOT\s+)?EXISTS/i.exec(t))) return m[1] ? 'Keep a row only if the inner query finds nothing for it.' : 'Keep a row only if the inner query finds at least one match for it.';
    if ((m = /^WHERE\s+(.+)$/i.exec(t))) return `Keep only the rows where ${sayCond(m[1])}.${extra}`;
    if ((m = /^(AND|OR)\s+(.+)$/i.exec(t))) return `${m[1].toUpperCase() === 'AND' ? 'And also' : 'Or'} where ${sayCond(m[2])}.`;
    if ((m = /^GROUP BY\s+(.+)$/i.exec(t))) return `Make one pile per ${m[1].replace(/,\s*$/, '')}.`;
    if ((m = /^HAVING\s+(.+)$/i.exec(t))) return `Keep only the piles where ${sayCond(m[1])}. HAVING filters after grouping.`;
    if ((m = /^ORDER BY\s+(.+?);?$/i.exec(t))) { const desc = /DESC/i.test(m[1]); return `Sort by ${m[1].replace(/\s+(ASC|DESC)\b/gi, '').replace(/;$/, '')}, ${desc ? 'highest (or newest) first' : 'lowest (or A to Z) first'}.`; }
    if (/^CASE$/i.test(t)) return 'Start a CASE: SQL Server checks each WHEN in order and uses the first that’s true.';
    if ((m = /^WHEN\s+(.+?)\s+THEN\s+(.+)$/i.exec(t))) return `When ${sayCond(m[1])}, use ${m[2]}.`;
    if ((m = /^ELSE\s+(.+)$/i.exec(t))) return `Anything else gets ${m[1]}.`;
    if ((m = /^END(?:\s+AS\s+(\w+))?/i.exec(t)) && !/\bEND\b.*\bEND\b/i.test(t)) return m[1] ? `Finish the CASE and call the new column ${m[1]}.` : 'Finish the block.';
    if (/OVER\s*\($/i.test(t) || /^OVER/i.test(t)) return `Open a window: the calculation looks at a set of rows but keeps every row.${extra}`;
    if ((m = /^PARTITION BY\s+(.+)$/i.exec(t))) return `Start the window over for each ${m[1].replace(/\s+ORDER BY.*/i, '')}${/ORDER BY/i.test(t) ? ', in order' : ''}.`;
    if (/^ROWS BETWEEN/i.test(t)) return 'Set exactly which rows the window adds up.';
    if ((m = /^(UNION ALL|UNION|EXCEPT|INTERSECT)$/i.exec(t))) return ({ 'UNION ALL': 'Stack the next result underneath, keeping duplicates.', UNION: 'Stack the next result underneath, removing duplicates.', EXCEPT: 'Keep only rows from the first result that aren’t in the next one.', INTERSECT: 'Keep only rows that appear in both results.' })[m[1].toUpperCase()];
    if ((m = /^INSERT INTO\s+([\w.#\[\]]+)/i.exec(t))) return `Add new rows to ${about(m[1])}${/\(/.test(t) ? ', filling these columns' : ''}.`;
    if (/^VALUES/i.test(t)) return 'The values for the new row, in the same order as the columns.';
    if ((m = /^UPDATE\s+([\w.#\[\]]+)/i.exec(t))) return `Change existing rows in ${about(m[1])}.`;
    if ((m = /^SET\s+(@\w+)/i.exec(t))) return `Give ${m[1]} its value.`;
    if ((m = /^SET\s+STATISTICS\s+(\w+)\s+ON/i.exec(t))) return `Ask SQL Server to report ${m[1].toUpperCase() === 'IO' ? 'how many pages it reads' : 'how long it takes'}.`;
    if ((m = /^SET\s+(.+)$/i.exec(t))) return `The new value: ${m[1].replace(/,\s*$/, '')}.`;
    if ((m = /^DELETE FROM\s+([\w.#\[\]]+)/i.exec(t))) return `Remove rows from ${about(m[1])}.`;
    if ((m = /^CREATE TABLE\s+([\w.#\[\]]+)/i.exec(t))) return `Create a new table called ${m[1]}.`;
    if ((m = /^\s*(\w+)\s+(INT|BIGINT|NVARCHAR|VARCHAR|CHAR|DECIMAL|DATE|DATETIME2?|BIT)\b(.*)$/i.exec(t))) return `${m[1]} holds ${({ INT: 'whole numbers', BIGINT: 'big whole numbers', NVARCHAR: 'text', VARCHAR: 'text', CHAR: 'fixed-length text', DECIMAL: 'money-style numbers', DATE: 'dates', DATETIME: 'dates with times', DATETIME2: 'dates with times', BIT: 'yes/no (1/0)' })[m[2].toUpperCase()]}${/PRIMARY KEY/i.test(m[3]) ? ' and is the primary key: one per row, never repeated' : ''}${/NOT NULL/i.test(m[3]) ? ', and can’t be left empty' : ''}${/IDENTITY/i.test(m[3]) ? ', numbering itself' : ''}${/DEFAULT/i.test(m[3]) ? ', with a default value' : ''}.`;
    if ((m = /^ALTER TABLE\s+([\w.#\[\]]+)\s+ADD\s+(.+)$/i.exec(t))) return `Add a new column to ${m[1]}: ${m[2].replace(/;$/, '')}.`;
    if ((m = /^ALTER TABLE/i.exec(t))) return 'Change the table’s structure.';
    if ((m = /^DROP\s+(TABLE|VIEW|INDEX|PROCEDURE|PROC)(?:\s+IF EXISTS)?\s+(.+?);?$/i.exec(t))) return `Remove the ${m[1].toLowerCase()} ${m[2]} (IF EXISTS keeps it from failing when it’s not there).`;
    if ((m = /^(?:CREATE|ALTER|CREATE OR ALTER)\s+VIEW\s+([\w.\[\]]+)/i.exec(t))) return `Save this query as a view called ${m[1]}, so anyone can SELECT from it like a table.`;
    if ((m = /^CREATE\s+(UNIQUE\s+)?(CLUSTERED|NONCLUSTERED)?\s*INDEX\s+(\w+)/i.exec(t))) return `Build ${m[2] ? (m[2].toUpperCase() === 'CLUSTERED' ? 'the clustered index (it sorts the table itself)' : 'a nonclustered index (a separate, sorted lookup list)') : 'an index'} called ${m[3]}.`;
    if ((m = /^ON\s+([\w.\[\]]+)\s*\((.+)\)/i.exec(t))) return `On ${m[1]}, sorted by ${m[2]}.`;
    if ((m = /^INCLUDE\s*\((.+)\)/i.exec(t))) return `Also carry ${m[1]} in the index, so the query never has to visit the table.`;
    if ((m = /^(?:CREATE|CREATE OR ALTER|ALTER)\s+(?:PROCEDURE|PROC)\s+([\w.\[\]]+)/i.exec(t))) return `Save a stored procedure called ${m[1]}: a query you can run again by name.`;
    if ((m = /^\s*(@\w+)\s+([\w()]+)/i.exec(t))) return `${m[1]} is a parameter: a value you hand in when you run it.`;
    if (/^AS$/i.test(t)) return 'Everything after AS is what it does.';
    if (/^BEGIN$/i.test(t)) return 'Begin the block of steps.';
    if ((m = /^EXEC\s+([\w.\[\]]+)/i.exec(t))) return `Run ${m[1]}${/@/.test(t) ? ' with these values' : ''}.`;
    if ((m = /^(?:CREATE|CREATE OR ALTER)\s+TRIGGER\s+([\w.\[\]]+)/i.exec(t))) return `Create a trigger called ${m[1]}: it runs by itself when the table changes.`;
    if ((m = /^ON\s+([\w.\[\]]+)\s+(AFTER|FOR|INSTEAD OF)\s+(.+)$/i.exec(t))) return `Watch ${m[1]} and run after every ${m[3].toLowerCase()}.`;
    if ((m = /^(?:CREATE|CREATE OR ALTER)\s+SCHEMA\s+(\w+)/i.exec(t))) return `Create the ${m[1]} schema: a labelled shelf to keep its tables together.`;
    if (/PARTITION FUNCTION/i.test(t)) return 'Define the partition function: where each slice of the data begins.';
    if (/AS RANGE (RIGHT|LEFT)/i.test(t)) return `RANGE ${/RIGHT/i.test(t) ? 'RIGHT: each boundary date starts a new partition' : 'LEFT: each boundary value ends a partition'}.`;
    if (/PARTITION SCHEME/i.test(t)) return 'Define the partition scheme: which storage each slice goes to.';
    if (/^AS PARTITION/i.test(t)) return 'Use the partition function to decide the slices.';
    if (/^ALL TO/i.test(t)) return 'Put every slice on the PRIMARY filegroup (the default storage).';
    if ((m = /^TRUNCATE TABLE\s+(.+?);?$/i.exec(t))) return `Empty ${m[1]} completely, quickly, before reloading it.`;
    if ((m = /^DECLARE\s+(@\w+)/i.exec(t))) return `Make a variable ${m[1]} to hold a value.`;
    if ((m = /^INTO\s+([#\w.]+)/i.exec(t))) return `Save the result into a new table ${m[1]}.`;
    if (/^END;?$/i.test(t)) return 'Finish the block.';
    return extra ? extra.trim() : '';
  }
  function explain(sol, notes) {
    return sol.split('\n').map((c, i) => ({ c, s: (notes && notes[i] !== undefined ? notes[i] : explainLine(c)) || '' }));
  }
  function skeleton(sol) {
    const KEEP = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND']);
    return sol.split('\n').map(line => {
      const toks = tokenize(line); let out = '', last = 0;
      toks.forEach((t, i) => {
        out += line.slice(last, t.p); last = t.e;
        const txt = line.slice(t.p, t.e);
        const prev = toks[i - 1], next = toks[i + 1];
        if (t.t === 'str') { out += "'___'"; return; }
        if (t.t === 'num') { out += isKw(prev, 'TOP') || (isOp(prev, '(') && isKw(toks[i - 2], 'TOP')) || isKw(prev, 'NTILE') || (isOp(prev, '(') && isKw(toks[i - 2], 'NTILE')) ? txt : '___'; return; }
        if (t.t === 'id' && !t.q && (KW.has(t.u) || KEEP.has(t.u))) { out += txt; return; }
        if (t.t === 'id' && isOp(next, '(')) { out += txt; return; }
        if (t.t === 'id' && isOp(next, '.') && toks[i + 2] && toks[i + 2].t === 'id' && SIG.PANTRY.some(p => p.name.toLowerCase() === (t.v + '.' + toks[i + 2].v).toLowerCase())) { out += txt; return; }
        if (t.t === 'id' && isOp(prev, '.') && toks[i - 2] && SIG.PANTRY.some(p => p.name.toLowerCase() === (toks[i - 2].v + '.' + t.v).toLowerCase())) { out += txt; return; }
        if (t.t === 'id' && (isKw(prev, 'AS') || isKw(prev, 'FROM') || isKw(prev, 'JOIN') || isKw(prev, 'WITH') || isKw(prev, 'VIEW') || isKw(prev, 'TABLE') || isKw(prev, 'INTO') || isKw(prev, 'UPDATE') || isKw(prev, 'INDEX') || isKw(prev, 'PROCEDURE') || isKw(prev, 'TRIGGER'))) { out += txt; return; }
        if (t.t === 'id' && prev && prev.t === 'id' && SIG.PANTRY.some(p => p.name.toLowerCase() === String(prev.v).toLowerCase() || line.slice(prev.p, prev.e).toLowerCase() === p.name.toLowerCase())) { out += txt; return; }
        if (t.t === 'id' && isOp(next, '.')) { out += txt; return; }
        if (t.t === 'var' || t.t === 'tmp') { out += txt; return; }
        if (t.t === 'id') { out += '___'; return; }
        out += txt;
      });
      return out + line.slice(last);
    }).join('\n');
  }
  function columnsIn(sol) {
    const tbls = tablesIn(sol).map(n => META.tables[n.toLowerCase()]);
    const words = new Set(tokenize(sol).filter(t => t.t === 'id').map(t => t.v.toLowerCase()));
    const out = {}; tbls.forEach(t => { out[t.name] = t.cols.map(c => c.name).filter(c => words.has(c.toLowerCase())); });
    return out;
  }
  function query(sql) { const r = BASE.exec(sql); return r.length ? r[0].values : []; }

  function init() {
    const pickInit = window.initSqlJs;
    return pickInit({ locateFile: f => 'vendor/' + f }).then(S => {
      SQL = S; const db = new SQL.Database(); SIG.DB.load(db, SIG); BYTES = db.export(); db.close();
      BASE = fresh();
      SIG.PANTRY.forEach(t => {
        META.tables[t.name.toLowerCase()] = { name: t.name, cols: t.cols.map(c => ({ name: c[0], type: c[1] })) };
        t.cols.forEach(c => { META.allCols[c[0].toLowerCase()] = true; if (/CHAR|TEXT/i.test(c[1])) META.textCols.add(c[0].toLowerCase()); });
      });
      ['City', 'StateCode', 'CustomerSegment', 'Category', 'Department', 'Region', 'Status', 'Channel', 'Priority', 'ReturnReason', 'ContactChannel', 'ProductName', 'CustomerName', 'EmployeeName'].forEach(c => {
        const t = SIG.PANTRY.find(p => !p.view && p.cols.some(x => x[0] === c));
        const vals = new Set(); SIG.PANTRY.filter(p => !p.view && p.cols.some(x => x[0] === c)).forEach(p => query(`SELECT DISTINCT "${c}" FROM "${p.name}" WHERE "${c}" IS NOT NULL`).forEach(r => vals.add(String(r[0]))));
        if (t) META.values[c.toLowerCase()] = [...vals];
      });
      // INFORMATION_SCHEMA, for the structure questions
      const ddl = [];
      ddl.push('CREATE TABLE "information_schema.TABLES" (TABLE_CATALOG TEXT, TABLE_SCHEMA TEXT COLLATE NOCASE, TABLE_NAME TEXT COLLATE NOCASE, TABLE_TYPE TEXT)');
      ddl.push('CREATE TABLE "information_schema.COLUMNS" (TABLE_CATALOG TEXT, TABLE_SCHEMA TEXT COLLATE NOCASE, TABLE_NAME TEXT COLLATE NOCASE, COLUMN_NAME TEXT COLLATE NOCASE, ORDINAL_POSITION INTEGER, IS_NULLABLE TEXT, DATA_TYPE TEXT COLLATE NOCASE, CHARACTER_MAXIMUM_LENGTH INTEGER)');
      ddl.push('CREATE TABLE "sys.tables" (name TEXT COLLATE NOCASE, schema_name TEXT COLLATE NOCASE)');
      ddl.push('CREATE TABLE "sys.schemas" (name TEXT COLLATE NOCASE, schema_id INTEGER)');
      ddl.push("INSERT INTO \"sys.schemas\" VALUES ('dbo',1),('crm',5),('catalog',6),('hr',7),('sales',8),('support',9),('training',10),('reporting',11)");
      const w = new SQL.Database(BYTES); ddl.forEach(d => w.run(d));
      SIG.PANTRY.forEach(t => {
        const [sch, nm] = t.name.split('.');
        w.run('INSERT INTO "information_schema.TABLES" VALUES (?,?,?,?)', ['CelestiaRetailLab', sch, nm, t.view ? 'VIEW' : 'BASE TABLE']);
        if (!t.view) w.run('INSERT INTO "sys.tables" VALUES (?,?)', [nm, sch]);
        t.cols.forEach((c, i) => { const ty = c[1].replace(/\s*NULL$/, ''); const m = /^(\w+)(?:\((\d+))?/.exec(ty); w.run('INSERT INTO "information_schema.COLUMNS" VALUES (?,?,?,?,?,?,?,?)', ['CelestiaRetailLab', sch, nm, c[0], i + 1, / NULL$/.test(c[1]) ? 'YES' : 'NO', m[1].toLowerCase(), /CHAR/i.test(m[1]) && m[2] ? +m[2] : null]); });
      });
      BYTES = w.export(); w.close(); BASE.close(); BASE = fresh();
    });
  }

  const ready = (window.initSqlJs ? init() : Promise.reject(new Error('sql.js missing'))).catch(e => { console.error(e); throw e; });
  SIG.Engine = { ready, run, close, grade, lint, explain, explainLine, skeleton, tablesIn, columnsIn, detectTools, query, orderKeys, compareSets, tokenize, toDate, fmt, dateadd, datediff, META, TODAY, NOW };
})();
