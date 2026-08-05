from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from education_models import (
    FAQCreate, FAQUpdate, FAQ,
    ArticleCreate, ArticleUpdate, Article,
    VideoCreate, VideoUpdate, Video
)

education_router = APIRouter()
db = None

def init_education_endpoints(database):
    global db
    db = database

# ============== FAQ Endpoints ==============

@education_router.get('/education/faqs')
async def get_faqs():
    """Get all active FAQs for clients"""
    try:
        cursor = db.education_faqs.find({'active': True}).sort('order', 1)
        faqs = await cursor.to_list(length=None)
        return [{
            'id': faq['_id'],
            'question': faq['question'],
            'answer': faq['answer'],
            'icon': faq['icon'],
            'order': faq.get('order', 0)
        } for faq in faqs]
    except Exception as e:
        print(f'Error getting FAQs: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.get('/admin/education/faqs')
async def get_all_faqs_admin():
    """Admin: Get all FAQs including inactive"""
    try:
        cursor = db.education_faqs.find({}).sort('order', 1)
        faqs = await cursor.to_list(length=None)
        return [{
            'id': faq['_id'],
            'question': faq['question'],
            'answer': faq['answer'],
            'icon': faq['icon'],
            'order': faq.get('order', 0),
            'active': faq.get('active', True),
            'created_at': faq.get('created_at', ''),
            'updated_at': faq.get('updated_at', '')
        } for faq in faqs]
    except Exception as e:
        print(f'Error getting all FAQs: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.post('/admin/education/faqs')
async def create_faq(faq_data: FAQCreate):
    """Admin: Create new FAQ"""
    try:
        faq_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        faq_dict = faq_data.dict()
        faq_dict['_id'] = faq_id
        faq_dict['created_at'] = now
        faq_dict['updated_at'] = now
        
        await db.education_faqs.insert_one(faq_dict)
        
        faq_dict['id'] = faq_dict.pop('_id')
        return faq_dict
    except Exception as e:
        print(f'Error creating FAQ: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.put('/admin/education/faqs/{faq_id}')
async def update_faq(faq_id: str, faq_data: FAQUpdate):
    """Admin: Update FAQ"""
    try:
        update_data = {k: v for k, v in faq_data.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail='No data to update')
        
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        result = await db.education_faqs.update_one(
            {'_id': faq_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='FAQ not found')
        
        updated_faq = await db.education_faqs.find_one({'_id': faq_id})
        updated_faq['id'] = updated_faq.pop('_id')
        return updated_faq
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error updating FAQ: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.delete('/admin/education/faqs/{faq_id}')
async def delete_faq(faq_id: str):
    """Admin: Delete FAQ"""
    try:
        result = await db.education_faqs.delete_one({'_id': faq_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='FAQ not found')
        
        return {'message': 'FAQ deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error deleting FAQ: {e}')
        raise HTTPException(status_code=500, detail=str(e))

# ============== Article Endpoints ==============

@education_router.get('/education/articles')
async def get_articles():
    """Get all active articles for clients"""
    try:
        cursor = db.education_articles.find({'active': True}).sort('order', 1)
        articles = await cursor.to_list(length=None)
        return [{
            'id': article['_id'],
            'title': article['title'],
            'description': article['description'],
            'read_time': article['read_time'],
            'category': article['category'],
            'content': article.get('content'),
            'order': article.get('order', 0)
        } for article in articles]
    except Exception as e:
        print(f'Error getting articles: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.get('/admin/education/articles')
async def get_all_articles_admin():
    """Admin: Get all articles including inactive"""
    try:
        cursor = db.education_articles.find({}).sort('order', 1)
        articles = await cursor.to_list(length=None)
        return [{
            'id': article['_id'],
            'title': article['title'],
            'description': article['description'],
            'read_time': article['read_time'],
            'category': article['category'],
            'content': article.get('content'),
            'order': article.get('order', 0),
            'active': article.get('active', True),
            'created_at': article.get('created_at', ''),
            'updated_at': article.get('updated_at', '')
        } for article in articles]
    except Exception as e:
        print(f'Error getting all articles: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.post('/admin/education/articles')
async def create_article(article_data: ArticleCreate):
    """Admin: Create new article"""
    try:
        article_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        article_dict = article_data.dict()
        article_dict['_id'] = article_id
        article_dict['created_at'] = now
        article_dict['updated_at'] = now
        
        await db.education_articles.insert_one(article_dict)
        
        article_dict['id'] = article_dict.pop('_id')
        return article_dict
    except Exception as e:
        print(f'Error creating article: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.put('/admin/education/articles/{article_id}')
async def update_article(article_id: str, article_data: ArticleUpdate):
    """Admin: Update article"""
    try:
        update_data = {k: v for k, v in article_data.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail='No data to update')
        
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        result = await db.education_articles.update_one(
            {'_id': article_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Article not found')
        
        updated_article = await db.education_articles.find_one({'_id': article_id})
        updated_article['id'] = updated_article.pop('_id')
        return updated_article
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error updating article: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.delete('/admin/education/articles/{article_id}')
async def delete_article(article_id: str):
    """Admin: Delete article"""
    try:
        result = await db.education_articles.delete_one({'_id': article_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Article not found')
        
        return {'message': 'Article deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error deleting article: {e}')
        raise HTTPException(status_code=500, detail=str(e))

# ============== Video Endpoints ==============

@education_router.get('/education/videos')
async def get_videos():
    """Get all active videos for clients"""
    try:
        cursor = db.education_videos.find({'active': True}).sort('order', 1)
        videos = await cursor.to_list(length=None)
        return [{
            'id': video['_id'],
            'title': video['title'],
            'description': video['description'],
            'duration': video['duration'],
            'url': video['url'],
            'thumbnail': video.get('thumbnail'),
            'order': video.get('order', 0)
        } for video in videos]
    except Exception as e:
        print(f'Error getting videos: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.get('/admin/education/videos')
async def get_all_videos_admin():
    """Admin: Get all videos including inactive"""
    try:
        cursor = db.education_videos.find({}).sort('order', 1)
        videos = await cursor.to_list(length=None)
        return [{
            'id': video['_id'],
            'title': video['title'],
            'description': video['description'],
            'duration': video['duration'],
            'url': video['url'],
            'thumbnail': video.get('thumbnail'),
            'order': video.get('order', 0),
            'active': video.get('active', True),
            'created_at': video.get('created_at', ''),
            'updated_at': video.get('updated_at', '')
        } for video in videos]
    except Exception as e:
        print(f'Error getting all videos: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.post('/admin/education/videos')
async def create_video(video_data: VideoCreate):
    """Admin: Create new video"""
    try:
        video_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        video_dict = video_data.dict()
        video_dict['_id'] = video_id
        video_dict['created_at'] = now
        video_dict['updated_at'] = now
        
        await db.education_videos.insert_one(video_dict)
        
        video_dict['id'] = video_dict.pop('_id')
        return video_dict
    except Exception as e:
        print(f'Error creating video: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.put('/admin/education/videos/{video_id}')
async def update_video(video_id: str, video_data: VideoUpdate):
    """Admin: Update video"""
    try:
        update_data = {k: v for k, v in video_data.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail='No data to update')
        
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        result = await db.education_videos.update_one(
            {'_id': video_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Video not found')
        
        updated_video = await db.education_videos.find_one({'_id': video_id})
        updated_video['id'] = updated_video.pop('_id')
        return updated_video
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error updating video: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@education_router.delete('/admin/education/videos/{video_id}')
async def delete_video(video_id: str):
    """Admin: Delete video"""
    try:
        result = await db.education_videos.delete_one({'_id': video_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Video not found')
        
        return {'message': 'Video deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error deleting video: {e}')
        raise HTTPException(status_code=500, detail=str(e))
