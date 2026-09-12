#!/usr/bin/env python3
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'


def active_id(page):
    return page.locator('[role="tab"][aria-selected="true"]').get_attribute('data-id')


def main():
    executable = os.environ.get('CHROMIUM_EXECUTABLE')
    if not executable:
        raise SystemExit('CHROMIUM_EXECUTABLE is required')
    html = HTML.read_text('utf-8')
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
        page.on('console', lambda message: errors.append(f'console: {message.text}') if message.type == 'error' else None)
        page.set_content(html, wait_until='load')
        page.wait_for_function("() => document.querySelectorAll('[role=\"tab\"]').length === 19", timeout=10000)

        assert page.locator('[role="tab"]').count() == 19
        assert page.locator('.view-position').get_attribute('aria-label') == 'Section 5 of 19'

        economy = page.locator('[role="tab"][data-id="economy"]')
        economy.click()
        page.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'economy'")
        economy.press('ArrowRight')
        page.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'engineering'")
        assert active_id(page) == 'engineering'
        assert page.locator('.view-position').get_attribute('aria-label') == 'Section 14 of 19'
        assert page.locator('#active-view').get_attribute('aria-labelledby') == 'tab-engineering'
        assert page.locator('[role="tab"][tabindex="0"]').count() == 1
        assert page.locator('#engineeringWorkshopCanvas').count() == 1

        page.locator('[role="tab"][data-id="engineering"]').press('ArrowRight')
        page.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'stewardship'")
        assert active_id(page) == 'stewardship'
        page.locator('[role="tab"][data-id="stewardship"]').press('ArrowLeft')
        page.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'engineering'")

        page.locator('[role="tab"][data-id="engineering"]').press('End')
        page.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'lab'")
        page.evaluate('() => window.scrollTo(0, document.documentElement.scrollHeight)')
        page.locator('[role="tab"][data-id="visuals"]').click()
        page.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'visuals'")
        geometry = page.locator('#active-view').evaluate('''(view) => {
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          const rect = view.getBoundingClientRect();
          return { switcherBottom: switcher.bottom, viewTop: rect.top, innerHeight: window.innerHeight };
        }''')
        assert geometry['viewTop'] >= geometry['switcherBottom'] - 2, geometry
        assert geometry['viewTop'] < geometry['innerHeight'], geometry

        mobile = browser.new_page(viewport={'width': 390, 'height': 844})
        mobile.on('pageerror', lambda error: errors.append(f'mobile pageerror: {error}'))
        mobile.on('console', lambda message: errors.append(f'mobile console: {message.text}') if message.type == 'error' else None)
        mobile.set_content(html, wait_until='load')
        mobile.wait_for_function("() => document.querySelectorAll('[role=\"tab\"]').length === 19", timeout=10000)
        assert mobile.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 1
        mobile.locator('[role="tab"][data-id="engineering"]').click()
        mobile.wait_for_function("() => document.querySelector('[role=\"tab\"][aria-selected=\"true\"]')?.dataset.id === 'engineering'")
        assert mobile.locator('.view-position').get_attribute('aria-label') == 'Section 14 of 19'
        assert mobile.locator('#engineeringWorkshopCanvas').count() == 1
        mobile.close()

        browser.close()
    if errors:
        raise AssertionError('\n'.join(errors))
    print('PASS Engineering navigation browser: 19 canonical sections, 14/19 receipt, keyboard routing, sticky visibility, mobile no-overflow')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
