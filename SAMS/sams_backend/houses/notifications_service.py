"""
Notification service for house allocation updates and alerts.
"""
from django.contrib.auth import get_user_model
from .models import HouseNotification

User = get_user_model()


def send_house_notification(user, title, message, notification_type="info", link=""):
    """
    Create an in-app notification record for a user.
    """
    if not user:
        return None
    try:
        return HouseNotification.objects.create(
            recipient=user,
            title=title,
            message=message,
            notification_type=notification_type,
            link=link,
        )
    except Exception:
        return None


def notify_status_change(application, old_status, new_status, performed_by=None):
    """
    Notify the application requester when status changes.
    """
    if not application.requester:
        return

    title_map = {
        "Submitted": "Application Submitted",
        "Under Review": "Application Under Review",
        "Verified": "Application Verified",
        "Waiting for Allocation": "In Allocation Queue",
        "Allocated": "House Allocated!",
        "Rejected": "Application Rejected",
        "Returned": "Application Returned for Edits",
    }
    title = title_map.get(new_status, f"Application Status: {new_status}")
    msg = f"Your housing application {application.application_no} status changed to '{new_status}'."

    if new_status == "Allocated" and application.allocated_house:
        msg = f"Congratulations! House {application.allocated_house.house_id} ({application.allocated_house.location}) has been allocated to you."

    if new_status == "Rejected" and application.rejection_reason:
        msg += f" Reason: {application.rejection_reason}"

    if new_status == "Returned" and application.returned_reason:
        msg += f" Reason: {application.returned_reason}"

    n_type = "success" if new_status == "Allocated" else ("error" if new_status in ("Rejected", "Returned") else "info")
    link = f"/house-application/status?id={application.id}"

    send_house_notification(
        user=application.requester,
        title=title,
        message=msg,
        notification_type=n_type,
        link=link,
    )
