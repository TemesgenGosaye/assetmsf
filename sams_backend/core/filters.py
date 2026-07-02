"""
Custom filter classes for Django REST Framework.
"""
import django_filters
from django_filters import rest_framework as filters


class BaseFilterSet(django_filters.FilterSet):
    """
    Base filter set with common filters.
    """
    created_at = filters.DateTimeFromToRangeFilter()
    updated_at = filters.DateTimeFromToRangeFilter()
    is_active = filters.BooleanFilter()

    class Meta:
        abstract = True


class SearchFilterMixin:
    """
    Mixin to add search functionality to filter sets.
    """
    search = filters.CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        """Filter by searching across multiple fields."""
        if not value:
            return queryset
        
        # Override this method in subclasses to define search logic
        return queryset


class OrderingFilterMixin:
    """
    Mixin to add custom ordering to filter sets.
    """
    ordering = filters.OrderingFilter(fields=None)

    def get_ordering_fields(self):
        """Return ordering fields based on model."""
        if self.Meta.model:
            return [
                ('created_at', 'created'),
                ('-created_at', '-created'),
                ('updated_at', 'updated'),
                ('-updated_at', '-updated'),
            ]
        return []
