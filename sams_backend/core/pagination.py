"""
Custom pagination classes.
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination with page size configuration.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000

    def get_paginated_response(self, data):
        """Return paginated response with standard format."""
        return Response({
            'success': True,
            'message': 'Data retrieved successfully',
            'data': data,
            'errors': None,
            'pagination': {
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'page_size': self.page_size,
                'current_page': self.page.number,
                'total_pages': self.page.paginator.num_pages,
            }
        })


class LargeResultsSetPagination(PageNumberPagination):
    """
    Large pagination for endpoints that need more results per page.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500

    def get_paginated_response(self, data):
        """Return paginated response with standard format."""
        return Response({
            'success': True,
            'message': 'Data retrieved successfully',
            'data': data,
            'errors': None,
            'pagination': {
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'page_size': self.page_size,
                'current_page': self.page.number,
                'total_pages': self.page.paginator.num_pages,
            }
        })
