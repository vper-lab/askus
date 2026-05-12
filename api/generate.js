import fs from "fs";
import path from "path";

const apiKey = process.env.ANTHROPIC_API_KEY;
const questionsFile = path.join(process.cwd(), "questions.json");
let allQuestions = [];
try {
  const data = fs.readFileSync(questionsFile, "utf-8");
  allQuestions = JSON.parse(data).questions || [];
} catch {}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { players, meta } = req.body || {};
  if (!Array.isArray(players) || players.length < 2) {
    return res.status(400).json({ error: "Se requieren al menos 2 jugadores." });
  }
  if (!meta || typeof meta.qpd !== "number") {
    return res.status(400).json({ error: "Parametros de meta invalidos." });
  }

  try {
    const n = meta.qpd;
    if (allQuestions.length > 0) {
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(n, allQuestions.length));
      return res.json({ questions: selected });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "No hay preguntas disponibles ni API key configurada." });
    }

    const names = players.map((p) => p.name).filter(Boolean).join(", ");
    const prompt = `Genera ${n} pregunta${n > 1 ? "s" : ""} muy divertida${n > 1 ? "s" : ""} y original${n > 1 ? "es" : ""} de "¿Quien es mas probable que...?" para un grupo de amigos: ${names}.\n${meta.rules ? `Contexto del grupo: ${meta.rules}` : ""}\nResponde SOLO con un JSON array de strings en espanol. Sin markdown, sin backticks, sin texto adicional. Ejemplo: ["Pregunta uno","Pregunta dos"]`;

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
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      return res.status(response.status).json({ error: `Anthropic API error: ${payload}` });
    }

    const data = await response.json();
    let raw = "";

    if (Array.isArray(data.content)) raw = data.content.map((c) => c.text || "").join("");
    else if (typeof data.completion === "string") raw = data.completion;
    else if (Array.isArray(data.choices)) raw = data.choices.map((c) => c.message?.content || c.text || "").join("");

    raw = raw.trim().replace(/```json|```/g, "").trim();
    const texts = JSON.parse(raw);
    if (!Array.isArray(texts) || texts.length === 0) throw new Error("Respuesta invalida de Anthropic");

    return res.json({ questions: texts });
  } catch (error) {
    return res.status(500).json({ error: "Error al generar preguntas." });
  }
}
