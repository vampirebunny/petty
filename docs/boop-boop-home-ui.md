# Home screen UI

The pet screen's action panel is cotton-candy: glossy pink, blue, and lilac controls. Need rings, training cards, the Where card, the room height, the Expo Go gear, and the debug Settings link stay as they were.

The Boops counter in the upper right opens the Pet Shop. So does Pet Shop on Where to?, the out-of-treats popup, and the break popup when it offers the shop. The popup closes, the pet walks off to the right, and the room fades, the same as a scene change, and then the shop cuts in. Reduce Motion skips the walk and opens the shop immediately. A return of 3 hours or more cuts straight to the living room: the pet does not walk home, and Where to? and the shop close.

## Sections

Care (pink): Feed, Water, Treat, Sleep. Sleep says Wake only once the pet is actually asleep.

Bond (blue): Cuddle, Play, Playdate. Playdate's label stays Playdate. The cooldown stays on the "Next playdate in …" line.

Style & sound (lilac): Wardrobe, Traits, Sounds, Music. Traits opens the personality scores under the buttons. Wardrobe opens the wardrobe. Sounds and Music are switches.

Learned tricks sit under those sections in the blue candy style. Badges are lilac coins and appear only after Sit, Speak, or Paw is awarded. The grey coins stay hidden. Mastered tricks also stay as trick buttons.

Play opens a card under the preview. It lists toys the pet owns. Today that is the ball. Tapping it throws the ball and closes the card.

A low Tummy, Hydration, or Energy (under 30) puts a need badge and sparkles on Feed, Water, or Sleep.

## Props

A tap on the water bowl, food bowl, or bed runs the same action as the button. The bowl fills, or the bed looks turned down, immediately. Feed and Sleep start now. Play, a cuddle, a treat, a trick, and a park hello step aside, and a hello cannot pull the pet off that walk. Water does the same, except it waits while a meal or a nap is already underway and runs when that ends. A room change and a collapse nap still finish first. After those, Sleep and Feed go ahead of a care tap that was already waiting. A second tap on a walk that is already happening does nothing. The bed invite still calls him when energy is high. He is not asleep until he lies down, so a second Sleep tap does not cancel the walk, and Wake appears only after he curls up.

Holding a prop for 400ms lifts it so it can be moved. A tap never moves a prop. Floor flicks and cuddle strokes are unchanged.

## Tips

One candy tooltip shows at a time. Doing the action marks it seen. Dismissing it without acting allows one later show, then never again, except `tip.move`, which is marked seen the moment it appears. Seen tips are stored on the device.

- `tip.water`, `tip.food`, `tip.sleep`: the first time that stat crosses under 30, pointing at the bowl or bed.
- `tip.cuddle`: the first time Cuddle is entered. Copy is "Stroke his back or head". The ghost finger and the long-press help sheet stay.
- `tip.move`: after two prop taps, or when a new placeable arrives once a prop tap has already happened. "Hold to move things around". The first time it appears it is marked seen, so a later tap or a new placeable does not bring it back.

After a prop tip has been seen, that prop shimmers while its need stays under 30. Reduce Motion turns off the bob, the pulse, and the shimmer.

## Wide screens

Phones stay portrait. A tablet or an unfolded foldable may rotate once its shorter side is at least 520dp. The landscape split starts at 600dp. Surface Duo rotates on one screen (about 540×720). Opened wide, hinge vertical, the window is about 1114×720 and uses the landscape split. Opened with the hinge horizontal, the window is about 720×1114 and stays stacked. Portrait, including an upright iPad, keeps the scene stacked above the controls.

In landscape, the header (logo, name, Boop counter) stays full width. On an opened Surface Duo the Boop total sits further in from the right edge, clear of the clock and status icons. The scene fills the left side. The controls sit in a column on the right, at most 400pt. When that column is narrower, the rings, Where card, training, and action panel scale down together so they stay on screen. The toy card and treat picker open in that column, under the header. The seam is not locked to a fold hinge.

Wardrobe, the Pet Shop, and the playdate outfit step put the preview on the left and the choices on the right. Pantry, the rest of playdate, places, and adopt stay one centered column of that same width so they do not stretch across the window.
