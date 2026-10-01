/** Read a fetch Response body as Server-Sent Events, calling onData with each data payload. */
export async function readSSE(res, onData) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]') onData(data);
      }
    }
  }
}

export async function ensureOk(res, who) {
  if (res.ok) return res;
  const body = await res.text().catch(() => '');
  const err = new Error(`${who} request failed (${res.status}): ${body.slice(0, 300)}`);
  err.status = res.status === 429 ? 429 : 502;
  throw err;
}
