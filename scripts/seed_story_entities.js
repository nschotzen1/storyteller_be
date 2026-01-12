
import mongoose from 'mongoose';
import { StoryEntity } from '../models/story_models.js';

// Configuration (adjust as needed for your environment)
const MONGO_URI = 'mongodb://localhost:27017/storytelling';

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const entities = [
        // PLACES
        {
            key: "place_split_hearth_hall",
            name: "Split-Hearth Hall",
            type: "PLACE",
            suit: "STONE",
            order: "MID",
            tags: ["cliffside", "threshold", "warmth_vs_void"],
            summary: "A cliffside hall half carved into stone, half hanging over a deadly drop.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },
        {
            key: "place_mireway_causeway",
            name: "Mireway Causeway",
            type: "PLACE",
            suit: "RIVER",
            order: "LOW",
            tags: ["swamp", "path", "fog"],
            summary: "A treacherous stone path winding through a fog-choked swamp.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },
        {
            key: "place_starwell_stair",
            name: "Starwell Stair",
            type: "PLACE",
            suit: "SKY",
            order: "HIGH",
            tags: ["ascent", "ruins", "astronomy"],
            summary: "A spiraling stair leading up to valid observatory ruins.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },

        // HEROS
        {
            key: "hero_kiyana_delta_runner",
            name: "Kiyana, Delta Runner of the Lost Pages",
            type: "HERO",
            suit: "RIVER",
            order: "LOW",
            tags: ["messenger", "speed", "lost_knowledge"],
            summary: "A courier who runs the river deltas, carrying messages that must not be intercepted.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },
        {
            key: "hero_kiyana_lock_binder",
            name: "Kiyana, Lock-Binder’s Apprentice",
            type: "HERO",
            suit: "STONE",
            order: "MID",
            tags: ["apprentice", "locks", "secrets"],
            summary: "An apprentice learning to seal away things that should not be let out.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },
        {
            key: "hero_kiyana_reluctant_witness",
            name: "Kiyana, Reluctant Witness of the Storm",
            type: "HERO",
            suit: "SKY",
            order: "HIGH",
            tags: ["witness", "storm", "destiny"],
            summary: "She saw something she wasn't meant to, and now the storm follows her.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },

        // KEYSTONES
        {
            key: "keystone_weather_worn_lockpick",
            name: "Weather-Worn Lockpick",
            type: "KEYSTONE",
            suit: "STONE",
            order: "HIGH",
            tags: ["tool", "opening", "opportunity"],
            summary: "A simple tool that has opened doors across many worlds.",
            universe_keys: ["mariposa_world"],
            portal_friendly: true,
            meta: { first_seed: true }
        },
        {
            key: "keystone_traveling_hearth_kettle",
            name: "Traveling Hearth-Kettle",
            type: "KEYSTONE",
            suit: "ASH",
            order: "HIGH",
            tags: ["comfort", "travel", "home"],
            summary: "A battered kettle that always brews the tea of home, wherever you are.",
            universe_keys: ["mariposa_world"],
            portal_friendly: true,
            meta: { first_seed: true }
        },
        {
            key: "keystone_hawkglass_shard",
            name: "Hawkglass Shard",
            type: "KEYSTONE",
            suit: "SKY",
            order: "HIGH",
            tags: ["vision", "clarity", "sharpness"],
            summary: "A shard of glass that lets you see far, but cuts the hand that holds it.",
            universe_keys: ["mariposa_world"],
            portal_friendly: true,
            meta: { first_seed: true }
        },

        // STORYTELLERS
        {
            key: "storyteller_ink_eyed_cartographer",
            name: "Ink-Eyed Cartographer",
            type: "STORYTELLER",
            suit: "RIVER",
            order: "MID",
            tags: ["maps", "ink", "lost_places"],
            summary: "He draws maps of places that haven't happened yet.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },
        {
            key: "storyteller_maera_many_ledgers",
            name: "Maera-of-the-Many-Ledgers",
            type: "STORYTELLER",
            suit: "STONE",
            order: "LOW",
            tags: ["records", "debts", "history"],
            summary: "She keeps track of every debt owed to the universe.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        },
        {
            key: "storyteller_lantern_juggler",
            name: "Lantern Juggler",
            type: "STORYTELLER",
            suit: "ASH",
            order: "MID",
            tags: ["light", "performance", "distraction"],
            summary: "He juggles lights to keep the shadows at bay.",
            universe_keys: ["mariposa_world"],
            meta: { first_seed: true }
        }
    ];

    for (const entity of entities) {
        await StoryEntity.updateOne(
            { key: entity.key },
            { $set: entity },
            { upsert: true }
        );
        console.log(`Seeded: ${entity.name}`);
    }

    console.log('Seeding complete.');
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
