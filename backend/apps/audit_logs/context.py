from contextvars import ContextVar

# ContextVars to hold the current request user, IP address, and user agent.
_current_user = ContextVar('audit_current_user', default=None)
_current_ip = ContextVar('audit_current_ip', default=None)
_current_ua = ContextVar('audit_current_ua', default=None)

def set_audit_context(user, ip, ua):
    tokens = (
        _current_user.set(user),
        _current_ip.set(ip),
        _current_ua.set(ua)
    )
    return tokens

def get_audit_context():
    return {
        'user': _current_user.get(),
        'ip': _current_ip.get(),
        'user_agent': _current_ua.get()
    }

def reset_audit_context(tokens):
    try:
        _current_user.reset(tokens[0])
    except ValueError:
        _current_user.set(None)
    try:
        _current_ip.reset(tokens[1])
    except ValueError:
        _current_ip.set(None)
    try:
        _current_ua.reset(tokens[2])
    except ValueError:
        _current_ua.set(None)
