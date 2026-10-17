"""Render the README demo locally; never run the displayed command.

Requires Python 3 and Pillow (generated with Pillow 13.0.0).
Example: python3 -m venv /tmp/rulewitness-demo
         /tmp/rulewitness-demo/bin/pip install Pillow==13.0.0
         /tmp/rulewitness-demo/bin/python scripts/render-demo.py
Use --font /path/to/monospace.ttf when neither default font is installed.
Only literal lines from docs/examples/compare.txt are used as analysis output.
The window title, shell prompt and persistent warning are presentation chrome.
"""

import argparse
from pathlib import Path
import textwrap

from PIL import Image, ImageColor, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, SCALE = 1040, 545, 2
BG = "#090d14"
PANEL = "#101722"
TEXT = "#dce6f3"
MUTED = "#8c9bb1"
TEAL = "#69dfc2"
AMBER = "#f4c16d"
RED = "#ff8e9e"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path)
    args = parser.parse_args()
    font_path = args.font or next(
        (p for p in [
            Path("/System/Library/Fonts/Menlo.ttc"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
        ] if p.exists()), None
    )
    if font_path is None:
        parser.error("Provide --font with an installed monospace TrueType font")
    fonts = {size: ImageFont.truetype(str(font_path), size * SCALE)
             for size in [11, 12, 13, 14, 15, 16, 18]}
    source = (ROOT / "docs/examples/compare.txt").read_text().splitlines()

    def line(prefix):
        return next(value for value in source if value.startswith(prefix))

    def text(draw, xy, value, color=TEXT, size=14):
        draw.text(tuple(v * SCALE for v in xy), value,
                  fill=color, font=fonts[size])

    def box(draw, bounds, color, radius=0, outline=None):
        draw.rounded_rectangle(tuple(v * SCALE for v in bounds),
                               radius=radius * SCALE, fill=color, outline=outline,
                               width=SCALE)

    # Preserve complete evidence strings, including revisions, pointers and rules.
    # Wrap at measured character boundaries; never shorten a determining rule.
    rows = [
        (122, line("RuleWitness"), TEXT, 16),
        (142, line("Scope:"), MUTED, 11),
        (157, line("Coverage:"), MUTED, 11),
        (181, line("[HIGH]"), RED, 16),
        (211, line("  Before:"), AMBER, 15),
        (233, line("  After:"), TEAL, 15),
        (265, line("  Why:"), TEXT, 13),
        (295, line("  Evidence:"), MUTED, 13),
    ]
    for y, prefix, color in [
        (320, '    Before: "', AMBER), (369, '    After:  "', TEAL)
    ]:
        wrapped = textwrap.wrap(line(prefix), width=122, subsequent_indent="    ",
                                replace_whitespace=False, drop_whitespace=False)
        if len(wrapped) > 2:
            raise ValueError("Evidence no longer fits the reviewed two-line layout")
        rows.extend((y + index * 17, value, color, 12)
                    for index, value in enumerate(wrapped))
    rows.append((417, line("  Witness:"), TEAL, 18))
    alert_row = next(index for index, row in enumerate(rows) if row[1].startswith("[HIGH]"))
    assert 'ASK → ALLOW' in line("[HIGH]")
    assert line("  Witness:").strip() == 'Witness: Bash("npm run build")'

    def frame(command, visible=(), fading=None, opacity=1.0, cursor=False):
        canvas = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), BG)
        draw = ImageDraw.Draw(canvas)
        box(draw, (12, 10, 1028, 535), PANEL, 13, "#293448")
        box(draw, (13, 11, 1027, 51), "#192231", 12)
        box(draw, (13, 38, 1027, 51), "#192231")
        for x, color in [(34, "#ff6b75"), (55, "#f4bf60"), (76, "#63d394")]:
            draw.ellipse((x * SCALE, 26 * SCALE, (x + 10) * SCALE, 36 * SCALE), fill=color)
        text(draw, (118, 24), "RuleWitness · permission review", MUTED, 12)
        text(draw, (735, 24), "docs/examples/compare.txt", MUTED, 12)
        text(draw, (36, 72), "❯", TEAL, 18)
        text(draw, (63, 72), command, TEXT, 18)
        if cursor:
            x = 63 + fonts[18].getlength(command) / SCALE + 3
            box(draw, (x, 75, x + 8, 95), TEAL, 1)
        draw.line((36 * SCALE, 109 * SCALE, 1004 * SCALE, 109 * SCALE), fill="#253147", width=SCALE)
        if alert_row in visible or fading == alert_row:
            box(draw, (29, 175, 1010, 204), "#2c1d2b", 5)
        for index in visible:
            y, value, color, size = rows[index]
            text(draw, (36, y), value, color, size)
        if fading is not None:
            overlay = Image.new("RGB", canvas.size, PANEL)
            od = ImageDraw.Draw(overlay)
            y, value, color, size = rows[fading]
            # Keep the alert-row backdrop stable throughout its text fade.
            if fading == alert_row:
                box(od, (29, 175, 1010, 204), "#2c1d2b", 5)
            text(od, (36, y), value, color, size)
            region = (30 * SCALE, y * SCALE, 1010 * SCALE, (y + 25) * SCALE)
            canvas.paste(Image.blend(canvas.crop(region), overlay.crop(region), opacity), region)
        draw = ImageDraw.Draw(canvas)
        box(draw, (29, 475, 1010, 512), "#29251e", 6, "#51442d")
        text(draw, (45, 485), "Runtime authorization is not guaranteed", AMBER, 14)
        return canvas.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)

    command = "rulewitness compare HEAD~1 HEAD"
    frames, durations = [frame("", cursor=True)], [650]
    for count in range(1, len(command) + 1):
        frames.append(frame(command[:count], cursor=True))
        durations.append(45)
    durations[-1] = 450
    visible = []
    for index in range(len(rows)):
        for opacity in [0.3, 0.65, 1.0]:
            frames.append(frame(command, visible, index, opacity))
            durations.append(55)
        visible.append(index)
        durations[-1] += 100
    # Let the evidence remain readable before the infinite loop starts again.
    durations[-1] = 5500
    # One fixed palette across every frame preserves accent colors and contrast.
    # Sampling reduced thumbnails would overweight dark backgrounds and dull text.
    colors = [BG, PANEL, "#192231", "#293448", "#253147", "#2c1d2b",
              "#29251e", "#51442d", "#ff6b75", "#f4bf60", "#63d394",
              TEXT, MUTED, TEAL, AMBER, RED]
    rgb = [ImageColor.getrgb(color) for color in colors]
    for foreground in [TEXT, MUTED, TEAL, AMBER, RED]:
        for background in [PANEL, "#2c1d2b", "#29251e"]:
            fg, bg = ImageColor.getrgb(foreground), ImageColor.getrgb(background)
            rgb.extend(tuple(round(b + (f - b) * step / 12) for f, b in zip(fg, bg))
                       for step in range(1, 12))
    rgb.extend([rgb[0]] * (256 - len(rgb)))
    palette = Image.new("P", (1, 1))
    palette.putpalette([channel for color in rgb for channel in color])
    quantized = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in frames]
    output = ROOT / "assets/rulewitness-demo.gif"
    output.parent.mkdir(exist_ok=True)
    quantized[0].save(output, save_all=True, append_images=quantized[1:],
                      duration=durations, loop=0, optimize=True, disposal=1)
    with Image.open(output) as animation:
        assert animation.size == (WIDTH, HEIGHT)
        assert animation.info["loop"] == 0
        assert animation.n_frames > 30
    if output.stat().st_size > 500_000:
        raise ValueError("GIF exceeds the 500 KB budget")
    print(f"{output.relative_to(ROOT)}: {WIDTH}×{HEIGHT}, {len(frames)} frames, {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
