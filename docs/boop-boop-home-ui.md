# Home screen UI

The pet screen's action panel is cotton-candy: glossy pink, blue, and lilac controls. Need rings, training cards, the Where card, the room height, and the gear stay as they were. The debug Settings link at the bottom of Home shows in a development build, including Expo Go, and stays off in a release build.

The home clock does not re-render the scene every second. It updates while a trick is resting, while the break sheet is open, once a minute at the training school for the shop's "New in" line, and once more when that countdown ends. The playdate cooldown line ticks only while a cooldown is running. A cuddle, a held piece, and a flick sample the finger once per frame. Taps, the start of a drag, and the release stay immediate.

The scene reports weight, energy, hunger, and thirst changes several times a second while the pet moves. Those changes do not re-render Home. They are kept in memory and saved with the next five-second foreground tick, or when the app goes to the background. Mood changes still go out right away. The action panel redraws only when a tile's label, blocked, pressed, or need state, a switch, or the trick list changes. A tap runs Home's newest handler, so a panel that skipped a redraw never acts on old state.

The Boops counter in the upper right opens the Pet Shop. So do the out-of-treats popup and the break popup when it offers the shop. The popup closes, the pet walks off to the right, and the room fades, then the shop cuts in. Reduce Motion skips the walk and opens the shop immediately. Closing the shop lands on Boop Boop Town, outside the Pet Shop. The shop's closet button still opens the wardrobe.

Go somewhere leaves the living room, bedroom, catio, park, or training school. The pet walks off to the right, the room fades, and then Boop Boop Town cuts in with the pet beside the door just used. Home rooms share the Home door. Reduce Motion skips the walk and the fade. That leave ends the current action, and a nap does not resume in the next place. The previous room is not kept under the map. From the road, tapping a door walks the pet there. Tapping The Catwalk walks the pet there and opens the venue. Portrait uses a zigzag scaled to the width, up to 600 pt. The landscape split uses a horizontal road at full width. Both scroll when the map is taller than the pane. The map uses the app sky, so night dims the buildings and the header, and the stadium keeps one set of waving pennants. Home opens a room sheet: Living room, Bedroom, and Catio for a cat. Choosing the living room, bedroom, catio, park, or training school cuts to that scene and the pet walks in from off the left. Reduce Motion skips that walk. Pet Shop and Arcade open those screens. Closing either one returns to the road outside that door. The Arcade lists Cloud Hop, Paddle Paws, and Stay. Cloud Hop and Paddle Paws play with the current pet. On a landscape split those two stay in a portrait column about 400pt wide. Stay uses the full window and does not draw the pet. Menu after a run returns to that list. Reduce Motion moves the pet instantly and shows the room sheet in place. A return of 3 hours or more cuts straight to the living room: the pet does not walk home, and the town, the shop, and the Arcade close.

## Sections

Care (pink): Feed, Water, Treat, Sleep. Sleep says Wake only once the pet is actually asleep.

Bond (blue): Cuddle, Play, Playdate. Playdate's label stays Playdate. The cooldown stays on the "Next playdate in …" line.

Style & sound (lilac): Wardrobe, Storage, Traits, Sounds, Music. Traits opens the personality scores under the buttons. Wardrobe opens the wardrobe. Storage lists owned furniture and trick props that are not out. Sounds and Music are switches.

Learned tricks sit under those sections in the blue candy style. Badges are lilac coins and appear only after Sit, Speak, or Paw is awarded. The grey coins stay hidden. Mastered tricks also stay as trick buttons.

Play opens a Toy Box card under the preview. It lists toys the pet owns. Tapping one throws or holds that toy and closes the card.

Feed and Treat open a Pantry card in that same place. Feed lists Kibble, which is always free, plus any special food this pet can eat. Treat lists the treats in inventory. Each owned stack shows a count. Tapping a tile serves it and closes the card. A full food bowl does not open the Pantry: it says the bowl is already full.

Storage, the Toy Box, the Prop sheet, the Pantry, and the bowl notice close the same way. A tap on the pet scene closes the card and does not pet, throw, cuddle, or serve. A tap on the empty area around the card closes it too. A tap on a tile still chooses that item.

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
- `tip.cuddle`: the first time Cuddle is entered. Copy is "Stroke his back or head". The ghost finger and the long-press help sheet stay. A tap outside that sheet closes it.
- `tip.move`: after two prop taps, or when a new placeable arrives once a prop tap has already happened. "Hold to move or store". The first time it appears it is marked seen, so a later tap or a new placeable does not bring it back.

After a prop tip has been seen, that prop shimmers while its need stays under 30. Reduce Motion turns off the bob, the pulse, and the shimmer.

## Wide screens

Phones stay portrait. A tablet or an unfolded foldable may rotate once its shorter side is at least 520dp. The landscape split starts at 600dp. Surface Duo rotates on one screen (about 540×720). Opened wide, hinge vertical, the window is about 1114×720 and uses the landscape split. Opened with the hinge horizontal, the window is about 720×1114 and stays stacked. Portrait, including an upright iPad, keeps the scene stacked above the controls.

In landscape, the header (logo, name, Boop counter) stays full width. On an opened Surface Duo the Boop total sits further in from the right edge, clear of the clock and status icons. The scene fills the left side. The controls sit in a column on the right, at most 400pt. When that column is narrower, the rings, Where card, training, and action panel scale down together so they stay on screen. The Toy Box, Pantry, Storage, and Prop cards open in that column, under the header. A tap on the scene still closes them. The seam is not locked to a fold hinge.

Wardrobe, the Pet Shop, the playdate outfit step, adoption, and the Stadium put the preview on the left and the choices on the right. Adoption uses that split for the design, choose, name, and meet steps. The step title stays across the top. The Stadium uses it for the lobby, ticket, sign-up form, and starting gate. The sign-up form fills that column instead of a bottom sheet. A race stays full screen. After a race the standings scroll, and Back to the Stadium stays under the list.

Boop Boop Town uses a portrait zigzag scaled to the width, up to 600 pt, and a horizontal road at full width on the landscape split. Both keep the top corner radius and scroll vertically when the map is taller than the pane. The map uses the same sky as the rooms: night dims the buildings, the header, and the door pills, and rain, snow, and the rainbow are drawn on the grass. The stadium keeps one set of waving pennants. Tapping The Catwalk walks the pet there and opens the venue. The room choices stay a centered group.

Get started keeps its phone-width column. The pink page fills the rest of the window.

Cloud Hop and Paddle Paws stay portrait on a landscape window: a column at most 400pt wide, centered, with that game's background on either side. Stay uses the full window.

Pantry and the rest of playdate stay one centered column of that same width so they do not stretch across the window.
