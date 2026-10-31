# Training, treats, and visible attributes

This is the current training and treat spec. It replaces the trick tracks, treat window, house training, and treat regen in `docs/boop-boop-care-training-brief-v2.md`.

## Treats

Boops, the ledger, the daily login, and the Pet Store are specified in `docs/Boop Boop — Currency System Architecture.md`. Treats are inventory in that ledger and work offline.

- A new wallet starts with 10 basic treats from the starter grant, plus the starter outfits. Special treats are casual only.
- Treats do not regenerate. Daily login pays Boops, not treats.
- Training spends basic treats only. Special treats stay casual until a later round.
- Mastering a trick does not grant treats. It pays Boops once, per the currency doc.
- The count never goes below 0. Stacks are not capped.
- There is no daily treat limit. A casual treat is refused only when hunger is already 0.
- A casual treat applies the full hunger, weight, and mood effects. A training reward skips the too-full gate, applies 25% of the hunger and weight, and keeps the full mood gain.

Boop Boop Town is the road between places: Home, Pet Shop, Park, Training School, Arcade, and Stadium. Tapping The Catwalk walks the pet there and opens the venue. Portrait uses a zigzag scaled to the width, up to 600 pt. The landscape split uses a horizontal road at full width. Both scroll vertically. The map uses the app sky, so night dims the buildings and the header, and the stadium keeps one set of waving pennants. Home rooms stay off the road. The room sheet offers Living room and Bedroom, and Catio for a cat. Leaving the living room, bedroom, catio, park, or training school walks the pet off to the right and fades the room, then puts them on the road outside that door. That leave ends the current action. Reduce Motion cuts straight to the road. Choosing the living room, bedroom, catio, park, or training school from the road cuts to that scene and the pet walks in from the left. Reduce Motion skips the walk-in. The Boops counter opens the Pet Shop too, and so do the out-of-treats popup and the break popup when it offers the shop. From any of those, the pet walks off to the right and the room fades before the shop cuts in. Closing the shop returns to the road outside the Pet Shop. Wardrobe on the home screen opens the Closet. Feed and Treat on the home screen each open a Pantry card: Feed chooses kibble or an owned special food, and Treat chooses an owned treat. A tap on the scene or outside that card closes it without serving. The Pantry screen still lists treats, premium food, and Second Wind. It is not a door on the road.

## Training flow

Tapping a trick that is not resting rolls success the same way as before: `clamp(0.55 + 0.003 × obedience + 0.004 × progress, 0.50, 0.97)`. A mastered trick always performs, with no modal and no payout.

- A miss plays the trick's failed clip when it has one, then the pet runs a short distance that stays on stage. The sheet opens 0.5 seconds after the pet stops. Reduce Motion skips the run and still waits 0.5 seconds. Closing the sheet walks the pet back to where the run started. Try again waits for that walk, then rolls the same trick. Not now closes. Miss copy rotates through a short list. The bar keeps its current progress. Misses pay nothing and cost no focus.
- A success plays the trick and opens the sheet 0.5 seconds after it finishes. The sheet shows the current progress and the progress a treat would add. Give a treat spends 1 basic treat and pays credit `1`, then plays an extra bark or meow on top of the trick. At home the button shows how many basic treats are left. At Training School the treats are on the house and the button has no count. No treat this time, leaving the scene, or backgrounding the app pays credit `0.25` and plays no extra sound. Give a treat with none left opens **Out of treats** and pays credit `0.25`.
- Only one training sheet is open at a time. Trick controls stay disabled while it is open and during the 0.5 second wait.

## Focus and rest

Each trick has its own session. A treated success costs 1 focus. A success without a treat costs 2. Misses cost 0.

Session length is `round(5 + 5 × clamp(stamina / 100, 0, 1))` from the shown stamina score, about 5 to 10 treated reps. It is read live. When focus used reaches that length, the trick rests until `restUntil` (10 minutes, `trickRestMs`). Other tricks stay available.

The break sheet shows a live countdown in the ring (`9:42`, or `1h 12m` once the wait is an hour or more). If any rep in the session was unpaid, the title is **Focus ran out!** and the copy says the pet needs a breather, then that Second Wind treats help them stay focused longer. The treat picture sits on the left. The countdown, that copy, the name, and how many are owned sit to its right. Otherwise the title is **What a session!** and the copy celebrates the trick. Tapping a resting trick, including the countdown on the Training School list, opens this sheet immediately and does not roll. When the timer ends, focus resets and the ring pulses once.

Owned Second Winds show **Use Second Wind** and how many are left. None owned offers **Visit Pet Shop**. After the daily limit, both of those are hidden and only **I'll wait** remains. The sheet does not buy a Second Wind in place.

The rep that fills the session still shows the success sheet first. The break sheet follows that choice, unless the trick just became mastered.

## Attributes

| Trick | Raises |
|---|---|
| Sit | obedience |
| Speak | boldness |
| Paw / High five | affection |

A treated rep passes 1.0 raw into the linked attribute. An untreated rep passes 0.25. Mastery passes 5 raw into the linked attribute, then 2 raw into intelligence, plus mastery XP. Intelligence only speeds later progress. The success roll is still obedience for every trick.

Training diminishing returns use exponent 1: `raw × (potential − shown) / potential`. Other callers of `trainingGain` keep exponent 2. Gain is 0 at potential.

Shown score is natural growth plus `attributes.trained`, plus drift, then the existing weight and aging multipliers, capped at potential. Training and playdate grants both add to `trained`, on top of natural growth. Playdate grants stay flat. A save that has no `trained` field copies `max(0, current − natural)` into it once.

The style label uses natural growth plus `trained`, as a fraction of potential. It does not use drift, weight, or aging. Another style still has to lead the birth archetype by 5%.

When a payout raises trick progress, a gold burst near the pet shows the rounded points and the trick name, such as `+15 Speak`. When the rounded shown score also rises by a whole point, a burst in that attribute's color follows, such as `+1 Intelligence`. Fractional attribute steps stay quiet. Mastery staggers the linked attribute and then intelligence.
