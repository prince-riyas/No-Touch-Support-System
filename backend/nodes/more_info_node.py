from models.ticket_state import TicketState
from utils.logger import logger

def more_info_node(state: TicketState) -> TicketState:
    state["status"] = "awaiting_more_info"
    logger.info(f"Ticket {state['ticket_id']} awaiting more info from user")
    # Workflow pauses here until additional info is provided via API
    return state