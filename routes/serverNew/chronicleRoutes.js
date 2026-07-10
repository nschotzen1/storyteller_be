import { createChronicle, getChronicle, saveChronicle, ACTS } from '../../services/chronicleSessionService.js';
import { runRitualStart, applyRitualAnswer, getPendingQuestion } from '../../services/chronicleRitualService.js';

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
      const opening = await runRitualStart(session);
      await saveChronicle(session);
      res.status(201).json({
        chronicleId: session.chronicleId,
        act: session.act,
        messages: opening.messages,
        question: opening.question
      });
    } catch (error) {
      console.error('chronicle start failed:', error);
      res.status(500).json({ error: 'failed to start chronicle' });
    }
  });

  app.post('/api/chronicle/:id/chat/respond', async (req, res) => {
    try {
      const session = await getChronicle(req.params.id);
      if (!session) {
        res.status(404).json({ error: `chronicle not found: ${req.params.id}` });
        return;
      }
      if (session.act !== ACTS.SOCIETY_CHAT) {
        res.status(409).json({ error: `chat is closed: session is in act ${session.act}` });
        return;
      }
      const { choiceId, freeText } = req.body || {};
      const result = await applyRitualAnswer(session, { choiceId, freeText });
      await saveChronicle(session);
      res.json(result);
    } catch (error) {
      if (error.code === 'UNKNOWN_CHOICE' || error.code === 'INVALID_RITUAL_STATE') {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('chronicle chat respond failed:', error);
      res.status(500).json({ error: 'failed to advance the ritual' });
    }
  });

  app.get('/api/chronicle/:id/state', async (req, res) => {
    try {
      const session = await getChronicle(req.params.id);
      if (!session) {
        res.status(404).json({ error: `chronicle not found: ${req.params.id}` });
        return;
      }
      const view = buildStateView(session);
      view.pendingQuestion = await getPendingQuestion(session);
      res.json(view);
    } catch (error) {
      console.error('chronicle state failed:', error);
      res.status(500).json({ error: 'failed to load chronicle state' });
    }
  });
}
