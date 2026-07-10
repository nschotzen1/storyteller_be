import { createChronicle, getChronicle } from '../../services/chronicleSessionService.js';

export function buildStateView(session) {
  const { chronicleId, act, recoveredFacts, character, evidence, cells, pressure, transcript } = session;
  return {
    chronicleId,
    act,
    recoveredFacts,
    character,
    evidence,
    cells: cells.map(({ gmHooks, ...cell }) => cell),
    pressure: { value: pressure.value, threshold: pressure.threshold },
    transcript
  };
}

export function registerChronicleRoutes(app) {
  app.post('/api/chronicle/early-dusk/start', async (req, res) => {
    try {
      const session = await createChronicle();
      res.status(201).json({ chronicleId: session.chronicleId, act: session.act });
    } catch (error) {
      console.error('chronicle start failed:', error);
      res.status(500).json({ error: 'failed to start chronicle' });
    }
  });

  app.get('/api/chronicle/:id/state', async (req, res) => {
    try {
      const session = await getChronicle(req.params.id);
      if (!session) {
        res.status(404).json({ error: `chronicle not found: ${req.params.id}` });
        return;
      }
      res.json(buildStateView(session));
    } catch (error) {
      console.error('chronicle state failed:', error);
      res.status(500).json({ error: 'failed to load chronicle state' });
    }
  });
}
