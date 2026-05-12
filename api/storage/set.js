import { hasFirebaseConfig, storageSetByKey } from "../_lib/firebase-rest.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!hasFirebaseConfig()) return res.status(500).json({ error: "Firebase backend no configurado." });
  const key = req.body?.key;
  const value = req.body?.value;
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." });
  try {
    await storageSetByKey(key, value);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: `storage/set error: ${error.message}` });
  }
}
