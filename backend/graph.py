from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.postgres import PostgresSaver
import psycopg
from psycopg_pool import ConnectionPool
from models.ticket_state import TicketState
from nodes.l2_node import l2_node
from nodes.analyser_node import analyser_node
from nodes.more_info_node import more_info_node
from nodes.feedback_node import feedback_node
from nodes.l3_l4_classifier_node import l3_l4_classifier_node
from nodes.l3_node import l3_node
from nodes.l4_node import l4_node
from nodes.mail_node import mail_node
from nodes.rca_pm_node import rca_pm_node
from core.config import settings
from utils.logger import logger
import traceback

def create_graph():
    try:
        graph = StateGraph(TicketState)
        
        # Nodes
        graph.add_node("rca_pm", rca_pm_node)
        graph.add_node("l2_agent", l2_node)
        graph.add_node("mail_l2", mail_node)
        graph.add_node("analyser", analyser_node)
        graph.add_node("more_info", more_info_node)
        graph.add_node("mail_more_info", mail_node)
        graph.add_node("feedback_agent", feedback_node)
        graph.add_node("mail_feedback", mail_node)
        graph.add_node("l3_l4_classifier", l3_l4_classifier_node)
        graph.add_node("l3_agent", l3_node)
        graph.add_node("mail_l3", mail_node)
        graph.add_node("l4_agent", l4_node)
        graph.add_node("mail_l4", mail_node)
        
        # Edges
        # Fan-out from START to both rca_pm and l2_agent
        graph.add_edge(START, "rca_pm")
        graph.add_edge(START, "l2_agent")
        
        # rca_pm branch ends
        graph.add_edge("rca_pm", END)
        
        # l2_agent branch continues
        graph.add_edge("l2_agent", "mail_l2")
        graph.add_edge("mail_l2", "analyser")
        
        graph.add_conditional_edges(
            "analyser",
            lambda state: state["status"],
            {
                "more_info_needed": "mail_more_info",
                "feedback_needed": "mail_feedback",
                "l3_l4_classification_needed": "l3_l4_classifier",
                "l2_processed": END,
                "error": END
            }
        )
        
        graph.add_edge("mail_more_info", "more_info")
        graph.add_edge("more_info", "l2_agent")
        
        graph.add_edge("mail_feedback", "feedback_agent")
        graph.add_conditional_edges(
            "feedback_agent",
            lambda state: "resolved" if state.get("feedback_satisfied") else "l3_l4_classifier",
            {"resolved": END, "l3_l4_classifier": "l3_l4_classifier"}
        )
        
        graph.add_conditional_edges(
            "l3_l4_classifier",
            lambda state: state["status"],
            {"l3_processing": "l3_agent", "l4_escalated": "l4_agent", "error": END}
        )
        
        graph.add_edge("l3_agent", "mail_l3")
        graph.add_edge("mail_l3", END)
        graph.add_edge("l4_agent", "mail_l4")
        graph.add_edge("mail_l4", END)
        
        # Persistence
        conninfo = settings.DATABASE_URL
        logger.info(f"Setting up PostgresSaver with conninfo: {conninfo}")
        pool = ConnectionPool(conninfo)
        try:
            with psycopg.connect(
                conninfo,
                autocommit=True
            ) as setup_conn:
                memory = PostgresSaver(setup_conn)
                memory.setup()
                logger.info("PostgresSaver setup completed successfully")
        except psycopg.Error as e:
            logger.error(f"Failed to set up PostgresSaver: {str(e)}\n{traceback.format_exc()}")
            raise
        
        checkpointer = PostgresSaver(pool)
        
        compiled_graph = graph.compile(
            checkpointer=checkpointer,
            interrupt_before=["more_info", "feedback_agent"]
        )
        logger.info("LangGraph compiled successfully")
        return compiled_graph
    except Exception as e:
        logger.error(f"Error creating graph: {str(e)}\n{traceback.format_exc()}")
        raise