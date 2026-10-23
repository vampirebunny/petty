# Home screen UI

The pet screen's action panel is cotton-candy: glossy pink, blue, and lilac controls. Need rings, training cards, the Where card, the room height, the Expo Go gear, and the debug Settings link stay as they were.

The Boops counter in the upper right opens the Pet Shop.

## Sections

Care (pink): Feed, Water, Treat, Sleep. Sleep says Wake only once the pet is actually asleep.

Bond (blue): Cuddle, Play, Playdate. Playdate's label stays Playdate. The cooldown stays on the "Next playdate in …" line.

Style & sound (lilac): Wardrobe, Traits, Sounds, Music. Traits opens the personality scores under the buttons. Wardrobe opens the wardrobe. Sounds and Music are switches.

Learned tricks sit under those sections in the blue candy style. Badges are lilac coins and appear only after Sit, Speak, or Paw is awarded. The grey coins stay hidden. Mastered tricks also stay as trick buttons.

Play opens a card under the preview. It lists toys the pet owns. Today that is the ball. Tapping it throws the ball and closes the card.

A low Tummy, Hydration, or Energy (under 30) puts a need badge and sparkles on Feed, Water, or Sleep.

## Props

A tap on the water bowl, food bowl, or bed runs the same action as the button. The bowl fills, or the bed looks turned down, immediately. If the pet is free he walks there now. If he is busy he glances and keeps his task. When he is next free he visits inviting props oldest first. A second tap on a prop that is already inviting does nothing. The bed invite still calls him when energy is high. He is not asleep until he lies down, so a second Sleep tap does not cancel the walk, and Wake appears only after he curls up.

Holding a prop for 400ms lifts it so it can be moved. A tap never moves a prop. Floor flicks and cuddle strokes are unchanged.

## Tips

One candy tooltip shows at a time. Doing the action marks it seen. Dismissing it without acting allows one later show, then never again. Seen tips are stored on the device.

- `tip.water`, `tip.food`, `tip.sleep`: the first time that stat crosses under 30, pointing at the bowl or bed.
- `tip.cuddle`: the first time Cuddle is entered. Copy is "Stroke his back or head". The ghost finger and the long-press help sheet stay.
- `tip.move`: after two prop taps, or when a new placeable arrives once a prop tap has already happened. "Hold to move things around".

After a prop tip has been seen, that prop shimmers while its need stays under 30. Reduce Motion turns off the bob, the pulse, and the shimmer.
