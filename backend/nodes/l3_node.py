from models.ticket_state import TicketState
from utils.logger import logger

def l3_node(state: TicketState) -> TicketState:
    state["status"] = "passed to L3, processing"
    state["l3_resolution"] = "Processing development issue"
    logger.info(f"Ticket {state['ticket_id']} passed to L3")
    return state
