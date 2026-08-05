"""
Google Reviews Management Routes Router
Extracted from server.py for modularization.
Handles Google review syncing, CRUD, AI response generation, and notifications.
"""
import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

google_reviews_router = APIRouter()
_db = None

ROSS_TAX_PLACE_ID = "ChIJ92O7S5uFBocRr73ZEcFl4zM"


def init_google_reviews_router(db):
    global _db
    _db = db


# ================== Auth helpers ==================

async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return {
        'id': user.get('id', str(user.get('_id'))),
        'email': user.get('email'),
        'role': user.get('role'),
        'name': user.get('name', user.get('full_name', ''))
    }


async def _require_admin(request: Request):
    """Authenticate admin user"""
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


# ================== Pydantic Models ==================

class GoogleReviewCreate(BaseModel):
    author_name: str
    rating: int
    text: str
    review_date: Optional[str] = None
    google_review_id: Optional[str] = None
    profile_photo_url: Optional[str] = None


class ReviewResponseCreate(BaseModel):
    response_text: str


# ================== Helper Functions ==================

async def generate_review_response(author_name: str, rating: int, review_text: str) -> str:
    """Generate AI-powered response suggestion for a review"""
    try:
        import openai
        openai_key = os.getenv('EMERGENT_LLM_KEY') or os.getenv('OPENAI_API_KEY')
        
        if openai_key:
            client = openai.OpenAI(
                api_key=openai_key,
                base_url="https://llm.emergentagi.com/v1" if os.getenv('EMERGENT_LLM_KEY') else None
            )
            
            prompt = f"""Genera una respuesta profesional y cálida en español para la siguiente reseña de Google de Ross Tax Preparation.
            
Nombre del cliente: {author_name}
Calificación: {rating} estrellas
Reseña: {review_text}

La respuesta debe:
- Ser personalizada usando el nombre del cliente
- Agradecer por la reseña
- Si es positiva (4-5 estrellas): expresar gratitud y mencionar que esperamos verlos pronto
- Si es negativa (1-3 estrellas): disculparse, ofrecer solución y pedir contacto directo
- Ser breve (2-3 oraciones máximo)
- Firmar como "El equipo de Ross Tax Preparation"

Respuesta:"""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
    except Exception as e:
        logging.warning(f"AI response generation failed: {e}")
    
    first_name = author_name.split()[0] if author_name else "Cliente"
    
    if rating >= 4:
        return f"¡Muchas gracias por tu reseña, {first_name}! 🌟 Nos alegra mucho saber que tuviste una buena experiencia con nosotros. ¡Esperamos verte pronto! - El equipo de Ross Tax Preparation"
    else:
        return f"Hola {first_name}, lamentamos que tu experiencia no haya sido la mejor. Nos gustaría conocer más detalles para mejorar. Por favor contáctanos al (806) 934-2018. - El equipo de Ross Tax Preparation"


async def send_new_review_notification(author_name: str, rating: int, review_text: str):
    """Send notification when a new review is received"""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To
        
        sendgrid_key = os.getenv('SENDGRID_API_KEY')
        if sendgrid_key:
            stars = '⭐' * rating
            sg = SendGridAPIClient(sendgrid_key)
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">🔔 Nueva Reseña en Google</h1>
                </div>
                <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
                    <p><strong>Cliente:</strong> {author_name}</p>
                    <p><strong>Calificación:</strong> {stars} ({rating}/5)</p>
                    <p><strong>Reseña:</strong></p>
                    <blockquote style="border-left: 3px solid #6C1110; padding-left: 15px; margin: 10px 0; color: #555;">
                        "{review_text}"
                    </blockquote>
                    <p style="margin-top: 20px;">
                        <a href="https://www.rosstaxpreparation.com/admin/resenas" 
                           style="background: #6C1110; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                            Ver y Responder
                        </a>
                    </p>
                </div>
            </div>
            """
            
            message = Mail(
                from_email=Email('info@rosstaxpreparation.com', 'Ross Tax - Alertas'),
                to_emails=To('yoandyross@gmail.com'),
                subject=f'🔔 Nueva Reseña: {author_name} - {stars}',
                html_content=html_content
            )
            sg.send(message)
            logging.info(f"✅ Review notification sent for {author_name}")
        
        twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        if twilio_sid and twilio_token and twilio_phone:
            from twilio.rest import Client as TwilioClient
            twilio_client = TwilioClient(twilio_sid, twilio_token)
            
            stars_text = '⭐' * rating
            sms_text = f"🔔 Nueva reseña en Google!\n{author_name}: {stars_text}\n\"{review_text[:100]}{'...' if len(review_text) > 100 else ''}\"\n\nResponde en: rosstaxpreparation.com/admin/resenas"
            
            twilio_client.messages.create(
                body=sms_text,
                from_=twilio_phone,
                to='+18069307456'
            )
            logging.info(f"✅ SMS notification sent for new review")
            
    except Exception as e:
        logging.warning(f"Failed to send review notification: {e}")


async def fetch_google_reviews_from_api():
    """Fetch reviews from Google Places API"""
    try:
        import httpx
        
        google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        if not google_api_key:
            logging.warning("No Google Maps API key configured")
            return []
        
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            'place_id': ROSS_TAX_PLACE_ID,
            'fields': 'reviews,rating,user_ratings_total',
            'key': google_api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            if data.get('status') == 'OK' and data.get('result', {}).get('reviews'):
                reviews = []
                for r in data['result']['reviews']:
                    reviews.append({
                        'author_name': r.get('author_name', 'Anónimo'),
                        'rating': r.get('rating', 5),
                        'text': r.get('text', ''),
                        'time': r.get('time', 0),
                        'profile_photo_url': r.get('profile_photo_url'),
                        'relative_time_description': r.get('relative_time_description')
                    })
                return reviews
        return []
    except Exception as e:
        logging.error(f"Error fetching Google reviews: {e}")
        return []


async def check_and_import_new_reviews():
    """Background task to check for new reviews and import them"""
    try:
        logging.info("🔄 Checking for new Google reviews...")
        
        google_reviews = await fetch_google_reviews_from_api()
        
        if not google_reviews:
            logging.info("No reviews fetched from Google API")
            return
        
        new_count = 0
        for review in google_reviews:
            existing = await _db.google_reviews.find_one({
                'author_name': review['author_name'],
                'rating': review['rating']
            })
            
            if not existing:
                suggested_response = await generate_review_response(
                    review['author_name'],
                    review['rating'],
                    review['text']
                )
                
                review_doc = {
                    'id': str(uuid.uuid4()),
                    'author_name': review['author_name'],
                    'rating': review['rating'],
                    'text': review['text'],
                    'review_date': datetime.fromtimestamp(review.get('time', 0)).isoformat() if review.get('time') else datetime.now(timezone.utc).isoformat(),
                    'profile_photo_url': review.get('profile_photo_url'),
                    'response_status': 'pending',
                    'suggested_response': suggested_response,
                    'created_at': datetime.now(timezone.utc),
                    'source': 'google_api'
                }
                
                await _db.google_reviews.insert_one(review_doc)
                new_count += 1
                
                await send_new_review_notification(
                    review['author_name'],
                    review['rating'],
                    review['text']
                )
                
                logging.info(f"✅ Imported new review from {review['author_name']}")
        
        if new_count > 0:
            logging.info(f"✅ Imported {new_count} new reviews from Google")
        else:
            logging.info("No new reviews to import")
            
    except Exception as e:
        logging.error(f"Error checking for new reviews: {e}")


# ================== GOOGLE REVIEWS ENDPOINTS ==================

@google_reviews_router.get('/public/google-reviews')
async def get_public_reviews(limit: int = 10):
    """Public endpoint - returns approved reviews for the landing page (no auth required)"""
    try:
        reviews = await _db.google_reviews.find(
            {'rating': {'$gte': 4}, 'text': {'$ne': '', '$exists': True}},
            {'author_name': 1, 'rating': 1, 'text': 1, 'profile_photo_url': 1, 'review_date': 1, 'created_at': 1, '_id': 0}
        ).sort('created_at', -1).limit(limit).to_list(limit)

        for r in reviews:
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat() if hasattr(r['created_at'], 'isoformat') else str(r['created_at'])

        return {'reviews': reviews, 'total': len(reviews)}
    except Exception as e:
        logging.error(f"Error fetching public reviews: {e}")
        return {'reviews': [], 'total': 0}



@google_reviews_router.post('/admin/google-reviews/sync')
async def sync_google_reviews(request: Request):
    current_user = await _require_admin(request)
    try:
        import httpx
        
        google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        if not google_api_key:
            return {'success': False, 'message': 'No hay API key de Google configurada', 'new_count': 0}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    'place_id': ROSS_TAX_PLACE_ID,
                    'fields': 'reviews,rating,user_ratings_total',
                    'key': google_api_key,
                    'reviews_sort': 'newest'
                }
            )
            data = response.json()
        
        if data.get('status') != 'OK':
            return {'success': False, 'message': f'Error de Google: {data.get("status")}', 'new_count': 0}
        
        result = data.get('result', {})
        google_total = result.get('user_ratings_total', 0)
        reviews = result.get('reviews', [])
        
        new_count = 0
        for r in reviews:
            existing = await _db.google_reviews.find_one({
                'author_name': r.get('author_name'),
                'text': (r.get('text', '') or '')[:100]
            })
            
            if not existing:
                suggested_response = await generate_review_response(
                    r.get('author_name', 'Cliente'),
                    r.get('rating', 5),
                    r.get('text', '')
                )
                
                review_doc = {
                    'author_name': r.get('author_name', 'Anónimo'),
                    'rating': r.get('rating', 5),
                    'text': r.get('text', ''),
                    'profile_photo_url': r.get('profile_photo_url'),
                    'relative_time': r.get('relative_time_description'),
                    'google_time': r.get('time'),
                    'response_status': 'pending',
                    'suggested_response': suggested_response,
                    'created_at': datetime.now(timezone.utc),
                    'source': 'google_api_sync'
                }
                await _db.google_reviews.insert_one(review_doc)
                new_count += 1
                logging.info(f"⭐ New review imported: {r.get('author_name')}")
        
        return {
            'success': True, 
            'message': f'Sincronización completada. {new_count} reseñas nuevas importadas.',
            'new_count': new_count,
            'google_total': google_total
        }
    except Exception as e:
        logging.error(f"Error syncing reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@google_reviews_router.get('/admin/google-reviews')
async def get_google_reviews(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50
):
    current_user = await _require_admin(request)
    try:
        query = {}
        if status:
            query['response_status'] = status
        
        reviews = await _db.google_reviews.find(query).sort('created_at', -1).limit(limit).to_list(limit)
        
        total = await _db.google_reviews.count_documents({})
        pending = await _db.google_reviews.count_documents({'response_status': 'pending'})
        responded = await _db.google_reviews.count_documents({'response_status': 'responded'})
        
        pipeline = [{'$group': {'_id': None, 'avg_rating': {'$avg': '$rating'}}}]
        avg_result = await _db.google_reviews.aggregate(pipeline).to_list(1)
        avg_rating = avg_result[0]['avg_rating'] if avg_result else 5.0
        
        google_total = None
        try:
            import httpx
            google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
            if google_api_key:
                async with httpx.AsyncClient(timeout=5) as client:
                    response = await client.get(
                        "https://maps.googleapis.com/maps/api/place/details/json",
                        params={
                            'place_id': ROSS_TAX_PLACE_ID,
                            'fields': 'user_ratings_total',
                            'key': google_api_key
                        }
                    )
                    data = response.json()
                    if data.get('status') == 'OK':
                        google_total = data.get('result', {}).get('user_ratings_total')
        except Exception:
            pass
        
        return {
            'reviews': [{
                'id': str(r.get('_id', '')),
                'author_name': r.get('author_name', 'Anónimo'),
                'rating': r.get('rating', 5),
                'text': r.get('text', ''),
                'review_date': r.get('review_date'),
                'created_at': r.get('created_at'),
                'response_status': r.get('response_status', 'pending'),
                'response_text': r.get('response_text'),
                'responded_at': r.get('responded_at'),
                'suggested_response': r.get('suggested_response'),
                'profile_photo_url': r.get('profile_photo_url'),
                'google_review_id': r.get('google_review_id')
            } for r in reviews],
            'stats': {
                'total': total,
                'pending': pending,
                'responded': responded,
                'avg_rating': round(avg_rating, 1)
            },
            'google_total': google_total
        }
    except Exception as e:
        logging.error(f"Error fetching Google reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@google_reviews_router.post('/admin/google-reviews')
async def add_google_review(
    review: GoogleReviewCreate,
    request: Request,
):
    current_user = await _require_admin(request)
    try:
        suggested_response = await generate_review_response(review.author_name, review.rating, review.text)
        
        review_doc = {
            'id': str(uuid.uuid4()),
            'author_name': review.author_name,
            'rating': review.rating,
            'text': review.text,
            'review_date': review.review_date or datetime.now(timezone.utc).isoformat(),
            'google_review_id': review.google_review_id,
            'profile_photo_url': review.profile_photo_url,
            'response_status': 'pending',
            'response_text': None,
            'responded_at': None,
            'suggested_response': suggested_response,
            'created_at': datetime.now(timezone.utc),
            'added_by': current_user.get('id')
        }
        
        await _db.google_reviews.insert_one(review_doc)
        
        await send_new_review_notification(review.author_name, review.rating, review.text)
        
        logging.info(f"✅ Google review added: {review.author_name} - {review.rating} stars")
        
        return {'success': True, 'review_id': review_doc['id'], 'suggested_response': suggested_response}
    except Exception as e:
        logging.error(f"Error adding Google review: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@google_reviews_router.put('/admin/google-reviews/{review_id}/respond')
async def respond_to_review(
    review_id: str,
    response: ReviewResponseCreate,
    request: Request,
):
    current_user = await _require_admin(request)
    try:
        query = {'id': review_id}
        if ObjectId.is_valid(review_id):
            query = {'$or': [{'id': review_id}, {'_id': ObjectId(review_id)}]}
        
        result = await _db.google_reviews.update_one(
            query,
            {'$set': {
                'response_status': 'responded',
                'response_text': response.response_text,
                'responded_at': datetime.now(timezone.utc),
                'responded_by': current_user.get('id')
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Review not found')
        
        logging.info(f"✅ Review {review_id} marked as responded")
        return {'success': True, 'message': 'Review marked as responded'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error responding to review: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@google_reviews_router.post('/admin/google-reviews/{review_id}/generate-response')
async def regenerate_response(
    review_id: str,
    request: Request,
):
    current_user = await _require_admin(request)
    try:
        query = {'id': review_id}
        if ObjectId.is_valid(review_id):
            query = {'$or': [{'id': review_id}, {'_id': ObjectId(review_id)}]}
        
        review = await _db.google_reviews.find_one(query)
        if not review:
            raise HTTPException(status_code=404, detail='Review not found')
        
        suggested_response = await generate_review_response(
            review.get('author_name', 'Cliente'),
            review.get('rating', 5),
            review.get('text', '')
        )
        
        await _db.google_reviews.update_one(
            query,
            {'$set': {'suggested_response': suggested_response}}
        )
        
        return {'success': True, 'suggested_response': suggested_response}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating response: {e}")
        raise HTTPException(status_code=500, detail=str(e))
