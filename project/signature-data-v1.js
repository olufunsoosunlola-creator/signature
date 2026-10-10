// Signature — content: tools (menu cards), practice requests, mistake language, seed history.
(function () {
  const TOOLS = [
    { id: 'SELECT', cat: 'FOUNDATIONS', foundation: true, diff: 1, freq: 5,
      ingr: ['SELECT columns', 'FROM table', 'AS nickname', 'expressions'],
      plain: 'Chooses which columns you want to see, from which table.',
      lesson: 'Every query starts here. SELECT is the list of things you want to look at, and FROM is the table they live in. You can also make new columns on the fly, like adding two numbers together or gluing first and last names into one.',
      analogy: 'Like telling a shop assistant, “From the shoe wall, just show me the color and the price.”',
      kind: 'SELECT is where every query begins.',
      notFor: 'SELECT chooses columns; on its own it doesn’t filter, group or combine anything.',
      signals: ['show me', 'list', 'give me'],
      dialect: { pg: 'Postgres glues text with ||, like first_name || \' \' || last_name.', tsql: 'T-SQL glues text with +, like first_name + \' \' + last_name; CONCAT() works in both.' } },
    { id: 'WHERE', cat: 'FILTERING', diff: 1, freq: 5,
      ingr: ['WHERE condition', 'AND · OR', '=  <>  >  <', 'IN ( … )', 'LIKE · IS NULL'],
      plain: 'Keeps only the rows that pass a test.',
      lesson: 'WHERE looks at each row one at a time and asks a yes-or-no question: is this order over $200? Is this store in the West region? Rows that answer yes stay, the rest are set aside. It happens before any grouping or counting.',
      analogy: 'Like going through a shoebox of receipts and keeping only the ones over $200.',
      kind: 'WHERE is the everyday filter, so it’s a very natural first reach.',
      notFor: 'WHERE checks one row at a time, before anything is grouped or added up.',
      signals: ['only', 'over / under', 'this week', 'in the West'],
      dialect: { pg: 'Today’s date is CURRENT_DATE in Postgres.', tsql: 'Today’s date is CAST(GETDATE() AS date) in T-SQL.' } },
    { id: 'ORDER BY', cat: 'SORTING', diff: 1, freq: 5,
      ingr: ['ORDER BY column', 'ASC  (the default)', 'DESC', 'several columns'],
      plain: 'Puts the rows in the order you ask for.',
      lesson: 'ORDER BY doesn’t remove or change anything. It only decides the order rows come out in: newest first, A to Z, biggest to smallest. Add DESC when you want the biggest or newest at the top.',
      analogy: 'Lining books up on a shelf by height. Nothing leaves the shelf; they just stand in order.',
      kind: 'Sorting feels like organizing, so ORDER BY is an easy one to reach for.',
      notFor: 'ORDER BY only changes the order; it never removes or combines rows.',
      signals: ['newest first', 'from highest', 'alphabetical'] },
    { id: 'TOP / LIMIT', cat: 'SORTING', diff: 1, freq: 4,
      ingr: ['ORDER BY … DESC', 'LIMIT n  · Postgres', 'TOP n  · T-SQL'],
      plain: 'Keeps just the first few rows after sorting.',
      lesson: 'When someone asks for “the top 5” or “the 10 most recent,” sort the rows first with ORDER BY, then cut the list after the first few. The two dialects write that cut in different places.',
      analogy: 'After the race results are lined up, only the first three runners get a medal.',
      kind: 'You noticed the request wanted a short list, which is a good eye.',
      notFor: 'TOP / LIMIT trims the list to a few rows; it doesn’t count or combine anything.',
      signals: ['top 5', 'best', 'most recent 10'],
      dialect: { pg: 'In Postgres, LIMIT 5 goes at the very end of the query.', tsql: 'In T-SQL, TOP 5 goes right after SELECT; there’s no LIMIT.' } },
    { id: 'DISTINCT', cat: 'FILTERING', diff: 1, freq: 3,
      ingr: ['SELECT DISTINCT', 'one or more columns'],
      plain: 'Removes repeats, so each value shows up once.',
      lesson: 'If a column has the same value many times, like a city that a hundred customers live in, DISTINCT gives you each value only once. It works on whatever columns you SELECT.',
      analogy: 'Writing a guest list from a pile of RSVP cards: each name goes on once, however many cards they sent.',
      kind: 'You spotted that repeats should go, which is the right instinct.',
      notFor: 'DISTINCT only removes repeated rows; it can’t count or filter by a total.',
      signals: ['no repeats', 'each … once', 'unique'] },
    { id: 'GROUP BY', cat: 'SUMMARIZING', diff: 2, freq: 5,
      ingr: ['GROUP BY column', 'COUNT(*)', 'SUM( … )', 'AVG( … )', 'MIN · MAX'],
      plain: 'Gathers rows into piles, then counts or adds up each pile.',
      lesson: 'GROUP BY gathers rows that share a value, like all the orders from the same store, into one pile. Then COUNT, SUM or AVG works on each pile and you get one row per pile.',
      analogy: 'Sorting laundry into piles by color before counting each pile.',
      kind: 'GROUP BY is the go-to for totals, so it’s a thoughtful reach.',
      notFor: 'GROUP BY folds many rows into one row per group, so the individual rows disappear.',
      signals: ['each store', 'per customer', 'by region', 'how many'] },
    { id: 'HAVING', cat: 'SUMMARIZING', diff: 3, freq: 3,
      ingr: ['GROUP BY first', 'HAVING COUNT(*) > n', 'HAVING SUM( … ) > n'],
      plain: 'Filters the piles after GROUP BY has counted them.',
      lesson: 'WHERE filters rows before they’re grouped. HAVING filters the groups after they’re counted. If the test is about a total, a count or an average (“more than 3 orders,” “over $50,000 in sales”), it belongs in HAVING.',
      analogy: 'After the laundry is in piles, you only keep the piles with more than five socks.',
      kind: 'HAVING is a filter too, so it’s easy to reach for whenever you hear “only.”',
      notFor: 'HAVING filters groups after they’re counted, so it needs a GROUP BY to work on.',
      signals: ['more than 3 orders', 'over $50,000 in sales', 'at least'] },
    { id: 'INNER JOIN', cat: 'COMBINING', diff: 2, freq: 5,
      ingr: ['FROM table_a', 'INNER JOIN table_b', 'ON a.key = b.key'],
      plain: 'Combines two tables, keeping only rows that match in both.',
      lesson: 'When the facts you need live in two tables, a JOIN lines them up using a shared column, like store_id. INNER JOIN keeps only the pairs that match. Anything without a partner is left out.',
      analogy: 'Matching socks: only the ones that find a partner go into the drawer.',
      kind: 'You saw that two tables were involved, and that’s the hardest part.',
      notFor: 'An INNER JOIN keeps only rows that find a match in both tables.',
      signals: ['with the name of', 'alongside', 'only those assigned'] },
    { id: 'LEFT JOIN', cat: 'COMBINING', diff: 3, freq: 4,
      ingr: ['FROM left_table', 'LEFT JOIN right_table', 'ON a.key = b.key', 'IS NULL  finds gaps'],
      plain: 'Combines two tables and keeps every row from the first, match or not.',
      lesson: 'LEFT JOIN keeps everything from the first table. If a row has no match in the second table, it stays anyway, with empty (NULL) boxes. That makes it perfect for finding what’s missing: who hasn’t ordered, which product never sold.',
      analogy: 'Taking attendance from the full class list. Everyone stays on the list; absent kids just have an empty box by their name.',
      kind: 'You saw two tables were needed, which is the first big step.',
      notFor: 'A LEFT JOIN keeps unmatched rows too, so it’s for when the gaps matter.',
      signals: ['haven’t', 'never', 'even if they have none'] },
    { id: 'SUBQUERY', cat: 'NESTING', diff: 3, freq: 3,
      ingr: ['( SELECT … )', 'WHERE x > ( … )', 'IN ( SELECT … )', 'NOT EXISTS ( … )'],
      plain: 'A small query inside a bigger one, used to work out a value first.',
      lesson: 'Sometimes you need a number before you can ask your question, like the average price. A subquery is a little query in parentheses that works that number out, and the outer query uses it.',
      analogy: 'Asking a friend to look up one number for you, then using it in your own question.',
      kind: 'Nesting is a clever move, and you were thinking in steps.',
      notFor: 'A subquery works something out first; it isn’t needed when the answer is right there in the rows.',
      signals: ['above average', 'more than the typical', 'compared with'] },
    { id: 'CTE', cat: 'NESTING', diff: 3, freq: 3,
      ingr: ['WITH name AS (', '   SELECT …', ')', 'SELECT … FROM name'],
      plain: 'Names a step at the top so the main query can use it, like a prep step.',
      lesson: 'A CTE (common table expression) is a named mini-result you write first with WITH. The main query then reads from it as if it were a table. It’s the tidy way to say “first work this out, then use it.”',
      analogy: 'Writing “make the dough” on its own recipe card first, then using the dough in the main recipe.',
      kind: 'You were thinking in steps, which is exactly how CTEs think.',
      notFor: 'A CTE is a named first step; simple one-step requests don’t need it.',
      signals: ['first work out', 'then', 'step by step'],
      dialect: { pg: 'In Postgres, a query can begin with WITH right away.', tsql: 'In T-SQL, end the statement before WITH with a semicolon, or write ;WITH.' } },
    { id: 'WINDOW FUNCTION', cat: 'RANKING', diff: 4, freq: 3,
      ingr: ['RANK() · ROW_NUMBER()', 'OVER (', '   PARTITION BY group', '   ORDER BY column )'],
      plain: 'Adds a rank or running number beside every row, without squashing rows together.',
      lesson: 'A window function looks at a row’s neighbors (its “window”) to work something out, like a rank within its region, while keeping every row. PARTITION BY says which group to compare within; ORDER BY says how to rank.',
      analogy: 'Every runner keeps their own line on the results sheet; you just write their place in their age group beside their name.',
      kind: 'Window functions are the trickiest card on the menu.',
      notFor: 'A window function keeps every row and adds a number beside each one.',
      signals: ['rank', 'within each', 'running total', 'compared with the rest of'] },
    { id: 'CASE', cat: 'LABELING', diff: 2, freq: 4,
      ingr: ['CASE', '   WHEN … THEN …', '   ELSE …', 'END AS label'],
      plain: 'Writes a label next to each row, based on rules you set.',
      lesson: 'CASE is SQL’s “if this, then that.” It checks each row against your rules in order and writes the first matching label. Every row stays; it just gets a new column.',
      analogy: 'Sorting mail into labeled cubbies: envelopes here, small boxes there, big boxes over there.',
      kind: 'Labels are a creative idea.',
      notFor: 'CASE labels rows; it doesn’t remove or count them.',
      signals: ['tag each', 'label', 'depending on', 'bucket'] }
  ];

  const TABLES = {
    customers: 'customer_id, first_name, last_name, name, city, joined_on',
    orders: 'order_id, customer_id, store_id, order_date, total',
    order_items: 'order_id, product_id, qty, price',
    products: 'product_id, name, category, price',
    stores: 'store_id, name, region',
    store_sales: 'store_id, region, sales',
    employees: 'employee_id, name, store_id, hired_on',
    inventory: 'store_id, product_id, on_hand'
  };

  const REQUESTS = [
    { id: 'q-lapsed', from: 'Dana, Customer Care', concept: 'Combining', lead: 'LEFT JOIN',
      request: 'Which customers haven’t ordered anything this year?',
      clues: ['haven’t ordered anything'],
      clueWhy: 'The words “haven’t ordered anything” mean some customers have no match in orders, and you still want to see them.',
      options: ['INNER JOIN', 'LEFT JOIN', 'WHERE', 'GROUP BY', 'SUBQUERY', 'HAVING'],
      accept: [['LEFT JOIN'], ['LEFT JOIN', 'WHERE'], ['SUBQUERY'], ['SUBQUERY', 'WHERE']],
      tables: ['customers', 'orders'],
      whyNot: {
        'INNER JOIN': 'An INNER JOIN keeps only customers who do have an order. The people you’re looking for are exactly the ones it throws away.',
        'WHERE': 'WHERE can only check the rows in front of it. The “no order” fact lives in another table, so you need to bring that table in first.',
        'GROUP BY': 'Grouping counts orders per customer, but a customer with zero orders never shows up to be counted.',
        'HAVING': 'HAVING filters counted groups, and customers with no orders never make it into a group.'
      },
      path: { steps: [
        { q: 'Do I need data from two tables?', yes: 'Yes! customers + orders', no: 'No → just WHERE' },
        { q: 'Do I need to keep rows that have no match?', yes: 'Yes, the quiet ones!', no: 'Nope → INNER JOIN' }
      ], end: 'LEFT JOIN.', note: '…then keep only the empty matches with IS NULL' },
      checks: [
        { k: 'keep-unmatched', re: 'LEFT\\s+(OUTER\\s+)?JOIN|NOT\\s+EXISTS|NOT\\s+IN', miss: 'A way to keep customers who have no orders at all (LEFT JOIN or NOT EXISTS).', pat: 'Used a join that drops customers with no orders.' },
        { k: 'is-null', re: 'IS\\s+NULL|NOT\\s+EXISTS|NOT\\s+IN', miss: 'The last step that keeps only the empty matches: WHERE o.order_id IS NULL.', pat: 'Forgot IS NULL after a LEFT JOIN, so every customer came back, not only the quiet ones.' }
      ],
      steps: [
        { c: 'SELECT c.customer_id, c.name', s: 'Say which columns you want to see: each customer’s id and name.' },
        { c: 'FROM customers AS c', s: 'Start from the full customer list. “c” is a short nickname.' },
        { c: 'LEFT JOIN orders AS o', s: 'Bring in orders, but keep every customer, even ones with no orders.' },
        { c: "  ON o.customer_id = c.customer_id\n AND o.order_date >= DATE_TRUNC('year', CURRENT_DATE)", s: 'Match orders to customers, counting only orders from January 1 of this year.' },
        { c: 'WHERE o.order_id IS NULL;', s: 'Keep the customers whose order box came back empty. Those are the ones who haven’t ordered.' }
      ],
      tsql: { 3: { c: '  ON o.customer_id = c.customer_id\n AND o.order_date >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)' } },
      dialectNote: { pg: 'Postgres finds January 1 with DATE_TRUNC(\'year\', CURRENT_DATE).', tsql: 'T-SQL builds January 1 with DATEFROMPARTS(YEAR(GETDATE()), 1, 1).' } },

    { id: 'q-big', from: 'Marco, Regional Ops', concept: 'Summarizing', lead: 'HAVING',
      request: 'Which stores sold more than $50,000 last month?',
      clues: ['Which stores', 'more than $50,000'],
      clueWhy: '“Which stores” means one answer per store, and “more than $50,000” is a test on each store’s total, not on any single sale.',
      options: ['WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'CASE', 'WINDOW FUNCTION'],
      accept: [['GROUP BY', 'HAVING'], ['WHERE', 'GROUP BY', 'HAVING']],
      tables: ['orders'],
      whyNot: {
        'WHERE': 'WHERE checks one sale at a time, and no single sale is $50,000. The total only exists after the sales are added up.',
        'ORDER BY': 'Sorting puts the biggest stores at the top, but it doesn’t leave out the ones under $50,000.',
        'WINDOW FUNCTION': 'A window function keeps every sale as its own row. You want one row per store.',
        'CASE': 'CASE would label stores, but the request asks to keep only some of them.'
      },
      path: { steps: [
        { q: 'Is the answer one row per store, not per sale?', yes: 'Yes! per store', no: 'No → WHERE' },
        { q: 'Am I filtering on a total I just added up?', yes: 'Yes, the $50,000!', no: 'No → GROUP BY alone' }
      ], end: 'GROUP BY + HAVING', note: 'WHERE trims last month first; HAVING trims the totals' },
      checks: [
        { k: 'group', re: 'GROUP\\s+BY', miss: 'GROUP BY store_id, so each store gets its own pile of sales.', pat: 'Forgot GROUP BY before adding up totals.' },
        { k: 'having', re: 'HAVING\\s+SUM', miss: 'HAVING SUM(total) > 50000, so the test happens on each store’s total.', pat: 'Tested a total in WHERE instead of HAVING.' }
      ],
      steps: [
        { c: 'SELECT store_id, SUM(total) AS sales', s: 'Show each store and its sales added together.' },
        { c: 'FROM orders', s: 'The sales live in the orders table.' },
        { c: "WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'\n  AND order_date <  DATE_TRUNC('month', CURRENT_DATE)", s: 'Keep only last month’s orders. This filter is about single rows, so it’s WHERE.' },
        { c: 'GROUP BY store_id', s: 'Put each store’s orders into its own pile.' },
        { c: 'HAVING SUM(total) > 50000;', s: 'Now keep only the piles that add up to more than $50,000.' }
      ],
      tsql: { 2: { c: 'WHERE order_date >= DATEADD(month, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))\n  AND order_date <  DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)' } },
      dialectNote: { pg: 'Postgres finds the first of the month with DATE_TRUNC(\'month\', …).', tsql: 'T-SQL builds the first of the month with DATEFROMPARTS and steps back with DATEADD.' } },

    { id: 'q-repeat', from: 'Priya, Loyalty', concept: 'Summarizing', lead: 'HAVING',
      request: 'List the customers who’ve placed more than 3 orders.',
      clues: ['customers', 'more than 3 orders'],
      clueWhy: '“More than 3 orders” is a count. You can only test a count after you’ve gathered each customer’s orders together.',
      options: ['WHERE', 'GROUP BY', 'HAVING', 'DISTINCT', 'INNER JOIN', 'ORDER BY'],
      accept: [['GROUP BY', 'HAVING']],
      tables: ['orders'],
      whyNot: {
        'WHERE': 'WHERE looks at one order at a time, and one order can’t know how many others there are. The count only exists after grouping.',
        'DISTINCT': 'DISTINCT gives each customer once, but it doesn’t count their orders.',
        'ORDER BY': 'Sorting doesn’t count anything; it only changes the order.',
        'INNER JOIN': 'Everything you need is already in the orders table, so no second table is needed.'
      },
      path: { steps: [
        { q: 'Do I need one row per customer?', yes: 'Yes! per customer', no: 'No → WHERE' },
        { q: 'Is my test about a count?', yes: 'Yes, more than 3!', no: 'No → GROUP BY alone' }
      ], end: 'GROUP BY + HAVING', note: 'count the pile, then keep the big piles' },
      checks: [
        { k: 'group', re: 'GROUP\\s+BY', miss: 'GROUP BY customer_id, so each customer’s orders form one pile.', pat: 'Forgot GROUP BY before counting.' },
        { k: 'having', re: 'HAVING\\s+COUNT', miss: 'HAVING COUNT(*) > 3, so the test happens on the count.', pat: 'Tested a count in WHERE instead of HAVING.' }
      ],
      steps: [
        { c: 'SELECT customer_id, COUNT(*) AS orders', s: 'Show each customer and how many orders they’ve placed.' },
        { c: 'FROM orders', s: 'Every order is one row here.' },
        { c: 'GROUP BY customer_id', s: 'Gather each customer’s orders into one pile.' },
        { c: 'HAVING COUNT(*) > 3;', s: 'Keep only the piles with more than 3 orders in them.' }
      ] },

    { id: 'q-top5', from: 'Jun, Merchandising', concept: 'Sorting', lead: 'TOP / LIMIT',
      request: 'Which 5 products have sold the most units?',
      clues: ['5 products', 'the most units'],
      clueWhy: '“The most units” means adding up units per product, and “5 products” means keeping only the first five after sorting.',
      options: ['GROUP BY', 'ORDER BY', 'TOP / LIMIT', 'WHERE', 'HAVING', 'DISTINCT'],
      accept: [['GROUP BY', 'TOP / LIMIT'], ['GROUP BY', 'ORDER BY', 'TOP / LIMIT']],
      tables: ['order_items'],
      whyNot: {
        'WHERE': 'WHERE would need a fixed cutoff number, and you don’t know it. You want whoever ends up in the top five.',
        'HAVING': 'HAVING also needs a cutoff number. “Top 5” is about position in the list, not a number to beat.',
        'DISTINCT': 'DISTINCT lists each product once but doesn’t add up their units.'
      },
      path: { steps: [
        { q: 'Do I need a total for each product?', yes: 'Yes! units per product', no: 'No → skip GROUP BY' },
        { q: 'Do I want only the first few after sorting?', yes: 'Yes, just 5!', no: 'No → ORDER BY alone' }
      ], end: 'GROUP BY + TOP / LIMIT', note: 'sort biggest first, then cut after five' },
      checks: [
        { k: 'group', re: 'GROUP\\s+BY', miss: 'GROUP BY product_id, so units are added up per product.', pat: 'Forgot GROUP BY before ranking totals.' },
        { k: 'desc', re: 'ORDER\\s+BY[\\s\\S]*DESC', miss: 'ORDER BY units DESC, so the biggest sellers come first.', pat: 'Sorted smallest-first when the request wanted the most.' },
        { k: 'limit', d: 'pg', re: 'LIMIT\\s+5', miss: 'LIMIT 5 at the end to keep five rows.', pat: 'Used TOP in Postgres, which only knows LIMIT.' },
        { k: 'top', d: 'tsql', re: 'TOP\\s*\\(?\\s*5', miss: 'TOP 5 right after SELECT to keep five rows.', pat: 'Used LIMIT in T-SQL, which only knows TOP.' }
      ],
      steps: [
        { c: 'SELECT product_id, SUM(qty) AS units', s: 'Show each product and its units added together.' },
        { c: 'FROM order_items', s: 'Each line of each order lives here, with a quantity.' },
        { c: 'GROUP BY product_id', s: 'Put each product’s lines into one pile.' },
        { c: 'ORDER BY units DESC', s: 'Sort the piles from biggest to smallest.' },
        { c: 'LIMIT 5;', s: 'Keep just the first five.' }
      ],
      tsqlSteps: [
        { c: 'SELECT TOP 5 product_id, SUM(qty) AS units', s: 'Show each product and its units. TOP 5 says “only the first five.”' },
        { c: 'FROM order_items', s: 'Each line of each order lives here, with a quantity.' },
        { c: 'GROUP BY product_id', s: 'Put each product’s lines into one pile.' },
        { c: 'ORDER BY units DESC;', s: 'Sort biggest first, so TOP keeps the right five.' }
      ],
      dialectNote: { pg: 'In Postgres, LIMIT 5 goes at the very end.', tsql: 'In T-SQL, TOP 5 goes right after SELECT.' } },

    { id: 'q-rank', from: 'Marco, Regional Ops', concept: 'Ranking', lead: 'WINDOW FUNCTION',
      request: 'Rank each store by sales within its region. I want to see who’s leading in every region.',
      clues: ['Rank each store', 'within its region'],
      clueWhy: '“Rank each store” means every store keeps its own row, and “within its region” means the ranking restarts for each region.',
      options: ['GROUP BY', 'ORDER BY', 'WINDOW FUNCTION', 'TOP / LIMIT', 'HAVING', 'CASE'],
      accept: [['WINDOW FUNCTION'], ['WINDOW FUNCTION', 'ORDER BY']],
      tables: ['store_sales'],
      whyNot: {
        'GROUP BY': 'GROUP BY squashes each region into one row, so the individual stores disappear. You want to keep every store and write a rank beside it.',
        'ORDER BY': 'Sorting lines stores up, but it doesn’t write a rank number, and it doesn’t restart for each region.',
        'TOP / LIMIT': 'TOP / LIMIT keeps the first few rows overall, not a leader in every region.',
        'HAVING': 'HAVING filters groups; nothing here needs to be filtered away.'
      },
      path: { steps: [
        { q: 'Do I want to keep every store as its own row?', yes: 'Yes! every store', no: 'No → GROUP BY' },
        { q: 'Do I compare each row with its neighbors?', yes: 'Yes, within the region!', no: 'No → ORDER BY' }
      ], end: 'Window function', note: 'RANK() OVER (PARTITION BY region …)' },
      checks: [
        { k: 'over', re: 'OVER\\s*\\(', miss: 'An OVER ( … ) clause, which is what makes it a window function.', pat: 'Wrote RANK() without OVER ( … ).' },
        { k: 'partition', re: 'PARTITION\\s+BY\\s+\\w*region', miss: 'PARTITION BY region, so the ranking restarts in each region.', pat: 'Ranked across all stores instead of within each region.' }
      ],
      steps: [
        { c: 'SELECT store_id, region, sales,', s: 'Show each store with its region and sales.' },
        { c: '       RANK() OVER (', s: 'Add a rank number beside every row.' },
        { c: '         PARTITION BY region', s: 'Restart the counting for each region.' },
        { c: '         ORDER BY sales DESC', s: 'Highest sales gets rank 1.' },
        { c: '       ) AS region_rank\nFROM store_sales;', s: 'Name the new column and say where the rows come from.' }
      ] },

    { id: 'q-label', from: 'Priya, Marketing', concept: 'Labeling', lead: 'CASE',
      request: 'Tag each order as Small, Medium, or Large depending on its total.',
      clues: ['Tag each order', 'depending on its total'],
      clueWhy: '“Tag each order” means every order stays and gets a label, and “depending on” tells you there are rules for which label.',
      options: ['WHERE', 'CASE', 'GROUP BY', 'ORDER BY', 'HAVING', 'DISTINCT'],
      accept: [['CASE']],
      tables: ['orders'],
      whyNot: {
        'WHERE': 'WHERE decides which rows stay or go. Here every order stays; you’re only writing a label beside each one.',
        'GROUP BY': 'Grouping would squash orders into piles. The request wants each order kept, with its own label.',
        'ORDER BY': 'Sorting by total puts them in order but doesn’t write the words Small, Medium or Large.',
        'HAVING': 'HAVING filters groups after counting, and nothing is being counted here.'
      },
      path: { steps: [
        { q: 'Do all the rows stay?', yes: 'Yes! every order', no: 'No → WHERE' },
        { q: 'Am I writing a new word beside each one?', yes: 'Yes, a size label!', no: 'No → plain SELECT' }
      ], end: 'CASE', note: 'WHEN … THEN … , checked top to bottom' },
      checks: [
        { k: 'case', re: 'CASE[\\s\\S]*WHEN[\\s\\S]*THEN', miss: 'A CASE with WHEN … THEN … rules.', pat: 'Started a CASE without WHEN … THEN rules.' },
        { k: 'end', re: '\\bEND\\b', miss: 'An END to close the CASE.', pat: 'Forgot the END that closes a CASE.' }
      ],
      steps: [
        { c: 'SELECT order_id, total,', s: 'Show each order and its total.' },
        { c: "  CASE WHEN total < 25  THEN 'Small'", s: 'First rule: under $25 is Small.' },
        { c: "       WHEN total < 100 THEN 'Medium'", s: 'Next rule: under $100 is Medium. Rules are checked top to bottom.' },
        { c: "       ELSE 'Large'", s: 'Anything left over is Large.' },
        { c: '  END AS size\nFROM orders;', s: 'Close the CASE and name the new column.' }
      ] },

    { id: 'q-avg', from: 'Jun, Pricing', concept: 'Nesting', lead: 'SUBQUERY',
      request: 'Which products are priced above our average product price?',
      clues: ['above our average'],
      clueWhy: '“Above our average” means you need one number, the average, before you can compare each product to it.',
      options: ['WHERE', 'HAVING', 'SUBQUERY', 'GROUP BY', 'CASE', 'ORDER BY'],
      accept: [['SUBQUERY'], ['SUBQUERY', 'WHERE'], ['CTE'], ['CTE', 'WHERE']],
      tables: ['products'],
      whyNot: {
        'HAVING': 'HAVING filters groups after GROUP BY. There are no groups here; you’re comparing each product to one number.',
        'WHERE': 'WHERE is part of the answer, but it needs the average first, and that number has to be worked out in its own little query.',
        'GROUP BY': 'Grouping would squash products together. You want each product kept, compared with one overall average.'
      },
      path: { steps: [
        { q: 'Do I need a number before I can ask?', yes: 'Yes! the average', no: 'No → WHERE alone' },
        { q: 'Is it just one number, used once?', yes: 'Yes, keep it small!', no: 'No → CTE' }
      ], end: 'Subquery', note: 'WHERE price > (SELECT AVG(price) …)' },
      checks: [
        { k: 'avg', re: 'AVG\\s*\\(', miss: 'AVG(price), to work out the average.', pat: 'Compared against a typed-in number instead of working out the average.' },
        { k: 'nest', re: '\\(\\s*SELECT|WITH\\s+\\w+\\s+AS', miss: 'A little SELECT in parentheses (or a WITH step) to find the average first.', pat: 'Tried to use AVG() directly in WHERE without a subquery.' }
      ],
      steps: [
        { c: 'SELECT name, price', s: 'Show each product’s name and price.' },
        { c: 'FROM products', s: 'From the product list.' },
        { c: 'WHERE price > (', s: 'Keep products priced higher than…' },
        { c: '  SELECT AVG(price) FROM products', s: '…the average price, worked out by this little inner query first.' },
        { c: ');', s: 'Close the parentheses and you’re done.' }
      ] },

    { id: 'q-staff', from: 'Dana, Store Ops', concept: 'Combining', lead: 'INNER JOIN',
      request: 'Show employees with the name of the store they work at, only people currently assigned to a store.',
      clues: ['with the name of the store', 'only people currently assigned'],
      clueWhy: '“With the name of the store” means bringing in a second table, and “only people currently assigned” means unmatched employees can be left out.',
      options: ['INNER JOIN', 'LEFT JOIN', 'WHERE', 'SUBQUERY', 'GROUP BY', 'CASE'],
      accept: [['INNER JOIN']],
      tables: ['employees', 'stores'],
      whyNot: {
        'LEFT JOIN': 'A LEFT JOIN would keep employees with no store too. The request says “only people currently assigned,” so those can go.',
        'WHERE': 'The store name lives in another table, so WHERE alone can’t reach it.',
        'SUBQUERY': 'A subquery could fetch one value, but you need a name for every employee, side by side. That’s a join’s job.'
      },
      path: { steps: [
        { q: 'Do I need data from two tables?', yes: 'Yes! employees + stores', no: 'No → SELECT' },
        { q: 'Do I need to keep rows with no match?', yes: 'Yes → LEFT JOIN', no: 'Nope, only assigned!', take: 'no' }
      ], end: 'INNER JOIN.', note: 'match on store_id' },
      checks: [
        { k: 'join', re: '(INNER\\s+)?JOIN', miss: 'A JOIN to bring the stores table in.', pat: 'Forgot to join the second table.' },
        { k: 'on', re: 'ON\\s+[\\w.]*store_id\\s*=\\s*[\\w.]*store_id', miss: 'ON s.store_id = e.store_id, to say how rows match.', pat: 'Joined without an ON condition saying how the rows match.' }
      ],
      steps: [
        { c: 'SELECT e.name, s.name AS store', s: 'Show each employee’s name and their store’s name.' },
        { c: 'FROM employees AS e', s: 'Start from the employee list.' },
        { c: 'INNER JOIN stores AS s', s: 'Bring in stores, keeping only employees who match one.' },
        { c: '  ON s.store_id = e.store_id;', s: 'They match when the store ids are the same.' }
      ] },

    { id: 'q-cte', from: 'Marco, Inventory', concept: 'Nesting', lead: 'CTE',
      request: 'First work out each store’s average stock level, then show me the products sitting below their store’s average.',
      clues: ['First work out', 'then show me'],
      clueWhy: '“First work out … then show me” is a two-step request. Naming the first step with WITH keeps it easy to read.',
      options: ['CTE', 'GROUP BY', 'HAVING', 'WINDOW FUNCTION', 'WHERE', 'CASE'],
      accept: [['CTE'], ['CTE', 'GROUP BY'], ['CTE', 'GROUP BY', 'WHERE'], ['WINDOW FUNCTION'], ['WINDOW FUNCTION', 'WHERE']],
      tables: ['inventory'],
      whyNot: {
        'HAVING': 'HAVING filters whole store piles. You want individual products, each compared with its own store’s average.',
        'GROUP BY': 'GROUP BY finds the averages, which is the first step, but on its own it loses the individual products.',
        'WHERE': 'WHERE does the final comparison, but it needs the store averages worked out first.'
      },
      path: { steps: [
        { q: 'Does the request happen in two steps?', yes: 'Yes! first … then', no: 'No → one query' },
        { q: 'Would naming step one make it clearer?', yes: 'Yes, call it store_avg!', no: 'No → subquery' }
      ], end: 'CTE', note: 'WITH store_avg AS ( … )' },
      checks: [
        { k: 'with', re: 'WITH\\s+\\w+\\s+AS|OVER\\s*\\(', miss: 'A WITH name AS ( … ) step at the top.', pat: 'Tried to do a two-step request in one step.' },
        { k: 'avg', re: 'AVG\\s*\\(', miss: 'AVG(on_hand) to find each store’s average.', pat: 'Forgot to work out the average before comparing.' }
      ],
      steps: [
        { c: 'WITH store_avg AS (', s: 'Name the first step “store_avg.”' },
        { c: '  SELECT store_id, AVG(on_hand) AS avg_on_hand\n  FROM inventory\n  GROUP BY store_id', s: 'Inside it: one average stock level per store.' },
        { c: ')', s: 'Close the first step.' },
        { c: 'SELECT i.store_id, i.product_id, i.on_hand\nFROM inventory AS i\nJOIN store_avg AS a ON a.store_id = i.store_id', s: 'Now read every product and line it up with its store’s average.' },
        { c: 'WHERE i.on_hand < a.avg_on_hand;', s: 'Keep the products below their store’s average.' }
      ],
      tsql: { 0: { c: ';WITH store_avg AS (', s: 'Name the first step “store_avg.” The leading ; keeps T-SQL happy.' } },
      dialectNote: { pg: 'Postgres lets a query begin with WITH right away.', tsql: 'T-SQL needs the statement before WITH to end in a semicolon, so many people write ;WITH.' } },

    { id: 'q-cities', from: 'Priya, Marketing', concept: 'Filtering', lead: 'DISTINCT',
      request: 'Which cities do our customers live in? Just the list, no repeats.',
      clues: ['no repeats'],
      clueWhy: '“No repeats” means each city should appear once, however many customers live there.',
      options: ['DISTINCT', 'GROUP BY', 'WHERE', 'ORDER BY', 'HAVING', 'INNER JOIN'],
      accept: [['DISTINCT'], ['DISTINCT', 'ORDER BY'], ['GROUP BY'], ['GROUP BY', 'ORDER BY']],
      tables: ['customers'],
      whyNot: {
        'WHERE': 'WHERE keeps or removes rows by a test, but every city passes. The repeats are the problem.',
        'ORDER BY': 'Sorting puts the cities in order, but the repeats are still there.',
        'HAVING': 'HAVING filters counted groups; nothing needs counting here.'
      },
      path: { steps: [
        { q: 'Do I want each value only once?', yes: 'Yes! no repeats', no: 'No → SELECT' },
        { q: 'Do I need to count anything?', yes: 'Yes → GROUP BY', no: 'Nope, just the list!', take: 'no' }
      ], end: 'DISTINCT', note: 'SELECT DISTINCT city' },
      checks: [
        { k: 'distinct', re: 'DISTINCT|GROUP\\s+BY', miss: 'SELECT DISTINCT city, so each city shows once.', pat: 'Forgot DISTINCT, so cities repeated.' }
      ],
      steps: [
        { c: 'SELECT DISTINCT city', s: 'Show each city once, no matter how many customers live there.' },
        { c: 'FROM customers', s: 'From the customer list.' },
        { c: 'ORDER BY city;', s: 'Optional, but kind: A to Z.' }
      ] },

    { id: 'q-recent', from: 'Dana, Store Ops', concept: 'Filtering', lead: 'WHERE',
      request: 'Show this week’s orders over $200, newest first.',
      clues: ['this week’s', 'over $200', 'newest first'],
      clueWhy: '“This week’s” and “over $200” are tests on each order, and “newest first” is about order on the page.',
      options: ['WHERE', 'ORDER BY', 'HAVING', 'GROUP BY', 'TOP / LIMIT', 'CASE'],
      accept: [['WHERE', 'ORDER BY']],
      tables: ['orders'],
      whyNot: {
        'HAVING': 'HAVING is for testing totals after grouping. “Over $200” is about each single order, so it belongs in WHERE.',
        'GROUP BY': 'Nothing needs adding up; each order stays as its own row.',
        'TOP / LIMIT': 'The request wants all of this week’s big orders, not just the first few.',
        'CASE': 'CASE labels rows, but here you want to keep only some of them.'
      },
      path: { steps: [
        { q: 'Am I testing each single row?', yes: 'Yes! each order', no: 'No → HAVING' },
        { q: 'Does the order on the page matter?', yes: 'Yes, newest first!', no: 'No → WHERE alone' }
      ], end: 'WHERE + ORDER BY', note: 'ORDER BY order_date DESC' },
      checks: [
        { k: 'where', re: 'WHERE[\\s\\S]*total\\s*>\\s*200', miss: 'WHERE total > 200 to keep the big orders.', pat: 'Forgot the dollar test on each order.' },
        { k: 'desc', re: 'ORDER\\s+BY\\s+[\\w.]*order_date\\s+DESC', miss: 'ORDER BY order_date DESC, so the newest come first.', pat: 'Forgot DESC, so the oldest came first.' }
      ],
      steps: [
        { c: 'SELECT order_id, order_date, total', s: 'Show each order’s id, date and total.' },
        { c: 'FROM orders', s: 'From the orders table.' },
        { c: 'WHERE total > 200', s: 'Keep orders over $200.' },
        { c: "  AND order_date >= CURRENT_DATE - INTERVAL '7 days'", s: '…that also happened in the last seven days.' },
        { c: 'ORDER BY order_date DESC;', s: 'Newest at the top.' }
      ],
      tsql: { 3: { c: '  AND order_date >= DATEADD(day, -7, CAST(GETDATE() AS date))' } },
      dialectNote: { pg: 'Postgres subtracts days with INTERVAL \'7 days\'.', tsql: 'T-SQL steps back in time with DATEADD(day, -7, …).' } }
  ];

  const CONFUSIONS = {
    'WHERE>HAVING': 'Used WHERE to test a total. Totals only exist after GROUP BY, so they need HAVING.',
    'HAVING>WHERE': 'Used HAVING to test single rows. Row-by-row tests belong in WHERE.',
    'INNER JOIN>LEFT JOIN': 'Used INNER JOIN when the request wanted the rows with no match. INNER JOIN drops them.',
    'LEFT JOIN>INNER JOIN': 'Used LEFT JOIN when only matched rows were wanted.',
    'GROUP BY>WINDOW FUNCTION': 'Used GROUP BY when every row needed to stay. Ranking within groups keeps the rows, so it’s a window function.',
    'ORDER BY>WINDOW FUNCTION': 'Sorted rows when the request wanted a rank number that restarts in each group.',
    'ORDER BY>GROUP BY': 'Sorted rows when they needed gathering into piles and counting.',
    'WHERE>CASE': 'Filtered rows away when every row should stay and get a label.',
    'HAVING>SUBQUERY': 'Tried to compare with an average without working the average out first.',
    'WHERE>LEFT JOIN': 'Tried to find missing matches with WHERE alone; the missing part lives in another table.',
    'GROUP BY>LEFT JOIN': 'Tried counting to find customers with none; people with zero never get counted.'
  };

  const NOTES_RIGHT = [
    'Beautifully poured.', 'You read that request like a pro.', 'Exactly the right card.',
    'Lovely. That’s the thinking.', 'Clean and calm. Well done.', 'That one’s yours now.'
  ];

  function seed() {
    const day = 86400000, now = Date.now();
    const h = [
      ['q-staff', ['INNER JOIN'], 1, 1], ['q-recent', ['WHERE', 'ORDER BY'], 1, 1],
      ['q-repeat', ['WHERE', 'GROUP BY'], 0, 0], ['q-lapsed', ['LEFT JOIN'], 1, 0],
      ['q-label', ['CASE'], 1, 1], ['q-repeat', ['WHERE', 'GROUP BY'], 0, null],
      ['q-rank', ['GROUP BY'], 0, 0], ['q-top5', ['GROUP BY', 'TOP / LIMIT'], 1, 1],
      ['q-cities', ['DISTINCT'], 1, 1], ['q-staff', ['INNER JOIN'], 1, 1],
      ['q-recent', ['WHERE', 'ORDER BY'], 1, 0], ['q-lapsed', ['LEFT JOIN'], 1, 1],
      ['q-rank', ['ORDER BY'], 0, null], ['q-avg', ['SUBQUERY'], 1, 1],
      ['q-label', ['CASE'], 1, 1], ['q-lapsed', ['LEFT JOIN', 'WHERE'], 1, 1],
      ['q-staff', ['INNER JOIN'], 1, 1], ['q-cte', ['CTE', 'GROUP BY'], 1, 0]
    ];
    const attempts = h.map((r, i) => ({ qid: r[0], picked: r[1], toolsOk: !!r[2], queryOk: r[3] === null ? null : !!r[3], ts: now - (h.length - i) * day * 0.8, dialect: i % 3 ? 'pg' : 'tsql', seeded: true }));
    return {
      v: 1, seedV: 2, dialect: 'pg', attempts,
      session: { kind: 'quick', queue: ['q-big', 'q-label', 'q-cte'], i: 0, step: 2, picked: ['GROUP BY', 'HAVING'], text: 'SELECT store_id, SUM(total) AS sales\nFROM orders\n', log: [], started: now - day * 0.3 }
    };
  }

  window.SIG = { SEED_V: 2, TOOLS, TABLES, REQUESTS, CONFUSIONS, NOTES_RIGHT, seed };
})();
