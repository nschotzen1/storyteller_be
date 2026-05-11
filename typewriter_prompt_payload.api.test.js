import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockCallJsonLlm = jest.fn();

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  callJsonLlm: mockCallJsonLlm,
  directExternalApiCall: jest.fn(),
  getOpenaiClient: jest.fn(() => ({})),
  listAvailableAnthropicModels: jest.fn(async () => []),
  listAvailableOpenAiModels: jest.fn(async () => []),
  resolveDirectExternalApiRouteError: jest.fn((error) => error)
}));

let app;
let NarrativeFragment;
let TypewriterPromptTemplate;
let Storyteller;
let TypewriterKey;
let NarrativeEntity;
let mongoServer;

jest.setTimeout(30000);

const buildNarrative = (wordCount) =>
  Array.from({ length: wordCount }, (_, index) => `word${index + 1}`).join(' ');

const promptTemplate = `{
  "INPUTS": {
    "current_fragment": "{{current_fragment}}",
    "min_words": "{{min_words}}",
    "max_words": "{{max_words}}"
  }
}`;

async function seedPromptTemplate() {
  await TypewriterPromptTemplate.create({
    pipelineKey: 'story_continuation',
    version: 1,
    promptTemplate,
    isLatest: true,
    createdBy: 'test'
  });
}

async function seedStorytellerInterventionPromptTemplate() {
  await TypewriterPromptTemplate.create({
    pipelineKey: 'storyteller_intervention',
    version: 1,
    promptTemplate: `INTERVENTION_PROMPT_START
Storyteller: {{storyteller_name}}
Task: {{storyteller_task}}
Known context: {{storyteller_known_context}}
Inline fragment should be blank: "{{fragment_text}}"
INTERVENTION_PROMPT_END`,
    isLatest: true,
    createdBy: 'test'
  });
}

function mockContinuationResponse() {
  mockCallJsonLlm.mockResolvedValueOnce({
    glimpse: 'A strip of green paint blurring under a thumb.',
    style: ['handheld blur', 'worn enamel'],
    genre: 'quiet threshold fantasy',
    surprising: 6,
    grounded: 9,
    'ascope/pmessi_awareness': 8,
    pivotal: 7,
    are_you_being_generic_on_me: 2,
    'dare_to_name_names?': 5,
    specificity: 9,
    are_the_surroundings_clear: 8,
    are_you_imposing_cultural_references: 1,
    new_named_entities: ['green latch'],
    readable: 10,
    easy_to_follow: 10,
    narration_style: ['Third-person limited'],
    itchy_fingers: 8,
    continuation: 'The latch clicked shut against a strip of green paint.',
    are_you_proud_of_yourself: 4,
    irreversible: 'The latch is now closed.',
    system_pressure: 'Infrastructure pressure manifested through a locked threshold.',
    world_state_update: {
      entities: [{ name: 'green latch', status: 'closed' }],
      active_tension: 'The closed latch blocks the next passage.',
      established_facts: ['The latch is closed.']
    },
    metadata: {
      font: "'EB Garamond', serif",
      font_size: '2rem',
      font_color: '#2a120f'
    }
  });
}

function mockStorytellerInterventionResponse() {
  mockCallJsonLlm.mockResolvedValueOnce({
    continuation: 'The witness stepped into the margin, named the blue hinge, and withdrew.',
    entity: {
      name: 'Blue Hinge',
      key_text: 'Blue Hinge',
      summary: 'A small painted hinge that remembers every opened threshold.',
      type: 'object',
      subtype: 'threshold clue',
      lore: 'It keeps the color of doors that should not have opened.',
      tags: ['hinge', 'threshold']
    },
    style: {
      font: "'EB Garamond', serif",
      font_size: '2rem',
      font_color: '#1f3558'
    }
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({ NarrativeFragment, TypewriterPromptTemplate, Storyteller, TypewriterKey } = await import('./models/models.js'));
  ({ NarrativeEntity } = await import('./storyteller/utils.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

beforeEach(async () => {
  mockCallJsonLlm.mockReset();
  await NarrativeFragment.deleteMany({});
  await TypewriterPromptTemplate.deleteMany({});
  await Storyteller.deleteMany({});
  await TypewriterKey.deleteMany({});
  await NarrativeEntity.deleteMany({});
  await seedPromptTemplate();
  mockContinuationResponse();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('POST /api/send_typewriter_text prompt payload', () => {
  test('passes only the current fragment and golden-ratio word bounds into the rendered prompt and user payload', async () => {
    const message = buildNarrative(40);

    const response = await request(app)
      .post('/api/send_typewriter_text')
      .send({
        sessionId: 'typewriter-golden-ratio-word-bounds',
        message,
        userBeat: 'word39 word40',
        mocked_api_calls: false
      })
      .expect(200);

    const callArgs = mockCallJsonLlm.mock.calls[0][0];
    const renderedPrompt = JSON.parse(callArgs.prompts[0].content);
    const payload = JSON.parse(callArgs.prompts[1].content);

    expect(renderedPrompt.INPUTS.current_fragment).toBe(message);
    expect(renderedPrompt.INPUTS.min_words).toBe(15);
    expect(renderedPrompt.INPUTS.max_words).toBe(24);
    expect(Object.keys(payload).sort()).toEqual([
      'current_fragment',
      'max_words',
      'min_words'
    ]);
    expect(payload.current_fragment).toBe(message);
    expect(payload.min_words).toBe(15);
    expect(payload.max_words).toBe(24);

    expect(response.body.continuation_insights).toEqual(
      expect.objectContaining({
        glimpse: 'A strip of green paint blurring under a thumb.',
        inspired_by: ['handheld blur', 'worn enamel'],
        genre: 'quiet threshold fantasy',
        'ascope/pmessi_awareness': 8,
        new_named_entities: ['green latch'],
        narration_style: ['Third-person limited'],
        continuation_word_count: 10
      })
    );

    const stored = await NarrativeFragment.findOne({
      session_id: 'typewriter-golden-ratio-word-bounds',
      turn: 0
    }).lean();

    expect(stored.lastTypewriterTurn.continuationInsights).toEqual(
      expect.objectContaining({
        glimpse: 'A strip of green paint blurring under a thumb.',
        inspired_by: ['handheld blur', 'worn enamel'],
        new_named_entities: ['green latch']
      })
    );
  });

  test('composes storyteller intervention prompt as continuation prompt, fragment_text, then intervention prompt', async () => {
    const sessionId = 'storyteller-composite-prompt-order';
    const fragmentText = buildNarrative(40);
    const continuationPromptTemplate = `CONTINUATION_PROMPT_START
Continue with {{min_words}}-{{max_words}} words.
Inline current fragment should be blank: "{{current_fragment}}"
CONTINUATION_PROMPT_END`;

    mockCallJsonLlm.mockReset();
    mockStorytellerInterventionResponse();
    await TypewriterPromptTemplate.deleteMany({});
    await TypewriterPromptTemplate.create({
      pipelineKey: 'story_continuation',
      version: 1,
      promptTemplate: continuationPromptTemplate,
      isLatest: true,
      createdBy: 'test'
    });
    await seedStorytellerInterventionPromptTemplate();

    await request(app)
      .post('/api/typewriter/session/start')
      .send({ sessionId, fragment: fragmentText })
      .expect(200);

    const storyteller = await Storyteller.create({
      session_id: sessionId,
      sessionId,
      name: 'Prompt Witness',
      keySlotIndex: 0,
      immediate_ghost_appearance: 'A figure with ink on their cuffs.',
      typewriter_key: {
        symbol: 'blue hinge',
        description: 'A narrow key stained with blue paint.'
      },
      voice_creation: {
        voice: 'quiet and exact',
        age: 'old',
        style: 'plainspoken'
      }
    });

    await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: false
      })
      .expect(200);

    const callArgs = mockCallJsonLlm.mock.calls[0][0];
    const systemPrompt = callArgs.prompts[0].content;
    const payload = JSON.parse(callArgs.prompts[1].content);
    const continuationIndex = systemPrompt.indexOf('CONTINUATION_PROMPT_START');
    const fragmentIndex = systemPrompt.indexOf(`Fragment text:\n"""\n${fragmentText}\n"""`);
    const interventionIndex = systemPrompt.indexOf('INTERVENTION_PROMPT_START');

    expect(continuationIndex).toBeGreaterThanOrEqual(0);
    expect(fragmentIndex).toBeGreaterThan(continuationIndex);
    expect(interventionIndex).toBeGreaterThan(fragmentIndex);
    expect(systemPrompt).toContain('Inline current fragment should be blank: ""');
    expect(systemPrompt).toContain('Inline fragment should be blank: ""');
    expect(systemPrompt.split(fragmentText).length - 1).toBe(1);
    expect(payload.fragment_text).toBe(fragmentText);
    expect(payload.current_narrative).toBeUndefined();
  });
});
