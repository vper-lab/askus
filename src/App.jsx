import { useState, useEffect, useCallback, useRef } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: '#f97316' }, { bg: '#06b6d4' }, { bg: '#a855f7' },
  { bg: '#22c55e' }, { bg: '#f59e0b' }, { bg: '#ec4899' },
  { bg: '#3b82f6' }, { bg: '#ef4444' },
];
const uid   = () => Math.random().toString(36).slice(2, 11);
const mkCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
const today  = () => new Date().toISOString().slice(0, 10);
const init   = (name = '') => name[0]?.toUpperCase() || '?';
const pal    = (idx) => PALETTE[(idx ?? 0) % PALETTE.length];

// ─── Firebase storage helpers (mirrors window.storage API) ──────────────────

const fKey = (k) => k.replace(/[.#$[\]]/g, '-');

async function storageGet(key) {
  const snap = await get(ref(db, fKey(key)));
  return snap.exists() ? { value: snap.val() } : null;
}
async function storageSet(key, value) {
  await set(ref(db, fKey(key)), value);
}
async function storageDelete(key) {
  await remove(ref(db, fKey(key)));
}

// Local (per-device) session stored in localStorage
const localGet  = (k)    => { try { const v = localStorage.getItem(k); return v ? { value: v } : null; } catch { return null; } };
const localSet  = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const localDel  = (k)    => { try { localStorage.removeItem(k); } catch {} };

// ─── UI primitives ───────────────────────────────────────────────────────────
const Avatar = ({ name = '', idx = 0, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: size, background: pal(idx).bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: size * 0.38, color: '#fff',
    fontFamily: "'Syne', sans-serif", flexShrink: 0,
  }}>
    {init(name)}
  </div>
);

const S = {
  app:        { fontFamily: "'DM Sans', sans-serif", background: '#0c0c12', height: '100dvh', color: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  display:    { fontFamily: "'Syne', sans-serif" },
  card:       { background: 'rgba(255,255,255,0.045)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', padding: 20 },
  input:      { background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 13, padding: '11px 15px', color: '#fff', fontSize: 14, outline: 'none', width: '100%', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' },
  primaryBtn: { background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', border: 'none', borderRadius: 14, padding: '13px 20px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%', fontFamily: "'DM Sans', sans-serif" },
  label:      { display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 },
};

// ─── Main component ──────────────────────────────────────────────────────────
export default function AskUs() {
  const [screen,     setScreen]     = useState('loading');
  const [mode,       setMode]       = useState('create');
  const [identity,   setIdentity]   = useState(null);
  const [roomId,     setRoomId]     = useState(null);
  const [room,       setRoom]       = useState(null);
  const [tab,        setTab]        = useState('questions');
  const [name,       setName]       = useState('');
  const [code,       setCode]       = useState('');
  const [qpd,        setQpd]        = useState(2);
  const [rules,      setRules]      = useState('');
  const [chatMsg,    setChatMsg]    = useState('');
  const [err,        setErr]        = useState('');
  const [busy,       setBusy]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [backendError, setBackendError] = useState('');
  const chatEndRef = useRef(null);
  const pollRef    = useRef(null);
  const genGuard   = useRef(false);
  const genDone    = useRef(false);

  // Load fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';
    link.rel  = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const r = localGet('askus:me');
    if (r) {
      const me = JSON.parse(r.value);
      setIdentity(me);
      if (me.roomId) { setRoomId(me.roomId); setScreen('room'); }
      else setScreen('home');
    } else setScreen('home');
  }, []);

  const loadRoom = useCallback(async (rId) => {
    try {
      const [mR, pR, cR] = await Promise.allSettled([
        storageGet(`ak-${rId}-meta`),
        storageGet(`ak-${rId}-players`),
        storageGet(`ak-${rId}-chat`),
      ]);
      if (mR.status !== 'fulfilled' || !mR.value) return;
      let questions = null;
      const qR = await storageGet(`ak-${rId}-q-${today()}`).catch(() => null);
      if (qR) questions = JSON.parse(qR.value);
      setRoom({
        meta:      JSON.parse(mR.value.value),
        players:   pR.status === 'fulfilled' && pR.value ? JSON.parse(pR.value.value) : [],
        chat:      cR.status === 'fulfilled' && cR.value ? JSON.parse(cR.value.value) : [],
        questions,
        day: today(),
      });
    } catch (e) { console.error('loadRoom:', e); }
  }, []);

  // Start polling when entering room
  useEffect(() => {
    if (screen === 'room' && roomId) {
      genGuard.current = false;
      genDone.current  = false;
      loadRoom(roomId);
      pollRef.current = setInterval(() => loadRoom(roomId), 5000);
      return () => clearInterval(pollRef.current);
    }
  }, [screen, roomId, loadRoom]);

  // Auto-generate questions
  useEffect(() => {
    if (!room || !identity || !roomId) return;
    if (room.questions !== null) { genDone.current = true; return; }
    if (genDone.current || genGuard.current) return;
    if ((room.players || []).length < 2) return;
    genGuard.current = true;
    setGenError(false);
    doGenerate(roomId, room.players, room.meta)
      .then(() => { genDone.current = true; })
      .catch(() => setGenError(true))
      .finally(() => { genGuard.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.questions, room?.players?.length, identity, roomId]);

  async function doGenerate(rId, players, meta) {
    const key = `ak-${rId}-q-${today()}`;
    const existing = await storageGet(key).catch(() => null);
    if (existing) { loadRoom(rId); return; }
    setGenerating(true);
    try {
      const n = meta.qpd;
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players, meta: { qpd: n, rules: meta.rules || '' } }),
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        throw new Error(`API error ${resp.status} ${errorText}`);
      }

      const data = await resp.json();
      const texts = Array.isArray(data.questions) ? data.questions : [];
      if (!Array.isArray(texts) || texts.length === 0) throw new Error('Invalid response');

      const qs = texts.map(t => ({ id: uid(), text: t, votes: {} }));
      await storageSet(key, JSON.stringify(qs));
      await loadRoom(rId);
    } catch (error) {
      console.error('generate error:', error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }

  async function createRoom() {
    if (!name.trim()) { setErr('Escribe tu nombre'); return; }
    setBusy(true); setErr('');
    try {
      const playerId = uid(), rId = mkCode();
      const meta    = { qpd, rules: rules.trim(), adminId: playerId, created: new Date().toISOString() };
      const players = [{ id: playerId, name: name.trim(), joined: new Date().toISOString() }];
      await storageSet(`ak-${rId}-meta`,    JSON.stringify(meta));
      await storageSet(`ak-${rId}-players`, JSON.stringify(players));
      await storageSet(`ak-${rId}-chat`,    JSON.stringify([]));
      const me = { id: playerId, name: name.trim(), roomId: rId };
      localSet('askus:me', JSON.stringify(me));
      setIdentity(me); setRoomId(rId); setScreen('room');
    } catch (e) { setErr('Error al crear. Revisa backend/KV en servidor.'); setBackendError('Backend/KV no disponible.'); console.error(e); }
    finally { setBusy(false); }
  }

  async function joinRoom() {
    if (!name.trim()) { setErr('Escribe tu nombre'); return; }
    if (!code.trim()) { setErr('Escribe el código de sala'); return; }
    setBusy(true); setErr('');
    const rId = code.trim().toUpperCase();
    try {
      const mR = await storageGet(`ak-${rId}-meta`).catch(() => null);
      if (!mR) { setErr('Sala no encontrada. Revisa el código.'); setBusy(false); return; }
      let players = [];
      const pR = await storageGet(`ak-${rId}-players`).catch(() => null);
      if (pR) players = JSON.parse(pR.value);
      const playerId = uid();
      players.push({ id: playerId, name: name.trim(), joined: new Date().toISOString() });
      await storageSet(`ak-${rId}-players`, JSON.stringify(players));
      const me = { id: playerId, name: name.trim(), roomId: rId };
      localSet('askus:me', JSON.stringify(me));
      setIdentity(me); setRoomId(rId); setScreen('room');
    } catch (e) { setErr('Error al unirse. Revisa backend/KV en servidor.'); setBackendError('Backend/KV no disponible.'); console.error(e); }
    finally { setBusy(false); }
  }

  async function vote(questionId, targetId) {
    if (!identity || !roomId) return;
    const key = `ak-${roomId}-q-${today()}`;
    try {
      let qs = room?.questions || [];
      const qR = await storageGet(key).catch(() => null);
      if (qR) qs = JSON.parse(qR.value);
      const updated = qs.map(q =>
        q.id !== questionId ? q : { ...q, votes: { ...q.votes, [identity.id]: targetId } }
      );
      await storageSet(key, JSON.stringify(updated));
      await loadRoom(roomId);
    } catch (e) { console.error('vote error:', e); }
  }

  async function sendMessage() {
    if (!chatMsg.trim() || !identity || !roomId) return;
    const key = `ak-${roomId}-chat`;
    const m   = { id: uid(), userId: identity.id, name: identity.name, text: chatMsg.trim(), ts: Date.now() };
    setChatMsg('');
    try {
      let chat = [];
      const cR = await storageGet(key).catch(() => null);
      if (cR) chat = JSON.parse(cR.value);
      chat.push(m);
      await storageSet(key, JSON.stringify(chat));
      await loadRoom(roomId);
    } catch (e) { console.error('chat error:', e); }
  }

  async function leaveRoom() {
    clearInterval(pollRef.current);
    if (roomId) {
      try {
        const pR = await storageGet(`ak-${roomId}-players`);
        const players = pR ? JSON.parse(pR.value).filter(p => p.id !== identity?.id) : [];
        await storageSet(`ak-${roomId}-players`, JSON.stringify(players));
      } catch {}
    }
    localDel('askus:me');
    setRoomId(null); setRoom(null); setIdentity(null);
    setName(''); setCode(''); setScreen('home');
    genGuard.current = false; genDone.current = false;
  }

  function copyCode() {
    navigator.clipboard.writeText(roomId || '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (tab === 'chat') setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [room?.chat?.length, tab]);

  const pIdx      = (pId) => (room?.players || []).findIndex(p => p.id === pId);
  const myVote    = (q)   => q.votes?.[identity?.id];
  const allVoted  = (q)   => {
    const pl = room?.players?.length || 0;
    return pl > 0 && Object.keys(q.votes || {}).length >= pl;
  };
  const getResults = (q) => {
    const counts = Object.fromEntries((room?.players || []).map(p => [p.id, 0]));
    Object.values(q.votes || {}).forEach(v => { if (v in counts) counts[v]++; });
    return (room?.players || []).map(p => ({ ...p, count: counts[p.id] || 0 })).sort((a, b) => b.count - a.count);
  };

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div style={{ ...S.app, alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ ...S.display, fontSize: 36, background: 'linear-gradient(135deg,#a5b4fc,#f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>askUs 🎲</p>
    </div>
  );

  // ── HOME ─────────────────────────────────────────────────────────────────
  if (screen === 'home') return (
    <div style={{ ...S.app, alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', top: '-15%', right: '-15%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15%', left: '-15%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ ...S.display, fontSize: 56, margin: 0, background: 'linear-gradient(135deg, #a5b4fc 0%, #f9a8d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>askUs</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8, fontSize: 14 }}>¿Quién es más probable que...? 🎲</p>
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 4, marginBottom: 18 }}>
          {[['create', '✦ Crear sala'], ['join', '→ Unirse']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setErr(''); }}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 11, background: mode === m ? 'rgba(255,255,255,0.1)' : 'transparent', color: mode === m ? '#fff' : 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ ...S.card }}>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Tu nombre</label>
            <input style={S.input} placeholder="¿Cómo te llaman?" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? createRoom() : joinRoom())} />
          </div>

          {mode === 'join' ? (
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Código de sala</label>
              <input style={{ ...S.input, textAlign: 'center', letterSpacing: '0.28em', fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}
                placeholder="XXXXXX" value={code} maxLength={6}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinRoom()} />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Preguntas por día</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setQpd(n)}
                      style={{ flex: 1, padding: '10px', border: `1.5px solid ${qpd === n ? '#6366f1' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, background: qpd === n ? 'rgba(99,102,241,0.18)' : 'transparent', color: qpd === n ? '#a5b4fc' : 'rgba(255,255,255,0.35)', fontWeight: 900, fontSize: 20, cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Contexto del grupo <span style={{ textTransform: 'none', fontWeight: 400, color: 'rgba(255,255,255,0.18)' }}>(opcional)</span></label>
                <textarea style={{ ...S.input, resize: 'none', height: 68 }}
                  placeholder="Ej: compañeros de trabajo, fans del fútbol, amigos del pueblo..."
                  value={rules} onChange={e => setRules(e.target.value)} />
              </div>
            </>
          )}

          {backendError && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{backendError}</p>}
          {err && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{err}</p>}
          <button style={{ ...S.primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy}
            onClick={mode === 'create' ? createRoom : joinRoom}>
            {busy ? '...' : mode === 'create' ? '?? Crear sala' : '?? Unirme'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── ROOM ──────────────────────────────────────────────────────────────────
  const players   = room?.players  || [];
  const questions = room?.questions || [];

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ ...S.display, margin: 0, fontSize: 21, background: 'linear-gradient(135deg,#a5b4fc,#f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>askUs</h1>
          <button onClick={copyCode} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.28)', fontSize: 11, cursor: 'pointer', fontFamily: "'Syne', sans-serif", letterSpacing: '0.1em', padding: 0, fontWeight: 700, marginTop: 2, display: 'block' }}>
            {copied ? '✓ copiado' : `# ${roomId}`}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex' }}>
            {players.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{ marginLeft: i > 0 ? -8 : 0, border: '2px solid #0c0c12', borderRadius: '50%' }}>
                <Avatar name={p.name} idx={i} size={26} />
              </div>
            ))}
            {players.length > 5 && (
              <div style={{ marginLeft: -8, width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,0.12)', border: '2px solid #0c0c12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                +{players.length - 5}
              </div>
            )}
          </div>
          <button onClick={leaveRoom} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 11, padding: '5px 9px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
            Salir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {[['questions', '🎯 Hoy'], ['chat', '💬 Chat'], ['players', '👥 Grupo']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent', color: tab === t ? '#fff' : 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── QUESTIONS ── */}
      {tab === 'questions' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 40px' }}>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, marginBottom: 14, textTransform: 'capitalize' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          {players.length < 2 && (
            <div style={{ ...S.card, textAlign: 'center', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)' }}>
              <p style={{ fontSize: 28, marginBottom: 6 }}>⏳</p>
              <p style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4, fontSize: 15 }}>Esperando más jugadores</p>
              <p style={{ color: 'rgba(251,191,36,0.45)', fontSize: 12, marginBottom: 14 }}>Necesitáis al menos 2 personas</p>
              <button onClick={copyCode} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 11, color: '#fbbf24', padding: '9px 18px', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', fontSize: 15 }}>
                {copied ? '✓ Copiado!' : `📋 ${roomId}`}
              </button>
            </div>
          )}

          {players.length >= 2 && generating && (
            <div style={{ ...S.card, textAlign: 'center', padding: 32 }}>
              <p style={{ ...S.display, background: 'linear-gradient(135deg,#a5b4fc,#f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 15 }}>
                ✨ Generando las preguntas de hoy...
              </p>
            </div>
          )}

          {players.length >= 2 && !generating && genError && !room?.questions && (
            <div style={{ ...S.card, textAlign: 'center', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
              <p style={{ fontSize: 22, marginBottom: 6 }}>⚠️</p>
              <p style={{ fontWeight: 700, color: '#f87171', marginBottom: 8, fontSize: 14 }}>Error al generar preguntas</p>
              <button onClick={() => { genDone.current = false; genGuard.current = false; setGenError(false); loadRoom(roomId); }}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 11, color: '#f87171', padding: '8px 16px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13 }}>
                Reintentar
              </button>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={q.id} style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, fontFamily: "'Syne', sans-serif" }}>
                  PREGUNTA {qi + 1}
                </span>
                {allVoted(q) && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>✓ completada</span>}
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, marginBottom: 14 }}>{q.text}</p>

              {!myVote(q) && !allVoted(q) && (
                <div style={{ display: 'grid', gridTemplateColumns: players.length > 3 ? '1fr 1fr' : '1fr', gap: 8 }}>
                  {players.map((p, i) => {
                    const { bg } = pal(i);
                    return (
                      <button key={p.id} onClick={() => vote(q.id, p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: `${bg}1a`, border: `1.5px solid ${bg}44`, borderRadius: 12, color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, textAlign: 'left' }}>
                        <Avatar name={p.name} idx={i} size={30} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {myVote(q) && !allVoted(q) && (
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 8 }}>
                    Votaste a <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{players.find(p => p.id === myVote(q))?.name}</span>
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                      Esperando {players.length - Object.keys(q.votes || {}).length} más...
                    </span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {players.map((p, i) => (
                        <div key={p.id} title={p.name} style={{ width: 22, height: 22, borderRadius: 11, background: q.votes?.[p.id] ? pal(i).bg : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', fontFamily: "'Syne', sans-serif" }}>
                          {init(p.name)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {allVoted(q) && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 12 }}>
                    {getResults(q).map((p, ri) => {
                      const pi  = pIdx(p.id);
                      const { bg } = pal(pi >= 0 ? pi : 0);
                      const pct = players.length > 0 ? (p.count / players.length) * 100 : 0;
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={p.name} idx={pi >= 0 ? pi : 0} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: ri === 0 ? '#fbbf24' : 'rgba(255,255,255,0.85)' }}>
                                {ri === 0 ? '🏆 ' : ''}{p.name}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.count} voto{p.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: bg, borderRadius: 4 }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                    <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10, marginBottom: 5 }}>QUIÉN VOTÓ A QUIÉN</p>
                    {players.map(p => {
                      const voted = players.find(pl => pl.id === q.votes?.[p.id]);
                      return (
                        <p key={p.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.9 }}>
                          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>{p.name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}> → </span>
                          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>{voted?.name || '?'}</span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {identity && room?.meta?.adminId === identity.id && questions.length > 0 && (
            <button onClick={async () => {
              try { await storageDelete(`ak-${roomId}-q-${today()}`); } catch {}
              genDone.current = false; genGuard.current = false; setGenError(false);
              setRoom(r => r ? { ...r, questions: null } : r);
            }} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)', fontSize: 12, padding: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              🔄 Regenerar preguntas de hoy (solo admin)
            </button>
          )}
        </div>
      )}

      {/* ── CHAT ── */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', WebkitOverflowScrolling: 'touch' }}>
            {(room?.chat || []).length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 13, marginTop: 50 }}>Nadie ha dicho nada todavía 👀</p>
            )}
            {(room?.chat || []).map(m => {
              const isMe = m.userId === identity?.id;
              const pi   = players.findIndex(p => p.id === m.userId);
              const { bg } = pal(pi >= 0 ? pi : 0);
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && <Avatar name={m.name} idx={pi >= 0 ? pi : 0} size={26} />}
                  <div style={{ maxWidth: '73%', background: isMe ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '9px 13px', border: `1px solid ${isMe ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                    {!isMe && <p style={{ fontSize: 11, color: bg, fontWeight: 700, marginBottom: 3 }}>{m.name}</p>}
                    <p style={{ fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word' }}>{m.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 9, background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
            <input style={{ ...S.input, flex: 1 }} placeholder="Escribe algo..." value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} style={{ background: 'linear-gradient(135deg,#6366f1,#ec4899)', border: 'none', borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, flexShrink: 0, color: '#fff' }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYERS ── */}
      {tab === 'players' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 40px' }}>
          <div style={{ ...S.card, textAlign: 'center', marginBottom: 14, borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.07)' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 5 }}>Comparte este código con tus amigos</p>
            <button onClick={copyCode} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 32, color: copied ? '#4ade80' : '#a5b4fc', letterSpacing: '0.22em' }}>
              {copied ? '✓ Copiado!' : roomId}
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', marginBottom: 10 }}>
            {players.length} jugadores · {room?.meta?.qpd} pregunta{room?.meta?.qpd !== 1 ? 's' : ''} al día
          </p>
          {players.map((p, i) => (
            <div key={p.id} style={{ ...S.card, marginBottom: 8, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={p.name} idx={i} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                  {p.id === identity?.id && <span style={{ fontSize: 10, color: '#a5b4fc', background: 'rgba(99,102,241,0.18)', padding: '2px 8px', borderRadius: 20 }}>tú</span>}
                  {p.id === room?.meta?.adminId && <span style={{ fontSize: 13 }}>👑</span>}
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>desde {new Date(p.joined).toLocaleDateString('es-ES')}</p>
              </div>
            </div>
          ))}
          {room?.meta?.rules && (
            <div style={{ ...S.card, background: 'rgba(255,255,255,0.03)', marginTop: 6 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Contexto del grupo</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{room.meta.rules}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
