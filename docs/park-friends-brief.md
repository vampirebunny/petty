# Cursor Brief: Friends in the Park (live presence)

## Goal
When a player is in the park and one or more of their friends are also in the park at the same time, the friends' pets appear in the player's park. Friends see the player's pet in their own park too. Visiting pets behave like the NPC pets we've already built, including the existing pet-to-pet interactions. A small "Friends at the Park" bubble lists who's there.

## Player experience
1. The player goes to the park. During the existing scene transition, the app checks which friends are already in the park.
2. When the scene opens, those friends' pets are already in their spots, wearing their current outfits, and the "Friends at the Park" bubble shows who's there.
3. If a friend arrives later, their pet walks in from the left or right edge (random) to its spot, and from there behaves like an NPC pet.
4. If a friend leaves, their pet walks off the nearest edge.
5. If a friend changes their pet's outfit while in the park, the outfit updates on the visiting pet.
6. Up to **5 friends' pets** are shown at once, in addition to the player's own pet.

## Rules
- **Friends only.** Show only accepted, mutual friends. Never show blocked players, in either direction. If a friend is unfriended or blocked mid-session, remove their pet immediately (walk off).
- **Accounts only.** Guests (no account) can't have friends, so they see a normal solo park and broadcast nothing.
- **Park only.** Presence exists only while the park scene is open and the app is in the foreground. Other places (Home, Stadium, Training School, Pet Shop, etc.) don't broadcast or show visitors.
- **Offline is fine.** If there's no connection, the park works exactly as it does today, solo.
- **No positions are streamed.** Each phone places and animates visitors locally (see Placement and Visitor behavior). After arrival, nothing is sent except leave and outfit-change events.
- **Game effects match NPCs.** A hello with a friend's pet pays the same +2 mood, once per visitor, into the same +6 per 10 minutes cap as an NPC hello. NPC visitors keep their own roll, so the grass can hold the player's pet, one NPC, and up to five friends. Visitors never trigger park finds. Park finds remain only for the player's own pet.

## Presence payload (appearance snapshot)
Sent once on entering the park and updated only when the outfit changes. The row is the existing friend-pet record the renderer already draws (breed, look, seed, outfit, age, weight, and wear defs when the sender has them), plus `@handle` and `entered_at`. A heartbeat updates `last_seen` only.

The viewer's phone renders the visiting pet with the existing pet renderer and catalog assets.

**Missing assets:** If the viewer doesn't have an equipped item locally (newer catalog item, not yet downloaded), try to fetch it from the catalog. If that fails, render the pet without that item. Never crash or show a broken or blank item.

## Entering the park (sequence)
1. Start the existing transition and, in parallel, register this player as present and fetch the current list of friends in the park.
2. Wait for the list for **at most ~1 second**. Load any missing outfit assets during the transition.
3. Place returned visitors (up to the cap) at their spots, already idling, then open the scene.
4. If the list arrives after the timeout, those pets walk in from the edges instead. A slow connection should look like friends arriving, not a frozen loading screen.
5. **Dedupe by pet ID.** A friend may appear in both the initial list and a join event. Ignore a join for a pet that's already placed or already waiting.

## Leaving / disconnects
- On leaving the park scene or the app going to the background: send leave and disconnect.
- On a crash or lost connection: the friend's pet must disappear on its own. Use a heartbeat (about every 30s while in the park). If a presence entry hasn't been refreshed in about 90s, treat it as left.
- On returning to the foreground while still in the park: re-register and resync, using the same dedupe rules.

## Cap: 5 visitors
Each phone decides which 5 friends to show (views don't need to match between players):
- **On entering:** if more than 5 friends are present, show the five who have been in the park the longest (`entered_at`). A later arrival does not bump someone already visible.
- **When a 6th+ friend arrives:** add them to a hidden waiting list.
- **When a visible friend leaves:** the waiting friend who arrived earliest walks in from an edge.
- Make the cap a config value, not a hardcoded number.

## Placement
- Each visitor's spot is chosen by a **seeded random from the pet ID**, so it's stable and every phone computes the same spot without sending positions.
- Spots must be within the park's walkable area and not overlap the player's own pet's current position, props, or other visitors. If the seeded spot is blocked, step to the next seeded candidate.
- The player's own pet keeps behaving exactly as it does today.

## Visitor behavior
- **Reuse the existing NPC pet system.** A visiting friend's pet is driven by the same behavior and pet-to-pet interaction logic as NPC pets. The only difference is that its appearance comes from the presence snapshot instead of NPC data. Don't build a separate behavior system.
- Behavior and interactions run locally on each phone and aren't synced. Two friends may see different things happening between the same pets, and that's fine.
- If multiple visitors are present, the NPC interaction logic should handle multiple partners the same way it would with multiple NPCs. If the current NPC system only supports one partner at a time, keep that rule and let the other visitors idle until it's their turn.
- Entry and exit walks use the normal walk animation at a normal speed, facing the direction of travel. If a visitor leaves mid-interaction, end the interaction cleanly and then walk off.
- Tapping a visitor does nothing for now.

## "Friends at the Park" bubble
- A small window styled like the existing "try this" bubble.
- **Title:** "Friends at the Park"
- **Below the title,** one row per friend currently in the park: a green dot (an "online" indicator), then `@handle`.
- List only the friends whose pets are currently shown (max 5), in the same priority order as the cap. Friends on the waiting list don't appear.
- Updates live: a row is added when a friend's pet appears (including when a waiting friend moves up into a free slot) and removed when they leave.
- **If no friends are in the park, don't show the bubble at all.** It appears when the first friend arrives and disappears when the last one leaves.
- Rows aren't tappable in this version.
- Shouldn't cover the pets or the park's main controls. Place it where the existing "try this" bubble sits, or nearby if they'd collide.

## Backend approach (Supabase)
Use Supabase as the source of truth. Checked against the current Realtime docs (Broadcast is preferred for scale, and private channels require turning off public Realtime access). Stadium race channels still use public Broadcast, so park presence uses Postgres Changes instead. RLS on the table means a client only receives rows they are allowed to read. One channel, three listeners: `park_presence`, `friendships`, and `blocks`.

- **Privacy is enforced server-side.** A client must never receive presence for players who aren't their friends, or who have blocked them or been blocked by them. There is no shared channel of every park player.
- **One live subscription per viewer**, regardless of friend count.
- A `park_presence` table: one row per player currently in the park. RLS lets a linked player read and write only their own row, and read a friend's row. Writes go through RPCs. Anonymous users cannot.
- On entering: upsert own row, then the RPC returns friends' rows for the initial list.
- Join, leave, outfit, and `last_seen` updates arrive as Postgres Changes on `park_presence`. An unfriend or block arrives on the same channel because each user can read friendship and block rows they are part of, and the other pet walks off immediately. A block does not delete the presence row, so other friends still see that pet.
- Heartbeat updates `last_seen` about every 30s. Stale rows (about 90s) are ignored by clients and deleted at the start of the enter and heartbeat RPCs. No cron.
- After arrival, the only row changes are leave, outfit, and that heartbeat. Positions are not sent.

## Account deletion and blocking
- Account deletion removes the player's `park_presence` row along with their other friend data.
- Blocking or unfriending takes effect immediately in the park, as described above.

## Out of scope (don't build now)
- New pet-to-pet interactions beyond what the NPC system already does
- Name tags over pets, profiles, or tapping visitors or bubble rows
- Visiting a specific friend's park, or park instances/rooms
- Presence anywhere other than the park
- Notifications that a friend is in the park

## Acceptance checks
- Two test accounts that are friends: A enters the park, then B enters. B's scene opens with A's pet already there and the bubble showing A's @handle. A sees B's pet walk in from an edge and B's @handle appear in A's bubble.
- Visiting pets interact with the player's pet exactly like NPC pets do.
- With no friends in the park, no bubble appears. When the last friend leaves, the bubble disappears.
- B changes outfit in the park, and A sees the change.
- B backgrounds the app, and A sees B's pet walk off. Killing B's app makes B's pet disappear within about 90s.
- A non-friend in the park never appears. A blocked friend disappears immediately.
- With 7 friends in the park, exactly 5 are shown. When one leaves, a waiting friend walks in.
- Airplane mode: the park opens normally and solo, with no errors.
- A friend wearing an item the viewer lacks either downloads it or shows the pet without that item, with no crash.
