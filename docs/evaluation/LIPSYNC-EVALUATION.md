# Hindi and English Lip-sync Evaluation

## Candidate assessment

| Candidate | Hindi/English/offline | Timing | CPU feasibility | License/status |
|---|---|---|---|---|
| Vosk + Hindi/English models | Offline; separate Hindi and English models exist | Recognition word timing; phoneme alignment still needed | Small Hindi model is published as 42 MB; benchmark locally | Software/model terms must be verified per artifact; candidate |
| whisper.cpp + multilingual Whisper weights | Offline C/C++ inference; multilingual transcription | Segment/token timestamps, not a complete phoneme aligner | Quantized small/base likely feasible but unbenchmarked on target | Code MIT; weights/model terms separate; candidate |
| WhisperX-style forced alignment | Improves word timing conceptually | Forced phoneme alignment; language/model coverage must be proven | More dependencies and likely heavier | Research/prototype candidate only |

## Minimum viable architecture

`Audio → VAD/normalization → local ASR or supplied transcript alignment → language-aware text/phoneme adapter → viseme mapping → manual overrides → saved LipSyncTrack`.

Start with a pluggable analyzer. For Phase 1 evaluation, compare Vosk small Hindi/English models against a quantized multilingual whisper.cpp model on a redistributable Hindi, English and code-switched fixture set. Do not claim phoneme precision from ASR timestamps. A language-aware grapheme-to-phoneme/phoneme inventory and manual correction UI/workflow remain required. Persist final phoneme/viseme events so render is deterministic.

Model software license, model-weight license, training-data provenance, redistribution, accuracy and Windows CPU behavior must be separately reviewed for every selected artifact.
