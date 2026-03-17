import { describe, expect, test } from '@jest/globals';

import {
  coerceQuestAdvanceContractPayload,
  normalizeQuestAdvancePlan
} from './services/questAdvanceContractService.js';

describe('quest advance contract service', () => {
  test('coerceQuestAdvanceContractPayload normalizes sparse camelCase stage modules', () => {
    const payload = coerceQuestAdvanceContractPayload({
      title: 'Lantern Niche',
      prompt: 'A narrow lantern niche opens in the wall.',
      imagePrompt: 'A lantern niche hidden behind weathered stone.',
      textPromptPlaceholder: 'What now?',
      expectationSummary: 'The player discovers a narrow lit recess.',
      continuitySummary: 'The niche remains part of the same gate wall.',
      directionLabel: 'Study the lantern niche',
      stageLayout: 'focus-left',
      stageModules: [
        {
          type: 'illustration',
          title: 'Lantern Light'
        },
        {
          type: 'quote_panel',
          body: 'The wall hums with a faint signal.'
        }
      ]
    });

    expect(payload).toEqual(
      expect.objectContaining({
        title: 'Lantern Niche',
        image_prompt: 'A lantern niche hidden behind weathered stone.',
        text_prompt_placeholder: 'What now?',
        expectation_summary: 'The player discovers a narrow lit recess.',
        continuity_summary: 'The niche remains part of the same gate wall.',
        direction_label: 'Study the lantern niche',
        stage_layout: 'focus-left',
        stage_modules: expect.any(Array)
      })
    );
    expect(payload.stage_modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_id: expect.any(String),
          type: 'illustration',
          variant: expect.any(String),
          title: 'Lantern Light',
          caption: expect.any(String),
          image_url: expect.any(String),
          alt_text: expect.any(String)
        }),
        expect.objectContaining({
          module_id: expect.any(String),
          type: 'quote_panel',
          variant: expect.any(String),
          body: 'The wall hums with a faint signal.',
          tone: expect.any(String),
          meta: expect.any(Object)
        })
      ])
    );
  });

  test('normalizeQuestAdvancePlan fills missing text and stage defaults from fallback', () => {
    const plan = normalizeQuestAdvancePlan(
      {
        title: '   Narrow Arch   ',
        stageModules: [
          {
            type: 'illustration',
            title: 'Arch Study'
          }
        ]
      },
      {
        prompt: 'The arch opens into a tighter thread.',
        image_prompt: 'A narrow arch in a weathered wall.',
        direction_label: 'Enter the arch'
      }
    );

    expect(plan).toEqual(
      expect.objectContaining({
        title: 'Narrow Arch',
        prompt: 'The arch opens into a tighter thread.',
        image_prompt: 'A narrow arch in a weathered wall.',
        direction_label: 'Enter the arch',
        stageLayout: expect.any(String),
        stageModules: expect.any(Array)
      })
    );
    expect(plan.stageModules[0]).toEqual(
      expect.objectContaining({
        moduleId: expect.any(String),
        type: 'illustration',
        title: 'Arch Study'
      })
    );
  });
});
