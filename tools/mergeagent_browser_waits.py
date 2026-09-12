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
path.write_text(s, encoding='utf-8')
