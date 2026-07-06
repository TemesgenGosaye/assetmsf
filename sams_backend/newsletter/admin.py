from django.contrib import admin
from .models import NewsletterCategory, NewsletterPost


@admin.register(NewsletterCategory)
class NewsletterCategoryAdmin(admin.ModelAdmin):
    list_display = ('key', 'label', 'hue', 'created_at')
    search_fields = ('key', 'label')


@admin.register(NewsletterPost)
class NewsletterPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'author', 'published', 'created_at')
    list_filter = ('published', 'category')
    search_fields = ('title', 'body', 'author')
