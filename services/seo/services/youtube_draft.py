def publish_draft(project_id: str, payload: dict) -> dict:
    """
    Simulates publishing the video metadata to YouTube Studio as a draft.
    """
    # Simply returns a mock YouTube Studio draft edit URL
    return {
        "status": "success",
        "publishedUrl": "https://studio.youtube.com/video/mock_draft_id/edit",
        "message": "Draft created successfully on YouTube Studio!"
    }
