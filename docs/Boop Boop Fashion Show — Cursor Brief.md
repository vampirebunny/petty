# Boop Boop Fashion Show — Cursor Brief

Oct 31, 2026 · @A

## Overview

Add a fashion show: a new place on the map where pets walk a runway in 3 looks, either solo with NPC pets or async with friends who vote on a winner.

- **Map place:** The Catwalk is a real stop on Boop Boop Town. A tap walks the pet there and opens the venue. The name stays in one config value. It is "The Catwalk" until a final name is chosen.
- **Solo show (NPC):** the player submits 3 looks, picks music and a theme, and watches their pet walk alongside NPC pets. No judging, no voting, no winner. A guest can run a solo show on the device. A signed-in player's solo show is saved with their other shows.
- **Friend show:** the player invites friends, everyone submits 3 looks before a deadline, then everyone (including judge-only invitees) watches all shows and votes. Friend shows require a signed-in account.
- **Async throughout:** no one needs to be online at the same time. A player may be in several shows at once. Every show is saved and replayable, the same way playdates are.

## Submission

Each player submits 3 looks; the show's creator sets the theme and the music.

- **3 looks:** each look is built from the player's owned wardrobe items (Closet) plus any available runway costume pieces (see Costumes). A look can use several pieces. Each look needs at least one piece, closet or costume.
- **One piece per slot:** choosing another closet item or costume for a slot replaces what was there. Closet items and costumes share head, face, neck, body, and feet. Back is costumes only. Closet `OutfitSlot` stays the five everyday slots; costumes use a parallel slot type that includes `back`.
- **Music:** one track from a list stored in Supabase for the whole show. The inviter picks it for a friend show (invitees hear it but don't choose it); the player picks it for a solo show. Playback loops that track for every round and every model, including across skips. The app mute switch silences it. If the track no longer exists, play silently. No error, no fallback track. Seed files are the ten mp3s in `docs/runway music/`.
- **Theme:** solo shows, the player picks it. Friend shows, the inviter picks it when sending invites, and it applies to everyone. The theme sets the venue background and which costume pieces are on the rack.
- **Snapshot on submit:** the three looks lock forever. Store each worn item's id and a copy of the colorway it resolved to (its colors and its clothing pattern, which live together on the item). Store each costume the same way. Later Closet changes, and a later recolor of the catalog item, do not change the show. Playback uses the current drawing code for that shape with the saved colorway. There is no new closet model: players still pick items, not a color and a pattern on their own.
- **No theme tags on wardrobe items.** Only costume pieces carry theme tags.

## Costumes

Runway costume pieces are free for all players, but each piece can be used only once per show, first come first served.

- **Runway-only:** costume pieces never enter the Closet, are never owned, and never appear in playdate outfit rotations.
- **Pieces, not full costumes:** each piece attaches to one slot (head, face, neck, body, back, feet). Every costume fits dogs and cats. There is no species fit.
- **New back slot:** wings, jetpack and similar pieces need a "back" attachment point. It exists for costumes only; the wardrobe doesn't use it.
- **Theme tags:** each costume piece is tagged with every theme it fits. Versatile pieces carry several tags.
- **Rack per show:** a theme's rack is the theme-specific pieces listed for it, then the wildcards, then versatile pieces whose tags include that theme, in the order of the tables below. Seed only those pieces. Do not invent pieces to fill a rack. A rack cap stays a config value (default 12) and is not used to pad or trim this seed. A piece still locked when the deadline arrives cannot be claimed.
- **Once per show:** a piece can be used in only one of a player's 3 looks, and by only one player in the show.
- **No per-player cap:** a player may claim as many available pieces as they like.
- **Claim on submit:** selecting a piece doesn't reserve it. The claim happens on the server when the player submits. If a piece was claimed by someone else while the player was building, block submission and show: "Someone already claimed the \[piece\]. Pick another piece for Look \[n\]."
- **Taken pieces:** shown greyed out with "Taken." Never show who took them (that would leak a submission before the viewer has submitted).
- **Drip unlock (friend shows):** the first piece unlocks 5 minutes after invites go out; each next piece unlocks 1 minute after the previous one. Locked pieces show on the rack with their unlock countdown. Both intervals are config values, not hardcoded.
- **Solo shows:** the full rack is available immediately; the once-per-show rule still applies across the player's 3 looks.

## Friend shows

Friends submit anytime before a deadline. A contestant can't peek until they've submitted. Declined invitees are out. Then everyone left votes, and results reveal once the last vote is in or the poll closes.

**Invites**

- Reuse the friend-competition invite picker: up to 5 friends, with the 5 most recently invited friends shown for quick reselection.
- The inviter picks the theme, the music track, and the deadline, and sends invites via push and in-app notification.
- **Deadline:** the host picks a calendar day and a time in their own zone. Store that instant in UTC. Each friend sees it in their own zone. Reject a time that is already past.
- Show size is the host plus up to 5 invitees (max 6 contestants).
- An invitee may decline. A decline removes them from the runway and from the vote, and they no longer count as someone the show is waiting on. Being in one show does not block joining or hosting another.

**Submitting**

- Invitees, and the host, can submit anytime up to the deadline.
- A player can't watch any other submission until they've submitted their own. A judge-only player has no looks to submit, so this wait does not apply to them.
- An invitee who opens the invite after the deadline sees: "Submissions are closed, but you can still be a judge! We'll let you know when voting opens." If voting is already open, take them straight to watching.
- The host follows the same rule. If the host has not submitted when the deadline arrives, they become a judge: they do not walk, and they can still vote.

**Voting**

- Voting stays shut until every contestant who has not declined has submitted, or until the deadline. An early submission does not open voting, and it does not start the poll clock.
- The poll closes 15 minutes after voting opens. That length is a config value. A "last submission plus 15 minutes" time that is already past when voting opens is ignored, so the poll cannot close before anyone can vote.
- Every invitee can vote, including judge-only players and a host who never submitted. One vote each. It cannot be changed. Players may vote for themselves.
- Push notifications: when voting opens, and when results are ready.

**Results**

- Results are revealed when the last vote is cast. If someone never votes, results reveal when the poll closes.
- Show each contestant's final vote count, and a winner banner for the highest count. A tie puts every pet tied for that count on the banner. There is no tiebreaker.
- Never show who voted for whom.

## Runway presentation

Shows play in rounds, one round per look: every model walks once per round, the player's own model first, before the next round starts. Each model struts in place at center while the venue scrolls behind it.

- **Rounds:** Round 1 shows every model in Look 1, Round 2 every model in Look 2, Round 3 every model in Look 3. This applies to NPC shows and friend shows alike. Show a "Look 1 of 3" label for the round that is playing.
- **Order within a round:** the viewing player's model walks first, then the others by submission time. A judge-only viewer has no model, so their rounds start with the first submitted model.
- **Skip model:** ends the current model's walk and starts the next model in the round. Any viewer can skip, including a voter or a judge. Watching is the path into the vote screen; a voter does not have to finish every model or round before voting.
- **Skip to next round:** jumps to the first model of the next round. In the last round it ends the show (to voting or results in a friend show). Same skip rules for voters and judges.
- **Music:** the show's one track loops for the entire show, including across skips.
- **Zoom:** closer than the home scene, less than the Closet close-up. The full pet (top of a hat down to boots) stays in frame.
- **Venue:** the theme's layered venue strips, scrolled with parallax behind the pet. Placement math is in `docs/boopboop-venues/README.md`. Runtime art lives in `assets/runway/<theme>/`. The pet never collides with anything.
- **Turning:** use the existing in-between turn view, never a flat flip.

### The strut

Every runway walk uses the strut: a showier walk built on the existing leg model, with a longer stride, high prancing front paws, a proud bounce, chin up and tail high ([strut mock](https://claude.ai/artifact/ARiLZ5XZTkUhm2DiFERFRD)). The numbers, pose targets and timings ship in `src/actor/data/strut.ts`. The runway forces that style. It is not a new entry in `gaitOrder`, so `chooseGait` never picks it at home or in the park.

| Setting | Walk now | Strut |
| --- | --- | --- |
| Stride | 0.38 L | 0.62 L |
| Paw on ground (duty) | 0.70 | 0.60 |
| Front paw lift | 0.14 L | 0.36 L, reaching forward |
| Back paw lift | 0.14 L | 0.24 L |
| Body bounce | 1 px | 2.5 px, chest up |
| Head | level | chin up |
| Tail | resting | high, slow wag |
| Cadence | by speed | about 1 stride cycle per second |

Each model's walk, in seconds:

1. **Enter (4.0):** the pet struts from off-screen left to center. Venue is still.
2. **Walk out (3.0):** the pet struts in place at center; the venue scrolls right to left.
3. **Stop (0.6):** speed eases to zero and the paws settle under the hips.
4. **Pose (1.3):** the pet faces the audience with a faster wag. This step ships on. A config flag can skip it, and the turn then follows the stop.
5. **Turn (0.8):** the pet turns through the front view to face left.
6. **Walk back (3.0):** speed eases up over 0.5 s; the venue scrolls left to right.
7. **Exit (4.2):** venue is still; the pet struts from center to off-screen left.

The next model enters from the left after the previous one exits, so outfit changes always happen off-screen. The runway floor layer scrolls at exactly the pet's ground speed so planted paws don't slide.

## Solo NPC models

Config sets how many NPC models walk (default 3). Guests can run solo shows.

- **When:** generate NPC looks right after the player submits their 3 looks, not before. Snapshot them exactly like a player submission (items, colorways, costume pieces) so replays never change. Seed all randomness with the show id.
- **Who:** generic NPC pets (random species, breed, fur, name) from the existing NPC pet generator, behind one function `pickNpcModels(show)`. Do not build another source now.
- **Wardrobe:** evergreen catalog items only, via the same rule as playdates (`npcMayWear`: never `limited` or `exclusive`). Filter Closet fit with `fitsSpecies` (species, not breed). Color family comes from the item's `colorway.c`; there is no separate `mainColor` column. Prefer the costume's family or neutrals (white, black, grey, brown). Goofy may clash.
- **Costumes:** only pieces from the theme's rack that the player did not claim. Once per show across everyone. NPCs never take a piece the player used.
- **Style:** each NPC gets one of glam, sporty, cozy, goofy. No two NPCs in the same show share a style unless there are more NPCs than styles. Style biases item choice through a config weight table (item tag or category → weight).
  - glam: sequins, capes, crowns, glitter boots, tutus, bright jewel colors
  - sporty: bandanas, goggles, sneakers/boots, jackets, bold primary colors
  - cozy: sweaters, scarves, beanies, rain boots, soft pastels
  - goofy: mustache, antennae, mismatched colors, odd combos
- **Three looks per NPC,** with roles so every NPC has at least one light and one full look:
  1. **Light:** 2–3 pieces total, with 1 costume when the rack still has one.
  2. **Middle:** 1–2 costumes, then 2–3 wardrobe items in slots the costumes did not take. If the rack is empty, wardrobe only.
  3. **Full:** 4 or more pieces, including a head piece and a feet piece.
- Never repeat an item across the same NPC's 3 looks. Different NPCs may share wardrobe items (not costume pieces). One item per attachment slot.
- On the runway the player walks first, then the NPCs in generation order. No voting, no winner.

## Saved shows

Shows are saved as data and re-rendered on replay, like playdates; no video is recorded. Keep them forever.

- **Past Shows:** a list inside the venue. Friend shows appear for everyone invited, including judge-only players.
- **Hide or delete:** a friend show is hidden for that viewer only (`runway_viewer_hides`). A solo show delete removes the local row. When every remaining viewer has hidden a friend show, hard-delete the show. Declined invitees and anonymized deleted accounts do not count as remaining viewers.
- **Pet snapshot:** store each pet as it looked at submission: breed, the whole look (coat, fur pattern, accent, eyes), life stage, and weight. Fur pattern is the coat combination from adoption. It is separate from a clothing pattern on a colorway. An old show replays with the pet at that age and in that coat.
- **Retired pets:** their shows stay watchable.
- **Current art:** replays render items and costume pieces with their current art. If an item was redrawn, the replay shows the new version.
- **Stable IDs:** never reuse item, costume or track IDs.

**Account deletion: anonymize, don't delete**

When a player deletes their account, their looks stay in friends' saved shows but nothing identifies them:

- Their handle shows as "Former player."
- Their pet name shows as "Pup" (dog) or "Kitty" (cat).
- Their votes still count in tallies; any stored link between the vote and the voter is removed.
- If they hosted, the show stays intact for everyone else, with the host anonymized the same way.

Include this in the existing delete-account SQL in this pass. See the account-deletion section of the friends brief.

## Data model (Supabase)

Suggested tables; adjust names to match existing conventions. Costume claims and vote counting must be enforced server-side.

| Table | Holds | Key fields |
| --- | --- | --- |
| `runway_themes` | Theme catalog | id, name, venue background asset, sort order |
| `runway_costumes` | Costume catalog | id, name, slot (head/face/neck/body/back/feet), theme tags, art asset. Every piece fits dogs and cats |
| `runway_theme_rack` | Which pieces are on each theme's rack, in unlock order | theme\_id, costume\_id, rack position |
| `runway_tracks` | Music catalog | id, title, audio file path |
| `runway_shows` | One row per show | id, host player\_id, mode (solo/friends), theme\_id, track\_id, invites\_sent\_at, deadline, voting\_opens\_at, poll\_closes\_at, results\_revealed\_at |
| `runway_invites` | Who's in a friend show | show\_id, player\_id, status (invited, declined, submitted, judge), submitted flag |
| `runway_submissions` | A player's entry | show\_id, player\_id, pet snapshot (breed, look, life stage, weight), pet name, submitted\_at |
| `runway_looks` | The 3 frozen looks | submission\_id, look number (1–3), item ids with a copied colorway, costume ids with a copied colorway |
| `runway_costume_claims` | Once-per-show enforcement | show\_id, costume\_id, submission\_id; unique on (show\_id, costume\_id) |
| `runway_votes` | Votes | show\_id, voter player\_id, contestant submission\_id; unique on (show\_id, voter) |
| `runway_viewer_hides` | Per-player hide of a friend show | show\_id, player\_id; unique on (show\_id, player\_id) |

- The unique constraint on `runway_costume_claims` is what makes first-come-first-served safe when two players submit at once; insert all of a submission's claims in one transaction.
- Drip unlock times derive from `invites_sent_at` + rack position, so no scheduled job is needed.
- Votes store the voter only to enforce one vote each, and that vote cannot be changed. The app never displays who voted for whom. Account deletion removes the voter id and keeps the tally.
- `poll_closes_at` is `voting_opens_at` plus the poll length (15 minutes). Set both when voting opens.
- Theme, costume and track catalogs are downloaded like the Pet Shop catalog.

## Placeholder content

Use these as seed data with simple placeholder art; final art comes separately.

**Themes (venue backgrounds)**

Space Travelers · Under the Sea · Royal Ball · Beach Day · Winter Wonderland · Rock Star · Garden Party · Spooky Night · Wild West · Superhero City · Pirate Cove · Safari

**Versatile costume pieces**

| Piece | Slot | Theme tags |
| --- | --- | --- |
| Crown | Head | Royal Ball, Under the Sea, Winter Wonderland, Superhero City |
| Goggles | Head | Space Travelers, Under the Sea, Winter Wonderland, Pirate Cove |
| Antennae headband | Head | Space Travelers, Garden Party, Spooky Night |
| Flower crown | Head | Garden Party, Beach Day, Royal Ball |
| Top hat | Head | Royal Ball, Spooky Night, Rock Star |
| Head bandana | Head | Pirate Cove, Rock Star, Wild West |
| Star sunglasses | Face | Rock Star, Beach Day, Space Travelers |
| Eye mask | Face | Superhero City, Spooky Night, Royal Ball |
| Mustache | Face | Wild West, Pirate Cove, Royal Ball |
| Ruffle collar | Neck | Royal Ball, Pirate Cove, Spooky Night |
| Bow tie | Neck | Royal Ball, Garden Party, Spooky Night |
| Shell necklace | Neck | Beach Day, Under the Sea |
| Gold chain | Neck | Rock Star, Pirate Cove |
| Cape | Back | Superhero City, Royal Ball, Spooky Night |
| Sequin vest | Body | Rock Star, Space Travelers, Royal Ball |
| Tutu | Body | Royal Ball, Garden Party, Spooky Night |
| Leather jacket | Body | Rock Star, Wild West, Superhero City |
| Striped shirt | Body | Pirate Cove, Beach Day |
| Wings | Back | Garden Party, Spooky Night, Royal Ball |
| Jetpack | Back | Space Travelers, Superhero City |
| Glitter boots | Feet | Rock Star, Space Travelers, Royal Ball |
| Cowboy boots | Feet | Wild West, Rock Star |
| Rain boots | Feet | Garden Party, Winter Wonderland, Under the Sea |

**Theme-specific costume pieces (examples)**

Astronaut helmet (Space Travelers) · Pirate hat and eye patch (Pirate Cove) · Mermaid tail (Under the Sea) · Bumblebee antennae and stripes (Garden Party) · Lion's mane (Safari) · Cowboy hat (Wild West) · Wizard hat (Spooky Night) · Scarf and earmuffs (Winter Wonderland) · Pumpkin suit (Spooky Night) · Dinosaur hoodie, hot dog bun (any theme, as fun wildcards)

A theme's rack is those pieces, in that order: its own theme-specific pieces, then the wildcards, then versatile pieces tagged for it. Do not invent more pieces to reach 12.

**Music seed** (`docs/runway music/`)

- absolutesound-fashion-show-music-504647.mp3
- absolutesound-fashion-show-vogue-504648.mp3
- astronautflute-fashion-runway-music-554673.mp3
- bassloom-runway-rebel-553307.mp3
- bearstockmusic-fashion-runway-586679.mp3
- berrydeep-fashion-runway-565396.mp3
- echomoodz-runway-groove-246071.mp3
- maison_brava-runway-instrumental-376958.mp3
- maison_brava-runway-royalty-388307.mp3
- musictown-positive-fun-exploration-110144.mp3

## Closed for this pass

- NPC count is config, default 3. Looks follow the Solo NPC models section.
- Rewards are the winner banner and vote counts only. No ribbon, XP, or badge.
- Voters may skip models and rounds. Watching is not a completeness gate.
- Saved shows are kept forever, with hide (friend) / delete (solo) as above.
- No camera-flash washes.
