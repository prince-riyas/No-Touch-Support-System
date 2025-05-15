from models.ticket_state import TicketState
from agents.l2_agent import predict
from utils.logger import logger
from core.models import Ticket
from core.database import db
import traceback

def l2_node(state: TicketState) -> TicketState:
    try:
        logger.info(f"Processing ticket {state['ticket_id']} in L2 node, l2_count: {state.get('l2_count', 0)}")
        additional_info = state.get("additional_info")
        user_input = state.get("description").split("User:")[-1].strip() if "User:" in state.get("description", "") else ""
        
        if additional_info:
            combined_input = f"{state['description']} {additional_info} User: {user_input}"
        else:
            combined_input = f"{state['description']} User: {user_input}"
        
        result = predict(combined_input)
      
        logger.info(f"Predict result for {state['ticket_id']}: {result}")
        state["priority"] = result["Priority"]
        state["classified_team"] = result["Classified Team"]
        state["combined_score"] = result["combined_score"]
        state["resolution"] = result["Resolution"]
        state["l2_count"] = state.get("l2_count", 0) + 1
        state["status"] = "l2_processed"
        state["l2_is_new"] = result["is_new_issue"]
        
        ticket = Ticket.query.filter_by(sys_id=state["ticket_id"]).first()
        if ticket:
            ticket.l2_is_new = state["l2_is_new"]
            ticket.l2_resolution = state["resolution"]
            ticket.status = state["status"]
            ticket.priority = state["priority"]
            ticket.classified_team = state["classified_team"]
            db.session.commit()
            logger.info(f"Updated ticket {state['ticket_id']} in database")
        else:
            logger.warning(f"Ticket {state['ticket_id']} not found in database")
    except Exception as e:
        logger.error(f"L2 Node Error for ticket {state['ticket_id']}: {str(e)}\n{traceback.format_exc()}")
    return state