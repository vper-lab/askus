export const firebaseDatabaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || "";

export function hasFirebaseConfig() {
  return Boolean(firebaseDatabaseUrl);
}

function toDbPath(key = "") {
  return key.replace(/[.#$[\]]/g, "-");
}

function buildDbUrl(key) {
  const base = firebaseDatabaseUrl.replace(/\/+$/, "");
  return `${base}/${toDbPath(key)}.json`;
}

export async function storageGetByKey(key) {
  const response = await fetch(buildDbUrl(key));
  if (!response.ok) throw new Error(`Firebase GET ${response.status}`);
  return response.json();
}

export async function storageSetByKey(key, value) {
  const response = await fetch(buildDbUrl(key), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Firebase PUT ${response.status}`);
}

export async function storageDeleteByKey(key) {
  const response = await fetch(buildDbUrl(key), { method: "DELETE" });
  if (!response.ok) throw new Error(`Firebase DELETE ${response.status}`);
}
