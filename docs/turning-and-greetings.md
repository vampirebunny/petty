# Turning and greetings

Facing is eight octants: E, NE, N, NW, W, SW, S, SE. N is up the screen (away from the camera) and S is toward the camera. West-side octants are horizontal mirrors of the east-side views. Five views are drawn: side (E/W), front 3/4 (SE/SW), front (S), back 3/4 (NE/NW), and back (N). The body is foreshortened per view. It is not a squashed side profile.

Velocity picks the octant. The angle is `atan2(-vy, vx)`, quantized to 45°, and it switches only when the angle is more than 10° past the boundary. Below the rest speed (14) the last octant is kept. A turn moves at most one octant per step. Each step tweens foreshorten, shadow, hip spread, leg angle, and the head layout for 80ms on the outgoing draw order, then swaps that row once. The next octant waits until the tween has finished, so a step takes about 80ms (the hold is 75ms and runs during the tween). A tie on the ring, including E to W, goes through S. From pure N or S with equal paths, the last E/W sign picks the side. A change of more than one octant holds the pet in place until the displayed octant arrives. A one-octant change while moving tweens without stopping. A skid keeps the old octant until horizontal speed falls off.

Stopped, the body walks the ring back to E or W, then the existing 3/4 head idle eases in. `faceCam` turns only the head, and only while the body is on E or W. `actor.face` stays the horizontal sign: it updates on E and W, and N/S keep the last sign. Timings and the depth range live in `src/actor/data/facing.ts`.

## Pace

`src/actor/greetings.ts` (`motionMods`) is the clock for turns, step durations, and hop height. Values blend across the day before a stage change, and across senior vitality, so they do not pop on one frame.

| Stage | Pace | Hop | Tumble chance |
|---|---|---|---|
| puppy | 0.85 | 1.15 | 0.6 |
| older puppy | 0.88 | 1.15 | 0.3 |
| adolescent | 0.95 | 1.10 | 0 |
| adult | 1.00 | 1.00 | 0 |
| early senior | 1.15 | 0.80 | 0 |
| senior | 1.30 | 0.65 | 0 |
| elderly | 1.45 | 0.55 | 0 |

`needs.energy` below 35 multiplies pace by 1.15 and hop by 0.75. Pace still scales greeting step durations and hop height. Octant steps use the fixed timings above, not `0.4 * pace`.

## Who writes facing

While speed is above the rest threshold, the desired velocity owns the octant, including a greeting step that is moving. A greeting step with no translation uses the scripted `face` (`1`, `-1`, `flip`, `toward`, `keep`) to choose E or W, and the ring turns there before that step moves. `ownsFacing` means the greeting writes that horizontal sign and the head channels. It does not pin a run to the side view. `to: 'front'` is still the bottom center of the floor, so a pet off to the side approaches on SE or SW and a pet near center runs S. Fetch faces the toy on the way out and aims at the front of the floor on the way back. Eat, drink, sit, and sleep set the target octant to the bowl or body side and let the ring get there. They do not snap `face` on the arrival frame.

`faceCam` is the greeting step value, or 0 when the step omits it. Outside a greeting it is 0.5 for idle still, pant, and purr, and for sit, once the body is settled on E or W. It does not yaw the body, and it is ignored on every other octant. Idle still, pant, and purr keep the 3/4 head after that settle. A greeting may hold `headFront` on E or W. Depth scale is 0.9 at the back of the floor and 1.0 at the front, shared with the toy, and it can be turned off in the facing config.

One gait driver takes the max of locomotion, the turn shuffle, and a greeting march. Reduced motion keeps the turn and skips the shuffle.

## Greetings

Scripts live in `src/actor/greetings.ts`. The sim runs them as a `greet` task. Omitted step fields reset each step.

Bands, from `lastUpdatedAt`: under 2 minutes, nothing; under 5 minutes, the species short greeting (`wag`, `tailHello`); under 12 hours, one greeting; at 12 hours or more, two greetings. The second of a combo cannot teleport. `lastGreetingId` stores only that second greeting. The home "{name} missed you!" line stays. The old 12-hour wiggle cue does not.

Above 2 minutes, the current task ends and a sleeper wakes. A sleeping cat weights stretch by 3. A sleeping dog gets a short eyes-open, lie-to-stand step first. Trill starts off-screen and stretch starts on the bed, before the 0.35 s delay.

The Cuddle button is the pat control. Inside a pat window the first tap extends the step once and adds the usual pet mood plus 5. Later taps in that window only replay the sound and hearts. Outside the window, Cuddle interrupts and enters cuddle. Any other action interrupts.

There is no hungry-look closer and no sit-and-look closer. Crouch and butt-wiggle are not in the scripts. Rollover uses the existing belly channel. A raised tail uses `tailLift`. Play bow and knead use the existing formulas at 1. New draw channels are side, rearUp, headUp, headPush, jawHold, pupils, closeUp, rubSway, and legPedal.

Sounds use the existing clips. Yip, woof, and howl are barks. Whine is the happy dog clip. Meow, trill, and yawn are meows. Purr is the purr clip.
