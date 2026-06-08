"""
Standardized API exception handler for the enterprise invoice platform.
Wraps all DRF exceptions in a consistent JSON envelope:

{
  "error": "Human-readable message",
  "code": "machine_readable_code",
  "detail": {...}  // optional: field-level validation errors
}
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Override DRF's default exception handler to produce a standardized
    error envelope across all API endpoints.
    """
    # Call DRF's default handler first to get the standard error response
    response = exception_handler(exc, context)

    if response is not None:
        # Extract view/request info for logging
        view = context.get('view')
        request = context.get('request')

        # Log 5xx errors as errors, 4xx as warnings
        if response.status_code >= 500:
            logger.error(
                'API Error %s — %s %s: %s',
                response.status_code,
                getattr(request, 'method', 'UNKNOWN'),
                getattr(request, 'path', 'UNKNOWN'),
                exc,
                exc_info=True,
            )
        elif response.status_code >= 400:
            logger.warning(
                'API Warning %s — %s %s: %s',
                response.status_code,
                getattr(request, 'method', 'UNKNOWN'),
                getattr(request, 'path', 'UNKNOWN'),
                exc,
            )

        # Determine a user-friendly message
        original_data = response.data

        # Build normalized response
        normalized = {
            'error': _extract_message(original_data, response.status_code),
            'status_code': response.status_code,
        }

        # Include field-level validation errors if present
        if isinstance(original_data, dict) and any(
            isinstance(v, list) for v in original_data.values()
        ):
            normalized['detail'] = original_data

        response.data = normalized

    return response


def _extract_message(data, status_code: int) -> str:
    """
    Extract the most relevant human-readable message from DRF error data.
    """
    if isinstance(data, str):
        return data

    if isinstance(data, list) and data:
        first = data[0]
        return str(first) if not isinstance(first, dict) else 'Validation error occurred.'

    if isinstance(data, dict):
        # Priority: 'detail' > 'error' > 'message' > 'non_field_errors' > first field
        for key in ('detail', 'error', 'message', 'non_field_errors'):
            if key in data:
                val = data[key]
                if isinstance(val, list) and val:
                    return str(val[0])
                return str(val)

        # Fall through to first field error
        first_key = next(iter(data))
        first_val = data[first_key]
        if isinstance(first_val, list) and first_val:
            return f"{first_key}: {first_val[0]}"
        return str(first_val)

    # Fallback to generic message
    if status_code == 401:
        return 'Authentication credentials were not provided or are invalid.'
    if status_code == 403:
        return 'You do not have permission to perform this action.'
    if status_code == 404:
        return 'The requested resource was not found.'
    if status_code == 429:
        return 'Too many requests. Please slow down and try again later.'
    if status_code >= 500:
        return 'An internal server error occurred. Our team has been notified.'
    return 'An unexpected error occurred.'
