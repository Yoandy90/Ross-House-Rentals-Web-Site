"""
Square Bookings API Service
Handles all interactions with Square for appointment scheduling
"""

from square.client import Square
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

# Square Configuration
SQUARE_ACCESS_TOKEN = os.getenv('SQUARE_ACCESS_TOKEN', 'EAAAlkF1SZROE9bL2ErXeYRNgNSGgQx1XYS_Ok-pcfh7R0k3KugqTS7xQdio9LKL')
SQUARE_LOCATION_ID = os.getenv('SQUARE_LOCATION_ID', 'L4S4JDVY33G2X')  # Ross Offices

# Default service variation (from existing booking)
DEFAULT_SERVICE_VARIATION_ID = os.getenv('SQUARE_SERVICE_VARIATION_ID', 'CAZMRECJYOQATTBNMKUPBOSO')
DEFAULT_TEAM_MEMBER_ID = os.getenv('SQUARE_TEAM_MEMBER_ID', 'yHXyKPyrzmKQTel6Tcbc')

class SquareService:
    def __init__(self):
        self.client = Square(token=SQUARE_ACCESS_TOKEN)
        self.location_id = SQUARE_LOCATION_ID
        self.service_variation_id = DEFAULT_SERVICE_VARIATION_ID
        self.team_member_id = DEFAULT_TEAM_MEMBER_ID
        self._services_cache = None
        self._services_cache_time = None
        self._bookings_cache = None
        self._bookings_cache_time = None
        self._customers_cache = {}  # Cache de clientes por ID
        self._customers_cache_time = None
    
    def get_services(self, force_refresh: bool = False) -> List[Dict]:
        """Get all appointment services from Square catalog with durations"""
        try:
            # Use cache if available and fresh (5 minutes)
            if not force_refresh and self._services_cache and self._services_cache_time:
                if (datetime.now() - self._services_cache_time).seconds < 300:
                    return self._services_cache
            
            services = []
            for item in self.client.catalog.list(types=['ITEM']):
                if item.item_data and item.item_data.product_type == 'APPOINTMENTS_SERVICE':
                    for var in item.item_data.variations or []:
                        vdata = var.item_variation_data
                        duration_ms = vdata.service_duration or 1800000  # Default 30 min
                        duration_min = duration_ms // 60000
                        
                        services.append({
                            'id': var.id,
                            'item_id': item.id,
                            'name': item.item_data.name,
                            'variation_name': vdata.name,
                            'duration_minutes': duration_min,
                            'version': var.version,  # Include version for create_booking
                            'full_name': f"{item.item_data.name} - {vdata.name}" if vdata.name != 'Normal' else item.item_data.name
                        })
            
            # Update cache
            self._services_cache = services
            self._services_cache_time = datetime.now()
            
            return services
        except Exception as e:
            print(f"Error getting services: {e}")
            return []
    
    def get_service_version(self, service_variation_id: str) -> Optional[int]:
        """Get version for a specific service variation (required by Square API)"""
        services = self.get_services()
        for svc in services:
            if svc['id'] == service_variation_id:
                return svc.get('version')
        return None
    
    def get_service_duration(self, service_variation_id: str) -> int:
        """Get duration in minutes for a specific service variation"""
        services = self.get_services()
        for svc in services:
            if svc['id'] == service_variation_id:
                return svc['duration_minutes']
        return 30  # Default
    
    def get_locations(self) -> List[Dict]:
        """Get all Square locations"""
        try:
            result = self.client.locations.list()
            locations = []
            for loc in result.locations or []:
                address_data = None
                if loc.address:
                    address_data = {
                        'line1': getattr(loc.address, 'address_line_1', None),
                        'city': getattr(loc.address, 'locality', None),
                        'state': getattr(loc.address, 'administrative_district_level_1', None),
                    }
                locations.append({
                    'id': loc.id,
                    'name': loc.name,
                    'timezone': loc.timezone,
                    'address': address_data
                })
            return locations
        except Exception as e:
            print(f"Error getting locations: {e}")
            return []
    
    def _get_customer_batch(self, customer_ids: List[str]) -> Dict[str, Dict]:
        """Get multiple customers in batch - uses cache with longer TTL"""
        result = {}
        ids_to_fetch = []
        
        # Check cache first - 1 hour cache for customers
        cache_valid = self._customers_cache_time and (datetime.now() - self._customers_cache_time).seconds < 3600
        
        for cid in customer_ids:
            if cache_valid and cid in self._customers_cache:
                result[cid] = self._customers_cache[cid]
            else:
                ids_to_fetch.append(cid)
        
        # Fetch missing customers - limit to 20 to avoid slow responses
        if ids_to_fetch:
            try:
                # Square doesn't have batch customer endpoint
                # Fetch only first 20 missing customers to keep response fast
                for cid in ids_to_fetch[:20]:
                    try:
                        customer_result = self.client.customers.get(customer_id=cid)
                        if customer_result.customer:
                            c = customer_result.customer
                            customer_data = {
                                'name': f"{c.given_name or ''} {c.family_name or ''}".strip() or 'Cliente',
                                'email': c.email_address,
                                'phone': c.phone_number
                            }
                            result[cid] = customer_data
                            self._customers_cache[cid] = customer_data
                    except:
                        result[cid] = {'name': 'Cliente', 'email': None, 'phone': None}
                        self._customers_cache[cid] = result[cid]
                
                # For remaining customers, just use placeholder
                for cid in ids_to_fetch[20:]:
                    if cid not in result:
                        result[cid] = {'name': 'Cliente', 'email': None, 'phone': None}
                
                self._customers_cache_time = datetime.now()
            except Exception as e:
                print(f"Error fetching customers batch: {e}")
        
        return result
    
    def list_bookings(
        self, 
        location_id: Optional[str] = None,
        start_at: Optional[datetime] = None,
        limit: int = 100,
        force_refresh: bool = False
    ) -> List[Dict]:
        """
        Get all bookings from Square with caching
        Returns formatted list of appointments
        """
        try:
            # Check cache first (valid for 15 minutes)
            cache_key = f"{location_id or self.location_id}_{limit}"
            if not force_refresh and self._bookings_cache and self._bookings_cache_time:
                cache_age = (datetime.now() - self._bookings_cache_time).seconds
                if cache_age < 900:  # 15 minutes cache
                    print(f"📦 Using cached bookings (age: {cache_age}s)")
                    return self._bookings_cache
            
            print("🔄 Fetching fresh bookings from Square...")
            loc_id = location_id or self.location_id
            raw_bookings = []
            customer_ids = set()
            
            # Build query parameters
            params = {
                'location_id': loc_id,
                'limit': limit
            }
            
            if start_at:
                params['start_at_min'] = start_at.isoformat()
            
            # Fetch all bookings first (fast)
            bookings_pager = self.client.bookings.list(**params)
            for booking in bookings_pager:
                raw_bookings.append(booking)
                if booking.customer_id:
                    customer_ids.add(booking.customer_id)
            
            print(f"📋 Found {len(raw_bookings)} bookings, {len(customer_ids)} unique customers")
            
            # Batch fetch customer info
            customers_data = self._get_customer_batch(list(customer_ids))
            
            # Process bookings with customer data
            from zoneinfo import ZoneInfo
            texas_tz = ZoneInfo('America/Chicago')
            
            bookings = []
            for booking in raw_bookings:
                # Get customer info from batch
                customer_info = customers_data.get(booking.customer_id, {}) if booking.customer_id else {}
                customer_name = customer_info.get('name', 'Cliente')
                customer_email = customer_info.get('email')
                customer_phone = customer_info.get('phone')
                
                # Parse start time
                date_str = None
                time_str = None
                scheduled_at_texas = booking.start_at
                
                if booking.start_at:
                    try:
                        start_dt = datetime.fromisoformat(booking.start_at.replace('Z', '+00:00'))
                        texas_time = start_dt.astimezone(texas_tz)
                        date_str = texas_time.strftime('%Y-%m-%d')
                        time_str = texas_time.strftime('%H:%M')
                        scheduled_at_texas = texas_time.strftime('%Y-%m-%dT%H:%M:%S%z')
                    except Exception as tz_err:
                        print(f"Timezone error: {tz_err}")
                
                # Get service info
                service_name = 'Cita'
                duration_minutes = 30
                if booking.appointment_segments:
                    seg = booking.appointment_segments[0]
                    duration_minutes = seg.duration_minutes or 30
                
                bookings.append({
                    'id': booking.id,
                    'square_id': booking.id,
                    'user_name': customer_name,
                    'user_email': customer_email,
                    'user_phone': customer_phone,
                    'customer_id': booking.customer_id,
                    'service_name': service_name,
                    'date': date_str,
                    'time': time_str,
                    'scheduled_at': scheduled_at_texas if booking.start_at else None,
                    'scheduled_at_utc': booking.start_at,  # Keep UTC for Square operations
                    'status': self._map_status(booking.status),
                    'square_status': booking.status,
                    'duration_minutes': duration_minutes,
                    'location_id': booking.location_id,
                    'source': 'square',
                    'created_at': booking.created_at,
                    'updated_at': booking.updated_at
                })
            
            # Save to cache
            self._bookings_cache = bookings
            self._bookings_cache_time = datetime.now()
            print(f"✅ Cached {len(bookings)} bookings")
            
            return bookings
        except Exception as e:
            print(f"Error listing bookings: {e}")
            # Return cache if available on error
            if self._bookings_cache:
                print("⚠️ Returning stale cache due to error")
                return self._bookings_cache
            return []
    
    def invalidate_cache(self):
        """Invalidate all caches - call after create/update/delete"""
        self._bookings_cache = None
        self._bookings_cache_time = None
        print("🔄 Cache invalidated")
    
    def _map_status(self, square_status: str) -> str:
        """Map Square status to our app status"""
        status_map = {
            'PENDING': 'scheduled',
            'ACCEPTED': 'confirmed',
            'CANCELLED_BY_CUSTOMER': 'cancelled',
            'CANCELLED_BY_SELLER': 'cancelled',
            'DECLINED': 'cancelled',
            'NO_SHOW': 'no_show'
        }
        return status_map.get(square_status, 'scheduled')
    
    def get_booking(self, booking_id: str) -> Optional[Dict]:
        """Get a single booking by ID"""
        try:
            result = self.client.bookings.get(booking_id=booking_id)
            
            if result.booking:
                booking = result.booking
                
                # Get customer info
                customer_name = 'Cliente'
                if booking.customer_id:
                    try:
                        customer_result = self.client.customers.get(
                            customer_id=booking.customer_id
                        )
                        if customer_result.customer:
                            c = customer_result.customer
                            customer_name = f"{c.given_name or ''} {c.family_name or ''}".strip()
                    except:
                        pass
                
                return {
                    'id': booking.id,
                    'user_name': customer_name,
                    'customer_id': booking.customer_id,
                    'scheduled_at': booking.start_at,
                    'status': self._map_status(booking.status),
                    'square_status': booking.status,
                    'location_id': booking.location_id,
                    'source': 'square'
                }
            return None
        except Exception as e:
            print(f"Error getting booking: {e}")
            return None
    
    def search_availability(
        self,
        date: str,  # YYYY-MM-DD format
        service_variation_id: Optional[str] = None,
        team_member_id: Optional[str] = None,
        location_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Search for available time slots on a specific date
        """
        try:
            loc_id = location_id or self.location_id
            svc_id = service_variation_id or self.service_variation_id
            
            # Build start and end times for the day (Texas time = CST/CDT)
            start_at = f"{date}T08:00:00-06:00"
            end_at = f"{date}T20:00:00-06:00"
            
            # Build segment filter
            segment_filter = {
                'service_variation_id': svc_id
            }
            
            if team_member_id:
                segment_filter['team_member_id_filter'] = {
                    'any': [team_member_id]
                }
            
            result = self.client.bookings.search_availability(
                query={
                    'filter': {
                        'location_id': loc_id,
                        'start_at_range': {
                            'start_at': start_at,
                            'end_at': end_at
                        },
                        'segment_filters': [segment_filter]
                    }
                }
            )
            
            availabilities = []
            if result.availabilities:
                import pytz
                texas_tz = pytz.timezone('America/Chicago')
                for slot in result.availabilities:
                    start_dt = datetime.fromisoformat(slot.start_at.replace('Z', '+00:00'))
                    # Convert UTC to Central Time for display
                    start_ct = start_dt.astimezone(texas_tz)
                    availabilities.append({
                        'start_at': slot.start_at,
                        'time': start_ct.strftime('%H:%M'),
                        'location_id': slot.location_id,
                        'appointment_segments': [
                            {
                                'service_variation_id': seg.service_variation_id,
                                'team_member_id': seg.team_member_id,
                                'duration_minutes': seg.duration_minutes
                            }
                            for seg in (slot.appointment_segments or [])
                        ]
                    })
            
            return availabilities
        except Exception as e:
            print(f"Error searching availability: {e}")
            return []
    
    def create_booking(
        self,
        start_at: str,  # ISO format datetime
        customer_id: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None,
        service_variation_id: Optional[str] = None,
        team_member_id: Optional[str] = None,
        location_id: Optional[str] = None,
        duration_minutes: Optional[int] = None,
        note: Optional[str] = None
    ) -> Dict:
        """
        Create a new booking in Square
        """
        try:
            loc_id = location_id or self.location_id
            svc_id = service_variation_id or self.service_variation_id
            tm_id = team_member_id or self.team_member_id
            
            # Get duration and version from service if not specified
            if duration_minutes is None:
                duration_minutes = self.get_service_duration(svc_id)
            
            # Get service variation version (required by Square API)
            svc_version = self.get_service_version(svc_id)
            
            # Create or find customer if needed
            cust_id = customer_id
            if not cust_id and (customer_name or customer_email or customer_phone):
                cust_id = self._create_or_find_customer(
                    name=customer_name,
                    email=customer_email,
                    phone=customer_phone
                )
            
            # Build booking request with service_variation_version
            appointment_segment = {
                'service_variation_id': svc_id,
                'team_member_id': tm_id,
                'duration_minutes': duration_minutes
            }
            
            # Add version if available (required by Square API)
            if svc_version:
                appointment_segment['service_variation_version'] = svc_version
            
            booking_data = {
                'location_id': loc_id,
                'start_at': start_at,
                'appointment_segments': [appointment_segment]
            }
            
            if cust_id:
                booking_data['customer_id'] = cust_id
            
            if note:
                booking_data['customer_note'] = note
            
            result = self.client.bookings.create(booking=booking_data)
            
            if result.booking:
                return {
                    'success': True,
                    'booking': {
                        'id': result.booking.id,
                        'start_at': result.booking.start_at,
                        'status': result.booking.status,
                        'customer_id': result.booking.customer_id
                    }
                }
            else:
                errors = result.errors if hasattr(result, 'errors') else []
                return {
                    'success': False,
                    'error': str(errors)
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_or_find_customer(
        self,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None
    ) -> Optional[str]:
        """Create or find a customer in Square"""
        try:
            # First try to find by email or phone
            if email:
                search_result = self.client.customers.search(
                    query={
                        'filter': {
                            'email_address': {
                                'exact': email
                            }
                        }
                    }
                )
                if search_result.customers and len(search_result.customers) > 0:
                    return search_result.customers[0].id
            
            # Create new customer
            customer_data = {}
            
            if name:
                parts = name.split(' ', 1)
                customer_data['given_name'] = parts[0]
                if len(parts) > 1:
                    customer_data['family_name'] = parts[1]
            
            if email:
                customer_data['email_address'] = email
            
            if phone:
                customer_data['phone_number'] = phone
            
            if customer_data:
                result = self.client.customers.create(**customer_data)
                if result.customer:
                    return result.customer.id
            
            return None
        except Exception as e:
            print(f"Error creating/finding customer: {e}")
            return None
    
    def cancel_booking(self, booking_id: str, reason: Optional[str] = None) -> Dict:
        """Cancel a booking"""
        try:
            # First get the booking to get version
            booking_result = self.client.bookings.get(booking_id=booking_id)
            if not booking_result.booking:
                return {'success': False, 'error': 'Booking not found'}
            
            version = booking_result.booking.version
            
            result = self.client.bookings.cancel(
                booking_id=booking_id,
                booking_version=version
            )
            
            if result.booking:
                return {
                    'success': True,
                    'booking': {
                        'id': result.booking.id,
                        'status': result.booking.status
                    }
                }
            else:
                return {
                    'success': False,
                    'error': str(result.errors) if hasattr(result, 'errors') else 'Unknown error'
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_booking(
        self,
        booking_id: str,
        start_at: Optional[str] = None,
        status: Optional[str] = None
    ) -> Dict:
        """Update/reschedule a booking"""
        try:
            # First get the booking to get version
            booking_result = self.client.bookings.get(booking_id=booking_id)
            if not booking_result.booking:
                return {'success': False, 'error': 'Booking not found'}
            
            current_booking = booking_result.booking
            
            # Build update data
            booking_data = {}
            
            if start_at:
                booking_data['start_at'] = start_at
                # Keep the same appointment segments
                if current_booking.appointment_segments:
                    booking_data['appointment_segments'] = [
                        {
                            'service_variation_id': seg.service_variation_id,
                            'team_member_id': seg.team_member_id,
                            'duration_minutes': seg.duration_minutes
                        }
                        for seg in current_booking.appointment_segments
                    ]
            
            result = self.client.bookings.update(
                booking_id=booking_id,
                booking=booking_data
            )
            
            if result.booking:
                return {
                    'success': True,
                    'booking': {
                        'id': result.booking.id,
                        'start_at': result.booking.start_at,
                        'status': result.booking.status
                    }
                }
            else:
                return {
                    'success': False,
                    'error': str(result.errors) if hasattr(result, 'errors') else 'Unknown error'
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# Create singleton instance
square_service = SquareService()


# Test function
if __name__ == '__main__':
    print("Testing Square Service...")
    
    # Test list bookings
    print("\n=== Bookings ===")
    bookings = square_service.list_bookings(limit=5)
    for b in bookings:
        print(f"  {b['scheduled_at']}: {b['user_name']} ({b['status']})")
    
    # Test availability
    print("\n=== Availability for tomorrow ===")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    slots = square_service.search_availability(date=tomorrow)
    for slot in slots[:5]:
        print(f"  {slot['time']}")
