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
- **One piece per slot:** choosing another closet item or costume for a slot replaces what was there. Closet items and costumes share hat, glasses, neckwear, jacket, and boots. Back is costumes only. Closet `OutfitSlot` stays the five everyday slots; costumes use the same names plus `back`.
- **Music:** one track from a list stored in Supabase for the whole show. The inviter picks it for a friend show (invitees hear it but don't choose it); the player picks it for a solo show. Playback loops that track for every round and every model, including across skips. The app mute switch silences it. If the track is missing locally, play silently. No error, no fallback track, and **no bundled runway music** (keeps the binary small). Source files are the ten re-encoded MP3s listed under Music seed (128 kbps stereo). Host them in the public Storage bucket `catwalk-music` (same public-read pattern as `background-music`). Object names match the filenames and `runway_tracks.audio_path`. The client downloads every object into `Documents/catwalk-music/` when Home runs `prepareRemoteMusic` (and again on foreground / network restore), skipping any file that already exists with size > 0 — there is no content-hash check. To ship an updated take of a track, upload under a **new** object name and point `audio_path` / the client `fileName` at it.
- **Theme:** solo shows, the player picks it. Friend shows, the inviter picks it when sending invites, and it applies to everyone. The theme sets the venue only — every theme shares the same 23-piece costume catalog. The picker shows a large still of the selected theme (left pane on a widescreen split, top on a phone) and a 2-column grid of baked thumbnails. The still stays put while the grid scrolls. It fills its pane (`cover`); on a phone the pane is 4:3 so the crop matches the thumbnails. The stills are `assets/runway-themes/<id>.png` (`@2x` / `@3x`), cut from each show set with the lighting baked in. Tapping a thumbnail selects it; Continue moves on.
- **Music:** a dropdown, not its own screen. A solo player picks it on Backstage. A host picks it on Invite friends, and after the invites go out it is locked. Invitees see it read-only ("picked by @host") with a play control. The play control previews ~10 seconds of the downloaded track (sound bars while it plays). Missing local audio stays silent.
- **Lobby:** the hero is a muted looping video in `assets/lobby/` (`catwalk-phone` on a phone, `catwalk-tall` filling the left pane on a widescreen split). Each file is an MP4 plus a PNG poster of the first frame. The poster shows until the video's first frame, and it is the only frame when Reduce Motion is on. Playback pauses in the background and stops when the lobby unmounts. "Strut your stuff" is drawn as text over the clear center. The lobby header keeps Back on the left and, on the right, the Boop Boop app mark and the same pink settings button as the living room and bedroom. A waiting friend request puts the same red dot on that button. Opening Settings covers The Catwalk and returns to the same step. Later steps keep Back and the title only. There is no falling confetti. Under the banner: pending **Show invites** (status `invited`, Join), then one button per show this player started, accepted, submitted, judged, or dismissed (**Not now**), then Invite friends, Solo show, and Past Shows. Widescreen puts the tall hero on the left and the controls in a phone-width column, the same split Stadium uses.
- **Joined-show buttons:** each names the show (Your show / `@host` · theme) and a second line: **Select looks** (opens Backstage), **You already submitted** (opens status), **Cast your vote** / **Vote already cast; polls still open**, **You were invited** (dismissed invite → join again), **Submissions are closed**, or **Results in**. Opening results marks that show seen on this device (`petty.runway.seenResults.<ownerId>`); the lobby button does not return. Opening a show while submissions are closed marks it seen (`petty.runway.seenClosed.<ownerId>`); that lobby button stays down until voting opens or results are in, then it can return for the new step. The show stays in Past Shows.
- **Backstage:** the light page (`#FBF4FF`). The pet sits in a 3/4 sit pose over the selected theme still. That preview stays put (left pane on a widescreen split, top on a phone) while the closet scrolls. Look 1/2/3 chips stay pinned under the preview. Closet sections and the costume rack stay stacked in the scroll under the chips. "Next: Look N" stays pinned at the bottom, outside that scroll, and advances the pinned look tab. On the last look the button is "Start the show" (solo) or "Submit looks" (friends). Picking anything in an occupied slot replaces it, whether the old piece was a Closet item or a costume.
- **Snapshot on submit:** the three looks lock forever. Store each worn item's id and a copy of the colorway it resolved to (its colors and its clothing pattern, which live together on the item). Store each costume the same way. Later Closet changes, and a later recolor of the catalog item, do not change the show. Playback uses the current drawing code for that shape with the saved colorway. There is no new closet model: players still pick items, not a color and a pattern on their own.
- **No theme tags on wardrobe items.** Costumes are shared across themes (no theme-tag filtering).

## Costumes

Art lives in `assets/runway-costumes/`: `rack/` PNG thumbnails (`@2x` / `@3x`) for the backstage rack, `worn/` SVGs drawn on the pet, and `catalog.json`. Worn XML is generated into `src/runway/costumeSvgXml.ts`. Attach is in `src/ui/skia/costumeWorn.ts` and `src/ui/skia/cosmetics.ts`.

Reference rig (side-view dog, facing +x, ground y 0): head radius 21 at (54, −88), body 92 × 48 at (0, −56), leg width 10.

| Slot | Origin | Placement |
| --- | --- | --- |
| hat | head center | Head position and pitch; scale `headR / 21` |
| glasses | head center | Lenses on the near eye (reference (6, −4), r 3.8), scale `eyeR / 3.8`. Mustache on the muzzle (reference (17, 7), rx 14), scale `muzzle.rx / 14`. Clamp 0.7–1.4 × `headR / 21` |
| neckwear | neck (40, −66) | Chin; scale `headR / 21` |
| jacket | body center | `(0, bodyY)`; scale x `bodyLen / 92`, y `bodyH / 48`. Skip worn art on the front and back passes |
| back | withers (14, −80) | Torso rotation; the withers point follows 3/4 foreshorten and pose scale; scale `bodyH / 48` |
| boots | each paw | Shin angle; scale `legWidth / 10`; far paws darkened 28% |

Draw order: far legs → far boots → tail → neck and body → jacket → near legs → near boots → back → neckwear → head → glasses → hat. The eye mask is drawn over the eye, then the near eye is drawn again so it shows through the hole. Some costume ids match Closet items (`crown`, `bowtie`, `vest`, `bandana`); worn art is chosen by the `costume: true` flag, not by id.

- **Shared 23-piece catalog:** every theme uses the same rack (hat, glasses, neckwear, jacket, back, boots). There are no theme-specific or wildcard seed tables.
- **Runway-only:** costume pieces never enter the Closet, are never owned, and never appear in playdate outfit rotations.
- **Pieces, not full costumes:** each piece attaches to one slot. Every costume fits dogs and cats. There is no species fit.
- **Back slot:** cape, wings, jetpack. Costumes only; the wardrobe doesn't use it.
- **Reuse across looks:** a player may use the same costume on Looks 1–3. Wardrobe items stay reusable across looks too.
- **FCFS between players only:** `runway_costume_claims` still enforces one claim per costume per friend show. UI "Taken" is for another player's (or seeded NPC's) claim — not for the player's own prior looks.
- **No per-player cap:** a player may claim as many available pieces as they like on a look (one per slot).
- **Claim on submit (friends):** selecting a piece doesn't reserve it. The claim happens on the server when the player submits. If a piece was claimed by someone else while the player was building, block submission and show: "Someone already claimed the \[piece\]. Pick another piece for Look \[n\]."
- **Drip unlock (friend shows):** unlock in catalog order by tranche — **8 / 8 / 7** at `invites_sent_at + 5m`, then `+2m`, then `+2m` (full rack by ~9m). Locked tiles show a countdown. Above the costume rack, while any piece is still locked: "Costumes begin unlocking in 5 minutes and then every few minutes after that." Config: `dripFirstUnlockMin`, `dripTrancheGapMin`, `dripTrancheSizes`.
- **Solo shows:** the full catalog is on the rack. A seeded third (`round(23/3) = 8`, by show id) is unlocked immediately. The other pieces stay locked, with no countdown and no drip. Player and NPCs share that unlocked third; NPCs only take unclaimed leftovers. Store `soloRackIds` on the local show for stable replay. NPC invitation shows use this same rack, not the friend drip.
- **Friend deadline:** the host picks **15 minutes, 30 minutes, 1 hour, or 24 hours** (default 15). The client stamps the deadline from `serverNow()` plus that span. Reject a time already past or less than **10 minutes** from create (`runway_config.min_deadline_minutes`, migration `20261031300000_runway_deadline_grace.sql`). The floor sits below the shortest choice so send latency and clock drift never reject a tapped option.

## Friend shows

Friends submit anytime before a deadline. A contestant can't peek until they've submitted. Declined invitees are out. Then everyone left votes, and results reveal once the last vote is in or the poll closes.

**Invites**

- Reuse the friend-competition invite picker: up to 5 friends, with the 5 most recently invited friends shown for quick reselection.
- The inviter picks the theme, the music track, and the deadline, and sends invites via push and in-app notification.
- **Deadline:** the host picks 15 minutes, 30 minutes, 1 hour, or 24 hours from server now. Store that instant in UTC. Each friend sees it in their own zone. Reject a time that is already past or less than 10 minutes from create.
- Show size is the host plus up to 5 invitees (max 6 contestants).
- An invitee may decline. A decline removes them from the runway and from the vote, and they no longer count as someone the show is waiting on. The invite stays on the lobby list, and that friend can accept it later (`20261031280000_runway_declined_invites.sql`). Being in one show does not block joining or hosting another.

**Submitting**

- Invitees, and the host, can submit anytime up to the deadline.
- A player can't watch submitted shows until every contestant has submitted, or the deadline has passed, whichever comes first. A judge-only player has no looks to submit, so this wait does not apply to them.
- An invitee who opens the invite after the deadline sees a modal: "Submissions are closed, but you can still be a judge! We'll let you know when voting opens." If voting is already open, open the vote screen. After submitting, and before everyone else has submitted and before the deadline, the status screen shows the countdown, who has submitted, "Come back when all friends have submitted.", and "Return to lobby". "Watch submitted shows" appears once every contestant has submitted or the deadline has passed.
- The vote screen is one row per contestant and a single "Cast my vote". It does not offer a per-row replay.
- Results show the winner banner (every pet tied for the top count), each vote total, "Watch the show again", and "Back to The Catwalk".
- The host follows the same rule. If the host has not submitted when the deadline arrives, they become a judge: they do not walk, and they can still vote.

**Voting**

- Voting stays shut until every contestant who has not declined has submitted, or until the deadline. An early submission does not open voting, and it does not start the poll clock.
- The poll closes 15 minutes after voting opens. That length is a config value. A "last submission plus 15 minutes" time that is already past when voting opens is ignored, so the poll cannot close before anyone can vote.
- Every invitee can vote, including judge-only players and a host who never submitted. One vote each. It cannot be changed. Players may vote for themselves.
- Push notifications: when a friend submits their outfit (every invitee except the submitter, and except anyone who declined), when voting opens, and when results are ready. If the app is open, show the in-app notice instead of a system banner.

**Results**

- Results are revealed when the last vote is cast. If someone never votes, results reveal when the poll closes.
- Show each contestant's final vote count, and a winner banner for the highest count. A tie puts every pet tied for that count on the banner. There is no tiebreaker.
- Never show who voted for whom.

## Runway presentation

Shows play in rounds, one round per look: every model walks once per round, the player's own model first, before the next round starts. Enter/exit move the pet on X with the venue still; walk steps keep the pet at center and scroll the venue (see steps below). Venue FX (beams, follow spot, LED chase, flashes, particles, theme extras) draw from each theme's `fx.json`; reduced motion keeps a static lit set.

- **Rounds:** Round 1 shows every model in Look 1, Round 2 every model in Look 2, Round 3 every model in Look 3. This applies to NPC shows and friend shows alike. Show a "Look 1 of 3" label for the round that is playing.
- **Order within a round:** the viewing player's model walks first, then the others by submission time. A judge-only viewer has no model, so their rounds start with the first submitted model.
- **Skip model:** ends the current model's walk and starts the next model in the round. Any viewer can skip, including a voter or a judge. Watching is the path into the vote screen; a voter does not have to finish every model or round before voting.
- **Skip to next round:** jumps to the first model of the next round. In the last round it ends the show (to voting or results in a friend show). Same skip rules for voters and judges.
- **Music:** the show's one track loops for the entire show, including across skips. Scene background music is held for the whole time the runway is open (start to the end modal), including when the track is missing or music is muted. Music holds are per owner (`holdMusic(on, owner)`: `runway`, `runwayPreview`, `arcade`), so one releasing can't bring scene music back under another.
- **End of show:** the runway track stops, the last frame holds, and a one-second applause plays (`assets/sounds/vvqne-applause-383901.mp3`, with the fade-out baked into the file; it follows the pet-sounds switch). There is no applause during the show. A FunModal ("That's a wrap!") offers **Replay** (restarts the show and its track) or **Return to The Catwalk**. When the show opened because voting just opened, the secondary button is **Continue** and opens the vote screen. Skipping past the last round lands on the same modal.
- **Friend replay cast:** Watch / Continue reloads `get_runway_show` and merges submissions by id so a friend who submitted after the screen first loaded still walks. Looks resolve by `lookNumber` (`lookForRound`), not array index alone.
- **Zoom:** closer than the home scene, less than the Closet close-up. The full pet (top of a hat down to boots) stays in frame.
- **Venue:** seven SVG layers plus `fx.json` per theme, in `assets/runway/<theme>/`. The app embeds them in `src/runway/venueSvgXml.ts` and `src/runway/venueFxData.ts`. Stack is 990 px, paws at y 687, tile 1200 px. Layer y, height, and scroll speed are `venueLayerLayout` in `src/runway/venue.ts`. Draw order and live FX (beams, follow spot, LED chase, flashes, particles, theme extras) are `src/ui/runway/venueFx.ts`. Reduced motion keeps the set lit and still. The pet never collides with anything.
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
| Cadence | by speed | 1.7 stride cycles per second (`strutCadenceHz`), venue at 160 stack px/s (`strutStageSpeed`) |

Each model's walk, in seconds (`runwaySteps`):

1. **Enter (1.6):** the pet struts from off-screen left to center. Venue is still.
2. **Walk out (2.2):** the pet struts in place at center; the venue scrolls right to left.
3. **Stop (0.4):** speed eases to zero and the paws settle under the hips.
4. **Pose (0.9):** the pet faces the audience with a faster wag. This step ships on. A config flag can skip it, and the turn then follows the stop.
5. **Turn (0.5):** the pet turns through the front view to face left.
6. **Walk back (2.2):** speed eases up over 0.35 s; the venue scrolls left to right.
7. **Exit (1.7):** venue is still; the pet struts from center to off-screen left.

The next model enters from the left after the previous one exits, so outfit changes always happen off-screen. The runway floor layer scrolls at exactly the pet's ground speed so planted paws don't slide.

## Solo NPC models

Config sets how many NPC models walk (default 3). Guests can run solo shows.

- **When:** generate NPC looks right after the player submits their 3 looks, not before. Snapshot them exactly like a player submission (items, colorways, costume pieces) so replays never change. Seed all randomness with the show id.
- **Who:** generic NPC pets (random species, breed, fur, name) from the existing NPC pet generator, behind one function `pickNpcModels(show)`. Do not build another source now.
- **Wardrobe:** evergreen catalog items only, via the same rule as playdates (`npcMayWear`: never `limited` or `exclusive`). Filter Closet fit with `fitsSpecies` (species, not breed). Color family comes from the item's `colorway.c`; there is no separate `mainColor` column. Prefer the costume's family or neutrals (white, black, grey, brown). Goofy may clash.
- **Costumes:** only pieces from the show rack (solo: the seeded 8) that the player did not claim on any look. NPCs never take a piece the player used.
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

- **Past Shows:** a list inside the venue. Friend shows appear for everyone invited, including judge-only players and players who declined then joined later. When results are in, each card lists vote standings. While voting is still open, a **Voting still open** button opens the show (runway first when needed, then the vote).
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
| `runway_costumes` | Shared 23-piece costume catalog | id, name, slot (hat/glasses/neckwear/jacket/back/boots), art asset. Every piece fits dogs and cats |
| `runway_tracks` | Music catalog | id, title, audio file path |
| `runway_shows` | One row per show | id, host player\_id, mode (solo/friends), theme\_id, track\_id, invites\_sent\_at, deadline, voting\_opens\_at, poll\_closes\_at, results\_revealed\_at |
| `runway_invites` | Who's in a friend show | show\_id, player\_id, status (invited, declined, submitted, judge), submitted flag |
| `runway_submissions` | A player's entry | show\_id, player\_id, pet snapshot (breed, look, life stage, weight), pet name, submitted\_at |
| `runway_looks` | The 3 frozen looks | submission\_id, look number (1–3), item ids with a copied colorway, costume ids with a copied colorway |
| `runway_costume_claims` | Once-per-show enforcement | show\_id, costume\_id, submission\_id; unique on (show\_id, costume\_id) |
| `runway_votes` | Votes | show\_id, voter player\_id, contestant submission\_id; unique on (show\_id, voter) |
| `runway_viewer_hides` | Per-player hide of a friend show | show\_id, player\_id; unique on (show\_id, player\_id) |

- The unique constraint on `runway_costume_claims` is what makes first-come-first-served safe when two players submit at once; insert all of a submission's claims in one transaction.
- Friend drip unlock counts derive from `invites_sent_at` + tranche times (5m / +2m / +2m), so no scheduled job is needed.
- Votes store the voter only to enforce one vote each, and that vote cannot be changed. The app never displays who voted for whom. Account deletion removes the voter id and keeps the tally.
- `poll_closes_at` is `voting_opens_at` plus the poll length (15 minutes). Set both when voting opens.
- Theme and costume catalogs ship in the client (`src/runway/catalog.ts`) and are mirrored in Supabase seed tables. Track **metadata** is the same pattern (`runway_tracks` + client list). Track **audio** is Storage-only: downloaded like remote scene music (`src/audio/remoteCatwalkMusic.ts`), not like the Pet Shop catalog.
- Show rows are not readable with SELECT. `get_runway_show(show_id)` returns one show the caller hosts or is invited to (contestants, claims, and — only after they have submitted, become a judge, or voting/results are open — other players' looks). Vote counts are included only after `results_revealed_at`. `list_my_runway_shows()` returns the caller's shows for the lobby and Past Shows (including declined invites; excluding withdrawn), with `voted`, `standings` (after results), and winner handles, plus the five friends they invited most recently. Vote standings count `contestant_submission_id` (`20261031290000_runway_list_vote_count.sql`); vote rows have no `id`. Both RPCs are `security definer` and granted to `authenticated`.
- `submit_runway_looks` returns `voting_opened` when that submit opened the poll. `cast_runway_vote` returns `results_revealed` when that vote revealed the results. The deployed `notify_runway_show` Edge Function sends invite (`runway_show`), each outfit submit (`runway_submitted`), voting open (`runway_vote`), and results (`runway_results`).

## Placeholder content

Use these as seed data with simple placeholder art; final art comes separately.

**Themes (venue backgrounds)**

Space Travelers · Under the Sea · Royal Ball · Beach Day · Winter Wonderland · Rock Star · Garden Party · Spooky Night · Wild West · Superhero City · Pirate Cove · Safari

**Shared 23 costume pieces** (see `assets/runway-costumes/catalog.json`)

Crown, Goggles, Antennae, Flower Crown, Top Hat, Bandana (hat) · Star Glasses, Mask, Mustache (glasses) · Ruffle, Bow Tie, Shells, Chain (neckwear) · Vest, Tutu, Jacket, Stripes (jacket) · Cape, Wings, Jetpack (back) · Glitter / Cowboy / Rain Boots (boots).

Every theme uses this full list. Solo shows unlock 8 at random by show id and leave the rest locked. Friend shows drip 8 / 8 / 7 in catalog order.

**Music seed** (uploaded to Storage bucket `catwalk-music`)

Re-encoded as 128 kbps stereo, 44.1 kHz MP3 (same profile as scene background music). Not shipped in the app bundle — download-only via `syncCatwalkMusic` (kicked from `prepareRemoteMusic` on Home):

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

Public URL shape: `{SUPABASE_URL}/storage/v1/object/public/catwalk-music/{filename}`

Failures: offline or a single bad download leaves other tracks alone, deletes the `.part` file, and retries on the next foreground / network restore. A show whose chosen file is not on disk yet plays with no music.

## Closed for this pass

- NPC count is config, default 3. Looks follow the Solo NPC models section.
- Rewards are the winner banner and vote counts only. No ribbon, XP, or badge.
- Voters may skip models and rounds. Watching is not a completeness gate.
- Saved shows are kept forever, with hide (friend) / delete (solo) as above.
- No camera-flash washes.
