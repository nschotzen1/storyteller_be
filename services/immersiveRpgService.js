import { randomUUID } from 'crypto';

export const DEFAULT_IMMERSIVE_RPG_PLAYER_ID = 'pc';
export const DEFAULT_IMMERSIVE_RPG_PLAYER_NAME = 'Player Character';
export const DEFAULT_IMMERSIVE_RPG_SCENE_KEY = 'scene_3_mysterious_encounter';
export const DEFAULT_IMMERSIVE_RPG_SCENE_TITLE = 'Scene 3: The Mysterious Encounter';
export const DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID = 'messanger';
export const IMMERSIVE_RPG_TURN_CONTRACT_KEY = 'immersive_rpg_turn';

const DEFAULT_OPENING_SENSORY_DETAILS = [
  'the quiet familiarity of home just a few paces away',
  'a stranger moving with too much purpose to be accidental',
  'the unnerving sense that you have arrived at the wrong moment'
];

const DIFFICULTY_PRESETS = {
  easy: { label: 'easy', successesRequired: 1 },
  standard: { label: 'standard', successesRequired: 1 },
  moderate: { label: 'moderate', successesRequired: 2 },
  hard: { label: 'hard', successesRequired: 3 },
  extreme: { label: 'extreme', successesRequired: 4 },
  'moderate-high': { label: 'moderate-high', successesRequired: 2 }
};

const NOTEBOOK_MODES = new Set(['idle', 'story_prompt', 'roll_request', 'roll_result', 'discovery']);
const STAGE_LAYOUTS = new Set(['focus-left', 'focus-right', 'triptych', 'stacked']);
const STAGE_MODULE_TYPES = new Set(['illustration', 'evidence_note', 'quote_panel']);
const IMMERSIVE_RPG_SCENE_DEFINITIONS = Object.freeze({
  3: Object.freeze({
    number: 3,
    key: DEFAULT_IMMERSIVE_RPG_SCENE_KEY,
    title: DEFAULT_IMMERSIVE_RPG_SCENE_TITLE,
    promptKey: 'immersive_rpg_gm',
    messengerSceneId: DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID,
    needs: Object.freeze(['messenger_scene_brief']),
    optional: Object.freeze(['character_sheet'])
  })
});

const SCENE_3_MASTER_PROMPT = `GM Guidelines for Scene 3
Objective: Create an interactive scene where the PC receives a mysterious package in their home, gradually unveiling an eerie and suspenseful atmosphere. The PC should experience growing unease, leading to the discovery of the hidden package. This package contains a letter filled with specific details that correspond to the initial storytelling fragment, a journal, a pen, and a blank deck of cards. The letter emphasizes urgency, caution, and the need for secrecy.

Setting: Present-day, somewhere on Earth, fitting the description of the initial storytelling fragment. The location should have a mysterious and atmospheric quality, suitable for a pivotal scene.

Key Points:
- The guesthouse should feel familiar and peaceful initially, with subtle hints of intrusion.
- The package is hidden in a small natural nook off the path.
- A stranger with a detailed portrait of the PC initiates the encounter.
- The scene must evoke a gradual build-up of suspense and unease.

Scene 3: The Mysterious Encounter
a. Encounter:
The PC is outside their home but close by, when they encounter someone seemingly lost or stuck. The person does not notice the PC at first because they are busy looking for something and partially screened by the terrain or flora. The stranger is searching for what sounds like a lost object. The PC can remain concealed and may notice a journal lying partly hidden where the stranger cannot easily see it.

b. Interaction:
The PC should be asked "what do you do?" at deliberate moments. Do not offer menu choices. The PC may try to retrieve the journal unnoticed. If so, the GM should call for a Call of Cthulhu-inspired roll at moderate-high difficulty. On failure, the stranger masks their anxiety and pretends nothing is wrong. On success, the PC briefly sees sketches of the area, the exterior of the house, and finally a detailed portrait of the PC before the stranger notices them.

c. Confrontation:
If the stranger spots the PC after the journal is browsed, the stranger approaches with quiet intimidation and tries to take the journal back. Resisting should be difficult. If the stranger succeeds, they say: "I believe that is mine. Thank you." and then: "Oh, we'll meet again, don't worry. We'll find you." If the PC resists successfully, the stranger reveals another sketch of the PC and says a variation of the same line before escaping skillfully.

d. Discovery:
When the PC returns home, subtle changes reveal an intrusion. Someone searched the home, but missed a hidden package in a small natural nook the PC uses for groceries. The package contains a letter, a journal, a pen, and a blank deck of cards.

Letter:
"Dear [PC's Name],

Regarding what you wrote there, something crucial was missed. There is an urgent need for us to meet. Travel to [specific location fitting the initial fragment], a place where the scene can come to life.

Meet me near a distinct landmark before sunset tomorrow. Time is of the essence; ensure you are not being followed, and take all necessary precautions.

Enclosed are your travel details and provisions. Use the journal and pen to document everything you see. The blank cards are of utmost importance; they will reveal their purpose in due time.

Be vigilant. You may not be the only storyteller in this tale.

Sincerely,
The Storyteller Detective
World Famous Storyteller Society"

Instructions for GM:
- The scene framework is a basis to improvise on based on the free choices of the PC.
- The GM persona uses suggestive psychology, subtle horror, and rising tension.
- Pause at moments of real uncertainty. Ask "What do you do?" and let the player author the path.
- Never collapse the scene into canned options.
- Keep the mechanics notebook meaningful. When a roll is required, name the skill, dice, threshold, required successes, and the stakes that belong on the notebook page.`;

export function getDefaultImmersiveRpgGmPromptTemplate() {
  return SCENE_3_MASTER_PROMPT;
}

export function getDefaultImmersiveRpgSceneDefinition() {
  return { ...IMMERSIVE_RPG_SCENE_DEFINITIONS[3] };
}

export function getImmersiveRpgSceneDefinition(sceneRef = 3) {
  if (typeof sceneRef === 'number' && IMMERSIVE_RPG_SCENE_DEFINITIONS[sceneRef]) {
    return { ...IMMERSIVE_RPG_SCENE_DEFINITIONS[sceneRef] };
  }

  const normalizedRef = normalizeText(sceneRef, 160);
  if (!normalizedRef) {
    return getDefaultImmersiveRpgSceneDefinition();
  }

  const byKey = Object.values(IMMERSIVE_RPG_SCENE_DEFINITIONS).find((definition) =>
    definition.key === normalizedRef
  );
  return byKey ? { ...byKey } : getDefaultImmersiveRpgSceneDefinition();
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeText(value, maxLength = 6000) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

function normalizeList(value, { limit = 8, itemMaxLength = 240 } = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    const normalized = normalizeText(entry, itemMaxLength);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
    if (items.length >= limit) break;
  }
  return items;
}

function titleCaseLabel(value) {
  return normalizeText(value, 120)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function safeDateString(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function detectIntent(message = '') {
  const text = normalizeText(message, 1200).toLowerCase();
  if (!text) return 'hesitate';
  if (/(journal|grab|take|get|retrieve|snatch|steal|sneak)/.test(text)) return 'retrieve_journal';
  if (/(hide|conceal|observe|watch|wait|stay still|remain hidden|listen)/.test(text)) return 'observe';
  if (/(approach|call out|speak|talk|help|ask|show yourself)/.test(text)) return 'approach';
  if (/(resist|hold|keep|refuse|pull away|clutch)/.test(text)) return 'resist';
  if (/(go home|return home|inside|leave|retreat|withdraw)/.test(text)) return 'return_home';
  if (/(open|read|package|letter|nook|groceries|search the house|look inside)/.test(text)) return 'inspect_home';
  return 'hesitate';
}

export function normalizeMessengerSceneBriefForRpg(brief = {}) {
  const source = asObject(brief);
  return {
    id: normalizeText(source.id, 120),
    subject: normalizeText(source.subject, 160),
    placeName: normalizeText(source.placeName || source.place_name, 240),
    placeSummary: normalizeText(source.placeSummary || source.place_summary, 4000),
    typewriterHidingSpot: normalizeText(source.typewriterHidingSpot || source.typewriter_hiding_spot, 1600),
    sensoryDetails: normalizeList(source.sensoryDetails || source.sensory_details || DEFAULT_OPENING_SENSORY_DETAILS),
    notableFeatures: normalizeList(source.notableFeatures || source.notable_features),
    sceneEstablished: Boolean(source.sceneEstablished || source.scene_established),
    assistantReply: normalizeText(source.assistantReply || source.assistant_reply, 4000),
    source: normalizeText(source.source, 120),
    meta: asObject(source.meta)
  };
}

export function hasEnoughMessengerSceneBriefForRpg(brief) {
  const normalized = normalizeMessengerSceneBriefForRpg(brief);
  return Boolean(normalized.placeSummary || normalized.placeName || normalized.subject);
}

export function buildMockMessengerSceneBrief({ playerName = '' } = {}) {
  const normalizedPlayerName = normalizeText(playerName, 120) || 'the resident';
  return normalizeMessengerSceneBriefForRpg({
    id: 'immersive-rpg-demo-brief',
    subject: 'Basalt guesthouse above Mourning Cove',
    placeName: 'Basalt Guesthouse, Mourning Cove',
    placeSummary:
      'A salt-worn guesthouse clings to the basalt above a narrow cove, reached by a grocery path that curls through rosemary, wet stone, and wind-pressed grass. The place is intimate rather than grand: a back door often used, kitchen light caught in old panes, and the kind of routine that makes intrusion feel immediate. Tonight the familiarity has thinned. The windows hold the fading light like watchful eyes, the brush beside the path offers just enough concealment for someone patient, and the hush of the cove makes every small movement feel privately observed.',
    typewriterHidingSpot:
      'A square pantry nook cut into the basalt wall beside the back steps, hidden behind stacked produce crates and a canvas shopping sack. Groceries can be slipped there from the path and remain invisible unless someone knows exactly where to reach.',
    sensoryDetails: [
      'rosemary bruised underfoot',
      'salt damp on black stone',
      'the far clink of harbor metal in evening wind'
    ],
    notableFeatures: [
      'a narrow grocery path between brush and basalt',
      'kitchen windows facing the cove',
      'a concealed pantry recess beside the back steps',
      'thorny cover near the path where a journal could vanish from casual sight'
    ],
    sceneEstablished: true,
    assistantReply:
      `${normalizedPlayerName} returns by habit, which is why the wrongness gathers so quickly: the path, the brush, and the back of the house are all too familiar to feel accidental tonight.`,
    source: 'immersive_rpg_mock',
    meta: {
      mock: true,
      mockTemplate: 'scene_3_guesthouse_seed'
    }
  });
}

export function toMessengerSceneBriefContractPayload(brief = {}) {
  const normalized = normalizeMessengerSceneBriefForRpg(brief);
  return {
    subject: normalized.subject,
    place_name: normalized.placeName,
    place_summary: normalized.placeSummary,
    typewriter_hiding_spot: normalized.typewriterHidingSpot,
    sensory_details: normalized.sensoryDetails,
    notable_features: normalized.notableFeatures,
    scene_established: normalized.sceneEstablished,
    assistant_reply: normalized.assistantReply,
    source: normalized.source,
    meta: normalized.meta
  };
}

export function buildCharacterSheetSkeleton({
  sessionId = '',
  playerId = DEFAULT_IMMERSIVE_RPG_PLAYER_ID,
  playerName = DEFAULT_IMMERSIVE_RPG_PLAYER_NAME,
  messengerSceneBrief = null,
  current = null
} = {}) {
  const existing = asObject(current);
  const sceneBrief = normalizeMessengerSceneBriefForRpg(messengerSceneBrief || existing.sourceSceneBrief);
  const existingIdentity = asObject(existing.identity);
  const existingCoreTraits = asObject(existing.coreTraits);
  const existingAttributes = asObject(existing.attributes);
  const existingSkills = asObject(existing.skills);

  return {
    sessionId: normalizeText(sessionId, 160) || normalizeText(existing.sessionId, 160),
    playerId: normalizeText(playerId, 160) || normalizeText(existing.playerId, 160) || DEFAULT_IMMERSIVE_RPG_PLAYER_ID,
    playerName: normalizeText(playerName, 160) || normalizeText(existing.playerName, 160) || DEFAULT_IMMERSIVE_RPG_PLAYER_NAME,
    identity: {
      name: normalizeText(existingIdentity.name, 160),
      pronouns: normalizeText(existingIdentity.pronouns, 80),
      occupation: normalizeText(existingIdentity.occupation, 160),
      archetype: normalizeText(existingIdentity.archetype, 160),
      age: normalizeText(existingIdentity.age, 80),
      residence: normalizeText(existingIdentity.residence, 240) || sceneBrief.placeName,
      look: normalizeText(existingIdentity.look, 400)
    },
    coreTraits: {
      drive: normalizeText(existingCoreTraits.drive, 240),
      fear: normalizeText(existingCoreTraits.fear, 240),
      edge: normalizeText(existingCoreTraits.edge, 240),
      flaw: normalizeText(existingCoreTraits.flaw, 240)
    },
    attributes: {
      strength: Number.isFinite(Number(existingAttributes.strength)) ? Number(existingAttributes.strength) : null,
      constitution: Number.isFinite(Number(existingAttributes.constitution)) ? Number(existingAttributes.constitution) : null,
      size: Number.isFinite(Number(existingAttributes.size)) ? Number(existingAttributes.size) : null,
      dexterity: Number.isFinite(Number(existingAttributes.dexterity)) ? Number(existingAttributes.dexterity) : null,
      appearance: Number.isFinite(Number(existingAttributes.appearance)) ? Number(existingAttributes.appearance) : null,
      intelligence: Number.isFinite(Number(existingAttributes.intelligence)) ? Number(existingAttributes.intelligence) : null,
      power: Number.isFinite(Number(existingAttributes.power)) ? Number(existingAttributes.power) : null,
      education: Number.isFinite(Number(existingAttributes.education)) ? Number(existingAttributes.education) : null
    },
    skills: {
      awareness: Number.isFinite(Number(existingSkills.awareness)) ? Number(existingSkills.awareness) : null,
      stealth: Number.isFinite(Number(existingSkills.stealth)) ? Number(existingSkills.stealth) : null,
      persuade: Number.isFinite(Number(existingSkills.persuade)) ? Number(existingSkills.persuade) : null,
      brawl: Number.isFinite(Number(existingSkills.brawl)) ? Number(existingSkills.brawl) : null,
      occult: Number.isFinite(Number(existingSkills.occult)) ? Number(existingSkills.occult) : null,
      libraryUse: Number.isFinite(Number(existingSkills.libraryUse)) ? Number(existingSkills.libraryUse) : null
    },
    inventory: normalizeList(existing.inventory, { limit: 20, itemMaxLength: 200 }),
    notes: normalizeList(existing.notes, { limit: 20, itemMaxLength: 400 }),
    sourceSceneBrief: sceneBrief
  };
}

function buildOpeningBeatText(sceneBrief, characterSheet) {
  const placeName = sceneBrief.placeName || 'the place you call home';
  const sensoryLine = (sceneBrief.sensoryDetails.length ? sceneBrief.sensoryDetails : DEFAULT_OPENING_SENSORY_DETAILS)
    .slice(0, 3)
    .join(', ');
  const pcName = normalizeText(characterSheet?.identity?.name || characterSheet?.playerName, 120) || 'you';

  return `You are close enough to ${placeName} to feel its ordinary safety pulling at you, and that is exactly why the sight ahead feels wrong. ${sceneBrief.placeSummary || 'The place is familiar, peaceful, and a little too quiet.'} A stranger, plain enough not to draw attention at first glance, is searching the ground with a private urgency they are trying to keep under control. Their focus leaves you unseen for the moment. Off to one side, half-screened by the terrain, lies what looks like a fallen journal. You have the better angle. ${pcName !== 'you' ? `${pcName} can stay hidden for a heartbeat longer.` : 'You can stay hidden for a heartbeat longer.'} The air carries ${sensoryLine}. What do you do?`;
}

function buildPendingRoll({
  contextKey,
  skill,
  diceNotation = '5d6',
  difficulty = 'standard',
  successThreshold = 5,
  successesRequired,
  label = '',
  instructions = ''
}) {
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.standard;
  return {
    contextKey: normalizeText(contextKey, 120),
    skill: normalizeText(skill, 120),
    label: normalizeText(label, 240) || `${titleCaseLabel(skill)} check`,
    diceNotation: normalizeText(diceNotation, 32) || '1d6',
    difficulty: preset.label,
    successThreshold: Number.isFinite(Number(successThreshold)) ? Number(successThreshold) : 5,
    successesRequired: Number.isFinite(Number(successesRequired)) ? Number(successesRequired) : preset.successesRequired,
    instructions: normalizeText(instructions, 1200)
  };
}

function normalizeIntegerList(value, { limit = 12, min = 1, max = 100 } = {}) {
  if (!Array.isArray(value)) return [];
  const numbers = [];
  for (const entry of value) {
    const next = Number(entry);
    if (!Number.isFinite(next)) continue;
    const normalized = Math.min(Math.max(Math.round(next), min), max);
    numbers.push(normalized);
    if (numbers.length >= limit) break;
  }
  return numbers;
}

function normalizeNotebookMode(value) {
  const normalized = normalizeText(value, 80);
  return NOTEBOOK_MODES.has(normalized) ? normalized : 'story_prompt';
}

function normalizeNullableBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function normalizeStageLayout(value) {
  const normalized = normalizeText(value, 80);
  return STAGE_LAYOUTS.has(normalized) ? normalized : 'focus-left';
}

function normalizeStageModuleType(value) {
  const normalized = normalizeText(value, 80);
  return STAGE_MODULE_TYPES.has(normalized) ? normalized : 'illustration';
}

function normalizeNumberInRange(value, { min = -20, max = 20, fallback = 0 } = {}) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
}

function coercePendingRoll(raw = null) {
  if (!raw || typeof raw !== 'object') return null;
  return buildPendingRoll({
    contextKey: raw.contextKey || raw.context_key,
    skill: raw.skill,
    diceNotation: raw.diceNotation || raw.dice_notation,
    difficulty: raw.difficulty,
    successThreshold: raw.successThreshold ?? raw.success_threshold,
    successesRequired: raw.successesRequired ?? raw.successes_required,
    label: raw.label,
    instructions: raw.instructions
  });
}

function buildSuccessTrack(raw = null, fallbackSuccessesRequired = null) {
  if (!raw || typeof raw !== 'object') {
    if (!Number.isFinite(Number(fallbackSuccessesRequired))) {
      return null;
    }
    return {
      successes: 0,
      successesRequired: Math.max(1, Number(fallbackSuccessesRequired)),
      passed: null
    };
  }

  const successes = Number.isFinite(Number(raw.successes))
    ? Math.max(0, Number(raw.successes))
    : 0;
  const successesRequired = Number.isFinite(Number(raw.successesRequired ?? raw.successes_required ?? fallbackSuccessesRequired))
    ? Math.max(1, Number(raw.successesRequired ?? raw.successes_required ?? fallbackSuccessesRequired))
    : 1;

  return {
    successes,
    successesRequired,
    passed: normalizeNullableBoolean(raw.passed)
  };
}

function buildNotebookState({
  mode = 'story_prompt',
  title = 'Mechanics Notebook',
  prompt = '',
  instruction = '',
  scratchLines = [],
  focusTags = [],
  pendingRoll = null,
  diceFaces = [],
  successTrack = null,
  resultSummary = '',
  updatedAt = new Date().toISOString()
} = {}) {
  const normalizedPendingRoll = coercePendingRoll(pendingRoll);

  return {
    mode: normalizeNotebookMode(mode),
    title: normalizeText(title, 160) || 'Mechanics Notebook',
    prompt: normalizeText(prompt, 600),
    instruction: normalizeText(instruction, 1200),
    scratchLines: normalizeList(scratchLines, { limit: 8, itemMaxLength: 240 }),
    focusTags: normalizeList(focusTags, { limit: 6, itemMaxLength: 80 }),
    pendingRoll: normalizedPendingRoll,
    diceFaces: normalizeIntegerList(diceFaces),
    successTrack: buildSuccessTrack(
      successTrack,
      normalizedPendingRoll?.successesRequired ?? null
    ),
    resultSummary: normalizeText(resultSummary, 400),
    updatedAt: safeDateString(updatedAt) || new Date().toISOString()
  };
}

function buildStageModule({
  moduleId = '',
  type = 'illustration',
  variant = 'landscape',
  title = '',
  caption = '',
  imageUrl = '',
  altText = '',
  emphasis = 'secondary',
  rotateDeg = 0,
  tone = '',
  body = '',
  meta = {}
} = {}) {
  return {
    moduleId: normalizeText(moduleId, 120) || randomUUID(),
    type: normalizeStageModuleType(type),
    variant: normalizeText(variant, 80) || 'landscape',
    title: normalizeText(title, 160),
    caption: normalizeText(caption, 320),
    imageUrl: normalizeText(imageUrl, 600),
    altText: normalizeText(altText, 320),
    emphasis: normalizeText(emphasis, 80) || 'secondary',
    rotateDeg: normalizeNumberInRange(rotateDeg, { min: -12, max: 12, fallback: 0 }),
    tone: normalizeText(tone, 120),
    body: normalizeText(body, 800),
    meta: asObject(meta)
  };
}

function normalizeStageModules(value, { limit = 4 } = {}) {
  if (!Array.isArray(value)) return [];
  const items = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    items.push(buildStageModule({
      moduleId: entry.moduleId || entry.module_id,
      type: entry.type,
      variant: entry.variant,
      title: entry.title,
      caption: entry.caption,
      imageUrl: entry.imageUrl || entry.image_url,
      altText: entry.altText || entry.alt_text,
      emphasis: entry.emphasis,
      rotateDeg: entry.rotateDeg ?? entry.rotate_deg,
      tone: entry.tone,
      body: entry.body,
      meta: entry.meta
    }));
    if (items.length >= limit) break;
  }
  return items;
}

function buildStageModuleContractPayload(module) {
  const normalized = buildStageModule(module);
  return {
    module_id: normalized.moduleId,
    type: normalized.type,
    variant: normalized.variant,
    title: normalized.title,
    caption: normalized.caption,
    image_url: normalized.imageUrl,
    alt_text: normalized.altText,
    emphasis: normalized.emphasis,
    rotate_deg: normalized.rotateDeg,
    tone: normalized.tone,
    body: normalized.body,
    meta: normalized.meta
  };
}

function buildOpeningStageModules(sceneBrief) {
  const placeName = sceneBrief.placeName || 'the house';
  return [
    buildStageModule({
      moduleId: 'opening-terrain',
      type: 'illustration',
      variant: 'landscape',
      title: 'Approach to Home',
      caption: `${placeName} sits close enough to promise safety, which makes the stranger’s presence feel worse.`,
      imageUrl: '/assets/mocks/memory_cards/memory_front_01.png',
      altText: 'Atmospheric illustration of the path leading toward home.',
      emphasis: 'primary',
      rotateDeg: -2,
      tone: 'uneasy'
    }),
    buildStageModule({
      moduleId: 'opening-journal',
      type: 'illustration',
      variant: 'polaroid',
      title: 'Fallen Journal',
      caption: 'Half-screened by brush, better seen from the PC’s angle than the stranger’s.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_02.png',
      altText: 'Close view of a journal lying partly hidden near the path.',
      emphasis: 'secondary',
      rotateDeg: 3,
      tone: 'watchful'
    }),
    buildStageModule({
      moduleId: 'opening-note',
      type: 'evidence_note',
      variant: 'scribble',
      title: 'Keeper Margin',
      body: 'The place is ordinary enough to be intimate. The intrusion must arrive by degrees, not all at once.',
      caption: 'Pace the dread.',
      emphasis: 'secondary',
      rotateDeg: -1,
      tone: 'gaslight'
    })
  ];
}

function buildRetrieveStageModules() {
  return [
    buildStageModule({
      moduleId: 'retrieve-primary',
      type: 'illustration',
      variant: 'landscape',
      title: 'A Reach Too Visible',
      caption: 'The ground is not clean, the timing worse.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_03.png',
      altText: 'A tense close approach toward something half-hidden on the ground.',
      emphasis: 'primary',
      rotateDeg: -3,
      tone: 'urgent'
    }),
    buildStageModule({
      moduleId: 'retrieve-secondary',
      type: 'illustration',
      variant: 'portrait',
      title: 'Peripheral Stranger',
      caption: 'The stranger is one wrong glance away from noticing the movement.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_02.png',
      altText: 'A nearby figure searching with too much private focus.',
      emphasis: 'secondary',
      rotateDeg: 4,
      tone: 'tense'
    })
  ];
}

function buildObservationStageModules() {
  return [
    buildStageModule({
      moduleId: 'observe-primary',
      type: 'illustration',
      variant: 'landscape',
      title: 'Watching the Search',
      caption: 'The stranger betrays themself in breaths and pauses before they ever speak.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_01.png',
      altText: 'A concealed vantage on a stranger searching the ground.',
      emphasis: 'primary',
      rotateDeg: -2,
      tone: 'surveillance'
    }),
    buildStageModule({
      moduleId: 'observe-note',
      type: 'quote_panel',
      variant: 'typewritten',
      title: 'Margin Thought',
      body: 'Delay hands the scene to the stranger.',
      caption: 'The journal will not remain yours alone to see.',
      emphasis: 'secondary',
      rotateDeg: 2,
      tone: 'pressure'
    })
  ];
}

function buildContactStageModules() {
  return [
    buildStageModule({
      moduleId: 'contact-primary',
      type: 'illustration',
      variant: 'portrait',
      title: 'Recognition',
      caption: 'The eyes linger as if comparing the original to a drawing already made.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_03.png',
      altText: 'A tense close portrait of the stranger becoming too calm.',
      emphasis: 'primary',
      rotateDeg: 2,
      tone: 'recognition'
    }),
    buildStageModule({
      moduleId: 'contact-note',
      type: 'evidence_note',
      variant: 'scribble',
      title: 'False Calm',
      body: 'The mask arrives too quickly. That is what makes it frightening.',
      caption: 'No roll yet.',
      emphasis: 'secondary',
      rotateDeg: -3,
      tone: 'uncanny'
    })
  ];
}

function buildHomeStageModules() {
  return [
    buildStageModule({
      moduleId: 'home-primary',
      type: 'illustration',
      variant: 'landscape',
      title: 'After Someone Searched',
      caption: 'Home remains recognizable, but only in the way a face remains recognizable after shock.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_01.png',
      altText: 'A familiar room rendered uneasy by subtle disturbance.',
      emphasis: 'primary',
      rotateDeg: -2,
      tone: 'intrusion'
    }),
    buildStageModule({
      moduleId: 'home-secondary',
      type: 'illustration',
      variant: 'polaroid',
      title: 'The Hidden Nook',
      caption: 'Still untouched. That matters.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_02.png',
      altText: 'A small nook hidden beside a path or pantry.',
      emphasis: 'secondary',
      rotateDeg: 4,
      tone: 'revelation'
    })
  ];
}

function buildJournalGlimpseStageModules(sceneBrief) {
  const placeName = sceneBrief.placeName || 'the house';
  return [
    buildStageModule({
      moduleId: 'glimpse-landscape',
      type: 'illustration',
      variant: 'landscape',
      title: 'Fast Landscape Study',
      caption: 'The surrounding terrain appears first, drawn quickly and impossibly well.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_01.png',
      altText: 'A sketch-like landscape study of the area around the house.',
      emphasis: 'primary',
      rotateDeg: -3,
      tone: 'revelation'
    }),
    buildStageModule({
      moduleId: 'glimpse-house',
      type: 'illustration',
      variant: 'polaroid',
      title: `${placeName} Exterior`,
      caption: 'The familiar exterior has already been studied from outside.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_02.png',
      altText: 'A careful exterior study of the player character’s house.',
      emphasis: 'secondary',
      rotateDeg: 2,
      tone: 'surveillance'
    }),
    buildStageModule({
      moduleId: 'glimpse-portrait',
      type: 'illustration',
      variant: 'portrait',
      title: 'Portrait of the PC',
      caption: 'The final page makes the observation personal.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_03.png',
      altText: 'A portrait sketch of the player character.',
      emphasis: 'secondary',
      rotateDeg: 4,
      tone: 'violation'
    })
  ];
}

function buildCaughtStageModules() {
  return [
    buildStageModule({
      moduleId: 'caught-primary',
      type: 'illustration',
      variant: 'portrait',
      title: 'Caught in Motion',
      caption: 'The wrong glance lands at the wrong second.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_03.png',
      altText: 'A stranger turning with sudden calm after noticing movement.',
      emphasis: 'primary',
      rotateDeg: 2,
      tone: 'caught'
    }),
    buildStageModule({
      moduleId: 'caught-note',
      type: 'evidence_note',
      variant: 'scribble',
      title: 'Performance Shift',
      body: 'Urgency vanishes too fast. The stranger is acting calm now, which confirms the first panic was real.',
      caption: 'Mutual awareness established.',
      emphasis: 'secondary',
      rotateDeg: -2,
      tone: 'gaslight'
    })
  ];
}

function buildResistanceStageModules() {
  return [
    buildStageModule({
      moduleId: 'resist-primary',
      type: 'illustration',
      variant: 'portrait',
      title: 'The Reach',
      caption: 'The stranger closes the distance as if this outcome had already been rehearsed.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_03.png',
      altText: 'A sudden close confrontation over the journal.',
      emphasis: 'primary',
      rotateDeg: 3,
      tone: 'pressure'
    }),
    buildStageModule({
      moduleId: 'resist-quote',
      type: 'quote_panel',
      variant: 'typewritten',
      title: 'Tension',
      body: 'This is no longer about stealth. It is about whether the PC can hold onto proof for one more second.',
      caption: 'Hard contest.',
      emphasis: 'secondary',
      rotateDeg: -3,
      tone: 'hard'
    })
  ];
}

function buildPackageDiscoveryStageModules(sceneBrief) {
  const placeName = sceneBrief.placeName || 'your home';
  return [
    buildStageModule({
      moduleId: 'package-primary',
      type: 'illustration',
      variant: 'landscape',
      title: 'Disturbed Familiarity',
      caption: `${placeName} feels newly wrong in small, deliberate ways.`,
      imageUrl: '/assets/mocks/memory_cards/memory_front_01.png',
      altText: 'A familiar room with subtle signs of intrusion.',
      emphasis: 'primary',
      rotateDeg: -2,
      tone: 'intrusion'
    }),
    buildStageModule({
      moduleId: 'package-secondary',
      type: 'illustration',
      variant: 'polaroid',
      title: 'Hidden Package',
      caption: 'The nook still keeps its secret for the moment.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_02.png',
      altText: 'A hidden nook revealing a package.',
      emphasis: 'secondary',
      rotateDeg: 4,
      tone: 'discovery'
    }),
    buildStageModule({
      moduleId: 'package-note',
      type: 'evidence_note',
      variant: 'scribble',
      title: 'Contents',
      body: 'Letter. Journal. Pen. Blank deck of cards.',
      caption: 'Untouched by the intruder.',
      emphasis: 'secondary',
      rotateDeg: -1,
      tone: 'inventory'
    })
  ];
}

function buildHeldBreathStageModules() {
  return [
    buildStageModule({
      moduleId: 'held-primary',
      type: 'illustration',
      variant: 'landscape',
      title: 'The Moment Holds',
      caption: 'Nothing has resolved yet, which is its own form of pressure.',
      imageUrl: '/assets/mocks/memory_cards/memory_front_01.png',
      altText: 'A held, unresolved moment near the house path.',
      emphasis: 'primary',
      rotateDeg: -2,
      tone: 'suspense'
    }),
    buildStageModule({
      moduleId: 'held-note',
      type: 'quote_panel',
      variant: 'typewritten',
      title: 'Pressure',
      body: 'Delay is not neutral. The scene is moving even when the PC does not.',
      caption: 'Choose soon.',
      emphasis: 'secondary',
      rotateDeg: 2,
      tone: 'pressure'
    })
  ];
}

function buildOpeningNotebook(sceneBrief, characterSheet) {
  const placeName = sceneBrief.placeName || 'your home';
  const pcName = normalizeText(characterSheet?.identity?.name || characterSheet?.playerName, 120) || 'you';
  const sensoryDetails = sceneBrief.sensoryDetails?.length
    ? sceneBrief.sensoryDetails.slice(0, 3)
    : DEFAULT_OPENING_SENSORY_DETAILS;

  return buildNotebookState({
    mode: 'story_prompt',
    title: 'Scene Notes',
    prompt: `A stranger is searching near ${placeName}.`,
    instruction: 'No roll yet. Hold the tension until the PC commits to an action.',
    scratchLines: [
      `Place: ${placeName}`,
      `PC: ${pcName}`,
      `Journal visible from the better angle.`,
      ...sensoryDetails.map((detail) => `Atmosphere: ${detail}`)
    ],
    focusTags: ['scene 3', 'observation', 'tension'],
    resultSummary: 'Notebook waiting for the next meaningful choice.'
  });
}

function buildStoryNotebook({
  title = 'Scene Notes',
  prompt = '',
  instruction = '',
  scratchLines = [],
  focusTags = [],
  resultSummary = 'No roll pending.'
} = {}) {
  return buildNotebookState({
    mode: 'story_prompt',
    title,
    prompt,
    instruction,
    scratchLines,
    focusTags,
    resultSummary
  });
}

function buildRollRequestNotebook(
  pendingRoll,
  {
    title = '',
    prompt = '',
    instruction = '',
    scratchLines = [],
    focusTags = [],
    resultSummary = 'Awaiting roll.'
  } = {}
) {
  const normalizedPendingRoll = coercePendingRoll(pendingRoll);
  if (!normalizedPendingRoll) {
    return buildStoryNotebook({
      title: title || 'Scene Notes',
      prompt,
      instruction,
      scratchLines,
      focusTags,
      resultSummary
    });
  }

  return buildNotebookState({
    mode: 'roll_request',
    title: title || normalizedPendingRoll.label || 'Roll Required',
    prompt: prompt || `${titleCaseLabel(normalizedPendingRoll.skill)} is required right now.`,
    instruction: instruction || normalizedPendingRoll.instructions,
    scratchLines: [
      `Dice: ${normalizedPendingRoll.diceNotation}`,
      `Threshold: ${normalizedPendingRoll.successThreshold}+`,
      `Need: ${normalizedPendingRoll.successesRequired} success${normalizedPendingRoll.successesRequired === 1 ? '' : 'es'}`,
      ...scratchLines
    ],
    focusTags,
    pendingRoll: normalizedPendingRoll,
    successTrack: {
      successes: 0,
      successesRequired: normalizedPendingRoll.successesRequired,
      passed: null
    },
    resultSummary
  });
}

function buildRollResultNotebook(
  roll,
  {
    title = '',
    prompt = '',
    instruction = '',
    scratchLines = [],
    focusTags = [],
    resultSummary = ''
  } = {}
) {
  const safeRoll = roll && typeof roll === 'object' ? roll : {};
  return buildNotebookState({
    mode: 'roll_result',
    title: title || normalizeText(safeRoll.label, 240) || 'Roll Resolved',
    prompt: prompt || (safeRoll.passed ? 'The moment breaks in the PC’s favor.' : 'The moment slips the wrong way.'),
    instruction:
      instruction
      || `${normalizeText(safeRoll.diceNotation, 32) || '1d6'} ${titleCaseLabel(safeRoll.skill || 'skill')} at ${normalizeText(safeRoll.difficulty, 80) || 'standard'} difficulty.`,
    scratchLines: [
      `Threshold: ${Number.isFinite(Number(safeRoll.successThreshold)) ? Number(safeRoll.successThreshold) : 0}+`,
      `Needed: ${Number.isFinite(Number(safeRoll.successesRequired)) ? Number(safeRoll.successesRequired) : 0} success${Number(safeRoll.successesRequired) === 1 ? '' : 'es'}`,
      ...scratchLines
    ],
    focusTags,
    diceFaces: Array.isArray(safeRoll.rolls) ? safeRoll.rolls : [],
    successTrack: {
      successes: Number.isFinite(Number(safeRoll.successes)) ? Number(safeRoll.successes) : 0,
      successesRequired: Number.isFinite(Number(safeRoll.successesRequired)) ? Number(safeRoll.successesRequired) : 1,
      passed: Boolean(safeRoll.passed)
    },
    resultSummary: resultSummary || normalizeText(safeRoll.summary, 400)
  });
}

export function buildImmersiveRpgGuidanceSummary(sceneBrief, characterSheet, currentBeat, transcript) {
  const skillSummary = Object.entries(asObject(characterSheet?.skills))
    .map(([key, value]) => `${key}: ${value === null ? 'unset' : value}`)
    .join(', ');
  const recentTranscript = Array.isArray(transcript)
    ? transcript.slice(-6).map((entry) => `${entry.role}: ${entry.text}`).join('\n')
    : '';

  return `Messenger scene brief:
- Subject: ${sceneBrief.subject || 'unknown'}
- Place: ${sceneBrief.placeName || 'unspecified'}
- Place summary: ${sceneBrief.placeSummary || 'unspecified'}
- Hiding spot: ${sceneBrief.typewriterHidingSpot || 'unspecified'}
- Sensory anchors: ${(sceneBrief.sensoryDetails || []).join('; ') || 'none recorded'}
- Notable features: ${(sceneBrief.notableFeatures || []).join('; ') || 'none recorded'}

Character sheet skeleton:
- Player id: ${characterSheet.playerId}
- Player name: ${characterSheet.playerName}
- Identity name: ${characterSheet.identity?.name || 'unset'}
- Occupation: ${characterSheet.identity?.occupation || 'unset'}
- Drive: ${characterSheet.coreTraits?.drive || 'unset'}
- Skills: ${skillSummary || 'unset'}

Current beat: ${currentBeat || 'encounter_setup'}

Recent transcript:
${recentTranscript || 'No transcript yet.'}`;
}

function buildRuntimeContractPromptAppendix(routeContract = null) {
  const contract = asObject(routeContract);
  const responseSchema = asObject(contract.responseSchema);
  const fieldDocs = asObject(contract.fieldDocs);
  const outputRules = Array.isArray(contract.outputRules) ? contract.outputRules : [];
  const examplePayload = contract.examplePayload && typeof contract.examplePayload === 'object'
    ? contract.examplePayload
    : null;
  const sections = [];

  if (Object.keys(responseSchema).length) {
    sections.push(`Runtime JSON Schema:\n${JSON.stringify(responseSchema, null, 2)}`);
  }

  const fieldLines = Object.entries(fieldDocs)
    .map(([key, value]) => {
      const normalizedKey = normalizeText(key, 160);
      const normalizedValue = normalizeText(value, 320);
      return normalizedKey && normalizedValue ? `- ${normalizedKey}: ${normalizedValue}` : '';
    })
    .filter(Boolean);
  if (fieldLines.length) {
    sections.push(`Field guidance:\n${fieldLines.join('\n')}`);
  }

  const normalizedRules = outputRules
    .map((rule) => normalizeText(rule, 320))
    .filter(Boolean);
  if (normalizedRules.length) {
    sections.push(`Output rules:\n${normalizedRules.map((rule) => `- ${rule}`).join('\n')}`);
  }

  if (examplePayload) {
    sections.push(`Example valid JSON:\n${JSON.stringify(examplePayload, null, 2)}`);
  }

  return sections.filter(Boolean).join('\n\n').trim();
}

export function buildCompiledScenePrompt({
  promptTemplate = '',
  routeContract = null,
  sceneBrief,
  characterSheet,
  currentBeat = 'encounter_setup',
  transcript = []
}) {
  const normalizedBrief = normalizeMessengerSceneBriefForRpg(sceneBrief);
  const normalizedSheet = buildCharacterSheetSkeleton({
    sessionId: characterSheet?.sessionId,
    playerId: characterSheet?.playerId,
    playerName: characterSheet?.playerName,
    messengerSceneBrief: normalizedBrief,
    current: characterSheet
  });
  const promptBase = normalizeText(promptTemplate, 20000) || SCENE_3_MASTER_PROMPT;
  const compiledBase = `${promptBase}

Operational scene state:
${buildImmersiveRpgGuidanceSummary(normalizedBrief, normalizedSheet, currentBeat, transcript)}

GM output reminders:
- Maintain a Hitchcock-like atmosphere with subtle gaslight-style dread.
- Ask "What do you do?" when the player reaches a meaningful point of agency.
- Do not offer bullet choices.
- If a roll is required, state the skill, the dice, and the difficulty in plain language.
- Always keep the notebook state aligned with the scene state. If a roll is needed, the notebook must carry that roll request clearly.`;

  const contractAppendix = buildRuntimeContractPromptAppendix(routeContract);
  return contractAppendix
    ? `${compiledBase}\n\nReturn JSON only.\n\n${contractAppendix}`
    : `${compiledBase}\n\nReturn JSON only.`;
}

export function buildImmersiveRpgPromptMessages({
  promptTemplate = '',
  routeContract = null,
  sceneBrief,
  characterSheet,
  currentBeat = 'encounter_setup',
  transcript = [],
  playerMessage = ''
}) {
  const compiledPrompt = buildCompiledScenePrompt({
    promptTemplate,
    routeContract,
    sceneBrief,
    characterSheet,
    currentBeat,
    transcript
  });

  return {
    compiledPrompt,
    prompts: [
      { role: 'system', content: compiledPrompt },
      {
        role: 'user',
        content: `Latest PC action:\n${normalizeText(playerMessage, 4000)}`
      }
    ]
  };
}

export function normalizeImmersiveRpgStagePayload(raw = {}) {
  const source = asObject(raw);
  return {
    stageLayout: normalizeStageLayout(source.stage_layout || source.stageLayout),
    stageModules: normalizeStageModules(source.stage_modules || source.stageModules)
  };
}

export function createTranscriptEntry({
  role,
  text,
  kind = 'narration',
  meta = {},
  createdAt = new Date().toISOString()
}) {
  return {
    entryId: randomUUID(),
    role: role === 'pc' ? 'pc' : role === 'system' ? 'system' : 'gm',
    kind: normalizeText(kind, 80) || 'narration',
    text: normalizeText(text, 8000),
    createdAt: safeDateString(createdAt) || new Date().toISOString(),
    meta: asObject(meta)
  };
}

export function buildSceneBootstrap({
  sessionId,
  playerId = DEFAULT_IMMERSIVE_RPG_PLAYER_ID,
  playerName = DEFAULT_IMMERSIVE_RPG_PLAYER_NAME,
  messengerSceneId = DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID,
  sceneDefinition = null,
  sceneBrief,
  currentCharacterSheet = null,
  promptTemplate = '',
  routeContract = null
}) {
  const resolvedSceneDefinition = getImmersiveRpgSceneDefinition(
    sceneDefinition?.number || sceneDefinition?.key || null
  );
  const normalizedBrief = normalizeMessengerSceneBriefForRpg(sceneBrief);
  const characterSheet = buildCharacterSheetSkeleton({
    sessionId,
    playerId,
    playerName,
    messengerSceneBrief: normalizedBrief,
    current: currentCharacterSheet
  });
  const openingEntry = createTranscriptEntry({
    role: 'gm',
    kind: 'opening',
    text: buildOpeningBeatText(normalizedBrief, characterSheet),
    meta: {
      asksWhatDoYouDo: true,
      beat: 'encounter_setup'
    }
  });

  return {
    sessionId: normalizeText(sessionId, 160),
    playerId: characterSheet.playerId,
    messengerSceneId: normalizeText(messengerSceneId, 160) || resolvedSceneDefinition.messengerSceneId || DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID,
    currentSceneNumber: resolvedSceneDefinition.number,
    currentSceneKey: resolvedSceneDefinition.key,
    sceneTitle: resolvedSceneDefinition.title,
    currentBeat: 'encounter_setup',
    status: 'active',
    promptKey: resolvedSceneDefinition.promptKey,
    sourceSceneBrief: normalizedBrief,
    compiledPrompt: buildCompiledScenePrompt({
      promptTemplate,
      routeContract,
      sceneBrief: normalizedBrief,
      characterSheet,
      currentBeat: 'encounter_setup',
      transcript: [openingEntry]
    }),
    transcript: [openingEntry],
    rollLog: [],
    pendingRoll: null,
    notebook: buildOpeningNotebook(normalizedBrief, characterSheet),
    stageLayout: 'focus-left',
    stageModules: buildOpeningStageModules(normalizedBrief),
    sceneFlags: {
      sawJournalSketches: false,
      strangerSpottedPc: false,
      packageFound: false,
      letterRead: false
    },
    notes: [
      'Bootstrap generated from MessengerSceneBrief.',
      `Scene definition resolved for ${resolvedSceneDefinition.key}.`,
      'Compiled prompt generated from the current immersive RPG GM prompt template.'
    ]
  };
}

export function normalizeImmersiveRpgPendingRoll(raw = null) {
  return coercePendingRoll(raw);
}

export function normalizeImmersiveRpgNotebook(raw = null, { fallbackPendingRoll = null, fallbackRoll = null } = {}) {
  const source = asObject(raw);
  const pendingRoll = normalizeImmersiveRpgPendingRoll(
    source.pending_roll || source.pendingRoll || fallbackPendingRoll
  );
  const successTrackSource = source.success_track || source.successTrack;

  if (!Object.keys(source).length) {
    if (pendingRoll) {
      return buildRollRequestNotebook(pendingRoll);
    }
    if (fallbackRoll && typeof fallbackRoll === 'object') {
      return buildRollResultNotebook(fallbackRoll);
    }
    return buildStoryNotebook({
      title: 'Mechanics Notebook',
      prompt: 'Notebook standing by.',
      instruction: 'No mechanical prompt is currently active.',
      scratchLines: [],
      focusTags: ['standby'],
      resultSummary: 'No roll pending.'
    });
  }

  return buildNotebookState({
    mode: source.mode,
    title: source.title,
    prompt: source.prompt,
    instruction: source.instruction,
    scratchLines: source.scratch_lines || source.scratchLines,
    focusTags: source.focus_tags || source.focusTags,
    pendingRoll,
    diceFaces: source.dice_faces || source.diceFaces,
    successTrack: successTrackSource,
    resultSummary: source.result_summary || source.resultSummary,
    updatedAt: source.updated_at || source.updatedAt
  });
}

export function toImmersiveRpgNotebookContractPayload(notebook = null) {
  const normalized = normalizeImmersiveRpgNotebook(notebook);
  return {
    mode: normalized.mode,
    title: normalized.title,
    prompt: normalized.prompt,
    instruction: normalized.instruction,
    scratch_lines: normalized.scratchLines,
    focus_tags: normalized.focusTags,
    pending_roll: normalized.pendingRoll
      ? {
        context_key: normalized.pendingRoll.contextKey,
        skill: normalized.pendingRoll.skill,
        label: normalized.pendingRoll.label,
        dice_notation: normalized.pendingRoll.diceNotation,
        difficulty: normalized.pendingRoll.difficulty,
        success_threshold: normalized.pendingRoll.successThreshold,
        successes_required: normalized.pendingRoll.successesRequired,
        instructions: normalized.pendingRoll.instructions
      }
      : null,
    dice_faces: normalized.diceFaces,
    success_track: normalized.successTrack
      ? {
        successes: normalized.successTrack.successes,
        successes_required: normalized.successTrack.successesRequired,
        passed: normalized.successTrack.passed
      }
      : null,
    result_summary: normalized.resultSummary,
    updated_at: normalized.updatedAt
  };
}

export function toImmersiveRpgStageModuleContractPayload(module = null) {
  return buildStageModuleContractPayload(module);
}

export function toImmersiveRpgStageContractPayload(raw = {}) {
  const normalized = normalizeImmersiveRpgStagePayload(raw);
  return {
    stage_layout: normalized.stageLayout,
    stage_modules: normalized.stageModules.map((module) => buildStageModuleContractPayload(module))
  };
}

export function normalizeImmersiveRpgChatResponse(raw = {}) {
  const source = asObject(raw);
  const pendingRoll = normalizeImmersiveRpgPendingRoll(source.pending_roll || source.pendingRoll);
  const notebook = normalizeImmersiveRpgNotebook(source.notebook, {
    fallbackPendingRoll: pendingRoll
  });
  const stage = normalizeImmersiveRpgStagePayload(source);
  return {
    gmReply: normalizeText(source.gm_reply || source.gmReply, 8000),
    currentBeat: normalizeText(source.current_beat || source.currentBeat, 120) || 'encounter_setup',
    shouldPauseForChoice: Boolean(source.should_pause_for_choice ?? source.shouldPauseForChoice),
    pendingRoll: pendingRoll || notebook?.pendingRoll || null,
    notebook,
    stageLayout: stage.stageLayout,
    stageModules: stage.stageModules,
    sceneFlagsPatch: asObject(source.scene_flags_patch || source.sceneFlagsPatch),
    keeperNotes: normalizeList(source.keeper_notes || source.keeperNotes, { limit: 12, itemMaxLength: 280 })
  };
}

function buildRetrieveJournalTurn() {
  const pendingRoll = buildPendingRoll({
    contextKey: 'journal_retrieval',
    skill: 'awareness',
    label: 'Retrieve the journal unnoticed',
    diceNotation: '5d6',
    difficulty: 'moderate-high',
    successThreshold: 5,
    successesRequired: 2,
    instructions:
      'Roll 5d6 Awareness. Count 5s and 6s as successes. You need 2 successes to reach the journal, see enough of it, and stay unnoticed.'
  });
  const notebook = buildRollRequestNotebook(pendingRoll, {
    title: 'Journal Margin Test',
    prompt: 'The journal is within reach, but only for a moment.',
    scratchLines: [
      'Failure means the stranger catches the movement.',
      'Success buys only a few seconds with the pages.'
    ],
    focusTags: ['awareness', 'speed', 'concealment']
  });

  return {
    nextBeat: 'journal_attempt',
    pendingRoll,
    notebook,
    stageLayout: 'focus-left',
    stageModules: buildRetrieveStageModules(),
    gmText:
      `You ease toward the fallen journal, but this is not a clean movement. The stranger is too near, the ground too uncertain, and the moment too narrow. ${pendingRoll.instructions} If you hesitate much longer, the chance will close. What do you do?`
  };
}

function buildObserveTurn() {
  return {
    nextBeat: 'encounter_observation',
    pendingRoll: null,
    notebook: buildStoryNotebook({
      title: 'Observation Notes',
      prompt: 'The stranger is still revealing themself.',
      instruction: 'Hold the scene. No roll yet, but time is narrowing.',
      scratchLines: [
        'Breathing sharp, then deliberately calm.',
        'Journal still visible from the PC angle.',
        'Delay favors the stranger, not the PC.'
      ],
      focusTags: ['observation', 'timing', 'tension']
    }),
    stageLayout: 'focus-right',
    stageModules: buildObservationStageModules(),
    gmText:
      'You remain concealed and let the stranger reveal themselves by degrees. Their breathing is wrong for someone merely inconvenienced; too controlled one instant, too sharp the next. The journal still lies where only you have the clear angle on it, but that will not remain true forever. What do you do?'
  };
}

function buildApproachTurn() {
  return {
    nextBeat: 'direct_contact',
    pendingRoll: null,
    notebook: buildStoryNotebook({
      title: 'Contact Notes',
      prompt: 'The stranger now knows the PC is here.',
      instruction: 'No roll yet. The danger is social and immediate.',
      scratchLines: [
        'Calm arrives too quickly to be honest.',
        'The eyes linger as if comparing sketch to subject.'
      ],
      focusTags: ['contact', 'unease', 'confrontation']
    }),
    stageLayout: 'focus-right',
    stageModules: buildContactStageModules(),
    gmText:
      'A small sound gives you away before your voice does. The stranger straightens with practiced calm, smoothing away the urgency you witnessed a moment ago. They look almost harmless now, which is worse. For a beat too long their eyes rest on you as if confirming a sketch against the original. What do you do?'
  };
}

function buildReturnHomeTurn() {
  return {
    nextBeat: 'home_intrusion',
    pendingRoll: null,
    notebook: buildStoryNotebook({
      title: 'House Survey',
      prompt: 'The scene shifts from encounter to intrusion.',
      instruction: 'No roll yet. Let the PC inspect the altered familiarity of home.',
      scratchLines: [
        'Object displaced.',
        'Unfamiliar cologne lingering.',
        'The hidden nook may still be untouched.'
      ],
      focusTags: ['home', 'intrusion', 'package']
    }),
    stageLayout: 'focus-left',
    stageModules: buildHomeStageModules(),
    gmText:
      'You break from the moment and head inside. The familiarity of home does not survive the threshold intact. Something is fractionally wrong: an object displaced, a scent that does not belong to you, the quiet aftermath of someone patient searching where they should not have been. The nook where you sometimes leave groceries remains untouched. What do you do?'
  };
}

function buildResistTurn() {
  const pendingRoll = buildPendingRoll({
    contextKey: 'resist_journal_grab',
    skill: 'brawl',
    label: 'Resist the stranger taking the journal',
    diceNotation: '5d6',
    difficulty: 'hard',
    successThreshold: 5,
    successesRequired: 3,
    instructions:
      'Roll 5d6 Brawl or raw resolve. Count 5s and 6s as successes. You need 3 successes to keep the journal when the stranger closes in.'
  });
  const notebook = buildRollRequestNotebook(pendingRoll, {
    title: 'Resistance Check',
    prompt: 'The stranger is already reaching for the journal.',
    scratchLines: [
      'This is a hard contest.',
      'Failure means the journal leaves with them.'
    ],
    focusTags: ['brawl', 'resolve', 'pressure']
  });

  return {
    nextBeat: 'confrontation',
    pendingRoll,
    notebook,
    stageLayout: 'focus-right',
    stageModules: buildResistanceStageModules(),
    gmText:
      `The stranger closes the distance with a confidence that feels rehearsed. There is nothing accidental left in them now. ${pendingRoll.instructions} Their hand is already reaching. What do you do?`
  };
}

function buildInspectHomeTurn(sceneBrief) {
  const placeName = sceneBrief.placeName || 'your home';
  return {
    nextBeat: 'package_discovery',
    pendingRoll: null,
    notebook: buildStoryNotebook({
      title: 'Package Discovery',
      prompt: 'The hidden nook finally yields the package.',
      instruction: 'No roll. Let the contents land with clarity and dread.',
      scratchLines: [
        `Location: ${placeName}`,
        'Contents: letter, journal, pen, blank deck of cards.',
        'The package waited where the intruder did not look.'
      ],
      focusTags: ['package', 'letter', 'discovery']
    }),
    stageLayout: 'triptych',
    stageModules: buildPackageDiscoveryStageModules(sceneBrief),
    gmText:
      `The signs of intrusion lead you through ${placeName} and finally toward the small natural nook you trust because nobody else would think to use it that way. The package is there, untouched, as if it has been waiting with held breath. Inside are a letter, a journal, a pen, and a blank deck of cards. The paper already feels more urgent than safe. What do you do?`
  };
}

export function buildSkeletonSceneTurn(sessionDoc, playerMessage) {
  const sceneBrief = normalizeMessengerSceneBriefForRpg(sessionDoc?.sourceSceneBrief);
  const currentBeat = normalizeText(sessionDoc?.currentBeat, 120) || 'encounter_setup';
  const intent = detectIntent(playerMessage);

  if (intent === 'retrieve_journal') {
    return buildRetrieveJournalTurn();
  }
  if (intent === 'observe') {
    return buildObserveTurn();
  }
  if (intent === 'approach') {
    return buildApproachTurn();
  }
  if (intent === 'resist' && ['journal_glimpse', 'direct_contact', 'caught_at_journal', 'confrontation'].includes(currentBeat)) {
    return buildResistTurn();
  }
  if (intent === 'return_home') {
    return buildReturnHomeTurn();
  }
  if (intent === 'inspect_home' || currentBeat === 'home_intrusion') {
    return buildInspectHomeTurn(sceneBrief);
  }

  return {
    nextBeat: currentBeat,
    pendingRoll: null,
    notebook: buildStoryNotebook({
      title: 'Held Breath',
      prompt: 'The scene is still unresolved.',
      instruction: 'No roll yet. Pressure rises while the PC still chooses freely.',
      scratchLines: [
        'Stranger occupied but not for long.',
        'Journal remains vulnerable.',
        'Delay sharpens the wrongness of the moment.'
      ],
      focusTags: ['agency', 'pressure', 'hesitation']
    }),
    stageLayout: 'focus-left',
    stageModules: buildHeldBreathStageModules(),
    gmText:
      'The moment stretches but does not release you. The stranger is still occupied, the journal is still vulnerable, and the sense that you are being drawn into something deliberate only sharpens. You still have agency, but not much time. What do you do?'
  };
}

function resolveJournalRetrieval(sceneBrief, roll) {
  if (roll.passed) {
    return {
      nextBeat: 'journal_glimpse',
      sceneFlags: {
        sawJournalSketches: true,
        strangerSpottedPc: true
      },
      notebook: buildRollResultNotebook(roll, {
        title: 'Journal Reached',
        prompt: 'The journal yields its sketches before the stranger notices.',
        scratchLines: [
          'Landscape studies first.',
          'Then the house exterior.',
          'Then a patient portrait of the PC.'
        ],
        focusTags: ['success', 'journal', 'portrait']
      }),
      stageLayout: 'triptych',
      stageModules: buildJournalGlimpseStageModules(sceneBrief),
      gmText:
        'You reach the journal with seconds to spare. The first pages are rapid, beautiful studies of the surrounding land; flora, contours, and little local details rendered by a hand too skilled to be casual. Then the exterior of your house. Then, with a colder precision, a portrait of you made from patient observation. That is the instant the stranger notices you. Their composure gathers around them like a curtain. What do you do?'
    };
  }

  return {
    nextBeat: 'caught_at_journal',
    sceneFlags: {
      strangerSpottedPc: true
    },
    notebook: buildRollResultNotebook(roll, {
      title: 'Movement Seen',
      prompt: 'The stranger catches the attempt before the journal can be studied cleanly.',
      scratchLines: [
        'The calm is theatrical now.',
        'The failed approach confirms mutual awareness.'
      ],
      focusTags: ['failure', 'caught', 'journal']
    }),
    stageLayout: 'focus-right',
    stageModules: buildCaughtStageModules(),
    gmText:
      'You move, and the movement is enough. The stranger turns just before you can manage the journal cleanly. The urgency leaves their face so quickly it becomes theatrical. "No trouble," they seem to suggest without quite saying it, but the performance comes a second too late. They were looking for something, and now they know you know it. What do you do?'
  };
}

function resolveJournalResistance(roll) {
  if (roll.passed) {
    return {
      nextBeat: 'home_intrusion',
      sceneFlags: {
        strangerSpottedPc: true
      },
      notebook: buildRollResultNotebook(roll, {
        title: 'Journal Kept',
        prompt: 'The PC keeps the journal, but the stranger leaves with certainty intact.',
        scratchLines: [
          'A second sketch appears from the parchment fold.',
          'The threat shifts from taking to promising return.'
        ],
        focusTags: ['success', 'resistance', 'threat']
      }),
      stageLayout: 'focus-left',
      stageModules: buildHomeStageModules(),
      gmText:
        'You manage to keep the journal. The stranger stops, studies you, and with almost amused resignation unfolds a looser sketch of your face from inside a parchment fold. "I suppose that will do," they murmur. Then the smile comes, brief and wrong. "Oh, we will meet again. Do not worry. We will find you." The retreat that follows is so skillful it might as well be a vanishing act. By the time you return home, the feeling of being watched has gone indoors ahead of you. What do you do?'
    };
  }

  return {
    nextBeat: 'home_intrusion',
    sceneFlags: {
      strangerSpottedPc: true
    },
    notebook: buildRollResultNotebook(roll, {
      title: 'Journal Lost',
      prompt: 'The stranger takes the journal back with practiced calm.',
      scratchLines: [
        '"I believe that is mine."',
        'The retreat is too skillful to counter.',
        'Home now carries the aftermath.'
      ],
      focusTags: ['failure', 'loss', 'intrusion']
    }),
    stageLayout: 'focus-left',
    stageModules: buildHomeStageModules(),
    gmText:
      'The stranger takes the journal from you with quiet, practiced force. "I believe that is mine. Thank you." The words are polite enough to be insulting. Before retreating they leave you with a shorter line and a short laugh that does not belong in the open air: "Oh, we will meet again. Do not worry. We will find you." You cannot catch them. By the time you make it home, something in the place has already been touched. What do you do?'
  };
}

export function parseDiceNotation(diceNotation = '1d6') {
  const match = /^(\d{1,2})d(\d{1,3})$/i.exec(normalizeText(diceNotation, 32));
  if (!match) {
    const error = new Error('diceNotation must look like XdY, for example 5d6.');
    error.code = 'INVALID_DICE_NOTATION';
    throw error;
  }

  const diceCount = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(diceCount) || !Number.isFinite(sides) || diceCount < 1 || sides < 2) {
    const error = new Error('diceNotation must contain valid positive dice values.');
    error.code = 'INVALID_DICE_NOTATION';
    throw error;
  }

  return { diceCount, sides };
}

export function simulateDicePoolRoll({
  diceNotation = '1d6',
  difficulty = 'standard',
  successThreshold = 5,
  successesRequired,
  skill = '',
  label = '',
  contextKey = '',
  rng = Math.random
} = {}) {
  const { diceCount, sides } = parseDiceNotation(diceNotation);
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.standard;
  const normalizedThreshold = Number.isFinite(Number(successThreshold))
    ? Math.max(1, Math.min(sides, Number(successThreshold)))
    : 5;
  const targetSuccesses = Number.isFinite(Number(successesRequired))
    ? Math.max(1, Number(successesRequired))
    : preset.successesRequired;
  const rolls = Array.from({ length: diceCount }, () => Math.floor(rng() * sides) + 1);
  const successes = rolls.filter((value) => value >= normalizedThreshold).length;
  const passed = successes >= targetSuccesses;

  return {
    rollId: randomUUID(),
    contextKey: normalizeText(contextKey, 120),
    skill: normalizeText(skill, 120),
    label: normalizeText(label, 240) || `${titleCaseLabel(skill)} roll`,
    diceNotation: `${diceCount}d${sides}`,
    diceCount,
    sides,
    difficulty: preset.label,
    successThreshold: normalizedThreshold,
    successesRequired: targetSuccesses,
    rolls,
    successes,
    passed,
    summary: passed
      ? `Success with ${successes} success${successes === 1 ? '' : 'es'}.`
      : `Failure with ${successes} success${successes === 1 ? '' : 'es'}.`
  };
}

export function resolveRollOutcome(sessionDoc, roll) {
  const contextKey = normalizeText(roll?.contextKey, 120) || normalizeText(sessionDoc?.pendingRoll?.contextKey, 120);
  const sceneBrief = normalizeMessengerSceneBriefForRpg(sessionDoc?.sourceSceneBrief);
  if (contextKey === 'journal_retrieval') {
    return resolveJournalRetrieval(sceneBrief, roll);
  }
  if (contextKey === 'resist_journal_grab') {
    return resolveJournalResistance(roll);
  }
  return {
    nextBeat: normalizeText(sessionDoc?.currentBeat, 120) || 'encounter_setup',
    sceneFlags: {},
    notebook: buildRollResultNotebook(roll, {
      title: 'Unmapped Roll',
      prompt: 'The mechanical result is known, but the authored consequence remains open.',
      scratchLines: [
        'Scaffold fallback: no bespoke consequence yet.'
      ],
      focusTags: ['fallback']
    }),
    stageLayout: normalizeStageLayout(sessionDoc?.stageLayout),
    stageModules: normalizeStageModules(sessionDoc?.stageModules),
    gmText:
      `${roll?.summary || 'The roll lands.'} The scene is scaffolded and waiting for the next authored consequence. What do you do?`
  };
}

export function toImmersiveRpgCharacterSheetPayload(doc) {
  if (!doc) return null;
  const sheet = buildCharacterSheetSkeleton({
    sessionId: doc.sessionId,
    playerId: doc.playerId,
    playerName: doc.playerName,
    messengerSceneBrief: doc.sourceSceneBrief,
    current: doc
  });

  return {
    id: String(doc._id || doc.id || ''),
    sessionId: sheet.sessionId,
    playerId: sheet.playerId,
    playerName: sheet.playerName,
    identity: sheet.identity,
    coreTraits: sheet.coreTraits,
    attributes: sheet.attributes,
    skills: sheet.skills,
    inventory: sheet.inventory,
    notes: sheet.notes,
    createdAt: safeDateString(doc.createdAt),
    updatedAt: safeDateString(doc.updatedAt)
  };
}

export function toImmersiveRpgScenePayload(doc, characterSheet = null) {
  if (!doc) return null;
  const transcript = Array.isArray(doc.transcript)
    ? doc.transcript.map((entry) => ({
      entryId: normalizeText(entry.entryId || entry.id, 120) || randomUUID(),
      role: entry.role === 'pc' ? 'pc' : entry.role === 'system' ? 'system' : 'gm',
      kind: normalizeText(entry.kind, 80) || 'narration',
      text: normalizeText(entry.text, 8000),
      createdAt: safeDateString(entry.createdAt),
      meta: asObject(entry.meta)
    }))
    : [];
  const rollLog = Array.isArray(doc.rollLog)
    ? doc.rollLog.map((roll) => ({
      rollId: normalizeText(roll.rollId, 120) || randomUUID(),
      contextKey: normalizeText(roll.contextKey, 120),
      skill: normalizeText(roll.skill, 120),
      label: normalizeText(roll.label, 240),
      diceNotation: normalizeText(roll.diceNotation, 32),
      diceCount: Number(roll.diceCount) || 0,
      sides: Number(roll.sides) || 0,
      difficulty: normalizeText(roll.difficulty, 80),
      successThreshold: Number(roll.successThreshold) || 0,
      successesRequired: Number(roll.successesRequired) || 0,
      rolls: Array.isArray(roll.rolls) ? roll.rolls.map((value) => Number(value) || 0) : [],
      successes: Number(roll.successes) || 0,
      passed: Boolean(roll.passed),
      summary: normalizeText(roll.summary, 400),
      createdAt: safeDateString(roll.createdAt),
      meta: asObject(roll.meta)
    }))
    : [];
  const pendingRoll = normalizeImmersiveRpgPendingRoll(doc.pendingRoll);
  const notebook = normalizeImmersiveRpgNotebook(doc.notebook, {
    fallbackPendingRoll: pendingRoll,
    fallbackRoll: rollLog.length ? rollLog[rollLog.length - 1] : null
  });
  const stage = normalizeImmersiveRpgStagePayload(doc);

  return {
    id: String(doc._id || doc.id || ''),
    sessionId: normalizeText(doc.sessionId, 160),
    playerId: normalizeText(doc.playerId, 160),
    messengerSceneId: normalizeText(doc.messengerSceneId, 160),
    currentSceneNumber: Number.isFinite(Number(doc.currentSceneNumber)) ? Number(doc.currentSceneNumber) : 3,
    currentSceneKey: normalizeText(doc.currentSceneKey, 160),
    sceneTitle: normalizeText(doc.sceneTitle, 240),
    currentBeat: normalizeText(doc.currentBeat, 120),
    status: normalizeText(doc.status, 80),
    promptKey: normalizeText(doc.promptKey, 160),
    sourceSceneBrief: normalizeMessengerSceneBriefForRpg(doc.sourceSceneBrief),
    compiledPrompt: normalizeText(doc.compiledPrompt, 20000),
    transcript,
    rollLog,
    pendingRoll,
    notebook,
    stageLayout: stage.stageLayout,
    stageModules: stage.stageModules,
    sceneFlags: asObject(doc.sceneFlags),
    notes: normalizeList(doc.notes, { limit: 20, itemMaxLength: 400 }),
    characterSheet: characterSheet ? toImmersiveRpgCharacterSheetPayload(characterSheet) : null,
    createdAt: safeDateString(doc.createdAt),
    updatedAt: safeDateString(doc.updatedAt)
  };
}
