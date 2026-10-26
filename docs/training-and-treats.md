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

Where to? offers Pet Shop, Training School, Park, Living room, and Bedroom. Cats also get the Catio. The home controls stay on the room still showing until the new scene cuts in, for every place. Reduce Motion changes them with the instant cut. The Boops counter opens the Pet Shop too, and so do the out-of-treats popup and the break popup when it offers the shop. From any of those, the pet walks off to the right and the room fades before the shop cuts in. Wardrobe on the home screen opens the Closet. Feed and Treat on the home screen each open a Pantry card: Feed chooses kibble or an owned special food, and Treat chooses an owned treat. The Pantry screen still lists treats, premium food, and Second Wind. It is not a Where to? choice.

## Training flow

Tapping a trick that is not resting rolls success the same way as before: `clamp(0.55 + 0.003 × obedience + 0.004 × progress, 0.50, 0.97)`. A mastered trick always performs, with no modal and no payout.

- A miss plays the confused reaction and opens **Not quite**. Try again rolls the same trick. Not now closes. Misses pay nothing and cost no focus.
- A success plays the trick and opens **Good job**. Yes spends 1 basic treat and pays credit `1`, then plays an extra bark or meow on top of the trick. No, leaving the scene, or backgrounding the app pays credit `0.25` and plays no extra sound. Yes with no treats left opens **Out of treats** and pays credit `0.25`.
- Only one training modal is open at a time. Other trick rings are disabled while it is open.

## Focus and rest

Each trick has its own session. A treated success costs 1 focus. A success without a treat costs 2. Misses cost 0.

Session length is `round(5 + 5 × clamp(stamina / 100, 0, 1))` from the shown stamina score, about 5 to 10 treated reps. It is read live. When focus used reaches that length, the trick rests until `restUntil` (10 minutes, `trickRestMs`). Other tricks stay available.

The break modal shows a live countdown. If any rep in the session was unpaid, the copy says the pet lost focus and that treats help it stay focused longer. Otherwise it is the normal "needs a break" copy. The ring shows `Rest 9:42`, or `Rest 1h 12m` once the wait is an hour or more. Tapping a resting trick reopens the modal and does not roll. When the timer ends, focus resets and the ring pulses once.

The rep that fills the session still shows Good job first. The break modal follows that choice, unless the trick just became mastered.

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
