"""
Standard API Response wrapper.
"""
from rest_framework.response import Response
from rest_framework import status


class StandardResponse:
    """
    Standard API response format.
    {
        "success": true,
        "message": "...",
        "data": {},
        "errors": null
    }
    """

    @staticmethod
    def success(data=None, message="Success", status_code=status.HTTP_200_OK):
        """Return a success response."""
        return Response(
            {
                "success": True,
                "message": message,
                "data": data,
                "errors": None
            },
            status=status_code
        )

    @staticmethod
    def error(message="Error occurred", errors=None, status_code=status.HTTP_400_BAD_REQUEST):
        """Return an error response."""
        return Response(
            {
                "success": False,
                "message": message,
                "data": None,
                "errors": errors
            },
            status=status_code
        )

    @staticmethod
    def created(data=None, message="Resource created successfully"):
        """Return a created response."""
        return StandardResponse.success(data, message, status.HTTP_201_CREATED)

    @staticmethod
    def no_content(message="Resource deleted successfully"):
        """Return a success response for deletion (200 instead of 204 so JSON body is delivered)."""
        return StandardResponse.success(None, message, status.HTTP_200_OK)

    @staticmethod
    def not_found(message="Resource not found"):
        """Return a not found response."""
        return StandardResponse.error(message, None, status.HTTP_404_NOT_FOUND)

    @staticmethod
    def bad_request(message="Bad request", errors=None):
        """Return a bad request response."""
        return StandardResponse.error(message, errors, status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def unauthorized(message="Unauthorized access"):
        """Return an unauthorized response."""
        return StandardResponse.error(message, None, status.HTTP_401_UNAUTHORIZED)

    @staticmethod
    def forbidden(message="Access forbidden"):
        """Return a forbidden response."""
        return StandardResponse.error(message, None, status.HTTP_403_FORBIDDEN)

    @staticmethod
    def conflict(message="Resource conflict"):
        """Return a conflict response."""
        return StandardResponse.error(message, None, status.HTTP_409_CONFLICT)

    @staticmethod
    def validation_error(message="Validation failed", errors=None):
        """Return a validation error response."""
        return StandardResponse.error(message, errors, status.HTTP_422_UNPROCESSABLE_ENTITY)

    @staticmethod
    def server_error(message="Internal server error"):
        """Return a server error response."""
        return StandardResponse.error(message, None, status.HTTP_500_INTERNAL_SERVER_ERROR)
