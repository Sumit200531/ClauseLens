export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clauselens',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  provider: (process.env.AI_PROVIDER || 'local').toLowerCase(),
  gemini: {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    embedModel: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
  },
  openai: {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embedModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  },
  atlasVector: process.env.ATLAS_VECTOR_SEARCH === 'true',
  maxUploadMb: 20,
  topK: 6,
};
