"""Compatibility ASGI entry point. The implementation lives in backend.app."""
import importlib as _importlib
import sys as _sys
_implementation = _importlib.import_module("backend.app")
_sys.modules[__name__] = _implementation
