from rest_framework import generics
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from .models import NewsletterCategory, NewsletterPost
from .serializers import NewsletterCategorySerializer, NewsletterPostSerializer


class NewsletterCategoryListView(generics.ListCreateAPIView):
    queryset = NewsletterCategory.objects.all()
    serializer_class = NewsletterCategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, 'Categories retrieved successfully')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return StandardResponse.created(serializer.data, 'Category created successfully')


class NewsletterCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = NewsletterCategory.objects.all()
    serializer_class = NewsletterCategorySerializer
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, 'Category retrieved successfully')

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return StandardResponse.success(serializer.data, 'Category updated successfully')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return StandardResponse.no_content('Category deleted successfully')


class NewsletterPostListView(generics.ListCreateAPIView):
    queryset = NewsletterPost.objects.all()
    serializer_class = NewsletterPostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['published']

    def get_queryset(self):
        queryset = NewsletterPost.objects.all()
        published = self.request.query_params.get('published')
        if published is not None:
            queryset = queryset.filter(published=published == 'true')
        return queryset.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, 'Posts retrieved successfully')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return StandardResponse.created(serializer.data, 'Post created successfully')


class NewsletterPostDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = NewsletterPost.objects.all()
    serializer_class = NewsletterPostSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, 'Post retrieved successfully')

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return StandardResponse.success(serializer.data, 'Post updated successfully')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return StandardResponse.no_content('Post deleted successfully')
