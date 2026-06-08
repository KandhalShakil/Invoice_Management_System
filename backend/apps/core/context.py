from contextvars import ContextVar

# A thread-safe, async-safe ContextVar to hold the ID of the current active organization.
_current_organization_id = ContextVar('current_organization_id', default=None)

def set_current_organization_id(org_id):
    """Sets the organization ID for the current context."""
    return _current_organization_id.set(org_id)

def get_current_organization_id():
    """Gets the organization ID from the current context."""
    return _current_organization_id.get()

def reset_current_organization_id(token):
    """Resets the context to the state before set_current_organization_id was called."""
    try:
        _current_organization_id.reset(token)
    except ValueError:
        _current_organization_id.set(None)
