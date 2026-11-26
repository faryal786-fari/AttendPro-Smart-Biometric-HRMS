"""Compatibility import shim. The implementation lives in backend.cloud_projection."""
import importlib as _importlib
import sys as _sys
_implementation = _importlib.import_module("backend.cloud_projection")
_sys.modules[__name__] = _implementation
