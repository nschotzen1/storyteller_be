import { buildOpenApiSpec } from './openapi.js';
import { getTypewriterPipelineDefinitions } from './services/typewriterAiSettingsService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';
import { listRouteConfigs } from './services/llmRouteConfigService.js';

describe('story admin API metadata', () => {
  test('includes storyteller intervention and mission in runtime AI pipeline definitions', () => {
    const definitions = getTypewriterPipelineDefinitions();
    const storytellerIntervention = definitions.find((definition) => definition.key === 'storyteller_intervention');
    const storytellerMission = definitions.find((definition) => definition.key === 'storyteller_mission');

    expect(storytellerIntervention).toBeDefined();
    expect(storytellerIntervention.modelKind).toBe('text');
    expect(storytellerIntervention.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
    expect(storytellerMission).toBeDefined();
    expect(storytellerMission.modelKind).toBe('text');
    expect(storytellerMission.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  test('includes storyteller intervention, storyteller mission and relationship evaluation in prompt definitions', () => {
    const definitions = getTypewriterPromptDefinitions();

    expect(definitions.map((definition) => definition.key)).toEqual(
      expect.arrayContaining(['storyteller_intervention', 'storyteller_mission', 'relationship_evaluation'])
    );
  });

  test('includes storyteller intervention in route contracts and keeps storyteller key schema fields aligned', async () => {
    const routeConfigs = await listRouteConfigs();

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
      '/api/shouldGenerateContinuation',
      '/api/typewriter/session/start',
      '/api/shouldCreateStorytellerKey',
      '/api/send_storyteller_typewriter_text',
      '/api/send_typewriter_text'
    ];

    for (const path of expectedPaths) {
      expect(spec.paths[path]).toBeDefined();
    }
  });
});
