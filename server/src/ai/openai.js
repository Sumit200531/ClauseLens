import { readSSE, ensureOk } from './sse.js';

const BASE = 'https://api.openai.com/v1';

export function openaiProvider({ key, model, embedModel }) {
  if (!key) throw new Error('OPENAI_API_KEY is missing. Set it in server/.env or use AI_PROVIDER=local.');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };

  return {
    name: 'openai',
    embedId: `openai:${embedModel}`,

    async embed(texts) {
      const out = [];
      for (let i = 0; i < texts.length; i += 200) {
        const res = await fetch(`${BASE}/embeddings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: embedModel, input: texts.slice(i, i + 200) }),
        });
        await ensureOk(res, 'OpenAI embeddings');
        const data = await res.json();
        out.push(...data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
      }
      return out;
    },

    async generateJson({ system, prompt }) {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        }),
      });
      await ensureOk(res, 'OpenAI');
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    },

    async stream({ system, prompt, onToken }) {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          stream: true,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        }),
      });
      await ensureOk(res, 'OpenAI');
      let full = '';
      await readSSE(res, (data) => {
        const t = JSON.parse(data).choices?.[0]?.delta?.content || '';
        if (t) {
          full += t;
          onToken(t);
        }
      });
      return full;
    },
  };
}
