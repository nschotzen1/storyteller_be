import {
  buildMockQuestSceneAuthoringDraft,
  buildQuestSceneAuthoringPromptPayload,
  flattenQuestSceneAuthoringChanges,
  normalizeQuestSceneAuthoringDraft
} from './services/questSceneAuthoringService.js';

describe('questSceneAuthoringService', () => {
  const baseConfig = {
    sessionId: 'quest-authoring-service-session',
    questId: 'quest-authoring-service-id',
    startScreenId: 'gate',
    authoringBrief: 'A gate, a hidden signal, and a hall beyond.',
    phaseGuidance: '',
    visualStyleGuide: '',
    promptRoutes: [],
    screens: [
      {
        id: 'gate',
        title: 'Gate',
        prompt: 'A weathered gate stands open to the dusk.',
        imageUrl: '/ruin_south_a.png',
        image_prompt: '',
        referenceImagePrompt: '',
        promptGuidance: '',
        sceneEndCondition: '',
        visualContinuityGuidance: '',
        visualTransitionIntent: 'inherit',
        textPromptPlaceholder: 'What do you do?',
        directions: [
          { direction: 'north', label: 'Enter the hall', targetScreenId: 'hall' }
        ]
      },
      {
        id: 'hall',
        title: 'Hall',
        prompt: 'The hall waits beyond the threshold.',
        imageUrl: '/arenas/petal_hex_v1.png',
        image_prompt: 'A dusty hall in fading light.',
        referenceImagePrompt: '',
        promptGuidance: '',
        sceneEndCondition: '',
        visualContinuityGuidance: '',
        visualTransitionIntent: 'inherit',
        textPromptPlaceholder: 'What next?',
        directions: [
          { direction: 'south', label: 'Back to the gate', targetScreenId: 'gate' }
        ]
      }
    ]
  };

  test('buildQuestSceneAuthoringPromptPayload includes selected screen and scene outline context', () => {
    const payload = buildQuestSceneAuthoringPromptPayload({
      config: baseConfig,
      selectedScreen: baseConfig.screens[0],
      mode: 'selected_screen'
    });

    expect(payload.authoringMode).toBe('selected_screen');
    expect(payload.selectedScreenId).toBe('gate');
    expect(payload.sceneOutline).toContain('"id": "gate"');
    expect(payload.selectedScreenSnapshot).toContain('"title": "Gate"');
    expect(payload.adjacentVisualContext).toContain('"incoming"');
  });

  test('normalizeQuestSceneAuthoringDraft accepts compact field patches and additions', () => {
    const draft = normalizeQuestSceneAuthoringDraft(
      {
        summary: 'Drafted scene and screen improvements.',
        scene_updates: {
          phase_guidance: 'Keep the scene constrained to the threshold until the player commits.',
          visual_style_guide: 'Tactile dusk stone and restrained continuity.'
        },
        screen_updates: [
          {
            screen_id: 'gate',
            prompt_guidance: 'Keep the player focused on the signal in the stone.',
            visual_transition_intent: 'drift'
          }
        ],
        prompt_route_additions: [
          {
            id: 'listen_for_signal',
            description: 'Listening actions should resolve to the hall reveal.',
            from_screen_ids: ['gate'],
            patterns: ['signal', 'static'],
            target_screen_id: 'hall'
          }
        ]
      },
      {
        config: baseConfig,
        selectedScreenId: 'gate',
        mode: 'fill_missing'
      }
    );

    expect(draft.summary).toBe('Drafted scene and screen improvements.');
    expect(draft.sceneUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'phaseGuidance' }),
        expect.objectContaining({ field: 'visualStyleGuide' })
      ])
    );
    expect(draft.screenUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          screenId: 'gate',
          field: 'promptGuidance'
        }),
        expect.objectContaining({
          screenId: 'gate',
          field: 'visualTransitionIntent',
          value: 'drift'
        })
      ])
    );
    expect(draft.promptRouteAdditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'listen_for_signal',
          targetScreenId: 'hall'
        })
      ])
    );
  });

  test('buildMockQuestSceneAuthoringDraft and flattenQuestSceneAuthoringChanges return reviewable patch rows', () => {
    const rawDraft = buildMockQuestSceneAuthoringDraft({
      config: baseConfig,
      selectedScreen: baseConfig.screens[0],
      mode: 'fill_missing'
    });
    const normalizedDraft = normalizeQuestSceneAuthoringDraft(rawDraft, {
      config: baseConfig,
      selectedScreenId: 'gate',
      mode: 'fill_missing'
    });
    const changes = flattenQuestSceneAuthoringChanges(normalizedDraft, baseConfig);

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'set_scene_field',
          field: 'phaseGuidance'
        }),
        expect.objectContaining({
          action: 'set_screen_field',
          targetId: 'gate',
          field: 'promptGuidance'
        })
      ])
    );
  });
});

