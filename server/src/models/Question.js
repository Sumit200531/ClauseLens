import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    question: { type: String, required: true },
    answer: String,
    verdict: { type: String, enum: ['COVERED', 'NOT_COVERED', 'CONDITIONAL', 'UNCLEAR'] },
    sources: [{ _id: false, n: Number, idx: Number, page: Number, section: String, text: String, via: [String], used: Boolean }],
    latencyMs: Number,
  },
  { timestamps: true }
);

export default mongoose.model('Question', questionSchema);
