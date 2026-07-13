import uuid

from rest_framework import serializers
from .models import NewsletterCategory, NewsletterPost


class NewsletterCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterCategory
        fields = '__all__'


class NewsletterPostSerializer(serializers.ModelSerializer):
    # Accept/return the human-readable category key (e.g. "release_notes")
    # instead of the internal UUID primary key.
    category = serializers.SlugRelatedField(
        slug_field='key',
        queryset=NewsletterCategory.objects.all(),
        required=False,
        allow_null=True,
    )
    category_name = serializers.CharField(source='category.label', read_only=True)
    # `id` is a CharField primary key with no DB default; make it optional and
    # generate a friendly value when the client does not supply one.
    id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = NewsletterPost
        fields = '__all__'

    def _generate_id(self):
        return f"NEWS-{uuid.uuid4().hex[:8]}"

    def create(self, validated_data):
        if not validated_data.get('id'):
            validated_data['id'] = self._generate_id()
        return super().create(validated_data)

