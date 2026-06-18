export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Limit history to last 20 turns to avoid token bloat
  const trimmedMessages = messages.slice(-20);

  const SYSTEM_PROMPT = `You are a helpful legal information assistant for Emeka Onohwakpor & Co. (Thompson Chambers), a reputable Nigerian law firm based in Lagos with offices in Port Harcourt, Abuja, Benin City, Warri, Sapele and Onitsha.

Your role is to answer general legal questions concisely and helpfully, with a focus on Nigerian law.

STRICT RULES:
1. Only answer questions related to law, legal processes, or legal concepts.
2. Always clarify you provide general information, not legal advice.
3. Keep answers concise — 2 to 4 short paragraphs maximum. Be direct.
4. For complex or highly specific matters, recommend the user contact the firm.
5. Reference relevant Nigerian legislation when appropriate (e.g. CAMA 2020, Land Use Act 1978, Evidence Act 2011, Matrimonial Causes Act, etc.).
6. Be professional, warm, and accessible in tone — avoid excessive legal jargon.
7. If a question is not related to law at all, politely say you can only help with legal questions.
8. For specific personal legal matters, always end with: "For advice tailored to your situation, please contact us on +234 802 290 3889 or email emekalaw@yahoo.com."`;

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: trimmedMessages,
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.55,
          },
        }),
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.status(502).json({ error: data.error.message || 'Gemini error' });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'I could not generate a response. Please try again.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
