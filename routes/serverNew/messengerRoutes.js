export function registerMessengerRoutes(app, deps) {
  const {
    handleMessengerChatPost,
    normalizeMessengerSceneId,
    resolveMessengerPersistenceMode,
    buildMessengerConversationPayload,
    deleteMessengerConversation,
    deleteMessengerSceneBrief
  } = deps;

  app.get('/api/messenger/chat', async (req, res) => {
    try {
      const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : '';
      const sceneId = normalizeMessengerSceneId(req.query?.sceneId);
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const persistence = await resolveMessengerPersistenceMode();
      const conversation = await buildMessengerConversationPayload(sessionId, sceneId, persistence);
      return res.status(200).json(conversation);
    } catch (error) {
      console.error('Error in GET /api/messenger/chat:', error);
      return res.status(500).json({ message: 'Server error while loading messenger chat.' });
    }
  });

  app.post('/api/messenger/chat', handleMessengerChatPost);
  app.post('/api/sendMessage', handleMessengerChatPost);

  app.delete('/api/messenger/chat', async (req, res) => {
    try {
      const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : '';
      const sceneId = normalizeMessengerSceneId(req.query?.sceneId);
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const persistence = await resolveMessengerPersistenceMode();
      const deletion = await deleteMessengerConversation(sessionId, sceneId, persistence);
      const deletedSceneBriefCount = await deleteMessengerSceneBrief(sessionId, sceneId, persistence);
      return res.status(200).json({
        sessionId,
        sceneId,
        deletedCount: (deletion?.deletedCount || 0) + deletedSceneBriefCount,
        deletedMessagesCount: deletion?.deletedCount || 0,
        deletedSceneBriefCount,
        storage: persistence
      });
    } catch (error) {
      console.error('Error in DELETE /api/messenger/chat:', error);
      return res.status(500).json({ message: 'Server error while clearing messenger chat.' });
    }
  });
}
