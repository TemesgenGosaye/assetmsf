from django.db import models
from core.models import BaseModel


class NewsletterCategory(BaseModel):
    key = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=200)
    hue = models.CharField(max_length=50, default='blue')

    def __str__(self):
        return self.label


class NewsletterPost(BaseModel):
    id = models.CharField(max_length=50, primary_key=True)
    title = models.CharField(max_length=500)
    body = models.TextField()
    author = models.CharField(max_length=200, null=True, blank=True)
    published = models.BooleanField(default=True)
    category = models.ForeignKey(
        NewsletterCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts'
    )

    def __str__(self):
        return self.title
