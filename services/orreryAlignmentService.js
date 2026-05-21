import { OrreryAlignment, OrreryFigurineLevel } from '../models/orrery_models.js';

export const ORRERY_FIGURINE_IDS = [
  'crown',
  'veil',
  'warden',
  'forge',
  'hollow',
  'rift',
  'verdant'
];

const LEVEL_LABELS = {
  0: 'absent',
  1: 'trace / ornament / rare symbol',
  2: 'local influence / faction / place',
  3: 'active cultural or magical force',
  4: 'dominant world-organizing principle',
  5: 'metaphysical law of reality'
};

const BASE_ARCHETYPES = {
  crown: {
    label: 'Crown',
    coreMeaning: 'order, hierarchy, inheritance, legitimacy, empire, and sacred authority',
    geographyInfluence: 'palaces, archives, dynastic roads, coronation cities, and inherited borders',
    civilizationInfluence: 'kingdoms, dynasties, court politics, sacred law, succession, and royal curses',
    magicInfluence: 'oath magic, bloodline recognition, decree-bound spirits, and ancestral legitimacy',
    technologyInfluence: 'scribal archives, seals, heraldic registries, and royal infrastructure',
    emotionalTone: 'grave, ceremonial, lawful, haunted by inheritance',
    conflictTypes: ['succession crisis', 'contested legitimacy', 'royal curse', 'court betrayal'],
    materialLanguage: ['vellum', 'gold leaf', 'red wax', 'royal decree parchment', 'heraldic stains', 'archive dust'],
    paperTextureHints: ['faded gold dust', 'wax smears', 'palace archive fibers', 'royal document wear'],
    promptVocabulary: ['dynastic', 'sacred law', 'ancestral throne', 'archive', 'decree', 'legitimacy'],
    worldPhrase: 'authority is inherited, witnessed, and enforced through old law'
  },
  forge: {
    label: 'Heart-Shaped Forge',
    coreMeaning: 'creation through suffering, craft, labor, devotion, heat, and transformation',
    geographyInfluence: 'furnace monasteries, iron valleys, soot-dark workshops, and relic foundries',
    civilizationInfluence: 'smith-priests, artisan guilds, sacrifice economies, and devotional craft orders',
    magicInfluence: 'ember magic, soul-forging, relic engines, and objects made with emotional cost',
    technologyInfluence: 'forges, bellows, ritual engines, metalwork, and heat-treated relics',
    emotionalTone: 'ardent, scarred, devoted, sacrificial',
    conflictTypes: ['costly creation', 'guild oath', 'relic debt', 'sacrificial craft'],
    materialLanguage: ['charred paper', 'soot', 'iron filings', 'ember stains', 'blackened vellum', 'molten orange fibers'],
    paperTextureHints: ['burned edges', 'soot blooms', 'iron dust', 'warm ember flecks'],
    promptVocabulary: ['furnace', 'hammered', 'ember-lit', 'soul-forged', 'devotional labor'],
    worldPhrase: 'made things carry feeling, debt, and the memory of heat'
  },
  hollow: {
    label: 'Hollow Cave',
    coreMeaning: 'absence, underworld, buried memory, hunger, echo, and hidden depth',
    geographyInfluence: 'caves, catacombs, mines, underground rivers, and buried kingdoms',
    civilizationInfluence: 'underworld settlements, ancestral echo cults, miners, and forgotten dynasties below',
    magicInfluence: 'buried memory, echo rites, ancestral voices, and hungry thresholds beneath the world',
    technologyInfluence: 'lampwork, carved tunnels, mineral ledgers, and subterranean mechanisms',
    emotionalTone: 'hollow, damp, secretive, echoing, ancient',
    conflictTypes: ['buried inheritance', 'underworld hunger', 'lost kingdom', 'cave trespass'],
    materialLanguage: ['damp mineral paper', 'fungal vellum', 'ash-grey fibers', 'cave-lime stains', 'fossil marks'],
    paperTextureHints: ['mineral blooms', 'limestone stains', 'grey fibers', 'fossil impressions'],
    promptVocabulary: ['catacomb', 'underworld', 'buried', 'echo', 'mineral', 'fossil'],
    worldPhrase: 'what is buried continues to speak through absence and echo'
  },
  rift: {
    label: 'Rift',
    coreMeaning: 'rupture, impossible passage, broken reality, invasion, and contradiction',
    geographyInfluence: 'cracked plains, broken skies, sealed fractures, and impossible borderlands',
    civilizationInfluence: 'containment orders, paradox courts, refugee roads, and frontier breach settlements',
    magicInfluence: 'portal magic, time fracture, dimensional bleed, and reality wounds',
    technologyInfluence: 'containment instruments, cracked lenses, breach maps, and exposure records',
    emotionalTone: 'unstable, uncanny, urgent, contradictory',
    conflictTypes: ['reality breach', 'containment failure', 'paradox', 'invasion through a wound'],
    materialLanguage: ['fractured parchment', 'split exposure', 'burnt seams', 'glowing cracks', 'warped emulsion'],
    paperTextureHints: ['split exposure', 'cracked fibers', 'burnt seams', 'warped photographic emulsion'],
    promptVocabulary: ['rupture', 'impossible passage', 'broken sky', 'containment', 'contradiction'],
    worldPhrase: 'passage and damage are the same sacred event'
  },
  veil: {
    label: 'Veil',
    coreMeaning: 'memory, death, dreams, spirits, hidden perception, and soft boundaries',
    geographyInfluence: 'mourning roads, dream districts, spirit courts, cemeteries, and fog-bound rooms',
    civilizationInfluence: 'mourning guilds, ancestral courts, dream interpreters, and spirit photographers',
    magicInfluence: 'ghost speech, prophecy through the dead, dream passage, and palimpsest memory',
    technologyInfluence: 'spirit photography, thin papers, old lenses, exposure plates, and memory archives',
    emotionalTone: 'hushed, mournful, dreamlike, translucent',
    conflictTypes: ['ancestral claim', 'haunting', 'forgotten prophecy', 'dream trespass'],
    materialLanguage: ['translucent onionskin', 'pale blue-grey fibers', 'fogged emulsion', 'ghost stains', 'erased handwriting traces'],
    paperTextureHints: ['onionskin translucency', 'fogged emulsion', 'erased ink traces', 'pale blue-grey fibers'],
    promptVocabulary: ['ghostly', 'dream', 'palimpsest', 'mourning', 'spirit photograph', 'ancestral'],
    worldPhrase: 'memory and the dead remain close enough to change perception'
  },
  verdant: {
    label: 'Verdant',
    coreMeaning: 'growth, wilderness, fertility, rot, ecology, and living systems',
    geographyInfluence: 'forests, wetlands, overgrown ruins, root bridges, and sacred groves',
    civilizationInfluence: 'seasonal rites, root-kin settlements, animal-speaking villages, and ecological law',
    magicInfluence: 'plant memory, living omens, rot cycles, animal speech, and sacred ecology',
    technologyInfluence: 'grown tools, living bridges, herbal records, seed vaults, and seasonal calendars',
    emotionalTone: 'lush, patient, fertile, feral, cyclic',
    conflictTypes: ['overgrowth', 'sacred ecology', 'rot inheritance', 'seasonal obligation'],
    materialLanguage: ['leaf-fiber paper', 'moss stains', 'pressed flowers', 'root-vein fibers', 'green-gold parchment'],
    paperTextureHints: ['root-vein fibers', 'moss stains', 'pressed petals', 'green-gold pulp'],
    promptVocabulary: ['rootbound', 'moss', 'leaf-fiber', 'seasonal', 'overgrown', 'living memory'],
    worldPhrase: 'growth, rot, and memory form one living system'
  },
  warden: {
    label: 'Warden',
    coreMeaning: 'guardianship, boundaries, old duty, protection, watchfulness, and judgment',
    geographyInfluence: 'watchtowers, sealed gates, border forests, ranger roads, and threshold shrines',
    civilizationInfluence: 'rangers, sentinels, gatekeepers, boundary judges, and protective orders',
    magicInfluence: 'wards, tests of trespass, protective marks, sealed roads, and oath-bound gates',
    technologyInfluence: 'field maps, warning posts, carved signs, gate mechanisms, and patrol ledgers',
    emotionalTone: 'watchful, restrained, severe, protective',
    conflictTypes: ['trespass test', 'sealed gate', 'old duty', 'border judgment'],
    materialLanguage: ['bark paper', 'field maps', 'lichen stains', 'carved ward marks', 'dark green-black parchment'],
    paperTextureHints: ['bark grain', 'map lines', 'lichen stains', 'carved ward scratches'],
    promptVocabulary: ['gate', 'watchtower', 'sentinel', 'threshold', 'warded', 'border law'],
    worldPhrase: 'thresholds judge the living before allowing passage'
  }
};

const DEFAULT_NEGATIVE_PROMPT = 'No readable text. No letters. No UI. No modern objects. No glossy photograph. Keep the central writing area usable.';

const DEFAULT_CURATED_ALIGNMENTS = [
  {
    alignmentKey: 'crown4_veil3_warden2',
    vector: {
      crown: 4,
      veil: 3,
      warden: 2,
      forge: 0,
      hollow: 0,
      rift: 0,
      verdant: 0
    },
    title: 'The Haunted Border Kingdom',
    universeSummary: 'A haunted dynastic world where royal legitimacy depends on ancestral recognition, border orders guard sealed roads and tomb-gates, and old oaths still bind the living.',
    mood: 'haunted monarchy, old law, inheritance, watchfulness, ancestral silence',
    vibe: 'royal archival vellum stored in a haunted border fortress',
    dominantArchetype: 'crown',
    secondaryArchetype: 'veil',
    tertiaryArchetype: 'warden',
    hybridInterpretation: 'Royal authority is not merely political here. The dead recognize or refuse each heir, and border wardens enforce roads, tomb-gates, and old vows as living law.',
    geographyStyle: 'misty royal roads, mountain gates, border fortresses, ancestral tombs, ruined watchtowers',
    civilizationStyle: 'dynastic courts, mourning archivists, oath-bound wardens, sealed road orders',
    magicStyle: 'ancestral recognition, ghostly legitimacy, threshold wards, palimpsest prophecy',
    technologyStyle: 'wax seals, boundary maps, archival ledgers, fortress gates, old field instruments',
    materialText: 'Royal archival vellum mixed with translucent ghost-paper, faded gold leaf, rubbed wax seal marks, lichen stains, archive dust, faint scratches, and uneven photographic exposure.',
    paperTexturePrompt: [
      'Create a vertical typewriter paper background for a cinematic fantasy storytelling game.',
      '',
      'The page should feel like royal archival vellum stored in a haunted border fortress. It is writable, but a faint image is embedded inside the fibers like an old photographic memory.',
      '',
      'The upper 65% remains mostly empty and readable: pale vellum, faded gold dust, soft parchment fibers, faint red wax smears, old stains, ghostly palimpsest traces, subtle boundary-map lines.',
      '',
      'The lower 35% gradually reveals a misty mountain gate on an ancient royal road, watched by a ruined tower. Distant palace roofs or ancestral tombs are barely visible through fog. The image should emerge from the paper itself, not look printed on top.',
      '',
      'Material feeling:',
      'royal decree parchment, translucent ghost-paper, faded gold leaf, rubbed wax seal marks, old boundary map, lichen stains, archive dust, faint scratches, uneven exposure, soft vignette.',
      '',
      'Mood:',
      'haunted monarchy, old law, inheritance, watchfulness, ancestral silence.',
      '',
      DEFAULT_NEGATIVE_PROMPT
    ].join('\n'),
    hiddenImagePrompt: 'A misty mountain gate on an ancient royal road, a ruined border tower, distant palace roofs or ancestral tombs barely visible through fog, embedded inside vellum fibers.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    assetPngUrl: '',
    assetStatus: 'missing',
    source: 'seed',
    version: 1
  }
];

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(5, Math.floor(numeric)));
}

export function normalizeOrreryAlignmentVector(rawVector = {}) {
  const source = rawVector && typeof rawVector === 'object' && !Array.isArray(rawVector)
    ? rawVector
    : {};

  return ORRERY_FIGURINE_IDS.reduce((acc, figurineId) => {
    acc[figurineId] = clampLevel(source[figurineId]);
    return acc;
  }, {});
}

function orderedActiveEntries(vector = {}) {
  const normalized = normalizeOrreryAlignmentVector(vector);
  return Object.entries(normalized)
    .filter(([, level]) => level > 0)
    .sort(([leftId, leftLevel], [rightId, rightLevel]) => {
      if (rightLevel !== leftLevel) return rightLevel - leftLevel;
      return ORRERY_FIGURINE_IDS.indexOf(leftId) - ORRERY_FIGURINE_IDS.indexOf(rightId);
    });
}

export function buildOrreryAlignmentKey(vector = {}) {
  const entries = orderedActiveEntries(vector);
  if (!entries.length) return 'neutral0';
  return entries.map(([figurineId, level]) => `${figurineId}${level}`).join('_');
}

function buildDefaultFigurineLevel(figurineId, level) {
  const base = BASE_ARCHETYPES[figurineId];
  const safeLevel = clampLevel(level);
  if (!base) return null;
  if (safeLevel === 0) {
    return {
      figurineId,
      level: 0,
      meaning: `${base.label} is absent from the alignment.`,
      geographyInfluence: '',
      civilizationInfluence: '',
      magicInfluence: '',
      technologyInfluence: '',
      emotionalTone: '',
      conflictTypes: [],
      materialLanguage: [],
      paperTextureHints: [],
      promptVocabulary: []
    };
  }
  const levelLabel = LEVEL_LABELS[safeLevel];
  return {
    figurineId,
    level: safeLevel,
    meaning: `${base.label} at level ${safeLevel} means ${base.coreMeaning}; intensity: ${levelLabel}.`,
    geographyInfluence: base.geographyInfluence,
    civilizationInfluence: base.civilizationInfluence,
    magicInfluence: base.magicInfluence,
    technologyInfluence: base.technologyInfluence,
    emotionalTone: base.emotionalTone,
    conflictTypes: base.conflictTypes,
    materialLanguage: base.materialLanguage,
    paperTextureHints: base.paperTextureHints,
    promptVocabulary: base.promptVocabulary
  };
}

export async function ensureDefaultOrreryContent() {
  const levelWrites = [];
  for (const figurineId of ORRERY_FIGURINE_IDS) {
    for (let level = 0; level <= 5; level += 1) {
      const levelData = buildDefaultFigurineLevel(figurineId, level);
      levelWrites.push(
        OrreryFigurineLevel.updateOne(
          { figurineId, level },
          { $setOnInsert: levelData },
          { upsert: true }
        )
      );
    }
  }

  const alignmentWrites = DEFAULT_CURATED_ALIGNMENTS.map((alignment) =>
    OrreryAlignment.updateOne(
      { alignmentKey: alignment.alignmentKey },
      { $setOnInsert: alignment },
      { upsert: true }
    )
  );

  await Promise.all([...levelWrites, ...alignmentWrites]);
}

async function loadFigurineLevelData(vector = {}) {
  const entries = orderedActiveEntries(vector);
  if (!entries.length) return [];
  const filters = entries.map(([figurineId, level]) => ({ figurineId, level }));
  const docs = await OrreryFigurineLevel.find({ $or: filters }).lean();
  const byKey = new Map(docs.map((doc) => [`${doc.figurineId}:${doc.level}`, doc]));
  return entries
    .map(([figurineId, level]) =>
      byKey.get(`${figurineId}:${level}`) || buildDefaultFigurineLevel(figurineId, level)
    )
    .filter(Boolean);
}

function joinUnique(items = [], limit = 8) {
  return [...new Set(items.filter(Boolean))].slice(0, limit).join(', ');
}

function getBase(figurineId) {
  return BASE_ARCHETYPES[figurineId] || null;
}

function buildRoleSummary(activeDocs = []) {
  const [dominant, secondary, tertiary] = activeDocs;
  const lower = activeDocs.slice(3);
  return { dominant, secondary, tertiary, lower };
}

function labelFor(figurineId) {
  return getBase(figurineId)?.label || figurineId;
}

function buildComposedTitle({ dominant, secondary, tertiary }) {
  if (!dominant) return 'The Untuned Page';
  const dominantLabel = labelFor(dominant.figurineId);
  if (!secondary) return `The ${dominantLabel} Page`;
  const secondaryLabel = labelFor(secondary.figurineId);
  if (!tertiary) return `The ${dominantLabel}-${secondaryLabel} Alignment`;
  const tertiaryLabel = labelFor(tertiary.figurineId);
  return `The ${dominantLabel}-${secondaryLabel} ${tertiaryLabel} World`;
}

function buildUniverseSummary({ dominant, secondary, tertiary, lower }) {
  if (!dominant) {
    return 'An untuned world where the page remains neutral, waiting for a stronger mythic alignment.';
  }
  const dominantBase = getBase(dominant.figurineId);
  const secondaryBase = getBase(secondary?.figurineId);
  const tertiaryBase = getBase(tertiary?.figurineId);
  const lowerText = lower
    .map((doc) => `${labelFor(doc.figurineId).toLowerCase()} appears as level-${doc.level} motifs`)
    .join('; ');
  const sentences = [
    `A ${dominantBase?.label.toLowerCase() || dominant.figurineId} world where ${dominantBase?.worldPhrase || dominant.meaning}.`
  ];
  if (secondaryBase) {
    sentences.push(`${secondaryBase.label} becomes the atmosphere and magical pressure: ${secondaryBase.worldPhrase}.`);
  }
  if (tertiaryBase) {
    sentences.push(`${tertiaryBase.label} shapes institutions, obstacles, and local texture: ${tertiaryBase.worldPhrase}.`);
  }
  if (lowerText) {
    sentences.push(`Lesser alignments surface as ${lowerText}.`);
  }
  return sentences.join(' ');
}

function buildHybridInterpretation({ dominant, secondary, tertiary }) {
  if (!dominant) return 'The Orrery has not yet imposed a mythic grammar on the page.';
  const dominantBase = getBase(dominant.figurineId);
  const secondaryBase = getBase(secondary?.figurineId);
  const tertiaryBase = getBase(tertiary?.figurineId);
  const fragments = [
    `${dominantBase?.label || dominant.figurineId} supplies the world grammar`
  ];
  if (secondaryBase) fragments.push(`${secondaryBase.label} supplies atmosphere, perception, and emotional weather`);
  if (tertiaryBase) fragments.push(`${tertiaryBase.label} supplies borders, institutions, and immediate tests`);
  return `${fragments.join('; ')}. The result should read as one coherent universe identity, not separate archetype tags.`;
}

function buildPaperPrompt({
  materialText,
  hiddenImagePrompt,
  mood,
  textureHints,
  palette
}) {
  return [
    'Create a vertical typewriter paper background for a cinematic fantasy storytelling game.',
    '',
    `The page should feel like ${materialText}. It is writable, but a faint image is embedded inside the fibers like an old photographic memory.`,
    '',
    `The upper 65% remains mostly empty and readable: ${textureHints}, open writing space, subtle analog grain, soft fiber detail, suitable for black typewriter text.`,
    '',
    `The lower 35% gradually reveals ${hiddenImagePrompt}. The image should emerge from the paper itself, not look printed on top.`,
    '',
    'Material feeling:',
    `${materialText}, ${palette}, old paper, film stock, photographic emulsion, memory, mythic tactile wear, soft vignette.`,
    '',
    'Mood:',
    `${mood}.`,
    '',
    DEFAULT_NEGATIVE_PROMPT
  ].join('\n');
}

function composeOrreryAlignment(vector, levelDocs) {
  const roles = buildRoleSummary(levelDocs);
  const { dominant, secondary, tertiary } = roles;
  const alignmentKey = buildOrreryAlignmentKey(vector);
  const activeBases = levelDocs.map((doc) => getBase(doc.figurineId)).filter(Boolean);
  const materialTerms = levelDocs.flatMap((doc) => doc.materialLanguage || []);
  const textureHints = joinUnique(levelDocs.flatMap((doc) => doc.paperTextureHints || []), 10)
    || 'aged fibers, subtle stains, tactile paper grain';
  const promptVocabulary = joinUnique(levelDocs.flatMap((doc) => doc.promptVocabulary || []), 10);
  const materialText = joinUnique(materialTerms, 12)
    || 'aged writable fantasy paper with faint analog emulsion';
  const mood = joinUnique(levelDocs.map((doc) => doc.emotionalTone), 5) || 'quiet, mythic, writable';
  const hiddenImagePrompt = activeBases.length
    ? `a hidden ${promptVocabulary || 'mythic'} landscape or room shaped by ${activeBases.map((base) => base.label.toLowerCase()).join(', ')}`
    : 'a faint, nearly neutral memory landscape';
  const palette = activeBases.length
    ? `palette influenced by ${activeBases.map((base) => base.materialLanguage.slice(0, 2).join(' and ')).join(', ')}`
    : 'warm off-white, smoky grey, muted sepia';

  return {
    alignmentKey,
    vector: normalizeOrreryAlignmentVector(vector),
    title: buildComposedTitle(roles),
    universeSummary: buildUniverseSummary(roles),
    mood,
    vibe: dominant ? `${labelFor(dominant.figurineId)} level ${dominant.level} tuned through the Orrery` : 'untuned page',
    dominantArchetype: dominant?.figurineId || '',
    secondaryArchetype: secondary?.figurineId || '',
    tertiaryArchetype: tertiary?.figurineId || '',
    hybridInterpretation: buildHybridInterpretation(roles),
    geographyStyle: joinUnique(levelDocs.map((doc) => doc.geographyInfluence), 4),
    civilizationStyle: joinUnique(levelDocs.map((doc) => doc.civilizationInfluence), 4),
    magicStyle: joinUnique(levelDocs.map((doc) => doc.magicInfluence), 4),
    technologyStyle: joinUnique(levelDocs.map((doc) => doc.technologyInfluence), 4),
    materialText,
    paperTexturePrompt: buildPaperPrompt({
      materialText,
      hiddenImagePrompt,
      mood,
      textureHints,
      palette
    }),
    hiddenImagePrompt,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    writingStyle: {
      font: "'IM Fell English SC', serif",
      font_size: '1.9rem',
      font_color: '#2a120f',
      mood
    },
    assetPngUrl: '',
    assetStatus: 'missing',
    source: 'composed',
    version: 1
  };
}

function toAlignmentPayload(alignment = {}) {
  const source = alignment && typeof alignment.toObject === 'function'
    ? alignment.toObject()
    : alignment;
  return {
    alignmentKey: source.alignmentKey || buildOrreryAlignmentKey(source.vector),
    vector: normalizeOrreryAlignmentVector(source.vector),
    title: source.title || '',
    universeSummary: source.universeSummary || '',
    mood: source.mood || '',
    vibe: source.vibe || '',
    dominantArchetype: source.dominantArchetype || '',
    secondaryArchetype: source.secondaryArchetype || '',
    tertiaryArchetype: source.tertiaryArchetype || '',
    hybridInterpretation: source.hybridInterpretation || '',
    geographyStyle: source.geographyStyle || '',
    civilizationStyle: source.civilizationStyle || '',
    magicStyle: source.magicStyle || '',
    technologyStyle: source.technologyStyle || '',
    materialText: source.materialText || '',
    paperTexturePrompt: source.paperTexturePrompt || '',
    hiddenImagePrompt: source.hiddenImagePrompt || '',
    negativePrompt: source.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    writingStyle: source.writingStyle || {},
    assetPngUrl: source.assetPngUrl || '',
    assetStatus: source.assetStatus || 'missing',
    source: source.source || 'composed',
    version: source.version || 1
  };
}

export function buildPageTextureSessionSnapshot(identity = {}) {
  const payload = toAlignmentPayload(identity);
  return {
    alignmentKey: payload.alignmentKey,
    title: payload.title,
    universeSummary: payload.universeSummary,
    mood: payload.mood,
    vibe: payload.vibe,
    materialText: payload.materialText,
    paperTexturePrompt: payload.paperTexturePrompt,
    hiddenImagePrompt: payload.hiddenImagePrompt,
    negativePrompt: payload.negativePrompt,
    assetPngUrl: payload.assetPngUrl,
    assetStatus: payload.assetStatus,
    writingStyle: payload.writingStyle,
    version: payload.version
  };
}

export async function resolveOrreryPageTextureIdentity(rawVector = {}, options = {}) {
  const {
    seedDefaults = true,
    persistComposed = true
  } = options;

  const vector = normalizeOrreryAlignmentVector(rawVector);
  const alignmentKey = buildOrreryAlignmentKey(vector);

  if (seedDefaults) {
    await ensureDefaultOrreryContent();
  }

  const existing = await OrreryAlignment.findOne({ alignmentKey }).lean();
  if (existing) return toAlignmentPayload(existing);

  const levelDocs = await loadFigurineLevelData(vector);
  const composed = composeOrreryAlignment(vector, levelDocs);

  if (!persistComposed) return toAlignmentPayload(composed);

  const saved = await OrreryAlignment.findOneAndUpdate(
    { alignmentKey },
    { $setOnInsert: composed },
    { new: true, upsert: true }
  ).lean();

  return toAlignmentPayload(saved);
}
