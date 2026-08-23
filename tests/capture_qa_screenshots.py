#!/usr/bin/env python3
"""Capture deterministic desktop/mobile QA screenshots of the built standalone HTML.

The suite can run as one local command or as isolated groups. Grouping exists so
resource-constrained sandboxes can preserve the inherited interface evidence set plus lived-building presence evidence under v0.11 without
counting a partially interrupted aggregate run.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Callable

from playwright.sync_api import Browser, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tests" / "output_v0_11_screenshots"
HTML = ROOT / "standalone" / "AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html"
CHROMIUM = os.environ.get("CHROMIUM_EXECUTABLE", "/usr/bin/chromium")

EXPECTED = [
    "town_desktop.png",
    "home_desktop.png",
    "construction_planned_desktop.png",
    "construction_completed_desktop.png",
    "resident_interior_desktop.png",
    "stewardship_request_desktop.png",
    "stewardship_approved_saving_desktop.png",
    "stewardship_completed_desktop.png",
    "agreements_before_commitment_desktop.png",
    "commitment_pending_desktop.png",
    "agreements_active_separate_desktop.png",
    "agreements_cohabiting_desktop.png",
    "shared_home_room_permissions_desktop.png",
    "agreements_ended_desktop.png",
    "family_onboarding_desktop.png",
    "family_active_desktop.png",
    "family_dependent_agency_desktop.png",
    "family_incoming_proposal_desktop.png",
    "family_young_adult_transition_desktop.png",
    "community_onboarding_desktop.png",
    "community_freedom_loop_desktop.png",
    "community_invitation_desktop.png",
    "community_refusal_preserved_desktop.png",
    "directions_onboarding_desktop.png",
    "directions_active_project_desktop.png",
    "directions_no_age_pressure_desktop.png",
    "directions_project_crosses_chapter_desktop.png",
    "directions_paused_desktop.png",
    "economy_onboarding_desktop.png",
    "economy_active_direction_desktop.png",
    "economy_actual_customers_desktop.png",
    "economy_entered_session_desktop.png",
    "walkable_route_planner_desktop.png",
    "walkable_visible_route_desktop.png",
    "walkable_street_moment_desktop.png",
    "presence_onboarding_desktop.png",
    "presence_upper_walkup_route_desktop.png",
    "presence_refusal_preserved_desktop.png",
    "presence_inside_room_desktop.png",
    "town_mobile.png",
    "home_mobile.png",
    "stewardship_request_mobile.png",
    "agreements_active_mobile.png",
    "family_active_mobile.png",
    "family_dependent_agency_mobile.png",
    "family_incoming_proposal_mobile.png",
    "community_freedom_loop_mobile.png",
    "community_adventure_mobile.png",
    "directions_onboarding_mobile.png",
    "directions_active_project_mobile.png",
    "directions_life_context_mobile.png",
    "economy_onboarding_mobile.png",
    "economy_active_direction_mobile.png",
    "walkable_route_planner_mobile.png",
    "walkable_visible_route_mobile.png",
    "presence_onboarding_mobile.png",
    "presence_upper_walkup_mobile.png",
    "presence_encounter_mobile.png",
]

GROUPS = [
    "desktop-core",
    "desktop-family",
    "desktop-community",
    "desktop-directions",
    "desktop-economy",
    "desktop-walkable",
    "desktop-presence",
    "mobile-core",
    "mobile-family",
    "mobile-community",
    "mobile-directions",
    "mobile-economy",
    "mobile-walkable",
    "mobile-presence",
]


def load_page(browser: Browser, html: str, viewport: dict[str, int], errors: list[str]) -> Page:
    page = browser.new_page(viewport=viewport)
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.on(
        "console",
        lambda message: errors.append(f"console: {message.text}")
        if message.type == "error"
        else None,
    )
    page.set_content(html, wait_until="load")
    page.wait_for_timeout(250)
    return page


def close_toast(page: Page) -> None:
    close = page.locator(".toast-close")
    if close.count():
        close.click()
        page.wait_for_timeout(30)


def capture(page: Page, filename: str, captured: list[str]) -> None:
    close_toast(page)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(40)
    page.screenshot(path=str(OUTPUT / filename), full_page=False, animations="disabled")
    captured.append(filename)


def capture_at(page: Page, filename: str, selector: str, captured: list[str]) -> None:
    close_toast(page)
    target = page.locator(selector).first
    target.scroll_into_view_if_needed()
    page.wait_for_timeout(50)
    page.screenshot(path=str(OUTPUT / filename), full_page=False, animations="disabled")
    captured.append(filename)


def advance_two_days(page: Page) -> None:
    page.locator('[data-action="tab"][data-id="lab"]').click()
    page.locator('[data-action="step-hours"][data-hours="24"]').click()
    page.locator('[data-action="step-hours"][data-hours="24"]').click()


def check_mobile_overflow(page: Page, label: str, errors: list[str]) -> None:
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    if overflow > 1:
        errors.append(f"Mobile {label} horizontal overflow: {overflow}px")


def finish_lawful_indoor_departure_if_needed(page: Page) -> None:
    """Complete v0.11's lawful indoor departure before a queued visible street route."""
    if page.evaluate("() => Boolean(AXM.Game.world.activeIndoorMovement)"):
        page.evaluate("() => AXM.Game.invoke('finishIndoorMovementCompressed')")
        page.wait_for_timeout(100)
        page.locator('[data-action="tab"][data-id="street"]').click()
        page.wait_for_timeout(60)


def desktop_core(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    capture(page, "town_desktop.png", captured)
    page.locator('[data-action="tab"][data-id="home"]').click()
    capture(page, "home_desktop.png", captured)
    page.locator('[data-action="tab"][data-id="lab"]').click()
    page.locator('[data-action="developer-grant"]').click()
    page.locator('[data-action="tab"][data-id="home"]').click()
    page.locator('[data-action="request-surface-project"]').click()
    page.wait_for_timeout(50)
    capture(page, "construction_planned_desktop.png", captured)
    for _ in range(4):
        page.locator('[data-action="work-habitat-project"]').first.click()
        page.wait_for_timeout(50)
    capture(page, "construction_completed_desktop.png", captured)
    page.locator('[data-action="tab"][data-id="housing"]').click()
    page.locator('[data-action="view-property"][data-id="home_lane_1"]').click()
    capture(page, "resident_interior_desktop.png", captured)

    page.locator('[data-action="tab"][data-id="stewardship"]').click()
    page.locator('[data-action="prepare-stewardship-experiment"]').click()
    capture(page, "stewardship_request_desktop.png", captured)
    page.locator(
        '[data-action="respond-stewardship"][data-response="approve_tenant_funded"]'
    ).click()
    capture(page, "stewardship_approved_saving_desktop.png", captured)
    page.locator('[data-action="tab"][data-id="lab"]').click()
    page.locator('[data-action="observer-days"][data-days="30"]').click()
    page.wait_for_timeout(150)
    page.locator('[data-action="tab"][data-id="stewardship"]').click()
    capture(page, "stewardship_completed_desktop.png", captured)

    page.locator('[data-action="tab"][data-id="lab"]').click()
    page.locator('[data-action="prepare-household-experiment"]').click()
    page.locator('[data-action="tab"][data-id="agreements"]').click()
    capture(page, "agreements_before_commitment_desktop.png", captured)
    page.locator('[data-action="propose-commitment"]').first.click()
    capture(page, "commitment_pending_desktop.png", captured)
    advance_two_days(page)
    page.locator('[data-action="tab"][data-id="agreements"]').click()
    capture(page, "agreements_active_separate_desktop.png", captured)

    page.locator('[data-action="propose-cohabitation"]').click()
    advance_two_days(page)
    page.locator('[data-action="tab"][data-id="agreements"]').click()
    capture(page, "agreements_cohabiting_desktop.png", captured)
    page.locator('[data-action="view-property"]').first.click()
    capture(page, "shared_home_room_permissions_desktop.png", captured)
    page.locator('[data-action="tab"][data-id="agreements"]').click()
    page.locator("#hhEndAck").fill("END")
    page.locator('[data-action="end-household-agreement"]').click()
    capture(page, "agreements_ended_desktop.png", captured)
    page.close()


def desktop_family(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    page.locator('[data-action="tab"][data-id="family"]').click()
    capture(page, "family_onboarding_desktop.png", captured)
    page.locator('[data-action="prepare-family-experiment"][data-variant="teen"]').click()
    page.wait_for_timeout(100)
    capture(page, "family_active_desktop.png", captured)
    capture_at(
        page,
        "family_dependent_agency_desktop.png",
        "text=Selected autonomous dependent",
        captured,
    )
    family_details = page.evaluate(
        """() => {
          const world = window.AXM.Game.world;
          const unit = window.AXM.Family.playerFamily(world);
          const person = window.AXM.World.getPerson(world, world.ui.selectedDependentId);
          const result = window.AXM.Family.createFamilyProposal(world, 'family_ritual', person.id, ['player'], {
            label: 'Quiet Sunday table', meaning: 'A voluntary pause chosen by the family.'
          }, { status: 'awaiting_player', familyUnitId: unit.id, householdId: unit.linkedHouseholdId, dueDay: world.time.day, expiresDay: world.time.day + 10 });
          window.AXM.Game.afterMutation('screenshot-family-proposal');
          return { personId: person.id, proposalId: result.proposal.id };
        }"""
    )
    page.locator('[data-action="tab"][data-id="family"]').click()
    capture(page, "family_incoming_proposal_desktop.png", captured)
    page.locator(
        f'[data-action="respond-family-proposal"][data-id="{family_details["proposalId"]}"][data-response="decline"]'
    ).click()
    page.evaluate(
        """(personId) => {
          const world = window.AXM.Game.world;
          const result = window.AXM.Systems.advanceLifeChapter(world, personId);
          if (!result.ok) throw new Error(result.reason);
          window.AXM.Game.afterMutation('screenshot-family-choice-transition');
        }""",
        family_details["personId"],
    )
    page.locator('[data-action="tab"][data-id="family"]').click()
    capture(page, "family_young_adult_transition_desktop.png", captured)
    page.close()


def desktop_community(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    page.locator('[data-action="tab"][data-id="community"]').click()
    capture(page, "community_onboarding_desktop.png", captured)
    page.locator('[data-action="prepare-community-experiment"]').click()
    page.wait_for_timeout(100)
    capture(page, "community_freedom_loop_desktop.png", captured)
    capture_at(
        page,
        "community_invitation_desktop.png",
        "text=Invitations waiting for an answer",
        captured,
    )
    page.locator(
        '[data-action="respond-community-opportunity"][data-response="decline"]'
    ).click()
    page.wait_for_timeout(60)
    capture_at(
        page,
        "community_refusal_preserved_desktop.png",
        "text=Preserved community moments",
        captured,
    )
    page.close()


def desktop_directions(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    page.locator('[data-action="tab"][data-id="directions"]').click()
    capture(page, "directions_onboarding_desktop.png", captured)
    page.locator('[data-action="prepare-directions-experiment"]').click()
    page.wait_for_timeout(100)
    capture(page, "directions_active_project_desktop.png", captured)
    capture_at(
        page,
        "directions_no_age_pressure_desktop.png",
        "text=Life context",
        captured,
    )
    page.locator('[data-action="advance-life-chapter"][data-id="player"]').click()
    page.wait_for_timeout(60)
    capture_at(
        page,
        "directions_project_crosses_chapter_desktop.png",
        ".personal-project-card",
        captured,
    )
    page.locator('[data-action="pause-personal-project"]').click()
    capture_at(
        page,
        "directions_paused_desktop.png",
        ".personal-project-card.status-paused",
        captured,
    )
    page.close()


def desktop_economy(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    page.locator('[data-action="tab"][data-id="economy"]').click()
    capture(page, "economy_onboarding_desktop.png", captured)
    page.locator('[data-action="prepare-enterprise-experiment"]').click()
    page.wait_for_timeout(160)
    capture(page, "economy_active_direction_desktop.png", captured)
    capture_at(page, "economy_actual_customers_desktop.png", "text=Recent actual resident customers", captured)
    enterprise_id = page.evaluate("""() => {
      const enterprise = window.AXM.Game.world.enterprises.find((entry) => entry.ownerId === 'player' && entry.status !== 'closed');
      return enterprise && enterprise.id;
    }""")
    if not enterprise_id:
        errors.append("Economy screenshot setup did not create a player enterprise")
    else:
        page.locator(f'[data-action="start-enterprise-session"][data-id="{enterprise_id}"][data-mode="interactive"]').click()
        page.wait_for_timeout(100)
        capture_at(page, "economy_entered_session_desktop.png", "text=Entered enterprise session", captured)
        # Leave no active session/timer behind before closing the QA page.
        page.evaluate("(enterpriseId) => AXM.Game.invoke('cancelEnterpriseSession', enterpriseId)", enterprise_id)
        page.wait_for_timeout(60)
    page.close()


def desktop_walkable(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    page.evaluate(
        """() => {
          AXM.Game.world.ui.selectedPlaceId = 'place_market';
          AXM.Game.afterMutation('screenshot-walkable-select');
        }"""
    )
    page.locator('[data-action="tab"][data-id="street"]').click()
    capture(page, "walkable_route_planner_desktop.png", captured)
    if page.locator('#streetCanvas').count() != 1:
        errors.append("Desktop walkable map canvas was not present")
    if page.locator('text=No walking obligation').count() < 1:
        errors.append("Desktop walkable no-obligation root was not visible")

    page.locator('[data-action="start-visible-travel"][data-id="place_market"]').click()
    page.wait_for_timeout(100)
    finish_lawful_indoor_departure_if_needed(page)
    capture(page, "walkable_visible_route_desktop.png", captured)
    page.locator('[data-action="step-player-travel"]').click()
    page.wait_for_timeout(100)
    moment = page.evaluate(
        """() => AXM.Game.world.streetMoments[AXM.Game.world.streetMoments.length - 1] || null"""
    )
    if not moment or moment.get("consequence") != "observation_only":
        errors.append("Desktop visible route did not create an observation-only street moment")
    capture_at(
        page,
        "walkable_street_moment_desktop.png",
        "text=Street moments",
        captured,
    )
    page.close()


def mobile_core(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    check_mobile_overflow(page, "town", errors)
    capture(page, "town_mobile.png", captured)
    page.locator('[data-action="tab"][data-id="home"]').click()
    capture(page, "home_mobile.png", captured)
    page.locator('[data-action="tab"][data-id="stewardship"]').click()
    page.locator('[data-action="prepare-stewardship-experiment"]').click()
    capture(page, "stewardship_request_mobile.png", captured)
    check_mobile_overflow(page, "stewardship", errors)
    page.locator('[data-action="tab"][data-id="lab"]').click()
    page.locator('[data-action="prepare-household-experiment"]').click()
    page.locator('[data-action="tab"][data-id="agreements"]').click()
    page.locator('[data-action="propose-commitment"]').first.click()
    advance_two_days(page)
    page.locator('[data-action="tab"][data-id="agreements"]').click()
    capture(page, "agreements_active_mobile.png", captured)
    check_mobile_overflow(page, "agreement", errors)
    page.close()


def mobile_family(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    page.locator('[data-action="tab"][data-id="family"]').click()
    page.locator('[data-action="prepare-family-experiment"][data-variant="teen"]').click()
    page.wait_for_timeout(100)
    capture(page, "family_active_mobile.png", captured)
    check_mobile_overflow(page, "family", errors)
    capture_at(
        page,
        "family_dependent_agency_mobile.png",
        "text=Selected autonomous dependent",
        captured,
    )
    proposal_id = page.evaluate(
        """() => {
          const world = window.AXM.Game.world;
          const unit = window.AXM.Family.playerFamily(world);
          const person = window.AXM.World.getPerson(world, world.ui.selectedDependentId);
          const result = window.AXM.Family.createFamilyProposal(world, 'family_ritual', person.id, ['player'], {
            label: 'Quiet Sunday table', meaning: 'A voluntary pause chosen by the family.'
          }, { status: 'awaiting_player', familyUnitId: unit.id, householdId: unit.linkedHouseholdId, dueDay: world.time.day, expiresDay: world.time.day + 10 });
          window.AXM.Game.afterMutation('screenshot-family-mobile-proposal');
          return result.proposal.id;
        }"""
    )
    page.locator('[data-action="tab"][data-id="family"]').click()
    capture(page, "family_incoming_proposal_mobile.png", captured)
    if page.locator(
        f'[data-action="respond-family-proposal"][data-id="{proposal_id}"]'
    ).count() != 2:
        errors.append("Mobile family proposal controls were not both present")
    check_mobile_overflow(page, "family proposal", errors)
    page.close()


def mobile_community(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    page.locator('[data-action="tab"][data-id="community"]').click()
    page.locator('[data-action="prepare-community-experiment"]').click()
    page.wait_for_timeout(100)
    capture(page, "community_freedom_loop_mobile.png", captured)
    check_mobile_overflow(page, "community", errors)
    capture_at(
        page,
        "community_adventure_mobile.png",
        "text=Your current thread",
        captured,
    )
    page.close()


def mobile_directions(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    page.locator('[data-action="tab"][data-id="directions"]').click()
    capture(page, "directions_onboarding_mobile.png", captured)
    check_mobile_overflow(page, "directions onboarding", errors)
    page.locator('[data-action="prepare-directions-experiment"]').click()
    page.wait_for_timeout(100)
    capture_at(
        page,
        "directions_active_project_mobile.png",
        ".personal-project-card",
        captured,
    )
    check_mobile_overflow(page, "directions project", errors)
    capture_at(
        page,
        "directions_life_context_mobile.png",
        "text=Life context",
        captured,
    )
    page.close()


def mobile_economy(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    page.locator('[data-action="tab"][data-id="economy"]').click()
    capture(page, "economy_onboarding_mobile.png", captured)
    check_mobile_overflow(page, "economy onboarding", errors)
    page.locator('[data-action="prepare-enterprise-experiment"]').click()
    page.wait_for_timeout(160)
    capture_at(page, "economy_active_direction_mobile.png", ".proposal-card", captured)
    check_mobile_overflow(page, "economy active direction", errors)
    page.close()


def mobile_walkable(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    page.evaluate(
        """() => {
          AXM.Game.world.ui.selectedPlaceId = 'place_market';
          AXM.Game.afterMutation('screenshot-walkable-mobile-select');
        }"""
    )
    page.locator('[data-action="tab"][data-id="street"]').click()
    capture(page, "walkable_route_planner_mobile.png", captured)
    check_mobile_overflow(page, "walkable route planner", errors)
    page.locator('[data-action="start-visible-travel"][data-id="place_market"]').click()
    page.wait_for_timeout(100)
    finish_lawful_indoor_departure_if_needed(page)
    capture_at(
        page,
        "walkable_visible_route_mobile.png",
        "text=Visible route in progress",
        captured,
    )
    check_mobile_overflow(page, "walkable visible route", errors)
    page.close()


def desktop_presence(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 1440, "height": 1000}, errors)
    page.locator('[data-action="tab"][data-id="presence"]').click()
    capture(page, "presence_onboarding_desktop.png", captured)
    if page.locator('text=No social checklist').count() < 1:
        errors.append("Desktop presence roots were not visible")
    page.locator('[data-action="prepare-presence-experiment"]').click()
    page.wait_for_timeout(120)
    page.locator('[data-action="start-indoor-arrival"][data-mode="visible"]').click()
    page.wait_for_timeout(80)
    # Advance onto the upper shared landing through the real stair link.
    for _ in range(2):
        if page.locator('[data-action="step-indoor-movement"]').count():
            page.locator('[data-action="step-indoor-movement"]').click()
            page.wait_for_timeout(80)
    capture(page, "presence_upper_walkup_route_desktop.png", captured)
    decline = page.locator('[data-action="respond-presence-encounter"][data-response="decline"]')
    if decline.count():
        decline.click()
        page.wait_for_timeout(80)
    else:
        errors.append("Desktop presence experiment did not expose the refusal-safe encounter")
    capture_at(page, "presence_refusal_preserved_desktop.png", "text=Recent truthful encounter history", captured)
    if page.locator('[data-action="finish-indoor-movement"]').count():
        page.locator('[data-action="finish-indoor-movement"]').click()
        page.wait_for_timeout(100)
    capture(page, "presence_inside_room_desktop.png", captured)
    final = page.evaluate("""() => ({
      presence: AXM.Presence.presenceFor(AXM.Game.world, 'player'),
      valid: AXM.Systems.validateWorld(AXM.Game.world),
      stairUses: AXM.Game.world.metrics.indoorStairUses
    })""")
    if final["presence"]["kind"] != "room" or final["presence"]["level"] != 1:
        errors.append("Desktop presence route did not finish inside the upper room")
    if final["stairUses"] < 1:
        errors.append("Desktop presence route did not retain stair-use evidence")
    if not final["valid"]["ok"]:
        errors.append("Desktop presence world failed validation: " + " | ".join(final["valid"]["errors"][:4]))
    page.close()


def mobile_presence(browser: Browser, html: str, errors: list[str], captured: list[str]) -> None:
    page = load_page(browser, html, {"width": 412, "height": 915}, errors)
    page.locator('[data-action="tab"][data-id="presence"]').click()
    capture(page, "presence_onboarding_mobile.png", captured)
    check_mobile_overflow(page, "presence onboarding", errors)
    page.locator('[data-action="prepare-presence-experiment"]').click()
    page.wait_for_timeout(120)
    page.locator('[data-action="start-indoor-arrival"][data-mode="visible"]').click()
    page.wait_for_timeout(80)
    if page.locator('[data-action="step-indoor-movement"]').count():
        page.locator('[data-action="step-indoor-movement"]').click()
        page.wait_for_timeout(80)
    capture(page, "presence_upper_walkup_mobile.png", captured)
    check_mobile_overflow(page, "presence upper walk-up", errors)
    if page.locator('[data-action="step-indoor-movement"]').count():
        page.locator('[data-action="step-indoor-movement"]').click()
        page.wait_for_timeout(80)
    capture_at(page, "presence_encounter_mobile.png", "text=Ordinary encounter", captured)
    check_mobile_overflow(page, "presence encounter", errors)
    page.close()


GROUP_FUNCTIONS: dict[str, Callable[[Browser, str, list[str], list[str]], None]] = {
    "desktop-core": desktop_core,
    "desktop-family": desktop_family,
    "desktop-community": desktop_community,
    "desktop-directions": desktop_directions,
    "desktop-economy": desktop_economy,
    "desktop-walkable": desktop_walkable,
    "desktop-presence": desktop_presence,
    "mobile-core": mobile_core,
    "mobile-family": mobile_family,
    "mobile-community": mobile_community,
    "mobile-directions": mobile_directions,
    "mobile-economy": mobile_economy,
    "mobile-walkable": mobile_walkable,
    "mobile-presence": mobile_presence,
}


def verify_existing() -> None:
    present = sorted(path.name for path in OUTPUT.glob("*.png"))
    missing = sorted(set(EXPECTED) - set(present))
    unexpected = sorted(set(present) - set(EXPECTED))
    if missing or unexpected:
        raise SystemExit(
            "Screenshot evidence mismatch. "
            f"Missing: {missing or 'none'}; unexpected: {unexpected or 'none'}"
        )
    print(
        f"PASS screenshot evidence: {len(present)}/{len(EXPECTED)} expected desktop/mobile images; "
        "group runs reported zero page, console, and horizontal-overflow errors."
    )


def run_group(group: str, reset: bool) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if reset:
        for old in OUTPUT.glob("*.png"):
            old.unlink()

    html = HTML.read_text(encoding="utf-8")
    errors: list[str] = []
    captured: list[str] = []
    groups = GROUPS if group == "all" else [group]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROMIUM,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            for name in groups:
                GROUP_FUNCTIONS[name](browser, html, errors, captured)
        finally:
            browser.close()

    if errors:
        raise SystemExit("Screenshot QA failed: " + " | ".join(errors))
    print(f"PASS screenshot group {group}: captured {len(captured)} images")
    for filename in captured:
        print(f"- {filename}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=["all", *GROUPS], default="all")
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    if args.verify:
        verify_existing()
        return
    run_group(args.group, args.reset)


if __name__ == "__main__":
    main()
