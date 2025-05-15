from models.ticket_state import TicketState
from utils.logger import logger

def l4_node(state: TicketState) -> TicketState:
    state["status"] = f"passed to L4, team: {state['classified_team']}"
    state["l4_status"] = "Pending human intervention"
    logger.info(f"Ticket {state['ticket_id']} passed to L4, team: {state['classified_team']}")
    return state
