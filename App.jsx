import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#0f0f14", surface: "#1a1a24", card: "#21212e",
  accent: "#7c6af7", accentLight: "#a89df9", pop: "#f7c26a",
  danger: "#f76a7c", success: "#6af7b0",
  text: "#e8e6f0", muted: "#7c7a8c", border: "#2d2d3e",
};

const CATEGORIES = {
  manha:    { label: "🌅 Manhã",         color: "#f7c26a" },
  tarde:    { label: "🌞 Tarde",         color: "#7c6af7" },
  noite:    { label: "🌙 Noite",         color: "#6aa8f7" },
  qualquer: { label: "⚡ Qualquer hora", color: "#6af7b0" },
};

const INITIAL_TASKS = [
  { id: 1, text: "Tomar remédio",                  category: "manha",    done: false, priority: true,  recurring: true,  xp: 50 },
  { id: 2, text: "Beber água ao acordar",           category: "manha",    done: false, priority: false, recurring: true,  xp: 20 },
  { id: 3, text: "5 min de respiração",             category: "manha",    done: false, priority: false, recurring: true,  xp: 30 },
  { id: 4, text: "Definir as 3 prioridades do dia", category: "manha",    done: false, priority: true,  recurring: true,  xp: 40 },
  { id: 5, text: "Almoçar (não pular!)",            category: "tarde",    done: false, priority: false, recurring: true,  xp: 20 },
  { id: 6, text: "Bloco de foco 25 min",            category: "tarde",    done: false, priority: false, recurring: false, xp: 60 },
  { id: 7, text: "Revisar tarefas pendentes",       category: "tarde",    done: false, priority: false, recurring: true,  xp: 30 },
  { id: 8, text: "Desligar telas 30 min antes",     category: "noite",    done: false, priority: false, recurring: true,  xp: 40 },
  { id: 9, text: "Planejar amanhã (5 min)",         category: "noite",    done: false, priority: true,  recurring: true,  xp: 50 },
];

// ── API helper ──────────────────────────────────────────────────────────────
async function callClaude(mode, context, messages) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, context, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data.text;
}

// ── Time Input ──────────────────────────────────────────────────────────────
function TimeInput({ value, onChange, min = 1, max = 90 }) {
  const s = (extra) => ({ width: 28, height: 28, borderRadius: 8, background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", ...extra });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} style={s({ opacity: value <= min ? 0.4 : 1 })}>−</button>
      <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, minWidth: 32, textAlign: "center" }}>{value}m</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} style={s({ opacity: value >= max ? 0.4 : 1 })}>+</button>
    </div>
  );
}

// ── Pomodoro ────────────────────────────────────────────────────────────────
function SettingsPanel({ focusMin, breakMin, onApply }) {
  const [f, setF] = useState(focusMin);
  const [b, setB] = useState(breakMin);
  const presets = [{ label: "Curto", focus: 15, break: 3 }, { label: "Clássico", focus: 25, break: 5 }, { label: "Longo", focus: 45, break: 10 }, { label: "Ultra", focus: 60, break: 15 }];
  return (
    <div style={{ background: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}`, textAlign: "left" }}>
      <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Presets rápidos</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {presets.map(p => (
          <button key={p.label} onClick={() => { setF(p.focus); setB(p.break); }}
            style={{ background: f===p.focus&&b===p.break ? COLORS.accent+"30" : COLORS.card, border: `1px solid ${f===p.focus&&b===p.break ? COLORS.accent : COLORS.border}`, borderRadius: 8, padding: "5px 10px", color: f===p.focus&&b===p.break ? COLORS.accentLight : COLORS.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {p.label} · {p.focus}/{p.break}m
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: COLORS.text }}>🎯 Tempo de foco</span>
        <TimeInput value={f} onChange={setF} min={1} max={90} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: COLORS.text }}>☕ Tempo de pausa</span>
        <TimeInput value={b} onChange={setB} min={1} max={30} />
      </div>
      <button onClick={() => onApply(f, b)} style={{ width: "100%", background: COLORS.accent, border: "none", borderRadius: 10, padding: 9, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Aplicar ✓</button>
    </div>
  );
}

function PomodoroTimer() {
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [seconds, setSeconds]   = useState(25 * 60);
  const [running, setRunning]   = useState(false);
  const [isBreak, setIsBreak]   = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef(null);
  const focusSec = focusMin * 60, breakSec = breakMin * 60;

  useEffect(() => { if (!running) setSeconds(isBreak ? breakSec : focusSec); }, [focusMin, breakMin]);
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current); setRunning(false);
            if (!isBreak) { setSessions(p => p + 1); setIsBreak(true); setSeconds(breakSec); }
            else { setIsBreak(false); setSeconds(focusSec); }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, isBreak, focusSec, breakSec]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pct = ((( isBreak ? breakSec : focusSec) - seconds) / (isBreak ? breakSec : focusSec)) * 100;
  const r = 44, circ = 2 * Math.PI * r;

  return (
    <div style={{ background: COLORS.card, borderRadius: 20, padding: "24px 20px", border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isBreak ? COLORS.success : COLORS.accentLight, letterSpacing: 2, textTransform: "uppercase" }}>{isBreak ? "☕ Pausa" : "🎯 Foco"}</div>
        <button onClick={() => setShowSettings(s => !s)} style={{ background: showSettings ? COLORS.accent+"30" : "transparent", border: `1px solid ${showSettings ? COLORS.accent : COLORS.border}`, borderRadius: 8, padding: "4px 10px", color: showSettings ? COLORS.accentLight : COLORS.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⚙ Ajustar</button>
      </div>
      {showSettings && <SettingsPanel focusMin={focusMin} breakMin={breakMin} onApply={(f, b) => { setFocusMin(f); setBreakMin(b); setRunning(false); setIsBreak(false); setSeconds(f * 60); setShowSettings(false); }} />}
      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 16px" }}>
        <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke={COLORS.border} strokeWidth="6" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={isBreak ? COLORS.success : COLORS.accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: COLORS.text, fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
        <button onClick={() => setRunning(r => !r)} style={{ background: running ? COLORS.danger : COLORS.accent, color: "#fff", border: "none", borderRadius: 12, padding: "8px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{running ? "⏸ Pausar" : "▶ Iniciar"}</button>
        <button onClick={() => { setRunning(false); setSeconds(isBreak ? breakSec : focusSec); }} style={{ background: COLORS.surface, color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>↺</button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted }}>🔥 {sessions} sessões hoje · ⏱ {focusMin}min foco / {breakMin}min pausa</div>
    </div>
  );
}

// ── AI Chat ─────────────────────────────────────────────────────────────────
function AIChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Oi! 👋 Sou seu assistente TDAH. Como posso te ajudar hoje?" }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const apiMsgs = newMsgs.filter(m => m.role !== "assistant" || newMsgs.indexOf(m) > 0);
      const text = await callClaude("chat", null, apiMsgs);
      setMessages(m => [...m, { role: "assistant", content: text }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Ops, tive um problema. Tente novamente! 😅" }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 0 0" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, height: "75vh", display: "flex", flexDirection: "column", border: `1px solid ${COLORS.border}` }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: COLORS.accent+"30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Assistente TDAH</div>
              <div style={{ fontSize: 11, color: COLORS.success }}>● Online</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%", background: m.role === "user" ? COLORS.accent : COLORS.card, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ background: COLORS.card, borderRadius: "16px 16px 16px 4px", padding: "10px 16px", color: COLORS.muted, fontSize: 20, letterSpacing: 2 }}>···</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Digite sua mensagem..."
            style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none" }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ background: COLORS.accent, border: "none", borderRadius: 12, width: 44, color: "#fff", cursor: "pointer", fontSize: 18, opacity: loading || !input.trim() ? 0.5 : 1 }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ── AI Suggest Tasks ─────────────────────────────────────────────────────────
function AISuggest({ mood, onAddTasks, onClose }) {
  const [loading, setLoading] = useState(false);
  const [tasks,   setTasks]   = useState(null);
  const [error,   setError]   = useState(null);

  const moodLabels = { 1: "muito travado e sem energia", 2: "com dificuldade de começar", 3: "ok, neutro", 4: "bem e animado", 5: "com muita energia e foco" };
  const hour = new Date().getHours();
  const period = hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const context = `Humor atual: ${moodLabels[mood]}. Período do dia: ${period}. Sugira 3 tarefas adequadas para este momento.`;
      const text = await callClaude("suggest", context);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setTasks(parsed.tasks.map((t, i) => ({ ...t, id: Date.now() + i, done: false, recurring: false })));
    } catch { setError("Não foi possível gerar sugestões. Verifique sua chave de API."); }
    finally { setLoading(false); }
  };

  useEffect(() => { generate(); }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: COLORS.surface, borderRadius: 24, padding: 28, width: "100%", maxWidth: 400, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>✨ Sugestões da IA</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>Baseado no seu humor e horário do dia</div>

        {loading && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤔</div>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>Pensando nas melhores tarefas para você...</div>
          </div>
        )}

        {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 16, background: COLORS.danger+"15", padding: 12, borderRadius: 10 }}>{error}</div>}

        {tasks && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {tasks.map((t, i) => {
              const cat = CATEGORIES[t.category] || CATEGORIES.qualquer;
              return (
                <div key={i} style={{ background: COLORS.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 500, marginBottom: 6 }}>{t.text}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 11, color: cat.color, background: cat.color+"20", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>{cat.label}</span>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>+{t.xp} XP</span>
                    {t.priority && <span style={{ fontSize: 11, color: COLORS.pop }}>⭐</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
          {tasks && <button onClick={() => { onAddTasks(tasks); onClose(); }} style={{ flex: 2, background: COLORS.accent, border: "none", borderRadius: 12, padding: 12, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Adicionar todas ✓</button>}
          {(error || tasks) && <button onClick={generate} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", color: COLORS.muted, cursor: "pointer" }}>↺</button>}
        </div>
      </div>
    </div>
  );
}

// ── AI Routine Generator ─────────────────────────────────────────────────────
function AIRoutine({ onSetRoutine, onClose }) {
  const [step,     setStep]    = useState(0);
  const [profile,  setProfile] = useState({ wakeUp: "7h", work: "sim", meds: "sim", exercise: "às vezes" });
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const context = `Perfil: acorda às ${profile.wakeUp}, trabalha/estuda: ${profile.work}, toma medicação: ${profile.meds}, faz exercício: ${profile.exercise}. Crie uma rotina diária completa e realista para TDAH.`;
      const text = await callClaude("routine", context);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const tasks = parsed.tasks.map((t, i) => ({ ...t, id: Date.now() + i, done: false }));
      onSetRoutine(tasks);
      onClose();
    } catch { setError("Não foi possível gerar a rotina. Verifique sua chave de API."); setLoading(false); }
  };

  const options = [
    { key: "wakeUp",   label: "⏰ Você acorda às",     values: ["5h", "6h", "7h", "8h", "9h", "10h+"] },
    { key: "work",     label: "💼 Trabalha ou estuda",   values: ["sim", "não", "home office"] },
    { key: "meds",     label: "💊 Toma medicação TDAH",  values: ["sim", "não", "às vezes"] },
    { key: "exercise", label: "🏃 Pratica exercícios",   values: ["sim", "não", "às vezes"] },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: COLORS.surface, borderRadius: 24, padding: 28, width: "100%", maxWidth: 400, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>🗓 Gerar minha rotina</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24 }}>Conte um pouco sobre você para a IA criar sua rotina ideal</div>

        {!loading && !error && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
              {options.map(opt => (
                <div key={opt.key}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginBottom: 8 }}>{opt.label}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {opt.values.map(v => (
                      <button key={v} onClick={() => setProfile(p => ({ ...p, [opt.key]: v }))}
                        style={{ background: profile[opt.key]===v ? COLORS.accent+"30" : COLORS.card, border: `1px solid ${profile[opt.key]===v ? COLORS.accent : COLORS.border}`, borderRadius: 8, padding: "6px 12px", color: profile[opt.key]===v ? COLORS.accentLight : COLORS.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={generate} style={{ flex: 2, background: COLORS.accent, border: "none", borderRadius: 12, padding: 12, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Gerar rotina ✨</button>
            </div>
          </>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>Criando sua rotina personalizada...</div>
          </div>
        )}

        {error && (
          <>
            <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 16, background: COLORS.danger+"15", padding: 12, borderRadius: 10 }}>{error}</div>
            <button onClick={onClose} style={{ width: "100%", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Mood Tracker ────────────────────────────────────────────────────────────
function MoodTracker({ mood, setMood }) {
  const moods = [{ val: 1, emoji: "😵", label: "Travado" }, { val: 2, emoji: "😟", label: "Difícil" }, { val: 3, emoji: "😐", label: "Ok" }, { val: 4, emoji: "😊", label: "Bem" }, { val: 5, emoji: "🚀", label: "Voando" }];
  return (
    <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Como você está?</div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {moods.map(m => (
          <button key={m.val} onClick={() => setMood(m.val)}
            style={{ background: mood===m.val ? COLORS.accent : "transparent", border: mood===m.val ? "none" : `1px solid ${COLORS.border}`, borderRadius: 12, padding: "8px 6px", cursor: "pointer", flex: 1, margin: "0 3px", transition: "all 0.2s" }}>
            <div style={{ fontSize: 22 }}>{m.emoji}</div>
            <div style={{ fontSize: 10, color: mood===m.val ? "#fff" : COLORS.muted, marginTop: 2 }}>{m.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onDelete }) {
  const cat = CATEGORIES[task.category] || CATEGORIES.qualquer;
  return (
    <div onClick={() => onToggle(task.id)}
      style={{ display: "flex", alignItems: "center", gap: 12, background: task.done ? `${COLORS.success}15` : COLORS.card, border: `1px solid ${task.done ? COLORS.success+"40" : task.priority ? COLORS.pop+"60" : COLORS.border}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", opacity: task.done ? 0.7 : 1, marginBottom: 8, position: "relative", overflow: "hidden" }}>
      {task.priority && !task.done && <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: COLORS.pop, borderRadius: "3px 0 0 3px" }} />}
      <div style={{ width: 22, height: 22, borderRadius: 8, border: `2px solid ${task.done ? COLORS.success : COLORS.border}`, background: task.done ? COLORS.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {task.done && <span style={{ fontSize: 12, color: "#0f0f14" }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: task.done ? COLORS.muted : COLORS.text, textDecoration: task.done ? "line-through" : "none", fontWeight: 500 }}>{task.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: cat.color, background: cat.color+"20", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>{cat.label}</span>
          <span style={{ fontSize: 11, color: COLORS.muted }}>+{task.xp} XP</span>
          {task.priority && <span style={{ fontSize: 11, color: COLORS.pop }}>⭐</span>}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(task.id); }} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 16, padding: 4, opacity: 0.5 }}>×</button>
    </div>
  );
}

// ── Add Task Modal ──────────────────────────────────────────────────────────
function AddTaskModal({ onAdd, onClose }) {
  const [text, setText]         = useState("");
  const [category, setCategory] = useState("qualquer");
  const [priority, setPriority] = useState(false);
  const handleAdd = () => { if (!text.trim()) return; onAdd({ text: text.trim(), category, priority, recurring: false, xp: priority ? 50 : 30 }); onClose(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: COLORS.surface, borderRadius: 24, padding: 28, width: "100%", maxWidth: 400, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 20 }}>Nova tarefa ✨</div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="O que precisa fazer?" onKeyDown={e => e.key === "Enter" && handleAdd()}
          style={{ width: "100%", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 16px", color: COLORS.text, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button key={key} onClick={() => setCategory(key)}
              style={{ background: category===key ? cat.color+"30" : COLORS.card, border: `1px solid ${category===key ? cat.color : COLORS.border}`, borderRadius: 10, padding: "8px 12px", color: category===key ? cat.color : COLORS.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {cat.label}
            </button>
          ))}
        </div>
        <button onClick={() => setPriority(p => !p)}
          style={{ width: "100%", background: priority ? COLORS.pop+"20" : COLORS.card, border: `1px solid ${priority ? COLORS.pop : COLORS.border}`, borderRadius: 10, padding: 10, color: priority ? COLORS.pop : COLORS.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {priority ? "⭐ Prioridade ativada" : "☆ Marcar como prioridade"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleAdd} style={{ flex: 2, background: COLORS.accent, border: "none", borderRadius: 12, padding: 12, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>Adicionar ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── XP Bar ──────────────────────────────────────────────────────────────────
function XPBar({ xp, level }) {
  const xpForNext = level * 200, xpInLevel = xp % 200;
  return (
    <div style={{ background: COLORS.card, borderRadius: 20, padding: "18px 20px", border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div><span style={{ fontSize: 22, marginRight: 8 }}>🧠</span><span style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>Nível {level}</span></div>
        <span style={{ fontSize: 13, color: COLORS.pop, fontWeight: 700 }}>{xp} XP total</span>
      </div>
      <div style={{ background: COLORS.border, borderRadius: 8, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${Math.min((xpInLevel / xpForNext) * 100, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.pop})`, borderRadius: 8, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>{xpInLevel} / {xpForNext} XP para o próximo nível</div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks,        setTasks]        = useState(INITIAL_TASKS);
  const [xp,           setXp]           = useState(0);
  const [mood,         setMood]         = useState(3);
  const [notes,        setNotes]        = useState("");
  const [showAdd,      setShowAdd]      = useState(false);
  const [showChat,     setShowChat]     = useState(false);
  const [showSuggest,  setShowSuggest]  = useState(false);
  const [showRoutine,  setShowRoutine]  = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [toast,        setToast]        = useState(null);

  const level = Math.floor(xp / 200) + 1;
  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleTask = (id) => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t;
    const newDone = !t.done;
    if (newDone) { setXp(x => x + t.xp); showToast(`+${t.xp} XP! 🎉`); }
    else { setXp(x => Math.max(0, x - t.xp)); }
    return { ...t, done: newDone };
  }));

  const deleteTask  = (id)    => setTasks(prev => prev.filter(t => t.id !== id));
  const addTask     = (data)  => { setTasks(prev => [...prev, { id: Date.now(), done: false, ...data }]); showToast("Tarefa adicionada! ✨"); };
  const addTasks    = (list)  => { setTasks(prev => [...prev, ...list]); showToast(`${list.length} tarefas adicionadas! ✨`); };
  const setRoutine  = (list)  => { setTasks(list); setXp(0); showToast("Nova rotina criada! 🗓"); };
  const resetDay    = ()      => { setTasks(prev => prev.map(t => t.recurring ? { ...t, done: false } : t)); showToast("Novo dia, nova energia! 🌅"); };

  const filtered =
    activeFilter === "all"      ? tasks :
    activeFilter === "done"     ? tasks.filter(t => t.done) :
    activeFilter === "priority" ? tasks.filter(t => t.priority && !t.done) :
    tasks.filter(t => t.category === activeFilter);

  const filters = [
    { key: "all",      label: "Todas"          },
    { key: "priority", label: "⭐ Prioridades" },
    { key: "manha",    label: "🌅 Manhã"       },
    { key: "tarde",    label: "🌞 Tarde"       },
    { key: "noite",    label: "🌙 Noite"       },
    { key: "done",     label: "✓ Feitas"       },
  ];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", paddingBottom: 100 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        input::placeholder, textarea::placeholder { color: ${COLORS.muted}; }
        button { font-family: inherit; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: COLORS.success, color: "#0f0f14", padding: "10px 20px", borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 300, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        <div style={{ padding: "32px 0 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text, letterSpacing: -0.5 }}>Minha Rotina <span style={{ color: COLORS.accent }}>TDAH</span></div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>{done === total && total > 0 ? "🏆 Dia perfeito!" : `${done} de ${total} tarefas concluídas`}</div>
          </div>
          <button onClick={resetDay} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "8px 14px", color: COLORS.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🌅 Novo dia</button>
        </div>

        {/* AI Actions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setShowSuggest(true)}
            style={{ flex: 1, background: COLORS.accent+"20", border: `1px solid ${COLORS.accent+"40"}`, borderRadius: 14, padding: "12px 8px", color: COLORS.accentLight, cursor: "pointer", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
            ✨ Sugerir tarefas
          </button>
          <button onClick={() => setShowRoutine(true)}
            style={{ flex: 1, background: COLORS.pop+"15", border: `1px solid ${COLORS.pop+"40"}`, borderRadius: 14, padding: "12px 8px", color: COLORS.pop, cursor: "pointer", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
            🗓 Gerar rotina
          </button>
        </div>

        {/* Progress */}
        <div style={{ background: COLORS.surface, borderRadius: 20, padding: "18px 20px", border: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Progresso do dia</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: pct===100 ? COLORS.success : COLORS.pop }}>{pct}%</span>
          </div>
          <div style={{ background: COLORS.border, borderRadius: 8, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct===100 ? COLORS.success : `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.pop})`, borderRadius: 8, transition: "width 0.5s ease" }} />
          </div>
        </div>

        <XPBar xp={xp} level={level} />
        <div style={{ height: 14 }} />
        <MoodTracker mood={mood} setMood={setMood} />
        <div style={{ height: 14 }} />
        <PomodoroTimer />
        <div style={{ height: 20 }} />

        {/* Tasks */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>Tarefas</div>
          <button onClick={() => setShowAdd(true)} style={{ background: COLORS.accent, border: "none", borderRadius: 12, padding: "8px 16px", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Adicionar</button>
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              style={{ background: activeFilter===f.key ? COLORS.accent : COLORS.card, border: `1px solid ${activeFilter===f.key ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: "6px 12px", color: activeFilter===f.key ? "#fff" : COLORS.muted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: COLORS.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma tarefa aqui!</div>
          </div>
        ) : filtered.map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />)}

        <div style={{ height: 20 }} />

        {/* Notes */}
        <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>📝 Notas rápidas</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Escreva aqui pensamentos, lembretes, ideias..."
            style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, color: COLORS.text, fontSize: 14, resize: "vertical", minHeight: 80, outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }} />
        </div>
      </div>

      {/* Floating Chat Button */}
      <button onClick={() => setShowChat(true)}
        style={{ position: "fixed", bottom: 28, right: 24, width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.pop})`, border: "none", cursor: "pointer", fontSize: 24, boxShadow: "0 4px 20px rgba(124,106,247,0.5)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        🧠
      </button>

      {showChat    && <AIChat onClose={() => setShowChat(false)} />}
      {showAdd     && <AddTaskModal onAdd={addTask} onClose={() => setShowAdd(false)} />}
      {showSuggest && <AISuggest mood={mood} onAddTasks={addTasks} onClose={() => setShowSuggest(false)} />}
      {showRoutine && <AIRoutine onSetRoutine={setRoutine} onClose={() => setShowRoutine(false)} />}
    </div>
  );
}
