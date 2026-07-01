"""Cinematic scene composition helpers for the FFmpeg render pipeline."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from moviepy import (
    AudioFileClip,
    CompositeAudioClip,
    CompositeVideoClip,
    ImageClip,
    VideoFileClip,
    concatenate_audioclips,
    concatenate_videoclips,
    vfx,
)
from moviepy.audio.AudioClip import AudioArrayClip

logger = logging.getLogger("media.render")

CROSSFADE_SECONDS = float(os.getenv("RENDER_CROSSFADE_SEC", "0.45"))
BGM_VOLUME = float(os.getenv("RENDER_BGM_VOLUME", "0.55"))
KEN_BURNS_ZOOM = float(os.getenv("RENDER_KEN_BURNS_ZOOM", "0.14"))
SCENE_TAIL_PAUSE = float(os.getenv("RENDER_SCENE_TAIL_PAUSE", "0.35"))
DUCKING_FACTOR = float(os.getenv("RENDER_DUCKING_FACTOR", "0.2"))
DUCKING_ATTACK = float(os.getenv("RENDER_DUCKING_ATTACK", "0.005"))
DUCKING_RELEASE = float(os.getenv("RENDER_DUCKING_RELEASE", "0.3"))
DUCKING_KNEE = float(os.getenv("RENDER_DUCKING_KNEE", "0.5"))
AUDIO_SAMPLE_RATE = int(os.getenv("RENDER_AUDIO_SAMPLE_RATE", "44100"))
LUT_PATH = os.getenv("RENDER_LUT_PATH", "").strip()
UNSHARP_PARAMS = os.getenv("RENDER_UNSHARP_PARAMS", "").strip()


@dataclass(frozen=True)
class RenderProfile:
    target_w: int
    target_h: int
    fps: int
    codec: str
    ffmpeg_params: tuple[str, ...]
    threads: int
    ken_burns: bool
    color_grade: bool
    static_image_bg: bool
    crossfade_sec: float
    segmented: bool
    video_filters: str | None = None


def _odd_unsharp_matrix(value: str) -> str:
    """FFmpeg unsharp matrix sizes must be odd integers (3–23)."""
    try:
        n = int(value)
        if n % 2 == 0:
            n += 1
        return str(min(23, max(3, n)))
    except ValueError:
        return value


def _normalize_unsharp_params(params: str) -> str:
    """FFmpeg unsharp wants 6 values or 3 luma-only; matrix sizes must be odd."""
    parts = params.split(":")
    if len(parts) >= 2:
        parts[0] = _odd_unsharp_matrix(parts[0])
        parts[1] = _odd_unsharp_matrix(parts[1])
    if len(parts) == 3:
        return f"{parts[0]}:{parts[1]}:{parts[2]}:{parts[0]}:{parts[1]}:{parts[2]}"
    if len(parts) >= 5:
        parts[3] = _odd_unsharp_matrix(parts[3])
        parts[4] = _odd_unsharp_matrix(parts[4])
    return ":".join(parts)


def _build_video_filters() -> str | None:
    """Combine LUT + unsharp into a single FFmpeg -vf chain (applied per segment encode)."""
    filters: list[str] = []
    if LUT_PATH:
        if os.path.isfile(LUT_PATH):
            lut_path = LUT_PATH.replace("\\", "/").replace(":", "\\:")
            filters.append(f"lut3d={lut_path}")
        else:
            logger.warning("RENDER_LUT_PATH set but file not found: %s", LUT_PATH)
    if UNSHARP_PARAMS:
        if filters:
            # lut3d often outputs high-bit RGB; unsharp + VideoToolbox need yuv420p
            filters.append("format=yuv420p")
        filters.append(f"unsharp={_normalize_unsharp_params(UNSHARP_PARAMS)}")
    elif filters:
        filters.append("format=yuv420p")
    return ",".join(filters) if filters else None


def get_render_profile(content_format: str, quality: str | None = None) -> RenderProfile:
    quality = (quality or os.getenv("RENDER_QUALITY", "balanced")).strip().lower()
    is_short = content_format == "short"
    codec = os.getenv("RENDER_CODEC", "libx264").strip()
    threads = int(os.getenv("RENDER_THREADS", str(os.cpu_count() or 4)))
    segmented = os.getenv("RENDER_SEGMENTED", "true").lower() in {"1", "true", "yes"}
    video_filters = _build_video_filters()

    if quality == "fast":
        target_w, target_h = (480, 854) if is_short else (854, 480)
        ffmpeg_params = _encode_params(codec, preset="ultrafast", crf="26")
        return RenderProfile(
            target_w=target_w,
            target_h=target_h,
            fps=24,
            codec=codec,
            ffmpeg_params=ffmpeg_params,
            threads=threads,
            ken_burns=False,
            color_grade=False,
            static_image_bg=True,
            crossfade_sec=float(os.getenv("RENDER_CROSSFADE_SEC", "0.15")),
            segmented=segmented,
            video_filters=video_filters,
        )

    if quality == "quality":
        target_w, target_h = (720, 1280) if is_short else (1280, 720)
        ffmpeg_params = _encode_params(codec, preset="fast", crf="20")
        return RenderProfile(
            target_w=target_w,
            target_h=target_h,
            fps=24,
            codec=codec,
            ffmpeg_params=ffmpeg_params,
            threads=threads,
            ken_burns=True,
            color_grade=True,
            static_image_bg=True,
            crossfade_sec=float(os.getenv("RENDER_CROSSFADE_SEC", "0.45")),
            segmented=segmented,
            video_filters=video_filters,
        )

    target_w, target_h = (720, 1280) if is_short else (1280, 720)
    ffmpeg_params = _encode_params(codec, preset="veryfast", crf="23")
    return RenderProfile(
        target_w=target_w,
        target_h=target_h,
        fps=24,
        codec=codec,
        ffmpeg_params=ffmpeg_params,
        threads=threads,
        ken_burns=os.getenv("RENDER_KEN_BURNS", "true").lower() in {"1", "true", "yes"},
        color_grade=True,
        static_image_bg=True,
        crossfade_sec=CROSSFADE_SECONDS,
        segmented=segmented,
        video_filters=video_filters,
    )


def _encode_params(codec: str, *, preset: str, crf: str) -> tuple[str, ...]:
    if codec == "h264_nvenc":
        nvenc_preset = {"ultrafast": "p1", "veryfast": "p3", "fast": "p4"}.get(preset, "p4")
        return ("-preset", nvenc_preset, "-cq", crf)
    if codec == "h264_videotoolbox":
        # VideoToolbox does not support -q:v; use target bitrate instead.
        bitrate = {"ultrafast": "2500k", "veryfast": "4000k", "fast": "6000k"}.get(preset, "4000k")
        return ("-b:v", bitrate, "-allow_sw", "1")
    if codec == "h264_amf":
        qp = {"ultrafast": "28", "veryfast": "24", "fast": "20"}.get(preset, crf)
        return ("-quality", "speed", "-rc", "cqp", "-qp_i", qp, "-qp_p", qp)
    return ("-preset", preset, "-crf", crf, "-tune", "zerolatency")


def write_render_output(
    clip,
    output_path: str,
    profile: RenderProfile,
    *,
    label: str = "output",
) -> None:
    duration = getattr(clip, "duration", None)
    logger.info(
        "FFmpeg encode start [%s] → %s (%.1fs clip, %dx%d, %s, threads=%d%s)",
        label,
        output_path,
        duration or 0,
        profile.target_w,
        profile.target_h,
        profile.codec,
        profile.threads,
        f", vf={profile.video_filters}" if profile.video_filters else "",
    )
    started = time.monotonic()

    def _do_encode(*, use_filters: bool) -> None:
        ffmpeg_params = list(profile.ffmpeg_params)
        if use_filters and profile.video_filters:
            ffmpeg_params.extend(["-vf", profile.video_filters])
        write_kwargs: dict = {
            "fps": profile.fps,
            "codec": profile.codec,
            "threads": profile.threads,
            "ffmpeg_params": ffmpeg_params,
            "logger": None,
        }
        if getattr(clip, "audio", None) is not None:
            write_kwargs["audio_codec"] = "aac"
        else:
            write_kwargs["audio"] = False
        clip.write_videofile(output_path, **write_kwargs)

    try:
        _do_encode(use_filters=bool(profile.video_filters))
    except (OSError, IOError) as exc:
        if not profile.video_filters:
            raise
        logger.warning(
            "FFmpeg encode with filters failed [%s] (%s) — retrying without LUT/unsharp",
            label,
            exc,
        )
        if os.path.isfile(output_path):
            os.remove(output_path)
        _do_encode(use_filters=False)
    elapsed = time.monotonic() - started
    size_mb = os.path.getsize(output_path) / (1024 * 1024) if os.path.isfile(output_path) else 0
    logger.info(
        "FFmpeg encode done [%s] — %.1f MB in %.1fs",
        label,
        size_mb,
        elapsed,
    )


def concat_segment_files(segment_paths: list[str], output_path: str) -> None:
    """Fast final mux via ffmpeg concat demuxer (stream copy)."""
    if not segment_paths:
        raise ValueError("No segment files to concatenate")
    logger.info("Concatenating %d segments → %s", len(segment_paths), output_path)
    started = time.monotonic()
    if len(segment_paths) == 1:
        shutil.copyfile(segment_paths[0], output_path)
        logger.info("Single segment copied in %.1fs", time.monotonic() - started)
        return

    list_path = f"{output_path}.concat.txt"
    with open(list_path, "w", encoding="utf-8") as handle:
        for path in segment_paths:
            safe = path.replace("'", "'\\''")
            handle.write(f"file '{safe}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list_path,
        "-c",
        "copy",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    try:
        os.remove(list_path)
    except OSError:
        pass
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-500:] if result.stderr else "ffmpeg concat failed")
    size_mb = os.path.getsize(output_path) / (1024 * 1024) if os.path.isfile(output_path) else 0
    logger.info("Concat done — %.1f MB in %.1fs", size_mb, time.monotonic() - started)


def write_scene_segment(
    clip,
    output_path: str,
    profile: RenderProfile,
    *,
    scene_label: str = "segment",
) -> None:
    write_render_output(clip, output_path, profile, label=scene_label)


def scene_tail_pause(narration: str) -> float:
    text = (narration or "").strip()
    if not text:
        return 0.0
    if text.endswith(("!", "?", "…", "...")):
        return SCENE_TAIL_PAUSE
    if text.endswith("."):
        return SCENE_TAIL_PAUSE * 0.6
    return 0.0


def crop_to_aspect(clip, target_ratio: float):
    w, h = clip.size
    src_ratio = w / h
    if src_ratio > target_ratio:
        new_w = int(h * target_ratio)
        x_center = w / 2
        return clip.cropped(
            x1=int(x_center - new_w / 2),
            y1=0,
            x2=int(x_center + new_w / 2),
            y2=h,
        )
    new_h = int(w / target_ratio)
    y_center = h / 2
    return clip.cropped(
        x1=0,
        y1=int(y_center - new_h / 2),
        x2=w,
        y2=int(y_center + new_h / 2),
    )


def _soft_background(clip, target_w: int, target_h: int, *, color_grade: bool = True):
    """Cheap blurred fill: downscale then upscale (+ optional grade)."""
    bg = clip.resized(new_size=(max(target_w // 8, 32), max(target_h // 8, 32)))
    bg = bg.resized(new_size=(target_w, target_h))
    if color_grade:
        bg = bg.with_effects([vfx.LumContrast(contrast=0.85, lum=-8)])
    return bg


def _static_frame_clip(clip, duration: float):
    """Freeze first frame — avoids per-frame blur recompute on stills."""
    frame = clip.get_frame(0)
    return ImageClip(frame).with_duration(duration)


def _foreground_clip(
    clip,
    duration: float,
    target_w: int,
    target_h: int,
    is_video: bool,
    *,
    ken_burns: bool = True,
):
    if is_video or not ken_burns:
        fg = clip.resized(new_size=(target_w, target_h))
        return fg.with_position("center")

    zoom_end = 1.0 + KEN_BURNS_ZOOM
    step_count = max(int(duration * 12), 2)
    zoom_levels = np.linspace(1.0, zoom_end, step_count)

    def zoom_factor(t: float) -> float:
        if duration <= 0:
            return 1.0
        idx = min(int(t / duration * (step_count - 1)), step_count - 1)
        return float(zoom_levels[idx])

    fg = clip.resized(zoom_factor)
    return fg.with_position("center")


def build_cinematic_scene_clip(
    clip,
    *,
    duration: float,
    target_w: int,
    target_h: int,
    is_video: bool,
    profile: RenderProfile | None = None,
):
    """Full-bleed scene: crop to aspect, scale to frame (no blurred PiP edges)."""
    ken_burns = profile.ken_burns if profile else True
    color_grade = profile.color_grade if profile else True

    try:
        clip = crop_to_aspect(clip, target_w / target_h)
    except Exception as exc:
        logger.warning("Aspect crop failed: %s", exc)

    if is_video or not ken_burns:
        composed = clip.resized(new_size=(target_w, target_h))
    else:
        base = clip.resized(new_size=(target_w, target_h))
        fg = _foreground_clip(
            base,
            duration,
            target_w,
            target_h,
            is_video=False,
            ken_burns=True,
        )
        composed = CompositeVideoClip(
            [fg.with_duration(duration)],
            size=(target_w, target_h),
        )

    composed = composed.with_duration(duration)
    if color_grade:
        composed = composed.with_effects([vfx.LumContrast(contrast=1.08, lum=4)])
    return composed


def load_visual_clip(asset_path: str, duration: float, is_video: bool):
    if is_video:
        video_file = VideoFileClip(asset_path)
        # Stock clips may carry audio; MoviePy often fails decoding it during export.
        if video_file.audio is not None:
            video_file = video_file.without_audio()
        if video_file.duration < duration:
            repeats = int(duration / max(video_file.duration, 0.1)) + 1
            return concatenate_videoclips([video_file] * repeats).with_duration(duration)
        return video_file.subclipped(0, duration)

    return ImageClip(asset_path).with_duration(duration)


def apply_scene_crossfades(clips: Iterable, crossfade: float | None = None):
    crossfade = CROSSFADE_SECONDS if crossfade is None else crossfade
    clip_list = list(clips)
    if len(clip_list) <= 1 or crossfade <= 0:
        return concatenate_videoclips(clip_list, method="compose")

    faded = [clip_list[0].with_effects([vfx.CrossFadeOut(crossfade)])]
    for middle in clip_list[1:-1]:
        faded.append(
            middle.with_effects([vfx.CrossFadeIn(crossfade), vfx.CrossFadeOut(crossfade)])
        )
    faded.append(clip_list[-1].with_effects([vfx.CrossFadeIn(crossfade)]))
    return concatenate_videoclips(faded, padding=-crossfade, method="compose")


def loop_audio_to_duration(bgm: AudioFileClip, duration: float) -> AudioFileClip:
    if bgm.duration >= duration:
        return bgm.subclipped(0, duration)

    segments = []
    total = 0.0
    while total < duration:
        segments.append(bgm)
        total += bgm.duration
    looped = concatenate_audioclips(segments)
    return looped.subclipped(0, duration)


def create_ducking_control_track_envelope(
    voiceover_audio: AudioFileClip,
    sample_rate: int | None = None,
    attack_time: float | None = None,
    release_time: float | None = None,
    ducking_factor: float | None = None,
    knee: float | None = None,
) -> np.ndarray:
    """
    Envelope follower → per-sample BGM multiplier (1.0 = full bed, ducking_factor when speaking).
    """
    sample_rate = sample_rate or AUDIO_SAMPLE_RATE
    attack_time = DUCKING_ATTACK if attack_time is None else attack_time
    release_time = DUCKING_RELEASE if release_time is None else release_time
    ducking_factor = DUCKING_FACTOR if ducking_factor is None else ducking_factor
    knee = DUCKING_KNEE if knee is None else knee

    voiceover_samples = voiceover_audio.to_soundarray(fps=sample_rate)
    if voiceover_samples.ndim == 2:
        voiceover_samples = voiceover_samples.mean(axis=1)

    envelope = np.abs(voiceover_samples.astype(np.float64))
    peak = float(np.max(envelope)) if envelope.size else 0.0
    if peak > 0:
        envelope = envelope / peak

    attack_samples = max(int(attack_time * sample_rate), 1)
    release_samples = max(int(release_time * sample_rate), 1)
    attack_coef = 1.0 - np.exp(-1.0 / attack_samples)
    release_coef = 1.0 - np.exp(-1.0 / release_samples)

    smoothed = np.zeros_like(envelope)
    current_val = 0.0
    for index, sample in enumerate(envelope):
        coef = attack_coef if sample > current_val else release_coef
        current_val += coef * (sample - current_val)
        smoothed[index] = current_val

    if knee > 0:
        normalized = np.clip(smoothed / (knee + 0.001), 0.0, 1.0)
        control_signal = 1.0 - (1.0 - ducking_factor) * normalized
    else:
        is_speaking = (smoothed > 0.01).astype(np.float64)
        control_signal = 1.0 - (1.0 - ducking_factor) * is_speaking

    return control_signal.astype(np.float64)


def apply_ducked_bgm(
    bgm: AudioFileClip,
    voice: AudioFileClip,
    *,
    base_volume: float,
    sample_rate: int | None = None,
) -> AudioFileClip:
    """Multiply BGM by envelope-derived control track, then mix with dry voice."""
    sample_rate = sample_rate or AUDIO_SAMPLE_RATE
    control = create_ducking_control_track_envelope(voice, sample_rate=sample_rate)

    bgm_samples = bgm.to_soundarray(fps=sample_rate) * base_volume
    sample_count = min(len(bgm_samples), len(control))
    bgm_samples = bgm_samples[:sample_count]
    control = control[:sample_count]

    if bgm_samples.ndim == 1:
        ducked = bgm_samples * control
        ducked = np.column_stack([ducked, ducked])
    else:
        ducked = bgm_samples * control[:, np.newaxis]

    ducked_clip = AudioArrayClip(ducked, fps=sample_rate)
    duration = min(ducked_clip.duration, voice.duration)
    ducked_clip = ducked_clip.with_duration(duration)
    voice_trimmed = voice.subclipped(0, duration)
    mixed = CompositeAudioClip([ducked_clip, voice_trimmed]).with_duration(duration)
    return mixed


def mix_voice_and_bgm(
    video_clip,
    bgm_path: str,
    *,
    bgm_volume: float | None = None,
):
    if not bgm_path or not os.path.isfile(bgm_path):
        return video_clip

    base_volume = BGM_VOLUME if bgm_volume is None else bgm_volume
    bgm_source = AudioFileClip(bgm_path)
    bgm = loop_audio_to_duration(bgm_source, video_clip.duration)

    if video_clip.audio is None:
        return video_clip.with_audio(bgm.with_volume_scaled(base_volume))

    voice = video_clip.audio
    try:
        mixed = apply_ducked_bgm(bgm, voice, base_volume=base_volume)
        return video_clip.with_audio(mixed)
    except Exception as exc:
        logger.warning("Envelope ducking failed, using static mix: %s", exc)
        static_bgm = bgm.with_volume_scaled(base_volume * DUCKING_FACTOR)
        mixed = CompositeAudioClip([static_bgm, voice])
        return video_clip.with_audio(mixed)


def _write_audio_clip_to_file(audio_clip, output_path: str) -> None:
    audio_clip.write_audiofile(
        output_path,
        fps=AUDIO_SAMPLE_RATE,
        codec="aac",
        logger=None,
    )


def mux_audio_into_video_copy(video_path: str, audio_path: str, output_path: str) -> None:
    """Replace audio track without re-encoding video (segmented pipeline final step)."""
    logger.info("Muxing audio into video (stream copy) → %s", output_path)
    started = time.monotonic()
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-i",
        audio_path,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-500:] if result.stderr else "ffmpeg mux failed")
    size_mb = os.path.getsize(output_path) / (1024 * 1024) if os.path.isfile(output_path) else 0
    logger.info("Mux done — %.1f MB in %.1fs", size_mb, time.monotonic() - started)


def mix_bgm_into_video_file(
    video_path: str,
    bgm_path: str,
    output_path: str,
    *,
    bgm_volume: float | None = None,
) -> None:
    """
    Duck BGM under existing voice track, then mux — video stream is copied, not re-encoded.
    Used by segmented rendering after ffmpeg concat.
    """
    if not bgm_path or not os.path.isfile(bgm_path):
        shutil.copyfile(video_path, output_path)
        return

    base_volume = BGM_VOLUME if bgm_volume is None else bgm_volume
    video = VideoFileClip(video_path)
    temp_audio = f"{output_path}.mixed-aac"
    try:
        if video.audio is None:
            bgm_source = AudioFileClip(bgm_path)
            bgm = loop_audio_to_duration(bgm_source, video.duration)
            _write_audio_clip_to_file(bgm.with_volume_scaled(base_volume), temp_audio)
            bgm_source.close()
        else:
            bgm_source = AudioFileClip(bgm_path)
            bgm = loop_audio_to_duration(bgm_source, video.duration)
            try:
                mixed = apply_ducked_bgm(bgm, video.audio, base_volume=base_volume)
            except Exception as exc:
                logger.warning("Envelope ducking failed, using static mix: %s", exc)
                static_bgm = bgm.with_volume_scaled(base_volume * DUCKING_FACTOR)
                mixed = CompositeAudioClip([static_bgm, video.audio])
            _write_audio_clip_to_file(mixed, temp_audio)
            bgm_source.close()

        mux_audio_into_video_copy(video_path, temp_audio, output_path)
    finally:
        video.close()
        try:
            os.remove(temp_audio)
        except OSError:
            pass
