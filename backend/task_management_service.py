import logging
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from task_management_models import (
    Task, TaskCreate, TaskUpdate,
    Estimate, EstimateCreate, EstimateUpdate,
    Expense, ExpenseCreate, ExpenseUpdate,
    TimeEntry, TimeEntryCreate, TimeEntryUpdate
)
import uuid

logger = logging.getLogger(__name__)

class TaskManagementService:
    """Service for Task Management, Estimates, Expenses, and Time Tracking"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        logger.info("📋 Task Management Service initialized")
    
    # ============= TASK MANAGEMENT =============
    
    async def create_task(self, task_data: TaskCreate, created_by: str) -> Task:
        """Create a new task"""
        task = Task(
            id=str(uuid.uuid4()),
            **task_data.dict(),
            assigned_by=created_by
        )
        
        await self.db.tasks.insert_one(task.dict())
        logger.info(f"✅ Task created: {task.id}")
        return task
    
    async def get_tasks(
        self,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        client_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 50
    ) -> List[Task]:
        """Get tasks with filters"""
        query = {}
        if user_id:
            query['$or'] = [
                {'assigned_to': user_id},
                {'assigned_by': user_id}
            ]
        if status:
            query['status'] = status
        if client_id:
            query['client_id'] = client_id
        if assigned_to:
            query['assigned_to'] = assigned_to
        
        tasks = await self.db.tasks.find(query).sort('created_at', -1).limit(limit).to_list(length=limit)
        return [Task(**task) for task in tasks]
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        task = await self.db.tasks.find_one({'id': task_id})
        return Task(**task) if task else None
    
    async def update_task(self, task_id: str, update_data: TaskUpdate) -> Optional[Task]:
        """Update task"""
        updates = {k: v for k, v in update_data.dict().items() if v is not None}
        updates['updated_at'] = datetime.utcnow()
        
        # If marking as completed, set completed_at
        if updates.get('status') == 'completed':
            updates['completed_at'] = datetime.utcnow()
        
        result = await self.db.tasks.update_one(
            {'id': task_id},
            {'$set': updates}
        )
        
        if result.modified_count:
            return await self.get_task(task_id)
        return None
    
    async def delete_task(self, task_id: str) -> bool:
        """Delete task"""
        result = await self.db.tasks.delete_one({'id': task_id})
        return result.deleted_count > 0
    
    async def get_task_stats(self, user_id: Optional[str] = None) -> Dict:
        """Get task statistics"""
        query = {}
        if user_id:
            query['assigned_to'] = user_id
        
        total = await self.db.tasks.count_documents(query)
        todo = await self.db.tasks.count_documents({**query, 'status': 'todo'})
        in_progress = await self.db.tasks.count_documents({**query, 'status': 'in_progress'})
        completed = await self.db.tasks.count_documents({**query, 'status': 'completed'})
        overdue = await self.db.tasks.count_documents({
            **query,
            'due_date': {'$lt': datetime.utcnow()},
            'status': {'$nin': ['completed', 'cancelled']}
        })
        
        return {
            'total': total,
            'todo': todo,
            'in_progress': in_progress,
            'completed': completed,
            'overdue': overdue
        }
    
    # ============= ESTIMATES =============
    
    async def create_estimate(self, estimate_data: EstimateCreate, created_by: str) -> Estimate:
        """Create a new estimate"""
        # Calculate totals
        subtotal = sum(item.get('amount', 0) for item in estimate_data.items)
        tax_amount = subtotal * (estimate_data.tax_rate / 100)
        total = subtotal + tax_amount - estimate_data.discount_amount
        
        # Generate estimate number
        count = await self.db.estimates.count_documents({})
        estimate_number = f"EST-{datetime.utcnow().year}-{count + 1:04d}"
        
        estimate = Estimate(
            id=str(uuid.uuid4()),
            estimate_number=estimate_number,
            **estimate_data.dict(),
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            created_by=created_by
        )
        
        await self.db.estimates.insert_one(estimate.dict())
        logger.info(f"✅ Estimate created: {estimate.estimate_number}")
        return estimate
    
    async def get_estimates(
        self,
        client_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Estimate]:
        """Get estimates with filters"""
        query = {}
        if client_id:
            query['client_id'] = client_id
        if status:
            query['status'] = status
        
        estimates = await self.db.estimates.find(query).sort('created_at', -1).limit(limit).to_list(length=limit)
        return [Estimate(**est) for est in estimates]
    
    async def get_estimate(self, estimate_id: str) -> Optional[Estimate]:
        """Get estimate by ID"""
        estimate = await self.db.estimates.find_one({'id': estimate_id})
        return Estimate(**estimate) if estimate else None
    
    async def update_estimate(self, estimate_id: str, update_data: EstimateUpdate) -> Optional[Estimate]:
        """Update estimate"""
        updates = {k: v for k, v in update_data.dict().items() if v is not None}
        
        # Recalculate totals if items changed
        if 'items' in updates:
            subtotal = sum(item.get('amount', 0) for item in updates['items'])
            current = await self.get_estimate(estimate_id)
            tax_rate = updates.get('tax_rate', current.tax_rate)
            discount = updates.get('discount_amount', current.discount_amount)
            
            tax_amount = subtotal * (tax_rate / 100)
            total = subtotal + tax_amount - discount
            
            updates['subtotal'] = subtotal
            updates['tax_amount'] = tax_amount
            updates['total'] = total
        
        updates['updated_at'] = datetime.utcnow()
        
        # Track status changes
        if updates.get('status') == 'sent':
            updates['sent_at'] = datetime.utcnow()
        elif updates.get('status') == 'accepted':
            updates['accepted_at'] = datetime.utcnow()
        elif updates.get('status') == 'declined':
            updates['declined_at'] = datetime.utcnow()
        
        result = await self.db.estimates.update_one(
            {'id': estimate_id},
            {'$set': updates}
        )
        
        if result.modified_count:
            return await self.get_estimate(estimate_id)
        return None
    
    async def convert_estimate_to_invoice(self, estimate_id: str) -> Dict:
        """Convert estimate to invoice"""
        estimate = await self.get_estimate(estimate_id)
        if not estimate or estimate.status != 'accepted':
            return {'success': False, 'error': 'Estimate must be accepted first'}
        
        # Create invoice (simplified - would integrate with existing invoice system)
        invoice_id = str(uuid.uuid4())
        
        # Update estimate
        await self.db.estimates.update_one(
            {'id': estimate_id},
            {'$set': {'status': 'invoiced', 'invoice_id': invoice_id, 'updated_at': datetime.utcnow()}}
        )
        
        logger.info(f"✅ Estimate {estimate.estimate_number} converted to invoice")
        return {'success': True, 'invoice_id': invoice_id}
    
    # ============= EXPENSES =============
    
    async def create_expense(self, expense_data: ExpenseCreate, created_by: str) -> Expense:
        """Create a new expense"""
        expense = Expense(
            id=str(uuid.uuid4()),
            **expense_data.dict(),
            created_by=created_by
        )
        
        await self.db.expenses.insert_one(expense.dict())
        logger.info(f"✅ Expense created: {expense.id} - ${expense.amount}")
        return expense
    
    async def get_expenses(
        self,
        category: Optional[str] = None,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50
    ) -> List[Expense]:
        """Get expenses with filters"""
        query = {}
        if category:
            query['category'] = category
        if project_id:
            query['project_id'] = project_id
        if status:
            query['status'] = status
        if start_date or end_date:
            query['date'] = {}
            if start_date:
                query['date']['$gte'] = start_date
            if end_date:
                query['date']['$lte'] = end_date
        
        expenses = await self.db.expenses.find(query).sort('date', -1).limit(limit).to_list(length=limit)
        return [Expense(**exp) for exp in expenses]
    
    async def get_expense(self, expense_id: str) -> Optional[Expense]:
        """Get expense by ID"""
        expense = await self.db.expenses.find_one({'id': expense_id})
        return Expense(**expense) if expense else None
    
    async def update_expense(self, expense_id: str, update_data: ExpenseUpdate) -> Optional[Expense]:
        """Update expense"""
        updates = {k: v for k, v in update_data.dict().items() if v is not None}
        updates['updated_at'] = datetime.utcnow()
        
        result = await self.db.expenses.update_one(
            {'id': expense_id},
            {'$set': updates}
        )
        
        if result.modified_count:
            return await self.get_expense(expense_id)
        return None
    
    async def approve_expense(self, expense_id: str, approved_by: str) -> Optional[Expense]:
        """Approve expense"""
        updates = {
            'status': 'approved',
            'approved_by': approved_by,
            'approved_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = await self.db.expenses.update_one(
            {'id': expense_id},
            {'$set': updates}
        )
        
        if result.modified_count:
            return await self.get_expense(expense_id)
        return None
    
    async def get_expense_summary(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get expense summary statistics"""
        query = {}
        if start_date or end_date:
            query['date'] = {}
            if start_date:
                query['date']['$gte'] = start_date
            if end_date:
                query['date']['$lte'] = end_date
        
        # Aggregate by category
        pipeline = [
            {'$match': query},
            {'$group': {
                '_id': '$category',
                'total': {'$sum': '$amount'},
                'count': {'$sum': 1}
            }}
        ]
        
        by_category = await self.db.expenses.aggregate(pipeline).to_list(length=100)
        
        # Total expenses
        total = sum(cat['total'] for cat in by_category)
        
        # Billable vs non-billable
        billable = await self.db.expenses.aggregate([
            {'$match': {**query, 'is_billable': True}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]).to_list(length=1)
        
        return {
            'total': total,
            'by_category': by_category,
            'billable': billable[0]['total'] if billable else 0,
            'non_billable': total - (billable[0]['total'] if billable else 0)
        }
    
    # ============= TIME TRACKING =============
    
    async def start_timer(self, time_data: TimeEntryCreate, user_id: str) -> TimeEntry:
        """Start time tracking"""
        time_entry = TimeEntry(
            id=str(uuid.uuid4()),
            user_id=user_id,
            **time_data.dict(),
            start_time=time_data.start_time or datetime.utcnow(),
            status='active'
        )
        
        await self.db.time_entries.insert_one(time_entry.dict())
        logger.info(f"▶️  Timer started: {time_entry.id}")
        return time_entry
    
    async def stop_timer(self, entry_id: str) -> Optional[TimeEntry]:
        """Stop time tracking"""
        entry = await self.get_time_entry(entry_id)
        if not entry or entry.status != 'active':
            return None
        
        end_time = datetime.utcnow()
        duration_minutes = int((end_time - entry.start_time).total_seconds() / 60)
        
        # Calculate amount if hourly rate is set
        amount = None
        if entry.hourly_rate:
            hours = duration_minutes / 60
            amount = hours * entry.hourly_rate
        
        updates = {
            'end_time': end_time,
            'duration_minutes': duration_minutes,
            'amount': amount,
            'status': 'stopped',
            'updated_at': datetime.utcnow()
        }
        
        await self.db.time_entries.update_one(
            {'id': entry_id},
            {'$set': updates}
        )
        
        logger.info(f"⏹️  Timer stopped: {entry_id} - {duration_minutes} minutes")
        return await self.get_time_entry(entry_id)
    
    async def get_time_entries(
        self,
        user_id: Optional[str] = None,
        client_id: Optional[str] = None,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50
    ) -> List[TimeEntry]:
        """Get time entries with filters"""
        query = {}
        if user_id:
            query['user_id'] = user_id
        if client_id:
            query['client_id'] = client_id
        if project_id:
            query['project_id'] = project_id
        if status:
            query['status'] = status
        if start_date or end_date:
            query['start_time'] = {}
            if start_date:
                query['start_time']['$gte'] = start_date
            if end_date:
                query['start_time']['$lte'] = end_date
        
        entries = await self.db.time_entries.find(query).sort('start_time', -1).limit(limit).to_list(length=limit)
        return [TimeEntry(**entry) for entry in entries]
    
    async def get_time_entry(self, entry_id: str) -> Optional[TimeEntry]:
        """Get time entry by ID"""
        entry = await self.db.time_entries.find_one({'id': entry_id})
        return TimeEntry(**entry) if entry else None
    
    async def update_time_entry(self, entry_id: str, update_data: TimeEntryUpdate) -> Optional[TimeEntry]:
        """Update time entry"""
        updates = {k: v for k, v in update_data.dict().items() if v is not None}
        
        # Recalculate if end_time or rate changes
        entry = await self.get_time_entry(entry_id)
        if updates.get('end_time') or updates.get('hourly_rate'):
            end_time = updates.get('end_time', entry.end_time)
            if end_time:
                duration_minutes = int((end_time - entry.start_time).total_seconds() / 60)
                updates['duration_minutes'] = duration_minutes
                
                rate = updates.get('hourly_rate', entry.hourly_rate)
                if rate:
                    hours = duration_minutes / 60
                    updates['amount'] = hours * rate
        
        updates['updated_at'] = datetime.utcnow()
        
        result = await self.db.time_entries.update_one(
            {'id': entry_id},
            {'$set': updates}
        )
        
        if result.modified_count:
            return await self.get_time_entry(entry_id)
        return None
    
    async def get_time_summary(
        self,
        user_id: Optional[str] = None,
        client_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get time tracking summary"""
        query = {}
        if user_id:
            query['user_id'] = user_id
        if client_id:
            query['client_id'] = client_id
        if start_date or end_date:
            query['start_time'] = {}
            if start_date:
                query['start_time']['$gte'] = start_date
            if end_date:
                query['start_time']['$lte'] = end_date
        
        # Total time
        pipeline = [
            {'$match': query},
            {'$group': {
                '_id': None,
                'total_minutes': {'$sum': '$duration_minutes'},
                'total_amount': {'$sum': '$amount'},
                'billable_minutes': {
                    '$sum': {
                        '$cond': [{'$eq': ['$is_billable', True]}, '$duration_minutes', 0]
                    }
                }
            }}
        ]
        
        result = await self.db.time_entries.aggregate(pipeline).to_list(length=1)
        
        if result:
            total_minutes = result[0].get('total_minutes', 0) or 0
            return {
                'total_hours': round(total_minutes / 60, 2),
                'total_amount': result[0].get('total_amount', 0) or 0,
                'billable_hours': round(result[0].get('billable_minutes', 0) / 60, 2),
                'non_billable_hours': round((total_minutes - result[0].get('billable_minutes', 0)) / 60, 2)
            }
        
        return {
            'total_hours': 0,
            'total_amount': 0,
            'billable_hours': 0,
            'non_billable_hours': 0
        }

# Global instance
task_service = None

def init_task_service(db: AsyncIOMotorDatabase):
    """Initialize task management service"""
    global task_service
    task_service = TaskManagementService(db)
    logger.info("✅ Task Management Service initialized with database")
    return task_service
