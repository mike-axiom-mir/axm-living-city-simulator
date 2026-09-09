#!/usr/bin/env python3
"""Build the no-dependency one-file AXM Living City prototype."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'

css = (ROOT / 'styles.css').read_text(encoding='utf-8')
scripts = []
for relative in [
    'src/core.js',
    'src/content.js',
    'src/world.js',
    'src/systems.js',
    'src/households.js',
    'src/habitats.js',
    'src/stewardship.js',
    'src/family.js',
    'src/community.js',
    'src/directions.js',
    'src/economy.js',
    'src/exteriors.js',
    'src/shells.js',
    'src/presence.js',
    'src/visuals.js',
    'src/game.js',
    'src/ui.js',
    'src/autosave_conflict_ui.js',
]:
    scripts.append(f"\n/* ===== {relative} ===== */\n" + (ROOT / relative).read_text(encoding='utf-8'))

html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#111821">
  <meta name="description" content="AXM Living City — one controlled life, autonomous residents, lawful lived presence, playable animated interiors, and reward-neutral room, building, and street visuals.">
  <title>AXM Living City — Interior Feedback v0.11.3</title>
  <style>\n{css}\n  </style>
</head>
<body>
  <div id="app" aria-live="polite"></div>
  <noscript>This local simulation requires JavaScript, but no network connection or external service.</noscript>
  <script>\n{''.join(scripts)}\n  </script>
</body>
</html>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding='utf-8')
print(f'Built {OUT} ({OUT.stat().st_size:,} bytes)')
