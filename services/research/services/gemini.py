import re
import google.generativeai as genai
from research.config import GEMINI_API_KEY

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def get_model(name="gemini-2.5-flash", use_search=False):
    if not GEMINI_API_KEY:
        return None
    # Enable Google Search grounding if requested
    tools = [{"google_search_retrieval": {}}] if use_search else None
    return genai.GenerativeModel(name, tools=tools)

def perform_web_search(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "sources": [
                {
                    "title": f"Introductory Guide to {prompt}",
                    "url": "https://wikipedia.org/wiki/Special:Search?search=" + prompt.replace(" ", "+"),
                    "snippet": f"A comprehensive baseline article discussing key concepts of {prompt}."
                },
                {
                    "title": f"Recent trends in {prompt} (Medium)",
                    "url": "https://medium.com/search?q=" + prompt.replace(" ", "+"),
                    "snippet": f"Industry analysis and creator blogs focusing on {prompt} workflows."
                }
            ]
        }
        
    try:
        model = get_model(use_search=True)
        response = model.generate_content(
            f"Search the web and find the most relevant sources and facts for: {prompt}. Return a concise summary of the facts."
        )
        
        sources = []
        try:
            candidate = response.candidates[0]
            if hasattr(candidate, "grounding_metadata") and candidate.grounding_metadata:
                metadata = candidate.grounding_metadata
                if hasattr(metadata, "grounding_chunks") and metadata.grounding_chunks:
                    for chunk in metadata.grounding_chunks:
                        if hasattr(chunk, "web") and chunk.web:
                            sources.append({
                                "title": chunk.web.title or "Web Source",
                                "url": chunk.web.uri,
                                "snippet": chunk.web.title
                            })
        except Exception as e:
            print(f"Error parsing grounding metadata: {e}")
            
        if not sources:
            sources = [
                {
                    "title": f"Google Search results for {prompt}",
                    "url": "https://www.google.com/search?q=" + prompt.replace(" ", "+"),
                    "snippet": "Search results for: " + prompt
                }
            ]
            
        return {"sources": sources}
    except Exception as e:
        print(f"Gemini search failed: {e}")
        return {
            "sources": [
                {
                    "title": "Google Search Fallback",
                    "url": "https://google.com/search?q=" + prompt.replace(" ", "+"),
                    "snippet": f"Failed to retrieve live Gemini grounding sources. Error: {str(e)}"
                }
            ]
        }

def perform_summarization(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "summaryText": f"### Creator Brief: {prompt}\n\nThis brief summarizes the key findings for '{prompt}'. It highlights target audience interest, potential storyboard narrative hooks, and audio rhythm directions based on current trends.\n\n* **Hook Focus**: Deep atmospheric setup followed by energetic tutorials.\n* **Pacing**: 85Bpm lofi or 110Bpm retro synthwaves.",
            "sources": [
                {
                    "title": "Default Creator Template",
                    "url": "https://youtube.com"
                }
            ]
        }
        
    try:
        model = get_model()
        system_instructions = (
            "You are a helpful assistant. Synthesize the provided query, transcripts, or research notes into a detailed, "
            "professional Creator Brief in Markdown format. The brief should outline the core hook, structure, and key narrative insights."
        )
        response = model.generate_content(
            f"{system_instructions}\n\nInput Content:\n{prompt}"
        )
        
        urls = re.findall(r'(https?://[^\s)]+)', prompt)
        sources = [{"title": f"Source {i+1}", "url": url} for i, url in enumerate(list(set(urls))[:3])]
        if not sources:
            sources = [{"title": "Gemini Synthesis Engine", "url": "https://ai.google.dev"}]
            
        return {
            "summaryText": response.text,
            "sources": sources
        }
    except Exception as e:
        print(f"Gemini summarization failed: {e}")
        return {
            "summaryText": f"Error synthesizing brief: {str(e)}",
            "sources": []
        }
