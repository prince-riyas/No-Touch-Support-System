from typing import TypedDict, Optional
from datetime import datetime

class TicketState(TypedDict):
    ticket_id: str
    user_email: str
    description: str
    status: str
    feedback: Optional[dict]
    l2_is_new: Optional[bool]
    l2_resolution: Optional[str]
    created_at: Optional[datetime]
    l3_is_dev: Optional[bool]
    l3_resolution: Optional[str]
    l2_count: int                      # Tracks how many times the ticket has been processed by L2
    combined_score: Optional[float]    # Combined score from L2 agent
    priority: Optional[str]            # Priority from L2 agent
    classified_team: Optional[str]     # Classified team from L2 agent
    resolution: Optional[str]          # Resolution from L2 agent
    additional_info: Optional[str]     # Additional info provided by the user