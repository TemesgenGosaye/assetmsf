from django.urls import path
from . import views

urlpatterns = [
    path('categories/', views.NewsletterCategoryListView.as_view(), name='newsletter-category-list'),
    path('categories/<uuid:pk>/', views.NewsletterCategoryDetailView.as_view(), name='newsletter-category-detail'),
    path('posts/', views.NewsletterPostListView.as_view(), name='newsletter-post-list'),
    path('posts/<str:id>/', views.NewsletterPostDetailView.as_view(), name='newsletter-post-detail'),
]
