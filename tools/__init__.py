"""Compatibility package path for legacy ``tools.*`` imports.
The actual utility modules are organized under ``backend/tools``.
"""
from pathlib import Path as _Path
__path__ = [str(_Path(__file__).resolve().parents[1] / "backend" / "tools")]
