from models.ticket_state import TicketState
from utils.logger import logger

def feedback_node(state: TicketState) -> TicketState:
    state["status"] = "awaiting_feedback"
    logger.info(f"Ticket {state['ticket_id']} awaiting user feedback")
    # Workflow pauses here until feedback is provided via API
    return state