import { buildOpenApiSpec } from './openapi.js';
import { getTypewriterPipelineDefinitions } from './services/typewriterAiSettingsService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';

describe('story admin API metadata', () => {
  test('includes storyteller mission in runtime AI pipeline definitions', () => {
    const definitions = getTypewriterPipelineDefinitions();
    const storytellerMission = definitions.find((definition) => definition.key === 'storyteller_mission');

    expect(storytellerMission).toBeDefined();
    expect(storytellerMission.modelKind).toBe('text');
    expect(storytellerMission.supportedProviders).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  test('includes storyteller mission and relationship evaluation in prompt definitions', () => {
    const definitions = getTypewriterPromptDefinitions();

    expect(definitions.map((definition) => definition.key)).toEqual(
      expect.arrayContaining(['storyteller_mission', 'relationship_evaluation'])
    );
  });

  test('documents story admin and typewriter routes in OpenAPI', () => {
    const spec = buildOpenApiSpec();
    const expectedPaths = [
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
      '/api/send_typewriter_text'
    ];

    for (const path of expectedPaths) {
      expect(spec.paths[path]).toBeDefined();
    }
  });
});
