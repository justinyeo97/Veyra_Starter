import cors from "cors";
import express from "express";
import * as auth from "./auth.js";
import { query } from "./db.js";
import {
  HttpError,
  applyChanges,
  assertCollection,
  createRecord,
  deleteRecords,
  getRecord,
  getSettings,
  listCollection,
  loadAllData,
  saveSettingsSection,
  updateRecord,
} from "./store.js";

const app = express();

const origins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ name: "Veyra API", health: "/api/health" });
});

app.get("/api/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  res.json(await auth.login(req.body || {}));
});

app.post("/api/auth/signup", async (req, res) => {
  res.status(201).json(await auth.signup(req.body || {}));
});

app.post("/api/auth/forgot-password", async (req, res) => {
  res.json(await auth.requestPasswordReset(req.body || {}));
});

app.post("/api/auth/reset-password", async (req, res) => {
  await auth.resetPassword(req.body || {});
  res.json({ ok: true });
});

app.use("/api", auth.requireAuth);

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.user });
});

app.put("/api/auth/me", async (req, res) => {
  res.json({ user: await auth.updateProfile(req.user.id, req.body || {}) });
});

app.post("/api/auth/logout", async (req, res) => {
  await auth.logout(req.token);
  res.json({ ok: true });
});

app.get("/api/bootstrap", async (req, res) => {
  const [data, settings] = await Promise.all([loadAllData(), getSettings()]);
  res.json({ user: req.user, data, settings });
});

app.post("/api/sync", async (req, res) => {
  res.json({ ok: true, summary: await applyChanges(req.body?.changes) });
});

app.get("/api/settings", async (req, res) => {
  res.json(await getSettings());
});

app.put("/api/settings/:section", async (req, res) => {
  res.json(await saveSettingsSection(req.params.section, req.body?.value));
});

app.param("collection", (req, res, next, collection) => {
  assertCollection(collection);
  next();
});

app.get("/api/:collection", async (req, res) => {
  res.json(await listCollection(req.params.collection));
});

app.get("/api/:collection/:id", async (req, res) => {
  const record = await getRecord(req.params.collection, req.params.id);
  if (!record) throw new HttpError(404, `${req.params.id} was not found.`);
  res.json(record);
});

app.post("/api/:collection", async (req, res) => {
  res
    .status(201)
    .json(await createRecord(req.params.collection, req.body || {}));
});

app.put("/api/:collection/:id", async (req, res) => {
  res.json(
    await updateRecord(req.params.collection, req.params.id, req.body || {}),
  );
});

app.delete("/api/:collection/:id", async (req, res) => {
  const removed = await deleteRecords(req.params.collection, [req.params.id]);
  if (!removed) throw new HttpError(404, `${req.params.id} was not found.`);
  res.status(204).end();
});

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}.` });
});

const DATABASE_ERRORS = {
  23505: [409, "That record already exists."],
  23503: [400, "That record points to something that does not exist."],
  23514: [400, "One of the values is not allowed."],
  "22P02": [400, "One of the values has the wrong format."],
  22007: [400, "One of the dates has the wrong format."],
  22008: [400, "One of the dates is out of range."],
};

const CONNECTION_ERRORS = [
  "ENETUNREACH",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ECONNRESET",
  "EAI_AGAIN",
];

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ error: "The request body is not valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "The request is too large." });
  }
  if (CONNECTION_ERRORS.includes(error.code)) {
    console.error(`Database unreachable (${error.code}): ${error.message}`);
    return res.status(503).json({
      error:
        "The Veyra API cannot reach the database. Check DATABASE_URL in backend/.env and use the Supabase Session pooler connection string.",
    });
  }
  if (error.code === "28P01" || error.code === "28000") {
    return res
      .status(503)
      .json({
        error:
          "The database rejected the login. Check the password in DATABASE_URL.",
      });
  }
  if (
    error.code === "XX000" &&
    /tenant or user not found/i.test(error.message)
  ) {
    return res
      .status(503)
      .json({
        error:
          "Supabase could not find that project. Copy the Session pooler string from Supabase again.",
      });
  }
  const known = DATABASE_ERRORS[error.code];
  if (known) {
    return res
      .status(known[0])
      .json({ error: known[1], detail: error.detail || error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

export default app;
