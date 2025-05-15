import requests
from core.config import settings
from utils.logger import logger
import traceback

def send_email(to_email: str, ticket_id: str, status: str, details: dict = None):
    """
    Send an email notification to the user via Mailgun based on ticket status.
    
    Args:
        to_email (str): Recipient's email address
        ticket_id (str): Ticket ID
        status (str): Current status of the ticket
        details (dict): Additional ticket details (e.g., resolution, priority)
    """
    try:
        mailgun_api_key = settings.MAILGUN_API_KEY
        mailgun_domain = settings.MAILGUN_DOMAIN
        mailgun_from_email = settings.MAILGUN_FROM_EMAIL
        mailgun_api_url = f"https://api.mailgun.net/v3/{mailgun_domain}/messages"

        if not mailgun_from_email:
            logger.error(f"MAILGUN_FROM_EMAIL is not set for ticket {ticket_id}")
            raise ValueError("MAILGUN_FROM_EMAIL is not configured")
        
        logger.debug(f"Sending email for ticket {ticket_id} from {mailgun_from_email} to {to_email}")

        subject = f"Ticket Update: {ticket_id}"
        details = details or {}

        if status == "l2_processed":
            text_body = (
                f"Dear User,\n\n"
                f"Your ticket {ticket_id} has been processed by our L2 agent.\n\n"
                f"Priority: {details.get('priority', 'N/A')}\n\n"
                f"Assigned Team: {details.get('classified_team', 'N/A')}\n\n"
                f"Resolution suggested: {details.get('resolution', 'N/A')}\n\n"
                f"Please wait for further updates or provide feedback if requested.\n\n"
                f"Best regards,\nSupport Team"
            )
            html_body = (
                f"<html><body>"
                f"<p>Dear User,</p>"
                f"<p>Your ticket {ticket_id} has been processed by our L2 agent.</p>"
                f"<p><strong>Priority:</strong> {details.get('priority', 'N/A')}</p>"
                f"<p><strong>Assigned Team:</strong> {details.get('classified_team', 'N/A')}</p>"
                f"<p><strong>Resolution suggested:</strong> {details.get('resolution', 'N/A')}</p>"
                f"<p>Please wait for further updates or provide feedback if requested.</p>"
                f"<p>Best regards,<br>Support Team</p>"
                f"</body></html>"
            )
        elif status == "l3_processing":
            text_body = (
                f"Dear User,\n\n"
                f"Your ticket {ticket_id} has been escalated to L3 for development-level resolution.\n\n"
                f"Status: Processing\n\n"
                f"We will update you once the issue is resolved.\n\n"
                f"Best regards,\nSupport Team"
            )
            html_body = (
                f"<html><body>"
                f"<p>Dear User,</p>"
                f"<p>Your ticket {ticket_id} has been escalated to L3 for development-level resolution.</p>"
                f"<p><strong>Status:</strong> Processing</p>"
                f"<p>We will update you once the issue is resolved.</p>"
                f"<p>Best regards,<br>Support Team</p>"
                f"</body></html>"
            )
        elif status == "l4_escalated":
            text_body = (
                f"Dear User,\n\n"
                f"Your ticket {ticket_id} has been escalated to L4 for human intervention.\n\n"
                f"Assigned Team: {details.get('classified_team', 'N/A')}\n\n"
                f"Status: Pending\n\n"
                f"We will update you once the issue is resolved.\n\n"
                f"Best regards,\nSupport Team"
            )
            html_body = (
                f"<html><body>"
                f"<p>Dear User,</p>"
                f"<p>Your ticket {ticket_id} has been escalated to L4 for human intervention.</p>"
                f"<p><strong>Assigned Team:</strong> {details.get('classified_team', 'N/A')}</p>"
                f"<p><strong>Status:</strong> Pending</p>"
                f"<p>We will update you once the issue is resolved.</p>"
                f"<p>Best regards,<br>Support Team</p>"
                f"</body></html>"
            )
        elif status == "more_info_needed":
            text_body = (
                f"Dear User,\n\n"
                f"Your ticket {ticket_id} requires additional information to proceed.\n\n"
                f"Please provide more details via our application.\n\n"
                f"Best regards,\nSupport Team"
            )
            html_body = (
                f"<html><body>"
                f"<p>Dear User,</p>"
                f"<p>Your ticket {ticket_id} requires additional information to proceed.</p>"
                f"<p>Please provide more details via our application.</p>"
                f"<p>Best regards,<br>Support Team</p>"
                f"</body></html>"
            )
        elif status == "feedback_needed":
            text_body = (
                f"Dear User,\n\n"
                f"Your ticket {ticket_id} has a proposed resolution: {details.get('resolution', 'N/A')}.\n\n"
                f"Do tell us if this has resolved your issue via our application.\n\n"
                f"Best regards,\nSupport Team"
            )
            html_body = (
                f"<html><body>"
                f"<p>Dear User,</p>"
                f"<p>Your ticket {ticket_id} has a proposed resolution: <strong>{details.get('resolution', 'N/A')}</strong>.</p>"
                f"<p>Do tell us if this has resolved your issue via our application.</p>"
                f"<p>Best regards,<br>Support Team</p>"
                f"</body></html>"
            )
        else:
            text_body = (
                f"Dear User,\n\n"
                f"Your ticket {ticket_id} status has been updated: {status}.\n"
                f"Please contact support for further details.\n\n"
                f"Best regards,\nSupport Team"
            )
            html_body = (
                f"<html><body>"
                f"<p>Dear User,</p>"
                f"<p>Your ticket {ticket_id} status has been updated: <strong>{status}</strong>.</p>"
                f"<p>Please contact support for further details.</p>"
                f"<p>Best regards,<br>Support Team</p>"
                f"</body></html>"
            )

        response = requests.post(
            mailgun_api_url,
            auth=("api", mailgun_api_key),
            data={
                "from": mailgun_from_email,
                "to": to_email,
                "subject": subject,
                "text": text_body,
                "html": html_body
            },
            verify=False
        )

        if response.status_code == 200:
            logger.info(f"Email sent to {to_email} for ticket {ticket_id}, status: {status}")
        else:
            logger.error(f"Mailgun API error for ticket {ticket_id}: {response.status_code} - {response.text}")
            raise Exception(f"Mailgun API error: {response.status_code} - {response.text}")

    except Exception as e:
        logger.error(f"Failed to send email for ticket {ticket_id}: {str(e)}\n{traceback.format_exc()}")
        raise