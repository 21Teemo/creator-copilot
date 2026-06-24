import json
from pydantic import BaseModel
from typing import List
import google.generativeai as genai
from seo.config import GEMINI_API_KEY

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Define Schemas
class TitlesResponse(BaseModel):
    titles: List[str]

class ChapterItem(BaseModel):
    timestamp: str
    title: str

class MetadataResponse(BaseModel):
    description: str
    tags: List[str]
    chapters: List[ChapterItem]

def get_model(name="gemini-2.5-flash"):
    if not GEMINI_API_KEY:
        return None
    return genai.GenerativeModel(name)

def generate_seo_titles(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "titles": [
                f"10 Coding Secrets About {prompt} You DIDN'T Know!",
                f"The Future of {prompt} Development (Step-by-Step)",
                f"How to Master {prompt} Like a 10x Engineer"
            ]
        }
        
    try:
        model = get_model()
        response = model.generate_content(
            f"Generate 5 highly viral, high-CTR YouTube video titles based on the concept/brief:\n\n{prompt}",
            generation_config={"response_mime_type": "application/json", "response_schema": TitlesResponse}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"SEO title generation failed: {e}")
        return {
            "titles": [f"Introduction to {prompt}", f"Mastering {prompt}"]
        }

def generate_seo_metadata(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "description": f"Get ready to level up your skills in {prompt}! In this video, we explore core patterns, tricks, and architectures to build a complete system. Make sure to subscribe for more tech tutorials!",
            "tags": [prompt.lower().replace(" ", ""), "coding", "software engineering", "tutorial", "fullstack", "programming"],
            "chapters": [
                {"timestamp": "0:00", "title": "Introduction Hook"},
                {"timestamp": "0:15", "title": "Setting Up Foundations"},
                {"timestamp": "0:45", "title": "Coding Deep Dive"},
                {"timestamp": "1:15", "title": "Verification & Execution"},
                {"timestamp": "1:45", "title": "Final Wrap-Up"}
            ]
        }
        
    try:
        model = get_model()
        response = model.generate_content(
            f"Generate search-optimized YouTube video metadata (description, tags, and chapter timeline) for this brief:\n\n{prompt}",
            generation_config={"response_mime_type": "application/json", "response_schema": MetadataResponse}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"SEO metadata generation failed: {e}")
        return {
            "description": f"A video about {prompt}.",
            "tags": [prompt.lower()],
            "chapters": [{"timestamp": "0:00", "title": "Introduction"}]
        }
