#!/usr/bin/env python3
"""Targeted browser QA for AXM Living City v0.11 lived buildings."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'
OUTPUT = ROOT / 'tests' / 'output_v0_11_targeted'
CHROMIUM = os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium')


def load_page(browser, html: str, viewport: dict[str, int], errors: list[str]):
    page = browser.new_page(viewport=viewport)
    page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
    page.on('console', lambda message: errors.append(f'console: {message.text}') if message.type == 'error' else None)
    page.set_content(html, wait_until='load')
    page.wait_for_timeout(350)
    return page


def main() -> int:
    html = HTML.read_text(encoding='utf-8')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROMIUM, args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = load_page(browser, html, {'width': 1440, 'height': 1000}, errors)
        assert page.locator('.tab-button').count() == 18
        page.locator('[data-action="tab"][data-id="presence"]').click()
        page.wait_for_timeout(150)
        assert page.locator('text=Lived buildings and ordinary presence').count() == 1
        assert page.locator('text=No social checklist').count() >= 1
        assert page.locator('text=Private rooms').count() >= 1
        assert page.locator('[data-action="prepare-presence-experiment"]').count() == 1
        page.screenshot(path=str(OUTPUT / 'lived_buildings_foundation_desktop.png'), full_page=False, animations='disabled')

        page.locator('[data-action="prepare-presence-experiment"]').click()
        page.wait_for_timeout(150)
        setup = page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const current = window.AXM.Presence.presenceFor(world, 'player');
          const access = window.AXM.Presence.accessFor(world, 'player', current.placeId);
          return { kind: current.kind, placeId: current.placeId, basis: access.basis, valid: window.AXM.Systems.validateWorld(world) };
        }''')
        assert setup['kind'] == 'street_threshold'
        assert setup['placeId'] == 'home_rooftop'
        assert setup['basis'] == 'accepted_presence_grant'
        assert setup['valid']['ok'] is True
        assert page.locator('[data-action="start-indoor-arrival"][data-mode="visible"]').count() == 1
        page.locator('[data-action="start-indoor-arrival"][data-mode="visible"]').click()
        page.wait_for_timeout(100)
        assert page.locator('[data-action="step-indoor-movement"]').count() == 1

        # Ground landing, then upper landing through the actual stair edge.
        page.locator('[data-action="step-indoor-movement"]').click()
        page.wait_for_timeout(80)
        page.locator('[data-action="step-indoor-movement"]').click()
        page.wait_for_timeout(120)
        assert page.locator('[data-action="respond-presence-encounter"][data-response="decline"]').count() == 1
        protected_before = page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const encounter = window.AXM.Presence.openEncounter(world);
          const other = encounter.actorIds.find((id) => id !== 'player');
          return {
            encounterId: encounter.id,
            other,
            money: world.player.money,
            needs: JSON.stringify(world.player.needs),
            time: JSON.stringify(world.time),
            relation: JSON.stringify(window.AXM.Systems.getRelation(world.player, other)),
            home: world.player.homePropertyId,
            owned: JSON.stringify(world.player.ownedPropertyIds),
            presence: window.AXM.Presence.presenceFor(world, 'player')
          };
        }''')
        assert protected_before['presence']['kind'] == 'building_route'
        assert protected_before['presence']['level'] == 1
        page.screenshot(path=str(OUTPUT / 'shared_landing_encounter_desktop.png'), full_page=False, animations='disabled')
        page.locator('[data-action="respond-presence-encounter"][data-response="decline"]').click()
        page.wait_for_timeout(100)
        protected_after = page.evaluate('''({encounterId, other}) => {
          const world = window.AXM.Game.world;
          return {
            status: window.AXM.Presence.encounterById(world, encounterId).status,
            money: world.player.money,
            needs: JSON.stringify(world.player.needs),
            time: JSON.stringify(world.time),
            relation: JSON.stringify(window.AXM.Systems.getRelation(world.player, other)),
            home: world.player.homePropertyId,
            owned: JSON.stringify(world.player.ownedPropertyIds)
          };
        }''', {'encounterId': protected_before['encounterId'], 'other': protected_before['other']})
        assert protected_after['status'] == 'declined'
        for key in ['money', 'needs', 'time', 'relation', 'home', 'owned']:
            assert protected_after[key] == protected_before[key], f'Decline changed protected field {key}'

        page.locator('[data-action="finish-indoor-movement"]').click()
        page.wait_for_timeout(120)
        final = page.evaluate('''() => {
          const world = window.AXM.Game.world;
          return {
            presence: window.AXM.Presence.presenceFor(world, 'player'),
            stairUses: world.metrics.indoorStairUses,
            valid: window.AXM.Systems.validateWorld(world),
            settings: world.settings
          };
        }''')
        assert final['presence']['kind'] == 'room'
        assert final['presence']['placeId'] == 'home_rooftop'
        assert final['presence']['level'] == 1
        assert final['stairUses'] >= 1
        assert final['valid']['ok'] is True, '\n'.join(final['valid']['errors'][:10])
        assert final['settings']['compulsoryGreetings'] is False
        assert final['settings']['remotePrivateRoomVisibility'] is False
        assert final['settings']['presenceViewCreatesRewards'] is False

        mobile = load_page(browser, html, {'width': 412, 'height': 915}, errors)
        mobile.locator('[data-action="tab"][data-id="presence"]').click()
        mobile.wait_for_timeout(150)
        overflow = mobile.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert overflow <= 1, f'Mobile horizontal overflow: {overflow}px'
        assert mobile.locator('text=Lived buildings and ordinary presence').count() == 1
        mobile.screenshot(path=str(OUTPUT / 'lived_buildings_mobile.png'), full_page=False, animations='disabled')
        mobile.close()
        page.close()
        browser.close()

    assert not errors, '\n'.join(errors)
    print('PASS lived-building browser QA: 18 views, real stairs, refusal-safe encounter, compressed remainder, mobile overflow 0')
    print(f'Captured 3 screenshots in {OUTPUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
