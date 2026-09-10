# Audio Evaluation

## Recommendation

For the first implementation, use deterministic timeline placement and mix-intent evaluation in the domain, render/mix through a controlled FFmpeg process adapter, and store a high-quality PCM/WAV intermediate. This covers trimming, resampling, gain, fades, mix, ducking, loudness-related filters, waveform extraction and final muxing without adding a second DSP dependency initially.

FFmpeg alone is insufficient only if measurements show missing deterministic sample-accurate automation, unacceptable performance, or required effects unavailable under the selected license/build. Then evaluate a separate DSP library as a narrowly scoped adapter; do not add one preemptively. MP3/AAC decode/encode availability, licenses and patent concerns remain packaging decisions.
