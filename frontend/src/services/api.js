import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from "../utils/storage";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  return readStorage(STORAGE_KEYS.token, "");
}

export function setToken(token) {
  if (token) writeStorage(STORAGE_KEYS.token, token);
  else removeStorage(STORAGE_KEYS.token);
}

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Could not reach the Veyra API at ${API_URL}. Check that the server is running.`, 0);
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error || `The API returned an error (${response.status}).`, response.status);
  }
  return payload;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  signup: (values) => request("/auth/signup", { method: "POST", body: values }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (values) => request("/auth/reset-password", { method: "POST", body: values }),
  updateProfile: (values) => request("/auth/me", { method: "PUT", body: values }),
  logout: () => request("/auth/logout", { method: "POST" }),
  bootstrap: () => request("/bootstrap"),
  sync: (changes) => request("/sync", { method: "POST", body: { changes } }),
  saveSettings: (section, value) => request(`/settings/${section}`, { method: "PUT", body: { value } }),
};
