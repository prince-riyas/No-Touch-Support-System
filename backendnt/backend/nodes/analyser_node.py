from models.ticket_state import TicketState
from utils.logger import logger

FIRST_THRESHOLD = 0.7  # Threshold for first pass (l2_count == 1)
SECOND_THRESHOLD = 0.8  # Threshold for second pass (l2_count == 2)

def analyser_node(state: TicketState) -> TicketState:
    l2_count = state.get("l2_count", 0)
    combined_score = state.get("combined_score", 0.0)
    
    logger.info(f"Analysing ticket {state['ticket_id']}: l2_count={l2_count}, score={combined_score}")
    
    if l2_count == 1:
        if combined_score < FIRST_THRESHOLD:
            state["status"] = "more_info_needed"
            logger.info(f"Ticket {state['ticket_id']} routed to more_info_node")
        else:
            state["status"] = "feedback_needed"
            logger.info(f"Ticket {state['ticket_id']} routed to feedback_node")
    elif l2_count == 2:
        if combined_score < SECOND_THRESHOLD:
            state["status"] = "l3_l4_classification_needed"
            logger.info(f"Ticket {state['ticket_id']} routed to l3_l4_classifier_node")
        else:
            state["status"] = "feedback_needed"
            logger.info(f"Ticket {state['ticket_id']} routed to feedback_node")
    else:
        logger.error(f"Invalid l2_count: {l2_count} for ticket {state['ticket_id']}")
        state["status"] = "error"
    
    return state