from models.ticket_state import TicketState
from agents.mail_agent import send_email
from utils.logger import logger

def mail_node(state: TicketState) -> TicketState:
    """
    Node to send email notifications based on ticket status.
    
    Args:
        state (TicketState): Current ticket state
    Returns:
        TicketState: Unmodified state
    """
    try:
        ticket_id = state["ticket_id"]
        user_email = state["user_email"]
        status = state["status"]
        
        details = {
            "priority": state.get("priority"),
            "classified_team": state.get("classified_team"),
            "resolution": state.get("resolution")
        }
        
        send_email(
            to_email=user_email,
            ticket_id=ticket_id,
            status=status,
            details=details
        )
        
        logger.info(f"Mail node processed for ticket {ticket_id}, status: {status}")
        return state
    except Exception as e:
        logger.error(f"Error in mail node for ticket {ticket_id}: {str(e)}")
        return state