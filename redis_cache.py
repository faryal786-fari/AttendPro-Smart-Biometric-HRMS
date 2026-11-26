"""Compatibility import shim. The implementation lives in backend.redis_cache."""
import importlib as _importlib
import sys as _sys
_implementation = _importlib.import_module("backend.redis_cache")
_sys.modules[__name__] = _implementation
