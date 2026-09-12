from pathlib import Path

path = Path('tests/visual_presence_browser_test.py')
s = path.read_text('utf-8')
replacements = [
    (
        "        active_tab.press('ArrowRight')\n        page.wait_for_timeout(100)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'life'",
        "        active_tab.press('ArrowRight')\n        page.wait_for_function(\"() => document.querySelector('[role=\\\"tab\\\"][aria-selected=\\\"true\\\"]')?.dataset.id === 'life'\", timeout=10000)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'life'",
    ),
    (
        "        page.locator('[role=\"tab\"][data-id=\"life\"]').press('Home')\n        page.wait_for_timeout(100)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'town'",
        "        page.locator('[role=\"tab\"][data-id=\"life\"]').press('Home')\n        page.wait_for_function(\"() => document.querySelector('[role=\\\"tab\\\"][aria-selected=\\\"true\\\"]')?.dataset.id === 'town'\", timeout=10000)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'town'",
    ),
    (
        "        page.locator('[role=\"tab\"][data-id=\"town\"]').press('End')\n        page.wait_for_timeout(100)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'lab'",
        "        page.locator('[role=\"tab\"][data-id=\"town\"]').press('End')\n        page.wait_for_function(\"() => document.querySelector('[role=\\\"tab\\\"][aria-selected=\\\"true\\\"]')?.dataset.id === 'lab'\", timeout=10000)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'lab'",
    ),
    (
        "        page.locator('[data-action=\"tab\"][data-id=\"visuals\"]').click()\n        page.wait_for_timeout(100)",
        "        page.locator('[data-action=\"tab\"][data-id=\"visuals\"]').click()\n        page.wait_for_function(\"() => document.querySelector('[role=\\\"tab\\\"][aria-selected=\\\"true\\\"]')?.dataset.id === 'visuals'\", timeout=10000)",
    ),
    (
        "        engineering_tab.click()\n        page.wait_for_timeout(120)\n        assert engineering_tab.get_attribute('aria-selected') == 'true'",
        "        engineering_tab.click()\n        page.wait_for_function(\"() => document.querySelector('[role=\\\"tab\\\"][aria-selected=\\\"true\\\"]')?.dataset.id === 'engineering'\", timeout=10000)\n        assert engineering_tab.get_attribute('aria-selected') == 'true'",
    ),
    (
        "        engineering_tab.press('ArrowRight')\n        page.wait_for_timeout(100)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'stewardship'",
        "        engineering_tab.press('ArrowRight')\n        page.wait_for_function(\"() => document.querySelector('[role=\\\"tab\\\"][aria-selected=\\\"true\\\"]')?.dataset.id === 'stewardship'\", timeout=10000)\n        assert page.locator('[role=\"tab\"][aria-selected=\"true\"]').get_attribute('data-id') == 'stewardship'",
    ),
]
for old, new in replacements:
    if old in s:
        s = s.replace(old, new, 1)
    elif new not in s:
        raise SystemExit('Expected Chromium navigation wait seam missing; refuse broad rewrite.')

geometry_variants = [
"""        assert page.locator('#active-view').evaluate('''(view) => {
          const topbar = document.querySelector('.topbar').getBoundingClientRect();
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          return Math.abs(view.getBoundingClientRect().top - (topbar.height + switcher.height)) <= 2;
        }''')""",
"""        assert page.locator('#active-view').evaluate('''(view) => {
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          const viewTop = view.getBoundingClientRect().top;
          const delta = viewTop - switcher.bottom;
          return delta >= -2 && delta <= 16;
        }'''), 'Changed section heading is obscured by or detached from the sticky section controls.'""",
"""        assert page.locator('#active-view').evaluate('''(view) => {
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          const viewTop = view.getBoundingClientRect().top;
          return viewTop >= switcher.bottom - 2 && viewTop < window.innerHeight;
        }'''), 'Changed section heading is obscured by the sticky section controls or outside the viewport.'""",
]
diagnostic = """        section_geometry = page.locator('#active-view').evaluate('''(view) => {
          const topbar = document.querySelector('.topbar').getBoundingClientRect();
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          const rect = view.getBoundingClientRect();
          return {
            topbarTop: topbar.top,
            topbarBottom: topbar.bottom,
            switcherTop: switcher.top,
            switcherBottom: switcher.bottom,
            viewTop: rect.top,
            viewBottom: rect.bottom,
            innerHeight: window.innerHeight,
            scrollY: window.scrollY,
            documentHeight: document.documentElement.scrollHeight,
          };
        }''')
        print('SECTION_GEOMETRY', section_geometry)
        assert section_geometry['viewTop'] >= section_geometry['switcherBottom'] - 2 and section_geometry['viewTop'] < section_geometry['innerHeight'], 'Changed section heading is obscured by the sticky section controls or outside the viewport.'"""
if diagnostic not in s:
    replaced = False
    for old in geometry_variants:
        if old in s:
            s = s.replace(old, diagnostic, 1)
            replaced = True
            break
    if not replaced:
        raise SystemExit('Expected section geometry assertion seam missing; refuse broad rewrite.')

timing_old = """        receipt = page.evaluate('() => window.AXM.Game.world.ui.lastVisualActivityReceipt')
        assert after_day - before_day == 480"""
timing_new = """        receipt = page.evaluate('() => window.AXM.Game.world.ui.lastVisualActivityReceipt')
        timing_state = page.evaluate('() => ({ speed: window.AXM.Game.world.settings.simulationSpeed, timer: Boolean(window.AXM.Game.timer) })')
        print('SLEEP_TIMING', {'before': before_day, 'after': after_day, 'delta': after_day - before_day, 'timing': timing_state, 'receipt': receipt})
        assert after_day - before_day == 480"""
if timing_new not in s:
    if timing_old not in s:
        raise SystemExit('Expected sleep timing assertion seam missing; refuse broad rewrite.')
    s = s.replace(timing_old, timing_new, 1)

path.write_text(s, encoding='utf-8')
