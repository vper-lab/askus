import { hasFirebaseConfig, storageDeleteByKey } from "../_lib/firebase-rest.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!hasFirebaseConfig()) return res.status(500).json({ error: "Firebase backend no configurado." });
  const key = req.body?.key;
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." });
  try {
    await storageDeleteByKey(key);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: `storage/delete error: ${error.message}` });
  }
}
