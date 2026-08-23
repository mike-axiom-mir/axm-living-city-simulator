#!/usr/bin/env python3
"""Targeted browser QA for AXM Living City v0.11 inherited building shells."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'
OUTPUT = ROOT / 'tests' / 'output_v0_11_targeted'
CHROMIUM = os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium')


def load_page(browser, html, viewport, errors):
    page = browser.new_page(viewport=viewport)
    page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
    page.on('console', lambda message: errors.append(f'console: {message.text}') if message.type == 'error' else None)
    page.set_content(html, wait_until='load')
    page.wait_for_timeout(300)
    return page


def main() -> int:
    html = HTML.read_text(encoding='utf-8')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROMIUM, args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = load_page(browser, html, {'width': 1440, 'height': 1000}, errors)
        assert page.locator('.tab-button').count() == 18
        page.locator('[data-action="tab"][data-id="buildings"]').click()
        page.wait_for_timeout(150)
        assert page.locator('text=Buildings that connect street, shell, storey, and interior').count() == 1
        assert page.locator('.building-index-card').count() >= 20
        assert page.locator('.shell-storey').count() >= 1
        page.locator('[data-action="select-building"][data-id="building_courtyard_walkup"]').click()
        page.wait_for_timeout(100)
        assert page.locator('text=Courtyard Walk-up').count() >= 1
        assert page.locator('.shell-storey').count() == 2
        assert page.locator('text=1 stair link').count() == 1
        assert page.locator('text=No façade chores').count() == 1
        page.screenshot(path=str(OUTPUT / 'building_shells_desktop.png'), full_page=False, animations='disabled')

        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="prepare-shell-experiment"]').click()
        page.wait_for_timeout(150)
        assert page.locator('[data-action="respond-frontage"][data-response="approve"]').count() == 1
        before = page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const proposal = world.frontageProposals.find((entry) => entry.status === 'awaiting_player');
          return {
            proposalId: proposal.id,
            placeId: proposal.placeId,
            authorId: proposal.authorId,
            frontage: JSON.stringify(window.AXM.Shells.frontageForPlace(world, proposal.placeId)),
            relation: JSON.stringify(world.player.relationships[proposal.authorId] || null)
          };
        }''')
        page.locator('[data-action="respond-frontage"][data-response="approve"]').click()
        page.wait_for_timeout(120)
        approved = page.evaluate('''(proposalId) => {
          const world = window.AXM.Game.world;
          const proposal = window.AXM.Shells.proposalById(world, proposalId);
          return {
            status: proposal.status,
            projectId: proposal.projectId,
            frontage: JSON.stringify(window.AXM.Shells.frontageForPlace(world, proposal.placeId))
          };
        }''', before['proposalId'])
        assert approved['status'] == 'project_created'
        assert approved['projectId']
        assert approved['frontage'] == before['frontage'], 'Approval changed the frontage instantly.'

        for _ in range(40):
            state = page.evaluate('''(projectId) => window.AXM.Shells.projectById(window.AXM.Game.world, projectId).status''', approved['projectId'])
            if state == 'completed':
                break
            button = page.locator(f'[data-action="advance-frontage-project"][data-id="{approved["projectId"]}"]')
            assert button.count() == 1
            button.click()
            page.wait_for_timeout(45)
        final = page.evaluate('''({projectId, placeId, authorId}) => {
          const world = window.AXM.Game.world;
          return {
            status: window.AXM.Shells.projectById(world, projectId).status,
            windowBoxes: window.AXM.Shells.frontageForPlace(world, placeId).windowBoxes,
            relation: JSON.stringify(world.player.relationships[authorId] || null),
            valid: window.AXM.Systems.validateWorld(world)
          };
        }''', {'projectId': approved['projectId'], 'placeId': before['placeId'], 'authorId': before['authorId']})
        assert final['status'] == 'completed'
        assert final['windowBoxes'] is True
        assert final['relation'] == before['relation']
        assert final['valid']['ok'] is True, '\n'.join(final['valid']['errors'][:10])
        assert page.locator('text=No façade chores').count() == 1
        page.screenshot(path=str(OUTPUT / 'resident_frontage_completed_desktop.png'), full_page=False, animations='disabled')

        mobile = load_page(browser, html, {'width': 412, 'height': 915}, errors)
        mobile.locator('[data-action="tab"][data-id="buildings"]').click()
        mobile.wait_for_timeout(120)
        overflow = mobile.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert overflow <= 1, f'Mobile horizontal overflow: {overflow}px'
        assert mobile.locator('.building-index-card').count() >= 20
        mobile.screenshot(path=str(OUTPUT / 'building_shells_mobile.png'), full_page=False, animations='disabled')
        mobile.close()
        page.close()
        browser.close()

    assert not errors, '\n'.join(errors)
    print('PASS building-shell browser QA under v0.11: 18 views, two-storey shell, request, approval, phased completion, mobile overflow 0')
    print(f'Captured 3 screenshots in {OUTPUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
