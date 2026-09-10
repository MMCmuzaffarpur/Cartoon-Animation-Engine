# FFmpeg Evaluation

FFmpeg can provide decode, image-sequence encode, MP4 muxing, audio filters, subtitles and normalization-related filters through an isolated process adapter. The official project states an LGPL-2.1-or-later build is possible when configured without GPL/nonfree components; enabling GPL components changes the FFmpeg binary licensing.

## Proposed strategy

- Prefer a separately executable, pinned LGPL-oriented FFmpeg build first.
- Capture exact binary hash, version, configure flags, codecs and notices in provenance.
- Use image sequence plus mixed WAV as stable intermediates; FFmpeg handles final encode/mux.
- Treat H.264/AAC availability and patent/redistribution matters as a release/legal review, not merely an FFmpeg license question.
- Do not statically link or ship an unreviewed binary.

## Required evaluation

Test PNG/EXR sequence handling, MP4/container/codecs, PCM/AAC/MP3, subtitle burn-in, loudness/normalization filters, Windows packaging, cancellation, reproducibility level and full notices/source obligations. No build configuration is approved.
