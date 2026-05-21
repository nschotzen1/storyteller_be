import { buildOpenApiSpec } from './openapi.js';
import { getTypewriterPipelineDefinitions } from './services/typewriterAiSettingsService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';
import { listRouteConfigs } from './services/llmRouteConfigService.js';

describe('typewriter admin API metadata', () => {
  test('keeps runtime AI pipeline definitions scoped to typewriter pipelines', () => {
    const definitions = getTypewriterPipelineDefinitions();

    expect(definitions.map((definition) => definition.key)).toEqual([
      'story_continuation',
      'xerofag_inspection',
      'storyteller_creation',
      'storyteller_intervention',
      'typewriter_key_verification',
      'illustration_creation'
    ]);

    for (const definition of definitions) {
      expect(definition.modelKind).toMatch(/^(text|image)$/);
      expect(definition.supportedProviders.length).toBeGreaterThan(0);
    }
  });

  test('keeps prompt definitions scoped to typewriter admin controls', () => {
    const definitions = getTypewriterPromptDefinitions();

    expect(definitions.map((definition) => definition.key)).toEqual([
      'story_continuation',
      'xerofag_inspection',
      'storyteller_creation',
      'storyteller_intervention',
      'typewriter_key_verification',
      'storyteller_key_creation',
      'illustration_creation'
    ]);
  });

  test('keeps route contracts scoped to storyteller/typewriter generation', async () => {
    const routeConfigs = await listRouteConfigs();

    expect(Object.keys(routeConfigs)).toEqual([
      'text_to_storyteller',
      'storyteller_typewriter_intervention',
      'typewriter_key_verification'
    ]);

    expect(routeConfigs.text_to_storyteller.routePath).toBe('/api/textToStoryteller');
    expect(
      routeConfigs.text_to_storyteller.responseSchema?.properties?.storytellers?.items?.properties?.typewriter_key?.properties
    ).toEqual(
      expect.objectContaining({
        key_shape: expect.any(Object),
        shape_prompt_hint: expect.any(Object)
      })
    );
    expect(routeConfigs.storyteller_typewriter_intervention.routePath).toBe('/api/send_storyteller_typewriter_text');
    expect(
      routeConfigs.storyteller_typewriter_intervention.responseSchema?.properties?.style?.properties?.font_color
    ).toBeDefined();
    expect(routeConfigs.typewriter_key_verification.routePath).toBe('/api/typewriter/keys/shouldAllow');
    expect(routeConfigs.typewriter_key_verification.responseSchema?.properties?.allowed).toBeDefined();
  });

  test('documents only active typewriter and story admin routes in OpenAPI', () => {
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
      '/api/next_film_image',
      '/api/entities',
      '/api/tasks',
      '/api/shouldGenerateContinuation',
      '/api/shouldAllowXerofag',
      '/api/typewriter/keys/shouldAllow',
      '/api/typewriter/session/start',
      '/api/typewriter/session/inspect',
      '/api/typewriter/session/vibe',
      '/api/typewriter/orrery/page-texture',
      '/api/typewriter/storyteller-policy',
      '/api/shouldCreateStorytellerKey',
      '/api/typewriter/storyteller-prompt/preview',
      '/api/send_storyteller_typewriter_text',
      '/api/send_typewriter_text'
    ];

    expect(Object.keys(spec.paths)).toEqual(expectedPaths);
    expect(spec.paths['/api/entities'].get.responses['200'].content['application/json'].schema).toEqual(
      { $ref: '#/components/schemas/NarrativeEntityListResponse' }
    );
    expect(spec.components.schemas.TypewriterKey).toBeDefined();
    expect(spec.components.schemas.TypewriterWorldState).toBeDefined();
    expect(spec.components.schemas.OrreryVector).toBeDefined();
    expect(spec.components.schemas.OrreryPageTextureIdentity).toBeDefined();
    expect(spec.components.schemas.TypewriterSessionInspectResponse).toBeDefined();
  });
});
