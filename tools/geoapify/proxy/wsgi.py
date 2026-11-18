"""Explicit TEST entry point. Missing guarded configuration prevents startup."""
import os
from .test_app import create_application
application=create_application(os.environ)
