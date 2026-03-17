# Mock Vision Playthrough

Session: `vision-flow-1773355563909`

Raw payloads: [/Users/shlomo.chotzen/Documents/GitHub/game/storyteller_be/outputs/vision-flow-1773355563909](/Users/shlomo.chotzen/Documents/GitHub/game/storyteller_be/outputs/vision-flow-1773355563909)

## Component Map

| Beat | Current component | API surface | Prompt pipeline | Runtime |
| --- | --- | --- | --- | --- |
| Messenger intake | `Messanger.jsx` | `GET/POST /api/messenger/chat` | `messenger_chat` | anthropic/claude-opus-4-6 |
| Immersive intrusion scene | `ImmersiveRpgPage.jsx` | `GET /api/immersive-rpg/scene; POST /api/immersive-rpg/chat; POST /api/immersive-rpg/rolls` | `immersive_rpg_gm` | anthropic/claude-opus-4-6 |
| Ghostwriter typewriter | `TypewriterFramework.jsx` | `POST /api/typewriter/session/start; POST /api/shouldGenerateContinuation; POST /api/send_typewriter_text` | `story_continuation` | openai/gpt-5-mini |
| Storyteller key emergence | `TypewriterFramework.jsx` | `POST /api/shouldCreateStorytellerKey; POST /api/send_storyteller_typewriter_text` | `storyteller_intervention` | openai/gpt-5-mini |
| Tactical branch stand-in | `QuestAdventurePage.jsx` | `GET /api/quest/screens; POST /api/quest/advance` | `quest_generation` | openai/gpt-5-mini |
| Satchel / cards stand-in | `MemorySpreadPage.jsx` | `POST /api/fragmentToMemories; POST /api/textToEntity` | `memory_creation` | openai/gpt-5-mini |

## Playthrough

### 1. Messenger: "Where can the machine disappear?"

PC move:
- Opens the messenger thread and answers with a harbor attic room.
- Reveals a believable hiding place inside a cedar wardrobe with a false back.

APIs touched:
- `GET /api/messenger/chat`
- `POST /api/messenger/chat` twice

Current mock reply, turn 1:
> Excellent. We are beginning to see the room properly now. One final practical matter: if the typewriter had to vanish at short notice, where exactly would you conceal it, and what in that place would keep it safe from idle hands?

Current mock reply, final turn:
> Splendid. That will do very nicely. I have noted the room, the atmosphere, and the discreet means by which the machine may disappear should the need arise. The Society shall make its arrangements, and if anyone asks, we were never here.

Structured scene brief persisted for the next scene:
- Subject: Harbor attic watchroom
- Place: Attic room above the harbor
- Hiding spot: Inside the cedar wardrobe with the false back, where the machine can disappear quickly and remain dry, ordinary, and out of casual reach.
- Sensory anchors: salt wind through the sash, harbor bells below, cold damp in the rafters

Why this fits your vision:
- This component already does the exact "cunning Society extracts the home layout" beat.
- It persists a scene brief that the immersive RPG scene can consume.

### 2. Immersive RPG: the stranger, the journal, the intrusion

PC move:
- Stays low and tries to retrieve the fallen journal unnoticed.
- Resolves the pending roll.
- Returns home and inspects the damaged space plus the hidden nook.

APIs touched:
- `GET /api/immersive-rpg/scene`
- `POST /api/immersive-rpg/chat`
- `POST /api/immersive-rpg/rolls`
- `POST /api/immersive-rpg/chat`

Bootstrapped opener:
> You are close enough to Attic room above the harbor to feel its ordinary safety pulling at you, and that is exactly why the sight ahead feels wrong. A salt-marked attic room hangs above the harbor with a rain-streaked window, a narrow work surface, and weather pressing at the glass. It feels private, habitable, and immediately stageable as the sort of place where a secret machine could begin its work. A stranger, plain enough not to draw attention at first glance, is searching the ground with a private urgency they are trying to keep under control. Their focus leaves you unseen for the moment. Off to one side, half-screened by the terrain, lies what looks like a fallen journal. You have the better angle. PC can stay hidden for a heartbeat longer. The air carries salt wind through the sash, harbor bells below, cold damp in the rafters. What do you do?

After the journal attempt:
> You ease toward the fallen journal, but this is not a clean movement. The stranger is too near, the ground too uncertain, and the moment too narrow. Roll 5d6 Awareness. Count 5s and 6s as successes. You need 2 successes to reach the journal, see enough of it, and stay unnoticed. If you hesitate much longer, the chance will close. What do you do?

Roll resolution:
> You move, and the movement is enough. The stranger turns just before you can manage the journal cleanly. The urgency leaves their face so quickly it becomes theatrical. "No trouble," they seem to suggest without quite saying it, but the performance comes a second too late. They were looking for something, and now they know you know it. What do you do?

Home inspection follow-up:
> You break from the moment and head inside. The familiarity of home does not survive the threshold intact. Something is fractionally wrong: an object displaced, a scent that does not belong to you, the quiet aftermath of someone patient searching where they should not have been. The nook where you sometimes leave groceries remains untouched. What do you do?

Notebook / stage evidence:
- Current beat after first chat: `journal_attempt`
- Pending roll label: Retrieve the journal unnoticed
- Stage modules in opener: 3

Why this fits your vision:
- Scene 3 is already very close to your described home-return / stranger / journal / package sequence.
- The GM prompt explicitly encodes the hidden nook, the journal, the pen, and the blank cards.

### 3. Typewriter: ghost text, fade logic, and the first intrusion

PC move:
- Seeds the typewriter with: "It was almost night as I set the typewriter on the scarred oak table, the page already fed, harbor bells below the attic window speaking to…"
- Pauses long enough for the ghostwriter gate to evaluate.
- Triggers a mock continuation.

APIs touched:
- `POST /api/typewriter/session/start`
- `POST /api/shouldGenerateContinuation`
- `POST /api/send_typewriter_text`

Ghostwriter gate:
- shouldGenerate: `true`

Mock continuation:
> as the pass fell quiet and every footstep sounded borrowed.

Ghostwriter insights:
- Words added: 10
- Meaning: n/a

Important current mechanic note:
- The UI does ask the backend before ghostwriting.
- The fade sequence and timing payload already exist.
- The dedicated `THE XEROFAG` key is present in the keyboard UI, but today it inserts text unconditionally rather than only when context permits it.

### 4. Storyteller key emergence: the "other observer" stand-in

PC move:
- Writes enough text to cross the storyteller threshold.
- A storyteller slot is checked and filled.
- The storyteller key is activated to inject a new observer voice.

APIs touched:
- `POST /api/shouldCreateStorytellerKey`
- `POST /api/send_storyteller_typewriter_text`

Storyteller slot check:
- Created: `true`
- Narrative word count: 41
- Assigned storyteller count: 1

Intervention summary:
- Storyteller: The Pass-Archivist of Yuradel
- New entity key: Buraha Light
- Continuation excerpt: "It was then that I, The Pass-Archivist of Yuradel, admitted myself to the margin of the scene. I had been near enough to witness the change, and nearer still when Buraha Light-Wake revealed itself inside it: not a thing…"

Why this is the closest current stand-in for your "new character writes in another voice" beat:
- The observer does arrive as a separate narrative voice.
- The intervention also creates a new entity/key for later use.
- What is still missing is your exact "glyph key flips the page into first-person investigator mode" presentation.

### 5. Tactical quest stand-in: branch generation exists, but continuity does not

PC move:
- Uses the quest prompt box to improvise an escape branch.

APIs touched:
- `GET /api/quest/screens`
- `POST /api/quest/advance`

Quest state:
- Start screen id: `outer_gate_murals`
- Mock runtime: openai/gpt-5-mini
- Generated branch title: Vault Through The Back Steps,
- Generated direction label: Pursue: Vault through the back steps, slip past the pan…

What this means:
- The quest component can already turn freeform prompt input into a persistent branch.
- It is not yet seeded from the messenger brief / home scene / Xerofag chase, so it behaves like a generic authored adventure shell rather than your escape sequence.

### 6. Satchel / cards stand-in: memory spread is the nearest future-facing component

PC move:
- Feeds the same fragment into memory extraction and entity extraction.
- Receives card-ready memories and entity cards.

APIs touched:
- `POST /api/fragmentToMemories`
- `POST /api/textToEntity`

Memory outputs:
- Memory titles: Stone Gives Way, Fractured Trace 2, Fractured Trace 3
- Mocked: `true`

Entity outputs:
- Entity names: Emberline Waystation, Cindergate Courier, Ashward Toll, Emberline Waystation 4, Cindergate Courier 5
- Mocked: `true`

Why this matters for your later observatory / seer vision:
- The repo already has a memory spread page, entity-card generation, and a seer-card prototype.
- These are not yet narratively tied to the satchel of blank cards or the observatory rescue scene, but the component family already exists.

## What Already Matches Well

- Messenger -> immersive RPG handoff is real. The messenger scene brief is the bridge.
- The immersive home-intrusion scene is already unusually close to your intended second scene.
- The typewriter already has ghostwriting, fade pacing, storyteller emergence, and an observer-like intervention mechanic.
- The memory/card stack already exists as a later-phase content surface.

## Where The Current Game Breaks Against Your Vision

- There is no top-level phase orchestrator. Components exist side by side in nav, not as one guided story flow.
- The immersive scene and the typewriter scene are not automatically chained by game state.
- The `THE XEROFAG` key is not context-gated yet.
- The "glyph key switches to first-person investigator witness mode" is approximated by storyteller interventions, not implemented as its own UX/state.
- The quest component is mechanically ready, but its authored world is still a separate fantasy shell instead of the PC's home-and-harbor escape.
- The travel box, 4-digit code inference, journey journal, Defiler chase, rescue by the seer, and observatory card draw are not yet represented as connected game states.

## Task Candidates

1. Build a story-phase orchestrator that moves a shared session through `messenger -> immersive-rpg -> typewriter -> quest -> travel-journal -> seer`.
2. Add persistent "package state" to the immersive RPG output so scene 3 can unlock the typewriter, travel box, satchel, and journal as actual inventory objects.
3. Make `THE XEROFAG` key context-aware: rejected in the wrong context, accepted only when the narrative supports it, with dedicated feedback.
4. Add a true "observer glyph" mechanic on top of the storyteller intervention system so a second voice can annotate the page in a visibly distinct mode.
5. Seed quest generation from the messenger scene brief and immersive scene flags so the tactical escape is rooted in the PC's actual house and surrounding area.
6. Turn the 4-digit code into a first-class mechanic: surfaced through storyteller intervention text, inferred by the player, and validated against a travel-box component.
7. Re-skin memory spread / seer work so blank satchel cards become the same objects later used in the observatory draw.
