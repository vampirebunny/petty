# Cursor brief: Boops pack art

The six SVG files live in `assets/boops-packs/`.

Final art for the six Boops packs. Use these instead of the coin-count art that was described in the Get Boops sheet. The purchase brief points here.

| File | Pack | Store description it matches |
|---|---|---|
| `boops_600.svg` | 600 Boops | A small heap of coins |
| `boops_2000.svg` | 2,000 Boops | Three tall stacks plus loose coins |
| `boops_3500.svg` | 3,500 Boops | A glass treat jar packed and overflowing with coins |
| `boops_7500.svg` | 7,500 Boops | A big pink bag bursting with coins |
| `boops_16000.svg` | 16,000 Boops | A wagon heaped with coins |
| `boops_45000.svg` | 45,000 Boops | A treasure chest overflowing onto the floor (coins only, no gems) |

## Using them

- Every coin is drawn at the same size in all six files, so the amount of gold visibly grows from pack to pack. Don't rescale individual packs to fill their card; render them all at the same width.
- All six share one canvas: `viewBox="0 0 120 100"`. Render at any width; height is `width × 0.8333`.
- Import with `react-native-svg`. Don't redraw or simplify them.
- Each file's gradient and symbol IDs are already prefixed (`a-`, `b-`, … `f-`), so all six can be on screen together. If the same pack ever renders twice on one screen, suffix its IDs per instance.
- Map art to packs by `art_key` (the file name without `.svg`), not by a product-id switch. The `boops_packs` table gets an `art_key` column with the purchase work, so a future pack can get new art without a code change.
- Keep the files' ink outline (`#2A1E26`) and colors as they are; they match the coin icon and the pet.

## Sizes

| Place | Width |
|---|---|
| Get Boops sheet, pack card art area | 84 (art box 70 tall, bottom-aligned) |
| Any larger pack display | 120 or more |

## Sparkles

Each file has small four-point stars marked `class="sparkle"`. `react-native-svg` ignores `class`, so those paths are drawn separately and can animate. On the Get Boops sheet, twinkle each one (opacity 1 → 0.2 → 1, scale 1 → 0.7 → 1) on its own 1.5–3 s loop, so the sheet glimmers without everything blinking at once. Static when Reduce Motion is on, and paused when the sheet is closed.

## Done when

- [x] Each pack card in the Get Boops sheet shows its matching art, bottom-aligned, at the size above.
- [x] Art comes from `art_key`, not a hardcoded product-ID switch.
- [ ] All six render correctly together on a device, iOS and Android, with no broken gradients. Not checked on a device yet.
- [x] Sparkles twinkle on their own loops in the sheet, and they are static under Reduce Motion. They unmount when the sheet closes.
