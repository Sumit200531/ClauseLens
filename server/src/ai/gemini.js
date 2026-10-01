import { readSSE, ensureOk } from './sse.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiProvider({ key, model, embedModel }) {
  if (!key) throw new Error('GEMINI_API_KEY is missing. Set it in server/.env or use AI_PROVIDER=local.');
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };

  return {
    name: 'gemini',
    embedId: `gemini:${embedModel}`,

    async embed(texts, { type = 'document' } = {}) {
      const out = [];
      for (let i = 0; i < texts.length; i += 90) {
        const batch = texts.slice(i, i + 90);
        const res = await fetch(`${BASE}/${embedModel}:batchEmbedContents`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${embedModel}`,
              content: { parts: [{ text }] },
              taskType: type === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
              outputDimensionality: 768,
            })),
          }),
        });
        await ensureOk(res, 'Gemini embeddings');
        const data = await res.json();
        out.push(...data.embeddings.map((e) => e.values));
      }
      return out;
    },

    async generateJson({ system, prompt }) {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      });
      await ensureOk(res, 'Gemini');
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '{}';
      return JSON.parse(text);
    },

    async stream({ system, prompt, onToken }) {
      const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });
      await ensureOk(res, 'Gemini');
      let full = '';
      await readSSE(res, (data) => {
        const json = JSON.parse(data);
        const t = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (t) {
          full += t;
          onToken(t);
        }
      });
      return full;
    },
  };
}
