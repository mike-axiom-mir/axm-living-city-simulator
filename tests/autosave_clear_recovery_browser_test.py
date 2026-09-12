#!/usr/bin/env python3
"""Chromium evidence for fail-closed autosave-clear recovery states."""
from pathlib import Path
import json
import os

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'
ARTIFACTS = ROOT / 'artifacts'
CURRENT_KEY = 'axm.living-city-sim.autosave.v0.11.3'
LEGACY_KEY = 'axm.living-city-sim.autosave.v0.11.2'
CLEAR_KEY = 'axm.living-city-sim.autosave.clear-transaction.v1'
CLEAR_MARKER = 'axm.living-city.autosave-clear-transaction/v1:DELETE_INTENT'


def chromium_path() -> str:
    configured = os.environ.get('CHROMIUM_EXECUTABLE')
    for candidate in [configured, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']:
        if candidate and Path(candidate).exists():
            return candidate
    raise RuntimeError('No Chromium/Chrome executable found for browser evidence.')


def install_storage(page, entries=None, fail_remove=None) -> None:
    page.evaluate(
        """({ entries, failRemove }) => {
          const values = new Map(Object.entries(entries || {}));
          let removeFault = failRemove || null;
          const api = {
            get length() { return values.size; },
            key(index) { return Array.from(values.keys())[index] ?? null; },
            getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
            setItem(key, value) { values.set(String(key), String(value)); },
            removeItem(key) {
              key = String(key);
              if (removeFault && key === removeFault) throw new Error('injected remove failure for ' + key);
              values.delete(key);
            },
            clear() { values.clear(); }
          };
          Object.defineProperty(window, 'localStorage', { configurable: true, value: api });
          window.__axmStorageTest = {
            getRaw(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
            failRemove(key) { removeFault = key || null; }
          };
        }""",
        {'entries': entries or {}, 'failRemove': fail_remove},
    )


def main() -> int:
    html = HTML.read_text(encoding='utf-8')
    ARTIFACTS.mkdir(exist_ok=True)
    page_errors: list[str] = []
    console_errors: list[str] = []
    evidence = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=chromium_path(),
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )

        bootstrap = browser.new_page(viewport={'width': 900, 'height': 700})
        install_storage(bootstrap)
        bootstrap.set_content(html, wait_until='load')
        bootstrap.wait_for_timeout(180)
        stored = bootstrap.evaluate("() => window.AXM.Core.serializeWorld(window.AXM.World.createWorld('AXM-STORED-BEFORE-CLEAR'))")
        bootstrap.close()

        desktop = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        desktop.on('pageerror', lambda error: page_errors.append(str(error)))
        desktop.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        install_storage(desktop, {CURRENT_KEY: stored, CLEAR_KEY: 'unexpected-marker-v999'})
        desktop.set_content(html, wait_until='load')
        desktop.wait_for_timeout(250)

        panel = desktop.locator('[data-autosave-clear-recovery-panel]')
        assert panel.count() == 1
        text = panel.inner_text()
        assert 'Local save cleanup needs review.' in text
        assert 'did not load, delete, or overwrite' in text
        assert 'IN-MEMORY FALLBACK' in text
        assert desktop.evaluate('() => window.AXM.Game.autosaveConflict?.kind') == 'clear-transaction-held'
        assert desktop.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CURRENT_KEY) == stored
        assert desktop.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CLEAR_KEY) == 'unexpected-marker-v999'

        with desktop.expect_download() as export_info:
            desktop.locator('[data-autosave-clear-recovery-action="export"]').click()
        exported = json.loads(Path(export_info.value.path()).read_text(encoding='utf-8'))
        assert exported['seed'] == 'AXM-LIVING-CITY-001'

        with desktop.expect_download() as diagnostic_info:
            desktop.locator('[data-autosave-clear-recovery-action="diagnostic"]').click()
        diagnostic = json.loads(Path(diagnostic_info.value.path()).read_text(encoding='utf-8'))
        assert diagnostic['kind'] == 'clear-transaction-held'
        assert diagnostic['claims']['storedSaveLoaded'] is False
        assert diagnostic['claims']['storageRepaired'] is False

        desktop.locator('[data-autosave-clear-recovery-action="disable-autosave"]').click()
        desktop.wait_for_timeout(80)
        assert desktop.evaluate('() => window.AXM.Game.world.settings.autosave') is False
        assert desktop.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CURRENT_KEY) == stored
        assert desktop.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CLEAR_KEY) == 'unexpected-marker-v999'
        desktop_metrics = desktop.evaluate('() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth })')
        assert desktop_metrics['scroll'] <= desktop_metrics['viewport']
        desktop.screenshot(path=str(ARTIFACTS / 'autosave-clear-held-desktop.png'), full_page=True)

        mobile = browser.new_page(viewport={'width': 390, 'height': 844})
        mobile.on('pageerror', lambda error: page_errors.append(str(error)))
        mobile.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        install_storage(
            mobile,
            {CURRENT_KEY: stored, LEGACY_KEY: stored, CLEAR_KEY: CLEAR_MARKER},
            fail_remove=LEGACY_KEY,
        )
        mobile.set_content(html, wait_until='load')
        mobile.wait_for_timeout(250)

        mobile_panel = mobile.locator('[data-autosave-clear-recovery-panel]')
        assert mobile_panel.count() == 1
        assert 'Interrupted local save cleanup can be retried.' in mobile_panel.inner_text()
        assert mobile.evaluate('() => window.AXM.Game.autosaveConflict?.kind') == 'clear-transaction-pending'
        assert mobile.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CURRENT_KEY) == stored
        assert mobile.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CLEAR_KEY) == CLEAR_MARKER
        mobile_metrics = mobile.evaluate('() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth })')
        assert mobile_metrics['scroll'] <= mobile_metrics['viewport']
        mobile.screenshot(path=str(ARTIFACTS / 'autosave-clear-pending-mobile.png'), full_page=True)

        mobile.evaluate('() => window.__axmStorageTest.failRemove(null)')
        mobile.locator('[data-autosave-clear-recovery-action="retry"]').click()
        mobile.wait_for_timeout(100)
        assert mobile.locator('[data-autosave-clear-recovery-panel]').count() == 0
        assert mobile.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CURRENT_KEY) is None
        assert mobile.evaluate('(key) => window.__axmStorageTest.getRaw(key)', LEGACY_KEY) is None
        assert mobile.evaluate('(key) => window.__axmStorageTest.getRaw(key)', CLEAR_KEY) is None
        assert mobile.evaluate('() => window.AXM.Game.autosaveConflict') is None

        evidence = {
            'schema': 'axm.living-city.autosave-clear-recovery-browser-evidence/v1',
            'held': {
                'conflictKind': 'clear-transaction-held',
                'storedBytesPreserved': True,
                'markerPreserved': True,
                'exportedFallbackSeed': exported['seed'],
                'diagnosticObservationOnly': diagnostic['observationOnly'],
                'desktopViewport': desktop_metrics,
            },
            'pending': {
                'conflictKind': 'clear-transaction-pending',
                'beforeRetryStoredBytesPreserved': True,
                'retryClearedCurrentLegacyAndIntent': True,
                'mobileViewport': mobile_metrics,
            },
            'pageErrors': page_errors,
            'consoleErrors': console_errors,
        }
        browser.close()

    assert not page_errors, f'page errors: {page_errors}'
    assert not console_errors, f'console errors: {console_errors}'
    (ARTIFACTS / 'autosave-clear-recovery-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    print('PASS Chromium held cleanup state preserves unknown marker and stored save bytes')
    print('PASS explicit export/diagnostic/autosave-off actions leave held storage untouched')
    print('PASS interrupted admitted cleanup can be retried and clears only the existing transaction set')
    print('PASS desktop 1440x1000 and mobile 390x844 have no horizontal overflow')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
