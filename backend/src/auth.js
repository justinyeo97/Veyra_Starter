import crypto from "node:crypto";
import { promisify } from "node:util";
import { query, transaction } from "./db.js";
import { HttpError } from "./store.js";

const scrypt = promisify(crypto.scrypt);
const RESET_MINUTES = 30;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(String(password), salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    expectedBuffer.length === actual.length &&
    crypto.timingSafeEqual(actual, expectedBuffer)
  );
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar || "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function normaliseEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label} is required.`);
  }
  return value.trim();
}

function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }
}

async function findUserByEmail(email, db = { query }) {
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [
    normaliseEmail(email),
  ]);
  return rows[0] || null;
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await query("INSERT INTO sessions (token, user_id) VALUES ($1, $2)", [
    token,
    userId,
  ]);
  return token;
}

export async function login({ email, password }) {
  const account = await findUserByEmail(email);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    throw new HttpError(401, "Incorrect email or password.");
  }
  return { token: await createSession(account.id), user: publicUser(account) };
}

export async function signup({ name, email, password }) {
  const cleanName = requireText(name, "Name");
  const cleanEmail = normaliseEmail(requireText(email, "Email"));
  checkPassword(password);
  const passwordHash = await hashPassword(password);
  const account = await transaction(async (client) => {
    if (await findUserByEmail(cleanEmail, client)) {
      throw new HttpError(
        409,
        "An account with this email already exists. Log in instead.",
      );
    }
    const { rows } = await client.query(
      `INSERT INTO users (id, name, email, avatar, password_hash)
       VALUES (
         'USR-' || (SELECT COALESCE(MAX((substring(id FROM '[0-9]+$'))::int), 1000) + 1 FROM users WHERE id ~ '[0-9]+$'),
         $1, $2, '', $3
       )
       RETURNING *`,
      [cleanName, cleanEmail, passwordHash],
    );
    return rows[0];
  });
  return { token: await createSession(account.id), user: publicUser(account) };
}

export async function requestPasswordReset({ email }) {
  const account = await findUserByEmail(email);
  if (!account)
    throw new HttpError(404, "We could not find an account with that email.");
  const code = String(crypto.randomInt(100000, 1000000));
  await query(
    `INSERT INTO password_resets (email, code, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))
     ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
    [account.email, code, RESET_MINUTES],
  );
  return { code, expiresInMinutes: RESET_MINUTES };
}

export async function resetPassword({ email, code, password }) {
  checkPassword(password);
  const account = await findUserByEmail(email);
  const { rows } = account
    ? await query(
        "SELECT code, expires_at FROM password_resets WHERE email = $1",
        [account.email],
      )
    : { rows: [] };
  const reset = rows[0];
  if (!account || !reset || reset.code !== String(code || "").trim()) {
    throw new HttpError(400, "That reset code is not valid for this email.");
  }
  if (new Date(reset.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, "That reset code has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(password);
  await transaction(async (client) => {
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      account.id,
    ]);
    await client.query("DELETE FROM password_resets WHERE email = $1", [
      account.email,
    ]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [account.id]);
  });
}

export async function updateProfile(userId, { name, email, avatar }) {
  const cleanName = requireText(name, "Name");
  const cleanEmail = normaliseEmail(requireText(email, "Email"));
  const taken = await findUserByEmail(cleanEmail);
  if (taken && taken.id !== userId) {
    throw new HttpError(409, "Another account already uses this email.");
  }
  const { rows } = await query(
    "UPDATE users SET name = $1, email = $2, avatar = $3 WHERE id = $4 RETURNING *",
    [cleanName, cleanEmail, typeof avatar === "string" ? avatar : "", userId],
  );
  return publicUser(rows[0]);
}

export async function logout(token) {
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return next(new HttpError(401, "Log in to continue."));
  const { rows } = await query(
    `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = $1`,
    [token],
  );
  if (!rows[0])
    return next(new HttpError(401, "Your session has ended. Log in again."));
  req.user = publicUser(rows[0]);
  req.token = token;
  next();
}
