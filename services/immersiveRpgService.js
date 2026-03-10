import { randomUUID } from 'crypto';

export const DEFAULT_IMMERSIVE_RPG_PLAYER_ID = 'pc';
export const DEFAULT_IMMERSIVE_RPG_PLAYER_NAME = 'Player Character';
export const DEFAULT_IMMERSIVE_RPG_SCENE_KEY = 'scene_3_mysterious_encounter';
export const DEFAULT_IMMERSIVE_RPG_SCENE_TITLE = 'Scene 3: The Mysterious Encounter';
export const DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID = 'messanger';

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

export function buildCompiledScenePrompt({
  promptTemplate = '',
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

  return `${promptBase}

Operational scene state:
${buildImmersiveRpgGuidanceSummary(normalizedBrief, normalizedSheet, currentBeat, transcript)}

GM output reminders:
- Maintain a Hitchcock-like atmosphere with subtle gaslight-style dread.
- Ask "What do you do?" when the player reaches a meaningful point of agency.
- Do not offer bullet choices.
- If a roll is required, state the skill, the dice, and the difficulty in plain language.`;
}

export function buildImmersiveRpgPromptMessages({
  promptTemplate = '',
  sceneBrief,
  characterSheet,
  currentBeat = 'encounter_setup',
  transcript = [],
  playerMessage = ''
}) {
  const compiledPrompt = buildCompiledScenePrompt({
    promptTemplate,
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
        content: `Latest PC action:\n${normalizeText(playerMessage, 4000)}\n\nReturn the next GM turn as JSON only.`
      }
    ]
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
  sceneBrief,
  currentCharacterSheet = null,
  promptTemplate = ''
}) {
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
    messengerSceneId: normalizeText(messengerSceneId, 160) || DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID,
    currentSceneKey: DEFAULT_IMMERSIVE_RPG_SCENE_KEY,
    sceneTitle: DEFAULT_IMMERSIVE_RPG_SCENE_TITLE,
    currentBeat: 'encounter_setup',
    status: 'active',
    promptKey: DEFAULT_IMMERSIVE_RPG_SCENE_KEY,
    sourceSceneBrief: normalizedBrief,
    compiledPrompt: buildCompiledScenePrompt({
      promptTemplate,
      sceneBrief: normalizedBrief,
      characterSheet,
      currentBeat: 'encounter_setup',
      transcript: [openingEntry]
    }),
    transcript: [openingEntry],
    rollLog: [],
    pendingRoll: null,
    sceneFlags: {
      sawJournalSketches: false,
      strangerSpottedPc: false,
      packageFound: false,
      letterRead: false
    },
    notes: [
      'Bootstrap generated from MessengerSceneBrief.',
      'Compiled prompt generated from the current immersive RPG GM prompt template.'
    ]
  };
}

export function normalizeImmersiveRpgPendingRoll(raw = null) {
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

export function normalizeImmersiveRpgChatResponse(raw = {}) {
  const source = asObject(raw);
  return {
    gmReply: normalizeText(source.gm_reply || source.gmReply, 8000),
    currentBeat: normalizeText(source.current_beat || source.currentBeat, 120) || 'encounter_setup',
    shouldPauseForChoice: Boolean(source.should_pause_for_choice ?? source.shouldPauseForChoice),
    pendingRoll: normalizeImmersiveRpgPendingRoll(source.pending_roll || source.pendingRoll),
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

  return {
    nextBeat: 'journal_attempt',
    pendingRoll,
    gmText:
      `You ease toward the fallen journal, but this is not a clean movement. The stranger is too near, the ground too uncertain, and the moment too narrow. ${pendingRoll.instructions} If you hesitate much longer, the chance will close. What do you do?`
  };
}

function buildObserveTurn() {
  return {
    nextBeat: 'encounter_observation',
    pendingRoll: null,
    gmText:
      'You remain concealed and let the stranger reveal themselves by degrees. Their breathing is wrong for someone merely inconvenienced; too controlled one instant, too sharp the next. The journal still lies where only you have the clear angle on it, but that will not remain true forever. What do you do?'
  };
}

function buildApproachTurn() {
  return {
    nextBeat: 'direct_contact',
    pendingRoll: null,
    gmText:
      'A small sound gives you away before your voice does. The stranger straightens with practiced calm, smoothing away the urgency you witnessed a moment ago. They look almost harmless now, which is worse. For a beat too long their eyes rest on you as if confirming a sketch against the original. What do you do?'
  };
}

function buildReturnHomeTurn() {
  return {
    nextBeat: 'home_intrusion',
    pendingRoll: null,
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

  return {
    nextBeat: 'confrontation',
    pendingRoll,
    gmText:
      `The stranger closes the distance with a confidence that feels rehearsed. There is nothing accidental left in them now. ${pendingRoll.instructions} Their hand is already reaching. What do you do?`
  };
}

function buildInspectHomeTurn(sceneBrief) {
  const placeName = sceneBrief.placeName || 'your home';
  return {
    nextBeat: 'package_discovery',
    pendingRoll: null,
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
    gmText:
      'The moment stretches but does not release you. The stranger is still occupied, the journal is still vulnerable, and the sense that you are being drawn into something deliberate only sharpens. You still have agency, but not much time. What do you do?'
  };
}

function resolveJournalRetrieval(roll) {
  if (roll.passed) {
    return {
      nextBeat: 'journal_glimpse',
      sceneFlags: {
        sawJournalSketches: true,
        strangerSpottedPc: true
      },
      gmText:
        'You reach the journal with seconds to spare. The first pages are rapid, beautiful studies of the surrounding land; flora, contours, and little local details rendered by a hand too skilled to be casual. Then the exterior of your house. Then, with a colder precision, a portrait of you made from patient observation. That is the instant the stranger notices you. Their composure gathers around them like a curtain. What do you do?'
    };
  }

  return {
    nextBeat: 'caught_at_journal',
    sceneFlags: {
      strangerSpottedPc: true
    },
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
      gmText:
        'You manage to keep the journal. The stranger stops, studies you, and with almost amused resignation unfolds a looser sketch of your face from inside a parchment fold. "I suppose that will do," they murmur. Then the smile comes, brief and wrong. "Oh, we will meet again. Do not worry. We will find you." The retreat that follows is so skillful it might as well be a vanishing act. By the time you return home, the feeling of being watched has gone indoors ahead of you. What do you do?'
    };
  }

  return {
    nextBeat: 'home_intrusion',
    sceneFlags: {
      strangerSpottedPc: true
    },
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
  if (contextKey === 'journal_retrieval') {
    return resolveJournalRetrieval(roll);
  }
  if (contextKey === 'resist_journal_grab') {
    return resolveJournalResistance(roll);
  }
  return {
    nextBeat: normalizeText(sessionDoc?.currentBeat, 120) || 'encounter_setup',
    sceneFlags: {},
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

  return {
    id: String(doc._id || doc.id || ''),
    sessionId: normalizeText(doc.sessionId, 160),
    playerId: normalizeText(doc.playerId, 160),
    messengerSceneId: normalizeText(doc.messengerSceneId, 160),
    currentSceneKey: normalizeText(doc.currentSceneKey, 160),
    sceneTitle: normalizeText(doc.sceneTitle, 240),
    currentBeat: normalizeText(doc.currentBeat, 120),
    status: normalizeText(doc.status, 80),
    promptKey: normalizeText(doc.promptKey, 160),
    sourceSceneBrief: normalizeMessengerSceneBriefForRpg(doc.sourceSceneBrief),
    compiledPrompt: normalizeText(doc.compiledPrompt, 20000),
    transcript,
    rollLog,
    pendingRoll: doc.pendingRoll ? { ...asObject(doc.pendingRoll) } : null,
    sceneFlags: asObject(doc.sceneFlags),
    notes: normalizeList(doc.notes, { limit: 20, itemMaxLength: 400 }),
    characterSheet: characterSheet ? toImmersiveRpgCharacterSheetPayload(characterSheet) : null,
    createdAt: safeDateString(doc.createdAt),
    updatedAt: safeDateString(doc.updatedAt)
  };
}
