"""
Roles and Permissions System for Ross Tax Preparation
"""

from enum import Enum
from typing import List, Dict

class UserRole(str, Enum):
    """User roles in the system"""
    ADMIN = "admin"
    OFFICE_ASSISTANT = "office_assistant"

class Permission(str, Enum):
    """System permissions"""
    # Dashboard
    VIEW_DASHBOARD = "view_dashboard"
    
    # Clients
    VIEW_CLIENTS = "view_clients"
    CREATE_CLIENT = "create_client"
    EDIT_CLIENT = "edit_client"
    DELETE_CLIENT = "delete_client"
    
    # Appointments
    VIEW_APPOINTMENTS = "view_appointments"
    CREATE_APPOINTMENT = "create_appointment"
    EDIT_APPOINTMENT = "edit_appointment"
    DELETE_APPOINTMENT = "delete_appointment"
    MANAGE_OFFICE_HOURS = "manage_office_hours"
    
    # Documents
    VIEW_DOCUMENTS = "view_documents"
    UPLOAD_DOCUMENT = "upload_document"
    DELETE_DOCUMENT = "delete_document"
    
    # Communications
    VIEW_MESSAGES = "view_messages"
    SEND_MESSAGE = "send_message"
    VIEW_WHATSAPP = "view_whatsapp"
    SEND_WHATSAPP = "send_whatsapp"
    VIEW_SMS = "view_sms"
    SEND_SMS = "send_sms"
    VIEW_PUSH_NOTIFICATIONS = "view_push_notifications"
    SEND_PUSH_NOTIFICATION = "send_push_notification"
    
    # Content Management
    MANAGE_FAQS = "manage_faqs"
    MANAGE_NEWS = "manage_news"
    MANAGE_EDUCATION = "manage_education"
    
    # Analytics (Read-only for assistant)
    VIEW_ANALYTICS = "view_analytics"
    
    # Payments & Subscriptions (Admin only)
    VIEW_PAYMENTS = "view_payments"
    MANAGE_SUBSCRIPTIONS = "manage_subscriptions"
    MANAGE_PLANS = "manage_plans"
    VIEW_WITHDRAWAL_REQUESTS = "view_withdrawal_requests"
    APPROVE_WITHDRAWALS = "approve_withdrawals"
    
    # Credits (Admin only)
    VIEW_CREDITS = "view_credits"
    MANAGE_CREDITS = "manage_credits"
    ADJUST_CREDITS = "adjust_credits"
    
    # System Settings (Admin only)
    MANAGE_USERS = "manage_users"
    MANAGE_SYSTEM_SETTINGS = "manage_system_settings"
    MANAGE_INTEGRATIONS = "manage_integrations"
    VIEW_SYSTEM_LOGS = "view_system_logs"


# Role permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, List[Permission]] = {
    UserRole.ADMIN: [
        # Admin has ALL permissions
        Permission.VIEW_DASHBOARD,
        # Clients
        Permission.VIEW_CLIENTS,
        Permission.CREATE_CLIENT,
        Permission.EDIT_CLIENT,
        Permission.DELETE_CLIENT,
        # Appointments
        Permission.VIEW_APPOINTMENTS,
        Permission.CREATE_APPOINTMENT,
        Permission.EDIT_APPOINTMENT,
        Permission.DELETE_APPOINTMENT,
        Permission.MANAGE_OFFICE_HOURS,
        # Documents
        Permission.VIEW_DOCUMENTS,
        Permission.UPLOAD_DOCUMENT,
        Permission.DELETE_DOCUMENT,
        # Communications
        Permission.VIEW_MESSAGES,
        Permission.SEND_MESSAGE,
        Permission.VIEW_WHATSAPP,
        Permission.SEND_WHATSAPP,
        Permission.VIEW_SMS,
        Permission.SEND_SMS,
        Permission.VIEW_PUSH_NOTIFICATIONS,
        Permission.SEND_PUSH_NOTIFICATION,
        # Content
        Permission.MANAGE_FAQS,
        Permission.MANAGE_NEWS,
        Permission.MANAGE_EDUCATION,
        # Analytics
        Permission.VIEW_ANALYTICS,
        # Payments
        Permission.VIEW_PAYMENTS,
        Permission.MANAGE_SUBSCRIPTIONS,
        Permission.MANAGE_PLANS,
        Permission.VIEW_WITHDRAWAL_REQUESTS,
        Permission.APPROVE_WITHDRAWALS,
        # Credits
        Permission.VIEW_CREDITS,
        Permission.MANAGE_CREDITS,
        Permission.ADJUST_CREDITS,
        # System
        Permission.MANAGE_USERS,
        Permission.MANAGE_SYSTEM_SETTINGS,
        Permission.MANAGE_INTEGRATIONS,
        Permission.VIEW_SYSTEM_LOGS,
    ],
    UserRole.OFFICE_ASSISTANT: [
        # Dashboard
        Permission.VIEW_DASHBOARD,
        # Clients - Full access
        Permission.VIEW_CLIENTS,
        Permission.CREATE_CLIENT,
        Permission.EDIT_CLIENT,
        # Appointments - Full access
        Permission.VIEW_APPOINTMENTS,
        Permission.CREATE_APPOINTMENT,
        Permission.EDIT_APPOINTMENT,
        Permission.DELETE_APPOINTMENT,
        Permission.MANAGE_OFFICE_HOURS,
        # Documents - Full access
        Permission.VIEW_DOCUMENTS,
        Permission.UPLOAD_DOCUMENT,
        # Communications - Full access
        Permission.VIEW_MESSAGES,
        Permission.SEND_MESSAGE,
        Permission.VIEW_WHATSAPP,
        Permission.SEND_WHATSAPP,
        Permission.VIEW_SMS,
        Permission.SEND_SMS,
        Permission.VIEW_PUSH_NOTIFICATIONS,
        Permission.SEND_PUSH_NOTIFICATION,
        # Content - Full access
        Permission.MANAGE_FAQS,
        Permission.MANAGE_NEWS,
        Permission.MANAGE_EDUCATION,
        # Analytics - Read-only
        Permission.VIEW_ANALYTICS,
        # Payments - Read-only
        Permission.VIEW_PAYMENTS,
        Permission.VIEW_WITHDRAWAL_REQUESTS,
        # Credits - Read-only
        Permission.VIEW_CREDITS,
    ]
}


def has_permission(user_role: str, permission: Permission) -> bool:
    """Check if a user role has a specific permission"""
    try:
        role = UserRole(user_role)
        return permission in ROLE_PERMISSIONS.get(role, [])
    except ValueError:
        return False


def get_user_permissions(user_role: str) -> List[str]:
    """Get all permissions for a user role"""
    try:
        role = UserRole(user_role)
        return [p.value for p in ROLE_PERMISSIONS.get(role, [])]
    except ValueError:
        return []


def can_access_admin_panel(user_role: str) -> bool:
    """Check if user can access admin panel"""
    return user_role in [UserRole.ADMIN.value, UserRole.OFFICE_ASSISTANT.value]
