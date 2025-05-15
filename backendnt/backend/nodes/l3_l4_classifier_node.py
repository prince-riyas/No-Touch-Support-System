from models.ticket_state import TicketState
from langchain_openai import AzureChatOpenAI
from pydantic import BaseModel, Field
from core.config import settings
from utils.logger import logger

llm = AzureChatOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_key=settings.AZURE_OPENAI_API_KEY,
    api_version=settings.AZURE_OPENAI_API_VERSION,
    deployment_name=settings.AZURE_OPENAI_DEPLOYMENT
)

class Classifier(BaseModel):
    """ Classify it as L3 or L4"""
    classification : str = Field(description="classify as L3 or L4")
    
structured_llm = llm.with_structured_output(Classifier)

def l3_l4_classifier_node(state: TicketState) -> TicketState:
    description = state["description"]
    additional_info = state.get("additional_info", "")
    prompt = f"""
    Ticket Description: {description}
    Additional Information: {additional_info}
    Classify this ticket as:
    - L3: Development issue (e.g., code error, bug) that can be resolved under 40 hours.
    - L4: Requires human intervention or takes more than 40 hours to resolve.
    """
    try:
        response = structured_llm.invoke(prompt)
        # logger.info(response)
        classification = response.classification
        if classification == 'L3':
            state["status"] = "l3_processing"
            logger.info(f"Ticket {state['ticket_id']} classified as L3")
        elif classification == 'L4':
            state["status"] = "l4_escalated"
            logger.info(f"Ticket {state['ticket_id']} classified as L4")
        else:
            logger.error(f"Invalid classification: {classification} for ticket {state['ticket_id']}")
            state["status"] = "error"
    except Exception as e:
        logger.error(f"Error classifying ticket {state['ticket_id']}: {str(e)}")
        state["status"] = "error"
    return state


