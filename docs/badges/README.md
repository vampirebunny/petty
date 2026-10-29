# Boop Boop badge art

25 SVGs, 256×256 viewBox, self-contained (no external fonts or images). The files the app draws live in `assets/badges/`. `src/ui/badges/svgXml.ts` copies those strings so each medal can render with `SvgXml`.

## Files

**One-time (10):** `welcome-home`, `came-back`, `good-listener`, `prop-pro`, `treasure-hunter`, `dressed-up`, `off-to-the-races`, `blue-ribbon`, `moving-up`, `playmate`

**Tiered (5 × bronze/silver/gold):** `best-friend-streak-<tier>`, `devoted-<tier>`, `trick-collector-<tier>`, `finder-<tier>`, `ribbon-rack-<tier>`

## Design system

- Glossy puffy medallion with ribbon tails, matching the cotton candy style.
- **One-time badges:** the rim and disc share the category color.
- **Tiered badges:** the disc keeps the category color; the rim and tails are the metal; 1, 2 or 3 stars on the rim show bronze, silver or gold.

| Category | Light | Mid | Dark | Used by |
| --- | --- | --- | --- | --- |
| Care (pink) | #FFE0EE | #FF8FC1 | #D9488B | Welcome Home, Came Back, Best Friend Streak |
| Training (lavender) | #ECE3FF | #A98BFF | #6F4FD8 | Good Listener, Prop Pro, Trick Collector |
| Outings (mint) | #D9F9EC | #5FD6A8 | #2A9C72 | Treasure Hunter, Finder |
| Races (sky) | #DDF1FF | #5DB8FF | #2A7FD1 | Off to the Races, Blue Ribbon, Moving Up, Ribbon Rack |
| Social (peach) | #FFE9D6 | #FFA86B | #E06E2C | Dressed Up, Playmate, Devoted |

| Metal | Light | Mid | Dark |
| --- | --- | --- | --- |
| Bronze | #F6D2AE | #CD8A4F | #8E5428 |
| Silver | #FBFCFE | #BAC2CE | #76808F |
| Gold | #FFF3B0 | #F5C02E | #B07C06 |

## Usage notes

- **Not yet earned:** show the badge greyscale at about 35% opacity (a color-matrix filter), not a separate asset. For tiered badges, show the next tier not yet earned.
- **Earned:** full color. Play the existing BadgeCelebration on award.
- Minimum display size about 48pt; the tier stars stay legible at that size.
- Each SVG uses fixed ids (`rim`, `disc`, `tail`, `discClip`, `fc`). If several are inlined into one SVG document, prefix the ids to avoid clashes; separate `<SvgXml>` components are fine as is.
