const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

function workspace() {
  let id = localStorage.getItem('cl_workspace');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('cl_workspace', id);
  }
  return id;
}

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { 'x-workspace': workspace(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not reach the server. Check that it is running.');
  return data;
}

export const api = {
  list: () => request('/documents'),
  get: (id) => request(`/documents/${id}`),
  questions: (id) => request(`/documents/${id}/questions`),
  remove: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  sample: () => request('/documents/sample', { method: 'POST' }),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/documents/upload', { method: 'POST', body: fd });
  },
};

/** POST a question and dispatch streamed SSE events to handlers: { stage, sources, verdict, token, done, error }. */
export async function askStream(id, question, on) {
  const res = await fetch(`${BASE}/documents/${id}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-workspace': workspace() },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not ask the question.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) on[event]?.(JSON.parse(data));
    }
  }
}
