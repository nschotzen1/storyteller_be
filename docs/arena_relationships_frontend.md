# Connect Entities — Frontend Specification

UI/UX specification for the Arena Relationships feature.

---

## Overview

Players connect entity cards in the arena by drawing relationships between them. The system judges each connection and awards points for accepted relationships.

---

## Core Components

### 1. ArenaGraph
Main canvas displaying cards and edges.

```
┌─────────────────────────────────────────────────────────┐
│                      ARENA GRAPH                        │
│                                                         │
│    ┌─────────┐                      ┌─────────┐        │
│    │  Card A │──────"haunts"───────▶│  Card B │        │
│    └─────────┘                      └─────────┘        │
│         │                                               │
│         │ "emanates from"                               │
│         ▼                                               │
│    ┌─────────┐                                         │
│    │  Card C │                                         │
│    └─────────┘                                         │
│                                                         │
│                          [Score: 32 pts]               │
└─────────────────────────────────────────────────────────┘
```

**State:**
```typescript
interface ArenaGraphState {
  cards: CardPlacement[];
  edges: Edge[];
  scores: Record<string, number>;
  selectedCard: string | null;
  connectionMode: 'idle' | 'selecting_target' | 'entering_text';
  pendingConnection: {
    sourceId: string;
    targetId: string | null;
  } | null;
}
```

---

### 2. CardNode
Individual entity card in the arena.

**Props:**
```typescript
interface CardNodeProps {
  card: EntityCard;
  isSelected: boolean;
  isConnectionSource: boolean;
  isConnectionTarget: boolean;
  connectedEdges: Edge[];
  onSelect: () => void;
  onStartConnection: () => void;
}
```

**Visual States:**
| State | Appearance |
|-------|------------|
| Default | Normal card display |
| Selected | Blue glow border |
| Connection Source | Pulsing golden outline |
| Valid Target | Green dashed border |
| Has Edges | Small badge showing edge count |

---

### 3. EdgeLine
Visual connection between two cards.

**Props:**
```typescript
interface EdgeLineProps {
  edge: Edge;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  isNew: boolean;  // For animation
}
```

**Rendering:**
- Curved line using SVG path or canvas
- Arrow at target end
- Label showing `surfaceText` (truncated if long)
- Color based on quality score:
  - `score >= 0.7` → green
  - `score >= 0.5` → yellow
  - `score < 0.5` → red/grey

---

### 4. RelationshipInput
Modal/popover for entering relationship text.

```
┌─────────────────────────────────────────┐
│  Connect "Miri Lights" → "Oak Plateau"  │
├─────────────────────────────────────────┤
│                                         │
│  Describe the relationship:             │
│  ┌─────────────────────────────────┐   │
│  │ sometimes seen at               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Preview: ✓ Would be accepted (0.75)   │
│                                         │
│  [Cancel]              [Create Link]    │
└─────────────────────────────────────────┘
```

**Features:**
- Live validation as user types (debounced `/validate` calls)
- Show quality preview
- Suggest predicates if rejected
- Character counter (encourage >10 chars)

---

### 5. ScoreDisplay
Shows player's current points.

```typescript
interface ScoreDisplayProps {
  playerScore: number;
  recentPoints?: { awarded: number; timestamp: number };
}
```

**Animations:**
- "+16" floats up when points awarded
- Score counter animates from old → new value

---

## User Flow

### Creating a Relationship

```
1. SELECT SOURCE
   User clicks/taps a card
   → Card shows "Connect" button or drag handle

2. SELECT TARGET  
   User clicks another card OR drags line to target
   → Valid targets highlight with green border
   → Invalid targets (same card, already connected) greyed out

3. ENTER RELATIONSHIP
   RelationshipInput modal appears
   → User types relationship phrase
   → Live preview via /validate endpoint
   → Show suggestions if rejected

4. SUBMIT
   User clicks "Create Link"
   → Call POST /api/arena/relationships/propose
   → Handle response

5. ANIMATE RESULT
   If accepted:
     → Draw edge with animation (line extends from source to target)
     → Show "+16 points" floater
     → Pulse affected cards (evolution.affected)
   If rejected:
     → Shake input field
     → Show rejection reason
     → Display suggestion chips
   If duplicate:
     → Highlight existing edge
     → Show "Already connected" message
```

---

## API Integration

### Load Arena State

On mount and after changes:
```typescript
async function loadArenaState(sessionId: string, playerId: string) {
  const response = await fetch(
    `/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`
  );
  const data = await response.json();
  
  setCards(data.arena.entities);
  setEdges(data.edges);
  setScores(data.scores);
}
```

### Validate Relationship (Preview)

Debounce while user types:
```typescript
const validateRelationship = useDebouncedCallback(async (text: string) => {
  if (text.length < 3) return;
  
  const response = await fetch('/api/arena/relationships/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId, playerId,
      source: { cardId: sourceId },
      targets: [{ cardId: targetId }],
      relationship: { surfaceText: text },
      debug: isDevelopment
    })
  });
  
  const result = await response.json();
  setPreviewResult(result);
}, 300);
```

### Create Relationship

```typescript
async function createRelationship(surfaceText: string) {
  setIsSubmitting(true);
  
  const response = await fetch('/api/arena/relationships/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId, playerId,
      source: { cardId: sourceId },
      targets: [{ cardId: targetId }],
      relationship: { surfaceText }
    })
  });
  
  if (response.status === 409) {
    const { existingEdge } = await response.json();
    highlightEdge(existingEdge.edgeId);
    showToast('This connection already exists');
    return;
  }
  
  const result = await response.json();
  
  if (result.verdict === 'accepted') {
    addEdge(result.edge);
    animatePoints(result.points.awarded);
    setScores(prev => ({
      ...prev,
      [playerId]: result.points.playerTotal
    }));
    closeModal();
  } else {
    showRejection(result.quality.reasons, result.suggestions);
  }
  
  setIsSubmitting(false);
}
```

---

## Visual Design

### Edge Styling
```css
.edge-line {
  stroke-width: 2px;
  fill: none;
  transition: stroke 0.3s ease;
}

.edge-line--high-quality { stroke: #22c55e; }  /* green */
.edge-line--medium-quality { stroke: #eab308; } /* yellow */
.edge-line--low-quality { stroke: #6b7280; }    /* grey */

.edge-label {
  font-size: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
}
```

### Connection Mode
```css
.card--connection-source {
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.6);
  animation: pulse 1.5s infinite;
}

.card--valid-target {
  border: 2px dashed #22c55e;
}

.card--invalid-target {
  opacity: 0.5;
  pointer-events: none;
}
```

### Points Animation
```css
@keyframes float-up {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-40px); }
}

.points-floater {
  animation: float-up 1.5s ease-out forwards;
  font-size: 24px;
  font-weight: bold;
  color: #22c55e;
}
```

---

## Error Handling

| Scenario | UI Response |
|----------|-------------|
| Network failure | Toast: "Connection failed. Retry?" with retry button |
| 400 Bad Request | Show inline validation error |
| 409 Duplicate | Highlight existing edge, show message |
| 500 Server Error | Toast: "Something went wrong. Please try again." |
| Rejected relationship | Show reasons + suggestion chips |

---

## Accessibility

- Edges should be keyboard-navigable (Tab through cards, Enter to select)
- Screen reader announces: "Connect [Source] to [Target]"
- Color-blind safe: use icons alongside colors (✓ for accepted, ✗ for rejected)
- Relationship input autofocuses when modal opens

---

## Performance

- Debounce validation requests (300ms)
- Use `requestAnimationFrame` for edge line animations
- Virtualize card list if >50 cards
- Memoize edge line calculations
