#!/usr/bin/env python3
"""Browser QA for the v0.11.3 interior-feedback layer."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'
OUTPUT = ROOT / 'tests' / 'output_v0_11_3_visuals'
CHROMIUM = os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium')


def canvas_digest(page) -> str:
    return page.locator('#livingCanvas').evaluate('(canvas) => canvas.toDataURL("image/png")')


def main() -> int:
    html = HTML.read_text(encoding='utf-8')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROMIUM,
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
        page.on('console', lambda message: errors.append(f'console: {message.text}') if message.type == 'error' else None)
        page.set_content(html, wait_until='load')
        page.wait_for_function("() => document.querySelectorAll('.tab-button').length === 19", timeout=10000)

        assert page.locator('.tab-button').count() == 19
        page.locator('[data-action="tab"][data-id="visuals"]').click()
        page.wait_for_timeout(180)
        assert page.locator('#livingCanvas').count() == 1
        assert page.locator('text=Start inside a room, look around, and choose what feels worth doing').count() == 1
        assert page.locator('text=Truth boundary intact').count() == 1
        assert page.locator('text=Playable room choices').count() >= 1
        assert page.locator('[data-action="visual-room"]').count() >= 3
        assert page.locator('[data-action="visual-activity"]').count() >= 1

        # The 18-view rail is one roving tab stop, supports standard tab keys,
        # and keeps its focus through deterministic simulation rerenders.
        active_tab = page.locator('[role="tab"][aria-selected="true"]')
        assert active_tab.get_attribute('data-id') == 'visuals'
        active_tab.press('ArrowRight')
        page.wait_for_timeout(100)
        assert page.locator('[role="tab"][aria-selected="true"]').get_attribute('data-id') == 'life'
        assert page.evaluate('() => document.activeElement?.dataset?.id') == 'life'
        page.locator('[data-action="speed"][data-value="24"]').click()
        page.wait_for_timeout(980)
        assert page.evaluate('() => document.activeElement?.dataset?.value') == '24'
        page.locator('[data-action="speed"][data-value="0"]').click()
        page.locator('[role="tab"][data-id="life"]').press('Home')
        page.wait_for_timeout(100)
        assert page.locator('[role="tab"][aria-selected="true"]').get_attribute('data-id') == 'town'
        page.locator('[role="tab"][data-id="town"]').press('End')
        page.wait_for_timeout(100)
        assert page.locator('[role="tab"][aria-selected="true"]').get_attribute('data-id') == 'lab'
        page.evaluate('() => window.scrollTo(0, document.documentElement.scrollHeight)')
        page.locator('[data-action="tab"][data-id="visuals"]').click()
        page.wait_for_timeout(100)
        assert page.locator('#active-view').evaluate('''(view) => {
          const topbar = document.querySelector('.topbar').getBoundingClientRect();
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          return Math.abs(view.getBoundingClientRect().top - (topbar.height + switcher.height)) <= 2;
        }''')

        engineering_tab = page.locator('[role="tab"][data-id="engineering"]')
        engineering_tab.click()
        page.wait_for_timeout(120)
        assert engineering_tab.get_attribute('aria-selected') == 'true'
        assert page.locator('#active-view').get_attribute('aria-labelledby') == 'tab-engineering'
        assert page.locator('.view-position').get_attribute('aria-label') == 'Section 14 of 19'
        assert page.locator('[role="tab"][tabindex="0"]').count() == 1
        engineering_tab.press('ArrowRight')
        page.wait_for_timeout(100)
        assert page.locator('[role="tab"][aria-selected="true"]').get_attribute('data-id') == 'stewardship'
        page.locator('[role="tab"][data-id="visuals"]').click()
        page.wait_for_timeout(100)

        before_world = page.evaluate('() => JSON.stringify(window.AXM.Game.world)')
        frame_one = canvas_digest(page)
        page.wait_for_timeout(520)
        frame_two = canvas_digest(page)
        after_world = page.evaluate('() => JSON.stringify(window.AXM.Game.world)')
        assert frame_one != frame_two, 'Full-motion canvas did not visibly advance.'
        assert before_world == after_world, 'Animation loop mutated authoritative world state.'
        page.screenshot(path=str(OUTPUT / 'living_view_room_desktop.png'), full_page=False)

        sleep_action = page.locator('[data-action="visual-activity"][data-id="sleep"]')
        sleep_rooms = page.locator('[data-action="visual-room"]')
        lawful_sleep_room_found = False
        for room_index in range(sleep_rooms.count()):
            candidate = sleep_rooms.nth(room_index)
            candidate.click()
            page.wait_for_timeout(80)
            if sleep_action.count() == 1:
                lawful_sleep_room_found = True
                break
        assert lawful_sleep_room_found, 'No lawful room/object combination exposed the grounded Sleep action.'
        assert sleep_action.count() == 1
        before_day = page.evaluate('() => window.AXM.Game.world.time.day * 1440 + window.AXM.Game.world.time.hour * 60 + window.AXM.Game.world.time.minute')
        sleep_action.click()
        page.wait_for_timeout(180)
        after_day = page.evaluate('() => window.AXM.Game.world.time.day * 1440 + window.AXM.Game.world.time.hour * 60 + window.AXM.Game.world.time.minute')
        receipt = page.evaluate('() => window.AXM.Game.world.ui.lastVisualActivityReceipt')
        assert after_day - before_day == 480
        assert receipt['actionId'] == 'sleep'
        assert receipt['source'] == 'completed_activity'
        assert receipt['noExtraReward'] is True
        assert receipt['observedEffects']['effectsObserved'] is True
        assert receipt['observedEffects']['timeMinutes'] == 480
        assert page.locator('.living-stage-overlay > span', has_text='COMPLETED MOMENT ECHO').count() == 1
        assert page.get_by_role('heading', name='What actually changed', exact=True).count() == 1
        assert page.locator('.visual-effect-card .pill', has_text='Factual receipt').count() == 1
        assert page.locator('[data-action="visual-open-object"]').count() == 1
        page.screenshot(path=str(OUTPUT / 'living_view_completed_moment.png'), full_page=False)

        for mode in ['room', 'building', 'street']:
            page.locator(f'[data-action="visual-scene"][data-id="{mode}"]').click()
            page.wait_for_timeout(160)
            scene_kind = page.evaluate('() => window.AXM.Visuals.sceneFor(window.AXM.Game.world).kind')
            assert scene_kind == mode
            valid = page.evaluate('() => window.AXM.Visuals.validateScene(window.AXM.Visuals.sceneFor(window.AXM.Game.world))')
            assert valid['ok'] is True, '\n'.join(valid['errors'])
        page.screenshot(path=str(OUTPUT / 'living_view_street_desktop.png'), full_page=False)

        page.locator('[data-action="visual-motion"][data-id="still"]').click()
        page.wait_for_timeout(120)
        still_one = canvas_digest(page)
        page.wait_for_timeout(360)
        still_two = canvas_digest(page)
        assert still_one == still_two, 'Still mode continued to animate.'
        still_state = page.evaluate('''() => ({
          level: window.AXM.Visuals.motionLevel(window.AXM.Game.world, false),
          reduced: window.AXM.Game.world.settings.reducedMotion,
          reward: window.AXM.Game.world.settings.presenceWatchingReward
        })''')
        assert still_state == {'level': 'still', 'reduced': True, 'reward': False}

        mobile = browser.new_page(viewport={'width': 412, 'height': 915})
        mobile.on('pageerror', lambda error: errors.append(f'mobile pageerror: {error}'))
        mobile.on('console', lambda message: errors.append(f'mobile console: {message.text}') if message.type == 'error' else None)
        mobile.set_content(html, wait_until='load')
        mobile.wait_for_timeout(260)
        mobile.locator('[data-action="tab"][data-id="visuals"]').click()
        mobile.wait_for_timeout(180)
        overflow = mobile.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert overflow <= 1, f'Mobile horizontal overflow: {overflow}px'
        assert mobile.locator('#livingCanvas').count() == 1
        activity_card = mobile.locator('.visual-activity-card')
        stage_card = mobile.locator('.living-stage-card')
        assert activity_card.bounding_box()['y'] < stage_card.bounding_box()['y']
        first_action_box = activity_card.locator('[data-action="visual-activity"]').first.bounding_box()
        assert first_action_box['y'] + first_action_box['height'] <= 915
        assert activity_card.locator('.visual-action-pulse').get_attribute('aria-live') == 'polite'
        assert mobile.locator('.toast').count() == 0, 'NPC setup leaked into the player notification channel.'
        mobile.screenshot(path=str(OUTPUT / 'living_view_mobile.png'), full_page=False)
        mobile.close()

        reduced = browser.new_page(viewport={'width': 1280, 'height': 900})
        reduced.emulate_media(reduced_motion='reduce')
        reduced.set_content(html, wait_until='load')
        reduced.wait_for_timeout(240)
        reduced.locator('[data-action="tab"][data-id="visuals"]').click()
        reduced.wait_for_timeout(180)
        reduced_one = canvas_digest(reduced)
        reduced.wait_for_timeout(360)
        reduced_two = canvas_digest(reduced)
        assert reduced_one == reduced_two, 'Device reduced-motion preference was not honored.'
        reduced.close()
        page.close()
        browser.close()

    assert not errors, '\n'.join(errors)
    print('PASS interior-feedback browser QA: room play resolves real time with factual effect feedback, receipt is grounded, motion advances without mutation, still/device-reduced modes freeze, 19 views including Engineering, mobile overflow 0')
    print(f'Captured 4 temporary visual QA screenshots in {OUTPUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
