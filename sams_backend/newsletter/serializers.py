from rest_framework import serializers
from .models import NewsletterCategory, NewsletterPost


class NewsletterCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterCategory
        fields = '__all__'


class NewsletterPostSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.label', read_only=True)

    class Meta:
        model = NewsletterPost
        fields = '__all__'
