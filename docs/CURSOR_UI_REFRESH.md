# Boop Boop UI refresh — instructions for Cursor

This refresh has shipped. The locked decisions are what the app does. The phase notes below are the original brief, and they lose wherever they disagree.

You are restyling four areas of the Boop Boop Expo / React Native app: the Home control panel, the Wardrobe, the Catwalk look picker, and the card modals in those areas. This is a **layout and component change only**. Do not change game logic, stat math, timers, economy, save data, costume rules, or who can pick show music. Wire every new component to the handlers and state that already exist. The components live in `src/ui/refresh/`.

## Locked decisions

These override the phase notes where they disagree.

- Wardrobe and the playdate outfit step draw the living room behind the pet. Catwalk backstage draws the pet over the theme still. Do not replace either canvas with the lilac stage or the floor ellipse. Chips and chrome sit around that canvas.
- An awake pet idles in the 3/4 sit (blink, breath, wag) and also walks a short path that stays inside the frame. Sleep lies with eyes closed and tail still, with only the slow sleep breath. Reduce Motion holds the preview clock at 0, so that pet stays seated.
- Playdate uses the same closet. Its footer is Start, or the cooldown, not Done.
- Catwalk footer is Next: Look 2, Next: Look 3, then Submit looks or Start the show.
- Music behavior is unchanged. A solo player still picks on Backstage. A host already picked on Invite friends. An invitee keeps the locked label and the 10-second preview. The control may move into a chip.
- Costumes do not ask to move between looks. The same piece may stay in more than one look. Taken stays as it is. Wings and the jetpack stay the `back` slot and only appear under the Body label.
- Primary pink is the call-to-action on Home, Wardrobe, Catwalk, and the modals in this pass. Stadium and the Pet Shop keep their current buttons.
- Restyle park finds and friend requests. Do not restyle game invites or account sheets (`AccountSheet`, the handle form).
- The Care tab may scroll. Landscape home stays a scene plus a phone-width column.
- New press and modal motion read the existing Reduce Motion flag. There is no new setting.
- Home buttons are candy, not white cards. Care is pink, Bond is sky, Train is lilac, and Style is aqua, using the `CandyFace` gradient and gloss with that flavor's lip as the edge. The active tab takes its section's candy. The pink button and the Train pill carry the same gloss. An unavailable card stays flat gray.
- Care, Bond, and Style use four quarter tiles in a row on a phone (`ActionCard` size `quarter`). Playdate and Collection sit in that row with the other Bond and Style actions.
- `GoSomewhere` sits under the `StatStrip` and opens the town map. The scene still keeps a small location chip. On a phone the strip overlaps the stage by 34pt; on a landscape split that overlap is off so the strip is not clipped.
- Sounds and Music are candy lilac rows with glossy switches at the top of Settings. There is no Sound section title. On a landscape Settings split, Traits, Friends, and Badges are on the left; sound, account, and delete stay on the right.
- Wardrobe Done is green (`PrimaryButton` tone `green`). The daily toggle label is "Automatically choose new outfit every day". Item tiles are three across and scroll down; art fills most of the tile by measuring each icon's painted bounds (`ItemIconArt`). On a landscape split the living-room preview fills the whole left pane.
- Catwalk lobby, Arcade lobby, and Stadium lobby have no back button. Each shows the `StatStrip`, then `GoSomewhere` ("[pet] is at the …"), with the logo and settings on the left of the header. Later Catwalk and Stadium steps keep their step-back control.
- Catwalk runway shows draw no ground shadow under the models.
- Training success, out-of-treats, and break dialogs stay on `TrainingSheet` / `FunModal`. Home bed, chest, wardrobe daily-outfit, and Catwalk judge/wrap cards use `BoopModal`.
- The HTML Lookbook and Control Panel redesign mocks are removed; the refresh tokens and this brief are the reference.
- New components take color from the refresh tokens. `src/ui/theme.ts` and `src/ui/closet/closetStyle.ts` stay for screens this pass does not touch.

Work in the phases below, in order. Finish each phase, run the app, and confirm its checklist before starting the next. Keep commits per phase.

---

## Phase 0 — Read before you write

1. Find and list (don't change yet):
   - the Home screen and every component rendered below the pet scene (stat rings, Where/"Go somewhere", Care, Bond, In Training, Style & sound)
   - the "Try this" suggested-activity bubble and the logic that picks the suggestion
   - the Wardrobe screen, its category cards, "Take it all off", Continue, and the daily-outfit toggle + its modal
   - the Catwalk look picker (Look 1/2/3 tabs, closet cards, Costume rack, Show music, Next button) and the costume drip / one-model-per-costume logic
   - every modal in the app (training treat offer, try again, needs a break / Second Wind, daily outfit, park find, invites, friend requests, account prompts, anything else)
   - how fonts, colors and styles are currently defined (theme file? inline?)
2. Reply with that inventory and a short plan before editing. If anything below conflicts with what exists, say so and ask; don't guess.

---

## Phase 1 — Tokens, fonts, base pressable

Create `theme/ui.ts` (or extend the existing theme file if there is one). **No hex values inline in components from here on** — everything references these tokens.

```ts
export const ui = {
  bg: '#F4F2FA',            // screen background
  card: '#FFFFFF',
  cardSheenBottom: '#F3EFFA', // bottom stop of card gloss gradient
  cardEdge: '#DAD2EC',      // 5pt solid "puffy" bottom edge
  ink: '#2B2340',
  inkMuted: '#6E6684',      // passes 4.5:1 on white
  disabledBg: '#EEEBF5',
  disabledInk: '#5E5675',
  segmentTrack: '#E7E2F2',
  scrim: 'rgba(43,35,64,0.45)',

  primary: { top: '#EE6F98', bottom: '#D6406F', edge: '#A92D55' }, // the ONE primary CTA color app-wide
  equipped: { main: '#1F8A84', edge: '#9ED3CF', text: '#17635E' }, // worn/selected items, toggles, active slot tab

  accent: {
    care:  { main: '#D6406F', tint: '#FBE3EB' },
    bond:  { main: '#2F6FD6', tint: '#E1ECFB' },
    train: { main: '#6E4FD0', tint: '#ECE6FA' },
    style: { main: '#1F7A74', tint: '#DFF2F0' },
  },

  stat: {
    tummy:  { fill: '#E8803A', track: '#F1ECE6', label: '#B8501A' },
    water:  { fill: '#3FA39C', track: '#E3F0EF', label: '#1F7A74' },
    energy: { fill: '#D4A22E', track: '#F4EEDD', label: '#8A6410' },
    mood:   { fill: '#E2638F', track: '#F6E4EB', label: '#C03A68' },
  },

  radius: { card: 24, tile: 22, pill: 999, modal: 32 },
  space: { gutter: 16, gap: 12 },
};
```

Fonts: load **Fredoka** (600, 700) and **Nunito** (600, 700) with `expo-font` (`@expo-google-fonts/fredoka`, `@expo-google-fonts/nunito`). Fredoka = titles, labels, numbers, buttons. Nunito = sublabels, body, captions. No other fonts in these screens.

Build `PressableCard` — the base for every tappable card/button in this work:
- Face: vertical gradient white → `cardSheenBottom` (white holds to ~45%), 2pt white border, radius from props (default 24). Use `expo-linear-gradient`.
- Depth: a 5pt solid `cardEdge` block offset below the face (implement as a View behind the face, not a shadow, so it renders identically on iOS and Android) + soft shadow (y 10, blur 18, `ink` at 8%).
- Pressed: face translates down 3pt and the edge shrinks to 2pt (Reanimated or Animated, ~80ms). Light haptic (`expo-haptics` impactAsync Light) on press.
- `disabled` variant: flat `disabledBg`, no edge, no gradient. Still pressable when given `onDisabledPress` (used to show the reason).
- Min touch target 44×44.

Build `PrimaryButton`: same mechanics, gradient `primary.top → primary.bottom`, edge `primary.edge`, white Fredoka 600 text, height 56 (54 in modals), radius pill.

✅ Phase 1 done when: a scratch screen shows PressableCard (normal, pressed, disabled) and PrimaryButton looking right on both iOS and Android.

---

## Phase 2 — Home control panel

### Layout (top → bottom, 390pt-wide phone)
| Zone | Height | Notes |
|---|---|---|
| Header | safe area + ~60 | App icon, pet name, Lv + XP bar, Boops pill, settings button (44×44). Same data as now, tidied. |
| Pet scene | ~34% of screen height, min 240 | Unchanged scene. Add `LocationChip` top-left. |
| `StatStrip` | ~60; phone overlaps scene by 34, landscape flush | Replaces the four big rings. |
| `TabSwitcher` | 52 | Care · Bond · Train · Style |
| Tab content | rest | Only this area scrolls, and only if it overflows. |

Rules: 16pt side padding, 12pt gaps. Tab switcher and stat strip never scroll away. Open on Care at launch; remember the last tab for the session. **On a 390×844 phone the Care tab must show all four care buttons with no scrolling.**

### Components
- **`ActionCard`** — props `icon, title, sublabel, accent ('care'|'bond'|'train'|'style'), state ('default'|'suggested'|'unavailable'), size ('half'|'full'), onPress, onUnavailablePress`.
  - quarter: 4-across tile (~23% width), min height 96, centered white icon bubble + title + sublabel (shipped Home layout).
  - half: 2-column grid tile, min height 108 (kept for denser layouts).
  - full: row — icon left, title + sublabel, chevron right; min height 76.
  - `suggested`: 2pt care-accent border, pink-tinted gloss bottom (#FDEAF1), small "Suggested" pill top-right (care accent bg, white 11pt bold).
  - `unavailable`: PressableCard disabled variant, grey icon, sublabel **must** state the reason ("Full · again in 2h", "Out of treats · Pet Shop"). Tapping shows the reason as a toast. Never grey out without a reason.
- **`StatStrip`** — one white card, 4 equal columns (Tummy, Water, Energy, Mood). Each: colored label + `NN%` on one line, 6pt bar, existing word label (Peckish, Full, Zoomy!, Joyful!). Bars animate 300ms ease-out on change. Rename "Hydration" → "Water" in this UI.
- **`TabSwitcher`** — segmented control on `segmentTrack`. Active = white raised pill (2pt edge), `ink` text; inactive = transparent, `inkMuted`. Prop `alerts: Set<tabId>` → 8pt care-accent dot after the tab name.
- **`TrainingRow`** — icon circle (train accent), trick name, `NN%` in train accent, 8pt progress bar, right-side pill: "Train" (train-accent gradient #8C6EE6→#6E4FD0, edge #4E34A6) or, while resting, a disabled pill with clock icon + `m:ss` countdown ticking every second.
- **`LocationChip`** — white 94% pill, 36pt, over the scene top-left: place icon + place name + chevron. Opens the map. The panel also has `GoSomewhere` under the strip.

### Tab contents
| Tab | Contents | Sublabels |
|---|---|---|
| Care | Quarter tiles: Feed, Water, Treat, Sleep (care accent) | Feed: tummy word; Water: water state; Treat: "N in bag"; Sleep: "Rest up" |
| Bond | Quarter tiles: Cuddle, Play, Playdate (bond accent) | Playdate: cooldown or "Meet a friend" |
| Train | "IN TRAINING" label → TrainingRows; "LEARNED · TAP TO PERFORM" label → white pill chips per learned trick; final chip "More at Training School ›" | progress % and rest countdown from existing state |
| Style | Quarter tiles: Wardrobe, Storage, Collection when unlocked (style accent) | Wardrobe: outfit summary; Storage: "Furniture and props"; Collection: "Park finds" |

Inside the Training School keep the existing rule: show only In Training and the Trick Shop, no tab switcher.

### Moves / removals
- Big stat rings → `StatStrip`.
- "Where" section → `LocationChip` on the scene plus `GoSomewhere` under the strip.
- "Try this" bubble: when the current suggestion maps to a panel button, set that button to `suggested`, add its tab to `alerts`, and hide the bubble. Keep the bubble only for suggestions with no panel button (e.g. go to the park). Only one suggested button at a time.
- Sounds + Music toggles → Settings page (gear), candy switch rows with no Sound title. Keep their saved values.
- Locked trick cards (e.g. High five) → removed from Home; locked/age-gated tricks only live in the Training School Trick Shop.
- Delete the old section components once nothing imports them.

✅ Phase 2 done when:
- [ ] Care tab fits with no scroll on 390×844; also works at 375pt wide and on Android
- [ ] Every panel button is an ActionCard or TrainingRow
- [ ] Suggested state + tab dot follow the suggestion logic; bubble only for non-panel suggestions
- [ ] Unavailable buttons show and toast their reason
- [ ] Rest countdown ticks in the trick pill
- [ ] Sound/Music work from Settings
- [ ] Location chip and Go somewhere open the map; pressed state + haptic on every card

---

## Phase 3 — Shared item grid: `SlotTabs` + `ItemTile`

Used by both the Wardrobe and the Catwalk.

- **Slots (unified names):** Hats, Glasses, Neck, Body, Boots. Jackets/vests **and** costume wings/jetpack go under Body; costume crowns/headbands go under Hats. Map existing attachment points to these; don't rename data, just the UI labels.
- **`SlotTabs`** — horizontal scrolling pills, 44pt tall. Each pill: the slot's representative item icon (22pt) + label. Active: 2pt `equipped.main` border, `equipped.text` label, edge `#BFE3E0`. A 7pt `equipped.main` dot when something in that slot is worn (in the current outfit / look).
- **`ItemTile`** — 3-column wrapping grid that scrolls down, tile height ~140, radius 22. Item art ~100×92, zoomed to the painted bounds via `ItemIconArt`, name Fredoka 600 13pt, max 2 lines, centered. States:

| State | Look | Where |
|---|---|---|
| `default` | PressableCard gloss | both |
| `selected` | 2.5pt `equipped.main` border, edge `equipped.edge`, name in `equipped.text`, 24pt teal check badge overlapping top-right | both |
| `locked` | disabled bg, art 55% opacity, white tag top-left: lock icon + countdown `m:ss` | rack |
| `used` | disabled bg, art 55%, colored tag top-left: "In Look N" (train accent) or "Taken" (#8C84A0) | rack |
| `shop` | 2.5pt dashed #CFC6E4 outline, bag icon, "Get more" → Pet Shop | wardrobe only, always last tile |

Behavior is unchanged: tap to wear, tap again to remove, another item in the same slot replaces it.

✅ Phase 3 done when all five tile states render from real data.

---

## Phase 4 — Wardrobe

Replace the tan/khaki layout and green Continue.

| Zone | Height | Notes |
|---|---|---|
| Header | safe area + 52 | Back button (44 circle), "[Pet]'s wardrobe" Fredoka 700 22, Boops pill |
| Pet stage | phone ~236 card; landscape full left pane | Living room behind the pet. Phone: rounded card. Landscape: edge-to-edge left pane. Wearing chips along the bottom. |
| Daily toggle row | 52 | White card: shuffle icon (style accent), label "Automatically choose new outfit every day", switch (on = `equipped.main`). Same setting + same first-open tooltip as today. |
| SlotTabs | 44 | |
| ItemTile grid | rest | active slot only; scrolls inside its area |
| Footer | 56 + safe area | Green `PrimaryButton` "Done", pinned |

**Wearing chips** replace the "Wearing: …" sentence and "Take it all off": one white chip per worn item (icon + short name + ×); × removes that item. "Take off all" is a text button (#5A3DBA) at the right end. With nothing worn the row says "Tap something to try it on."

✅ Phase 4 done when the wardrobe fits on one screen with Done pinned and no tan category cards remain.

---

## Phase 5 — Catwalk look picker

| Zone | Height | Notes |
|---|---|---|
| Runway scene | ~210 | Existing theme scene, shortened. Lobby: logo + settings on the left, title, no back. Later steps keep Back + title. Music chip top-right — **inviter only**. |
| Look strip | 60 | 3 cards: mini thumbnail, "Look N", status ("Editing" in care accent / "N pieces" / "Empty"). Editing look: 2.5pt primary-pink border. Empty: dashed outline + plus. Tap to switch look. |
| Source switch | 48 | Segmented "My closet" · "Costume rack"; rack shows a "N new" pink badge when pieces dropped since last viewed. |
| SlotTabs | 44 | dots reflect the look being edited |
| Drip banner | 36, rack only | pink-tint pill: clock + "New piece in m:ss · each costume, one model per show" |
| ItemTile grid | rest | source + slot |
| Footer | | `PrimaryButton` "Next: Look 2" → "Next: Look 3" → "Done" |

Rack states from existing show logic:
- not dropped yet → `locked` with its countdown
- worn in another of the player's looks → `used` "In Look N"; tap asks whether to move it to this look
- claimed by another player → `used` "Taken"; tap toasts "Another model is wearing this"
- slot empty on the rack → dashed empty state "No [slot] pieces on the rack for this show. Try your closet."

Remove the old "Show music" row at the bottom of the scroll.

✅ Phase 5 done when rack countdowns, "In Look N" and "Taken" come from real show state and non-inviters never see the music chip.

---

## Phase 6 — `BoopModal` (all modals)

One component; no screen draws its own modal. This fixes the current purple modal's misaligned inner panel and overflowing text.

Anatomy:
- Full-screen `scrim`. Card inset 32pt each side, vertically centered slightly below middle.
- Card: radius 32, 3pt white border, gradient white → #F6F2FC (white to ~55%), 7pt bottom edge #D6CCEA, drop shadow (y 24, blur 48, ink 35%). Padding 52 top / 20 sides / 20 bottom.
- Icon badge: 80pt circle centered on the card's top edge (half overlapping), accent tint fill, 5pt white ring, 5pt #D6CCEA edge below, 34pt icon in the context accent.
- Title Fredoka 700 24 centered; body Nunito 15 `disabledInk`, centered, max 3 lines.
- Optional item row: 56pt, bg #F1ECFA, radius 18: white icon circle, item name (Fredoka 15), owned count right ("8 left", "You have 0").
- Buttons stacked full width, 12pt gap: `PrimaryButton` (54) then secondary (50, white gloss, edge `cardEdge`, `disabledInk` text). One or two buttons only.
- Motion: scrim fades 150ms; card scales 0.92→1 with a light spring. Exit reverses. Scrim tap = secondary action unless `dismissible={false}`.

Props: `icon, accent, title, body, item?: {icon, name, count}, primary: {label, onPress}, secondary?: {label, onPress}, dismissible = true`.

Copy for the three mocked modals (behavior unchanged):
| Modal | Accent | Title | Body | Buttons |
|---|---|---|---|---|
| Daily outfit | style | New look every day? | We'll pick something from [pet]'s closet each morning. Want a fresh outfit right now too? | Yes, pick one now · Start tomorrow |
| Training success | train | Nailed it! | [Pet] [did trick] on cue. Give a treat for a bigger training boost? + item row "Treats · N left" | Give a treat · Not this time |
| Needs a break | train (clock icon — never a sleep/nap icon) | [Pet] needs a break | Training picks up again in m:ss. A Second Wind cookie ends the break right away. + item row "Second Wind cookie · You have N" | N = 0: Visit Pet Shop · OK. N > 0: Use cookie · OK |

Then migrate **every other modal** found in Phase 0 onto `BoopModal`. The "You're invited!" envelope keeps its own art inside the card body.

✅ Phase 6 done when:
- [ ] No modal is rendered outside `BoopModal`
- [ ] Text never overflows the card at the largest text size the app supports
- [ ] The only CTA fill color across Home, Wardrobe, Catwalk and modals is `primary`

---

## General rules
- Accessibility: real buttons with `accessibilityRole`, `accessibilityLabel` on icon-only buttons (settings, back, × on chips), `accessibilityState` for selected/disabled. 44×44 minimum targets.
- Icons: use the app's existing icon set if it matches a 2pt rounded stroke; otherwise `lucide-react-native`.
- Mockup numbers (60%, 7:42, "8 in your bag", "again in 2h", "1 new") are samples — always use real state.
- Keep components layout-agnostic: the panel will later sit beside the scene in a landscape/tablet split.
- Don't add dependencies beyond `expo-font`, the two Google font packages, `expo-linear-gradient`, `expo-haptics` and `lucide-react-native` without asking.
