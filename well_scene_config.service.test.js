import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('wellSceneConfigService', () => {
  let service;
  let configPath;

  beforeAll(async () => {
    configPath = path.join(os.tmpdir(), `well-scene-config-${Date.now()}.json`);
    process.env.WELL_SCENE_CONFIG_PATH = configPath;
    service = await import(`./services/wellSceneConfigService.js?test=${Date.now()}`);
  });

  afterAll(async () => {
    await fs.rm(configPath, { force: true }).catch(() => {});
    delete process.env.WELL_SCENE_CONFIG_PATH;
  });

  test('normalizes and persists the shared well config', async () => {
    const saved = await service.saveWellSceneConfig({
      component: {
        wordLimit: 14,
        promptDock: 'bottom',
        fragmentSpawnMs: 2500
      },
      copy: {
        promptLabel: 'What words do you remember?',
        departureStatus: 'The falcon climbs into the rose court.',
        handoffLabel: 'Hand the gathered bundle over'
      },
      completion: {
        required: {
          textual: 4
        }
      },
      banks: {
        textual: ['One line rises', 'Second line follows']
      }
    }, 'test-agent');

    expect(saved.component.wordLimit).toBe(14);
    expect(saved.component.promptDock).toBe('bottom');
    expect(saved.copy.promptLabel).toBe('What words do you remember?');
    expect(saved.copy.handoffLabel).toBe('Hand the gathered bundle over');
    expect(saved.fragments).toEqual(['One line rises', 'Second line follows']);
    expect(saved.banks.textual).toHaveLength(2);
    expect(saved.completion.required.textual).toBe(4);
    expect(saved.updatedBy).toBe('test-agent');
    expect(saved.updatedAt).toEqual(expect.any(String));

    const loaded = await service.loadWellSceneConfig();
    expect(loaded.component.fragmentSpawnMs).toBe(2500);
    expect(loaded.copy.departureStatus).toBe('The falcon climbs into the rose court.');
    expect(loaded.banks.textual).toHaveLength(2);
    expect(loaded.completion.required.textual).toBe(4);
  });

  test('falls back to defaults when fragment bank is empty', () => {
    const normalized = service.normalizeWellSceneConfig({
      banks: {
        textual: []
      },
      component: {
        wordLimit: 999
      }
    });

    expect(normalized.banks.textual.length).toBeGreaterThan(0);
    expect(normalized.fragments.length).toBeGreaterThan(0);
    expect(normalized.component.wordLimit).toBe(30);
  });
});
