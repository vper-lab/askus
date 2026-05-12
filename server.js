import express from "express"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { initializeApp } from "firebase/app"
import { getDatabase, ref, get, set, remove } from "firebase/database"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const port = process.env.PORT || 4174
const apiKey = process.env.ANTHROPIC_API_KEY
const fKey = (k = "") => k.replace(/[.#$[\]]/g, "-")

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || "",
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || "",
}

const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
  firebaseConfig.databaseURL,
].every(Boolean)

let db = null
if (hasFirebaseConfig) {
  try {
    const firebaseApp = initializeApp(firebaseConfig)
    db = getDatabase(firebaseApp)
  } catch (error) {
    console.warn("Firebase backend no se pudo inicializar:", error.message)
  }
} else {
  console.warn("Firebase backend no configurado. Define FIREBASE_* o VITE_FIREBASE_* en entorno servidor.")
}

// Cargar preguntas desde JSON
const questionsFile = path.join(__dirname, "questions.json")
let allQuestions = []
try {
  const data = fs.readFileSync(questionsFile, "utf-8")
  allQuestions = JSON.parse(data).questions || []
  console.log(`Cargadas ${allQuestions.length} preguntas desde questions.json`)
} catch (error) {
  console.warn("No se pudo cargar questions.json:", error.message)
}

if (!apiKey) {
  console.warn("ANTHROPIC_API_KEY no esta configurada. Se usaran preguntas estaticas.")
}

app.use(express.json())

app.post("/api/storage/get", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firebase backend no configurado." })
  const key = req.body?.key
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." })
  try {
    const snap = await get(ref(db, fKey(key)))
    if (!snap.exists()) return res.json({ found: false })
    return res.json({ found: true, value: snap.val() })
  } catch (error) {
    return res.status(500).json({ error: `storage/get error: ${error.message}` })
  }
})

app.post("/api/storage/set", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firebase backend no configurado." })
  const key = req.body?.key
  const value = req.body?.value
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." })
  try {
    await set(ref(db, fKey(key)), value)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: `storage/set error: ${error.message}` })
  }
})

app.post("/api/storage/delete", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firebase backend no configurado." })
  const key = req.body?.key
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." })
  try {
    await remove(ref(db, fKey(key)))
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: `storage/delete error: ${error.message}` })
  }
})

app.post("/api/generate", async (req, res) => {
  const { players, meta } = req.body || {}
  if (!Array.isArray(players) || players.length < 2) {
    return res.status(400).json({ error: "Se requieren al menos 2 jugadores." })
  }
  if (!meta || typeof meta.qpd !== "number") {
    return res.status(400).json({ error: "Parametros de meta invalidos." })
  }

  try {
    const n = meta.qpd

    if (allQuestions.length > 0) {
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, Math.min(n, allQuestions.length))
      return res.json({ questions: selected })
    }

    if (!apiKey) {
      return res.status(500).json({ error: "No hay preguntas disponibles ni API key configurada." })
    }

    const names = players.map((p) => p.name).filter(Boolean).join(", ")
    const prompt = `Genera ${n} pregunta${n > 1 ? "s" : ""} muy divertida${n > 1 ? "s" : ""} y original${n > 1 ? "es" : ""} de "¿Quien es mas probable que...?" para un grupo de amigos: ${names}.\n${meta.rules ? `Contexto del grupo: ${meta.rules}` : ""}\nResponde SOLO con un JSON array de strings en espanol. Sin markdown, sin backticks, sin texto adicional. Ejemplo: ["Pregunta uno","Pregunta dos"]`

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const payload = await response.text().catch(() => "")
      return res.status(response.status).json({ error: `Anthropic API error: ${payload}` })
    }

    const data = await response.json()
    let raw = ""

    if (Array.isArray(data.content)) {
      raw = data.content.map((c) => c.text || "").join("")
    } else if (typeof data.completion === "string") {
      raw = data.completion
    } else if (Array.isArray(data.choices)) {
      raw = data.choices.map((c) => c.message?.content || c.text || "").join("")
    }

    raw = raw.trim().replace(/```json|```/g, "").trim()
    const texts = JSON.parse(raw)

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error("Respuesta invalida de Anthropic")
    }

    return res.json({ questions: texts })
  } catch (error) {
    console.error("generate error:", error)
    return res.status(500).json({ error: "Error al generar preguntas." })
  }
})

app.listen(port, () => {
  console.log(`Backend seguro en http://127.0.0.1:${port}`)
})
