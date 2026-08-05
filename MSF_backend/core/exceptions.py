"""
Custom exception handlers for the API.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    ValidationError,
    AuthenticationFailed,
    PermissionDenied,
    NotFound,
    Throttled,
)
from core.responses import StandardResponse


class CustomAPIException(APIException):
    """Base custom exception with standard response format."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A server error occurred."
    default_code = "error"

    def __init__(self, detail=None, code=None, status_code=None):
        if status_code:
            self.status_code = status_code
        super().__init__(detail, code)


class ResourceNotFoundException(CustomAPIException):
    """Exception raised when a resource is not found."""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."
    default_code = "not_found"


class PermissionDeniedException(CustomAPIException):
    """Exception raised when user lacks permission."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You do not have permission to perform this action."
    default_code = "permission_denied"


class ValidationException(CustomAPIException):
    """Exception raised for validation errors."""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Validation failed."
    default_code = "validation_error"


class ConflictException(CustomAPIException):
    """Exception raised for resource conflicts."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Resource conflict."
    default_code = "conflict"


class BusinessException(CustomAPIException):
    """Exception raised for business logic errors."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Business rule violation."
    default_code = "business_error"


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns standard response format.
    """
    import logging
    from django.conf import settings

    logger = logging.getLogger('django.request')

    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        detail = getattr(exc, "detail", None)
        if detail is None and isinstance(response.data, dict):
            detail = response.data.get("detail")
        if isinstance(detail, dict):
            message = "; ".join(
                f"{key}: {', '.join(str(e) for e in values) if isinstance(values, (list, tuple)) else values}"
                for key, values in detail.items()
            )
        elif isinstance(detail, (list, tuple)):
            message = "; ".join(str(d) for d in detail)
        else:
            message = str(detail) if detail is not None else str(exc)
        custom_response_data = {
            "success": False,
            "message": message,
            "data": None,
            "errors": response.data if isinstance(response.data, dict) else None
        }
        response.data = custom_response_data
    else:
        # Handle non-API exceptions
        logger.error("Unhandled exception in API request", exc_info=exc)
        custom_response_data = {
            "success": False,
            "message": "Internal server error",
            "data": None,
            "errors": str(exc) if settings.DEBUG else None
        }
        response = Response(
            custom_response_data,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response
