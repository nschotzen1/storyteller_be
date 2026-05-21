import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OrreryAlignment, OrreryFigurineLevel } from './models/orrery_models.js';
import {
  buildOrreryAlignmentKey,
  normalizeOrreryAlignmentVector,
  resolveOrreryPageTextureIdentity
} from './services/orreryAlignmentService.js';

describe('orreryAlignmentService', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoServer.getUri(), {
      dbName: 'orrery-alignment-service-test'
    });
  });

  afterEach(async () => {
    await OrreryFigurineLevel.deleteMany({});
    await OrreryAlignment.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('normalizes a vector and builds a stable alignment key by dominant levels', () => {
    const vector = normalizeOrreryAlignmentVector({
      crown: 4.9,
      veil: 3,
      warden: 2,
      forge: -1,
      hollow: 8,
      unknown: 5
    });

    expect(vector).toEqual({
      crown: 4,
      veil: 3,
      warden: 2,
      forge: 0,
      hollow: 5,
      rift: 0,
      verdant: 0
    });
    expect(buildOrreryAlignmentKey(vector)).toBe('hollow5_crown4_veil3_warden2');
  });

  test('returns the curated haunted border kingdom alignment when it exists in default content', async () => {
    const identity = await resolveOrreryPageTextureIdentity({
      crown: 4,
      veil: 3,
      warden: 2
    });

    expect(identity).toEqual(
      expect.objectContaining({
        alignmentKey: 'crown4_veil3_warden2',
        title: 'The Haunted Border Kingdom',
        dominantArchetype: 'crown',
        secondaryArchetype: 'veil',
        tertiaryArchetype: 'warden',
        assetStatus: 'missing',
        source: 'seed'
      })
    );
    expect(identity.universeSummary).toContain('royal legitimacy depends on ancestral recognition');
    expect(identity.paperTexturePrompt).toContain('The upper 65% remains mostly empty and readable');
    expect(identity.paperTexturePrompt).toContain('The lower 35% gradually reveals');
    expect(await OrreryFigurineLevel.countDocuments()).toBe(42);
  });

  test('composes and stores a missing exact alignment from figurine-level content', async () => {
    const identity = await resolveOrreryPageTextureIdentity({
      forge: 4,
      hollow: 2,
      verdant: 1
    });

    expect(identity).toEqual(
      expect.objectContaining({
        alignmentKey: 'forge4_hollow2_verdant1',
        dominantArchetype: 'forge',
        secondaryArchetype: 'hollow',
        tertiaryArchetype: 'verdant',
        assetStatus: 'missing',
        source: 'composed'
      })
    );
    expect(identity.hybridInterpretation).toContain('one coherent universe identity');
    expect(identity.paperTexturePrompt).toContain('suitable for black typewriter text');

    const stored = await OrreryAlignment.findOne({
      alignmentKey: 'forge4_hollow2_verdant1'
    }).lean();
    expect(stored).toBeTruthy();
    expect(stored.materialText).toContain('charred paper');
  });
});
