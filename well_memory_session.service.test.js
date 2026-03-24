describe('wellMemorySessionService', () => {
  let service;

  beforeAll(async () => {
    service = await import(`./services/wellMemorySessionService.js?test=${Date.now()}`);
  });

  test('picks an unseen textual fragment when possible', () => {
    const fragment = service.pickNextTextualFragmentFromBank(
      [
        { id: 'txt_1', text: 'First fragment', weight: 1, tags: [] },
        { id: 'txt_2', text: 'Second fragment', weight: 1, tags: [] }
      ],
      ['txt_1']
    );

    expect(fragment.bankId).toBe('txt_2');
    expect(fragment.surface.text).toBe('Second fragment');
  });

  test('marks the session ready for handoff when captured count meets required count', () => {
    const payload = service.buildWellMemorySessionPayload({
      session_id: 'session-1',
      playerId: '',
      status: 'bundle_ready',
      required: { textual: 3 },
      captured: { textual: 3 },
      currentFragment: null,
      bundle: [
        { jotId: '1', fragmentId: 'a', fragmentType: 'textual', rawJotText: 'one' },
        { jotId: '2', fragmentId: 'b', fragmentType: 'textual', rawJotText: 'two' },
        { jotId: '3', fragmentId: 'c', fragmentType: 'textual', rawJotText: 'three' }
      ],
      completedAt: null
    });

    expect(payload.readyForHandoff).toBe(true);
    expect(payload.required.textual).toBe(3);
    expect(payload.captured.textual).toBe(3);
  });

  test('builds a mongo-safe upsert without conflicting required writes', () => {
    const update = service.buildStartWellMemorySessionUpsert('session-1', '', {
      completion: {
        required: {
          textual: 4
        }
      }
    });

    expect(update.$set.required.textual).toBe(4);
    expect(update.$setOnInsert.required).toBeUndefined();
    expect(update.$setOnInsert.status).toBe('observing');
    expect(update.$setOnInsert.captured.textual).toBe(0);
  });
});
