"""Build a short, locally hosted educational video from the site's licensed photos."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS = 1280, 720, 15
SCENES = [
    ("living-room.jpg", "01  Сверьте точки с планом", "Согласованный план — отправная точка осмотра."),
    ("renovation.jpg", "02  Проверьте выключатели и свет", "Каждая группа должна включаться по назначению."),
    ("bright-interior.jpg", "03  Зафиксируйте замечания", "Запишите вопросы в перечень приёмки."),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"]
        if bold
        else ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"]
    )
    candidates.extend(
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    raise FileNotFoundError("Install Arial or DejaVu Sans to render Cyrillic video captions.")


def make_frame(photo: Image.Image, scene_index: int, scene: tuple[str, str, str], progress: float) -> Image.Image:
    scale = 1.0 + 0.035 * progress
    scaled = ImageOps.fit(photo, (round(WIDTH * scale), round(HEIGHT * scale)), centering=(0.5, 0.48 + 0.04 * progress))
    left = round((scaled.width - WIDTH) * progress)
    top = max(0, (scaled.height - HEIGHT) // 2)
    frame = scaled.crop((left, top, left + WIDTH, top + HEIGHT)).convert("RGBA")

    shade = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    shade_draw.rectangle((0, 0, WIDTH, 120), fill=(22, 25, 29, 110))
    shade_draw.rectangle((0, 390, WIDTH, HEIGHT), fill=(22, 25, 29, 195))
    frame = Image.alpha_composite(frame, shade)
    draw = ImageDraw.Draw(frame)

    draw.rounded_rectangle((72, 54, 494, 112), radius=18, fill=(224, 123, 31, 245))
    draw.text((96, 68), "КВАДРАТ  ·  УЧЕБНЫЙ ПРОЕКТ", font=font(23, True), fill="white")
    draw.text((72, 430), scene[1], font=font(42, True), fill="white", stroke_width=1, stroke_fill=(0, 0, 0, 80))
    draw.text((72, 496), scene[2], font=font(28), fill=(242, 242, 240))
    draw.text((72, 623), "Учебная инфографика · иллюстративные фото · не объект компании", font=font(20), fill=(235, 235, 232))
    draw.rounded_rectangle((72, 678, WIDTH - 72, 688), radius=5, fill=(255, 255, 255, 105))
    segment_width = (WIDTH - 144) / len(SCENES)
    segment_left = 72 + segment_width * scene_index
    segment_right = max(segment_left + 5, 72 + segment_width * (scene_index + progress) - 5)
    draw.rounded_rectangle(
        (segment_left, 678, segment_right, 688),
        radius=5,
        fill=(224, 123, 31, 255),
    )
    return frame.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "video" / "inspection-demo.mp4")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    photos = [Image.open(ROOT / "img" / filename).convert("RGB") for filename, _, _ in SCENES]
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [
        ffmpeg,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS),
        "-i", "-",
        "-an",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "25",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(args.output),
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert encoder.stdin is not None
    try:
        frames_per_scene = FPS * 4
        for index, (scene, photo) in enumerate(zip(SCENES, photos)):
            for frame_number in range(frames_per_scene):
                progress = frame_number / max(1, frames_per_scene - 1)
                encoder.stdin.write(make_frame(photo, index, scene, progress).tobytes())
    finally:
        encoder.stdin.close()
    if encoder.wait() != 0:
        raise SystemExit("FFmpeg failed while encoding the demo video.")
    print(f"Created {args.output} ({args.output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
