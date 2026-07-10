import mongoose from 'mongoose';

const { Schema } = mongoose;

const chronicleSessionSchema = new Schema(
  {
    chronicleId: { type: String, required: true, unique: true },
    act: { type: String, required: true },
    recoveredFacts: { type: Schema.Types.Mixed, default: {} },
    canonLocks: { type: Schema.Types.Mixed, default: {} },
    character: { type: Schema.Types.Mixed, default: {} },
    evidence: { type: [Schema.Types.Mixed], default: [] },
    cells: { type: [Schema.Types.Mixed], default: [] },
    pressure: { type: Schema.Types.Mixed, default: {} },
    transcript: { type: [Schema.Types.Mixed], default: [] }
  },
  { timestamps: true, minimize: false }
);

export const ChronicleSessionModel =
  mongoose.models.ChronicleSession || mongoose.model('ChronicleSession', chronicleSessionSchema);
