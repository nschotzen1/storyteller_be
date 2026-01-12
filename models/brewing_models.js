import mongoose from 'mongoose';

const PlayerSchema = new mongoose.Schema({
    playerId: { type: String, required: true },
    maskId: { type: String, required: true },
    maskName: { type: String, required: true },
    displayName: { type: String },
    status: { type: String, enum: ['not_ready', 'ready', 'active', 'watching'], default: 'not_ready' },
    isBot: { type: Boolean, default: false }
}, { _id: false });

const VialSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    containerDescription: String,
    substanceDescription: String,
    pourEffect: String,
    timestamp: Number,
    addedByMaskId: String,
    privateIngredient: String // Only for the author
}, { _id: false });

const TurnSchema = new mongoose.Schema({
    index: { type: Number, default: 0 },
    activePlayerId: { type: String },
    round: { type: Number, default: 1 },
    totalRounds: { type: Number, default: 6 }
}, { _id: false });

const BrewRoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true, index: true },
    phase: { type: String, enum: ['lobby', 'brewing', 'complete'], default: 'lobby' },
    players: [PlayerSchema],
    turn: { type: TurnSchema, default: () => ({}) },
    brew: {
        summaryLines: { type: [String], default: ["The cauldron bubbles quietly..."] },
        vials: [VialSchema]
    },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24h
}, { timestamps: true });

export const BrewRoom = mongoose.model('BrewRoom', BrewRoomSchema);
