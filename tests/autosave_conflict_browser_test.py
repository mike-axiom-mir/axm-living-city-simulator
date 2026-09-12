#!/usr/bin/env python3
"""Chromium evidence for the user-facing stale-autosave recovery loop."""
from pathlib import Path
import json
import os

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'
ARTIFACTS = ROOT / 'artifacts'
CURRENT_KEY = 'axm.living-city-sim.autosave.v0.11.3'


def chromium_path() -> str:
    configured = os.environ.get('CHROMIUM_EXECUTABLE')
    candidates = [
        configured,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise RuntimeError('No Chromium/Chrome executable found for browser evidence.')


def install_storage(page) -> None:
    page.evaluate(
        """() => {
          const values = new Map();
          const api = {
            get length() { return values.size; },
            key(index) { return Array.from(values.keys())[index] ?? null; },
            getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
            setItem(key, value) { values.set(String(key), String(value)); },
            removeItem(key) { values.delete(String(key)); },
            clear() { values.clear(); }
          };
          Object.defineProperty(window, 'localStorage', { configurable: true, value: api });
          window.__axmStorageTest = {
            setRaw(key, value) { values.set(String(key), String(value)); },
            getRaw(key) { return values.has(String(key)) ? values.get(String(key)) : null; }
          };
        }"""
    )


def create_conflict(page) -> str:
    page.locator('[data-action="tab"][data-id="lab"]').click()
    external = page.evaluate(
        """(key) => {
          const other = window.AXM.World.createWorld('AXM-OTHER-LOCAL-SESSION');
          const text = window.AXM.Core.serializeWorld(other);
          window.__axmStorageTest.setRaw(key, text);
          return text;
        }""",
        CURRENT_KEY,
    )
    page.locator('[data-action="developer-grant"]').click()
    page.wait_for_timeout(120)
    return external


def main() -> int:
    html = HTML.read_text(encoding='utf-8')
    ARTIFACTS.mkdir(exist_ok=True)
    page_errors: list[str] = []
    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=chromium_path(),
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )

        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        install_storage(page)
        page.set_content(html, wait_until='load')
        page.wait_for_timeout(250)

        assert page.locator('[data-autosave-conflict-panel]').count() == 0
        external = create_conflict(page)

        panel = page.locator('[data-autosave-conflict-panel]')
        assert panel.count() == 1
        assert 'This tab will not overwrite a newer local save.' in panel.inner_text()
        assert 'Nothing has been overwritten.' in panel.inner_text()
        assert page.evaluate('() => window.AXM.Game.autosaveConflict?.kind') == 'stale-storage'
        assert page.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CURRENT_KEY) == external

        with page.expect_download() as download_info:
            page.locator('[data-autosave-conflict-action="export"]').click()
        download = download_info.value
        assert download.suggested_filename.endswith('.json')
        exported = json.loads(Path(download.path()).read_text(encoding='utf-8'))
        assert exported['seed'] == 'AXM-LIVING-CITY-001'

        page.locator('[data-autosave-conflict-action="disable-autosave"]').click()
        page.wait_for_timeout(80)
        assert page.evaluate('() => window.AXM.Game.world.settings.autosave') is False
        assert 'Autosave is off' in page.locator('[data-autosave-conflict-panel]').inner_text()
        assert page.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CURRENT_KEY) == external
        assert page.evaluate('() => document.documentElement.scrollWidth <= window.innerWidth') is True
        page.screenshot(path=str(ARTIFACTS / 'autosave-conflict-desktop.png'), full_page=True)

        mobile = browser.new_page(viewport={'width': 390, 'height': 844})
        mobile.on('pageerror', lambda error: page_errors.append(str(error)))
        mobile.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        install_storage(mobile)
        mobile.set_content(html, wait_until='load')
        mobile.wait_for_timeout(250)
        create_conflict(mobile)
        assert mobile.locator('[data-autosave-conflict-panel]').count() == 1
        assert mobile.evaluate('() => document.documentElement.scrollWidth <= window.innerWidth') is True
        mobile.locator('[data-autosave-conflict-action="open-save-tools"]').click()
        assert mobile.locator('[data-action="tab"][data-id="lab"]').count() == 1
        mobile.screenshot(path=str(ARTIFACTS / 'autosave-conflict-mobile.png'), full_page=True)

        browser.close()

    assert not page_errors, f'page errors: {page_errors}'
    assert not console_errors, f'console errors: {console_errors}'
    print('PASS Chromium stale-autosave conflict recovery loop')
    print('PASS desktop 1440x1000 and mobile 390x844 have no horizontal overflow')
    print('PASS external local-save bytes remain unchanged after conflict, export, and autosave-off choice')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
