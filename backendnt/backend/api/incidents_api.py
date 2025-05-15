import uuid
from flask import Blueprint, jsonify, redirect, request
from core.database import db
from core.models import User, Ticket
from api.auth_api import token_required
from graph import create_graph
from chatbot_graph import create_chatbot_graph
from utils.logger import logger
import traceback
import requests
from core.config import settings
from requests.auth import HTTPBasicAuth
from flask_socketio import SocketIO
from werkzeug.security import generate_password_hash
from datetime import datetime

from flask_socketio import join_room, emit
from langchain_core.messages import HumanMessage, SystemMessage

socketio = SocketIO(cors_allowed_origins="*")
incident_api = Blueprint('incident_api', __name__)
graph = create_graph()

# Initialize chatbot graph
cgraph = create_chatbot_graph()

def extract_value(field):
    """Extract the 'value' from a ServiceNow field if it's a dictionary, else return the field as-is."""
    if isinstance(field, dict) and 'value' in field:
        return field['value']
    return field

# One-time import endpoint (comment out after initial use)
# @incident_api.route("/api/import_servicenow_tickets", methods=["POST"])
# @token_required
# def import_servicenow_tickets():
#     """Import all tickets from ServiceNow into the local Ticket table (one-time)"""
#     try:
#         # Fetch all tickets from ServiceNow
#         url = f"{settings.SNOW_API_URL}?sysparm_query=ORDERBYsys_created_on&sysparm_display_value=all"
#         response = requests.get(
#             url,
#             auth=HTTPBasicAuth(settings.SNOW_AUTH_USERNAME, settings.SNOW_AUTH_PASSWORD),
#             headers={"Accept": "application/json"}
#         )

#         if response.status_code != 200:
#             logger.error(f"Failed to fetch ServiceNow tickets: {response.status_code} - {response.text}")
#             return jsonify({"status": "error", "message": "Failed to fetch ServiceNow tickets"}), response.status_code

#         tickets_data = response.json().get('result', [])
#         logger.info(f"Fetched {len(tickets_data)} tickets from ServiceNow")

#         for ticket_data in tickets_data:
#             # Extract fields, handling dictionary-based values
#             sys_id = extract_value(ticket_data.get('sys_id'))
#             email = extract_value(ticket_data.get('sys_created_by'))
#             description = extract_value(ticket_data.get('reported_issue', 'No description provided'))
#             severity = extract_value(ticket_data.get('severity'))
#             category = extract_value(ticket_data.get('category'))
#             status = extract_value(ticket_data.get('status'))
#             resolution_provided = extract_value(ticket_data.get('resolution_provided'))
#             created_on = extract_value(ticket_data.get('sys_created_on'))
#             updated_on = extract_value(ticket_data.get('sys_updated_on'))

#             # Skip if ticket already exists
#             if Ticket.query.filter_by(sys_id=sys_id).first():
#                 logger.info(f"Ticket {sys_id} already exists, skipping")
#                 continue

#             # Find or create user
#             user = User.query.filter_by(email=email).first()
#             if not user:
#                 logger.info(f"Creating new user for email: {email}")
#                 user = User(
#                     email=email,
#                     password_hash=generate_password_hash(str(uuid.uuid4()))
#                 )
#                 db.session.add(user)
#                 db.session.flush()

#             # Map status
#             mapped_status = 'resolved' if status.lower() == 'closed' else 'new'

#             # Parse timestamps
#             created_at = datetime.strptime(created_on, '%Y-%m-%d %H:%M:%S') if created_on else datetime.utcnow()
#             updated_at = datetime.strptime(updated_on, '%Y-%m-%d %H:%M:%S') if updated_on else created_at

#             # Create ticket
#             ticket = Ticket(
#                 sys_id=sys_id,
#                 user_id=user.id,
#                 email=email,
#                 description=description,
#                 status=mapped_status,
#                 priority=severity,
#                 classified_team=category,
#                 l2_resolution=resolution_provided if mapped_status == 'resolved' else None,
#                 created_at=created_at,
#                 updated_at=updated_at
#             )
#             db.session.add(ticket)
#             db.session.commit()

#         logger.info(f"Imported {len(tickets_data)} tickets from ServiceNow")
#         return jsonify({"status": "success", "message": f"Imported {len(tickets_data)} tickets"}), 200

#     except Exception as e:
#         logger.error(f"Error importing ServiceNow tickets: {str(e)}\n{traceback.format_exc()}")
#         db.session.rollback()
#         return jsonify({"status": "error", "message": str(e)}), 500


# Endpoint to test via Postman
@incident_api.route("/api/process_ticket", methods=["POST"])
@token_required
def process_ticket():
    try:
        data = request.json
        ticket_id = data.get("sys_id")
        description = data.get("description")
        source = data.get("source")  # New source field
        user_email = request.email
        
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({"status": "error", "message": "User not found"}), 404
        
        ticket = Ticket(
            sys_id=ticket_id,
            user_id=user.id,
            email=user_email,
            description=description,
            status="new",
            source=source  # Save source
        )
        db.session.add(ticket)
        db.session.commit()  # Commit to ensure ticket is saved before RCA/PM
        
        initial_state = {
            "ticket_id": ticket_id,
            "user_email": user_email,
            "description": description,
            "status": "new",
            "l2_count": 0
        }
        
        # Proceed with main graph processing
        thread = {"configurable": {"thread_id": f"{user_email}:{ticket_id}"}}
        final_state = graph.invoke(initial_state, thread)
        ticket.status = final_state["status"]
        if "resolution" in final_state and final_state.get("feedback_satisfied"):
            ticket.l2_resolution = final_state["resolution"]
            ticket.priority = final_state.get("priority")
            ticket.classified_team = final_state.get("classified_team")
        db.session.commit()
        
        return jsonify({"status": "success", "message": "Ticket processed", "state": final_state}), 200
    except Exception as e:
        logger.error(f"Error processing ticket: {str(e)}\n{traceback.format_exc()}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@incident_api.route("/api/more_info", methods=["POST"])
@token_required
def submit_more_info():
    try:
        data = request.json
        ticket_id = data.get("sys_id")
        additional_info = data.get("additional_info")
        user_email = request.email
        
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        ticket = Ticket.query.filter_by(sys_id=ticket_id, user_id=user.id).first()
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404
        
        ticket.description += f"\nAdditional Info: {additional_info}"
        db.session.commit()
        
        thread = {"configurable": {"thread_id": f"{user_email}:{ticket_id}"}}
        graph.update_state(thread, values={"additional_info": additional_info, "status": "more_info_received"}, as_node="more_info")
        
        final_state = graph.invoke(None, thread)
        ticket.status = final_state["status"]
        if "resolution" in final_state and final_state.get("feedback_satisfied"):
            ticket.l2_resolution = final_state["resolution"]
            ticket.priority = final_state.get("priority")
            ticket.classified_team = final_state.get("classified_team")
        db.session.commit()
        
        return jsonify({"status": "success", "message": "Additional info submitted", "state": final_state}), 200
    except Exception as e:
        logger.error(f"Error submitting more info: {str(e)}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@incident_api.route("/api/feedback", methods=["POST"])
@token_required
def submit_feedback():
    try:
        data = request.json
        ticket_id = data.get("sys_id")
        feedback = data.get("feedback")
        user_email = request.email
        
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        ticket = Ticket.query.filter_by(sys_id=ticket_id, user_id=user.id).first()
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404
        
        ticket.feedback = feedback
        db.session.commit()
        
        satisfied = feedback.lower() == "yes"
        
        thread = {"configurable": {"thread_id": f"{user_email}:{ticket_id}"}}
        graph.update_state(thread, values={"feedback_satisfied": satisfied, "status": "feedback_received"}, as_node="feedback_agent")
        
        final_state = graph.invoke(None, thread)
        ticket.status = final_state["status"]
        if satisfied and "resolution" in final_state:
            ticket.l2_resolution = final_state["resolution"]
            ticket.priority = final_state.get("priority")
            ticket.classified_team = final_state.get("classified_team")
        db.session.commit()
        
        return jsonify({"status": "success", "message": "Feedback submitted", "state": final_state}), 200
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@incident_api.route("/api/incidents", methods=["GET"])
@token_required
def get_incidents():
    """Fetch user-specific incidents from the tickets table"""
    try:
        user_email = request.email
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Fetch all tickets for this user
        tickets = Ticket.query.filter_by(user_id=user.id).all()
        incidents = [{
            "ticket_id": ticket.sys_id,
            "email": ticket.email,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "classified_team": ticket.classified_team,
            "user_feedback": ticket.feedback,
            "created_at": ticket.created_at.isoformat(),
            "l2_resolution": ticket.l2_resolution,
            "source": ticket.source,
            "rca": ticket.rca,
            "pm": ticket.pm
        } for ticket in tickets]
        
        logger.info(f"Fetched incidents for {user_email}: {len(incidents)} tickets")
        return jsonify(incidents), 200
    except Exception as e:
        logger.error(f"Error fetching incidents: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
    
@incident_api.route("/api/incidents/<ticket_id>", methods=["GET"])
@token_required
def get_incident_by_id(ticket_id):
    """Fetch a specific ticket by ticket_id for the authenticated user"""
    try:
        user_email = request.email
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Fetch the specific ticket for this user
        ticket = Ticket.query.filter_by(sys_id=ticket_id, user_id=user.id).first()
        if not ticket:
            return jsonify({"error": "Ticket not found or does not belong to user"}), 404
        
        incident = {
            "ticket_id": ticket.sys_id,
            "email": ticket.email,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "classified_team": ticket.classified_team,
            "user_feedback": ticket.feedback,
            "created_at": ticket.created_at.isoformat(),
            "l2_resolution": ticket.l2_resolution,
            "l2_is_new": ticket.l2_is_new,
            "l3_resolution": ticket.l3_resolution,
            "l4_status": ticket.l4_status,
            "source": ticket.source,
            "rca": ticket.rca,
            "pm": ticket.pm
        }
        
        logger.info(f"Fetched ticket {ticket_id} for {user_email}")
        return jsonify(incident), 200
    except Exception as e:
        logger.error(f"Error fetching ticket {ticket_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@incident_api.route("/api/incidents/source", methods=["GET"])
@token_required
def get_incidents_by_source():
    """Fetch user-specific incidents filtered by source (servicenow/jira/all)"""
    try:
        user_email = request.email
        source = request.args.get("source", "all").lower()
        
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Validate source parameter
        if source not in ["servicenow", "jira", "all"]:
            return jsonify({"error": "Invalid source parameter. Use 'servicenow', 'jira', or 'all'"}), 400
        
        # Fetch tickets based on source
        query = Ticket.query.filter_by(user_id=user.id)
        if source != "all":
            query = query.filter_by(source=source)
        
        tickets = query.all()
        incidents = [{
            "ticket_id": ticket.sys_id,
            "email": ticket.email,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "classified_team": ticket.classified_team,
            "user_feedback": ticket.feedback,
            "created_at": ticket.created_at.isoformat(),
            "l2_resolution": ticket.l2_resolution,
            "source": ticket.source,
            "rca": ticket.rca,
            "pm": ticket.pm
        } for ticket in tickets]
        
        logger.info(f"Fetched {len(incidents)} incidents for {user_email} with source {source}")
        return jsonify(incidents), 200
    except Exception as e:
        logger.error(f"Error fetching incidents by source for {user_email}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@incident_api.route("/api/incidents/webhook", methods=["POST"])
def servicenow_webhook():
    """ServiceNow webhook for new ticket creation"""
    try:
        request_data = request.json
        if not request_data:
            return jsonify({"status": "error", "message": "No JSON data received"}), 400

        ticket_data = request_data.get('result')
        if not ticket_data:
            return jsonify({"status": "error", "message": "No ticket data in webhook payload"}), 400

        sys_id = extract_value(ticket_data.get('sys_id'))
        email = extract_value(ticket_data.get('sys_created_by'))
        description = extract_value(ticket_data.get('reported_issue', 'No description provided'))
        created_on = extract_value(ticket_data.get('sys_created_on'))
        updated_on = extract_value(ticket_data.get('sys_updated_on'))

        # Check if ticket already exists
        existing_ticket = Ticket.query.filter_by(sys_id=sys_id).first()
        if existing_ticket:
            logger.info(f"Ticket {sys_id} already exists, skipping")
            return jsonify({"status": "success", "message": "Ticket already processed"}), 200

        # Find or create user
        user = User.query.filter_by(email=email).first()
        if not user:
            logger.info(f"Creating new user for email: {email}")
            user = User(
                email=email,
                password_hash=generate_password_hash(str(uuid.uuid4()))
            )
            db.session.add(user)
            db.session.flush()

        # Parse timestamps
        created_at = datetime.strptime(created_on, '%Y-%m-%d %H:%M:%S') if created_on else datetime.utcnow()
        updated_at = datetime.strptime(updated_on, '%Y-%m-%d %H:%M:%S') if updated_on else created_at

        # Create ticket
        ticket = Ticket(
            sys_id=sys_id,
            user_id=user.id,
            email=email,
            description=description,
            created_at=created_at,
            updated_at=updated_at,
            source="servicenow"  # Set source for ServiceNow webhook
        )
        db.session.add(ticket)
        db.session.commit()  # Commit to ensure ticket is saved before RCA/PM

        # Generate RCA and PM (updates database only)
        initial_state = {
            "ticket_id": sys_id,
            "user_email": email,
            "description": description,
            "status": "new",
            "l2_count": 0
        }

        # Proceed with main graph processing
        thread = {"configurable": {"thread_id": f"{email}:{sys_id}"}}
        final_state = graph.invoke(initial_state, thread)
        ticket.status = final_state["status"]
        if "resolution" in final_state and final_state.get("feedback_satisfied"):
            ticket.l2_resolution = final_state["resolution"]
        ticket.priority = final_state.get("priority")
        ticket.classified_team = final_state.get("classified_team")
        db.session.commit()

        # Emit ticket update to frontend
        socketio.emit("ticket_update", {
            "ticket_id": ticket.sys_id,
            "email": ticket.email,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "classified_team": ticket.classified_team,
            "user_feedback": ticket.feedback,
            "created_at": ticket.created_at.isoformat(),
            "l2_resolution": ticket.l2_resolution,
            "source": ticket.source,
            "rca": ticket.rca,
            "pm": ticket.pm
        })

        logger.info(f"Processed new ticket {sys_id} from ServiceNow webhook")
        return jsonify({"status": "success", "message": "Ticket processed"}), 200

    except Exception as e:
        logger.error(f"Error in webhook: {str(e)}\n{traceback.format_exc()}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    

@incident_api.route('/api/ticket-state-count', methods=['GET'])
@token_required
def get_ticket_state_count():
    """Return the count of tickets by status for the authenticated user."""
    state = request.args.get('state', 'all').lower()
    user_email = request.email

    try:
        user = User.query.filter_by(email=user_email).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        query = Ticket.query.filter_by(user_id=user.id)
        
        if state != 'all':
            count = query.filter_by(status=state).count()
            return jsonify({state: count})
        else:
            status_counts = (
                query
                .group_by(Ticket.status)
                .with_entities(Ticket.status, db.func.count(Ticket.status))
                .all()
            )
            result = {status.lower(): count for status, count in status_counts if status}
            return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching ticket state count for {user_email}: {str(e)}")
        return jsonify({'error': str(e)}), 500

def init_socketio(socketio):
    @socketio.on('join')
    def handle_join(data):
        """Handle user joining a ticket chat."""
        ticket_id = data['ticket_id']
        join_room(ticket_id)
        ticket = Ticket.query.filter_by(sys_id=ticket_id).first()
        if not ticket:
            emit('error', {'message': 'Ticket not found'}, room=ticket_id)
            return
        
        # Send ticket details as initial message
        initial_message = {
            'type': 'ticket_details',
            'ticket': {
                'id': ticket.sys_id,
                'description': ticket.description,
                'status': ticket.status,
                'priority': ticket.priority,
                'team': ticket.classified_team,
                'resolution': ticket.l2_resolution,
                'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
                'classified_team': ticket.classified_team,
                'source': ticket.source,
                'rca': ticket.rca,
                'pm': ticket.pm
            }
        }
        emit('message', initial_message, room=ticket_id)
        
        # Initialize conversation with system message including ticket context
        system_content = (
            f"You are an assistant helping with Ticket ID: {ticket.sys_id}. "
            f"Description: {ticket.description}. Status: {ticket.status}. "
            f"Priority: {ticket.priority}. Team: {ticket.classified_team}. "
            f"Source: {ticket.source}. RCA: {ticket.rca}. PM: {ticket.pm}."
        )
        config = {"configurable": {"thread_id": ticket_id}}
        cgraph.invoke({"messages": [SystemMessage(content=system_content)]}, config)

    @socketio.on('message')
    def handle_message(data):
        """Handle user messages and generate AI responses."""
        ticket_id = data['ticket_id']
        user_message = data['message']
        config = {"configurable": {"thread_id": ticket_id}}
        result = cgraph.invoke({"messages": [HumanMessage(content=user_message)]}, config)
        emit('message', {'type': 'text', 'text': result['messages'][-1].content}, room=ticket_id)