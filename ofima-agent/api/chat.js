// api/chat.js  –  Vercel Serverless Function
// Esta función corre en el servidor de Vercel (no en el navegador),
// por eso la API key está segura y ella nunca la ve.

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requerido' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // La API key viene de la variable de entorno de Vercel (la pones tú en el dashboard)
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: system || '',
        messages: messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Error Anthropic API:', err);
      return res.status(500).json({ error: 'Error en la IA' });
    }

    const data = await response.json();
    const reply = data.content?.map(b => b.text || '').join('\n').trim() || '';

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Error servidor:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
