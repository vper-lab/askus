import express from "express"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const port = process.env.PORT || 4174
const apiKey = process.env.ANTHROPIC_API_KEY
const firebaseDatabaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || ""

const hasFirebaseConfig = Boolean(firebaseDatabaseUrl)
if (!hasFirebaseConfig) {
  console.warn("Firebase backend no configurado. Define FIREBASE_DATABASE_URL en entorno servidor.")
}

const toDbPath = (key = "") => key.replace(/[.#$[\]]/g, "-")
const buildDbUrl = (key) => {
  const base = firebaseDatabaseUrl.replace(/\/+$/, "")
  return `${base}/${toDbPath(key)}.json`
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
  if (!hasFirebaseConfig) return res.status(500).json({ error: "Firebase backend no configurado." })
  const key = req.body?.key
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." })
  try {
    const response = await fetch(buildDbUrl(key))
    if (!response.ok) throw new Error(`Firebase GET ${response.status}`)
    const value = await response.json()
    if (value == null) return res.json({ found: false })
    return res.json({ found: true, value })
  } catch (error) {
    return res.status(500).json({ error: `storage/get error: ${error.message}` })
  }
})

app.post("/api/storage/set", async (req, res) => {
  if (!hasFirebaseConfig) return res.status(500).json({ error: "Firebase backend no configurado." })
  const key = req.body?.key
  const value = req.body?.value
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." })
  try {
    const response = await fetch(buildDbUrl(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    })
    if (!response.ok) throw new Error(`Firebase PUT ${response.status}`)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: `storage/set error: ${error.message}` })
  }
})

app.post("/api/storage/delete", async (req, res) => {
  if (!hasFirebaseConfig) return res.status(500).json({ error: "Firebase backend no configurado." })
  const key = req.body?.key
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key invalida." })
  try {
    const response = await fetch(buildDbUrl(key), { method: "DELETE" })
    if (!response.ok) throw new Error(`Firebase DELETE ${response.status}`)
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

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Backend seguro en http://127.0.0.1:${port}`)
  })
}

export default app
