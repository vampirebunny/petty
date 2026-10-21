# Turning and greetings

The pet no longer flips across its profile. Logical facing stays on `actor.face`. A visual yaw (0 right, π/2 toward the camera, π left) chases it at constant speed, compressing length and adding thickness so the body never becomes a sliver. The head stays on the existing 3/4 blend, except a greeting bark or meow, which eases the head to a symmetric front face for that step. On a reversal the head turns first, then the body follows, then the head settles back to profile. The body still stops at a 3/4 yaw.

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

`needs.energy` below 35 multiplies pace by 1.15 and hop by 0.75. A turn takes `0.4 * pace` seconds.

## Who writes facing

Free movement flips `face` only after horizontal speed has pointed the other way faster than 40 for 0.15 s, and it caps speed at 0.35 while that turn lasts. Fetch and eat still set `face` immediately, which starts the same turn. A greeting owns facing: only the script writes `face`, and the speed cap does not apply. A scripted face change waits until the turn finishes before the step moves. A spin is the exception: its own flips happen in the air with the hop, after any previous turn has finished.

`faceCam` has one writer. During a greeting it is the step value, or 0 when the step omits it. Otherwise it is 0.5 when the pet walks down the screen or is idle in still, pant, or purr. Idle still, pant, and purr also keep today's 3/4 head while stationary. A greeting may hold `headFront` while walking.

One gait driver takes the max of locomotion, the turn shuffle, and a greeting march. Reduced motion keeps the turn and skips the shuffle.

## Greetings

Scripts live in `src/actor/greetings.ts`. The sim runs them as a `greet` task. Omitted step fields reset each step.

Bands, from `lastUpdatedAt`: under 2 minutes, nothing; under 5 minutes, the species short greeting (`wag`, `tailHello`); under 12 hours, one greeting; at 12 hours or more, two greetings. The second of a combo cannot teleport. `lastGreetingId` stores only that second greeting. The home "{name} missed you!" line stays. The old 12-hour wiggle cue does not.

Above 2 minutes, the current task ends and a sleeper wakes. A sleeping cat weights stretch by 3. A sleeping dog gets a short eyes-open, lie-to-stand step first. Trill starts off-screen and stretch starts on the bed, before the 0.35 s delay.

The Cuddle button is the pat control. Inside a pat window the first tap extends the step once and adds the usual pet mood plus 5. Later taps in that window only replay the sound and hearts. Outside the window, Cuddle interrupts and enters cuddle. Any other action interrupts.

There is no hungry-look closer and no sit-and-look closer. Crouch and butt-wiggle are not in the scripts. Rollover uses the existing belly channel. A raised tail uses `tailLift`. Play bow and knead use the existing formulas at 1. New draw channels are side, rearUp, headUp, headPush, jawHold, pupils, closeUp, rubSway, and legPedal.

Sounds use the existing clips. Yip, woof, and howl are barks. Whine is the happy dog clip. Meow, trill, and yawn are meows. Purr is the purr clip.
