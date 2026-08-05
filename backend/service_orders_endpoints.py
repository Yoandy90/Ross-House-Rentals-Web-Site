"""
Service Orders Endpoints
========================
Manages service orders with USPS tracking, notifications, and shipping management.
Links client services (ITIN, passport, immigration, etc.) with USPS shipments.

Features:
- Create service orders for clients
- Assign tracking numbers (manual or from label generation)
- Poll USPS tracking API for status updates
- Send notifications (push, email, SMS) on status changes
- Support return labels (e.g., passports returned to Ross Tax office)
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
from bson import ObjectId
import logging
import base64

logger = logging.getLogger(__name__)
router = APIRouter()

# Will be set by server.py
db = None
usps_service_instance = None
usps_labels_service_instance = None
notification_service_instance = None

def set_db(database):
    global db
    db = database

def set_usps_service(service):
    global usps_service_instance
    usps_service_instance = service

def set_usps_labels_service(service):
    global usps_labels_service_instance
    usps_labels_service_instance = service

def set_notification_service(service):
    global notification_service_instance
    notification_service_instance = service

# ═══════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════

class AddressInfo(BaseModel):
    name: Optional[str] = ""
    street: str = ""
    apt: Optional[str] = ""
    city: str = ""
    state: str = ""
    zip: str = ""

class CreateServiceOrder(BaseModel):
    client_id: str
    client_name: str
    client_email: Optional[str] = ""
    client_phone: Optional[str] = ""
    service_name: str
    service_category: str = "other"  # taxes, immigration, passport, itin, legal, other
    price: float = 0
    requires_shipping: bool = True
    requires_return_label: bool = False
    shipping_option: str = "regular"  # regular, priority, express
    shipping_cost: float = 0
    to_address: Optional[AddressInfo] = None
    from_address: Optional[AddressInfo] = None
    return_address: Optional[AddressInfo] = None
    notes: Optional[str] = ""
    tracking_number: Optional[str] = ""

class AssignTrackingRequest(BaseModel):
    tracking_number: str
    tracking_type: str = "outbound"  # outbound or return

class UpdateOrderRequest(BaseModel):
    status: Optional[str] = None
    tracking_number: Optional[str] = None
    return_tracking_number: Optional[str] = None
    shipping_option: Optional[str] = None
    shipping_cost: Optional[float] = None
    notes: Optional[str] = None
    to_address: Optional[Dict] = None
    from_address: Optional[Dict] = None

# ═══════════════════════════════════════════════════════════════
# ROSS TAX DEFAULT ADDRESSES
# ═══════════════════════════════════════════════════════════════

ROSS_TAX_ADDRESS = {
    "name": "Ross Tax Preparation",
    "street": "305 Bruce Ave",
    "city": "Dumas",
    "state": "TX",
    "zip": "79029"
}

SHIPPING_OPTIONS = {
    "regular": {"label": "USPS Ground Advantage", "label_es": "USPS Regular (Gratis)", "mail_class": "USPS_GROUND_ADVANTAGE", "free": True},
    "priority": {"label": "Priority Mail", "label_es": "Priority Mail", "mail_class": "PRIORITY_MAIL", "free": False},
    "express": {"label": "Priority Mail Express", "label_es": "Priority Mail Express", "mail_class": "PRIORITY_MAIL_EXPRESS", "free": False},
    "first_class": {"label": "First Class Mail", "label_es": "First Class Mail", "mail_class": "FIRST_CLASS_MAIL", "free": True},
}

# ═══════════════════════════════════════════════════════════════
# CREATE SERVICE ORDER
# ═══════════════════════════════════════════════════════════════

@router.post('/service-orders')
async def create_service_order(order: CreateServiceOrder):
    """Create a new service order with optional shipping tracking."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        # Build the order document
        order_doc = {
            "client_id": order.client_id,
            "client_name": order.client_name,
            "client_email": order.client_email or "",
            "client_phone": order.client_phone or "",
            "service_name": order.service_name,
            "service_category": order.service_category,
            "price": order.price,
            "status": "pending",  # pending, processing, shipped, in_transit, delivered, completed

            # Shipping config
            "requires_shipping": order.requires_shipping,
            "requires_return_label": order.requires_return_label,
            "shipping_option": order.shipping_option,
            "shipping_cost": order.shipping_cost,

            # Outbound tracking
            "tracking_number": order.tracking_number or "",
            "tracking_status": "",
            "tracking_history": [],

            # Return tracking (for passport-type services)
            "return_tracking_number": "",
            "return_tracking_status": "",
            "return_tracking_history": [],

            # Addresses
            "from_address": order.from_address.dict() if order.from_address else ROSS_TAX_ADDRESS.copy(),
            "to_address": order.to_address.dict() if order.to_address else {},
            "return_address": order.return_address.dict() if order.return_address else ROSS_TAX_ADDRESS.copy(),

            # Notifications log
            "notifications_sent": [],
            "notes": order.notes or "",

            # Timestamps
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "shipped_at": None,
            "delivered_at": None,
        }

        # If tracking number provided, set status to shipped
        if order.tracking_number:
            order_doc["status"] = "shipped"
            order_doc["shipped_at"] = datetime.now(timezone.utc)

        result = await db.service_orders.insert_one(order_doc)
        order_id = str(result.inserted_id)

        logger.info(f"📦 Service order created: {order_id} — {order.service_name} for {order.client_name}")

        return {
            "success": True,
            "order_id": order_id,
            "message": f"Orden de servicio creada: {order.service_name}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating service order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# LIST SERVICE ORDERS (Admin)
# ═══════════════════════════════════════════════════════════════

@router.get('/service-orders')
async def list_service_orders(
    status: Optional[str] = None,
    category: Optional[str] = None,
    client_id: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List all service orders (admin). Supports filtering by status and category."""
    try:
        if db is None:
            return {"orders": [], "total": 0}

        query = {}
        if status:
            query["status"] = status
        if category:
            query["service_category"] = category
        if client_id:
            query["client_id"] = client_id

        total = await db.service_orders.count_documents(query)
        cursor = db.service_orders.find(query).sort("created_at", -1).skip(skip).limit(limit)

        orders = []
        async for o in cursor:
            o["_id"] = str(o["_id"])
            orders.append(o)

        return {"orders": orders, "total": total}
    except Exception as e:
        logger.error(f"❌ Error listing service orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# CLIENT'S SERVICE ORDERS
# ═══════════════════════════════════════════════════════════════

@router.get('/service-orders/my-orders')
async def get_my_service_orders(request: Request):
    """Get service orders for the authenticated client."""
    try:
        if db is None:
            return {"orders": [], "total": 0}

        # Get user from auth header
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
        
        if not token:
            return {"orders": [], "total": 0}

        # Find user session
        session = await db.sessions.find_one({"token": token})
        if not session:
            return {"orders": [], "total": 0}

        user_id = str(session.get("user_id", ""))
        if not user_id:
            return {"orders": [], "total": 0}

        # Find orders for this client
        query = {"client_id": user_id}
        total = await db.service_orders.count_documents(query)
        cursor = db.service_orders.find(query).sort("created_at", -1).limit(50)

        orders = []
        async for o in cursor:
            o["_id"] = str(o["_id"])
            # Also add as shipment-compatible format for the mobile app
            if o.get("tracking_number"):
                o["has_tracking"] = True
            orders.append(o)

        return {"orders": orders, "total": total}
    except Exception as e:
        logger.error(f"❌ Error getting client orders: {e}")
        return {"orders": [], "total": 0}


# ═══════════════════════════════════════════════════════════════
# STATS (Must come before {order_id} route)
# ═══════════════════════════════════════════════════════════════

@router.get('/service-orders/stats')
async def get_service_orders_stats():
    """Get service orders statistics."""
    try:
        if db is None:
            return {"total": 0, "pending": 0, "shipped": 0, "delivered": 0}

        total = await db.service_orders.count_documents({})
        pending = await db.service_orders.count_documents({"status": "pending"})
        processing = await db.service_orders.count_documents({"status": "processing"})
        shipped = await db.service_orders.count_documents({"status": {"$in": ["shipped", "in_transit"]}})
        delivered = await db.service_orders.count_documents({"status": "delivered"})
        completed = await db.service_orders.count_documents({"status": "completed"})

        return {
            "total": total,
            "pending": pending,
            "processing": processing,
            "shipped": shipped,
            "delivered": delivered,
            "completed": completed,
        }
    except Exception as e:
        logger.error(f"❌ Error getting stats: {e}")
        return {"total": 0, "pending": 0, "shipped": 0, "delivered": 0}


# ═══════════════════════════════════════════════════════════════
# SHIPPING OPTIONS (Must come before {order_id} route)
# ═══════════════════════════════════════════════════════════════

@router.get('/service-orders/shipping-options')
async def get_shipping_options():
    """Get available shipping options with pricing info."""
    return {
        "options": SHIPPING_OPTIONS,
        "ross_tax_address": ROSS_TAX_ADDRESS,
    }


# ═══════════════════════════════════════════════════════════════
# GET SINGLE ORDER
# ═══════════════════════════════════════════════════════════════

@router.get('/service-orders/{order_id}')
async def get_service_order(order_id: str):
    """Get a specific service order by ID."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        order = await db.service_orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        order["_id"] = str(order["_id"])
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting service order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# UPDATE SERVICE ORDER
# ═══════════════════════════════════════════════════════════════

@router.put('/service-orders/{order_id}')
async def update_service_order(order_id: str, update: UpdateOrderRequest):
    """Update a service order."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        update_doc = {"updated_at": datetime.now(timezone.utc)}
        
        if update.status is not None:
            update_doc["status"] = update.status
            if update.status == "shipped":
                update_doc["shipped_at"] = datetime.now(timezone.utc)
            elif update.status == "delivered":
                update_doc["delivered_at"] = datetime.now(timezone.utc)
        
        if update.tracking_number is not None:
            update_doc["tracking_number"] = update.tracking_number
        if update.return_tracking_number is not None:
            update_doc["return_tracking_number"] = update.return_tracking_number
        if update.shipping_option is not None:
            update_doc["shipping_option"] = update.shipping_option
        if update.shipping_cost is not None:
            update_doc["shipping_cost"] = update.shipping_cost
        if update.notes is not None:
            update_doc["notes"] = update.notes
        if update.to_address is not None:
            update_doc["to_address"] = update.to_address
        if update.from_address is not None:
            update_doc["from_address"] = update.from_address

        await db.service_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_doc}
        )

        logger.info(f"📝 Service order updated: {order_id}")
        return {"success": True, "message": "Orden actualizada"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating service order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# ASSIGN TRACKING NUMBER
# ═══════════════════════════════════════════════════════════════

@router.post('/service-orders/{order_id}/assign-tracking')
async def assign_tracking(order_id: str, req: AssignTrackingRequest):
    """Assign a USPS tracking number to a service order and optionally poll initial status."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        order = await db.service_orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        update_doc = {"updated_at": datetime.now(timezone.utc)}

        if req.tracking_type == "outbound":
            update_doc["tracking_number"] = req.tracking_number
            update_doc["status"] = "shipped"
            update_doc["shipped_at"] = datetime.now(timezone.utc)
        else:
            update_doc["return_tracking_number"] = req.tracking_number

        # Try to get initial tracking info from USPS
        initial_status = ""
        if usps_service_instance:
            try:
                tracking_result = await usps_service_instance.track_package(req.tracking_number)
                if tracking_result.get("success"):
                    initial_status = tracking_result.get("status", "")
                    events = tracking_result.get("events", [])
                    
                    history_field = "tracking_history" if req.tracking_type == "outbound" else "return_tracking_history"
                    status_field = "tracking_status" if req.tracking_type == "outbound" else "return_tracking_status"
                    
                    update_doc[status_field] = initial_status
                    update_doc[history_field] = [
                        {
                            "date": evt.get("date", ""),
                            "time": evt.get("time", ""),
                            "status": evt.get("description", ""),
                            "location": f"{evt.get('city', '')}, {evt.get('state', '')}".strip(", "),
                            "description": evt.get("description", ""),
                            "polled_at": datetime.now(timezone.utc).isoformat(),
                        }
                        for evt in events
                    ]
                    
                    # Check if already delivered
                    if "delivered" in initial_status.lower():
                        update_doc["status"] = "delivered"
                        update_doc["delivered_at"] = datetime.now(timezone.utc)
            except Exception as e:
                logger.warning(f"⚠️ Could not get initial tracking info: {e}")

        await db.service_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_doc}
        )

        logger.info(f"📦 Tracking assigned to order {order_id}: {req.tracking_number} ({req.tracking_type})")

        return {
            "success": True,
            "tracking_number": req.tracking_number,
            "initial_status": initial_status,
            "message": f"Número de rastreo asignado: {req.tracking_number}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error assigning tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# POLL & UPDATE TRACKING STATUS
# ═══════════════════════════════════════════════════════════════

@router.post('/service-orders/{order_id}/update-tracking')
async def update_tracking_status(order_id: str):
    """Poll USPS tracking API and update the order's tracking status."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")
        if usps_service_instance is None:
            raise HTTPException(status_code=503, detail="USPS service not available")

        order = await db.service_orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        results = {}

        # Poll outbound tracking
        tracking_number = order.get("tracking_number", "")
        if tracking_number:
            result = await _poll_and_update_tracking(order_id, tracking_number, "outbound", order)
            results["outbound"] = result

        # Poll return tracking
        return_tracking = order.get("return_tracking_number", "")
        if return_tracking:
            result = await _poll_and_update_tracking(order_id, return_tracking, "return", order)
            results["return"] = result

        return {"success": True, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _poll_and_update_tracking(order_id: str, tracking_number: str, tracking_type: str, order: dict):
    """Internal helper to poll USPS and update tracking fields."""
    try:
        result = await usps_service_instance.track_package(tracking_number)
        
        if not result.get("success"):
            return {"status": "error", "error": result.get("error", "Tracking failed")}

        new_status = result.get("status", "")
        old_status = order.get(f"{'tracking' if tracking_type == 'outbound' else 'return_tracking'}_status", "")
        
        # Build events list
        events = [
            {
                "date": evt.get("date", ""),
                "time": evt.get("time", ""),
                "status": evt.get("description", ""),
                "location": f"{evt.get('city', '')}, {evt.get('state', '')}".strip(", "),
                "description": evt.get("description", ""),
                "polled_at": datetime.now(timezone.utc).isoformat(),
            }
            for evt in result.get("events", [])
        ]

        # Update fields based on tracking type
        update_doc = {"updated_at": datetime.now(timezone.utc)}
        if tracking_type == "outbound":
            update_doc["tracking_status"] = new_status
            update_doc["tracking_history"] = events
        else:
            update_doc["return_tracking_status"] = new_status
            update_doc["return_tracking_history"] = events

        # Check for delivery
        if "delivered" in new_status.lower() and order.get("status") != "delivered":
            update_doc["status"] = "delivered"
            update_doc["delivered_at"] = datetime.now(timezone.utc)

        await db.service_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_doc}
        )

        # Send notification if status changed
        status_changed = new_status != old_status and new_status
        if status_changed:
            await _send_tracking_notification(order, tracking_number, new_status, tracking_type)

        return {
            "status": new_status,
            "events_count": len(events),
            "status_changed": status_changed,
            "estimated_delivery": result.get("estimatedDelivery", ""),
        }
    except Exception as e:
        logger.error(f"❌ Tracking poll error for {tracking_number}: {e}")
        return {"status": "error", "error": str(e)}


async def _send_tracking_notification(order: dict, tracking_number: str, new_status: str, tracking_type: str):
    """Send notification to client about tracking status change."""
    try:
        client_name = order.get("client_name", "Cliente")
        service_name = order.get("service_name", "Servicio")
        direction = "envío" if tracking_type == "outbound" else "retorno"
        
        # Build message
        status_map = {
            "Accepted": f"📦 Tu {service_name} ha sido aceptado por USPS",
            "In Transit": f"🚚 Tu {service_name} está en tránsito",
            "Out for Delivery": f"📬 Tu {service_name} está en camino de entrega",
            "Delivered": f"✅ Tu {service_name} ha sido entregado",
        }
        
        message = status_map.get(new_status, f"📦 Actualización de {direction}: {new_status}")
        message_full = f"{message}\n🔢 Tracking: {tracking_number}"

        # Log the notification (including full message)
        notification_log = {
            "type": "tracking_update",
            "date": datetime.now(timezone.utc).isoformat(),
            "status": new_status,
            "tracking_type": tracking_type,
            "message": message_full,
        }

        order_id = str(order.get("_id", ""))
        if order_id and db is not None:
            await db.service_orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$push": {"notifications_sent": notification_log}}
            )

        # Send push notification if available
        client_id = order.get("client_id", "")
        if client_id and db is not None:
            try:
                # Create in-app notification
                await db.notifications.insert_one({
                    "user_id": client_id,
                    "title": f"📦 {service_name}",
                    "message": message,
                    "type": "shipping_update",
                    "read": False,
                    "data": {
                        "order_id": order_id,
                        "tracking_number": tracking_number,
                        "status": new_status,
                    },
                    "created_at": datetime.now(timezone.utc),
                })
                logger.info(f"📱 Notification sent to {client_name}: {message}")
            except Exception as ne:
                logger.warning(f"⚠️ Could not send notification: {ne}")

    except Exception as e:
        logger.warning(f"⚠️ Notification error: {e}")


# ═══════════════════════════════════════════════════════════════
# POLL ALL ACTIVE TRACKING (Cron/Admin action)
# ═══════════════════════════════════════════════════════════════

@router.post('/service-orders/poll-all-tracking')
async def poll_all_active_tracking():
    """Poll USPS tracking for all active (non-delivered) service orders."""
    try:
        if db is None:
            return {"success": False, "message": "Database not available"}
        if usps_service_instance is None:
            return {"success": False, "message": "USPS service not available"}

        # Find all orders with tracking that aren't delivered/completed
        query = {
            "status": {"$nin": ["delivered", "completed"]},
            "$or": [
                {"tracking_number": {"$ne": "", "$exists": True}},
                {"return_tracking_number": {"$ne": "", "$exists": True}},
            ]
        }

        cursor = db.service_orders.find(query)
        updated_count = 0
        errors = 0

        async for order in cursor:
            order_id = str(order["_id"])
            try:
                tracking = order.get("tracking_number", "")
                if tracking:
                    result = await _poll_and_update_tracking(order_id, tracking, "outbound", order)
                    if result.get("status") != "error":
                        updated_count += 1
                    else:
                        errors += 1

                return_tracking = order.get("return_tracking_number", "")
                if return_tracking:
                    await _poll_and_update_tracking(order_id, return_tracking, "return", order)
            except Exception as e:
                logger.error(f"Error polling order {order_id}: {e}")
                errors += 1

        logger.info(f"📦 Tracking poll complete: {updated_count} updated, {errors} errors")
        return {
            "success": True,
            "updated": updated_count,
            "errors": errors,
            "message": f"Actualizado: {updated_count} órdenes"
        }
    except Exception as e:
        logger.error(f"❌ Error polling all tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# CREATE LABEL FOR SERVICE ORDER (Auto-assign tracking)
# ═══════════════════════════════════════════════════════════════

class CreateLabelForOrderRequest(BaseModel):
    label_type: str = "outbound"  # outbound or return
    mail_class: str = "USPS_GROUND_ADVANTAGE"  # USPS_GROUND_ADVANTAGE, PRIORITY_MAIL, PRIORITY_MAIL_EXPRESS, FIRST_CLASS_MAIL
    weight_oz: float = 4  # weight in ounces
    image_type: str = "PDF"

@router.post('/service-orders/{order_id}/create-label')
async def create_label_for_order(order_id: str, req: CreateLabelForOrderRequest):
    """
    Create a USPS shipping label for a service order.
    Automatically assigns the tracking number to the order.
    
    For 'outbound': Creates label from Ross Tax → Destination
    For 'return': Creates label from Destination → Ross Tax (client's name, Ross Tax address)
    """
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")
        if usps_labels_service_instance is None:
            raise HTTPException(status_code=503, detail="USPS Labels service not available. Labels API may not be activated yet.")

        order = await db.service_orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        from_addr = order.get("from_address", {})
        to_addr = order.get("to_address", {})
        return_addr = order.get("return_address", ROSS_TAX_ADDRESS)

        # Build USPS API-compatible addresses
        if req.label_type == "outbound":
            # Ross Tax → Destination
            usps_from = {
                "firstName": from_addr.get("name", "Ross Tax Preparation"),
                "lastName": "",
                "firm": "Ross Tax Preparation",
                "streetAddress": from_addr.get("street", "305 Bruce Ave"),
                "city": from_addr.get("city", "Dumas"),
                "state": from_addr.get("state", "TX"),
                "ZIPCode": from_addr.get("zip", "79029"),
            }
            usps_to = {
                "firstName": to_addr.get("name", ""),
                "lastName": "",
                "firm": to_addr.get("name", ""),
                "streetAddress": to_addr.get("street", ""),
                "city": to_addr.get("city", ""),
                "state": to_addr.get("state", ""),
                "ZIPCode": to_addr.get("zip", ""),
            }
        else:
            # Return label: Destination → Ross Tax (but with client's name)
            client_name = order.get("client_name", "")
            usps_from = {
                "firstName": to_addr.get("name", ""),
                "lastName": "",
                "firm": to_addr.get("name", ""),
                "streetAddress": to_addr.get("street", ""),
                "city": to_addr.get("city", ""),
                "state": to_addr.get("state", ""),
                "ZIPCode": to_addr.get("zip", ""),
            }
            usps_to = {
                "firstName": client_name,
                "lastName": "",
                "firm": "c/o Ross Tax Preparation",
                "streetAddress": return_addr.get("street", "305 Bruce Ave"),
                "city": return_addr.get("city", "Dumas"),
                "state": return_addr.get("state", "TX"),
                "ZIPCode": return_addr.get("zip", "79029"),
            }

        # Create the label via USPS API
        logger.info(f"📮 Creating {req.label_type} label for order {order_id} — {order.get('service_name')}")
        
        result = await usps_labels_service_instance.create_domestic_label(
            mail_class=req.mail_class,
            from_address=usps_from,
            to_address=usps_to,
            weight=req.weight_oz,
            image_type=req.image_type,
        )

        tracking_number = result.get("trackingNumber", "")
        label_image = result.get("labelImage")

        if not tracking_number:
            raise HTTPException(status_code=500, detail="USPS did not return a tracking number")

        # Convert label image to base64 for storage/display
        label_b64 = ""
        if label_image:
            label_b64 = base64.b64encode(label_image).decode("utf-8")

        # Auto-assign tracking to the order
        update_doc = {"updated_at": datetime.now(timezone.utc)}
        
        if req.label_type == "outbound":
            update_doc["tracking_number"] = tracking_number
            update_doc["status"] = "shipped"
            update_doc["shipped_at"] = datetime.now(timezone.utc)
            update_doc["outbound_label_b64"] = label_b64
        else:
            update_doc["return_tracking_number"] = tracking_number
            update_doc["return_label_b64"] = label_b64

        await db.service_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_doc}
        )

        # Save label record
        label_record = {
            "order_id": order_id,
            "label_type": req.label_type,
            "tracking_number": tracking_number,
            "mail_class": req.mail_class,
            "from_address": usps_from,
            "to_address": usps_to,
            "weight_oz": req.weight_oz,
            "image_type": req.image_type,
            "label_b64": label_b64,
            "service_name": order.get("service_name", ""),
            "client_name": order.get("client_name", ""),
            "created_at": datetime.now(timezone.utc),
        }
        await db.usps_labels.insert_one(label_record)

        logger.info(f"✅ Label created for order {order_id}: {tracking_number} ({req.label_type})")

        return {
            "success": True,
            "tracking_number": tracking_number,
            "label_type": req.label_type,
            "label_b64": label_b64,
            "mail_class": req.mail_class,
            "message": f"Label creado — Tracking: {tracking_number}",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating label for order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# DOWNLOAD LABEL PDF
# ═══════════════════════════════════════════════════════════════

@router.get('/service-orders/{order_id}/label/{label_type}')
async def get_order_label(order_id: str, label_type: str = "outbound"):
    """Get the label image (base64) for a service order."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        order = await db.service_orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        field = "outbound_label_b64" if label_type == "outbound" else "return_label_b64"
        label_b64 = order.get(field, "")
        
        if not label_b64:
            raise HTTPException(status_code=404, detail="No hay label disponible para esta orden")

        tracking_field = "tracking_number" if label_type == "outbound" else "return_tracking_number"
        
        return {
            "success": True,
            "label_b64": label_b64,
            "tracking_number": order.get(tracking_field, ""),
            "label_type": label_type,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting label: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# DELETE SERVICE ORDER
# ═══════════════════════════════════════════════════════════════

@router.delete('/service-orders/{order_id}')
async def delete_service_order(order_id: str):
    """Delete a service order."""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        result = await db.service_orders.delete_one({"_id": ObjectId(order_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Orden no encontrada")

        return {"success": True, "message": "Orden eliminada"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting service order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


print("📦 Service Orders endpoints loaded")
