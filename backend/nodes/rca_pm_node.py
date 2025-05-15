from langchain_openai import AzureChatOpenAI
from pydantic import BaseModel, Field
from core.config import settings
from core.database import db
from models.ticket_state import TicketState
from utils.logger import logger
from core.models import Ticket

class RCAAndPM(BaseModel):
    """Structured output for Root Cause Analysis and Preventive Measures"""
    rca: str = Field(description="Root Cause Analysis identifying the underlying cause(s) of the issue")
    pm: str = Field(description="Preventive Measures to prevent recurrence of the issue")

def rca_pm_node(state: TicketState) -> None:
    """Generate Root Cause Analysis and Preventive Measures for the ticket and update the database"""
    try:
        model = AzureChatOpenAI(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            deployment_name=settings.AZURE_OPENAI_DEPLOYMENT
        )
        
        structured_llm = model.with_structured_output(RCAAndPM)
        
        prompt = f"""
        Given the following ticket description, provide a Root Cause Analysis (RCA) and Preventive Measures (PM):
        
        Ticket Description: {state["description"]}
        
        Provide:
        1. Root Cause Analysis: Identify the underlying cause(s) of the issue (just one paragraph and dont include any special characters).
        2. Preventive Measures: Suggest steps to prevent recurrence of the issue (just one paragraph and dont include any special characters).
        """
        
        response = structured_llm.invoke(prompt)
        # logger.info(response)
        rca = response.rca
        pm = response.pm
        
        # Update ticket in database
        ticket = Ticket.query.filter_by(sys_id=state["ticket_id"]).first()
        if ticket:
            ticket.rca = rca
            ticket.pm = pm
            db.session.commit()
        
        logger.info(f"Generated RCA and PM for ticket {state['ticket_id']}")
    except Exception as e:
        logger.error(f"Error in RCA_PM node for ticket {state['ticket_id']}: {str(e)}")