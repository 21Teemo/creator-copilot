from typing import List
from pydantic import BaseModel

from deepseek_client import chat_json, is_configured


class TitlesResponse(BaseModel):
    titles: List[str]


class ChapterItem(BaseModel):
    timestamp: str
    title: str


class MetadataResponse(BaseModel):
    description: str
    tags: List[str]
    chapters: List[ChapterItem]


def generate_seo_titles(prompt: str) -> dict:
    if not is_configured():
        return {
            "titles": [
                f"10 Coding Secrets About {prompt} You DIDN'T Know!",
                f"The Future of {prompt} Development (Step-by-Step)",
                f"How to Master {prompt} Like a 10x Engineer",
            ]
        }

    try:
        return chat_json(
            f"Generate 5 highly viral, high-CTR YouTube video titles based on the concept/brief:\n\n{prompt}\n\n"
            f"Return JSON: {{\"titles\": [\"...\", ...]}} with exactly 5 titles.",
            system_prompt="You write high-CTR YouTube titles.",
            temperature=0.8,
        )
    except Exception as e:
        print(f"SEO title generation failed: {e}")
        return {"titles": [f"Introduction to {prompt}", f"Mastering {prompt}"]}


def generate_seo_metadata(prompt: str) -> dict:
    if not is_configured():
        return {
            "description": f"Get ready to level up your skills in {prompt}! In this video, we explore core patterns, tricks, and architectures to build a complete system. Make sure to subscribe for more tech tutorials!",
            "tags": [prompt.lower().replace(" ", ""), "coding", "software engineering", "tutorial", "fullstack", "programming"],
            "chapters": [
                {"timestamp": "0:00", "title": "Introduction Hook"},
                {"timestamp": "0:15", "title": "Setting Up Foundations"},
                {"timestamp": "0:45", "title": "Coding Deep Dive"},
                {"timestamp": "1:15", "title": "Verification & Execution"},
                {"timestamp": "1:45", "title": "Final Wrap-Up"},
            ],
        }

    try:
        return chat_json(
            f"Generate search-optimized YouTube video metadata for this brief:\n\n{prompt}\n\n"
            f"Return JSON with keys: description (string), tags (string array), "
            f"chapters (array of {{timestamp, title}}).",
            system_prompt="You write YouTube SEO metadata.",
            temperature=0.6,
        )
    except Exception as e:
        print(f"SEO metadata generation failed: {e}")
        return {
            "description": f"A video about {prompt}.",
            "tags": [prompt.lower()],
            "chapters": [{"timestamp": "0:00", "title": "Introduction"}],
        }
