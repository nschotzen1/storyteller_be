import { buildOpenApiSpec } from './openapi.js';
import { getTypewriterPipelineDefinitions } from './services/typewriterAiSettingsService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';
import { listRouteConfigs } from './services/llmRouteConfigService.js';

describe('story admin API metadata', () => {
  test('includes xerofag inspection, storyteller intervention, mission, immersive RPG GM, quest generation, and quest authoring in runtime AI pipeline definitions', () => {
    const definitions = getTypewriterPipelineDefinitions();
    const xerofagInspection = definitions.find((definition) => definition.key === 'xerofag_inspection');
    const storytellerIntervention = definitions.find((definition) => definition.key === 'storyteller_intervention');
    const storytellerMission = definitions.find((definition) => definition.key === 'storyteller_mission');
    const immersiveRpgGm = definitions.find((definition) => definition.key === 'immersive_rpg_gm');
    const questGeneration = definitions.find((definition) => definition.key === 'quest_generation');
    const questSceneAuthoring = definitions.find((definition) => definition.key === 'quest_scene_authoring');

    expect(xerofagInspection).toBeDefined();
    expect(xerofagInspection.modelKind).toBe('text');
    expect(xerofagInspection.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(storytellerIntervention).toBeDefined();
    expect(storytellerIntervention.modelKind).toBe('text');
    expect(storytellerIntervention.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(storytellerMission).toBeDefined();
    expect(storytellerMission.modelKind).toBe('text');
    expect(storytellerMission.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(immersiveRpgGm).toBeDefined();
    expect(immersiveRpgGm.modelKind).toBe('text');
    expect(immersiveRpgGm.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(questGeneration).toBeDefined();
    expect(questGeneration.modelKind).toBe('text');
    expect(questGeneration.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(questSceneAuthoring).toBeDefined();
    expect(questSceneAuthoring.modelKind).toBe('text');
    expect(questSceneAuthoring.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  test('includes xerofag inspection, storyteller intervention, immersive RPG GM, quest generation, quest scene authoring, storyteller mission and relationship evaluation in prompt definitions', () => {
    const definitions = getTypewriterPromptDefinitions();

    expect(definitions.map((definition) => definition.key)).toEqual(
      expect.arrayContaining([
        'xerofag_inspection',
        'storyteller_intervention',
        'immersive_rpg_gm',
        'quest_generation',
        'quest_scene_authoring',
        'storyteller_mission',
        'relationship_evaluation'
      ])
    );
  });

  test('includes immersive RPG turn, quest advance, and storyteller intervention in route contracts and keeps storyteller key schema fields aligned', async () => {
    const routeConfigs = await listRouteConfigs();

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
      '/api/typewriter/session/start',
      '/api/shouldCreateStorytellerKey',
      '/api/send_storyteller_typewriter_text',
      '/api/send_typewriter_text',
      '/api/memories/{memoryId}/textToImage/front',
      '/api/memories/{memoryId}/textToImage/back',
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
    expect(spec.components.schemas.NarrativeEntity).toBeDefined();
    expect(spec.components.schemas.NarrativeEntityListResponse).toBeDefined();
    expect(spec.components.schemas.ImmersiveRpgNotebook).toBeDefined();
    expect(spec.components.schemas.ImmersiveRpgStageModule).toBeDefined();
    expect(spec.paths['/api/entities'].get.responses['200'].content['application/json'].schema).toEqual(
      { $ref: '#/components/schemas/NarrativeEntityListResponse' }
    );
  });
});
