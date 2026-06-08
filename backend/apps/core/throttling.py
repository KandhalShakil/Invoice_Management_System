"""
Custom DRF throttle classes for enterprise-grade rate limiting.
Applied per-endpoint to control request frequency by user and IP.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Strict rate limit on the login endpoint to prevent brute-force attacks.
    Allows 10 attempts per minute per IP address.
    """
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    """
    Rate limit on registration to prevent automated account creation.
    Allows 5 registrations per hour per IP address.
    """
    scope = 'register'


class BurstRateThrottle(UserRateThrottle):
    """
    Short-window burst throttle for authenticated API endpoints.
    Allows 60 requests per minute per authenticated user.
    """
    scope = 'burst'


class SustainedRateThrottle(UserRateThrottle):
    """
    Long-window sustained throttle for authenticated API endpoints.
    Allows 1000 requests per day per authenticated user.
    """
    scope = 'sustained'
