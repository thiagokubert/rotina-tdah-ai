export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, mode, context } = req.body;

  const systemPrompts = {
    chat: `Você é um assistente especializado em TDAH, empático e prático. 
Ajuda pessoas com TDAH a gerenciar sua rotina, foco e produtividade.
Responda de forma curta, direta e encorajadora. Use emojis com moderação.
Nunca julgue. Sempre valide a experiência da pessoa antes de sugerir algo.
Responda sempre em português brasileiro.`,

    suggest: `Você é um assistente de produtividade para pessoas com TDAH.
Com base no humor e horário informados, sugira exatamente 3 tarefas curtas e práticas.
Retorne APENAS um JSON válido no formato:
{"tasks": [{"text": "nome da tarefa", "category": "manha|tarde|noite|qualquer", "priority": true|false, "xp": 20|30|40|50}]}
Sem texto adicional, sem markdown, apenas o JSON.`,

    routine: `Você é especialista em criar rotinas para pessoas com TDAH.
Com base no perfil informado, crie uma rotina diária completa e realista.
Retorne APENAS um JSON válido no formato:
{"tasks": [{"text": "nome", "category": "manha|tarde|noite|qualquer", "priority": true|false, "recurring": true|false, "xp": 20|30|40|50}]}
Máximo 12 tarefas. Sem texto adicional, apenas o JSON.`,
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompts[mode] || systemPrompts.chat,
        messages: messages || [{ role: "user", content: context }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Erro na API" });
    }

    const text = data.content?.[0]?.text || "";
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno: " + err.message });
  }
}
