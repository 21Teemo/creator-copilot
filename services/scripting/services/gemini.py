import base64
import json
import httpx
from typing import List
from pydantic import BaseModel
import google.generativeai as genai
from scripting.config import GEMINI_API_KEY

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Define Schemas
class OutlineItem(BaseModel):
    sectionTitle: str
    durationSeconds: int
    talkingPoints: List[str]

class StoryboardItem(BaseModel):
    sceneNumber: int
    visualPrompt: str
    narrationText: str

class StoryboardOutput(BaseModel):
    script: str
    outline: List[OutlineItem]
    storyboard: List[StoryboardItem]

class GradingOutput(BaseModel):
    ctrScore: int
    feedback: str

def get_model(name="gemini-2.5-flash"):
    if not GEMINI_API_KEY:
        return None
    return genai.GenerativeModel(name)

def generate_storyboard(prompt: str, content_format: str = "long") -> dict:
    if not GEMINI_API_KEY:
        return {
            "script": f"Welcome to this video about {prompt}. Today we are covering key ideas. Make sure to stay tuned until the end to find out more details.",
            "outline": [
                {
                    "sectionTitle": "Introduction Hook",
                    "durationSeconds": 15,
                    "talkingPoints": [f"Introduce the topic of {prompt}", "Highlight the main hook"]
                },
                {
                    "sectionTitle": "Core Insights",
                    "durationSeconds": 30,
                    "talkingPoints": [f"Deep dive into {prompt}", "Present real examples"]
                }
            ],
            "storyboard": [
                {
                    "sceneNumber": 1,
                    "visualPrompt": f"Backlit workspace with typing developer, cyberpunk neon glow, close-up shot",
                    "narrationText": f"Welcome to this video about {prompt}. Today we are covering key ideas."
                },
                {
                    "sceneNumber": 2,
                    "visualPrompt": f"Abstract digital network graphic with glowing particles, technology matrix background",
                    "narrationText": "Make sure to stay tuned until the end to find out more details."
                }
            ]
        }

    try:
        model = get_model()
        format_instruction = "For a YouTube Short (under 60s)" if content_format == "short" else "For a standard long-form YouTube video"
        
        response = model.generate_content(
            f"You are a professional video producer. {format_instruction}, generate a full storyboard, outline, "
            f"and narration script.\n\n"
            f"CRITICAL: Base the script ONLY on the research brief and trending video context below. "
            f"Do not invent a different topic, fictional story, or unrelated narrative. "
            f"Every scene and talking point must reflect the provided facts and angles. "
            f"If visual style analysis is provided, match that format in storyboard visual prompts "
            f"(e.g. text-message UI, POV framing, color palette).\n\n"
            f"Context/brief:\n{prompt}",
            generation_config={"response_mime_type": "application/json", "response_schema": StoryboardOutput}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Storyboard generation failed: {e}")
        return {
            "script": f"An error occurred generating script: {str(e)}",
            "outline": [],
            "storyboard": []
        }

def load_image_data(image_url: str):
    if image_url.startswith("data:image/"):
        header, encoded = image_url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1]
        data = base64.b64decode(encoded)
        return {"mime_type": mime_type, "data": data}
    else:
        with httpx.Client() as client:
            res = client.get(image_url)
            res.raise_for_status()
            content_type = res.headers.get("content-type", "image/jpeg")
            mime_type = content_type.split(";")[0]
            return {"mime_type": mime_type, "data": res.content}

def grade_thumbnail(prompt: str, image_url: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "ctrScore": 78,
            "feedback": f"The thumbnail shows strong contrast and matches your prompt '{prompt}' nicely. Try enhancing neon glows in the text overlay to improve CTR."
        }

    try:
        image_part = load_image_data(image_url)
        model = get_model()
        
        response = model.generate_content(
            [
                f"Analyze this thumbnail design against the target video concept/prompt: '{prompt}'. "
                f"Grade its estimated Click-Through Rate (CTR) potential and provide constructive criticism.",
                image_part
            ],
            generation_config={"response_mime_type": "application/json", "response_schema": GradingOutput}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Thumbnail grading failed: {e}")
        return {
            "ctrScore": 50,
            "feedback": f"Failed to grade thumbnail. Error: {str(e)}"
        }
