"""
Google Calendar Integration Service
Handles OAuth2 flow and calendar event synchronization
"""
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging

logger = logging.getLogger(__name__)

class GoogleCalendarService:
    """Service for Google Calendar integration"""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        
    def get_authorization_url(self, state: str = None) -> str:
        """
        Generate Google OAuth2 authorization URL
        
        Args:
            state: Optional state parameter for security
            
        Returns:
            Authorization URL for user to visit
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force consent to get refresh token
        )
        
        return authorization_url
    
    def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens
        
        Args:
            code: Authorization code from OAuth callback
            
        Returns:
            Dictionary containing tokens and user info
        """
        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self.redirect_uri]
                    }
                },
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri
            )
            
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            # Get calendar info
            calendar_id = 'primary'
            try:
                service = build('calendar', 'v3', credentials=credentials)
                calendar = service.calendars().get(calendarId='primary').execute()
                calendar_id = calendar.get('id', 'primary')
            except Exception as e:
                logger.warning(f"Could not fetch calendar info: {e}")
            
            return {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_expiry': credentials.expiry.isoformat() if credentials.expiry else None,
                'calendar_id': calendar_id
            }
            
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {e}")
            raise
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token
        
        Args:
            refresh_token: Refresh token
            
        Returns:
            New access token and expiry
        """
        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.client_id,
                client_secret=self.client_secret,
                scopes=self.SCOPES
            )
            
            # Refresh the token
            from google.auth.transport.requests import Request
            credentials.refresh(Request())
            
            return {
                'access_token': credentials.token,
                'token_expiry': credentials.expiry.isoformat() if credentials.expiry else None
            }
            
        except Exception as e:
            logger.error(f"Error refreshing access token: {e}")
            raise
    
    def list_calendars(self, credentials: Credentials) -> List[Dict[str, Any]]:
        """
        List all calendars available to the user
        
        Args:
            credentials: Google OAuth2 credentials
            
        Returns:
            List of calendars with id, name, and description
        """
        try:
            service = build('calendar', 'v3', credentials=credentials)
            
            calendars_result = service.calendarList().list().execute()
            calendars = calendars_result.get('items', [])
            
            return [
                {
                    'id': cal.get('id'),
                    'name': cal.get('summary'),
                    'description': cal.get('description', ''),
                    'primary': cal.get('primary', False),
                    'backgroundColor': cal.get('backgroundColor', '#000000'),
                }
                for cal in calendars
            ]
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error listing calendars: {e}")
            raise
    
    def revoke_token(self, token: str) -> bool:
        """
        Revoke an access or refresh token with Google
        
        Args:
            token: Access or refresh token to revoke
            
        Returns:
            True if revocation successful, False otherwise
        """
        try:
            import requests
            
            revoke_url = f'https://oauth2.googleapis.com/revoke?token={token}'
            response = requests.post(revoke_url)
            
            if response.status_code == 200:
                logger.info("Token revoked successfully")
                return True
            else:
                logger.warning(f"Token revocation returned status {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error revoking token: {e}")
            return False
    
    def get_credentials_from_tokens(self, access_token: str, refresh_token: str) -> Credentials:
        """
        Create Credentials object from stored tokens and refresh if needed
        """
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.SCOPES
        )
        
        # Check if token is expired or about to expire (within 5 minutes)
        if credentials.expired or not credentials.valid:
            try:
                from google.auth.transport.requests import Request
                logger.info("Access token expired, refreshing...")
                credentials.refresh(Request())
                logger.info("Access token refreshed successfully")
            except Exception as e:
                logger.error(f"Error refreshing token: {e}")
                # Still return credentials, the API call might work or give better error
        
        return credentials
    
    def create_calendar_event(
        self,
        credentials: Credentials,
        summary: str,
        description: str,
        start_datetime: datetime,
        end_datetime: datetime,
        attendee_email: Optional[str] = None,
        location: Optional[str] = None,
        calendar_id: str = 'primary'
    ) -> Dict[str, Any]:
        """
        Create a calendar event
        
        Args:
            credentials: Google OAuth2 credentials
            summary: Event title
            description: Event description
            start_datetime: Start time
            end_datetime: End time
            attendee_email: Optional attendee email
            location: Optional location
            calendar_id: Calendar ID (default: 'primary')
            
        Returns:
            Created event details
        """
        try:
            service = build('calendar', 'v3', credentials=credentials)
            
            event_body = {
                'summary': summary,
                'description': description,
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': 'America/Chicago',  # Texas CST/CDT
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': 'America/Chicago',
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                        {'method': 'popup', 'minutes': 30},  # 30 minutes before
                    ],
                },
            }
            
            if location:
                event_body['location'] = location
            
            if attendee_email:
                event_body['attendees'] = [{'email': attendee_email}]
                event_body['guestsCanModify'] = False
                event_body['guestsCanInviteOthers'] = False
            
            event = service.events().insert(
                calendarId=calendar_id,
                body=event_body,
                sendUpdates='all' if attendee_email else 'none'
            ).execute()
            
            logger.info(f"Calendar event created: {event.get('id')}")
            
            return {
                'event_id': event.get('id'),
                'event_link': event.get('htmlLink'),
                'status': event.get('status')
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating calendar event: {e}")
            raise
    
    def update_calendar_event(
        self,
        credentials: Credentials,
        event_id: str,
        summary: Optional[str] = None,
        description: Optional[str] = None,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None,
        attendee_email: Optional[str] = None,
        location: Optional[str] = None,
        calendar_id: str = 'primary'
    ) -> Dict[str, Any]:
        """
        Update an existing calendar event
        """
        try:
            service = build('calendar', 'v3', credentials=credentials)
            
            # Get existing event
            event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
            
            # Update fields
            if summary:
                event['summary'] = summary
            if description:
                event['description'] = description
            if start_datetime:
                event['start'] = {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': 'America/Chicago',
                }
            if end_datetime:
                event['end'] = {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': 'America/Chicago',
                }
            if location:
                event['location'] = location
            if attendee_email:
                event['attendees'] = [{'email': attendee_email}]
            
            updated_event = service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event,
                sendUpdates='all' if attendee_email else 'none'
            ).execute()
            
            logger.info(f"Calendar event updated: {event_id}")
            
            return {
                'event_id': updated_event.get('id'),
                'event_link': updated_event.get('htmlLink'),
                'status': updated_event.get('status')
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error updating calendar event: {e}")
            raise
    
    def delete_calendar_event(
        self,
        credentials: Credentials,
        event_id: str,
        calendar_id: str = 'primary',
        send_updates: bool = True
    ) -> bool:
        """
        Delete a calendar event
        """
        try:
            service = build('calendar', 'v3', credentials=credentials)
            
            service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
                sendUpdates='all' if send_updates else 'none'
            ).execute()
            
            logger.info(f"Calendar event deleted: {event_id}")
            return True
            
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"Event not found: {event_id}")
                return False
            logger.error(f"Google Calendar API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error deleting calendar event: {e}")
            raise
    
    def list_events(
        self,
        credentials: Credentials,
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 100,
        calendar_id: str = 'primary'
    ) -> List[Dict[str, Any]]:
        """
        List calendar events
        """
        try:
            service = build('calendar', 'v3', credentials=credentials)
            
            # Default to next 30 days if no time range specified
            if not time_min:
                time_min = datetime.utcnow()
            if not time_max:
                time_max = time_min + timedelta(days=30)
            
            # Format time properly - remove microseconds and ensure UTC
            time_min_str = time_min.replace(microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')
            time_max_str = time_max.replace(microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')
            
            logger.info(f"Listing events from calendar: {calendar_id}")
            logger.info(f"Time range: {time_min_str} to {time_max_str}")
            
            events_result = service.events().list(
                calendarId=calendar_id,
                timeMin=time_min_str,
                timeMax=time_max_str,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            logger.info(f"Found {len(events)} events")
            
            return [
                {
                    'event_id': event.get('id'),
                    'summary': event.get('summary'),
                    'start': event.get('start', {}).get('dateTime') or event.get('start', {}).get('date'),
                    'end': event.get('end', {}).get('dateTime') or event.get('end', {}).get('date'),
                    'status': event.get('status'),
                    'is_all_day': 'date' in event.get('start', {}) and 'dateTime' not in event.get('start', {}),
                    'description': event.get('description', ''),
                    'location': event.get('location', ''),
                }
                for event in events
            ]
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error listing calendar events: {e}")
            raise
