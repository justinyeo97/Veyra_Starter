import { query, transaction } from "./db.js";
import {
  COLLECTIONS,
  DELETE_ORDER,
  UPSERT_ORDER,
  columnsOf,
  fromRow,
  toRow,
} from "./tables.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_SETTINGS = {
  store: {
    name: "Veyra Sneaker Co.",
    description: "Authenticated sneakers, cleaned and shipped within two business days.",
    currency: "USD",
    shippingFee: 15,
    platformFee: 9,
  },
  notifications: { orders: true, inventory: true, tasks: true, payments: true },
  theme: "light",
};

const SETTINGS_SECTIONS = ["store", "notifications", "theme"];

function quoted(column) {
  return `"${column}"`;
}

export function assertCollection(collection) {
  if (!Object.hasOwn(COLLECTIONS, collection)) {
    throw new HttpError(404, `Unknown collection "${collection}".`);
  }
}

export async function listCollection(collection, db = { query }) {
  assertCollection(collection);
  const { rows } = await db.query(`SELECT * FROM ${quoted(collection)} ORDER BY seq DESC`);
  return rows.map((row) => fromRow(collection, row));
}

export async function getRecord(collection, id, db = { query }) {
  assertCollection(collection);
  const { rows } = await db.query(`SELECT * FROM ${quoted(collection)} WHERE id = $1`, [id]);
  return rows[0] ? fromRow(collection, rows[0]) : null;
}

export async function upsertRecords(collection, records, db = { query }) {
  assertCollection(collection);
  if (!Array.isArray(records) || records.length === 0) return [];
  for (const record of records) {
    if (!record || typeof record.id !== "string" || !record.id.trim()) {
      throw new HttpError(400, `Every ${collection} record needs a text id.`);
    }
  }
  const columns = columnsOf(collection).map(quoted).join(", ");
  const updates = columnsOf(collection)
    .filter((column) => column !== "id")
    .map((column) => `${quoted(column)} = EXCLUDED.${quoted(column)}`)
    .join(", ");
  const rows = [...records].reverse().map((record) => toRow(collection, record));
  const { rows: saved } = await db.query(
    `INSERT INTO ${quoted(collection)} (${columns})
     SELECT ${columns} FROM jsonb_populate_recordset(NULL::${quoted(collection)}, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET ${updates}
     RETURNING *`,
    [JSON.stringify(rows)],
  );
  return saved.map((row) => fromRow(collection, row));
}

export async function deleteRecords(collection, ids, db = { query }) {
  assertCollection(collection);
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const { rowCount } = await db.query(
    `DELETE FROM ${quoted(collection)} WHERE id = ANY($1::text[])`,
    [ids.map(String)],
  );
  return rowCount;
}

export async function nextId(collection, db = { query }) {
  assertCollection(collection);
  const { prefix } = COLLECTIONS[collection];
  const { rows } = await db.query(
    `SELECT COALESCE(MAX((substring(id FROM '[0-9]+$'))::int), 1000) AS highest
     FROM ${quoted(collection)} WHERE id ~ '[0-9]+$'`,
  );
  return `${prefix}-${Number(rows[0].highest) + 1}`;
}

export async function createRecord(collection, record) {
  assertCollection(collection);
  return transaction(async (client) => {
    const id = record.id || (await nextId(collection, client));
    const createdAt = COLLECTIONS[collection].fields.createdAt;
    const defaults = {};
    if (createdAt === "ts") defaults.createdAt = new Date().toISOString();
    if (createdAt === "date") defaults.createdAt = new Date().toISOString().slice(0, 10);
    const [saved] = await upsertRecords(collection, [{ ...defaults, ...record, id }], client);
    return saved;
  });
}

export async function updateRecord(collection, id, patch) {
  assertCollection(collection);
  return transaction(async (client) => {
    const existing = await getRecord(collection, id, client);
    if (!existing) throw new HttpError(404, `${collection} record ${id} was not found.`);
    const [saved] = await upsertRecords(collection, [{ ...existing, ...patch, id }], client);
    return saved;
  });
}

export async function loadAllData(db = { query }) {
  const data = {};
  for (const collection of UPSERT_ORDER) {
    data[collection] = await listCollection(collection, db);
  }
  return data;
}

export async function applyChanges(changes) {
  if (!changes || typeof changes !== "object") {
    throw new HttpError(400, "Send the changes as { collection: { upsert: [], delete: [] } }.");
  }
  Object.keys(changes).forEach(assertCollection);
  return transaction(async (client) => {
    const summary = {};
    for (const collection of DELETE_ORDER) {
      const removed = await deleteRecords(collection, changes[collection]?.delete, client);
      if (removed) summary[collection] = { ...summary[collection], deleted: removed };
    }
    for (const collection of UPSERT_ORDER) {
      const saved = await upsertRecords(collection, changes[collection]?.upsert, client);
      if (saved.length) summary[collection] = { ...summary[collection], saved: saved.length };
    }
    return summary;
  });
}

export async function getSettings(db = { query }) {
  const { rows } = await db.query("SELECT store, notifications, theme FROM settings WHERE id = 1");
  if (!rows[0]) return structuredClone(DEFAULT_SETTINGS);
  return {
    store: { ...DEFAULT_SETTINGS.store, ...rows[0].store },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...rows[0].notifications },
    theme: rows[0].theme || DEFAULT_SETTINGS.theme,
  };
}

export async function saveSettingsSection(section, value) {
  if (!SETTINGS_SECTIONS.includes(section)) {
    throw new HttpError(400, `Settings section must be one of: ${SETTINGS_SECTIONS.join(", ")}.`);
  }
  if (section === "theme" && !["light", "dark"].includes(value)) {
    throw new HttpError(400, "Theme must be light or dark.");
  }
  if (section !== "theme" && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw new HttpError(400, `The ${section} settings must be an object.`);
  }
  const current = await getSettings();
  const next = { ...current, [section]: value };
  await query(
    `INSERT INTO settings (id, store, notifications, theme)
     VALUES (1, $1::jsonb, $2::jsonb, $3)
     ON CONFLICT (id) DO UPDATE SET store = EXCLUDED.store, notifications = EXCLUDED.notifications, theme = EXCLUDED.theme`,
    [JSON.stringify(next.store), JSON.stringify(next.notifications), next.theme],
  );
  return next;
}
