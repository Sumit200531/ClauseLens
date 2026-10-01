import mongoose from 'mongoose';

const highlightSchema = new mongoose.Schema(
  {
    label: String,
    value: String,
    kind: { type: String, enum: ['benefit', 'waiting', 'exclusion', 'limit', 'copay', 'claim'], default: 'benefit' },
    page: Number,
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    workspace: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    pageCount: Number,
    chunkCount: { type: Number, default: 0 },
    embedModel: String,
    status: {
      type: String,
      enum: ['parsing', 'chunking', 'embedding', 'mapping', 'ready', 'failed'],
      default: 'parsing',
    },
    progress: { type: Number, default: 0 },
    error: String,
    coverage: {
      planName: String,
      insurer: String,
      sumInsured: String,
      summary: String,
      highlights: [highlightSchema],
    },
  },
  { timestamps: true }
);

export default mongoose.model('Document', documentSchema);
