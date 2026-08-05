"""
Generate 9 Facebook marketing flyers for Ross House Rentals contractor recruitment.
3 concepts (Realistic photo, Modern graphic, House-with-badge) x 3 formats (square, vertical, horizontal).

Text overlay is bilingual (Spanish + English).
Saves to /app/public/marketing/facebook/ so they're served at /marketing/facebook/*.png
"""

import asyncio
import base64
import os
import sys
from pathlib import Path

os.environ.setdefault("EMERGENT_LLM_KEY", "sk-emergent-56a28Ad12CeA0E134F")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT = Path("/app/public/marketing/facebook")
OUT.mkdir(parents=True, exist_ok=True)

# ─── Concept prompts (bilingual, high-contrast, marketing-optimized) ─────
BASE_CTA = (
    "Prominent bilingual overlay text: 'ÚNETE A NUESTRA RED · JOIN OUR NETWORK' "
    "and subtitle 'CONTRATISTAS EN DUMAS TX · CONTRACTORS IN DUMAS TX'. "
    "Add a small 'Ross House Rentals' logo watermark bottom-right. "
    "Add a bright yellow/orange CTA button that says 'REGÍSTRATE GRATIS · SIGN UP FREE'. "
    "Text must be perfectly legible, high contrast, professional typography, no gibberish letters. "
    "Style: modern, warm, trustworthy, Facebook-optimized marketing flyer, magazine cover quality, 8K, ultra-detailed."
)

CONCEPTS = {
    "A_realistic": (
        "A photorealistic professional photograph of a smiling Hispanic male contractor "
        "in his 30s wearing a clean navy blue work polo shirt and a yellow hard hat, "
        "holding a wrench, standing confidently in front of a beautiful Texas home in Dumas. "
        "Warm afternoon golden hour lighting, shallow depth of field, bokeh background. "
        "The contractor looks approachable and trustworthy. "
        "This is a Facebook recruitment flyer aimed at recruiting local contractors. "
        + BASE_CTA
    ),
    "B_graphic": (
        "A modern flat design graphic poster with vibrant orange, violet, and dark navy gradient background. "
        "Center features large illustrated icons of contractor tools: wrench, hammer, hard hat, "
        "screwdriver, and paint roller — bold flat vector style. "
        "Include dynamic geometric shapes and subtle grid pattern. "
        "Style should be scroll-stopping and eye-catching for a Facebook feed. "
        "Poster/magazine cover aesthetic. "
        + BASE_CTA
    ),
    "C_house_badge": (
        "A photorealistic image of a beautiful modern single-family house in Dumas Texas — "
        "brick façade, well-manicured lawn, blue sky with clouds. Warm daylight. "
        "In the foreground, a large bright yellow 'JOB POSTING' badge/sticker overlays the image "
        "at an angle, like a real-estate sign, with the text 'BUSCAMOS CONTRATISTAS · CONTRACTORS WANTED'. "
        "The badge looks like a professional business sign — authentic and local. "
        + BASE_CTA
    ),
}

# ─── Aspect ratio prompts ────────────────────────────────────────────────
ASPECTS = {
    "square_1080":     "Square 1:1 aspect ratio, 1080x1080 pixels, Instagram/Facebook feed format",
    "vertical_1080":   "Vertical 9:16 aspect ratio, 1080x1920 pixels, Instagram Story / TikTok / Reels format, tall portrait",
    "horizontal_1200": "Horizontal 16:9 landscape aspect ratio, 1200x630 pixels, Facebook link preview / cover format, wide banner",
}

async def gen_one(concept_key: str, concept_prompt: str, aspect_key: str, aspect_desc: str, index: int):
    """Generate a single image and save it."""
    filename = OUT / f"{concept_key}__{aspect_key}.png"
    if filename.exists():
        print(f"[{index}/9] SKIP (already exists): {filename.name}")
        return filename

    full_prompt = f"{concept_prompt}\n\nIMAGE FORMAT: {aspect_desc}. Compose the layout accordingly."
    print(f"[{index}/9] Generating {concept_key} @ {aspect_key} ...")

    api_key = os.environ["EMERGENT_LLM_KEY"]
    chat = (
        LlmChat(api_key=api_key, session_id=f"flyer-{concept_key}-{aspect_key}",
                system_message="You are an expert graphic designer creating high-impact Facebook marketing flyers.")
        .with_model("gemini", "gemini-3.1-flash-image-preview")
        .with_params(modalities=["image", "text"])
    )

    try:
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=full_prompt))
    except Exception as e:
        print(f"[{index}/9] ERROR: {e}")
        return None

    if not images:
        print(f"[{index}/9] NO IMAGE RETURNED for {concept_key}/{aspect_key}")
        return None

    img = images[0]
    b = base64.b64decode(img["data"])
    filename.write_bytes(b)
    print(f"[{index}/9] SAVED: {filename.name} ({len(b) // 1024} KB)")
    return filename


async def main():
    tasks = []
    idx = 0
    for concept_key, concept_prompt in CONCEPTS.items():
        for aspect_key, aspect_desc in ASPECTS.items():
            idx += 1
            tasks.append(gen_one(concept_key, concept_prompt, aspect_key, aspect_desc, idx))

    # Generate in batches of 3 to avoid rate limits
    results = []
    for i in range(0, len(tasks), 3):
        batch = tasks[i:i + 3]
        results.extend(await asyncio.gather(*batch, return_exceptions=True))

    print("\n=== SUMMARY ===")
    ok = sum(1 for r in results if r and not isinstance(r, Exception))
    print(f"Generated {ok}/9 images successfully")
    print(f"Files saved in: {OUT}")
    for f in sorted(OUT.glob("*.png")):
        print(f"  - {f.name} ({f.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    asyncio.run(main())
