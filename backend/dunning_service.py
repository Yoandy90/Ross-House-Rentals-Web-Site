"""
Dunning Service - Automated Failed Payment Detection & Notifications
Ross Tax Preparation LLC - Mi Reembolso Platform
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from bson import ObjectId

logger = logging.getLogger('dunning_service')


class DunningService:
    """
    Automated dunning system that:
    1. Detects subscription status changes (active -> failed/paused/cancelled)
    2. Records dunning events in MongoDB
    3. Sends notifications to admin via email
    4. Tracks resolution status
    """

    def __init__(self, db, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        self.collection = db.dunning_events if db is not None else None

    async def ensure_indexes(self):
        """Create MongoDB indexes for dunning_events collection."""
        if self.collection is not None:
            await self.collection.create_index('customerId')
            await self.collection.create_index('status')
            await self.collection.create_index('createdAt')
            await self.collection.create_index([('status', 1), ('severity', -1)])
            logger.info("✅ Dunning indexes created")

    async def detect_payment_issues(self, merchant_service) -> Dict:
        """
        Main dunning detection routine.
        Compares current NMI subscription statuses with our local records
        to detect failed, paused, or cancelled subscriptions.
        """
        if not self.db:
            return {'error': 'Database not available'}

        logger.info("🔍 Running dunning detection scan...")

        # Get current subscription data from NMI
        subs_by_vault, subs_by_name = await merchant_service.query_merchant_one_subscriptions()

        # Get all local customers that had active/pending subscriptions
        local_cursor = self.db.vault_customers.find(
            {'subscriptionStatus': {'$in': ['active', 'pending', 'unknown']}},
            {
                'customerVaultId': 1, 'subscriptionStatus': 1, 'subscriptionId': 1,
                'firstName': 1, 'lastName': 1, 'email': 1, 'phone': 1,
                'planName': 1, 'planAmount': 1, 'nextChargeDate': 1,
            }
        )
        local_records = await local_cursor.to_list(length=10000)

        new_events = 0
        resolved = 0
        issues_found = []

        for local in local_records:
            vault_id = local.get('customerVaultId', '')
            old_status = local.get('subscriptionStatus', 'unknown')

            # Find matching NMI subscription
            sub_info = subs_by_vault.get(vault_id) if vault_id else None
            if not sub_info:
                fname = (local.get('firstName') or '').strip().upper()
                lname = (local.get('lastName') or '').strip().upper()
                name_key = f"{fname}|{lname}"
                sub_info = subs_by_name.get(name_key)

            if sub_info:
                new_status = sub_info.get('status', 'unknown')

                # Detect problematic status changes
                if old_status == 'active' and new_status in ('paused', 'cancelled', 'failed'):
                    event = await self._create_dunning_event(local, old_status, new_status, sub_info)
                    if event:
                        new_events += 1
                        issues_found.append(event)
            else:
                # Subscription disappeared from NMI - possible cancellation
                if old_status == 'active':
                    event = await self._create_dunning_event(
                        local, old_status, 'missing',
                        {'subscription_id': local.get('subscriptionId', ''), 'status': 'missing'}
                    )
                    if event:
                        new_events += 1
                        issues_found.append(event)

        # Check for resolved events (status back to active)
        resolved = await self._check_resolved_events(subs_by_vault, subs_by_name)

        # Send admin notification if there are new issues
        if new_events > 0:
            await self._notify_admin(issues_found)

        result = {
            'scanned': len(local_records),
            'new_issues': new_events,
            'resolved': resolved,
            'total_active_events': await self._count_active_events(),
        }

        logger.info(f"✅ Dunning scan complete: {new_events} new issues, {resolved} resolved")
        return result

    async def _create_dunning_event(self, customer: dict, old_status: str, new_status: str, sub_info: dict) -> Optional[dict]:
        """Create a dunning event record."""
        customer_id = str(customer.get('_id', ''))

        # Check if we already have an active event for this customer
        existing = await self.collection.find_one({
            'customerId': customer_id,
            'status': {'$in': ['new', 'notified', 'retry_pending']},
        })
        if existing:
            # Update existing event
            await self.collection.update_one(
                {'_id': existing['_id']},
                {'$set': {
                    'lastChecked': datetime.utcnow(),
                    'currentStatus': new_status,
                    'checkCount': existing.get('checkCount', 0) + 1,
                }}
            )
            return None

        # Determine severity
        severity_map = {
            'failed': 'critical',
            'cancelled': 'high',
            'paused': 'medium',
            'missing': 'high',
        }
        severity = severity_map.get(new_status, 'medium')

        event = {
            'customerId': customer_id,
            'customerVaultId': customer.get('customerVaultId', ''),
            'subscriptionId': sub_info.get('subscription_id', '') or customer.get('subscriptionId', ''),
            'customerName': f"{customer.get('firstName', '')} {customer.get('lastName', '')}".strip(),
            'customerEmail': customer.get('email', ''),
            'customerPhone': customer.get('phone', ''),
            'planName': customer.get('planName', ''),
            'planAmount': customer.get('planAmount', 0),
            'previousStatus': old_status,
            'currentStatus': new_status,
            'severity': severity,
            'status': 'new',  # new, notified, retry_pending, resolved, dismissed
            'retryCount': 0,
            'checkCount': 1,
            'notes': [],
            'createdAt': datetime.utcnow(),
            'lastChecked': datetime.utcnow(),
            'resolvedAt': None,
        }

        result = await self.collection.insert_one(event)
        event['_id'] = result.inserted_id

        # Update customer record with dunning flag
        await self.db.vault_customers.update_one(
            {'_id': customer['_id']},
            {'$set': {
                'subscriptionStatus': new_status,
                'hasDunningAlert': True,
                'updatedAt': datetime.utcnow(),
            }}
        )

        return event

    async def _check_resolved_events(self, subs_by_vault: dict, subs_by_name: dict) -> int:
        """Check if any active dunning events have been resolved."""
        active_events = await self.collection.find(
            {'status': {'$in': ['new', 'notified', 'retry_pending']}}
        ).to_list(length=1000)

        resolved_count = 0
        for event in active_events:
            vault_id = event.get('customerVaultId', '')
            sub_info = subs_by_vault.get(vault_id) if vault_id else None

            if not sub_info:
                name = event.get('customerName', '').strip().upper().split()
                if len(name) >= 2:
                    name_key = f"{name[0]}|{name[-1]}"
                    sub_info = subs_by_name.get(name_key)

            if sub_info and sub_info.get('status') == 'active':
                await self.collection.update_one(
                    {'_id': event['_id']},
                    {'$set': {
                        'status': 'resolved',
                        'currentStatus': 'active',
                        'resolvedAt': datetime.utcnow(),
                        'resolution': 'auto_resolved',
                    }}
                )

                # Clear dunning flag from customer
                if event.get('customerId'):
                    try:
                        await self.db.vault_customers.update_one(
                            {'_id': ObjectId(event['customerId'])},
                            {'$set': {'hasDunningAlert': False, 'subscriptionStatus': 'active'}}
                        )
                    except Exception:
                        pass

                resolved_count += 1

        return resolved_count

    async def _count_active_events(self) -> int:
        """Count active dunning events."""
        return await self.collection.count_documents(
            {'status': {'$in': ['new', 'notified', 'retry_pending']}}
        )

    async def _notify_admin(self, events: List[dict]):
        """Send email notification to admin about new dunning events."""
        if not self.notification_service or not events:
            return

        try:
            event_rows = ""
            for evt in events:
                severity_emoji = {'critical': '🔴', 'high': '🟠', 'medium': '🟡'}.get(evt.get('severity', ''), '⚪')
                status_label = {
                    'failed': 'Pago Fallido', 'cancelled': 'Cancelado',
                    'paused': 'Pausado', 'missing': 'Desaparecido'
                }.get(evt.get('currentStatus', ''), evt.get('currentStatus', ''))

                event_rows += f"""
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">{severity_emoji} {evt.get('customerName', 'N/A')}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">{evt.get('planName', 'N/A')}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">${evt.get('planAmount', 0):.2f}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; color: #e53e3e; font-weight: bold;">{status_label}</td>
                </tr>
                """

            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #991b1b, #dc2626); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Alerta de Pagos - Dunning</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Se detectaron {len(events)} problema(s) de pago</p>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #eee; border-top: none;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f7f7f7;">
                                <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Cliente</th>
                                <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Plan</th>
                                <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Monto</th>
                                <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>{event_rows}</tbody>
                    </table>
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="https://www.rosstaxpreparation.com/admin/customer-vault" 
                           style="display: inline-block; background: #991b1b; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Ver en Customer Vault
                        </a>
                    </div>
                </div>
                <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
                    Ross Tax Preparation LLC • Sistema de Dunning Automático
                </div>
            </div>
            """

            await self.notification_service.send_notification(
                notification_type='email',
                recipient='yoandyross@gmail.com',
                subject=f'⚠️ Alerta Dunning: {len(events)} problema(s) de pago detectado(s)',
                body=html_content,
            )

            # Mark events as notified
            event_ids = [evt['_id'] for evt in events if '_id' in evt]
            if event_ids:
                await self.collection.update_many(
                    {'_id': {'$in': event_ids}},
                    {'$set': {'status': 'notified', 'notifiedAt': datetime.utcnow()}}
                )

            logger.info(f"📧 Dunning notification sent: {len(events)} events")

        except Exception as e:
            logger.error(f"Error sending dunning notification: {e}")

    async def get_events(self, status_filter: str = None, limit: int = 50, skip: int = 0) -> List[dict]:
        """Get dunning events with optional status filter."""
        query = {}
        if status_filter and status_filter != 'all':
            query['status'] = status_filter

        cursor = self.collection.find(query).sort('createdAt', -1).skip(skip).limit(limit)
        events = await cursor.to_list(length=limit)

        for evt in events:
            evt['id'] = str(evt.pop('_id'))
            if 'customerId' in evt:
                evt['customerId'] = str(evt['customerId'])

        return events

    async def get_stats(self) -> dict:
        """Get dunning statistics."""
        pipeline = [
            {'$group': {
                '_id': '$status',
                'count': {'$sum': 1},
                'totalAmount': {'$sum': '$planAmount'},
            }}
        ]
        results = await self.collection.aggregate(pipeline).to_list(length=100)

        stats = {
            'new': 0, 'notified': 0, 'retry_pending': 0,
            'resolved': 0, 'dismissed': 0,
            'totalAtRisk': 0, 'totalResolved': 0,
        }

        for r in results:
            status = r['_id']
            stats[status] = r['count']
            if status in ('new', 'notified', 'retry_pending'):
                stats['totalAtRisk'] += r.get('totalAmount', 0)
            elif status == 'resolved':
                stats['totalResolved'] += r.get('totalAmount', 0)

        stats['activeAlerts'] = stats['new'] + stats['notified'] + stats['retry_pending']
        stats['total'] = sum(r['count'] for r in results)

        return stats

    async def dismiss_event(self, event_id: str, note: str = '') -> bool:
        """Dismiss a dunning event."""
        try:
            result = await self.collection.update_one(
                {'_id': ObjectId(event_id)},
                {'$set': {
                    'status': 'dismissed',
                    'resolvedAt': datetime.utcnow(),
                    'resolution': 'manually_dismissed',
                }, '$push': {
                    'notes': {
                        'text': note or 'Descartado manualmente',
                        'timestamp': datetime.utcnow(),
                    }
                }}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error dismissing dunning event: {e}")
            return False

    async def add_note(self, event_id: str, note: str) -> bool:
        """Add a note to a dunning event."""
        try:
            result = await self.collection.update_one(
                {'_id': ObjectId(event_id)},
                {'$push': {
                    'notes': {
                        'text': note,
                        'timestamp': datetime.utcnow(),
                    }
                }}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error adding note: {e}")
            return False
