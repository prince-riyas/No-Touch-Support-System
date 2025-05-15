from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END , add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import AIMessage
from langchain_openai import AzureChatOpenAI
from core.config import settings
from utils.logger import logger
import traceback

# Azure OpenAI model setup
llm = AzureChatOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_key=settings.AZURE_OPENAI_API_KEY,
    api_version=settings.AZURE_OPENAI_API_VERSION,
    deployment_name=settings.AZURE_OPENAI_DEPLOYMENT
)

memory = MemorySaver()

class ChatState(TypedDict):
    messages: Annotated[list, add_messages]

def chatbot_node(state: ChatState):
    """Process the chat state and generate an AI response."""
    try:
        response = llm.invoke(state["messages"])
        return {"messages": [response]}
    except Exception as e:
        logger.error(f"Error in chatbot_node: {str(e)}\n{traceback.format_exc()}")
        return {"messages": [AIMessage(content="Sorry, I encountered an error. Please try again later.")]}

def create_chatbot_graph():
    """Create and compile the chatbot graph with PostgresSaver."""
    graph = StateGraph(ChatState)
    graph.add_node("chatbot", chatbot_node)
    graph.add_edge("chatbot", END)
    graph.set_entry_point("chatbot")
    
    return graph.compile(checkpointer=memory)