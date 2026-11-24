BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  avatar text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  email text PRIMARY KEY,
  code text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store jsonb NOT NULL,
  notifications jsonb NOT NULL,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark'))
);

CREATE TABLE IF NOT EXISTS customers (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at date DEFAULT current_date
);

CREATE TABLE IF NOT EXISTS sneakers (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  size numeric(4, 1),
  colorway text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT 'New / Deadstock'
    CHECK (condition IN ('New / Deadstock', 'Like New', 'Used - Excellent', 'Used - Good', 'Used - Fair')),
  purchase_price numeric(12, 2) CHECK (purchase_price >= 0),
  listing_price numeric(12, 2) CHECK (listing_price >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  purchase_date date,
  listing_date date,
  status text NOT NULL DEFAULT 'Purchased'
    CHECK (status IN ('Purchased', 'Cleaning', 'Ready to List', 'Listed', 'Sold', 'Shipped')),
  image text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  customer_id text,
  sneaker_id text,
  sneaker_label text NOT NULL DEFAULT '',
  order_date date,
  sale_price numeric(12, 2) CHECK (sale_price >= 0),
  shipping_fee numeric(12, 2) CHECK (shipping_fee >= 0),
  platform_fee numeric(12, 2) CHECK (platform_fee >= 0),
  purchase_price numeric(12, 2),
  payment_status text NOT NULL DEFAULT 'Pending'
    CHECK (payment_status IN ('Pending', 'Paid', 'Refunded', 'Failed')),
  shipping_status text NOT NULL DEFAULT 'Processing'
    CHECK (shipping_status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled')),
  notes text NOT NULL DEFAULT '',
  inventory_applied boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_sneaker_id_idx ON orders (sneaker_id);

CREATE TABLE IF NOT EXISTS tasks (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Completed')),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  due_date date,
  created_date date DEFAULT current_date,
  assignee text NOT NULL DEFAULT '',
  sneaker_id text REFERENCES sneakers (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tasks_sneaker_id_idx ON tasks (sneaker_id);

CREATE TABLE IF NOT EXISTS listings (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  sneaker_id text REFERENCES sneakers (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  price numeric(12, 2) CHECK (price >= 0),
  size numeric(4, 1),
  condition text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'Veyra' CHECK (platform IN ('Veyra', 'StockX', 'GOAT', 'eBay')),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Sold', 'Archived')),
  date_listed date
);

CREATE INDEX IF NOT EXISTS listings_sneaker_id_idx ON listings (sneaker_id);

CREATE TABLE IF NOT EXISTS notifications (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id text PRIMARY KEY,
  key text UNIQUE,
  type text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

INSERT INTO users (id, name, email, avatar, password_hash) VALUES
  ('USR-1001', 'Jamie Cole', 'demo@veyra.app', '', 'scrypt$786bf1fdcce8d9f3017f14dd34d16651$0409ab077ccf026ded0aa1522f77741c1533f7e73f03203094e8561c66258622633c7e0ccc4e7347d452660ab3da9bf7e1fc5da12f60c1037cfb475f479d27b5')
ON CONFLICT (id) DO NOTHING;

INSERT INTO settings (id, store, notifications, theme) VALUES
  (1, '{"name":"Veyra Sneaker Co.","description":"Authenticated sneakers, cleaned and shipped within two business days.","currency":"USD","shippingFee":15,"platformFee":9}'::jsonb, '{"orders":true,"inventory":true,"tasks":true,"payments":true}'::jsonb, 'light')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, name, email, phone, address, notes, created_at) VALUES
  ('CUS-1015', 'Demo Customer 15', 'customer15@example.com', '+1 202 555 0115', '15 Example Street, Example City', '', '2026-08-14'),
  ('CUS-1014', 'Demo Customer 14', 'customer14@example.com', '+1 202 555 0114', '14 Example Street, Example City', '', '2026-08-05'),
  ('CUS-1013', 'Demo Customer 13', 'customer13@example.com', '+1 202 555 0113', '13 Example Street, Example City', '', '2026-07-27'),
  ('CUS-1012', 'Demo Customer 12', 'customer12@example.com', '+1 202 555 0112', '12 Example Street, Example City', '', '2026-07-18'),
  ('CUS-1011', 'Demo Customer 11', 'customer11@example.com', '+1 202 555 0111', '11 Example Street, Example City', '', '2026-07-09'),
  ('CUS-1010', 'Demo Customer 10', 'customer10@example.com', '+1 202 555 0110', '10 Example Street, Example City', '', '2026-06-30'),
  ('CUS-1009', 'Demo Customer 09', 'customer09@example.com', '+1 202 555 0109', '9 Example Street, Example City', '', '2026-06-21'),
  ('CUS-1008', 'Demo Customer 08', 'customer08@example.com', '+1 202 555 0108', '8 Example Street, Example City', '', '2026-06-12'),
  ('CUS-1007', 'Demo Customer 07', 'customer07@example.com', '+1 202 555 0107', '7 Example Street, Example City', '', '2026-06-03'),
  ('CUS-1006', 'Demo Customer 06', 'customer06@example.com', '+1 202 555 0106', '6 Example Street, Example City', '', '2026-05-25'),
  ('CUS-1005', 'Demo Customer 05', 'customer05@example.com', '+1 202 555 0105', '5 Example Street, Example City', '', '2026-05-16'),
  ('CUS-1004', 'Demo Customer 04', 'customer04@example.com', '+1 202 555 0104', '4 Example Street, Example City', '', '2026-05-07'),
  ('CUS-1003', 'Demo Customer 03', 'customer03@example.com', '+1 202 555 0103', '3 Example Street, Example City', '', '2026-04-28'),
  ('CUS-1002', 'Demo Customer 02', 'customer02@example.com', '+1 202 555 0102', '2 Example Street, Example City', '', '2026-04-19'),
  ('CUS-1001', 'Demo Customer 01', 'customer01@example.com', '+1 202 555 0101', '1 Example Street, Example City', '', '2026-04-10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sneakers (id, brand, model, sku, size, colorway, condition, purchase_price, listing_price, quantity, purchase_date, listing_date, status, image, description, notes, history, created_at) VALUES
  ('SNK-1020', 'Vans', 'Old Skool', 'VN000D3HY28', 8, 'Black/White', 'Used - Good', 45, 75, 1, '2026-11-11', NULL, 'Cleaning', '', 'Canvas and suede skate shoe with the sidestripe and a waffle outsole.', 'Visible wear on the toe. Price as a budget pair.', '[{"id":"1","status":"Purchased","date":"2026-11-11T09:00:00","note":"Bought 1 at 45 each."},{"id":"2","status":"Cleaning","date":"2026-11-12T10:00:00","note":"Inspected and sent for cleaning."}]'::jsonb, '2026-11-11T02:30:00.000Z'),
  ('SNK-1019', 'PUMA', 'Suede Classic XXI', '374915-01', 9, 'Puma Black/Puma White', 'New / Deadstock', 55, 85, 2, '2026-11-14', NULL, 'Purchased', '', 'The 1968 suede icon with a soft upper, formstrip and a classic rubber cupsole.', 'Clearance buy for bundle deals.', '[{"id":"1","status":"Purchased","date":"2026-11-14T09:00:00","note":"Bought 2 at 55 each."}]'::jsonb, '2026-11-14T02:30:00.000Z'),
  ('SNK-1018', 'Converse', 'Chuck 70 Hi x Comme des Garcons PLAY', '150204C', 7, 'Black/White/High Risk Red', 'New / Deadstock', 110, 160, 2, '2026-07-09', '2026-07-14', 'Listed', '', 'Premium canvas Chuck 70 with the CDG PLAY heart graphic peeking over the midsole.', 'Small sizes sell fastest.', '[{"id":"1","status":"Purchased","date":"2026-07-09T09:00:00","note":"Bought 3 at 110 each."},{"id":"2","status":"Cleaning","date":"2026-07-10T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-07-12T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-07-14T12:00:00","note":"Listed at 160."}]'::jsonb, '2026-07-09T02:30:00.000Z'),
  ('SNK-1017', 'Jordan', 'Air Jordan 3 Retro "White Cement Reimagined"', 'DN3707-100', 10, 'Summit White/Fire Red-Black-Cement Grey', 'New / Deadstock', 210, 290, 1, '2026-07-29', '2026-08-04', 'Listed', '', 'Aged sail midsole, elephant print overlays and Nike Air on the heel, in a vintage-look box.', 'Last pair is a 10. Promote it on the Veyra storefront.', '[{"id":"1","status":"Purchased","date":"2026-07-29T09:00:00","note":"Bought 2 at 210 each."},{"id":"2","status":"Cleaning","date":"2026-07-30T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-08-01T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-08-04T12:00:00","note":"Listed at 290."}]'::jsonb, '2026-07-29T02:30:00.000Z'),
  ('SNK-1016', 'Nike', 'Air Max 90 "Infrared"', 'CT1685-100', 8.5, 'White/Black-Cool Grey-Radiant Red', 'New / Deadstock', 120, 175, 0, '2026-04-30', '2026-05-10', 'Shipped', '', 'The 1990 original colourway with infrared accents and a visible Air unit.', 'Shipped with insurance.', '[{"id":"1","status":"Purchased","date":"2026-04-30T09:00:00","note":"Bought 1 at 120 each."},{"id":"2","status":"Cleaning","date":"2026-05-01T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-05-03T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-05-10T12:00:00","note":"Listed at 175."},{"id":"5","status":"Sold","date":"2026-06-09T13:00:00","note":"Last pair sold."},{"id":"6","status":"Shipped","date":"2026-06-10T14:00:00","note":"Handed to the courier."}]'::jsonb, '2026-04-30T02:30:00.000Z'),
  ('SNK-1015', 'Salomon', 'XT-6 "Black Phantom"', 'L41086600', 9, 'Black/Black/Phantom', 'Like New', 160, 230, 1, '2026-11-07', NULL, 'Ready to List', '', 'Trail runner with Quicklace, SensiFit cradle and an aggressive Contagrip outsole.', 'Tried on indoors only. Price slightly under new retail.', '[{"id":"1","status":"Purchased","date":"2026-11-07T09:00:00","note":"Bought 1 at 160 each."},{"id":"2","status":"Cleaning","date":"2026-11-08T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-11-10T11:00:00","note":"Photographed and ready to list."}]'::jsonb, '2026-11-07T02:30:00.000Z'),
  ('SNK-1014', 'adidas', 'Forum Low x Bad Bunny "Blue Tint"', 'GY9693', 10, 'Blue Tint/Blue Tint/Blue Tint', 'New / Deadstock', 170, 240, 0, '2026-09-25', '2026-10-02', 'Sold', '', 'Pale blue suede with a double-tongue design and a padded collar from the Bad Bunny collaboration.', 'Sold to a repeat customer. Needs packing this week.', '[{"id":"1","status":"Purchased","date":"2026-09-25T09:00:00","note":"Bought 1 at 170 each."},{"id":"2","status":"Cleaning","date":"2026-09-26T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-09-28T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-10-02T12:00:00","note":"Listed at 240."},{"id":"5","status":"Sold","date":"2026-11-15T13:00:00","note":"Last pair sold."}]'::jsonb, '2026-09-25T02:30:00.000Z'),
  ('SNK-1013', 'Nike', 'Air Max 1 x Patta "Waves Monarch"', 'DH1348-001', 9, 'Monarch/Noise Aqua', 'Used - Excellent', 260, 380, 1, '2026-09-07', '2026-09-15', 'Listed', '', 'Patta collaboration with a wavy mudguard and the matching bracelet. Monarch orange and aqua accents.', 'Bracelet included. Minor heel drag on the right shoe, shown in the photos.', '[{"id":"1","status":"Purchased","date":"2026-09-07T09:00:00","note":"Bought 1 at 260 each."},{"id":"2","status":"Cleaning","date":"2026-09-08T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-09-10T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-09-15T12:00:00","note":"Listed at 380."}]'::jsonb, '2026-09-07T02:30:00.000Z'),
  ('SNK-1012', 'Jordan', 'Air Jordan 11 Retro "Cherry"', 'CT8012-116', 11.5, 'White/Varsity Red-Black', 'New / Deadstock', 230, 300, 1, '2026-06-09', '2026-06-19', 'Listed', '', 'Patent leather mudguard in varsity red with a white mesh upper and translucent outsole.', 'Holiday release. Prices usually climb again in December.', '[{"id":"1","status":"Purchased","date":"2026-06-09T09:00:00","note":"Bought 2 at 230 each."},{"id":"2","status":"Cleaning","date":"2026-06-10T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-06-12T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-06-19T12:00:00","note":"Listed at 300."}]'::jsonb, '2026-06-09T02:30:00.000Z'),
  ('SNK-1011', 'Nike', 'SB Dunk Low "Jarritos"', 'FD0860-001', 10, 'Phantom/Safety Orange-Malachite', 'Used - Excellent', 520, 780, 0, '2026-08-20', '2026-08-28', 'Shipped', '', 'Canvas base with tear-away layers that reveal a hidden colourway, inspired by the Mexican soda brand.', 'Worn once. Original box and extra laces included.', '[{"id":"1","status":"Purchased","date":"2026-08-20T09:00:00","note":"Bought 1 at 520 each."},{"id":"2","status":"Cleaning","date":"2026-08-21T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-08-23T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-08-28T12:00:00","note":"Listed at 780."},{"id":"5","status":"Sold","date":"2026-10-25T13:00:00","note":"Last pair sold."},{"id":"6","status":"Shipped","date":"2026-10-26T14:00:00","note":"Handed to the courier."}]'::jsonb, '2026-08-20T02:30:00.000Z'),
  ('SNK-1010', 'ASICS', 'Gel-Kayano 14 "Cream Black"', '1201A019-108', 9.5, 'Cream/Black', 'New / Deadstock', 150, 220, 2, '2026-11-13', NULL, 'Purchased', '', 'Late-2000s runner styling with cream mesh, black overlays and GEL cushioning.', 'Arriving from the supplier in Osaka. Tracking number in the order email.', '[{"id":"1","status":"Purchased","date":"2026-11-13T09:00:00","note":"Bought 2 at 150 each."}]'::jsonb, '2026-11-13T02:30:00.000Z'),
  ('SNK-1009', 'New Balance', '2002R "Protection Pack Rain Cloud"', 'M2002RDA', 10, 'Rain Cloud/Grey', 'Used - Excellent', 140, 210, 1, '2026-11-10', NULL, 'Cleaning', '', 'Layered grey suede with raw, deconstructed edges on an ABZORB and N-ergy cushioned sole.', 'Light creasing on the left toe box. Midsoles need a deep clean.', '[{"id":"1","status":"Purchased","date":"2026-11-10T09:00:00","note":"Bought 1 at 140 each."},{"id":"2","status":"Cleaning","date":"2026-11-11T10:00:00","note":"Inspected and sent for cleaning."}]'::jsonb, '2026-11-10T02:30:00.000Z'),
  ('SNK-1008', 'adidas', 'Samba OG "Cloud White"', 'B75806', 8, 'Cloud White/Core Black/Clear Granite', 'New / Deadstock', 100, 150, 2, '2026-10-07', '2026-10-11', 'Listed', '', 'Soft white leather with black 3-Stripes, suede T-toe overlay and the classic gum sole.', 'High demand in women''s sizes. Bundle offers allowed.', '[{"id":"1","status":"Purchased","date":"2026-10-07T09:00:00","note":"Bought 4 at 100 each."},{"id":"2","status":"Cleaning","date":"2026-10-08T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-10-10T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-10-11T12:00:00","note":"Listed at 150."}]'::jsonb, '2026-10-07T02:30:00.000Z'),
  ('SNK-1007', 'Jordan', 'Travis Scott x Air Jordan 1 Low OG "Reverse Mocha"', 'DM7866-162', 9, 'Sail/University Red-Ridgerock', 'New / Deadstock', 650, 1050, 1, '2026-09-29', '2026-10-07', 'Listed', '', 'Sail leather base with brown suede overlays and the signature reversed Swoosh. Includes the alternate laces.', 'High-value pair. Stored in the locked cabinet. Accept offers above 980.', '[{"id":"1","status":"Purchased","date":"2026-09-29T09:00:00","note":"Bought 1 at 650 each."},{"id":"2","status":"Cleaning","date":"2026-09-30T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-10-02T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-10-07T12:00:00","note":"Listed at 1050."}]'::jsonb, '2026-09-29T02:30:00.000Z'),
  ('SNK-1006', 'Jordan', 'Air Jordan 4 Retro "Military Black"', 'DH6927-111', 10.5, 'White/Black-Neutral Grey', 'New / Deadstock', 210, 330, 0, '2026-09-17', '2026-09-22', 'Sold', '', 'White leather upper with grey suede overlays and black wings, eyelets and outsole.', 'Sold on StockX. Awaiting authentication drop-off.', '[{"id":"1","status":"Purchased","date":"2026-09-17T09:00:00","note":"Bought 1 at 210 each."},{"id":"2","status":"Cleaning","date":"2026-09-18T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-09-20T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-09-22T12:00:00","note":"Listed at 330."},{"id":"5","status":"Sold","date":"2026-11-13T13:00:00","note":"Last pair sold."}]'::jsonb, '2026-09-17T02:30:00.000Z'),
  ('SNK-1005', 'Nike', 'Air Force 1 Low ''07 "Triple White"', 'CW2288-111', 9, 'White/White', 'New / Deadstock', 90, 120, 2, '2026-06-19', '2026-06-24', 'Listed', '', 'The all-white AF1 with crisp leather, perforated toe box and Nike Air cushioning.', 'Steady seller. Reorder when stock drops below two pairs.', '[{"id":"1","status":"Purchased","date":"2026-06-19T09:00:00","note":"Bought 4 at 90 each."},{"id":"2","status":"Cleaning","date":"2026-06-20T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-06-22T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-06-24T12:00:00","note":"Listed at 120."}]'::jsonb, '2026-06-19T02:30:00.000Z'),
  ('SNK-1004', 'New Balance', '550 "White Green"', 'BB550WT1', 8.5, 'White/Green', 'New / Deadstock', 110, 165, 2, '2026-11-04', NULL, 'Ready to List', '', 'A clean 1989 basketball silhouette in white leather with green N branding and heel tab.', 'Photos taken. Waiting on final price check against StockX last sales.', '[{"id":"1","status":"Purchased","date":"2026-11-04T09:00:00","note":"Bought 2 at 110 each."},{"id":"2","status":"Cleaning","date":"2026-11-05T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-11-07T11:00:00","note":"Photographed and ready to list."}]'::jsonb, '2026-11-04T02:30:00.000Z'),
  ('SNK-1003', 'adidas', 'Yeezy Boost 350 V2 "Bone"', 'HQ6316', 11, 'Bone/Bone/Bone', 'New / Deadstock', 230, 285, 1, '2026-09-03', '2026-09-07', 'Listed', '', 'Tonal off-white Primeknit upper on a full-length Boost midsole with a translucent rubber outsole.', 'One pair left after the GOAT sale.', '[{"id":"1","status":"Purchased","date":"2026-09-03T09:00:00","note":"Bought 2 at 230 each."},{"id":"2","status":"Cleaning","date":"2026-09-04T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-09-06T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-09-07T12:00:00","note":"Listed at 285."}]'::jsonb, '2026-09-03T02:30:00.000Z'),
  ('SNK-1002', 'Jordan', 'Air Jordan 1 Retro High OG "Chicago Lost & Found"', 'DZ5485-612', 9.5, 'Varsity Red/Black-Sail-Muslin', 'New / Deadstock', 180, 290, 0, '2026-07-19', '2026-07-27', 'Shipped', '', 'A vintage-inspired take on the 1985 Chicago colourway, with cracked-leather details, a sail midsole and a distressed box.', 'Box has the intentional "damaged" retail packaging. Shipped double-boxed.', '[{"id":"1","status":"Purchased","date":"2026-07-19T09:00:00","note":"Bought 1 at 180 each."},{"id":"2","status":"Cleaning","date":"2026-07-20T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-07-22T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-07-27T12:00:00","note":"Listed at 290."},{"id":"5","status":"Sold","date":"2026-08-07T13:00:00","note":"Last pair sold."},{"id":"6","status":"Shipped","date":"2026-08-08T14:00:00","note":"Handed to the courier."}]'::jsonb, '2026-07-19T02:30:00.000Z'),
  ('SNK-1001', 'Nike', 'Dunk Low Retro "Panda"', 'DD1391-100', 10, 'White/Black', 'New / Deadstock', 110, 135, 2, '2026-08-12', '2026-08-18', 'Listed', '', 'The two-tone Dunk that became an everyday staple. Smooth white leather base with black overlays and a classic cupsole.', 'Bought a 5-pair lot from a Nike outlet restock. Keep the boxes stacked in rack B.', '[{"id":"1","status":"Purchased","date":"2026-08-12T09:00:00","note":"Bought 5 at 110 each."},{"id":"2","status":"Cleaning","date":"2026-08-13T10:00:00","note":"Inspected and sent for cleaning."},{"id":"3","status":"Ready to List","date":"2026-08-15T11:00:00","note":"Photographed and ready to list."},{"id":"4","status":"Listed","date":"2026-08-18T12:00:00","note":"Listed at 135."}]'::jsonb, '2026-08-12T02:30:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, customer_id, sneaker_id, sneaker_label, order_date, sale_price, shipping_fee, platform_fee, purchase_price, payment_status, shipping_status, notes, inventory_applied) VALUES
  ('ORD-1020', 'CUS-1005', 'SNK-1012', '', '2026-11-15', 295, 14, 8.85, 230, 'Pending', 'Processing', '', false),
  ('ORD-1019', 'CUS-1013', 'SNK-1008', '', '2026-11-01', 150, 20, 12, 100, 'Refunded', 'Cancelled', '', false),
  ('ORD-1018', 'CUS-1010', 'SNK-1013', '', '2026-11-11', 375, 16, 33.75, 260, 'Failed', 'Processing', '', false),
  ('ORD-1017', 'CUS-1008', 'SNK-1007', '', '2026-11-14', 1020, 25, 91.8, 650, 'Pending', 'Processing', '', false),
  ('ORD-1016', 'CUS-1012', 'SNK-1018', '', '2026-11-16', 165, 26, 4.95, 110, 'Paid', 'Processing', '', true),
  ('ORD-1015', 'CUS-1009', 'SNK-1017', '', '2026-11-04', 295, 18, 28.03, 210, 'Paid', 'Shipped', '', true),
  ('ORD-1014', 'CUS-1003', 'SNK-1016', '', '2026-06-09', 180, 28, 16.2, 120, 'Paid', 'Delivered', '', true),
  ('ORD-1013', 'CUS-1014', 'SNK-1014', '', '2026-11-15', 245, 14, 7.35, 170, 'Paid', 'Processing', '', true),
  ('ORD-1012', 'CUS-1006', 'SNK-1012', '', '2026-09-13', 310, 24, 27.9, 230, 'Paid', 'Delivered', '', true),
  ('ORD-1011', 'CUS-1014', 'SNK-1011', '', '2026-10-25', 795, 20, 75.53, 520, 'Paid', 'Delivered', '', true),
  ('ORD-1010', 'CUS-1002', 'SNK-1008', '', '2026-11-10', 150, 12, 12, 100, 'Paid', 'Shipped', '', true),
  ('ORD-1009', 'CUS-1004', 'SNK-1008', '', '2026-10-17', 155, 12, 4.65, 100, 'Paid', 'Delivered', '', true),
  ('ORD-1008', 'CUS-1001', 'SNK-1006', '', '2026-11-13', 335, 16, 30.15, 210, 'Paid', 'Processing', '', true),
  ('ORD-1007', 'CUS-1011', 'SNK-1005', '', '2026-10-29', 125, 22, 3.75, 90, 'Paid', 'Delivered', '', true),
  ('ORD-1006', 'CUS-1005', 'SNK-1005', '', '2026-07-19', 118, 12, 9.44, 90, 'Paid', 'Delivered', '', true),
  ('ORD-1005', 'CUS-1004', 'SNK-1003', '', '2026-10-21', 290, 15, 27.55, 230, 'Paid', 'Delivered', '', true),
  ('ORD-1004', 'CUS-1001', 'SNK-1002', '', '2026-08-07', 305, 18, 28.98, 180, 'Paid', 'Delivered', '', true),
  ('ORD-1003', 'CUS-1015', 'SNK-1001', '', '2026-11-12', 135, 12, 4.05, 110, 'Paid', 'Processing', '', true),
  ('ORD-1002', 'CUS-1007', 'SNK-1001', '', '2026-10-03', 138, 14, 12.42, 110, 'Paid', 'Delivered', '', true),
  ('ORD-1001', 'CUS-1002', 'SNK-1001', '', '2026-08-26', 140, 14, 12.6, 110, 'Paid', 'Delivered', '', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, title, description, status, priority, due_date, created_date, assignee, sneaker_id) VALUES
  ('TSK-1025', 'Insure high-value pairs', 'Add the Travis Mocha and Jarritos to the insurance schedule.', 'Completed', 'Urgent', '2026-10-22', '2026-10-15', 'Alex Tan', 'SNK-1007'),
  ('TSK-1024', 'Review weekly profit report', 'Compare margins by platform and decide which channel to push.', 'To Do', 'Medium', '2026-11-11', '2026-11-05', 'Marcus Wong', NULL),
  ('TSK-1023', 'Ship CDG Chuck 70 to Priya', 'International shipping. Fill in the customs form.', 'To Do', 'High', '2026-11-18', '2026-11-11', 'Priya Nair', 'SNK-1018'),
  ('TSK-1022', 'Write descriptions for new arrivals', 'PUMA Suede and Vans Old Skool need listing copy.', 'To Do', 'Low', '2026-11-24', '2026-11-12', 'Jordan Lee', 'SNK-1019'),
  ('TSK-1021', 'Update StockX bank details', 'Payouts move to the new business account.', 'In Progress', 'Medium', '2026-11-25', '2026-11-13', 'Alex Tan', NULL),
  ('TSK-1020', 'Collect Kayano 14 delivery', 'Pick up from the courier depot. Bring ID.', 'To Do', 'High', '2026-11-16', '2026-11-09', 'Marcus Wong', 'SNK-1010'),
  ('TSK-1019', 'Confirm delivery of Jarritos order', 'Ask Zara for a review once delivered.', 'Completed', 'Low', '2026-10-31', '2026-10-25', 'Priya Nair', 'SNK-1011'),
  ('TSK-1018', 'Fix photos for Patta AM1 listing', 'Show the heel drag clearly to avoid a dispute.', 'Completed', 'Medium', '2026-10-27', '2026-10-22', 'Jordan Lee', 'SNK-1013'),
  ('TSK-1017', 'Send VIP early access email', 'Tell Zara and Aiden about the Jordan 11 Cherry restock.', 'To Do', 'Medium', '2026-11-23', '2026-11-12', 'Alex Tan', 'SNK-1012'),
  ('TSK-1016', 'Restock Air Force 1 Triple White', 'Only two pairs left. Place an order with the supplier.', 'To Do', 'High', '2026-11-15', '2026-11-12', 'Marcus Wong', 'SNK-1005'),
  ('TSK-1015', 'Process Samba refund', 'Refund Noah once the return is scanned in.', 'Completed', 'High', '2026-11-02', '2026-10-26', 'Priya Nair', 'SNK-1008'),
  ('TSK-1014', 'Prepare 550 listings', 'Draft listings for eBay and the Veyra store.', 'In Progress', 'Medium', '2026-11-18', '2026-11-10', 'Jordan Lee', 'SNK-1004'),
  ('TSK-1013', 'Quarterly inventory count', 'Count every rack and reconcile quantities with Veyra.', 'To Do', 'High', '2026-11-28', '2026-11-11', 'Alex Tan', NULL),
  ('TSK-1012', 'Upload Samba restock to Veyra store', 'Two pairs left. Set the price to 150 and enable bundle offers.', 'Completed', 'Medium', '2026-11-06', '2026-11-02', 'Marcus Wong', 'SNK-1008'),
  ('TSK-1011', 'Clean Vans Old Skool', 'Spot clean the toe box and replace the laces.', 'To Do', 'Low', '2026-11-21', '2026-11-13', 'Priya Nair', 'SNK-1020'),
  ('TSK-1010', 'Reply to Lucas about Travis Mocha', 'He asked for the lowest price including shipping to Lisbon.', 'Completed', 'Medium', '2026-11-12', '2026-11-05', 'Jordan Lee', 'SNK-1007'),
  ('TSK-1009', 'Authenticate Travis Mocha', 'Check stitching, tongue tag and the box label before accepting the offer.', 'Completed', 'High', '2026-11-08', '2026-11-02', 'Alex Tan', 'SNK-1007'),
  ('TSK-1008', 'Order more shipping boxes', 'Size 2 and size 3 boxes are almost out. Order 100 each.', 'To Do', 'Low', '2026-11-22', '2026-11-11', 'Marcus Wong', NULL),
  ('TSK-1007', 'List Salomon XT-6 on GOAT', 'Use the new photo set and mention indoor try-on only.', 'To Do', 'Medium', '2026-11-19', '2026-11-12', 'Priya Nair', 'SNK-1015'),
  ('TSK-1006', 'Follow up on failed payment ORD-1018', 'Email Olivia to retry payment, or release the Patta AM1.', 'In Progress', 'Urgent', '2026-11-14', '2026-11-11', 'Jordan Lee', 'SNK-1013'),
  ('TSK-1005', 'Reprice Panda Dunks', 'Check StockX and GOAT last sales and adjust all three channels.', 'To Do', 'Medium', '2026-11-13', '2026-11-06', 'Alex Tan', 'SNK-1001'),
  ('TSK-1004', 'Ship Bad Bunny Forum to Zara', 'Express shipping requested. Add a fragile sticker.', 'To Do', 'High', '2026-11-17', '2026-11-10', 'Marcus Wong', 'SNK-1014'),
  ('TSK-1003', 'Pack and ship order ORD-1008', 'Air Jordan 4 Military Black. Double box and add the thank-you card.', 'To Do', 'Urgent', '2026-11-15', '2026-11-10', 'Priya Nair', 'SNK-1006'),
  ('TSK-1002', 'Photograph Gel-Kayano 14 pairs', 'Six angles plus sole and box label, on the white backdrop.', 'To Do', 'Medium', '2026-11-20', '2026-11-12', 'Jordan Lee', 'SNK-1010'),
  ('TSK-1001', 'Deep clean 2002R midsoles', 'Use the soft brush kit and foam cleaner. Let them dry overnight before photos.', 'In Progress', 'High', '2026-11-17', '2026-11-13', 'Alex Tan', 'SNK-1009')
ON CONFLICT (id) DO NOTHING;

INSERT INTO listings (id, sneaker_id, title, description, images, price, size, condition, platform, status, date_listed) VALUES
  ('LST-1015', 'SNK-1016', 'Nike Air Max 90 "Infrared"', 'The 1990 original colourway with infrared accents and a visible Air unit. Size US 8.5, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 175, 8.5, 'New / Deadstock', 'StockX', 'Archived', '2026-05-10'),
  ('LST-1014', 'SNK-1004', 'New Balance 550 "White Green"', 'A clean 1989 basketball silhouette in white leather with green N branding and heel tab. Size US 8.5, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 165, 8.5, 'New / Deadstock', 'eBay', 'Draft', '2026-11-14'),
  ('LST-1013', 'SNK-1006', 'Air Jordan 4 Retro "Military Black"', 'White leather upper with grey suede overlays and black wings, eyelets and outsole. Size US 10.5, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 330, 10.5, 'New / Deadstock', 'StockX', 'Sold', '2026-09-22'),
  ('LST-1012', 'SNK-1011', 'Nike SB Dunk Low "Jarritos"', 'Canvas base with tear-away layers that reveal a hidden colourway, inspired by the Mexican soda brand. Size US 10, used - excellent condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 780, 10, 'Used - Excellent', 'GOAT', 'Sold', '2026-08-28'),
  ('LST-1011', 'SNK-1002', 'Air Jordan 1 Retro High OG "Chicago Lost & Found"', 'A vintage-inspired take on the 1985 Chicago colourway, with cracked-leather details, a sail midsole and a distressed box. Size US 9.5, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 290, 9.5, 'New / Deadstock', 'GOAT', 'Sold', '2026-07-27'),
  ('LST-1010', 'SNK-1018', 'Converse Chuck 70 Hi x Comme des Garcons PLAY', 'Premium canvas Chuck 70 with the CDG PLAY heart graphic peeking over the midsole. Size US 7, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 160, 7, 'New / Deadstock', 'eBay', 'Active', '2026-07-14'),
  ('LST-1009', 'SNK-1017', 'Air Jordan 3 Retro "White Cement Reimagined"', 'Aged sail midsole, elephant print overlays and Nike Air on the heel, in a vintage-look box. Size US 10, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 285, 10, 'New / Deadstock', 'Veyra', 'Active', '2026-08-04'),
  ('LST-1008', 'SNK-1013', 'Nike Air Max 1 x Patta "Waves Monarch"', 'Patta collaboration with a wavy mudguard and the matching bracelet. Monarch orange and aqua accents. Size US 9, used - excellent condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 380, 9, 'Used - Excellent', 'GOAT', 'Active', '2026-09-15'),
  ('LST-1007', 'SNK-1012', 'Air Jordan 11 Retro "Cherry"', 'Patent leather mudguard in varsity red with a white mesh upper and translucent outsole. Size US 11.5, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 300, 11.5, 'New / Deadstock', 'StockX', 'Active', '2026-06-19'),
  ('LST-1006', 'SNK-1008', 'adidas Samba OG "Cloud White"', 'Soft white leather with black 3-Stripes, suede T-toe overlay and the classic gum sole. Size US 8, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 145, 8, 'New / Deadstock', 'Veyra', 'Active', '2026-10-11'),
  ('LST-1005', 'SNK-1007', 'Travis Scott x Air Jordan 1 Low OG "Reverse Mocha"', 'Sail leather base with brown suede overlays and the signature reversed Swoosh. Includes the alternate laces. Size US 9, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 1045, 9, 'New / Deadstock', 'Veyra', 'Active', '2026-10-07'),
  ('LST-1004', 'SNK-1005', 'Nike Air Force 1 Low ''07 "Triple White"', 'The all-white AF1 with crisp leather, perforated toe box and Nike Air cushioning. Size US 9, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 120, 9, 'New / Deadstock', 'eBay', 'Active', '2026-06-24'),
  ('LST-1003', 'SNK-1003', 'adidas Yeezy Boost 350 V2 "Bone"', 'Tonal off-white Primeknit upper on a full-length Boost midsole with a translucent rubber outsole. Size US 11, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 285, 11, 'New / Deadstock', 'GOAT', 'Active', '2026-09-07'),
  ('LST-1002', 'SNK-1001', 'Nike Dunk Low Retro "Panda"', 'The two-tone Dunk that became an everyday staple. Smooth white leather base with black overlays and a classic cupsole. Size US 10, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 130, 10, 'New / Deadstock', 'Veyra', 'Active', '2026-09-17'),
  ('LST-1001', 'SNK-1001', 'Nike Dunk Low Retro "Panda"', 'The two-tone Dunk that became an everyday staple. Smooth white leather base with black overlays and a classic cupsole. Size US 10, new / deadstock condition. Ships within 2 business days from the Veyra warehouse.', '[]'::jsonb, 135, 10, 'New / Deadstock', 'StockX', 'Active', '2026-08-18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, "key", type, title, message, link, "read", created_at) VALUES
  ('NTF-1015', 'demo-14', 'sold-sneaker', 'Sold out: SB Dunk Jarritos', 'Your last pair of FD0860-001 has sold.', '/inventory/SNK-1011', true, '2026-10-25T02:30:00.000Z'),
  ('NTF-1014', 'demo-13', 'low-inventory', 'Low stock: Air Jordan 3 White Cement', 'Only 1 pair of DN3707-100 left.', '/inventory/SNK-1017', true, '2026-11-04T02:30:00.000Z'),
  ('NTF-1013', 'demo-12', 'new-order', 'New order ORD-1015', 'Mei Chen bought the Air Jordan 3 White Cement.', '/orders/ORD-1015', true, '2026-11-04T02:30:00.000Z'),
  ('NTF-1012', 'demo-11', 'low-inventory', 'Low stock: Samba OG', 'Only 2 pairs of B75806 left.', '/inventory/SNK-1008', true, '2026-11-10T02:30:00.000Z'),
  ('NTF-1011', 'demo-10', 'new-order', 'New order ORD-1010', 'Sofia Martinez bought the Samba OG.', '/orders/ORD-1010', true, '2026-11-10T02:30:00.000Z'),
  ('NTF-1010', 'demo-9', 'new-order', 'New order ORD-1003', 'Tyler Nguyen bought the Panda Dunk.', '/orders/ORD-1003', true, '2026-11-12T02:30:00.000Z'),
  ('NTF-1009', 'demo-8', 'low-inventory', 'Low stock: Panda Dunk', 'Only 2 pairs of DD1391-100 left.', '/inventory/SNK-1001', false, '2026-11-12T02:30:00.000Z'),
  ('NTF-1008', 'demo-7', 'new-order', 'New order ORD-1008', 'Aiden Brooks bought the Air Jordan 4 Military Black.', '/orders/ORD-1008', true, '2026-11-13T02:30:00.000Z'),
  ('NTF-1007', 'demo-6', 'sold-sneaker', 'Sold out: Air Jordan 4 Military Black', 'Your last pair of DH6927-111 has sold.', '/inventory/SNK-1006', true, '2026-11-13T02:30:00.000Z'),
  ('NTF-1006', 'demo-5', 'new-order', 'New order ORD-1017', 'Lucas Fernandes made an offer for the Travis Mocha. Payment pending.', '/orders/ORD-1017', true, '2026-11-14T02:30:00.000Z'),
  ('NTF-1005', 'demo-4', 'new-order', 'New order ORD-1020', 'Marcus Reed placed an order for the Jordan 11 Cherry. Payment pending.', '/orders/ORD-1020', true, '2026-11-15T00:06:00.000Z'),
  ('NTF-1004', 'demo-3', 'failed-payment', 'Payment failed for ORD-1018', 'Olivia Grant''s card was declined for the Patta Air Max 1.', '/orders/ORD-1018', false, '2026-11-11T02:30:00.000Z'),
  ('NTF-1003', 'demo-2', 'sold-sneaker', 'Sold out: Forum Low x Bad Bunny', 'Your last pair of GY9693 has sold.', '/inventory/SNK-1014', false, '2026-11-15T02:30:00.000Z'),
  ('NTF-1002', 'demo-1', 'new-order', 'New order ORD-1013', 'Zara Ahmed bought the Forum Low x Bad Bunny.', '/orders/ORD-1013', false, '2026-11-15T02:30:00.000Z'),
  ('NTF-1001', 'demo-0', 'new-order', 'New order ORD-1016', 'Priya Raman bought the CDG Chuck 70 Hi for 165.', '/orders/ORD-1016', false, '2026-11-15T21:42:00.000Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
