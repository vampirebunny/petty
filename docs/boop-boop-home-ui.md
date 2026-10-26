# Home screen UI

The pet screen's action panel is cotton-candy: glossy pink, blue, and lilac controls. Need rings, training cards, the Where card, the room height, the Expo Go gear, and the debug Settings link stay as they were.

The Boops counter in the upper right opens the Pet Shop. So does Pet Shop on Where to?, the out-of-treats popup, and the break popup when it offers the shop. The popup closes, the pet walks off to the right, and the room fades, the same as a scene change, and then the shop cuts in. Reduce Motion skips the walk and opens the shop immediately. Arcade on Where to? uses that same leave. After the cut, the Arcade lists Cloud Hop and Paddle Paws. Cloud Hop plays with the current pet. Paddle Paws is shown and does nothing. Menu after a Cloud Hop run returns to that list. Leave on the Arcade returns to the room the pet left, with no walk back in. A return of 3 hours or more cuts straight to the living room: the pet does not walk home, and Where to?, the shop, and the Arcade close.

Picking a place sends the pet there right away. The controls stay on the room still on screen until the scene cuts: the pet walks off to the right, the room fades, and the new room appears. At that cut the Where card, care actions, storage, and the school panel swap, and on a phone the shorter Training School stage arrives with them. The same wait applies to every place, including leaving the school. Reduce Motion has no fade, so the controls change with the instant cut. A return of 3 hours or more still cuts straight to the living room, and the controls match that room.

## Sections

Care (pink): Feed, Water, Treat, Sleep. Sleep says Wake only once the pet is actually asleep.

Bond (blue): Cuddle, Play, Playdate. Playdate's label stays Playdate. The cooldown stays on the "Next playdate in …" line.

Style & sound (lilac): Wardrobe, Storage, Traits, Sounds, Music. Traits opens the personality scores under the buttons. Wardrobe opens the wardrobe. Storage lists owned furniture and trick props that are not out. Sounds and Music are switches.

Learned tricks sit under those sections in the blue candy style. Badges are lilac coins and appear only after Sit, Speak, or Paw is awarded. The grey coins stay hidden. Mastered tricks also stay as trick buttons.

Play opens a Toy Box card under the preview. It lists toys the pet owns. Tapping one throws or holds that toy and closes the card.

Feed and Treat open a Pantry card in that same place. Feed lists Kibble, which is always free, plus any special food this pet can eat. Treat lists the treats in inventory. Each owned stack shows a count. Tapping a tile serves it and closes the card. Tapping outside the card closes it without serving. A full food bowl does not open the Pantry: it says the bowl is already full.

A low Tummy, Hydration, or Energy (under 30) puts a need badge and sparkles on Feed, Water, or Sleep.

## Props

A tap on the water bowl, food bowl, or bed runs the same action as the button. Water fills the bowl immediately. Feed opens the Pantry, and the bowl fills when a food is chosen. Sleep turns the bed down immediately. Once a meal or a nap is chosen, Play, a cuddle, a treat, a trick, and a park hello step aside, and a hello cannot pull the pet off that walk. Water does the same, except it waits while a meal or a nap is already underway and runs when that ends. A room change and a collapse nap still finish first. After those, Sleep and Feed go ahead of a care tap that was already waiting. A second tap on a walk that is already happening does nothing. The bed invite still calls him when energy is high. He is not asleep until he lies down, so a second Sleep tap does not cancel the walk, and Wake appears only after he curls up.

Holding a prop for 400ms opens a choice, Put in storage or Move, as a card over the scene. It does not drag yet. Move lifts the piece, and the next drag places it. A tap elsewhere cancels that lift and does not throw. Put in storage takes the piece off the floor and leaves it owned. Bowls ask first. The warning uses the pet's name: a food bowl says they won't be able to eat here, and a water bowl says they won't be able to drink here. A bed stores with no warning. Other furniture and trick props store with no warning. If the pet is walking to or using that piece, that action stops. Sleep still works in a room with no bed, and that rest is slower: +3 energy every 5 seconds instead of +5.

Saved furniture can come back only in a scene that belongs to the player. Living room, bedroom, and catio do. Park and Training School do not. A later scene sets the same flag. The player chooses the spot, including a food or water bowl in the bedroom. A room holds one food bowl and one water bowl. Trying to put a second one out says "There's already a food bowl in this room." or "There's already a water bowl in this room." A room also holds one bed. Placing a second bed asks to swap: the bed already there goes to Storage and the new one takes its spot. Cancel leaves both where they were. A new home starts with one standard bed in the living room and one food bowl and one water bowl. The bedroom starts without a bed. A new cat does not start with a catio water bowl. Storage lists every owned piece that is not already out. A piece that does not belong in the room on screen is inactive and cannot be placed. Park and Training School make every piece inactive. Trick props can still be put out there. They return to the box on a scene change, and a hold can store one before then.

Feed and Water follow the bowls saved in the room on screen. They do not follow bowls that exist only in the room template. A food bowl placed in the bedroom or the catio turns Feed on there. A water bowl turns Water on unless that bowl is already full. Leaving the room and coming back draws the saved spots again. A placement that does not save is taken off the floor. A bowl still counts when its saved record has no contents: a water id holds water, and any other bowl holds food.

While the app is open and the pet is asleep on a bed, rest pays +5 energy every 5 seconds times that bed's multiplier. The standard bed is 1×. Premium beds are 2× and deluxe beds are 2.5×, and those show a glow plus ×2 or ×2.5 on the energy ring. Guests and park visitors do not get the multiplier. Closing the app does not keep paying the bed rate. Bought beds go to Storage, with a one-time note. Extra food bowl and Extra water bowl stay in the Furniture section of the Pet Shop while the player owns fewer than three of that kind. The beds are in that same section. A room holds one bed, and the Pup Cabana counts as that bed. The pet walks onto the cushion from any side and lies in the middle, on top of the cushion. A standard bed is 2,500, and each bowl is 600. Marshmallow Mat (dog) and Cushion Stack (cat) are 4,500 and rest at 2×. Peach Chaise (dog) and Sultan Pillow (cat) are 6,500 and rest at 2.5×. The Pup Cabana is 6,000, dog only, and rests at 2×. It is open on every side, twice as wide and tall as the dog beds, and the canopy draws behind the pet.

A tap never moves a prop. Floor flicks and cuddle strokes are unchanged. Cuddle does not open the choice.

## Tips

One candy tooltip shows at a time. Doing the action marks it seen. Dismissing it without acting allows one later show, then never again, except `tip.move`, which is marked seen the moment it appears. Seen tips are stored on the device.

- `tip.water`, `tip.sleep`: the first time hydration or energy crosses under 30, pointing at the water bowl or bed. Hunger does not show a bowl tip.
- `tip.cuddle`: the first time Cuddle is entered. Copy is "Stroke his back or head". The ghost finger and the long-press help sheet stay.
- `tip.move`: after two prop taps, or when a new placeable arrives once a prop tap has already happened. "Hold to move or store". The first time it appears it is marked seen, so a later tap or a new placeable does not bring it back.

After a prop tip has been seen, that prop shimmers while its need stays under 30. Reduce Motion turns off the bob, the pulse, and the shimmer.

## Wide screens

Phones stay portrait. A tablet or an unfolded foldable may rotate once its shorter side is at least 520dp. The landscape split starts at 600dp. Surface Duo rotates on one screen (about 540×720). Opened wide, hinge vertical, the window is about 1114×720 and uses the landscape split. Opened with the hinge horizontal, the window is about 720×1114 and stays stacked. Portrait, including an upright iPad, keeps the scene stacked above the controls.

In landscape, the header (logo, name, Boop counter) stays full width. On an opened Surface Duo the Boop total sits further in from the right edge, clear of the clock and status icons. The scene fills the left side. The controls sit in a column on the right, at most 400pt. When that column is narrower, the rings, Where card, training, and action panel scale down together so they stay on screen. The Toy Box and Pantry cards open in that column, under the header. The seam is not locked to a fold hinge.

Wardrobe, the Pet Shop, and the playdate outfit step put the preview on the left and the choices on the right. Pantry, the rest of playdate, places, and adopt stay one centered column of that same width so they do not stretch across the window.
