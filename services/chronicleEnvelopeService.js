import { randomUUID } from 'crypto';

const EVIDENCE_SOURCES = ['damaged_page', 'society_note', 'field_report', 'player_restoration', 'marginalia'];
const TENDENCIES = ['caution', 'nerve', 'curiosity', 'guile', 'empathy'];
const TENDENCY_CAP = 5;
const RELIABILITY_VALUES = ['confirmed', 'suspect', 'contradicted'];

const slugify = (text) =>
  String(text).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s-]+/g, '_');

function textFieldsOf(mutation) {
  return [mutation.addedText, mutation.text, mutation.label, mutation.predicate, mutation.note]
    .filter((v) => typeof v === 'string');
}

function findForbiddenClaim(mutation, canonLocks) {
  const claims = canonLocks?.forbiddenClaims || [];
  for (const claim of claims) {
    const regex = new RegExp(claim.pattern, 'i');
    for (const field of textFieldsOf(mutation)) {
      if (regex.test(field)) return claim;
    }
  }
  return null;
}

export function scanForbiddenClaims(text, canonLocks) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const claims = canonLocks?.forbiddenClaims || [];
  for (const claim of claims) {
    if (new RegExp(claim.pattern, 'i').test(text)) return claim;
  }
  return null;
}

function checkMutation(mutation, session, batchCellIds) {
  const cellIds = new Set(session.cells.map((c) => c.id));
  const forbidden = findForbiddenClaim(mutation, session.canonLocks);
  if (forbidden) return `forbidden claim: ${forbidden.id} — ${forbidden.note}`;

  switch (mutation.type) {
    case 'grow_cell':
      if (!cellIds.has(mutation.cellId)) return `unknown cell: ${mutation.cellId}`;
      if (typeof mutation.addedText !== 'string' || !mutation.addedText.trim()) return 'grow_cell requires addedText';
      return null;
    case 'create_cell': {
      if (typeof mutation.label !== 'string' || !mutation.label.trim()) return 'create_cell requires label';
      const slug = slugify(mutation.label);
      if (!slug) return `create_cell label produces an empty id: "${mutation.label}"`;
      const badLink = (mutation.links || []).find((id) => !cellIds.has(id));
      if (badLink) return `unknown cell: ${badLink}`;
      if (cellIds.has(slug) || batchCellIds.has(slug)) return `cell already exists: ${slug}`;
      return null;
    }
    case 'link_cells':
      if (!cellIds.has(mutation.from)) return `unknown cell: ${mutation.from}`;
      if (!cellIds.has(mutation.to)) return `unknown cell: ${mutation.to}`;
      if (typeof mutation.predicate !== 'string' || !mutation.predicate.trim()) return 'link_cells requires predicate';
      return null;
    case 'create_evidence':
      if (!EVIDENCE_SOURCES.includes(mutation.source)) return `invalid evidence source: ${mutation.source}`;
      if (mutation.reliability !== undefined && !RELIABILITY_VALUES.includes(mutation.reliability)) {
        return `invalid reliability: ${mutation.reliability}`;
      }
      if (typeof mutation.text !== 'string' || !mutation.text.trim()) return 'create_evidence requires text';
      return null;
    case 'increase_pressure':
      if (!(mutation.source in (session.pressure?.sources || {}))) return `unknown pressure source: ${mutation.source}`;
      if (!Number.isFinite(Number(mutation.amount)) || Number(mutation.amount) <= 0) return 'increase_pressure requires positive amount';
      return null;
    case 'infer_character':
      if (!TENDENCIES.includes(mutation.tendency)) return `unknown tendency: ${mutation.tendency}`;
      if (!Number.isFinite(Number(mutation.amount)) || Number(mutation.amount) <= 0) return 'infer_character requires positive amount';
      return null;
    default:
      return `unknown mutation type: ${mutation.type}`;
  }
}

export function validateEnvelope(envelope, session, { voiceOnly = false } = {}) {
  const narration = typeof envelope?.narration === 'string' ? envelope.narration : '';
  const societyNote = typeof envelope?.societyNote === 'string' ? envelope.societyNote : '';
  const mutations = Array.isArray(envelope?.mutations) ? envelope.mutations : [];
  const accepted = [];
  const rejected = [];
  const batchCellIds = new Set();

  for (const mutation of mutations) {
    if (voiceOnly) {
      rejected.push({ mutation, reason: 'voice-only envelope: mutations are not allowed in this act' });
      continue;
    }
    const reason = checkMutation(mutation, session, batchCellIds);
    if (reason) rejected.push({ mutation, reason });
    else {
      if (mutation.type === 'create_cell') batchCellIds.add(slugify(mutation.label));
      accepted.push(mutation);
    }
  }

  return { narration, societyNote, accepted, rejected };
}

export function applyEnvelope(session, accepted, { actor }) {
  if (actor !== 'player' && actor !== 'gm') {
    throw new Error(`applyEnvelope requires actor 'player' or 'gm', got: ${actor}`);
  }

  for (const mutation of accepted) {
    switch (mutation.type) {
      case 'grow_cell': {
        const cell = session.cells.find((c) => c.id === mutation.cellId);
        cell.text = `${cell.text} ${mutation.addedText}`.trim();
        if (actor === 'player') {
          cell.playerContributions.push(mutation.addedText);
          cell.state = 'restored';
        } else {
          cell.state = 'mutated';
        }
        break;
      }
      case 'create_cell': {
        session.cells.push({
          id: slugify(mutation.label),
          label: mutation.label,
          state: actor === 'player' ? 'restored' : 'mutated',
          text: typeof mutation.text === 'string' ? mutation.text : '',
          playerContributions: [],
          links: (mutation.links || []).map((toCellId) => ({
            toCellId, predicate: 'relates to', createdBy: actor
          })),
          gmHooks: {}
        });
        break;
      }
      case 'link_cells': {
        const cell = session.cells.find((c) => c.id === mutation.from);
        cell.links.push({ toCellId: mutation.to, predicate: mutation.predicate, createdBy: actor });
        break;
      }
      case 'create_evidence': {
        session.evidence.push({
          id: randomUUID(),
          source: mutation.source,
          text: mutation.text,
          reliability: mutation.reliability || 'suspect',
          linkedCells: Array.isArray(mutation.linkedCells) ? mutation.linkedCells : []
        });
        break;
      }
      case 'increase_pressure': {
        const amount = Number(mutation.amount);
        session.pressure.sources[mutation.source] += amount;
        session.pressure.value += amount;
        break;
      }
      case 'infer_character': {
        const current = session.character.tendencies[mutation.tendency];
        session.character.tendencies[mutation.tendency] = Math.min(TENDENCY_CAP, current + Number(mutation.amount));
        if (typeof mutation.note === 'string' && mutation.note.trim()) {
          session.character.notes.push(mutation.note.trim());
        }
        break;
      }
      default:
        throw new Error(`applyEnvelope received unvalidated mutation type: ${mutation.type}`);
    }
  }
  return session;
}
