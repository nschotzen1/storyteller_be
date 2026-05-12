function toPlainObject(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    return doc.toObject();
  }
  return JSON.parse(JSON.stringify(doc));
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeTaskPrivacy(value, fallback = 'session') {
  const normalized = firstNonEmptyString(value).toLowerCase();
  return ['public', 'session', 'private'].includes(normalized) ? normalized : fallback;
}

function normalizeTaskTarget(value, fallback = null) {
  const source = value && typeof value === 'object' ? value : {};
  const existing = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    type: firstNonEmptyString(source.type, existing.type),
    id: firstNonEmptyString(source.id, existing.id),
    label: firstNonEmptyString(source.label, existing.label)
  };
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return Array.isArray(fallback) ? [...fallback] : [];
  }
  return value
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim());
}

function normalizeKnownEntityIds(value, fallback = []) {
  return normalizeStringArray(value, fallback);
}

function normalizeMetaObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }
  return fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ? { ...fallback }
    : {};
}

function normalizeAssignmentStatus(value, fallback = 'assigned') {
  const normalized = firstNonEmptyString(value).toLowerCase();
  return ['assigned', 'active', 'completed', 'failed', 'canceled'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeAssigneeType(value, fallback = 'storyteller') {
  return firstNonEmptyString(value, fallback) || 'storyteller';
}

export function registerTaskRoutes(app, deps) {
  const {
    Task,
    TaskAssignment,
    buildTaskAccessQuery,
    findTaskById,
    normalizeOptionalPlayerId,
    sendLlmAwareError
  } = deps;

  app.get('/api/tasks', async (req, res) => {
    try {
      const {
        sessionId,
        playerId,
        privacy,
        targetType,
        targetId,
        tag,
        limit,
        sort
      } = req.query;

      const query = buildTaskAccessQuery(sessionId, playerId);
      if (privacy) query.privacy = normalizeTaskPrivacy(privacy, '');
      if (targetType) query['target.type'] = String(targetType).trim();
      if (targetId) query['target.id'] = String(targetId).trim();
      if (tag) query.tags = { $regex: String(tag).trim(), $options: 'i' };

      const safeLimit = Number.isFinite(Number(limit))
        ? Math.max(1, Math.min(200, Math.floor(Number(limit))))
        : 0;
      const normalizedSort = firstNonEmptyString(sort).toLowerCase();
      const sortSpec = normalizedSort === 'title'
        ? { title: 1, createdAt: -1 }
        : { createdAt: -1 };

      let tasksQuery = Task.find(query).sort(sortSpec);
      if (safeLimit) {
        tasksQuery = tasksQuery.limit(safeLimit);
      }

      const tasks = await tasksQuery.exec();
      return res.status(200).json({
        sessionId: firstNonEmptyString(sessionId),
        playerId: normalizeOptionalPlayerId(playerId),
        count: tasks.length,
        tasks: tasks.map(toPlainObject)
      });
    } catch (error) {
      console.error('Error in GET /api/tasks:', error);
      return sendLlmAwareError(res, error, 'Server error during task listing.', 'message');
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const body = req.body || {};
      const title = firstNonEmptyString(body.title);
      const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
      const privacy = normalizeTaskPrivacy(body.privacy);
      const sessionId = firstNonEmptyString(body.sessionId);
      const playerId = normalizeOptionalPlayerId(body.playerId);
      const target = normalizeTaskTarget(body.target);

      if (!title) {
        return res.status(400).json({ message: 'Task title is required.' });
      }
      if (!target.type) {
        return res.status(400).json({ message: 'Task target.type is required.' });
      }

      const task = await Task.create({
        taskId: firstNonEmptyString(body.taskId) || undefined,
        title,
        brief,
        privacy,
        sessionId,
        playerId,
        target,
        knownEntityIds: normalizeKnownEntityIds(body.knownEntityIds),
        tags: normalizeStringArray(body.tags),
        meta: normalizeMetaObject(body.meta)
      });

      return res.status(201).json({ task: toPlainObject(task) });
    } catch (error) {
      console.error('Error in POST /api/tasks:', error);
      return sendLlmAwareError(res, error, 'Server error during task creation.', 'message');
    }
  });

  app.get('/api/tasks/:id', async (req, res) => {
    try {
      const task = await findTaskById(req.query.sessionId, req.query.playerId, req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found.' });
      }
      return res.status(200).json({ task: toPlainObject(task) });
    } catch (error) {
      console.error('Error in GET /api/tasks/:id:', error);
      return sendLlmAwareError(res, error, 'Server error during task fetch.', 'message');
    }
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const task = await findTaskById(req.body?.sessionId, req.body?.playerId, req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found.' });
      }

      const body = req.body || {};
      if (body.title !== undefined) {
        const title = firstNonEmptyString(body.title);
        if (!title) {
          return res.status(400).json({ message: 'Task title cannot be empty.' });
        }
        task.title = title;
      }
      if (body.brief !== undefined) {
        task.brief = typeof body.brief === 'string' ? body.brief.trim() : '';
      }
      if (body.privacy !== undefined) {
        task.privacy = normalizeTaskPrivacy(body.privacy, task.privacy);
      }
      if (body.sessionId !== undefined) {
        task.sessionId = firstNonEmptyString(body.sessionId);
      }
      if (body.playerId !== undefined) {
        task.playerId = normalizeOptionalPlayerId(body.playerId);
      }
      if (body.target !== undefined) {
        const target = normalizeTaskTarget(body.target, task.target);
        if (!target.type) {
          return res.status(400).json({ message: 'Task target.type is required.' });
        }
        task.target = target;
      }
      if (body.knownEntityIds !== undefined) {
        task.knownEntityIds = normalizeKnownEntityIds(body.knownEntityIds, task.knownEntityIds);
      }
      if (body.tags !== undefined) {
        task.tags = normalizeStringArray(body.tags);
      }
      if (body.meta !== undefined) {
        task.meta = normalizeMetaObject(body.meta);
      }

      await task.save();
      return res.status(200).json({ task: toPlainObject(task) });
    } catch (error) {
      console.error('Error in PATCH /api/tasks/:id:', error);
      return sendLlmAwareError(res, error, 'Server error during task update.', 'message');
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const task = await findTaskById(req.query.sessionId, req.query.playerId, req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found.' });
      }

      await TaskAssignment.deleteMany({ taskId: task._id });
      await task.deleteOne();

      return res.status(200).json({
        deleted: true,
        taskId: task.taskId,
        id: String(task._id)
      });
    } catch (error) {
      console.error('Error in DELETE /api/tasks/:id:', error);
      return sendLlmAwareError(res, error, 'Server error during task deletion.', 'message');
    }
  });

  app.get('/api/task-assignments', async (req, res) => {
    try {
      const {
        sessionId,
        playerId,
        taskId,
        assigneeType,
        assigneeId,
        status,
        limit
      } = req.query;

      if (!sessionId && !taskId && !assigneeId) {
        return res.status(400).json({ message: 'Provide at least sessionId, taskId, or assigneeId.' });
      }

      const query = {};
      if (taskId) {
        const task = await findTaskById(sessionId, playerId, taskId);
        if (!task) {
          return res.status(404).json({ message: 'Task not found.' });
        }
        query.taskId = task._id;
      }
      if (sessionId) {
        query.sessionId = firstNonEmptyString(sessionId);
      }
      if (assigneeType) {
        query.assigneeType = normalizeAssigneeType(assigneeType);
      }
      if (assigneeId) {
        query.assigneeId = firstNonEmptyString(assigneeId);
      }
      if (status) {
        query.status = normalizeAssignmentStatus(status, '');
      }

      const safeLimit = Number.isFinite(Number(limit))
        ? Math.max(1, Math.min(200, Math.floor(Number(limit))))
        : 0;

      let assignmentQuery = TaskAssignment.find(query).sort({ assignedAt: -1, createdAt: -1 });
      if (safeLimit) {
        assignmentQuery = assignmentQuery.limit(safeLimit);
      }

      const assignments = await assignmentQuery.exec();
      return res.status(200).json({
        sessionId: firstNonEmptyString(sessionId),
        count: assignments.length,
        assignments: assignments.map(toPlainObject)
      });
    } catch (error) {
      console.error('Error in GET /api/task-assignments:', error);
      return sendLlmAwareError(res, error, 'Server error during task assignment listing.', 'message');
    }
  });

  app.post('/api/task-assignments', async (req, res) => {
    try {
      const body = req.body || {};
      const task = await findTaskById(body.sessionId, body.playerId, body.taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found.' });
      }

      const assigneeId = firstNonEmptyString(body.assigneeId);
      if (!assigneeId) {
        return res.status(400).json({ message: 'Task assignment assigneeId is required.' });
      }

      const sessionId = firstNonEmptyString(body.sessionId, task.sessionId);
      if (!sessionId) {
        return res.status(400).json({ message: 'Task assignments require a sessionId.' });
      }

      const assignment = await TaskAssignment.create({
        taskId: task._id,
        sessionId,
        assigneeType: normalizeAssigneeType(body.assigneeType),
        assigneeId,
        status: normalizeAssignmentStatus(body.status),
        assignedAt: body.assignedAt ? new Date(body.assignedAt) : undefined,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        resultSummary: typeof body.resultSummary === 'string' ? body.resultSummary.trim() : '',
        gmNote: typeof body.gmNote === 'string' ? body.gmNote.trim() : '',
        meta: normalizeMetaObject(body.meta)
      });

      return res.status(201).json({ assignment: toPlainObject(assignment) });
    } catch (error) {
      console.error('Error in POST /api/task-assignments:', error);
      return sendLlmAwareError(res, error, 'Server error during task assignment creation.', 'message');
    }
  });

  app.get('/api/task-assignments/:id', async (req, res) => {
    try {
      const query = { _id: req.params.id };
      if (req.query.sessionId) {
        query.sessionId = firstNonEmptyString(req.query.sessionId);
      }
      const assignment = await TaskAssignment.findOne(query);
      if (!assignment) {
        return res.status(404).json({ message: 'Task assignment not found.' });
      }
      return res.status(200).json({ assignment: toPlainObject(assignment) });
    } catch (error) {
      console.error('Error in GET /api/task-assignments/:id:', error);
      return sendLlmAwareError(res, error, 'Server error during task assignment fetch.', 'message');
    }
  });

  app.patch('/api/task-assignments/:id', async (req, res) => {
    try {
      const query = { _id: req.params.id };
      if (req.body?.sessionId) {
        query.sessionId = firstNonEmptyString(req.body.sessionId);
      }
      const assignment = await TaskAssignment.findOne(query);
      if (!assignment) {
        return res.status(404).json({ message: 'Task assignment not found.' });
      }

      const body = req.body || {};
      if (body.assigneeType !== undefined) {
        assignment.assigneeType = normalizeAssigneeType(body.assigneeType, assignment.assigneeType);
      }
      if (body.assigneeId !== undefined) {
        const assigneeId = firstNonEmptyString(body.assigneeId);
        if (!assigneeId) {
          return res.status(400).json({ message: 'Task assignment assigneeId cannot be empty.' });
        }
        assignment.assigneeId = assigneeId;
      }
      if (body.status !== undefined) {
        assignment.status = normalizeAssignmentStatus(body.status, assignment.status);
      }
      if (body.assignedAt !== undefined) {
        assignment.assignedAt = body.assignedAt ? new Date(body.assignedAt) : assignment.assignedAt;
      }
      if (body.completedAt !== undefined) {
        assignment.completedAt = body.completedAt ? new Date(body.completedAt) : null;
      }
      if (body.resultSummary !== undefined) {
        assignment.resultSummary = typeof body.resultSummary === 'string' ? body.resultSummary.trim() : '';
      }
      if (body.gmNote !== undefined) {
        assignment.gmNote = typeof body.gmNote === 'string' ? body.gmNote.trim() : '';
      }
      if (body.meta !== undefined) {
        assignment.meta = normalizeMetaObject(body.meta);
      }

      await assignment.save();
      return res.status(200).json({ assignment: toPlainObject(assignment) });
    } catch (error) {
      console.error('Error in PATCH /api/task-assignments/:id:', error);
      return sendLlmAwareError(res, error, 'Server error during task assignment update.', 'message');
    }
  });

  app.delete('/api/task-assignments/:id', async (req, res) => {
    try {
      const query = { _id: req.params.id };
      if (req.query.sessionId) {
        query.sessionId = firstNonEmptyString(req.query.sessionId);
      }
      const assignment = await TaskAssignment.findOne(query);
      if (!assignment) {
        return res.status(404).json({ message: 'Task assignment not found.' });
      }

      await assignment.deleteOne();
      return res.status(200).json({
        deleted: true,
        id: String(assignment._id)
      });
    } catch (error) {
      console.error('Error in DELETE /api/task-assignments/:id:', error);
      return sendLlmAwareError(res, error, 'Server error during task assignment deletion.', 'message');
    }
  });
}
