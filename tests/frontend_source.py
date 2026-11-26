"""Helpers for static frontend regression tests after CSS/JS extraction."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def load_frontend_source():
    html = (FRONTEND / "index.html").read_text(encoding="utf-8")
    css = (FRONTEND / "src" / "styles" / "main.css").read_text(encoding="utf-8")
    app_js = (FRONTEND / "src" / "js" / "attendpro-app.js").read_text(encoding="utf-8")
    landing_js = (FRONTEND / "src" / "js" / "public-landing.js").read_text(encoding="utf-8")
    # Re-inline only for source-level assertions; production continues to load separate files.
    combined = html.replace("</head>", f"\n<style data-test-bundle>\n{css}\n</style>\n</head>")
    combined = combined.replace("</body>", f"\n<script data-test-bundle>\n{app_js}\n</script>\n<script data-test-bundle>\n{landing_js}\n</script>\n</body>")
    return html, css, app_js, landing_js, combined
