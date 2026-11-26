"""ASGI entry point for deployments that use backend.main:app."""
from .app import app

__all__ = ["app"]
