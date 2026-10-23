// Look of the pet itself. Stage units unless noted.
export const petStyle = {
  outline: {
    enabled: true,
    width: 2.4,
    // Outline color: the breed's base color pushed toward a warm near-black, so it suits every coat.
    ink: '#1e140e',
    inkMix: 0.75,
  },
  // Belly roll. The torso spins about its spine. `girth` is the edge-on thickness
  // as a fraction of the side-view height, so the body never flattens into a line.
  roll: {
    girth: 0.72,
  },
  shade: {
    enabled: true,
    shadowAlpha: 0.14,
    highlightAlpha: 0.18,
    // Shadow oval as fractions of the part's radii, placed on its underside.
    shadowY: 0.78,
    shadowRx: 1.25,
    shadowRy: 0.72,
    // Highlight oval near the top, slightly toward the front.
    highlightX: 0.18,
    highlightY: -0.5,
    highlightRx: 0.45,
    highlightRy: 0.2,
    // Leg shading: a darker stripe along the back edge of each leg.
    legStripe: 0.42,
    legOffset: 0.28,
    legAlpha: 0.12,
  },
  // Part 3. Multipliers applied on top of breed, age and weight geometry. 1 = current look.
  proportions: {
    enabled: false,
    legLength: 0.75,
    legWidth: 1.25,
    paw: 1.3,
    bodyH: 1.15,
    bodyLen: 0.9,
    neck: 0.5,
    headR: 1.05,
  },
};
