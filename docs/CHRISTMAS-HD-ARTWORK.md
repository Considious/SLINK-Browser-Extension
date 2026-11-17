# Christmas 2026: high-resolution source-artwork upgrade

This branch includes a non-destructive generator using the exact existing Naughty List WebP files. It **does not** alter production theme references, CSS, layout, colors, or remote Cloudflare assets. It does not magically recover detail absent from the input: this is a high-quality resample, not a new illustration.

## Generate the candidate images

From the repository root:

```bash
python -m pip install "Pillow>=10"
python tools/generate-christmas-hd.py
```

The script creates 16 `*-hd.webp` files alongside their originals in `assets/themes`. Existing source art is retained for comparison and rollback. It targets the 887x1774 background at 3x (2661x5322), the 180x540 side rail at 4x (720x2160), the 600x600 button chain at 2x, and the remaining decorative notes / 12 alert props at 3x. Brand art is SVG and does not need raster upscaling. The 1254x1254 decorative frame is deliberately unchanged pending a visual comparison.

The generator treats the side rail and vertically repeating background as vertically tiled sources to avoid introducing new interpolation seams at tile boundaries. **Inspect results before activation**, especially at tile joins.

## Before activating

1. Compare original versus HD image at actual rendered size and at 2x device pixel ratio. Upscaling is not necessarily a perceptible improvement at 100%.
2. Review screenshot comparisons for the left and right Torn side rails and ensure the repeat, symmetry, positioning, and opacity are unchanged.
3. To opt in, update the `files` mapping in `src/core/christmas-theme.js` to point only to HD files that actually exist. Leave `brand` and `frame` untouched.
4. Update `src/core/themes.js` packaged asset list / any precache configuration. `manifest.json` already has the `assets/themes/christmas2026-*` wildcard.
5. Hosted/PDA fallback currently uses the originals in `Considious/SLINK-Cloudflare-Services/main/themes/assets/`. Do **not** switch these references to HD filenames until the HD files are published there. Chrome-local paths can be tested independently.
6. Run `node tests/christmas-theme.test.mjs`, `node tests/theme-assets.test.mjs`, and the project test suite, and verify both desktop and PDA paths.

## Scope

This change adds the reproducible source-artwork processing step only. It does **not** include generated binaries, and therefore is safe to review and merge independently. Once the candidate images pass visual review, the next pull request can include binaries and activation together without any missing-asset window.
