# Voice preview assets

This directory contains the offline MP3 previews used by the voice library.

- `manifest.json` maps each Azure `ShortName` to its committed MP3 file, locale, and sample text.
- The application checks the manifest and local file before requesting Azure synthesis.
- Missing or versioned previews can still be generated from the voice library and committed later.
- MP3 files are repository assets and are intentionally not ignored.
