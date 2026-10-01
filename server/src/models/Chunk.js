import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  idx: { type: Number, required: true },
  page: Number,
  section: String,
  text: { type: String, required: true },
  embedding: { type: [Number], select: false },
});

chunkSchema.index({ doc: 1, idx: 1 }, { unique: true });

export default mongoose.model('Chunk', chunkSchema);
