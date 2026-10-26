// Every wardrobe measurement lives here. Strokes and puffs are stage units. The rest are
// multipliers on a length that already scales with species, breed, life stage, and weight.

export const wardrobeSizes = {
  outline: 2,
  trim: 1.15,
  trimDistance: 110,
  chin: 0.85,
  // When the neck lies flat (sleep/lie), park the chin just past the head rim toward the body.
  chinFlatAlong: 0.28,
  chinFlatClear: 1.08,
  // When the head sits on the shoulders, put the chin this far along the short head→body segment.
  chinShort: 0.55,
  // Sleep: throat under the jaw, in head radii. X is toward the muzzle, Y is down the screen.
  chinLieX: 0.02,
  chinLieY: 0.58,
  // Collar/bandana span across the neck shrinks this much when the neck is horizontal (avoids a tall face slash).
  neckFlatShrink: 0.85,
  // Tag/bell hang and bandana tip shrink when the neck is flat so they do not sit on the floor.
  neckFlatHang: 0.8,
  // Sleep still needs a visible bib and tag under the jaw. This is the smallest hang scale.
  neckLieHang: 0.55,
  // Turned collar sits this far back from the muzzle tip, in muzzle radii (1 ≈ rear of the muzzle / throat).
  collarJawBack: 1.05,
  // Extra drop below the muzzle underside, fraction of headR. Clears the mouth, tag still meets the band.
  collarJawDrop: 0.12,
  // How far a turned head pulls the chin from the neck toward the jaw. Keep below 1 so sit/3/4 stays on the neck.
  collarJawBlend: 0.38,
  collarBand: 0.27,
  collarTag: 0.3,
  collarStud: 0.08,
  collarCharm: 0.24,
  collarRing: 0.07,
  // Sleep / lie collar: a short drop under the jaw, and length along the neck (fractions of headR).
  // A drop near one head radius planted the strap on the floor, clear of the neck.
  collarFlatDrop: 0.2,
  collarFlatLen: 0.32,
  bell: 0.33,
  // Bandana, as multiples of headR.
  bandanaBand: 0.62,
  bandanaBandWidth: 0.17,
  // Side-view cloth spans this fraction of the band, from the back of the neck toward the throat.
  bandanaClothFrom: 0.22,
  bandanaClothTo: 0.96,
  bandanaDrop: 1.0,
  // Sleep bib, straight down from the throat. Shorter than a standing drop so it stays on the chest.
  bandanaLieDrop: 0.62,
  bandanaHem: 0.1,
  bandanaKnot: 0.26,
  bowWing: 0.62,
  bowtieReach: 0.6,
  bowHeight: 0.4,
  scarfBand: 0.34,
  scarfThick: 0.42,
  scarfKnotW: 0.2,
  scarfKnotH: 0.16,
  scarfTailLen: 0.9,
  scarfTailHalf: 0.15,
  scarfTail: 0.3,
  scarfTailLong: 1.15,
  scarfTailShort: 0.9,
  hatScale: 1,
  hatTurn: 0.12,
  // Hat base, in head radii. Negative sits the base up toward the crown.
  hatSeat: -0.78,
  hatTilt: -10,
  hatIconTilt: -6,
  beretTilt: -10,
  beanieRib: 0.4,
  beaniePom: 0.3,
  ribLine: 0.045,
  partyTip: 2.4,
  partyStripe: 0.14,
  partyPom: 0.24,
  topBrim: 1.05,
  // Glasses: w and h are lens half-sizes, frame is the rim width, all as multiples of eyeR.
  glassesStyles: {
    classic: { shape: 'wayfarer', w: 1.4, h: 1.15, frame: 0.42, lens: '#12141c', lensAlpha: 0.62, glares: 2 },
    square: { shape: 'round', w: 1.3, h: 1.3, frame: 0.26, lens: '#9fd0ff', lensAlpha: 0.22, glares: 1 },
    'red-rim': { shape: 'soft', w: 1.4, h: 1.2, frame: 0.4, lens: '#ffffff', lensAlpha: 0.12, glares: 1 },
    heart: { shape: 'heart', w: 1.75, h: 1.9, frame: 0.42, lens: '#FFB3D6', lensAlpha: 0.45, glares: 1 },
    star: { shape: 'star', w: 1.25, h: 1.25, frame: 0.34, lens: '#FFE38F', lensAlpha: 0.45, glares: 0 },
  } as Record<
    string,
    { shape: 'wayfarer' | 'round' | 'soft' | 'heart' | 'star'; w: number; h: number; frame: number; lens: string; lensAlpha: number; glares: number }
  >,
  // Temple arm width as a fraction of the frame, and how far back on the head it reaches (fraction of headR).
  glassesArm: 0.75,
  glassesArmReach: 0.6,
  // Jacket shape: fractions of bodyLen (x) and of the jacket's vertical radius (y).
  jacketPuff: 0.05,
  vestPuff: 0.09,
  jacketRear: 0.34,
  jacketFront: 0.36,
  jacketBulge: 0.06,
  jacketDropRear: 0.32,
  jacketDropFront: 0.78,
  jacketBelly: 0.85,
  jacketRib: 0.11,
  sweaterStripe: 0.26,
  jacketButton: 0.13,
  zipPull: 0.08,
  // Collar and hood: fractions of headR.
  collarRise: 0.22,
  jacketCollar: { sweater: 0.4, puffer: 0.44, rain: 0.3, vest: 0.28 } as Record<string, number>,
  hood: 0.32,
  // Boots. Top is a fraction of the knee-to-paw segment. Toe is a multiple of the paw oval.
  bootTop: 0.45,
  rainTop: 0.35,
  sneakerTop: 0.78,
  hightopTop: 0.55,
  // Red-boot fold, in head radii, added on each side of the shaft.
  bootCuffFlare: 0.047,
  bootShaftExtra: 2,
  bootToeX: 1.3,
  bootToeY: 1.25,
  bootSole: 1.6,
  bootSoleK: 0.3,
  sneakerSole: 0.42,
  // Same offset as the bare paw oval in drawLeg.
  pawOffsetX: 3,
  pawOffsetY: -3,
  // Sleeves cover this much of the upper leg bone.
  sleeveUpper: 0.9,
  sleeveExtra: 2,
};
