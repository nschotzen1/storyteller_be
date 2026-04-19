import { buildOpenApiSpec } from './openapi.js';
import { getTypewriterPipelineDefinitions } from './services/typewriterAiSettingsService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';
import { listRouteConfigs } from './services/llmRouteConfigService.js';

describe('story admin API metadata', () => {
  test('includes xerofag inspection, typewriter key verification, storyteller intervention, mission, immersive RPG GM, seer reading, quest generation, and quest authoring in runtime AI pipeline definitions', () => {
    const definitions = getTypewriterPipelineDefinitions();
    const xerofagInspection = definitions.find((definition) => definition.key === 'xerofag_inspection');
    const typewriterKeyVerification = definitions.find((definition) => definition.key === 'typewriter_key_verification');
    const storytellerIntervention = definitions.find((definition) => definition.key === 'storyteller_intervention');
    const storytellerMission = definitions.find((definition) => definition.key === 'storyteller_mission');
    const immersiveRpgGm = definitions.find((definition) => definition.key === 'immersive_rpg_gm');
    const seerReadingOrchestrator = definitions.find((definition) => definition.key === 'seer_reading_orchestrator');
    const seerReadingCardGeneration = definitions.find((definition) => definition.key === 'seer_reading_card_generation');
    const questGeneration = definitions.find((definition) => definition.key === 'quest_generation');
    const questSceneAuthoring = definitions.find((definition) => definition.key === 'quest_scene_authoring');

    expect(xerofagInspection).toBeDefined();
    expect(xerofagInspection.modelKind).toBe('text');
    expect(xerofagInspection.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(typewriterKeyVerification).toBeDefined();
    expect(typewriterKeyVerification.modelKind).toBe('text');
    expect(typewriterKeyVerification.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(storytellerIntervention).toBeDefined();
    expect(storytellerIntervention.modelKind).toBe('text');
    expect(storytellerIntervention.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(storytellerMission).toBeDefined();
    expect(storytellerMission.modelKind).toBe('text');
    expect(storytellerMission.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(immersiveRpgGm).toBeDefined();
    expect(immersiveRpgGm.modelKind).toBe('text');
    expect(immersiveRpgGm.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(seerReadingOrchestrator).toBeDefined();
    expect(seerReadingOrchestrator.modelKind).toBe('text');
    expect(seerReadingOrchestrator.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(seerReadingCardGeneration).toBeDefined();
    expect(seerReadingCardGeneration.modelKind).toBe('text');
    expect(seerReadingCardGeneration.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(questGeneration).toBeDefined();
    expect(questGeneration.modelKind).toBe('text');
    expect(questGeneration.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(questSceneAuthoring).toBeDefined();
    expect(questSceneAuthoring.modelKind).toBe('text');
    expect(questSceneAuthoring.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  test('includes xerofag inspection, typewriter key verification, storyteller intervention, immersive RPG GM, seer reading, quest generation, quest scene authoring, storyteller mission and relationship evaluation in prompt definitions', () => {
    const definitions = getTypewriterPromptDefinitions();

    expect(definitions.map((definition) => definition.key)).toEqual(
      expect.arrayContaining([
        'xerofag_inspection',
        'typewriter_key_verification',
        'storyteller_intervention',
        'immersive_rpg_gm',
        'seer_reading_orchestrator',
        'seer_reading_card_generation',
        'quest_generation',
        'quest_scene_authoring',
        'storyteller_mission',
        'relationship_evaluation'
      ])
    );
  });

  test('includes text-to-entity, immersive RPG turn, seer reading orchestration, quest advance, storyteller intervention, and typewriter key verification in route contracts and keeps storyteller key schema fields aligned', async () => {
    const routeConfigs = await listRouteConfigs();

    expect(routeConfigs.text_to_entity).toBeDefined();
    expect(routeConfigs.text_to_entity.routePath).toBe('/api/textToEntity');
    expect(routeConfigs.text_to_entity.responseSchema?.properties?.entities).toBeDefined();
    expect(routeConfigs.immersive_rpg_turn).toBeDefined();
    expect(routeConfigs.immersive_rpg_turn.routePath).toBe('/api/immersive-rpg/chat');
    expect(routeConfigs.immersive_rpg_turn.responseSchema?.properties?.pending_roll).toBeDefined();
    expect(routeConfigs.immersive_rpg_turn.responseSchema?.properties?.notebook).toBeDefined();
    expect(routeConfigs.immersive_rpg_turn.responseSchema?.properties?.stage_layout).toBeDefined();
    expect(routeConfigs.immersive_rpg_turn.responseSchema?.properties?.stage_modules).toBeDefined();
    expect(routeConfigs.quest_advance).toBeDefined();
    expect(routeConfigs.quest_advance.routePath).toBe('/api/quest/advance');
    expect(routeConfigs.quest_advance.responseSchema?.properties?.image_prompt).toBeDefined();
    expect(routeConfigs.quest_advance.responseSchema?.properties?.stage_layout).toBeDefined();
    expect(routeConfigs.quest_advance.responseSchema?.properties?.stage_modules).toBeDefined();
    expect(routeConfigs.storyteller_typewriter_intervention).toBeDefined();
    expect(routeConfigs.storyteller_typewriter_intervention.routePath).toBe('/api/send_storyteller_typewriter_text');
    expect(routeConfigs.seer_reading_orchestrator).toBeDefined();
    expect(routeConfigs.seer_reading_orchestrator.routePath).toBe('/api/seer/readings/:readingId/turn');
    expect(routeConfigs.seer_reading_orchestrator.responseSchema?.properties?.tool_calls).toBeDefined();
    expect(routeConfigs.seer_reading_orchestrator.responseSchema?.properties?.transition_type).toBeDefined();
    expect(routeConfigs.seer_reading_card_generation).toBeDefined();
    expect(routeConfigs.seer_reading_card_generation.routePath).toBe('internal://seer-reading/cards/generate');
    expect(routeConfigs.seer_reading_card_generation.responseSchema?.properties?.cards).toBeDefined();
    expect(
      routeConfigs.storyteller_typewriter_intervention.responseSchema?.properties?.style?.properties?.font_color
    ).toBeDefined();
    expect(
      routeConfigs.text_to_storyteller.responseSchema?.properties?.storytellers?.items?.properties?.typewriter_key?.properties
    ).toEqual(
      expect.objectContaining({
        key_shape: expect.any(Object),
        shape_prompt_hint: expect.any(Object)
      })
    );
    expect(routeConfigs.typewriter_key_verification).toBeDefined();
    expect(routeConfigs.typewriter_key_verification.routePath).toBe('/api/typewriter/keys/shouldAllow');
    expect(routeConfigs.typewriter_key_verification.responseSchema?.properties?.allowed).toBeDefined();
  });

  test('documents story admin and typewriter routes in OpenAPI', () => {
    const spec = buildOpenApiSpec();
    const expectedPaths = [
      '/api/admin/llm-config',
      '/api/admin/llm-config/{routeKey}',
      '/api/admin/llm-config/{routeKey}/versions',
      '/api/admin/llm-config/{routeKey}/prompt',
      '/api/admin/llm-config/{routeKey}/schema',
      '/api/admin/llm-config/{routeKey}/latest',
      '/api/admin/llm-config/{routeKey}/reset',
      '/api/admin/openai/models',
      '/api/admin/typewriter/ai-settings',
      '/api/admin/typewriter/ai-settings/reset',
      '/api/admin/typewriter/prompts',
      '/api/admin/typewriter/prompts/seed-current',
      '/api/admin/typewriter/prompts/{pipelineKey}',
      '/api/admin/typewriter/prompts/{pipelineKey}/versions',
      '/api/admin/typewriter/prompts/{pipelineKey}/latest',
      '/api/admin/quest/authoring-draft',
      '/api/shouldGenerateContinuation',
      '/api/shouldAllowXerofag',
      '/api/typewriter/keys/shouldAllow',
      '/api/typewriter/session/start',
      '/api/typewriter/session/inspect',
      '/api/shouldCreateStorytellerKey',
      '/api/send_storyteller_typewriter_text',
      '/api/send_typewriter_text',
      '/api/memories/{memoryId}/textToImage/front',
      '/api/memories/{memoryId}/textToImage/back',
      '/api/seer/readings',
      '/api/seer/readings/{readingId}',
      '/api/seer/readings/{readingId}/turn',
      '/api/seer/readings/{readingId}/cards/{cardId}/claim',
      '/api/seer/readings/{readingId}/close',
      '/api/immersive-rpg/scene',
      '/api/immersive-rpg/chat',
      '/api/immersive-rpg/rolls',
      '/api/immersive-rpg/character-sheet',
      '/api/quest/advance'
    ];

    for (const path of expectedPaths) {
      expect(spec.paths[path]).toBeDefined();
    }

    expect(spec.paths['/api/entities']).toBeDefined();
    expect(spec.paths['/api/textToEntity']).toBeDefined();
    expect(spec.components.schemas.NarrativeEntity).toBeDefined();
    expect(spec.components.schemas.TypewriterKey).toBeDefined();
    expect(spec.components.schemas.TypewriterSessionInspectResponse).toBeDefined();
    expect(spec.components.schemas.NarrativeEntityListResponse).toBeDefined();
    expect(spec.components.schemas.SeerReadingResponse).toBeDefined();
    expect(spec.components.schemas.ImmersiveRpgNotebook).toBeDefined();
    expect(spec.components.schemas.ImmersiveRpgStageModule).toBeDefined();
    expect(spec.paths['/api/entities'].get.responses['200'].content['application/json'].schema).toEqual(
      { $ref: '#/components/schemas/NarrativeEntityListResponse' }
    );
    expect(
      spec.paths['/api/textToEntity'].post.requestBody.content['application/json'].schema.properties.desiredEntityCategories
    ).toEqual(
      expect.objectContaining({
        type: 'array'
      })
    );
    expect(
      spec.paths['/api/textToEntity'].post.responses['200'].content['application/json'].schema.properties.desiredEntityCategories
    ).toEqual(
      expect.objectContaining({
        type: 'array'
      })
    );
    expect(spec.paths['/api/sendStorytellerToEntity'].post.responses['200'].content['application/json'].schema.properties.characterSheet).toBeDefined();
  });
});
