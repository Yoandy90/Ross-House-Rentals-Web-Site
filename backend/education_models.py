from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

# ============== FAQ Models ==============
class FAQBase(BaseModel):
    question: str
    answer: str
    icon: str
    order: int = 0
    active: bool = True

class FAQCreate(FAQBase):
    pass

class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class FAQ(FAQBase):
    id: str
    created_at: str
    updated_at: str

# ============== Article Models ==============
class ArticleBase(BaseModel):
    title: str
    description: str
    read_time: str
    category: str
    content: Optional[str] = None
    order: int = 0
    active: bool = True

class ArticleCreate(ArticleBase):
    pass

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    read_time: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class Article(ArticleBase):
    id: str
    created_at: str
    updated_at: str

# ============== Video Models ==============
class VideoBase(BaseModel):
    title: str
    description: str
    duration: str
    url: str
    thumbnail: Optional[str] = None
    order: int = 0
    active: bool = True

class VideoCreate(VideoBase):
    pass

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    url: Optional[str] = None
    thumbnail: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class Video(VideoBase):
    id: str
    created_at: str
    updated_at: str
