import path from 'path';
import { jest } from '@jest/globals';

const mockTextToImageOpenAi = jest.fn();

jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
  textToImageOpenAi: mockTextToImageOpenAi
}));

const {
  buildQuestSceneGeneratedAssetPath,
  composeQuestSceneImagePrompt,
  generateQuestSceneImageAsset,
  resolveQuestSceneImagePrompt
} = await import('./services/questSceneImageService.js');

describe('questSceneImageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolveQuestSceneImagePrompt prefers explicit prompt then reference prompt', () => {
    expect(resolveQuestSceneImagePrompt({
      prompt: 'explicit prompt',
      referenceImagePrompt: 'reference prompt',
      image_prompt: 'fallback prompt'
    })).toBe('explicit prompt');

    expect(resolveQuestSceneImagePrompt({
      referenceImagePrompt: 'reference prompt',
      image_prompt: 'fallback prompt'
    })).toContain('Primary image brief:\nreference prompt');
  });

  test('composeQuestSceneImagePrompt builds a standalone prompt from scene and screen context', () => {
    const prompt = composeQuestSceneImagePrompt({
      sceneName: 'Rose Court Opening',
      sceneTemplate: 'basic_scene',
      sceneComponents: ['messenger', 'location_mural_materializer'],
      authoringBrief: 'Opening scene at the Hall of the Rose.',
      visualStyleGuide: 'Aged illuminated-manuscript fantasy, tactile ruin surfaces.',
      screenTitle: 'Outer Wall Murals',
      screenPrompt: 'Three weathered murals face the player at dusk.',
      referenceImagePrompt: 'Wide dusk plate of the rose-petal wall and its three murals.',
      image_prompt: 'ruined rose wall at dusk',
      visualContinuityGuidance: 'Keep the same outer petal and dusk palette as the neighboring screens.',
      visualTransitionIntent: 'drift',
      incomingContext: [
        {
          via: 'south',
          title: 'Approach Path',
          referenceImagePrompt: 'A winding path climbing toward the ruined wall.',
          visualContinuityGuidance: 'Keep the same dust and evening wind.'
        }
      ],
      outgoingContext: [
        {
          via: 'west',
          title: 'Left Mural',
          referenceImagePrompt: 'Close mosaic study of the drowned city mural.'
        }
      ]
    });

    expect(prompt).toContain('Create a single finished illustration for a narrative quest screen.');
    expect(prompt).toContain('Scene identity and wiring:');
    expect(prompt).toContain('Scene name: Rose Court Opening');
    expect(prompt).toContain('Base scene template: basic_scene');
    expect(prompt).toContain('Attached components: messenger, location_mural_materializer');
    expect(prompt).toContain('Scene brief:\nOpening scene at the Hall of the Rose.');
    expect(prompt).toContain('Global visual guide:\nAged illuminated-manuscript fantasy, tactile ruin surfaces.');
    expect(prompt).toContain('Primary image brief:\nWide dusk plate of the rose-petal wall and its three murals.');
    expect(prompt).toContain('Compact generator shorthand:\nruined rose wall at dusk');
    expect(prompt).toContain('Transition intent:\nShift gradually from nearby screens; continuity should hold');
    expect(prompt).toContain('Incoming linked-screen context:');
    expect(prompt).toContain('Outgoing linked-screen context:');
  });

  test('generateQuestSceneImageAsset writes to quest-scene generation path', async () => {
    const target = buildQuestSceneGeneratedAssetPath({
      sessionId: 'quest-image-session',
      questId: 'quest-image-id',
      screenId: 'outer_wall_plateau',
      screenTitle: 'Wall of the Hall of the Rose'
    });

    mockTextToImageOpenAi.mockResolvedValue({
      revised_prompt: 'revised prompt',
      url: null,
      localPath: target.absolutePath
    });

    const result = await generateQuestSceneImageAsset({
      sessionId: 'quest-image-session',
      questId: 'quest-image-id',
      screenId: 'outer_wall_plateau',
      screenTitle: 'Wall of the Hall of the Rose',
      referenceImagePrompt: 'Wide dusk manuscript plate of the Hall of the Rose.',
      imageModel: 'gpt-image-1.5'
    });

    expect(mockTextToImageOpenAi).toHaveBeenCalledWith(
      expect.stringContaining('Primary image brief:\nWide dusk manuscript plate of the Hall of the Rose.'),
      1,
      expect.stringContaining(
        path.join('assets', 'quest_scene_generations', 'quest_image_session', 'quest_image_id')
      ),
      false,
      3,
      'gpt-image-1.5'
    );
    expect(result).toEqual(
      expect.objectContaining({
        imageUrl: expect.stringContaining('/assets/quest_scene_generations/quest_image_session/quest_image_id/'),
        promptUsed: expect.stringContaining('Primary image brief:\nWide dusk manuscript plate of the Hall of the Rose.'),
        revisedPrompt: 'revised prompt',
        model: 'gpt-image-1.5',
        mocked: false
      })
    );
  });

  test('generateQuestSceneImageAsset returns placeholder metadata in mock mode', async () => {
    const result = await generateQuestSceneImageAsset({
      sessionId: 'quest-image-session',
      questId: 'quest-image-id',
      screenId: 'outer_wall_plateau',
      referenceImagePrompt: 'Reference prompt.',
      shouldMock: true
    });

    expect(result).toEqual(
      expect.objectContaining({
        imageUrl: '/ruin_south_a.png',
        promptUsed: expect.stringContaining('Primary image brief:\nReference prompt.'),
        mocked: true
      })
    );
    expect(mockTextToImageOpenAi).not.toHaveBeenCalled();
  });
});
