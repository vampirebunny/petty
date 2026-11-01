# Cursor Brief: NPC Invitations

Oct 31, 2026 · @A

## Overview

Build an invitation system that invites the player to an NPC runway show at The Catwalk or a Stadium race they qualify for. Invitations arrive as mail: a shared envelope reading "You're invited!" appears center screen, the player taps to open it, and the invitation inside differs by event type. Accept opens that event; Maybe Next Time dismisses.

No NPC pet is shown in the envelope or the invitation, and none delivers it.

What to build:

1. An invitation, created with everything the event needs.
2. A scheduler that decides when to show an invitation in-app and when to send a push.
3. The envelope and two invitation designs, with their animations.
4. Accept and Maybe Next Time handling, including deep links and expiry.
5. A Friends-screen toggle for NPC invitation pushes, plus analytics events.

## Invitation data

An invitation carries everything its event needs, so Accept never lands on a half-built screen. Create it when it is shown, not earlier. The live invitation is memory-only. Killing the app drops it. That is not a dismissal, and it does not come back. Showing it spends the day's invitation.

Scheduler counters persist (day spent, dismissals, push backoff, last friend push, pushes enabled). The invitation itself does not.

| Field | Runway | Race |
| --- | --- | --- |
| `type` | `runway` | `race` |
| `createdAt`, `expiresAt` | expires 24 hours after it is shown | expires at the race's start time |
| Theme | theme ID from the catalog | n/a |
| Music | track ID from the catalog | n/a |
| NPC contestants | NPC pets and their 3 outfits each, dressed up front | n/a (NPCs are added at race start by existing logic) |
| Event | n/a | competition type, from the Stadium board |
| `eventId`, `startsAt` | n/a | the board card Accept will open |
| Class | n/a | the class that card uses (`classForEvent`) |
| Bib number | n/a | display number from 10 to 99 |

Rules:

- **One invitation per day** total, in-app or push. Showing it spends the day.
- **Only invite to a race the pet can enter.** The card state is `open` (required tricks, not resting, not already in a race, slot still before the lock) and the event is playable: Fun Run, Hurdles, Dock Dive, or Obstacle Course. Guests and a failed board fetch get no race invitation. Energy is not a sign-up check.
- **The race is the soonest qualifying card that starts at least 2 minutes out.** A slot inside that window is skipped. Slots are 5 minutes. Hurdles is not in every slot, so "next start" is the next board card of that event, not the next clock boundary.
- **NPC runway shows run locally.** They have no judging and no real players, so they work offline.
- **Costume pieces:** unlock the theme's full rack at Accept, minus pieces the seeded NPCs are already wearing. The friend-show drip does not apply.
- **First race invitation** prefers a Fun Run when that card is open.

## When invitations are sent

Put every number in config.

**Level 6.** No invitation, in-app or push, until the pet is at least level 6. Time before that does not spend the day's invitation, and it does not start the push timer. Once the pet reaches level 6, the rules below apply on the next eligible action and the next app open.

**In-app (player is in the app)**

- Show only while the pet is in the house: living room, bedroom, or catio, with no map destination.
- Show only after the player completes an action. Never on app open, never mid-action.
- **First invitation ever, per format:** show it as soon as that format is eligible.
- **Later:** show a format after 4 active days without entering it. A new runway theme, a newly mastered trick that unlocks a race, or a new class can lead sooner.
- **Alternate formats** when both are eligible, unless one of them is the new thing.
- **One at a time:** never alongside a friend request, friend invite, level-up burst, park find, Pet Cam, badge, learned-trick celebration, or the race call.

**Push (player is away)**

- Only if notification permission is already granted. This feature never asks for permission.
- The Friends-screen switch gates pushes only. In-app invitations still follow the daily cap.
- **First push:** about 20 hours after the player was last in the app. Skip quiet hours (21:00–08:00 local) and aim at the hour they usually play.
- **Friends first:** if a friend push was received that local day, skip the NPC push for that day.
- **Back-off when the push is unanswered:** next push after 2 days, then 7 days, then stop until the player opens the app.
- **Tapping the push** creates the invitation then and shows the envelope. It never opens a saved invitation and it never auto-accepts.

**Back-off for dismissals**

- **Maybe Next Time twice in a row for a format:** pause that format for 7 days.
- **Declined 3 times total for a format:** stop proactive invitations for it. The Stadium and The Catwalk stay on the map.
- An expired invitation, or one dropped by a restart, is not a dismissal.

## Envelope and invitation design

One shared envelope; two invitation designs. Match the mockup canvas "Boop Boop Invitations" for layout and color. Fonts: Fredoka for headings and buttons, Nunito for body. No sparkles, no speech balloons, no white-dot decoration.

**Scene behind it:** dim the current scene with a dark overlay (about 55%). The pet keeps idling underneath.

**Envelope (shared, about 300×200 pt)**

| Part | Spec |
| --- | --- |
| Back | cream `#E3D1B2`, 18 pt corner radius, soft drop shadow |
| Side pockets | `#EFE0C6` triangles from each side to just below center |
| Bottom pocket | `#F6EBD7` triangle from the bottom corners to just above center |
| Flap | `#EADAB9` triangle from the top edge, point just below center |
| Seal | 58 pt gold `#C08A2E` circle at the flap's point, cream paw print `#FFF3D6`, glossy bevel |
| Label | white pill near the bottom reading "You're invited!", text `#3B3350`, puffy bottom shadow `#D6C3A0` |

**Envelope animation**

1. **Arrive:** pops in at center with a springy scale bounce (0.4 → 1, about 0.55 s). Play `badge-earned.wav`.
2. **Idle:** a small wobble (about ±3°) every 2.8 s, so it reads as tappable. Reduced motion skips the wobble.
3. **Tap to open:** a tap on the envelope, or on the dim background around it, opens it. The seal scales up and fades (0.22 s) and the flap flips up on its top edge (0.42 s). While the envelope is closed the flap is the front layer, hinged on the top edge, with the paw seal on the flap. At 90°, when the flap is edge-on, it drops behind the letter and finishes above the envelope. The letter is a tall card inside the envelope, under the flap and the front pocket. It rises only enough for its header to show in the opening and stays inside.
4. **Hand-off (at about 0.95 s):** the envelope drops off the bottom of the screen with a slight rotation and fades. The full invitation springs in from below to center (scale 0.65 → 1).
5. **Buttons:** fade up 0.7 s after the invitation lands, on both cards, so they are tappable by about 2 s from the tap. Race safety pins still stagger in and may overlap that fade.

The letter's header matches its invitation: "THE CATWALK" on cream-pink for runway, a checkered strip on off-white for race.

**Runway invitation (about 300 pt wide)**

- Card `#FFF6FB` with a 6 pt `#F7CFE3` outer ring and 28 pt radius.
- "THE CATWALK" in small spaced caps, `#8C3A72`.
- "You're invited!" heading, `#5B1F4A`.
- Theme panel (about 256×168 pt, 20 pt radius, stretched to the card): the top 112 pt is `ThemeStill` for that theme, cropped from the top of the venue so the art fills the frame. The bottom 56 pt is a name band with "THEME" over the theme name. Band colors are below. The mockup's 300×250 crop table is for its own drawings and does not apply to the venue art.
- "Walk the runway in 3 looks" with three hanger icons.
- Buttons: Accept `#C2337F` with white text; Maybe Next Time white with `#8E1F5B` text.

| Theme | Band | "THEME" label | Name |
| --- | --- | --- | --- |
| Space Travelers | `#4B3B7A` | `#D3CEFF` | `#FFFFFF` |
| Under the Sea | `#2C5A8A` | `#CFE6FA` | `#FFFFFF` |
| Royal Ball | `#5C4A92` | `#E3DBFF` | `#FFFFFF` |
| Beach Day | `#F0CF9A` | `#5E4424` | `#3B2A14` |
| Winter Wonderland | `#3F6690` | `#DDF0FF` | `#FFFFFF` |
| Rock Star | `#1A1533` | `#F7A9C9` | `#FFFFFF` |
| Garden Party | `#387A52` | `#DFF6E7` | `#FFFFFF` |
| Spooky Night | `#251C4A` | `#FFAD7A` | `#FFFFFF` |
| Wild West | `#6E4630` | `#FFD3B5` | `#FFFFFF` |
| Superhero City | `#2E2458` | `#FFD45E` | `#FFFFFF` |
| Pirate Cove | `#1E3F66` | `#FFE9A8` | `#FFFFFF` |
| Safari | `#6B5222` | `#FFE9A8` | `#FFFFFF` |

**Race invitation (bib, about 300 pt wide)**

- Off-white `#FFFDF7` bib with a navy-and-white checkered strip across the top.
- Four safety pins at the corners that snap in one by one after the bib lands (about 0.15 s apart).
- "You're invited!" heading, `#1E2A4A`; "STADIUM RACE" in small caps, `#4A5578`.
- Large bib number, `#1E2A4A`.
- Event band: `#E2552F` with the event name in white caps.
- Class line from `classLabel` / `classForEvent` (for example Open, or Beginner).
- Navy pill: "Starts in m:ss · 4:15 PM", counting down live to `startsAt`. Use tabular numbers so it doesn't jitter.
- Buttons: Accept navy `#26365F` with white text; Maybe Next Time white with `#26365F` text.

**Buttons (both):** glossy, puffy and fully rounded, matching the existing cotton-candy button style. Accept on top, about 56 pt tall; Maybe Next Time below, about 50 pt tall.

## Accept, Maybe Next Time and expiry

Accept skips the venue screens and the map walk. Maybe Next Time closes.

**Accept: runway**

- Opens the seeded NPC show at its "choose your 3 looks" step, not The Catwalk venue screen.
- Uses the invitation's theme, music, and NPC contestants. Back from that step leaves to The Catwalk on the map.

**Accept: race**

- Opens the sign-up sheet for the stored `eventId`, not the Stadium lobby. The sheet's confirm still signs the pet up.
- **Start is inside 2 minutes, or that card is no longer open:** the sheet is the next `open` card of the same event that is still at least 2 minutes out. If the board has none, close the invitation and stay home.

**Navigation**

- The Back button from the venue returns to that venue on the map (The Catwalk or the Stadium), not to the room the player was standing in.

**Maybe Next Time**

- Closes the invitation: it shrinks and fades downward (about 0.4 s), and the overlay lifts.
- Tapping outside the revealed invitation counts as Maybe Next Time. Tapping outside the unopened envelope opens it.
- Counts toward the dismissal back-off.

**Expiry**

- **Race:** if the card is open when its slot starts, retarget it to the next open start of the same event that is at least 2 minutes out, and update the countdown. If the envelope is still unopened when the slot starts, discard it.
- **Runway:** stays until answered, or 24 hours.
- An expired invitation is not a dismissal.

## Settings and analytics

**Settings**

- Add a "Race and runway invitations" switch on the Friends screen, beside Friend requests and Care reminders. Default on. It controls NPC invitation pushes only.

**Firebase events**

| Event | Params |
| --- | --- |
| `invite_created` | type, theme or event, trigger (`first` / `lapsed` / `new`) |
| `invite_shown` | type, surface (`in_app` / `push`) |
| `invite_opened` | type, seconds_to_open |
| `invite_accepted` | type, retargeted |
| `invite_dismissed` | type, method (`button` / `tap_outside`) |
| `invite_expired` | type |
| `invite_event_completed` | type `runway` |

A race result stays on `competition_result`.

**Out of scope**

- Friend invitations (they keep their existing flow).
- Judging or voting in NPC runway shows.

**Resolved**

- Costume pieces: the full theme rack is available at Accept, except pieces the seeded NPCs wear.
- Envelope chime: `badge-earned.wav`.
- Theme panel art: `ThemeStill`, cropped from the top of the venue so it fills the frame, with the band colors above.
- Dev debug, development builds only: Settings has **Runway invite** and **Race invite**. They show the envelope immediately, including before level 6. They do not spend the day's invitation, and Maybe Next Time on one of them is not a dismissal. The race button uses the next playable board card. If the board has none, it shows a Fun Run preview.
