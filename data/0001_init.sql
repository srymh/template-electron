PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spent_at DATE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  memo TEXT,
  user_id INTEGER,
  category_id INTEGER NOT NULL,
  payment_method_id INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE VIEW expense_view AS
SELECT
  e.id,
  e.spent_at,
  e.amount,
  e.memo,
  u.name AS user,
  c.name AS category,
  p.name AS payment_method
FROM expenses e
LEFT JOIN users u ON e.user_id = u.id
JOIN categories c ON e.category_id = c.id
JOIN payment_methods p ON e.payment_method_id = p.id;
