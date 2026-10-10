// Signature — practice requests on CelestiaRetailLab (T-SQL). R(topic, level, request, clues, clueWhy, tables, distractors, checks, steps, extra)
(function () {
  const Q = [];
  function R(topic, lv, ask, clues, why, tb, opt, chk, steps, x) {
    x = x || {};
    Q.push({ id: topic + '-' + lv, topic, lv, request: ask, clues, clueWhy: why, tables: tb, distract: opt,
      checks: chk.map((c, i) => ({ k: 'c' + i, re: c[0].source, flags: 'i', neg: !!c[2], miss: c[1], pat: c[3] || c[1] })),
      steps: steps.map(s => ({ c: s[0], s: s[1] })),
      need: x.need || [topic], ok: x.ok || [], alt: x.alt || [], whyNot: x.no || {} });
  }

  // ───────── PHASE 1 · FOUNDATION
  R('d01', 1, 'Peek at the first 5 rows of crm.Customers so I can see how it’s laid out.', ['see how it’s laid out'],
    '“See how it’s laid out” is about the table’s structure, so a small peek is all you need.', ['crm.Customers'], ['d06', 'd03a', 'd08'],
    [[/TOP\s*\(?\s*5/, 'TOP (5), to keep the peek small.'], [/FROM\s+crm\.Customers/, 'FROM crm.Customers, with the schema name.']],
    [[`SELECT TOP (5) *`, 'A peek is the one place SELECT * is fine. TOP (5) keeps it small.'], [`FROM crm.Customers;`, 'The Customers table lives in the crm schema.']], { ok: ['d03b', 'd02'] });
  R('d01', 2, 'List every column in sales.Orders along with its data type.', ['every column', 'data type'],
    '“Every column … data type” is a question about structure. SQL Server keeps that list in INFORMATION_SCHEMA.COLUMNS.', [], ['d02', 'd03a', 'd06'],
    [[/INFORMATION_SCHEMA\.COLUMNS/, 'Read from INFORMATION_SCHEMA.COLUMNS, SQL Server’s list of every column.'], [/TABLE_NAME\s*=\s*'Orders'/, "WHERE TABLE_NAME = 'Orders'."]],
    [[`SELECT COLUMN_NAME, DATA_TYPE`, 'Ask for each column’s name and type.'], [`FROM INFORMATION_SCHEMA.COLUMNS`, 'This built-in view describes every column in the database.'], [`WHERE TABLE_SCHEMA = 'sales'\n  AND TABLE_NAME = 'Orders';`, 'Only the columns of sales.Orders.']], { ok: ['d06', 'd02'] });
  R('d01', 3, 'Which tables live in the sales schema?', ['tables live in the sales schema'],
    'This asks about the database itself, not the data inside it.', [], ['d02', 'd03a', 'd10'],
    [[/INFORMATION_SCHEMA\.TABLES|sys\.tables/, 'Read from INFORMATION_SCHEMA.TABLES.'], [/TABLE_SCHEMA\s*=\s*'sales'|schema_id/, "WHERE TABLE_SCHEMA = 'sales'."]],
    [[`SELECT TABLE_NAME`, 'Just the table names.'], [`FROM INFORMATION_SCHEMA.TABLES`, 'SQL Server’s list of every table and view.'], [`WHERE TABLE_SCHEMA = 'sales';`, 'Only the ones in the sales schema.']], { ok: ['d06', 'd02'] });

  R('d02', 1, 'Give me a list of our customers: just their ID, name, and city.', ['just their ID, name, and city'],
    'Three named columns from one table is a plain SELECT … FROM.', ['crm.Customers'], ['d03a', 'd06', 'd08'],
    [[/CustomerName/, 'The name column is CustomerName.'], [/FROM\s+crm\.Customers/, 'FROM crm.Customers.']],
    [[`SELECT CustomerID, CustomerName, City`, 'Name the three columns you want.'], [`FROM crm.Customers;`, 'They live in Customers, in the crm schema.']]);
  R('d02', 2, 'I need a product catalog extract with product name, category, and price. Please don’t send every column.', ['product name, category, and price', 'don’t send every column'],
    '“Don’t send every column” means naming exactly the columns you want instead of SELECT *.', ['catalog.Products'], ['d03a', 'd06', 'd11'],
    [[/SELECT\s+\*/, 'A named column list instead of SELECT *.', true], [/ProductName[\s\S]*Category[\s\S]*UnitPrice|UnitPrice[\s\S]*ProductName/, 'ProductName, Category and UnitPrice.']],
    [[`SELECT ProductName, Category, UnitPrice`, 'Only the three columns the manager asked for.'], [`FROM catalog.Products;`, 'Products live in the catalog schema.']]);
  R('d02', 3, 'Send me each employee’s name and department, with the headers called Employee and Team.', ['headers called Employee and Team'],
    '“Headers called …” means renaming columns with AS.', ['hr.Employees'], ['d11', 'd03b', 'd06'],
    [[/AS\s+\[?Employee\]?/, 'EmployeeName AS Employee.'], [/AS\s+\[?Team\]?/, 'Department AS Team.']],
    [[`SELECT EmployeeName AS Employee,`, 'AS gives the column a friendlier header.'], [`       Department   AS Team`, 'Same for the department.'], [`FROM hr.Employees;`, 'From the employee table in the hr schema.']]);

  R('d03a', 1, 'Which product categories do we sell? Just the list, no repeats.', ['no repeats'],
    '“No repeats” means each category once, however many products it has.', ['catalog.Products'], ['d16b', 'd06', 'd03b'],
    [[/DISTINCT\s+Category|GROUP\s+BY\s+Category/, 'SELECT DISTINCT Category.']],
    [[`SELECT DISTINCT Category`, 'Each category once.'], [`FROM catalog.Products;`, 'From the product list.']], { alt: [['d16b']] });
  R('d03a', 2, 'Which states do our customers live in? Each state once, A to Z.', ['Each state once', 'A to Z'],
    '“Each state once” is DISTINCT, and “A to Z” is an ORDER BY.', ['crm.Customers'], ['d16b', 'd06', 'd07'],
    [[/DISTINCT\s+StateCode/, 'SELECT DISTINCT StateCode.'], [/ORDER\s+BY\s+StateCode/, 'ORDER BY StateCode for A to Z.']],
    [[`SELECT DISTINCT StateCode`, 'Each state code once.'], [`FROM crm.Customers`, 'From the customers.'], [`ORDER BY StateCode;`, 'A to Z.']], { ok: ['d03b'] });
  R('d03a', 3, 'Which sales channels has each customer segment ordered through? One row per segment-and-channel pair.', ['One row per segment-and-channel pair'],
    'One row per pair means DISTINCT on two columns. The sales detail view already has both.', ['reporting.vSalesLineDetail'], ['d16b', 'd10', 'd03b'],
    [[/DISTINCT\s+[\w.]*CustomerSegment\s*,\s*[\w.]*Channel|DISTINCT\s+[\w.]*Channel\s*,\s*[\w.]*CustomerSegment|GROUP\s+BY/, 'SELECT DISTINCT CustomerSegment, Channel.']],
    [[`SELECT DISTINCT CustomerSegment, Channel`, 'Each unique pair once.'], [`FROM reporting.vSalesLineDetail`, 'This view already joins customers to orders.'], [`ORDER BY CustomerSegment, Channel;`, 'Tidy order, optional.']], { ok: ['d08', 'd03b'], alt: [['d16b']] });

  R('d03b', 1, 'Show me the five most expensive products.', ['five most expensive'],
    '“Five” means TOP (5), and “most expensive” means sorting by price, highest first.', ['catalog.Products'], ['d06', 'd16b', 'd20'],
    [[/TOP\s*\(?\s*5/, 'TOP (5) right after SELECT.'], [/ORDER\s+BY\s+UnitPrice\s+DESC/, 'ORDER BY UnitPrice DESC.']],
    [[`SELECT TOP (5) ProductName, UnitPrice`, 'TOP (5) keeps the first five rows.'], [`FROM catalog.Products`, 'From the products.'], [`ORDER BY UnitPrice DESC;`, 'Highest price first, so TOP keeps the right five.']]);
  R('d03b', 2, 'Show our ten newest orders, newest first, with friendly column names.', ['ten newest', 'newest first', 'friendly column names'],
    '“Ten newest” is TOP with ORDER BY … DESC; “friendly names” are AS aliases.', ['sales.Orders'], ['d06', 'd12', 'd20'],
    [[/TOP\s*\(?\s*10/, 'TOP (10).'], [/ORDER\s+BY\s+[\w.]*OrderDate\s+DESC|ORDER\s+BY\s+\[?Order Date\]?\s+DESC/, 'ORDER BY OrderDate DESC.'], [/\bAS\s+/, 'An AS alias or two for friendly names.']],
    [[`SELECT TOP (10) OrderID   AS [Order],`, 'Square brackets let a header have spaces.'], [`       OrderDate AS [Order Date],`, ''], [`       Channel`, ''], [`FROM sales.Orders`, ''], [`ORDER BY OrderDate DESC;`, 'Newest first.']]);
  R('d03b', 3, 'Give me the 8 orders with the biggest shipping fees, highest first.', ['8 orders', 'biggest shipping fees, highest first'],
    'A fixed count plus “highest first” is TOP with ORDER BY … DESC.', ['sales.Orders'], ['d16b', 'd06', 'd21'],
    [[/TOP\s*\(?\s*8/, 'TOP (8).'], [/ORDER\s+BY\s+ShippingFee\s+DESC/, 'ORDER BY ShippingFee DESC.']],
    [[`SELECT TOP (8) OrderID, ShippingFee`, 'Eight rows.'], [`FROM sales.Orders`, ''], [`ORDER BY ShippingFee DESC;`, 'Biggest first.']]);

  R('d04', 1, 'We want to collect feedback. Make a table called dbo.CustomerFeedback with FeedbackID, CustomerID, Rating, Comment and FeedbackDate.', ['Make a table'],
    '“Make a table” is DDL: CREATE TABLE.', [], ['d05', 'd02', 'd30'],
    [[/CREATE\s+TABLE\s+dbo\.CustomerFeedback/, 'CREATE TABLE dbo.CustomerFeedback.'], [/FeedbackID\s+INT/, 'A type for each column, like FeedbackID INT.']],
    [[`CREATE TABLE dbo.CustomerFeedback (`, 'Name the new table.'], [`  FeedbackID   INT IDENTITY PRIMARY KEY,`, 'IDENTITY numbers rows for you; PRIMARY KEY names each one.'], [`  CustomerID   INT NOT NULL,\n  Rating       TINYINT,\n  Comment      NVARCHAR(500),\n  FeedbackDate DATE`, 'Every column gets a data type.'], [`);`, 'Close the list.']]);
  R('d04', 2, 'Add a SourceSystem column to dbo.CustomerFeedback so we know where each row came from.', ['Add a SourceSystem column'],
    'Adding a column changes the table’s shape, so it’s ALTER TABLE.', [], ['d05', 'd02', 'd15'],
    [[/ALTER\s+TABLE\s+dbo\.CustomerFeedback/, 'ALTER TABLE dbo.CustomerFeedback.'], [/ADD\s+SourceSystem/, 'ADD SourceSystem with a type.']],
    [[`ALTER TABLE dbo.CustomerFeedback`, 'Change an existing table.'], [`  ADD SourceSystem VARCHAR(30) NULL;`, 'NULL lets the old rows stay valid.']], { no: { d05: 'UPDATE changes values in rows; it can’t add a new column. The table’s shape changes with ALTER TABLE.' } });
  R('d04', 3, 'The old dbo.TempImport table isn’t needed anymore. Remove it, safely, even if it’s already gone.', ['Remove it', 'even if it’s already gone'],
    'Removing a whole table is DROP TABLE; “even if it’s already gone” is IF EXISTS.', [], ['d05', 'd30', 'd28'],
    [[/DROP\s+TABLE\s+IF\s+EXISTS/, 'DROP TABLE IF EXISTS.']],
    [[`DROP TABLE IF EXISTS dbo.TempImport;`, 'IF EXISTS means no error if it’s already gone.']], { no: { d05: 'DELETE empties rows but leaves the table standing. The request wants the table itself gone.' } });

  R('d05', 1, 'Customer 4 moved to Portland, Oregon. Please update their city and state.', ['Customer 4', 'update their city and state'],
    '“Update” an existing row is UPDATE, and “Customer 4” is the key for the WHERE.', ['crm.Customers'], ['d04', 'd06', 'd02'],
    [[/UPDATE\s+crm\.Customers/, 'UPDATE crm.Customers.'], [/WHERE\s+CustomerID\s*=\s*4/, 'WHERE CustomerID = 4, so only one row changes.', false, 'Ran an UPDATE without a key-based WHERE.']],
    [[`UPDATE crm.Customers`, 'The table to change.'], [`SET City = 'Portland', StateCode = 'OR'`, 'The new values.'], [`WHERE CustomerID = 4;`, 'Only customer 4. Without this line, every customer would move.']]);
  R('d05', 2, 'Add a new Wellness product: Rose Hip Face Oil, $28 price, $11 cost, launching today.', ['Add a new Wellness product', 'launching today'],
    'A brand-new row is INSERT; “today” is GETDATE().', ['catalog.Products'], ['d04', 'd06', 'd13'],
    [[/INSERT\s+INTO\s+catalog\.Products/, 'INSERT INTO catalog.Products.'], [/GETDATE\s*\(\s*\)/, 'GETDATE() for today.']],
    [[`INSERT INTO catalog.Products`, 'Add a row to products.'], [`  (ProductName, Category, UnitPrice, UnitCost, IsActive, LaunchDate)`, 'List the columns you’re filling. (If ProductID isn’t automatic in your copy, add it here.)'], [`VALUES ('Rose Hip Face Oil', 'Wellness', 28.00, 11.00, 1, CAST(GETDATE() AS date));`, 'The values, in the same order.']]);
  R('d05', 3, 'Remove the test tickets: every support ticket whose notes contain the word TEST.', ['Remove the test tickets', 'contain the word TEST'],
    '“Remove” rows is DELETE, and “contain” is LIKE.', ['support.Tickets'], ['d04', 'd06', 'd02'],
    [[/DELETE\s+FROM\s+support\.Tickets/, 'DELETE FROM support.Tickets.'], [/LIKE\s+'%TEST%'/, "WHERE ResolutionNotes LIKE '%TEST%'.", false, 'Ran a DELETE without a WHERE.']],
    [[`-- preview first:\nSELECT * FROM support.Tickets WHERE ResolutionNotes LIKE '%TEST%';`, 'See exactly what will go.'], [`DELETE FROM support.Tickets`, 'Then delete…'], [`WHERE ResolutionNotes LIKE '%TEST%';`, '…only the test tickets.']], { ok: ['d07'] });

  R('d06', 1, 'Which products cost more than $40?', ['more than $40'],
    '“More than $40” is a test on each single product.', ['catalog.Products'], ['d16b', 'd03b', 'd07'],
    [[/WHERE\s+UnitPrice\s*>\s*40/, 'WHERE UnitPrice > 40.']],
    [[`SELECT ProductName, UnitPrice`, ''], [`FROM catalog.Products`, ''], [`WHERE UnitPrice > 40;`, 'Keep each product over $40.']], { no: { d16b: 'HAVING tests totals after grouping. A product’s price is right there on its own row, so WHERE is enough.' } });
  R('d06', 2, 'Show me active customers from Texas.', ['active', 'from Texas'],
    'Two tests on each row, both true: AND.', ['crm.Customers'], ['d16b', 'd07', 'd03a'],
    [[/IsActive\s*=\s*1/, 'IsActive = 1.'], [/StateCode\s*=\s*'TX'/, "StateCode = 'TX'."], [/AND/, 'AND, so both must be true.']],
    [[`SELECT CustomerName, City`, ''], [`FROM crm.Customers`, ''], [`WHERE IsActive = 1`, 'Active…'], [`  AND StateCode = 'TX';`, '…and in Texas.']]);
  R('d06', 3, 'Find orders that are Expedited or have a shipping fee over $15, but leave out anything Cancelled.', ['Expedited or', 'leave out anything Cancelled'],
    '“Or” joins two tests, and “leave out” adds a third that must always hold. Parentheses keep them in the right groups.', ['sales.Orders'], ['d07', 'd16a', 'd16b'],
    [[/\(\s*[\w.]*Priority\s*=\s*'Expedited'\s+OR|OR\s+[\w.]*Priority\s*=\s*'Expedited'\s*\)/, 'Parentheses around the OR part.'], [/Status\s*(<>|!=)\s*'Cancelled'|NOT\s+[\w.]*Status\s*=\s*'Cancelled'/, "Status <> 'Cancelled'."]],
    [[`SELECT OrderID, Priority, ShippingFee, Status`, ''], [`FROM sales.Orders`, ''], [`WHERE (Priority = 'Expedited' OR ShippingFee > 15)`, 'Either of these…'], [`  AND Status <> 'Cancelled';`, '…as long as it isn’t cancelled.']]);

  R('d07', 1, 'Which customers live in Texas, Colorado, or Washington?', ['Texas, Colorado, or Washington'],
    'A short list of allowed values is IN.', ['crm.Customers'], ['d06', 'd10', 'd03a'],
    [[/StateCode\s+IN\s*\(/, "StateCode IN ('TX', 'CO', 'WA')."]],
    [[`SELECT CustomerName, StateCode`, ''], [`FROM crm.Customers`, ''], [`WHERE StateCode IN ('TX', 'CO', 'WA');`, 'Any state in the list.']], { alt: [['d06']] });
  R('d07', 2, 'Which customers don’t have an email address on file?', ['don’t have an email'],
    'A missing value is NULL, and NULL is found with IS NULL.', ['crm.Customers'], ['d06', 'd15', 'd09'],
    [[/Email\s+IS\s+NULL/, 'WHERE Email IS NULL.', false, 'Used = NULL, which never matches.'], [/=\s*NULL/, 'IS NULL instead of = NULL.', true]],
    [[`SELECT CustomerName, Phone`, ''], [`FROM crm.Customers`, ''], [`WHERE Email IS NULL;`, '= NULL never matches; IS NULL does.']], { ok: ['d14'], alt: [['d14']] });
  R('d07', 3, 'Show order lines from March 2025 for any product with “Journal” in its name.', ['from March 2025', '“Journal” in its name'],
    'A date range is BETWEEN (or >= and <), and “in its name” is LIKE.', ['reporting.vSalesLineDetail'], ['d06', 'd08', 'd12'],
    [[/LIKE\s+'%Journal%'/, "ProductName LIKE '%Journal%'."], [/BETWEEN\s+'2025-03-01'|>=\s*'2025-03-01'/, "A March 2025 range on OrderDate."]],
    [[`SELECT OrderID, OrderDate, ProductName, Quantity`, ''], [`FROM reporting.vSalesLineDetail`, 'The view already joins orders to products.'], [`WHERE OrderDate >= '2025-03-01' AND OrderDate < '2025-04-01'`, 'All of March, even if times sneak in.'], [`  AND ProductName LIKE '%Journal%';`, '% means anything before or after.']], { ok: ['d08', 'd06'] });

  // ───────── PHASE 2 · COMBINE & TRANSFORM
  R('d08', 1, 'Show each order with the name of the customer who placed it.', ['with the name of the customer'],
    'Orders and customer names live in two tables, matched on CustomerID.', ['sales.Orders', 'crm.Customers'], ['d09', 'd24', 'd10'],
    [[/JOIN\s+crm\.Customers/, 'JOIN crm.Customers.'], [/ON\s+[\w.]*CustomerID\s*=\s*[\w.]*CustomerID/, 'ON c.CustomerID = o.CustomerID.']],
    [[`SELECT o.OrderID, o.OrderDate, c.CustomerName`, ''], [`FROM sales.Orders AS o`, 'Start from orders.'], [`INNER JOIN crm.Customers AS c`, 'Bring in customers…'], [`  ON c.CustomerID = o.CustomerID;`, '…matched on the shared key.']]);
  R('d08', 2, 'List each order with the name of the employee who handled it.', ['employee who handled it'],
    'Employee names live in hr.Employees, matched on EmployeeID.', ['sales.Orders', 'hr.Employees'], ['d09', 'd24', 'd16b'],
    [[/JOIN\s+hr\.Employees/, 'JOIN hr.Employees.'], [/ON\s+[\w.]*EmployeeID\s*=\s*[\w.]*EmployeeID/, 'ON e.EmployeeID = o.EmployeeID.']],
    [[`SELECT o.OrderID, e.EmployeeName`, ''], [`FROM sales.Orders AS o`, ''], [`INNER JOIN hr.Employees AS e`, ''], [`  ON e.EmployeeID = o.EmployeeID;`, 'The shared key.']]);
  R('d08', 3, 'For every order line, show the order date, the product name, and the quantity.', ['order date, the product name, and the quantity'],
    'Three facts from three tables: Orders, OrderItems and Products, chained by their keys.', ['sales.OrderItems', 'sales.Orders', 'catalog.Products'], ['d09', 'd10', 'd16b'],
    [[/JOIN\s+sales\.Orders|FROM\s+sales\.Orders/, 'sales.Orders for the date.'], [/JOIN\s+catalog\.Products/, 'JOIN catalog.Products for the name.']],
    [[`SELECT o.OrderDate, p.ProductName, oi.Quantity`, 'One row per order line.'], [`FROM sales.OrderItems AS oi`, 'Start from the lines.'], [`JOIN sales.Orders AS o\n  ON o.OrderID = oi.OrderID`, 'Each line belongs to one order.'], [`JOIN catalog.Products AS p\n  ON p.ProductID = oi.ProductID;`, 'Each line is one product.']], { ok: ['d09'] });

  R('d09', 1, 'Which customers have never placed an order?', ['never placed an order'],
    '“Never” means keeping customers who have no match in orders.', ['crm.Customers', 'sales.Orders'], ['d08', 'd06', 'd16b'],
    [[/LEFT\s+(OUTER\s+)?JOIN|NOT\s+EXISTS|NOT\s+IN/, 'A LEFT JOIN (or NOT EXISTS) to keep customers with no orders.'], [/IS\s+NULL|NOT\s+EXISTS|NOT\s+IN/, 'WHERE o.OrderID IS NULL, to keep only the gaps.', false, 'Forgot IS NULL after a LEFT JOIN.']],
    [[`SELECT c.CustomerID, c.CustomerName`, ''], [`FROM crm.Customers AS c`, 'Every customer.'], [`LEFT JOIN sales.Orders AS o\n  ON o.CustomerID = c.CustomerID`, 'Keep them even with no orders.'], [`WHERE o.OrderID IS NULL;`, 'Only the ones whose order box is empty.']],
    { alt: [['d25']], no: { d08: 'An INNER JOIN keeps only customers who do have an order. The people you want are exactly the ones it throws away.', d06: 'The “no order” fact lives in another table, so WHERE alone can’t see it.', d16b: 'Customers with zero orders never make it into a group to be counted.' } });
  R('d09', 2, 'Which products have never been ordered?', ['never been ordered'],
    '“Never” again: products with no match in sales.OrderItems.', ['catalog.Products', 'sales.OrderItems'], ['d08', 'd06', 'd10'],
    [[/LEFT\s+(OUTER\s+)?JOIN|NOT\s+EXISTS|NOT\s+IN|EXCEPT/, 'A LEFT JOIN to OrderItems.'], [/IS\s+NULL|NOT\s+EXISTS|NOT\s+IN|EXCEPT/, 'WHERE oi.OrderItemID IS NULL.']],
    [[`SELECT p.ProductID, p.ProductName`, ''], [`FROM catalog.Products AS p`, ''], [`LEFT JOIN sales.OrderItems AS oi\n  ON oi.ProductID = p.ProductID`, ''], [`WHERE oi.OrderItemID IS NULL;`, 'Products no line ever pointed to.']], { alt: [['d25'], ['d10']] });
  R('d09', 3, 'Show every customer with how many orders they’ve placed, including the ones with zero.', ['every customer', 'including the ones with zero'],
    '“Including zero” means LEFT JOIN, and “how many” means GROUP BY with a count.', ['crm.Customers', 'sales.Orders'], ['d08', 'd17', 'd06'],
    [[/LEFT\s+(OUTER\s+)?JOIN/, 'LEFT JOIN, so zero-order customers stay.'], [/COUNT\s*\(\s*[\w.]*OrderID\s*\)/, 'COUNT(o.OrderID), which counts 0 for no orders. COUNT(*) would say 1.', false, 'Used COUNT(*) after a LEFT JOIN, so zero-order customers showed 1.'], [/GROUP\s+BY/, 'GROUP BY the customer.']],
    [[`SELECT c.CustomerName, COUNT(o.OrderID) AS Orders`, 'COUNT(column) skips NULLs, so no orders → 0.'], [`FROM crm.Customers AS c`, ''], [`LEFT JOIN sales.Orders AS o\n  ON o.CustomerID = c.CustomerID`, ''], [`GROUP BY c.CustomerName;`, 'One row per customer.']], { need: ['d09', 'd16b'] });

  R('d10', 1, 'Give me one list of every customer who either placed a Web order or opened a support ticket. No repeats.', ['either placed a Web order or opened a support ticket', 'No repeats'],
    'Two separate lists of customers, merged without repeats: UNION.', ['sales.Orders', 'support.Tickets'], ['d08', 'd09', 'd03a'],
    [[/UNION(?!\s+ALL)/, 'UNION (not UNION ALL), to remove repeats.']],
    [[`SELECT CustomerID FROM sales.Orders WHERE Channel = 'Web'`, 'List one.'], [`UNION`, 'Merge, dropping repeats.'], [`SELECT CustomerID FROM support.Tickets;`, 'List two, same column.']], { no: { d08: 'A JOIN puts columns side by side for customers in both. Here you want anyone in either list, stacked into one.' } });
  R('d10', 2, 'Which customers opened a support ticket but have never placed an order?', ['opened a support ticket but have never placed an order'],
    '“In one list but not the other” is EXCEPT.', ['support.Tickets', 'sales.Orders'], ['d08', 'd16b', 'd03a'],
    [[/EXCEPT|NOT\s+EXISTS|NOT\s+IN|LEFT\s+JOIN/, 'EXCEPT between the two lists.']],
    [[`SELECT CustomerID FROM support.Tickets`, 'Everyone with a ticket…'], [`EXCEPT`, '…minus…'], [`SELECT CustomerID FROM sales.Orders;`, '…everyone who ordered.']], { alt: [['d25'], ['d09']] });
  R('d10', 3, 'Which customers both returned something and opened a support ticket?', ['both returned something and opened a support ticket'],
    '“Both” lists is INTERSECT. Returns only know the order, so go through sales.Orders to reach CustomerID.', ['sales.Returns', 'sales.Orders', 'support.Tickets'], ['d09', 'd03a', 'd25'],
    [[/INTERSECT|EXISTS|JOIN\s+support\.Tickets/, 'INTERSECT between the two lists.'], [/JOIN\s+sales\.Orders|FROM\s+sales\.Orders/, 'Join Returns to Orders to get CustomerID.']],
    [[`SELECT o.CustomerID\nFROM sales.Returns AS r\nJOIN sales.Orders AS o ON o.OrderID = r.OrderID`, 'Customers who returned something.'], [`INTERSECT`, 'Keep only those also in…'], [`SELECT CustomerID FROM support.Tickets;`, '…the ticket list.']], { ok: ['d08'], alt: [['d25', 'd08'], ['d08']] });

  R('d11', 1, 'Show customer names in capital letters for the mailing labels.', ['in capital letters'],
    'Changing how text looks is a string function: UPPER.', ['crm.Customers'], ['d16a', 'd02', 'd15'],
    [[/UPPER\s*\(\s*[\w.]*CustomerName/, 'UPPER(CustomerName).']],
    [[`SELECT UPPER(CustomerName) AS LabelName`, 'Capitals, with a friendly header.'], [`FROM crm.Customers;`, '']]);
  R('d11', 2, 'Build a label like “Amelia Hart (Austin, TX)” for each customer.', ['Build a label like'],
    'Gluing text pieces together is concatenation: + in T-SQL (or CONCAT).', ['crm.Customers'], ['d16a', 'd15', 'd02'],
    [[/\+\s*' \('|CONCAT\s*\(/, "Glue pieces with + ' (' + …"]],
    [[`SELECT CustomerName + ' (' + City + ', ' + StateCode + ')'`, 'T-SQL glues text with +.'], [`       AS CustomerLabel`, ''], [`FROM crm.Customers;`, '']]);
  R('d11', 3, 'For each product, show its margin per unit rounded to 2 decimals, and a 3-letter category code in capitals.', ['rounded to 2 decimals', '3-letter category code in capitals'],
    '“Rounded” is ROUND; “3-letter code in capitals” is UPPER(LEFT(…, 3)).', ['catalog.Products'], ['d16a', 'd13', 'd18'],
    [[/ROUND\s*\(/, 'ROUND(UnitPrice - UnitCost, 2).'], [/LEFT\s*\(\s*[\w.]*Category\s*,\s*3\s*\)/, 'LEFT(Category, 3).']],
    [[`SELECT ProductName,`, ''], [`       ROUND(UnitPrice - UnitCost, 2) AS Margin,`, 'Price minus cost, to 2 decimals.'], [`       UPPER(LEFT(Category, 3))        AS CatCode`, 'First 3 letters, in capitals.'], [`FROM catalog.Products;`, '']]);

  R('d12', 1, 'For each order, show the year and the month it was placed.', ['the year and the month'],
    'Pulling a piece out of a date is YEAR and MONTH.', ['sales.Orders'], ['d13', 'd16b', 'd11'],
    [[/YEAR\s*\(\s*[\w.]*OrderDate/, 'YEAR(OrderDate).'], [/MONTH\s*\(\s*[\w.]*OrderDate|DATEPART\s*\(\s*month/, 'MONTH(OrderDate).']],
    [[`SELECT OrderID,`, ''], [`       YEAR(OrderDate)  AS OrderYear,`, ''], [`       MONTH(OrderDate) AS OrderMonth`, ''], [`FROM sales.Orders;`, '']]);
  R('d12', 2, 'How many orders did we get in each quarter of 2025?', ['each quarter of 2025'],
    '“Each quarter” is DATEPART(quarter, …) grouped; “how many” is COUNT.', ['sales.Orders'], ['d13', 'd06', 'd17'],
    [[/DATEPART\s*\(\s*(quarter|qq|q)\s*,/, 'DATEPART(quarter, OrderDate).'], [/GROUP\s+BY/, 'GROUP BY the quarter.']],
    [[`SELECT DATEPART(quarter, OrderDate) AS Qtr, COUNT(*) AS Orders`, ''], [`FROM sales.Orders`, ''], [`WHERE OrderDate >= '2025-01-01' AND OrderDate < '2026-01-01'`, 'Only 2025, written as a range.'], [`GROUP BY DATEPART(quarter, OrderDate)\nORDER BY Qtr;`, 'One row per quarter.']], { need: ['d12', 'd16b'], ok: ['d06'] });
  R('d12', 3, 'Which orders came in on a weekend?', ['on a weekend'],
    '“Weekend” is a weekday name: DATENAME(weekday, …).', ['sales.Orders'], ['d13', 'd16a', 'd03b'],
    [[/DATENAME\s*\(\s*(weekday|dw)\s*,|DATEPART\s*\(\s*(weekday|dw)\s*,/, 'DATENAME(weekday, OrderDate).']],
    [[`SELECT OrderID, OrderDate, DATENAME(weekday, OrderDate) AS DayName`, ''], [`FROM sales.Orders`, ''], [`WHERE DATENAME(weekday, OrderDate) IN ('Saturday', 'Sunday');`, 'Weekend names.']], { ok: ['d07', 'd06'] });

  R('d13', 1, 'How many days did each shipped order take to ship?', ['How many days', 'take to ship'],
    '“How many days between” is DATEDIFF(day, …).', ['sales.Orders'], ['d12', 'd16b', 'd14'],
    [[/DATEDIFF\s*\(\s*(day|dd|d)\s*,\s*[\w.]*OrderDate\s*,\s*[\w.]*ShippedDate/, 'DATEDIFF(day, OrderDate, ShippedDate).']],
    [[`SELECT OrderID,`, ''], [`       DATEDIFF(day, OrderDate, ShippedDate) AS DaysToShip`, 'Start date first, end date second.'], [`FROM sales.Orders`, ''], [`WHERE ShippedDate IS NOT NULL;`, 'Only shipped orders.']], { ok: ['d07', 'd14'] });
  R('d13', 2, 'Show orders from the last 90 days, without typing in a fixed date.', ['last 90 days', 'without typing in a fixed date'],
    'Moving back from today is DATEADD(day, -90, GETDATE()).', ['sales.Orders'], ['d12', 'd06', 'd07'],
    [[/DATEADD\s*\(\s*(day|dd|d)\s*,\s*-\s*90\s*,\s*(CAST\s*\(\s*)?GETDATE/, 'DATEADD(day, -90, GETDATE()).']],
    [[`SELECT OrderID, OrderDate`, ''], [`FROM sales.Orders`, ''], [`WHERE OrderDate >= DATEADD(day, -90, CAST(GETDATE() AS date));`, 'Ninety days back from today.']], { ok: ['d06'] });
  R('d13', 3, 'For resolved support tickets, how many hours did each take to resolve?', ['how many hours', 'resolved support tickets'],
    '“How many hours” is DATEDIFF(hour, …); “resolved” means ResolvedDate is filled in.', ['support.Tickets'], ['d12', 'd14', 'd16b'],
    [[/DATEDIFF\s*\(\s*(hour|hh)\s*,\s*[\w.]*OpenedDate\s*,\s*[\w.]*ResolvedDate/, 'DATEDIFF(hour, OpenedDate, ResolvedDate).'], [/ResolvedDate\s+IS\s+NOT\s+NULL|Status\s*=\s*'Resolved'/, 'Only resolved tickets.']],
    [[`SELECT TicketID,`, ''], [`       DATEDIFF(hour, OpenedDate, ResolvedDate) AS HoursToResolve`, ''], [`FROM support.Tickets`, ''], [`WHERE ResolvedDate IS NOT NULL;`, 'Skip open tickets.']], { ok: ['d07', 'd14'] });

  R('d14', 1, 'How many customers do we have, and how many of them have an email address?', ['how many of them have an email'],
    'COUNT(*) counts every row; COUNT(Email) skips the missing ones. The pair answers both halves.', ['crm.Customers'], ['d07', 'd15', 'd16b'],
    [[/COUNT\s*\(\s*\*\s*\)/, 'COUNT(*) for everyone.'], [/COUNT\s*\(\s*Email\s*\)/, 'COUNT(Email) for those with an email.']],
    [[`SELECT COUNT(*)     AS Customers,`, 'Every row.'], [`       COUNT(Email) AS WithEmail`, 'Skips NULLs.'], [`FROM crm.Customers;`, '']]);
  R('d14', 2, 'Which orders haven’t shipped yet?', ['haven’t shipped yet'],
    'Not shipped means ShippedDate is unknown: NULL.', ['sales.Orders'], ['d06', 'd13', 'd15'],
    [[/ShippedDate\s+IS\s+NULL/, 'WHERE ShippedDate IS NULL.'], [/=\s*NULL/, 'IS NULL instead of = NULL.', true]],
    [[`SELECT OrderID, OrderDate, Status`, ''], [`FROM sales.Orders`, ''], [`WHERE ShippedDate IS NULL;`, 'No ship date yet.']], { alt: [['d07']], ok: ['d07'] });
  R('d14', 3, 'How many support tickets are still unresolved, out of all tickets?', ['still unresolved, out of all tickets'],
    'All tickets is COUNT(*); resolved ones are COUNT(ResolvedDate); the gap is the unresolved.', ['support.Tickets'], ['d07', 'd16b', 'd15'],
    [[/COUNT\s*\(\s*\*\s*\)/, 'COUNT(*) for all tickets.'], [/COUNT\s*\(\s*ResolvedDate\s*\)|ResolvedDate\s+IS\s+NULL/, 'COUNT(ResolvedDate) or IS NULL for unresolved.']],
    [[`SELECT COUNT(*) AS AllTickets,`, ''], [`       COUNT(*) - COUNT(ResolvedDate) AS Unresolved`, 'COUNT(ResolvedDate) skips the NULLs.'], [`FROM support.Tickets;`, '']], { alt: [['d07']] });

  R('d15', 1, 'Show customer emails, but write “No email” where it’s missing.', ['write “No email” where it’s missing'],
    'A stand-in for a missing value is ISNULL (or COALESCE).', ['crm.Customers'], ['d07', 'd16a', 'd14'],
    [[/ISNULL\s*\(\s*Email|COALESCE\s*\(\s*Email/, "ISNULL(Email, 'No email')."]],
    [[`SELECT CustomerName,`, ''], [`       ISNULL(Email, 'No email') AS EmailShown`, 'Shown only; the real column is unchanged.'], [`FROM crm.Customers;`, '']], { no: { d07: 'IS NULL finds the rows with no email. The request wants to keep every row and show a stand-in.' }, alt: [['d16a']] });
  R('d15', 2, 'Work out each order’s net charge: shipping fee minus discount, treating a missing discount as 0.', ['treating a missing discount as 0'],
    'Math with NULL gives NULL, so the discount needs ISNULL(…, 0) first.', ['sales.Orders'], ['d14', 'd11', 'd16a'],
    [[/ISNULL\s*\(\s*DiscountAmount\s*,\s*0\s*\)|COALESCE\s*\(\s*DiscountAmount\s*,\s*0\s*\)/, 'ISNULL(DiscountAmount, 0).']],
    [[`SELECT OrderID,`, ''], [`       ShippingFee - ISNULL(DiscountAmount, 0) AS NetCharge`, 'Without ISNULL, a missing discount makes the whole answer NULL.'], [`FROM sales.Orders;`, '']]);
  R('d15', 3, 'Give each customer one contact: their email if we have it, otherwise their phone, otherwise “No contact.”', ['email if we have it, otherwise their phone, otherwise'],
    'A chain of backups is COALESCE: the first one that isn’t NULL wins.', ['crm.Customers'], ['d16a', 'd07', 'd14'],
    [[/COALESCE\s*\(\s*Email\s*,\s*Phone/, "COALESCE(Email, Phone, 'No contact')."]],
    [[`SELECT CustomerName,`, ''], [`       COALESCE(Email, Phone, 'No contact') AS BestContact`, 'Checks left to right.'], [`FROM crm.Customers;`, '']], { alt: [['d16a']] });

  R('d16a', 1, 'Tag each product as Budget (under $20), Mid (under $50) or Premium.', ['Tag each product'],
    '“Tag each” means every row stays and gets a label by rules: CASE.', ['catalog.Products'], ['d06', 'd16b', 'd03b'],
    [[/CASE[\s\S]*WHEN[\s\S]*THEN/, 'CASE WHEN … THEN … rules.'], [/\bEND\b/, 'END to close the CASE.']],
    [[`SELECT ProductName, UnitPrice,`, ''], [`  CASE WHEN UnitPrice < 20 THEN 'Budget'`, 'First rule.'], [`       WHEN UnitPrice < 50 THEN 'Mid'`, 'Checked only if the first didn’t match.'], [`       ELSE 'Premium' END AS PriceBand`, 'Everything else.'], [`FROM catalog.Products;`, '']], { no: { d06: 'WHERE decides which rows stay. Here every product stays; you’re writing a label beside each.' } });
  R('d16a', 2, 'Label each shipped order “Late” if it took more than 5 days to ship, otherwise “On time.”', ['Label each shipped order', 'more than 5 days'],
    '“Label … otherwise” is CASE, and the 5 days is DATEDIFF.', ['sales.Orders'], ['d06', 'd12', 'd16b'],
    [[/CASE\s+WHEN\s+DATEDIFF/, 'CASE WHEN DATEDIFF(day, OrderDate, ShippedDate) > 5.'], [/ELSE\s+'On time'/, "ELSE 'On time'."]],
    [[`SELECT OrderID,`, ''], [`  CASE WHEN DATEDIFF(day, OrderDate, ShippedDate) > 5`, ''], [`       THEN 'Late' ELSE 'On time' END AS ShipStatus`, ''], [`FROM sales.Orders\nWHERE ShippedDate IS NOT NULL;`, 'Only shipped orders.']], { ok: ['d13', 'd07'] });
  R('d16a', 3, 'How many products fall into each price band: Budget, Mid and Premium?', ['each price band', 'How many'],
    'Bands come from CASE; “how many in each” is GROUP BY.', ['catalog.Products'], ['d06', 'd03a', 'd20'],
    [[/CASE[\s\S]*END/, 'A CASE for the bands.'], [/GROUP\s+BY/, 'GROUP BY the band.']],
    [[`SELECT PriceBand, COUNT(*) AS Products`, ''], [`FROM (\n  SELECT CASE WHEN UnitPrice < 20 THEN 'Budget'\n              WHEN UnitPrice < 50 THEN 'Mid'\n              ELSE 'Premium' END AS PriceBand\n  FROM catalog.Products\n) AS b`, 'Label first.'], [`GROUP BY PriceBand;`, 'Then count each label.']], { need: ['d16a', 'd16b'], ok: ['d24', 'd26'] });

  R('d16b', 1, 'How many orders came through each channel?', ['each channel', 'How many'],
    '“Each channel” means one row per channel; “how many” is COUNT.', ['sales.Orders'], ['d03a', 'd17', 'd06'],
    [[/GROUP\s+BY\s+Channel/, 'GROUP BY Channel.'], [/COUNT\s*\(/, 'COUNT(*).']],
    [[`SELECT Channel, COUNT(*) AS Orders`, ''], [`FROM sales.Orders`, ''], [`GROUP BY Channel;`, 'One pile per channel.']]);
  R('d16b', 2, 'Which customers have placed more than 3 orders?', ['more than 3 orders'],
    '“More than 3 orders” is a count. You can only test it after grouping, so it’s HAVING.', ['sales.Orders'], ['d06', 'd03a', 'd17'],
    [[/GROUP\s+BY/, 'GROUP BY CustomerID.'], [/HAVING\s+COUNT/, 'HAVING COUNT(*) > 3.', false, 'Tested a count in WHERE instead of HAVING.']],
    [[`SELECT CustomerID, COUNT(*) AS Orders`, ''], [`FROM sales.Orders`, ''], [`GROUP BY CustomerID`, 'One pile per customer.'], [`HAVING COUNT(*) > 3;`, 'Keep the piles with more than 3.']],
    { no: { d06: 'WHERE looks at one order at a time, and one order can’t know how many others there are. The count only exists after grouping.' } });
  R('d16b', 3, 'Which categories brought in more than $5,000 in revenue?', ['Which categories', 'more than $5,000 in revenue'],
    'Per category, filtered on a total: GROUP BY with HAVING.', ['reporting.vSalesLineDetail'], ['d06', 'd18', 'd03b'],
    [[/GROUP\s+BY\s+[\w.]*Category/, 'GROUP BY Category.'], [/HAVING\s+SUM/, 'HAVING SUM(LineRevenue) > 5000.', false, 'Tested a total in WHERE instead of HAVING.']],
    [[`SELECT Category, SUM(LineRevenue) AS Revenue`, ''], [`FROM reporting.vSalesLineDetail`, 'LineRevenue is already worked out here.'], [`GROUP BY Category`, ''], [`HAVING SUM(LineRevenue) > 5000;`, 'Filter the totals.']],
    { ok: ['d08'], no: { d06: 'WHERE checks one sale at a time, and no single sale is $5,000. The total only exists after grouping.' } });

  // ───────── PHASE 3 · ANALYTICAL SQL
  R('d17', 1, 'Show every order, and beside it how many orders that customer has placed in total.', ['every order', 'beside it'],
    '“Every order … beside it” keeps the rows and adds a group count: a window.', ['sales.Orders'], ['d16b', 'd20', 'd24'],
    [[/COUNT\s*\(\s*\*\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*CustomerID/, 'COUNT(*) OVER (PARTITION BY CustomerID).']],
    [[`SELECT OrderID, CustomerID,`, ''], [`       COUNT(*) OVER (PARTITION BY CustomerID) AS CustomerOrders`, 'Counted across this customer’s rows, written on every row.'], [`FROM sales.Orders;`, '']],
    { alt: [['d18']], no: { d16b: 'GROUP BY would squash each customer into one row. The request wants every order kept.' } });
  R('d17', 2, 'Show every product with its category’s average price next to it.', ['every product', 'next to it'],
    'Keep every product, add a group average beside it: AVG() OVER.', ['catalog.Products'], ['d16b', 'd24', 'd20'],
    [[/AVG\s*\(\s*[\w.]*UnitPrice\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*Category/, 'AVG(UnitPrice) OVER (PARTITION BY Category).']],
    [[`SELECT ProductName, Category, UnitPrice,`, ''], [`       AVG(UnitPrice) OVER (PARTITION BY Category) AS CategoryAvg`, ''], [`FROM catalog.Products;`, '']], { alt: [['d18']] });
  R('d17', 3, 'For each order line, show what share of that order’s revenue it makes up.', ['each order line', 'share of that order’s revenue'],
    'Each line divided by its order’s total; the total comes from SUM() OVER (PARTITION BY OrderID).', ['reporting.vSalesLineDetail'], ['d16b', 'd24', 'd49'],
    [[/SUM\s*\(\s*[\w.]*LineRevenue\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*OrderID/, 'SUM(LineRevenue) OVER (PARTITION BY OrderID).']],
    [[`SELECT OrderID, ProductName, LineRevenue,`, ''], [`       LineRevenue / SUM(LineRevenue) OVER (PARTITION BY OrderID)`, 'This line ÷ the order’s total.'], [`         AS ShareOfOrder`, ''], [`FROM reporting.vSalesLineDetail;`, '']], { alt: [['d18']] });

  R('d18', 1, 'Beside each sales line, show the total revenue for its category.', ['Beside each sales line', 'total revenue for its category'],
    'A category total written on every line: SUM() OVER (PARTITION BY Category).', ['reporting.vSalesLineDetail'], ['d16b', 'd19', 'd24'],
    [[/SUM\s*\(\s*[\w.]*LineRevenue\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*Category\s*\)/, 'SUM(LineRevenue) OVER (PARTITION BY Category).']],
    [[`SELECT OrderID, Category, LineRevenue,`, ''], [`       SUM(LineRevenue) OVER (PARTITION BY Category) AS CategoryRevenue`, ''], [`FROM reporting.vSalesLineDetail;`, '']], { alt: [['d17']] });
  R('d18', 2, 'Show each product’s price and how far it sits above or below its category average.', ['how far it sits above or below its category average'],
    'Price minus a category average that sits beside each row.', ['catalog.Products'], ['d16b', 'd24', 'd11'],
    [[/UnitPrice\s*-\s*AVG\s*\(\s*[\w.]*UnitPrice\s*\)\s*OVER/, 'UnitPrice - AVG(UnitPrice) OVER (PARTITION BY Category).']],
    [[`SELECT ProductName, Category, UnitPrice,`, ''], [`       UnitPrice - AVG(UnitPrice) OVER (PARTITION BY Category) AS VsCategory`, 'Positive = above average.'], [`FROM catalog.Products;`, '']], { alt: [['d17'], ['d24']] });
  R('d18', 3, 'For each order line, show the smallest and largest line in that same order.', ['smallest and largest line in that same order'],
    'MIN and MAX across the order’s lines, kept beside each line.', ['reporting.vSalesLineDetail'], ['d16b', 'd20', 'd23'],
    [[/MIN\s*\(\s*[\w.]*LineRevenue\s*\)\s*OVER/, 'MIN(LineRevenue) OVER (PARTITION BY OrderID).'], [/MAX\s*\(\s*[\w.]*LineRevenue\s*\)\s*OVER/, 'MAX(LineRevenue) OVER (PARTITION BY OrderID).']],
    [[`SELECT OrderID, ProductName, LineRevenue,`, ''], [`       MIN(LineRevenue) OVER (PARTITION BY OrderID) AS SmallestLine,`, ''], [`       MAX(LineRevenue) OVER (PARTITION BY OrderID) AS LargestLine`, ''], [`FROM reporting.vSalesLineDetail;`, '']], { alt: [['d17']] });

  R('d19', 1, 'How much revenue had we built up by each day? I’d like a running total by order date.', ['built up by each day', 'running total'],
    '“Built up … running total” is a SUM that grows in date order.', ['reporting.vSalesLineDetail'], ['d18', 'd16b', 'd22'],
    [[/SUM\s*\(\s*SUM\s*\(\s*[\w.]*LineRevenue\s*\)\s*\)\s*OVER\s*\(\s*ORDER\s+BY|SUM\s*\(\s*\w+\s*\)\s*OVER\s*\(\s*ORDER\s+BY/, 'SUM(…) OVER (ORDER BY OrderDate).']],
    [[`SELECT OrderDate,`, ''], [`       SUM(LineRevenue) AS DayRevenue,`, 'Each day’s revenue…'], [`       SUM(SUM(LineRevenue)) OVER (ORDER BY OrderDate) AS RunningRevenue`, '…added up as the days go by.'], [`FROM reporting.vSalesLineDetail\nGROUP BY OrderDate;`, 'One row per day.']], { ok: ['d16b', 'd26'] });
  R('d19', 2, 'Show a running revenue total for each category, by date.', ['running revenue total for each category'],
    'A running total that restarts per category: PARTITION BY Category ORDER BY OrderDate.', ['reporting.vSalesLineDetail'], ['d18', 'd20', 'd16b'],
    [[/OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*Category\s+ORDER\s+BY\s+[\w.]*OrderDate/, 'OVER (PARTITION BY Category ORDER BY OrderDate).']],
    [[`SELECT Category, OrderDate, LineRevenue,`, ''], [`       SUM(LineRevenue) OVER (PARTITION BY Category ORDER BY OrderDate`, 'Restart per category, grow by date.'], [`         ROWS UNBOUNDED PRECEDING) AS RunningRevenue`, 'Everything up to this row.'], [`FROM reporting.vSalesLineDetail;`, '']]);
  R('d19', 3, 'Show a 7-day moving average of daily revenue.', ['7-day moving average'],
    'A moving average looks only at a short stretch of rows: ROWS BETWEEN 6 PRECEDING AND CURRENT ROW.', ['reporting.vSalesLineDetail'], ['d18', 'd22', 'd13'],
    [[/AVG\s*\([\s\S]*OVER\s*\([\s\S]*ROWS\s+BETWEEN\s+6\s+PRECEDING\s+AND\s+CURRENT\s+ROW/, 'AVG(…) OVER (ORDER BY OrderDate ROWS BETWEEN 6 PRECEDING AND CURRENT ROW).']],
    [[`WITH Daily AS (\n  SELECT OrderDate, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY OrderDate\n)`, 'First, one row per day.'], [`SELECT OrderDate, Revenue,`, ''], [`       AVG(Revenue) OVER (ORDER BY OrderDate\n         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS MovingAvg7`, 'Today and the six rows before.'], [`FROM Daily;`, '']], { ok: ['d16b', 'd26'] });

  R('d20', 1, 'Rank products by price within each category, most expensive first.', ['Rank products', 'within each category'],
    '“Rank … within each” keeps every product and writes a position that restarts per category.', ['catalog.Products'], ['d16b', 'd03b', 'd21'],
    [[/(RANK|ROW_NUMBER|DENSE_RANK)\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*Category\s+ORDER\s+BY\s+[\w.]*UnitPrice\s+DESC/, 'RANK() OVER (PARTITION BY Category ORDER BY UnitPrice DESC).']],
    [[`SELECT ProductName, Category, UnitPrice,`, ''], [`       RANK() OVER (PARTITION BY Category`, 'Restart in each category…'], [`                    ORDER BY UnitPrice DESC) AS PriceRank`, '…highest price is 1.'], [`FROM catalog.Products;`, '']],
    { no: { d16b: 'GROUP BY squashes each category into one row, so the products disappear. You want every product with a rank beside it.', d03b: 'ORDER BY lines them up, but doesn’t write a rank, and doesn’t restart per category.' } });
  R('d20', 2, 'Number each customer’s orders from newest to oldest.', ['Number each customer’s orders'],
    'A 1, 2, 3 count per customer, with no ties: ROW_NUMBER.', ['sales.Orders'], ['d03b', 'd16b', 'd22'],
    [[/ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*CustomerID\s+ORDER\s+BY\s+[\w.]*OrderDate\s+DESC/, 'ROW_NUMBER() OVER (PARTITION BY CustomerID ORDER BY OrderDate DESC).']],
    [[`SELECT CustomerID, OrderID, OrderDate,`, ''], [`       ROW_NUMBER() OVER (PARTITION BY CustomerID`, ''], [`                          ORDER BY OrderDate DESC) AS OrderNumber`, 'Newest = 1.'], [`FROM sales.Orders;`, '']], { no: { d03b: 'Sorting lines orders up but doesn’t write a number that restarts for each customer.' } });
  R('d20', 3, 'Rank employees by how many orders they handled. Tied people should share a rank, with no numbers skipped.', ['share a rank, with no numbers skipped'],
    '“Share a rank, no skipping” is DENSE_RANK, over a count from GROUP BY.', ['sales.Orders', 'hr.Employees'], ['d03b', 'd21', 'd18'],
    [[/DENSE_RANK\s*\(\s*\)\s*OVER/, 'DENSE_RANK(), so ties don’t skip.'], [/GROUP\s+BY/, 'GROUP BY the employee to count orders.']],
    [[`SELECT e.EmployeeName, COUNT(*) AS Orders,`, ''], [`       DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS OrderRank`, 'Ranks the counts; ties share, nothing skipped.'], [`FROM sales.Orders AS o\nJOIN hr.Employees AS e ON e.EmployeeID = o.EmployeeID`, ''], [`GROUP BY e.EmployeeName;`, '']], { ok: ['d16b', 'd08'] });

  R('d21', 1, 'Show the 3 most expensive products in every category.', ['3 most expensive', 'in every category'],
    '“Top 3 in every category” needs a rank that restarts per category, then a filter on it.', ['catalog.Products'], ['d03b', 'd16b', 'd06'],
    [[/ROW_NUMBER|RANK|DENSE_RANK/, 'ROW_NUMBER() OVER (PARTITION BY Category ORDER BY UnitPrice DESC).'], [/<=\s*3/, 'WHERE rn <= 3, outside the ranking step.']],
    [[`WITH Ranked AS (\n  SELECT ProductName, Category, UnitPrice,\n         ROW_NUMBER() OVER (PARTITION BY Category\n                            ORDER BY UnitPrice DESC) AS rn\n  FROM catalog.Products\n)`, 'Rank inside each category.'], [`SELECT ProductName, Category, UnitPrice`, ''], [`FROM Ranked`, ''], [`WHERE rn <= 3;`, 'A rank can’t be filtered in the same step, so filter outside.']],
    { ok: ['d20', 'd26'], alt: [['d20']], no: { d03b: 'TOP (3) keeps three products overall, not three per category.' } });
  R('d21', 2, 'Show each customer’s most recent order only.', ['most recent order only'],
    '“Most recent … only” per customer is ROW_NUMBER = 1.', ['sales.Orders'], ['d03b', 'd16b', 'd22'],
    [[/ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*CustomerID/, 'ROW_NUMBER() OVER (PARTITION BY CustomerID ORDER BY OrderDate DESC).'], [/=\s*1\b/, 'WHERE rn = 1.']],
    [[`WITH Latest AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY CustomerID\n                               ORDER BY OrderDate DESC) AS rn\n  FROM sales.Orders\n)`, ''], [`SELECT OrderID, CustomerID, OrderDate`, ''], [`FROM Latest`, ''], [`WHERE rn = 1;`, 'The newest per customer.']], { ok: ['d20', 'd26'], alt: [['d20']] });
  R('d21', 3, 'Split customers into four spend bands, with the top 25% of spenders as band 1.', ['four spend bands', 'top 25%'],
    '“Four even bands” is NTILE(4), over each customer’s total spend.', ['reporting.vSalesLineDetail'], ['d16a', 'd20', 'd16b'],
    [[/NTILE\s*\(\s*4\s*\)/, 'NTILE(4) OVER (ORDER BY spend DESC).'], [/SUM\s*\(\s*[\w.]*LineRevenue/, 'SUM(LineRevenue) per customer first.']],
    [[`SELECT CustomerID, SUM(LineRevenue) AS Spend,`, ''], [`       NTILE(4) OVER (ORDER BY SUM(LineRevenue) DESC) AS SpendBand`, 'Four equal-sized groups; 1 = top spenders.'], [`FROM reporting.vSalesLineDetail`, ''], [`GROUP BY CustomerID;`, '']], { ok: ['d16b', 'd26'], no: { d16a: 'CASE bands use fixed dollar cutoffs. “Top 25%” is about position, so NTILE fits better.' } });

  R('d22', 1, 'Beside each order, show the date of that customer’s previous order.', ['previous order'],
    '“Previous” row for the same customer is LAG.', ['sales.Orders'], ['d20', 'd23', 'd24'],
    [[/LAG\s*\(\s*[\w.]*OrderDate\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+[\w.]*CustomerID\s+ORDER\s+BY\s+[\w.]*OrderDate/, 'LAG(OrderDate) OVER (PARTITION BY CustomerID ORDER BY OrderDate).']],
    [[`SELECT CustomerID, OrderID, OrderDate,`, ''], [`       LAG(OrderDate) OVER (PARTITION BY CustomerID`, 'Look one row back…'], [`                            ORDER BY OrderDate) AS PrevOrderDate`, '…in date order.'], [`FROM sales.Orders;`, '']]);
  R('d22', 2, 'Show monthly revenue and how much it changed from the month before.', ['changed from the month before'],
    'Compare each month with the previous one: LAG over monthly totals.', ['reporting.vSalesLineDetail'], ['d19', 'd18', 'd20'],
    [[/LAG\s*\(/, 'LAG(Revenue) OVER (ORDER BY Month).'], [/GROUP\s+BY/, 'GROUP BY the month first.']],
    [[`WITH Monthly AS (\n  SELECT DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1) AS Mth,\n         SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1)\n)`, 'One row per month.'], [`SELECT Mth, Revenue,`, ''], [`       Revenue - LAG(Revenue) OVER (ORDER BY Mth) AS ChangeVsPrev`, 'This month minus last month.'], [`FROM Monthly;`, '']], { ok: ['d12', 'd16b', 'd26'] });
  R('d22', 3, 'Which customers came back after a gap of more than 60 days between orders?', ['came back after a gap of more than 60 days'],
    'The gap between an order and the previous one is LAG plus DATEDIFF.', ['sales.Orders'], ['d16b', 'd23', 'd13'],
    [[/LAG\s*\(\s*[\w.]*OrderDate/, 'LAG(OrderDate) per customer.'], [/DATEDIFF\s*\(\s*day[\s\S]*>\s*60/, 'DATEDIFF(day, PrevOrderDate, OrderDate) > 60.']],
    [[`WITH Gaps AS (\n  SELECT CustomerID, OrderDate,\n         LAG(OrderDate) OVER (PARTITION BY CustomerID ORDER BY OrderDate) AS Prev\n  FROM sales.Orders\n)`, 'Previous order beside each one.'], [`SELECT DISTINCT CustomerID`, ''], [`FROM Gaps`, ''], [`WHERE DATEDIFF(day, Prev, OrderDate) > 60;`, 'Gaps over 60 days.']], { ok: ['d13', 'd26', 'd03a'] });

  R('d23', 1, 'Beside every order, show that customer’s first-ever order date.', ['first-ever order date'],
    '“First-ever” beside every row is FIRST_VALUE (or MIN() OVER).', ['sales.Orders'], ['d16b', 'd22', 'd20'],
    [[/FIRST_VALUE\s*\(\s*[\w.]*OrderDate\s*\)\s*OVER|MIN\s*\(\s*[\w.]*OrderDate\s*\)\s*OVER/, 'FIRST_VALUE(OrderDate) OVER (PARTITION BY CustomerID ORDER BY OrderDate).']],
    [[`SELECT CustomerID, OrderID, OrderDate,`, ''], [`       FIRST_VALUE(OrderDate) OVER (PARTITION BY CustomerID`, ''], [`                                    ORDER BY OrderDate) AS FirstOrder`, ''], [`FROM sales.Orders;`, '']], { alt: [['d18']] });
  R('d23', 2, 'Beside every order, show that customer’s latest order date.', ['latest order date'],
    'LAST_VALUE works only with a frame that reaches the end of the group.', ['sales.Orders'], ['d22', 'd16b', 'd20'],
    [[/LAST_VALUE[\s\S]*UNBOUNDED\s+FOLLOWING|MAX\s*\(\s*[\w.]*OrderDate\s*\)\s*OVER/, 'LAST_VALUE(…) with ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.', false, 'Used LAST_VALUE without the full frame, so it returned the current row.']],
    [[`SELECT CustomerID, OrderID, OrderDate,`, ''], [`       LAST_VALUE(OrderDate) OVER (PARTITION BY CustomerID ORDER BY OrderDate`, ''], [`         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS LatestOrder`, 'Without this frame it would stop at the current row.'], [`FROM sales.Orders;`, '']], { alt: [['d18']] });
  R('d23', 3, 'For repeat customers, how many days passed between their first and latest order?', ['repeat customers', 'between their first and latest order'],
    'One row per customer with first and latest dates: MIN and MAX in GROUP BY, then DATEDIFF.', ['sales.Orders'], ['d22', 'd20', 'd06'],
    [[/MIN\s*\(\s*[\w.]*OrderDate\s*\)|FIRST_VALUE/, 'MIN(OrderDate).'], [/HAVING\s+COUNT\s*\(\s*\*\s*\)\s*>\s*1|COUNT[\s\S]*>\s*1/, 'HAVING COUNT(*) > 1 for repeat customers.']],
    [[`SELECT CustomerID,`, ''], [`       DATEDIFF(day, MIN(OrderDate), MAX(OrderDate)) AS DaysActive`, 'First to latest.'], [`FROM sales.Orders\nGROUP BY CustomerID`, 'One row per customer.'], [`HAVING COUNT(*) > 1;`, 'Repeat customers only.']], { need: ['d16b'], ok: ['d13', 'd23'], alt: [['d23']] });

  // ───────── PHASE 4 · ADVANCED QUERY DESIGN
  R('d24', 1, 'Which products are priced above our average product price?', ['above our average'],
    'You need the average first, then compare each product to it: a subquery.', ['catalog.Products'], ['d16b', 'd06', 'd18'],
    [[/AVG\s*\(\s*UnitPrice\s*\)/, 'AVG(UnitPrice).'], [/\(\s*SELECT\s+AVG|WITH\s+\w+\s+AS/, 'A little (SELECT AVG(UnitPrice) …) inside the WHERE.']],
    [[`SELECT ProductName, UnitPrice`, ''], [`FROM catalog.Products`, ''], [`WHERE UnitPrice > (SELECT AVG(UnitPrice) FROM catalog.Products);`, 'The inner query works out one number first.']],
    { ok: ['d06'], alt: [['d26'], ['d18']], no: { d16b: 'HAVING filters groups. There are no groups here; you’re comparing each product to one number.', d06: 'WHERE does the comparing, but it needs the average first, worked out in its own little query.' } });
  R('d24', 2, 'Which customers have at least one Delivered order? Just their names.', ['at least one Delivered order', 'Just their names'],
    'A list of CustomerIDs from orders, used with IN: a list subquery.', ['crm.Customers', 'sales.Orders'], ['d08', 'd16b', 'd03a'],
    [[/IN\s*\(\s*SELECT\s+[\w.]*CustomerID|EXISTS|JOIN/, "WHERE CustomerID IN (SELECT CustomerID FROM sales.Orders WHERE Status = 'Delivered')."]],
    [[`SELECT CustomerName`, ''], [`FROM crm.Customers`, ''], [`WHERE CustomerID IN (`, 'Is this customer in the list…'], [`  SELECT CustomerID FROM sales.Orders WHERE Status = 'Delivered'\n);`, '…of customers with a delivered order?']], { alt: [['d25'], ['d08', 'd03a']] });
  R('d24', 3, 'Which categories earn more than the average category revenue?', ['more than the average category revenue'],
    'First category totals, then the average of those totals: a table subquery (or CTE).', ['reporting.vSalesLineDetail'], ['d16b', 'd18', 'd06'],
    [[/GROUP\s+BY\s+[\w.]*Category/, 'GROUP BY Category for totals.'], [/AVG\s*\(/, 'AVG of the category totals.']],
    [[`WITH CatRev AS (\n  SELECT Category, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY Category\n)`, 'Step one: a total per category.'], [`SELECT Category, Revenue`, ''], [`FROM CatRev`, ''], [`WHERE Revenue > (SELECT AVG(Revenue) FROM CatRev);`, 'Compare each total with the average total.']], { ok: ['d16b', 'd26'], alt: [['d26']] });

  R('d25', 1, 'Which customers have at least one Expedited order?', ['at least one Expedited order'],
    '“At least one” is a yes-or-no check per customer: EXISTS.', ['crm.Customers', 'sales.Orders'], ['d08', 'd16b', 'd06'],
    [[/EXISTS\s*\(|IN\s*\(\s*SELECT/, 'WHERE EXISTS (SELECT 1 FROM sales.Orders …).'], [/[\w.]*CustomerID\s*=\s*[\w.]*CustomerID|IN\s*\(/, 'Match o.CustomerID = c.CustomerID inside.']],
    [[`SELECT c.CustomerName`, ''], [`FROM crm.Customers AS c`, ''], [`WHERE EXISTS (`, 'For each customer, is there…'], [`  SELECT 1 FROM sales.Orders AS o\n  WHERE o.CustomerID = c.CustomerID\n    AND o.Priority = 'Expedited'\n);`, '…any expedited order of theirs?']], { alt: [['d24']], no: { d08: 'A JOIN would repeat a customer once per expedited order. EXISTS just asks yes or no.' } });
  R('d25', 2, 'Which products have never appeared on any order?', ['never appeared on any order'],
    '“Never” per product is NOT EXISTS.', ['catalog.Products', 'sales.OrderItems'], ['d08', 'd06', 'd16b'],
    [[/NOT\s+EXISTS|LEFT\s+JOIN[\s\S]*IS\s+NULL|NOT\s+IN/, 'WHERE NOT EXISTS (SELECT 1 FROM sales.OrderItems …).']],
    [[`SELECT p.ProductName`, ''], [`FROM catalog.Products AS p`, ''], [`WHERE NOT EXISTS (`, ''], [`  SELECT 1 FROM sales.OrderItems AS oi\n  WHERE oi.ProductID = p.ProductID\n);`, 'No line ever points to it.']], { alt: [['d09'], ['d24']] });
  R('d25', 3, 'Which VIP customers haven’t ordered anything since January 1, 2025?', ['VIP customers', 'haven’t ordered anything since'],
    '“Haven’t … since” is NOT EXISTS with a date inside; “VIP” is a plain WHERE outside.', ['crm.Customers', 'sales.Orders'], ['d08', 'd16b', 'd07'],
    [[/NOT\s+EXISTS|LEFT\s+JOIN|NOT\s+IN/, 'NOT EXISTS (…) for “haven’t ordered.”'], [/CustomerSegment\s*=\s*'VIP'/, "CustomerSegment = 'VIP'."], [/OrderDate\s*>=\s*'2025-01-01'/, "OrderDate >= '2025-01-01' inside the check."]],
    [[`SELECT c.CustomerName`, ''], [`FROM crm.Customers AS c`, ''], [`WHERE c.CustomerSegment = 'VIP'`, 'VIPs…'], [`  AND NOT EXISTS (\n    SELECT 1 FROM sales.Orders AS o\n    WHERE o.CustomerID = c.CustomerID\n      AND o.OrderDate >= '2025-01-01'\n  );`, '…with no order on or after January 1.']], { ok: ['d06'], alt: [['d09'], ['d09', 'd06'], ['d24']] });

  R('d26', 1, 'First total up each order’s revenue, then show me the orders worth more than $150.', ['First total up', 'then show me'],
    '“First … then” is two steps. Naming step one with WITH keeps it readable.', ['reporting.vSalesLineDetail'], ['d24', 'd18', 'd06'],
    [[/WITH\s+\w+\s+AS\s*\(|HAVING/, 'WITH OrderTotals AS ( … ).'], [/SUM\s*\(\s*[\w.]*LineRevenue/, 'SUM(LineRevenue) per order.']],
    [[`WITH OrderTotals AS (\n  SELECT OrderID, SUM(LineRevenue) AS OrderRevenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY OrderID\n)`, 'Step one, named.'], [`SELECT OrderID, OrderRevenue`, ''], [`FROM OrderTotals`, ''], [`WHERE OrderRevenue > 150;`, 'Step two reads from step one.']], { ok: ['d16b'], alt: [['d16b'], ['d24']] });
  R('d26', 2, 'Total each customer’s revenue, then show only customers above $500, with their segment.', ['Total each customer’s revenue, then', 'with their segment'],
    'A total first, then a join for the segment: two steps that read well as a CTE.', ['reporting.vSalesLineDetail', 'crm.Customers'], ['d24', 'd17', 'd06'],
    [[/WITH\s+\w+\s+AS\s*\(|HAVING/, 'WITH CustomerSales AS ( … ).'], [/>\s*500/, '> 500.']],
    [[`WITH CustomerSales AS (\n  SELECT CustomerID, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY CustomerID\n)`, 'Step one.'], [`SELECT c.CustomerName, c.CustomerSegment, cs.Revenue`, ''], [`FROM CustomerSales AS cs\nJOIN crm.Customers AS c ON c.CustomerID = cs.CustomerID`, ''], [`WHERE cs.Revenue > 500;`, '']], { ok: ['d16b', 'd08'], alt: [['d16b'], ['d16b', 'd08']] });
  R('d26', 3, 'Work out monthly revenue for each category, then rank the categories within each month.', ['monthly revenue for each category, then rank'],
    'Aggregate in one step, rank in the next: a CTE feeding a window function.', ['reporting.vSalesLineDetail'], ['d24', 'd03b', 'd18'],
    [[/WITH\s+\w+\s+AS\s*\(/, 'WITH Monthly AS ( … ).'], [/RANK\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY/, 'RANK() OVER (PARTITION BY the month …).']],
    [[`WITH Monthly AS (\n  SELECT DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1) AS Mth,\n         Category, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1), Category\n)`, 'Step one: month × category totals.'], [`SELECT Mth, Category, Revenue,`, ''], [`       RANK() OVER (PARTITION BY Mth ORDER BY Revenue DESC) AS MonthRank`, 'Step two: rank within each month.'], [`FROM Monthly;`, '']], { need: ['d26', 'd20'], ok: ['d16b', 'd12'] });

  R('d28', 1, 'Make a reusable view of active customers that shows only name, city and segment.', ['reusable view'],
    '“Reusable” for everyone, always current: CREATE VIEW.', ['crm.Customers'], ['d30', 'd26', 'd04'],
    [[/CREATE\s+(OR\s+ALTER\s+)?VIEW/, 'CREATE VIEW reporting.vActiveCustomers AS …'], [/IsActive\s*=\s*1/, 'WHERE IsActive = 1.']],
    [[`CREATE VIEW reporting.vActiveCustomers AS`, 'Name it; the reporting schema is a good home.'], [`SELECT CustomerName, City, CustomerSegment`, 'Only the columns people should see.'], [`FROM crm.Customers`, ''], [`WHERE IsActive = 1;`, '']], { ok: ['d06'] });
  R('d28', 2, 'Using the sales detail view we already have, show total revenue by channel.', ['the sales detail view we already have', 'by channel'],
    'The view already exists, so this is simply a query on it: GROUP BY Channel.', ['reporting.vSalesLineDetail'], ['d28', 'd30', 'd26'],
    [[/FROM\s+reporting\.vSalesLineDetail/, 'FROM reporting.vSalesLineDetail.'], [/GROUP\s+BY\s+Channel/, 'GROUP BY Channel.'], [/CREATE\s+VIEW/, 'No need to create a view; it already exists.', true]],
    [[`SELECT Channel, SUM(LineRevenue) AS Revenue`, ''], [`FROM reporting.vSalesLineDetail`, 'Read the view just like a table.'], [`GROUP BY Channel;`, '']], { need: ['d16b'], no: { d28: 'The view already exists. You read from it like a table; there’s nothing new to create.' } });
  R('d28', 3, 'Build a reporting view for Power BI with order date, channel, category and line revenue only.', ['reporting view for Power BI', 'only'],
    'A shared, tidy shape for a tool: CREATE VIEW with only those columns.', ['reporting.vSalesLineDetail'], ['d30', 'd26', 'd02'],
    [[/CREATE\s+(OR\s+ALTER\s+)?VIEW/, 'CREATE VIEW reporting.vChannelCategorySales AS …'], [/SELECT\s+\*/, 'Name the four columns instead of SELECT *.', true]],
    [[`CREATE VIEW reporting.vChannelCategorySales AS`, ''], [`SELECT OrderDate, Channel, Category, LineRevenue`, 'Just what the dashboard needs.'], [`FROM reporting.vSalesLineDetail;`, 'Views can read from views.']]);

  R('d30', 1, 'Copy the last six months of orders into a temporary table so I can explore them.', ['temporary table so I can explore'],
    'A private copy to explore this session: SELECT … INTO #temp.', ['sales.Orders'], ['d28', 'd26', 'd04'],
    [[/INTO\s+#\w+/, 'SELECT … INTO #RecentOrders.'], [/DATEADD\s*\(\s*(month|mm|m)\s*,\s*-\s*6/, 'DATEADD(month, -6, GETDATE()).']],
    [[`SELECT *`, ''], [`INTO #RecentOrders`, 'The # makes it temporary.'], [`FROM sales.Orders`, ''], [`WHERE OrderDate >= DATEADD(month, -6, CAST(GETDATE() AS date));`, ''], [`SELECT * FROM #RecentOrders;`, 'Now explore it as often as you like.']], { ok: ['d13'] });
  R('d30', 2, 'Save each customer’s total revenue into a temp table, then show the top 10 from it.', ['Save each customer’s total revenue into a temp table'],
    '“Save … then show” is SELECT INTO #temp, then a query on it.', ['reporting.vSalesLineDetail'], ['d28', 'd26', 'd21'],
    [[/INTO\s+#\w+/, 'INTO #CustomerTotals.'], [/TOP\s*\(?\s*10/, 'SELECT TOP (10) … FROM #CustomerTotals.']],
    [[`SELECT CustomerID, SUM(LineRevenue) AS Revenue`, ''], [`INTO #CustomerTotals`, ''], [`FROM reporting.vSalesLineDetail\nGROUP BY CustomerID;`, ''], [`SELECT TOP (10) * FROM #CustomerTotals ORDER BY Revenue DESC;`, '']], { ok: ['d16b', 'd03b'] });
  R('d30', 3, 'Make a temp table of returned items, then count the returns for each reason from it.', ['temp table of returned items, then count'],
    'Temp table first, then a GROUP BY on it.', ['sales.Returns'], ['d28', 'd26', 'd10'],
    [[/INTO\s+#\w+/, 'INTO #Returned.'], [/GROUP\s+BY\s+ReturnReason/, 'GROUP BY ReturnReason.']],
    [[`SELECT ReturnID, ReturnReason, RefundAmount`, ''], [`INTO #Returned`, ''], [`FROM sales.Returns;`, ''], [`SELECT ReturnReason, COUNT(*) AS Returns\nFROM #Returned\nGROUP BY ReturnReason;`, '']], { ok: ['d16b'] });

  R('d31', 1, 'Show me orders from the Mobile channel.', ['from the Mobile channel'],
    'One simple test on each row. No advanced technique needed: just WHERE.', ['sales.Orders'], ['d24', 'd26', 'd28', 'd30'],
    [[/Channel\s*=\s*'Mobile'/, "WHERE Channel = 'Mobile'."]],
    [[`SELECT OrderID, OrderDate`, ''], [`FROM sales.Orders`, ''], [`WHERE Channel = 'Mobile';`, 'The simplest tool that fits.']], { need: ['d06'], no: { d24: 'A subquery is for working something out first. Nothing needs working out here.', d26: 'A CTE names steps, and this request has only one step.', d28: 'A view is for shared reuse; this is a one-off question.', d30: 'A temp table is for repeated reuse; this is one quick look.' } });
  R('d31', 2, 'Several reports this month need the same cleaned customer list. Set it up once.', ['Several reports', 'Set it up once'],
    'Shared by several reports and always current: a view.', ['crm.Customers'], ['d30', 'd26', 'd24'],
    [[/CREATE\s+(OR\s+ALTER\s+)?VIEW/, 'CREATE VIEW …']],
    [[`CREATE VIEW reporting.vCleanCustomers AS`, ''], [`SELECT CustomerID, LTRIM(RTRIM(CustomerName)) AS CustomerName,\n       UPPER(StateCode) AS StateCode, CustomerSegment`, 'Light cleaning.'], [`FROM crm.Customers;`, '']], { need: ['d28'], ok: ['d11'], no: { d30: 'A temp table disappears at the end of your session; other reports couldn’t use it.', d26: 'A CTE lives inside one query only.' } });
  R('d31', 3, 'I’ll be slicing last quarter’s order totals many different ways this afternoon.', ['many different ways this afternoon'],
    'Reused many times, just by you, just today: a temp table.', ['reporting.vSalesLineDetail'], ['d28', 'd26', 'd24'],
    [[/INTO\s+#\w+/, 'SELECT … INTO #QuarterTotals.']],
    [[`SELECT OrderID, OrderDate, Channel, SUM(LineRevenue) AS OrderRevenue`, ''], [`INTO #QuarterTotals`, 'Built once…'], [`FROM reporting.vSalesLineDetail\nWHERE OrderDate >= DATEADD(quarter, -1, CAST(GETDATE() AS date))\nGROUP BY OrderID, OrderDate, Channel;`, '…then sliced all afternoon.']], { need: ['d30'], ok: ['d16b', 'd13'], no: { d28: 'A view would re-run the heavy query every time. A temp table runs it once.' } });

  R('d32', 1, 'Make a reusable command that returns orders between two dates I choose.', ['reusable command', 'two dates I choose'],
    '“Reusable” with inputs you choose is a stored procedure with parameters.', ['sales.Orders'], ['d28', 'd33', 'd26'],
    [[/CREATE\s+(OR\s+ALTER\s+)?PROC(EDURE)?/, 'CREATE PROCEDURE …'], [/@\w+\s+date/, 'Parameters like @StartDate date.']],
    [[`CREATE PROCEDURE sales.usp_OrdersBetween`, ''], [`  @StartDate date, @EndDate date`, 'The blanks you fill in each time.'], [`AS\nBEGIN\n  SELECT OrderID, OrderDate, Channel\n  FROM sales.Orders\n  WHERE OrderDate >= @StartDate AND OrderDate < @EndDate;\nEND;`, '']], { no: { d28: 'A view can’t take inputs. The dates change each time, so they need parameters.' } });
  R('d32', 2, 'Make a procedure that shows one customer’s orders when I give it their CustomerID.', ['give it their CustomerID'],
    'One input, one result: a procedure with an @CustomerID parameter.', ['sales.Orders'], ['d28', 'd33', 'd24'],
    [[/CREATE\s+(OR\s+ALTER\s+)?PROC(EDURE)?/, 'CREATE PROCEDURE …'], [/@CustomerID\s+INT/, '@CustomerID INT.']],
    [[`CREATE PROCEDURE sales.usp_CustomerOrders`, ''], [`  @CustomerID INT`, ''], [`AS\nBEGIN\n  SELECT OrderID, OrderDate, Status\n  FROM sales.Orders\n  WHERE CustomerID = @CustomerID;\nEND;`, '']]);
  R('d32', 3, 'Run the date-range orders procedure for March 2025.', ['Run the date-range orders procedure'],
    'Running a procedure is EXEC with its parameters.', [], ['d33', 'd28', 'd06'],
    [[/EXEC(UTE)?\s+[\w.]*usp_OrdersBetween/, 'EXEC sales.usp_OrdersBetween …'], [/'2025-03-01'/, "@StartDate = '2025-03-01'."]],
    [[`EXEC sales.usp_OrdersBetween`, ''], [`  @StartDate = '2025-03-01',\n  @EndDate   = '2025-04-01';`, 'Named parameters read clearly.']]);

  R('d33', 1, 'Whenever a product’s price changes, record the old and new price in dbo.PriceAudit automatically.', ['Whenever', 'automatically'],
    '“Whenever … automatically” on a data change is a trigger.', ['catalog.Products'], ['d32', 'd28', 'd05'],
    [[/CREATE\s+(OR\s+ALTER\s+)?TRIGGER/, 'CREATE TRIGGER … ON catalog.Products AFTER UPDATE.'], [/inserted/, 'Read new prices from inserted…'], [/deleted/, '…and old prices from deleted.']],
    [[`CREATE TRIGGER catalog.trg_PriceAudit`, ''], [`ON catalog.Products AFTER UPDATE`, 'Fires after any update.'], [`AS\nBEGIN\n  INSERT INTO dbo.PriceAudit (ProductID, OldPrice, NewPrice, ChangedAt)\n  SELECT d.ProductID, d.UnitPrice, i.UnitPrice, GETDATE()\n  FROM inserted AS i\n  JOIN deleted  AS d ON d.ProductID = i.ProductID\n  WHERE i.UnitPrice <> d.UnitPrice;\nEND;`, 'deleted = before, inserted = after.']], { no: { d32: 'A procedure runs only when someone calls it. “Whenever” and “automatically” mean it should fire by itself.' } });
  R('d33', 2, 'Stop anyone from deleting rows in sales.Orders by accident.', ['Stop anyone from deleting'],
    'Reacting to a delete, instead of letting it happen, is an INSTEAD OF DELETE trigger.', ['sales.Orders'], ['d32', 'd05', 'd04'],
    [[/INSTEAD\s+OF\s+DELETE/, 'INSTEAD OF DELETE.']],
    [[`CREATE TRIGGER sales.trg_NoOrderDeletes`, ''], [`ON sales.Orders INSTEAD OF DELETE`, 'Runs in place of the delete.'], [`AS\nBEGIN\n  RAISERROR('Orders can''t be deleted. Set Status to Cancelled instead.', 16, 1);\nEND;`, 'A kind, clear message.']]);
  R('d33', 3, 'Every Monday morning, produce a summary of last week’s sales.', ['Every Monday morning'],
    'On a schedule, not on a data change, so it’s a procedure (run by a scheduled job), not a trigger.', ['reporting.vSalesLineDetail'], ['d33', 'd28', 'd30'],
    [[/CREATE\s+(OR\s+ALTER\s+)?PROC(EDURE)?/, 'CREATE PROCEDURE … for the job to run.']],
    [[`CREATE PROCEDURE reporting.usp_WeeklySales`, ''], [`AS\nBEGIN\n  SELECT Category, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  WHERE OrderDate >= DATEADD(day, -7, CAST(GETDATE() AS date))\n  GROUP BY Category;\nEND;`, 'A SQL Agent job can EXEC this every Monday.']], { need: ['d32'], ok: ['d16b'], no: { d33: 'A trigger fires when data changes. A Monday-morning report runs on a clock, so it’s a scheduled procedure.' } });

  // ───────── PHASE 5 · PERFORMANCE
  R('d34', 1, 'Looking up orders by CustomerID is slow. Add an index to help.', ['slow', 'Add an index'],
    'A frequent lookup column that isn’t the table’s key gets a nonclustered index.', ['sales.Orders'], ['d38', 'd36', 'd35'],
    [[/CREATE\s+NONCLUSTERED\s+INDEX|CREATE\s+INDEX/, 'CREATE NONCLUSTERED INDEX …'], [/ON\s+sales\.Orders\s*\(\s*CustomerID/, 'ON sales.Orders (CustomerID).']],
    [[`CREATE NONCLUSTERED INDEX IX_Orders_CustomerID`, 'Name it after the table and column.'], [`ON sales.Orders (CustomerID);`, 'A sorted list of CustomerIDs pointing back to the rows.']]);
  R('d34', 2, 'training.LargeSales is a heap. Give it a clustered index on SaleDate and SaleID.', ['is a heap', 'clustered index'],
    'Turning a heap into a sorted table is a clustered index.', ['training.LargeSales'], ['d35', 'd37', 'd38'],
    [[/CREATE\s+(UNIQUE\s+)?CLUSTERED\s+INDEX/, 'CREATE CLUSTERED INDEX …'], [/ON\s+training\.LargeSales\s*\(\s*SaleDate/, 'ON training.LargeSales (SaleDate, SaleID).']],
    [[`CREATE CLUSTERED INDEX CIX_LargeSales_SaleDate`, 'Only one clustered index per table.'], [`ON training.LargeSales (SaleDate, SaleID);`, 'The table itself is now stored in date order.']]);
  R('d34', 3, 'Searches for products by exact name are slow. Speed them up.', ['by exact name', 'Speed them up'],
    'An exact-match lookup on a non-key column: a nonclustered index.', ['catalog.Products'], ['d38', 'd36', 'd07'],
    [[/CREATE\s+(UNIQUE\s+)?(NONCLUSTERED\s+)?INDEX/, 'CREATE NONCLUSTERED INDEX …'], [/\(\s*ProductName/, 'ON catalog.Products (ProductName).']],
    [[`CREATE NONCLUSTERED INDEX IX_Products_ProductName`, ''], [`ON catalog.Products (ProductName);`, 'Exact matches can now seek.']]);

  R('d35', 1, 'We often filter orders by CustomerID and then by OrderDate. Make one index that serves both.', ['by CustomerID and then by OrderDate', 'one index'],
    'Two filter columns in one index: a composite index, = column first.', ['sales.Orders'], ['d34', 'd38', 'd37'],
    [[/INDEX\s+\w+\s+ON\s+sales\.Orders\s*\(\s*CustomerID\s*,\s*OrderDate/, 'ON sales.Orders (CustomerID, OrderDate).']],
    [[`CREATE NONCLUSTERED INDEX IX_Orders_Customer_Date`, ''], [`ON sales.Orders (CustomerID, OrderDate);`, 'Equality column first, range column second.']], { alt: [['d34']] });
  R('d35', 2, 'A report reads Category, SaleDate and Amount from training.LargeSales, filtered by Category. Make an index that covers it.', ['covers it'],
    '“Covers” means the index holds every column the query reads: INCLUDE.', ['training.LargeSales'], ['d34', 'd37', 'd38'],
    [[/\(\s*Category/, 'Key on (Category, SaleDate).'], [/INCLUDE\s*\(\s*Amount/, 'INCLUDE (Amount).']],
    [[`CREATE NONCLUSTERED INDEX IX_LargeSales_Category_Date`, ''], [`ON training.LargeSales (Category, SaleDate)`, 'Sorted by what you filter on.'], [`INCLUDE (Amount);`, 'Carried along, so the table is never touched.']]);
  R('d35', 3, 'Find the orders for customer 12 placed in 2025.', ['customer 12 placed in 2025'],
    'This is a plain question, not an indexing task: WHERE with a date range.', ['sales.Orders'], ['d35', 'd34', 'd12'],
    [[/CustomerID\s*=\s*12/, 'CustomerID = 12.'], [/OrderDate\s*>=\s*'2025-01-01'[\s\S]*<\s*'2026-01-01'|BETWEEN\s*'2025-01-01'/, "OrderDate >= '2025-01-01' AND OrderDate < '2026-01-01'."]],
    [[`SELECT OrderID, OrderDate`, ''], [`FROM sales.Orders`, ''], [`WHERE CustomerID = 12`, ''], [`  AND OrderDate >= '2025-01-01' AND OrderDate < '2026-01-01';`, 'A bare range lets your composite index help.']], { need: ['d06'], ok: ['d07', 'd38'], no: { d35: 'The index is already there to help; the request just asks for the orders. That’s a WHERE.', d12: 'YEAR(OrderDate) = 2025 works, but hides the column from the index. A date range is kinder.' } });

  R('d36', 1, 'Before tuning, show how many pages SQL Server reads for this: total 2025 Amount in LargeSales.', ['how many pages SQL Server reads'],
    '“How many pages read” is SET STATISTICS IO ON.', ['training.LargeSales'], ['d34', 'd38', 'd37'],
    [[/SET\s+STATISTICS\s+IO\s+ON/, 'SET STATISTICS IO ON first.']],
    [[`SET STATISTICS IO ON;`, 'Reports logical reads in the Messages tab.'], [`SELECT SUM(Amount) AS Total2025`, ''], [`FROM training.LargeSales`, ''], [`WHERE SaleDate >= '2025-01-01' AND SaleDate < '2026-01-01';`, '']], { ok: ['d38'] });
  R('d36', 2, 'Measure how long the category revenue query takes to run.', ['how long'],
    '“How long” is SET STATISTICS TIME ON.', ['reporting.vSalesLineDetail'], ['d34', 'd38', 'd35'],
    [[/SET\s+STATISTICS\s+TIME\s+ON/, 'SET STATISTICS TIME ON.']],
    [[`SET STATISTICS TIME ON;`, 'CPU and elapsed time show in Messages.'], [`SELECT Category, SUM(LineRevenue) AS Revenue`, ''], [`FROM reporting.vSalesLineDetail\nGROUP BY Category;`, '']], { ok: ['d16b'] });
  R('d36', 3, 'The plan shows a full scan for WHERE YEAR(SaleDate) = 2025. Rewrite it so it can seek.', ['WHERE YEAR(SaleDate) = 2025', 'Rewrite it so it can seek'],
    'The function hides SaleDate from the index. A bare range fixes it: that’s a SARGable rewrite.', ['training.LargeSales'], ['d36', 'd34', 'd12'],
    [[/SaleDate\s*>=\s*'2025-01-01'/, "SaleDate >= '2025-01-01'."], [/SaleDate\s*<\s*'2026-01-01'/, "SaleDate < '2026-01-01'."], [/YEAR\s*\(\s*SaleDate/, 'No YEAR() around the column.', true]],
    [[`SELECT SUM(Amount)`, ''], [`FROM training.LargeSales`, ''], [`WHERE SaleDate >= '2025-01-01'\n  AND SaleDate <  '2026-01-01';`, 'Same rows, but the column is bare, so the index can seek.']], { need: ['d38'], no: { d36: 'The plan has told you what’s wrong. The fix is a rewrite of the filter.', d34: 'An index on SaleDate already can’t help while YEAR() hides the column.' } });

  R('d37', 1, 'Plan to split training.LargeSales by year. Start with a partition function with boundaries for 2024, 2025 and 2026.', ['partition function', 'boundaries'],
    '“Partition function … boundaries” is CREATE PARTITION FUNCTION.', [], ['d34', 'd35', 'd04'],
    [[/CREATE\s+PARTITION\s+FUNCTION/, 'CREATE PARTITION FUNCTION …'], [/RANGE\s+RIGHT/, 'RANGE RIGHT, so each boundary starts a new year.']],
    [[`CREATE PARTITION FUNCTION pf_SaleYear (date)`, 'Partition by a date.'], [`AS RANGE RIGHT FOR VALUES ('2024-01-01', '2025-01-01', '2026-01-01');`, 'Each date starts a new slice.']]);
  R('d37', 2, 'Create the partition scheme that puts every partition of pf_SaleYear on PRIMARY.', ['partition scheme'],
    'Where the slices live is the partition scheme.', [], ['d34', 'd04', 'd35'],
    [[/CREATE\s+PARTITION\s+SCHEME/, 'CREATE PARTITION SCHEME …'], [/ALL\s+TO\s*\(\s*\[?PRIMARY/, 'ALL TO ([PRIMARY]).']],
    [[`CREATE PARTITION SCHEME ps_SaleYear`, ''], [`AS PARTITION pf_SaleYear`, 'Uses the function’s boundaries.'], [`ALL TO ([PRIMARY]);`, 'Every slice in the PRIMARY filegroup.']]);
  R('d37', 3, 'Write a 2025 filter on LargeSales that lets SQL Server skip the other years’ partitions.', ['skip the other years’ partitions'],
    'Partition elimination needs a bare range on the partition key: a SARGable WHERE.', ['training.LargeSales'], ['d37', 'd12', 'd34'],
    [[/SaleDate\s*>=\s*'2025-01-01'[\s\S]*SaleDate\s*<\s*'2026-01-01'/, "SaleDate >= '2025-01-01' AND SaleDate < '2026-01-01'."], [/YEAR\s*\(\s*SaleDate/, 'No YEAR() around the key.', true]],
    [[`SELECT SaleID, SaleDate, Amount`, ''], [`FROM training.LargeSales`, ''], [`WHERE SaleDate >= '2025-01-01' AND SaleDate < '2026-01-01';`, 'SQL Server reads only the 2025 slice.']], { need: ['d38'], ok: ['d06'], no: { d37: 'The partitions already exist; this is about writing the filter so they can be skipped.', d12: 'YEAR(SaleDate) hides the key, so every slice gets read.' } });

  R('d38', 1, 'This filter can’t use the index: WHERE YEAR(OrderDate) = 2025. Rewrite it.', ['can’t use the index', 'Rewrite it'],
    'A function on the column blocks the index. Rewrite as a bare range.', ['sales.Orders'], ['d34', 'd12', 'd36'],
    [[/OrderDate\s*>=\s*'2025-01-01'/, "OrderDate >= '2025-01-01'."], [/OrderDate\s*<\s*'2026-01-01'/, "OrderDate < '2026-01-01'."], [/YEAR\s*\(\s*OrderDate/, 'Drop the YEAR() around the column.', true]],
    [[`SELECT OrderID, OrderDate`, ''], [`FROM sales.Orders`, ''], [`WHERE OrderDate >= '2025-01-01'\n  AND OrderDate <  '2026-01-01';`, 'Same rows; the column is left bare.']], { no: { d34: 'An index won’t help while YEAR() wraps the column. Fix the filter first.' } });
  R('d38', 2, 'A dashboard runs SELECT * on LargeSales just to total Amount by Channel. Make it lean.', ['SELECT *', 'Make it lean'],
    'Fetch only what’s needed: name the two columns and total them.', ['training.LargeSales'], ['d34', 'd36', 'd30'],
    [[/SELECT\s+\*/, 'No SELECT *.', true], [/SUM\s*\(\s*Amount\s*\)/, 'SUM(Amount).'], [/GROUP\s+BY\s+Channel/, 'GROUP BY Channel.']],
    [[`SELECT Channel, SUM(Amount) AS Revenue`, 'Only two columns leave the table.'], [`FROM training.LargeSales`, ''], [`GROUP BY Channel;`, '']], { ok: ['d16b'] });
  R('d38', 3, 'Show category revenue next to its monthly target. Make it fast by summarizing the sales before joining.', ['summarizing the sales before joining'],
    'Pre-aggregate in a CTE, then join the small result to targets.', ['reporting.vSalesLineDetail', 'sales.MonthlyTargets'], ['d34', 'd36', 'd28'],
    [[/WITH\s+\w+\s+AS\s*\(|\(\s*SELECT[\s\S]*GROUP\s+BY/, 'A CTE that totals sales first.'], [/JOIN\s+sales\.MonthlyTargets/, 'JOIN sales.MonthlyTargets.']],
    [[`WITH CatMonth AS (\n  SELECT DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1) AS TargetMonth,\n         Category, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1), Category\n)`, 'Shrink thousands of lines to one per month and category.'], [`SELECT cm.TargetMonth, cm.Category, cm.Revenue, t.RevenueTarget`, ''], [`FROM CatMonth AS cm\nJOIN sales.MonthlyTargets AS t\n  ON t.TargetMonth = cm.TargetMonth AND t.Category = cm.Category;`, 'The join is now small and fast.']], { ok: ['d26', 'd16b', 'd08', 'd12'] });

  R('d40', 1, 'AI wrote a revenue query joining Orders to OrderItems. Check the join didn’t multiply orders: compare the order count before and after.', ['compare the order count before and after'],
    'Counting rows before and after a join is the classic check on AI’s SQL.', ['sales.Orders', 'sales.OrderItems'], ['d08', 'd36', 'd16b'],
    [[/COUNT\s*\(\s*\*\s*\)[\s\S]*FROM\s+sales\.Orders/, 'COUNT(*) FROM sales.Orders.'], [/COUNT\s*\(\s*DISTINCT\s+[\w.]*OrderID\s*\)/, 'COUNT(DISTINCT o.OrderID) after the join.']],
    [[`SELECT COUNT(*) AS OrdersBefore FROM sales.Orders;`, 'How many orders exist.'], [`SELECT COUNT(*) AS RowsAfter,\n       COUNT(DISTINCT o.OrderID) AS OrdersAfter`, 'Rows will grow (one per line); distinct orders shouldn’t.'], [`FROM sales.Orders AS o\nJOIN sales.OrderItems AS oi ON oi.OrderID = o.OrderID;`, '']], { ok: ['d08', 'd03a'] });
  R('d40', 2, 'AI says total revenue is $48,200. Check that against the sales detail view’s own total.', ['Check that against'],
    'A known total to compare with is the simplest check: SUM over the view.', ['reporting.vSalesLineDetail'], ['d40', 'd18', 'd36'],
    [[/SUM\s*\(\s*LineRevenue\s*\)/, 'SUM(LineRevenue).'], [/FROM\s+reporting\.vSalesLineDetail/, 'FROM reporting.vSalesLineDetail.']],
    [[`SELECT SUM(LineRevenue) AS CheckTotal`, 'If this differs from AI’s number, ask why before trusting it.'], [`FROM reporting.vSalesLineDetail;`, '']], { need: ['d16b'], alt: [['d40'], ['d47']] });
  R('d40', 3, 'AI’s query counted customers with COUNT(Email). How many customers did that miss?', ['COUNT(Email)', 'How many customers did that miss'],
    'COUNT(column) skips NULLs. The gap between COUNT(*) and COUNT(Email) is the missed customers.', ['crm.Customers'], ['d40', 'd15', 'd16b'],
    [[/COUNT\s*\(\s*\*\s*\)\s*-\s*COUNT\s*\(\s*Email\s*\)|Email\s+IS\s+NULL/, 'COUNT(*) - COUNT(Email).']],
    [[`SELECT COUNT(*) - COUNT(Email) AS MissedByAI`, 'Customers with no email weren’t counted.'], [`FROM crm.Customers;`, '']], { need: ['d14'], alt: [['d07'], ['d40']] });

  // ───────── PHASE 6 · PROJECTS
  R('d41', 1, 'Set up the three warehouse layers as schemas.', ['three warehouse layers'],
    'Bronze, silver and gold each get a schema: CREATE SCHEMA.', [], ['d04', 'd28', 'd43'],
    [[/CREATE\s+SCHEMA\s+bronze/, 'CREATE SCHEMA bronze;'], [/CREATE\s+SCHEMA\s+silver/, 'CREATE SCHEMA silver;'], [/CREATE\s+SCHEMA\s+gold/, 'CREATE SCHEMA gold;']],
    [[`CREATE SCHEMA bronze;`, 'Raw copies.'], [`CREATE SCHEMA silver;`, 'Cleaned data.'], [`CREATE SCHEMA gold;`, 'Business-ready.']], { ok: ['d04'] });
  R('d41', 2, 'List every schema in the database so we can check the layers exist.', ['List every schema'],
    'Schemas are listed in sys.schemas (or INFORMATION_SCHEMA.SCHEMATA).', [], ['d02', 'd03a', 'd28'],
    [[/sys\.schemas|INFORMATION_SCHEMA\.SCHEMATA/, 'SELECT name FROM sys.schemas.']],
    [[`SELECT name`, ''], [`FROM sys.schemas`, 'SQL Server’s list of schemas.'], [`ORDER BY name;`, '']], { ok: ['d01', 'd03b'], alt: [['d01']] });
  R('d41', 3, 'Check which tables already exist in the bronze layer.', ['already exist in the bronze layer'],
    'A structure question about one schema: INFORMATION_SCHEMA.TABLES.', [], ['d02', 'd43', 'd28'],
    [[/INFORMATION_SCHEMA\.TABLES|sys\.tables/, 'FROM INFORMATION_SCHEMA.TABLES.'], [/'bronze'/, "WHERE TABLE_SCHEMA = 'bronze'."]],
    [[`SELECT TABLE_NAME`, ''], [`FROM INFORMATION_SCHEMA.TABLES`, ''], [`WHERE TABLE_SCHEMA = 'bronze';`, '']], { ok: ['d01', 'd06'], alt: [['d01']] });

  R('d43', 1, 'Load a raw copy of crm.Customers into bronze.crm_customers, exactly as it is.', ['raw copy', 'exactly as it is'],
    'A bronze load copies as-is: TRUNCATE then INSERT … SELECT.', ['crm.Customers'], ['d30', 'd28', 'd05'],
    [[/INSERT\s+INTO\s+bronze\.crm_customers|INTO\s+bronze\.crm_customers/, 'INSERT INTO bronze.crm_customers …'], [/FROM\s+crm\.Customers/, 'FROM crm.Customers.']],
    [[`TRUNCATE TABLE bronze.crm_customers;`, 'Empty it first, so running twice gives the same result.'], [`INSERT INTO bronze.crm_customers`, ''], [`SELECT * FROM crm.Customers;`, 'No cleaning in bronze.']], { ok: ['d05', 'd30'] });
  R('d43', 2, 'Load silver.crm_customers with tidy data: trimmed names, upper-case states, and “n/a” for missing emails.', ['trimmed names, upper-case states', '“n/a” for missing emails'],
    'Silver cleans on the way in: TRIM, UPPER and ISNULL inside the INSERT … SELECT.', ['crm.Customers'], ['d30', 'd16a', 'd28'],
    [[/TRIM\s*\(\s*CustomerName/, 'TRIM(CustomerName).'], [/UPPER\s*\(\s*StateCode/, 'UPPER(StateCode).'], [/ISNULL\s*\(\s*Email|COALESCE\s*\(\s*Email/, "ISNULL(Email, 'n/a')."]],
    [[`TRUNCATE TABLE silver.crm_customers;`, ''], [`INSERT INTO silver.crm_customers (CustomerID, CustomerName, StateCode, Email)`, ''], [`SELECT CustomerID, TRIM(CustomerName), UPPER(StateCode), ISNULL(Email, 'n/a')`, 'Each fix in its own function.'], [`FROM bronze.crm_customers;`, 'Silver reads from bronze.']], { ok: ['d11', 'd15', 'd05'] });
  R('d43', 3, 'When loading silver, keep only the latest row for each CustomerID.', ['only the latest row for each CustomerID'],
    '“Latest per key” is ROW_NUMBER = 1, inside the silver load.', ['crm.Customers'], ['d03a', 'd16b', 'd30'],
    [[/ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+CustomerID/, 'ROW_NUMBER() OVER (PARTITION BY CustomerID ORDER BY JoinDate DESC).'], [/=\s*1\b/, 'Keep rn = 1.']],
    [[`WITH Latest AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY CustomerID\n                               ORDER BY JoinDate DESC) AS rn\n  FROM bronze.crm_customers\n)`, 'Number duplicates, newest first.'], [`INSERT INTO silver.crm_customers (CustomerID, CustomerName, City)`, ''], [`SELECT CustomerID, CustomerName, City\nFROM Latest\nWHERE rn = 1;`, 'One row per customer.']], { ok: ['d21', 'd20', 'd26'], alt: [['d21'], ['d21', 'd26']], no: { d03a: 'DISTINCT removes rows that are identical in every column. Duplicate keys with different details need ROW_NUMBER to pick one.' } });

  R('d46', 1, 'Create gold.dim_customers as a view with a surrogate key and clean customer attributes.', ['surrogate key'],
    'A dimension gets its own warehouse key, often from ROW_NUMBER.', ['crm.Customers'], ['d28', 'd30', 'd20'],
    [[/CREATE\s+(OR\s+ALTER\s+)?VIEW\s+gold\.dim_customers/, 'CREATE VIEW gold.dim_customers AS …'], [/ROW_NUMBER\s*\(\s*\)\s*OVER/, 'ROW_NUMBER() OVER (ORDER BY CustomerID) AS customer_key.']],
    [[`CREATE VIEW gold.dim_customers AS`, ''], [`SELECT ROW_NUMBER() OVER (ORDER BY CustomerID) AS customer_key,`, 'The surrogate key.'], [`       CustomerID AS customer_id, CustomerName AS customer_name,\n       City, StateCode, CustomerSegment`, 'Clean attributes; the business key stays too.'], [`FROM crm.Customers;`, '']], { ok: ['d28', 'd20'] });
  R('d46', 2, 'Create gold.fact_sales as a view: one row per order line, with keys and measures.', ['one row per order line', 'keys and measures'],
    'A fact table holds events (order lines) with keys to dimensions and number measures.', ['sales.OrderItems', 'sales.Orders'], ['d28', 'd16b', 'd30'],
    [[/CREATE\s+(OR\s+ALTER\s+)?VIEW\s+gold\.fact_sales/, 'CREATE VIEW gold.fact_sales AS …'], [/Quantity/, 'Measures like Quantity.']],
    [[`CREATE VIEW gold.fact_sales AS`, ''], [`SELECT oi.OrderID, o.OrderDate, o.CustomerID, oi.ProductID,`, 'Keys: who, what, when.'], [`       oi.Quantity, oi.UnitPrice * oi.Quantity * (1 - oi.DiscountPct) AS Revenue`, 'Measures.'], [`FROM sales.OrderItems AS oi\nJOIN sales.Orders AS o ON o.OrderID = oi.OrderID;`, 'One row per line.']], { ok: ['d28', 'd08'] });
  R('d46', 3, 'Using the star schema, show revenue by customer segment.', ['revenue by customer segment'],
    'The star is already built. This is a join from fact to dimension, then GROUP BY.', ['reporting.vSalesLineDetail'], ['d46', 'd28', 'd17'],
    [[/GROUP\s+BY\s+[\w.]*CustomerSegment/, 'GROUP BY CustomerSegment.'], [/SUM\s*\(/, 'SUM(Revenue).']],
    [[`SELECT d.CustomerSegment, SUM(f.Revenue) AS Revenue`, ''], [`FROM gold.fact_sales AS f\nJOIN gold.dim_customers AS d ON d.customer_id = f.CustomerID`, 'Fact to dimension.'], [`GROUP BY d.CustomerSegment;`, '']], { need: ['d16b'], ok: ['d08'], no: { d46: 'The star schema is already designed. Now it’s an ordinary question: join and GROUP BY.' } });

  R('d47', 1, 'What date range does our order data cover? Show the first and last order dates.', ['first and last order dates'],
    'A first look at the data’s shape: MIN and MAX dates.', ['sales.Orders'], ['d03b', 'd23', 'd12'],
    [[/MIN\s*\(\s*OrderDate\s*\)/, 'MIN(OrderDate).'], [/MAX\s*\(\s*OrderDate\s*\)/, 'MAX(OrderDate).']],
    [[`SELECT MIN(OrderDate) AS FirstOrder,`, ''], [`       MAX(OrderDate) AS LastOrder`, ''], [`FROM sales.Orders;`, '']], { alt: [['d16b']] });
  R('d47', 2, 'Give me the headline numbers: total revenue, number of orders, number of customers, and average order value.', ['headline numbers', 'average order value'],
    'Baseline KPIs: SUM, COUNT(DISTINCT …), and revenue ÷ orders.', ['reporting.vSalesLineDetail'], ['d18', 'd16b', 'd49'],
    [[/SUM\s*\(\s*LineRevenue\s*\)/, 'SUM(LineRevenue).'], [/COUNT\s*\(\s*DISTINCT\s+OrderID\s*\)/, 'COUNT(DISTINCT OrderID).'], [/COUNT\s*\(\s*DISTINCT\s+CustomerID\s*\)/, 'COUNT(DISTINCT CustomerID).']],
    [[`SELECT SUM(LineRevenue)            AS Revenue,`, ''], [`       COUNT(DISTINCT OrderID)     AS Orders,`, 'DISTINCT: lines repeat each order.'], [`       COUNT(DISTINCT CustomerID)  AS Customers,`, ''], [`       SUM(LineRevenue) / COUNT(DISTINCT OrderID) AS AvgOrderValue`, ''], [`FROM reporting.vSalesLineDetail;`, '']], { alt: [['d16b']] });
  R('d47', 3, 'Compare revenue and order counts by channel.', ['by channel'],
    'One row per channel with two measures: GROUP BY.', ['reporting.vSalesLineDetail'], ['d47', 'd18', 'd10'],
    [[/GROUP\s+BY\s+Channel/, 'GROUP BY Channel.'], [/COUNT\s*\(\s*DISTINCT\s+OrderID/, 'COUNT(DISTINCT OrderID) for orders.']],
    [[`SELECT Channel,`, ''], [`       SUM(LineRevenue)        AS Revenue,`, ''], [`       COUNT(DISTINCT OrderID) AS Orders`, ''], [`FROM reporting.vSalesLineDetail\nGROUP BY Channel;`, '']], { need: ['d16b'], alt: [['d47']] });

  R('d49', 1, 'What share of total revenue does each category bring in?', ['share of total revenue'],
    'Part-to-whole: each category’s total ÷ the grand total, which SUM() OVER () gives.', ['reporting.vSalesLineDetail'], ['d16b', 'd24', 'd17'],
    [[/SUM\s*\(\s*SUM\s*\(\s*LineRevenue\s*\)\s*\)\s*OVER\s*\(\s*\)|\/\s*\(\s*SELECT\s+SUM/, 'SUM(SUM(LineRevenue)) OVER () for the grand total.'], [/GROUP\s+BY\s+Category/, 'GROUP BY Category.']],
    [[`SELECT Category, SUM(LineRevenue) AS Revenue,`, ''], [`       100.0 * SUM(LineRevenue) / SUM(SUM(LineRevenue)) OVER () AS PctOfTotal`, 'OVER () with nothing inside means “all rows.”'], [`FROM reporting.vSalesLineDetail`, ''], [`GROUP BY Category;`, '']], { ok: ['d16b', 'd18'], alt: [['d18', 'd16b'], ['d24', 'd16b']] });
  R('d49', 2, 'Show monthly revenue against the monthly target for each category.', ['against the monthly target'],
    'Monthly totals per category, joined to sales.MonthlyTargets on month and category.', ['reporting.vSalesLineDetail', 'sales.MonthlyTargets'], ['d16b', 'd19', 'd10'],
    [[/JOIN\s+sales\.MonthlyTargets/, 'JOIN sales.MonthlyTargets.'], [/DATEFROMPARTS|DATETRUNC/, 'Turn OrderDate into the first of its month.']],
    [[`WITH CatMonth AS (\n  SELECT DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1) AS TargetMonth,\n         Category, SUM(LineRevenue) AS Revenue\n  FROM reporting.vSalesLineDetail\n  GROUP BY DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1), Category\n)`, ''], [`SELECT cm.*, t.RevenueTarget, cm.Revenue - t.RevenueTarget AS VsTarget`, ''], [`FROM CatMonth AS cm\nJOIN sales.MonthlyTargets AS t\n  ON t.TargetMonth = cm.TargetMonth AND t.Category = cm.Category;`, '']], { ok: ['d08', 'd16b', 'd26', 'd12'], alt: [['d26', 'd08'], ['d16b', 'd08']] });
  R('d49', 3, 'Segment customers by spend: High over $1,000, Medium $300–$1,000, Low under $300. How many in each?', ['Segment customers by spend', 'How many in each'],
    'Spend per customer, a CASE band, then a count per band: three earlier cards working together.', ['reporting.vSalesLineDetail'], ['d21', 'd20', 'd18'],
    [[/CASE[\s\S]*WHEN/, 'A CASE for the bands.'], [/GROUP\s+BY/, 'GROUP BY to count each band.']],
    [[`WITH Spend AS (\n  SELECT CustomerID, SUM(LineRevenue) AS Total\n  FROM reporting.vSalesLineDetail\n  GROUP BY CustomerID\n)`, 'Step one: spend per customer.'], [`SELECT CASE WHEN Total > 1000 THEN 'High'\n            WHEN Total >= 300 THEN 'Medium'\n            ELSE 'Low' END AS Segment,\n       COUNT(*) AS Customers`, 'Step two: band and count.'], [`FROM Spend\nGROUP BY CASE WHEN Total > 1000 THEN 'High'\n              WHEN Total >= 300 THEN 'Medium'\n              ELSE 'Low' END;`, '']], { ok: ['d16a', 'd16b', 'd26'], alt: [['d16a', 'd16b'], ['d16a', 'd26'], ['d16a', 'd16b', 'd26']], no: { d21: 'NTILE makes equal-sized groups. These bands have fixed dollar cutoffs, so CASE fits.' } });

  window.SIG = Object.assign(window.SIG || {}, { REQUESTS: Q });
})();
