#!/usr/bin/env python3
"""UI smoke test for the built standalone HTML. Requires Python Playwright and Chromium."""
from pathlib import Path
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'standalone' / 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html'
CHROMIUM = os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium')


def main() -> int:
    html = HTML.read_text(encoding='utf-8')
    page_errors: list[str] = []
    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=CHROMIUM,
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        # This sandbox blocks local navigation, so load the exact built HTML into the page.
        # The app deliberately catches unavailable localStorage and remains exportable via JSON.
        page.set_content(html, wait_until='load')
        page.wait_for_timeout(300)

        assert page.locator('.tab-button').count() == 18
        assert page.locator('#townCanvas').count() == 1

        # One-life action.
        page.locator('[data-action="tab"][data-id="life"]').click()
        before_time = page.locator('.time-badge').inner_text()
        page.locator('[data-action="activity"][data-id="eat_home"]').click()
        page.wait_for_timeout(100)
        after_time = page.locator('.time-badge').inner_text()
        assert before_time != after_time

        # Work compression remains playable.
        page.locator('[data-action="tab"][data-id="work"]').click()
        before_money = page.locator('.money-badge').inner_text()
        page.locator('[data-action="skip-shift"]').click()
        page.wait_for_timeout(120)
        after_money = page.locator('.money-badge').inner_text()
        assert before_money != after_money

        # Explicit grant, object upgrade, and storage flow.
        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="developer-grant"]').click()
        page.locator('[data-action="tab"][data-id="home"]').click()
        chair = page.locator('.furniture-tile[title^="Secondhand Chair"]').first
        chair.click()
        page.locator('[data-action="upgrade-object"][data-axis="comfort"]').click()
        page.wait_for_timeout(100)
        assert 'level 1/5' in page.locator('[data-action="upgrade-object"][data-axis="comfort"]').inner_text().lower()
        page.locator('[data-action="store-object"]').click()
        page.wait_for_timeout(100)
        assert page.locator('[data-action="place-stored"]').count() >= 1

        # Resident interiors are observable without becoming editable build surfaces.
        page.locator('[data-action="tab"][data-id="housing"]').click()
        page.locator('[data-action="view-property"][data-id="home_lane_1"]').click()
        page.wait_for_timeout(100)
        assert page.locator('text=Read-only resident interior').count() == 1
        assert page.locator('[data-action="buy-furniture"]').count() == 0
        assert page.locator('[data-action="store-object"]').count() == 0
        assert page.locator('text=Observation does not grant edit authority').count() == 1
        page.locator('[data-action="view-property"][data-id="home_student"]').click()
        # Rental-safe surface construction is phased and visible rather than instant.
        assert page.locator('[data-action="request-partition-project"]').is_disabled()
        page.locator('[data-action="request-surface-project"]').click()
        page.wait_for_timeout(80)
        project = page.locator('.construction-card.status-planned').first
        assert project.count() == 1
        for _ in range(4):
            page.locator('[data-action="work-habitat-project"]').first.click()
            page.wait_for_timeout(80)
        assert page.locator('.construction-card.status-completed').count() >= 1
        assert page.locator('text=Project evidence').count() >= 1

        # Autonomous stewardship: resident intent, exact permission, visible saving, then phased work.
        page.locator('[data-action="tab"][data-id="stewardship"]').click()
        assert page.locator('text=Autonomous habitat shaping with real authority').count() == 1
        page.locator('[data-action="prepare-stewardship-experiment"]').click()
        page.wait_for_timeout(100)
        assert page.locator('text=Requests waiting for your decision').count() == 1
        assert page.locator('[data-action="respond-stewardship"][data-response="approve_tenant_funded"]').count() == 1
        before_stewardship = page.evaluate('''() => {
          const request = window.AXM.Game.world.stewardshipRequests.find((entry) => entry.status === 'pending_player');
          const intention = request && window.AXM.Stewardship.intentionById(window.AXM.Game.world, request.intentionId);
          return {
            requestId: request && request.id,
            requestStatus: request && request.status,
            intentionStatus: intention && intention.status,
            projectId: intention && intention.projectId,
            residentId: intention && intention.residentId,
            relation: intention ? JSON.stringify(window.AXM.World.getPerson(window.AXM.Game.world, intention.residentId).relationships.player || null) : null
          };
        }''')
        assert before_stewardship['requestStatus'] == 'pending_player'
        assert before_stewardship['projectId'] is None
        page.locator('[data-action="respond-stewardship"][data-response="approve_tenant_funded"]').click()
        page.wait_for_timeout(100)
        after_approval = page.evaluate('''(requestId) => {
          const request = window.AXM.Stewardship.requestById(window.AXM.Game.world, requestId);
          const intention = window.AXM.Stewardship.intentionById(window.AXM.Game.world, request.intentionId);
          return { requestStatus: request.status, intentionStatus: intention.status, projectId: intention.projectId };
        }''', before_stewardship['requestId'])
        assert after_approval['requestStatus'] == 'approved'
        assert after_approval['intentionStatus'] == 'approved_saving'
        assert after_approval['projectId'] is None
        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="observer-days"][data-days="30"]').click()
        page.wait_for_timeout(250)
        stewardship_outcome = page.evaluate('''(requestId) => {
          const request = window.AXM.Stewardship.requestById(window.AXM.Game.world, requestId);
          const intention = window.AXM.Stewardship.intentionById(window.AXM.Game.world, request.intentionId);
          const project = window.AXM.Stewardship.intentionProject(window.AXM.Game.world, intention);
          const relation = window.AXM.World.getPerson(window.AXM.Game.world, intention.residentId).relationships.player || null;
          return {
            requestStatus: request.status,
            intentionStatus: intention.status,
            creatorId: project && project.creatorId,
            resourceMode: project && project.resourceMode,
            projectStatus: project && project.status,
            relation: JSON.stringify(relation)
          };
        }''', before_stewardship['requestId'])
        assert stewardship_outcome['requestStatus'] == 'completed'
        assert stewardship_outcome['intentionStatus'] == 'completed'
        assert stewardship_outcome['creatorId'] == before_stewardship['residentId']
        assert stewardship_outcome['resourceMode'] == 'resident_escrow'
        assert stewardship_outcome['projectStatus'] == 'completed'
        assert stewardship_outcome['relation'] == before_stewardship['relation']
        page.locator('[data-action="tab"][data-id="stewardship"]').click()
        assert page.locator('.proposal-card.status-completed').count() >= 1
        assert page.locator('text=Evidence totals').count() == 1

        # Social interaction, then the labeled agreement flow.
        page.locator('[data-action="tab"][data-id="people"]').click()
        page.locator('[data-action="social"][data-kind="talk"]').first.click()
        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="prepare-household-experiment"]').click()
        page.locator('[data-action="tab"][data-id="agreements"]').click()
        assert page.locator('text=Possible commitment conversations').count() == 1
        page.locator('[data-action="propose-commitment"]').first.click()
        assert page.locator('.proposal-card.status-pending_npc').count() == 1
        assert page.locator('.agreement-hero').count() == 0

        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="step-hours"][data-hours="24"]').click()
        page.locator('[data-action="step-hours"][data-hours="24"]').click()
        page.locator('[data-action="tab"][data-id="agreements"]').click()
        assert page.locator('.agreement-hero').count() == 1
        assert page.locator('text=Separate homes').count() >= 1

        page.locator('[data-action="propose-cohabitation"]').click()
        assert page.locator('.proposal-card.status-pending_npc').count() >= 1
        assert page.locator('text=Separate homes').count() >= 1
        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="step-hours"][data-hours="24"]').click()
        page.locator('[data-action="step-hours"][data-hours="24"]').click()
        page.locator('[data-action="tab"][data-id="agreements"]').click()
        assert page.locator('text=Cohabiting').count() >= 1
        page.locator('[data-action="view-property"]').first.click()
        assert page.locator('.structural-grid.has-household-zones').count() == 1
        assert page.locator('.habitat-cell.permission-common').count() >= 1
        assert page.locator('.zone-chip.zone-common').count() >= 1
        permissions = page.evaluate('() => window.AXM.Habitats.roomPermissionsForProperty(window.AXM.Game.world, window.AXM.Game.world.player.homePropertyId)')
        assert len(permissions) == page.locator('.habitat-room-label').count()
        assert all(permission['source'] == 'room_graph' for permission in permissions)

        # Observer batch still works after an active household exists.
        page.locator('[data-action="tab"][data-id="lab"]').click()
        page.locator('[data-action="observer-days"][data-days="7"]').click()
        page.wait_for_timeout(150)
        assert page.locator('text=Last observer delta').count() == 1

        # The exit root is unilateral but explicit: no forced eviction, no partner permission gate.
        page.locator('[data-action="tab"][data-id="agreements"]').click()
        page.locator('#hhEndAck').fill('END')
        page.locator('[data-action="end-household-agreement"]').click()
        page.wait_for_timeout(120)
        assert page.locator('.agreement-hero').count() == 0
        assert page.locator('text=No active agreement').count() >= 1
        assert page.locator('text=Ended agreements').count() >= 1

        # Export/import surface remains present.
        page.locator('[data-action="tab"][data-id="lab"]').click()
        assert page.locator('[data-action="export-world"]').count() >= 1
        assert page.locator('[data-action="trigger-import"]').count() == 1
        page.close()

        # Family continuity is tested in a fresh world so earlier QA shortcuts cannot invent its foundation.
        family_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        family_page.on('pageerror', lambda error: page_errors.append(str(error)))
        family_page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        family_page.set_content(html, wait_until='load')
        family_page.wait_for_timeout(300)
        assert family_page.locator('.tab-button').count() == 18
        family_page.locator('[data-action="tab"][data-id="family"]').click()
        assert family_page.locator('text=No active family unit').count() >= 1
        assert family_page.locator('text=Three authorities remain separate').count() == 1
        assert family_page.locator('[data-action="prepare-family-experiment"]').count() == 2

        family_page.locator('[data-action="prepare-family-experiment"][data-variant="teen"]').click()
        family_page.wait_for_timeout(180)
        family_state = family_page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const unit = window.AXM.Family.playerFamily(world);
          const dependent = window.AXM.World.getPerson(world, world.ui.selectedDependentId);
          const home = window.AXM.World.getProperty(world, unit.homePropertyId);
          const household = window.AXM.Households.playerHousehold(world);
          return {
            unitId: unit.id,
            dependentId: dependent.id,
            dependentName: dependent.name,
            stage: dependent.lifeCourse.stage,
            controlled: dependent.isPlayerControlled === true,
            jobId: dependent.jobId,
            rentArrears: dependent.rentArrears,
            familyMemberIds: unit.members.filter((entry) => !entry.leftDay).map((entry) => entry.personId),
            adultHouseholdMemberIds: household.memberIds.slice(),
            homeId: home.id,
            homeListed: home.listedForRent,
            homeTenants: home.tenants.slice(),
            placedObjects: home.furniture.filter((object) => object.ownerId === dependent.id).length,
            storedObjects: (dependent.storedFurniture || []).length,
            roomAssignments: unit.roomAssignments.filter((entry) => entry.personId === dependent.id).length
          };
        }''')
        assert family_state['stage'] == 'teen'
        assert family_state['controlled'] is False
        assert family_state['jobId'] is None
        assert family_state['rentArrears'] == 0
        assert family_state['dependentId'] in family_state['familyMemberIds']
        assert family_state['dependentId'] not in family_state['adultHouseholdMemberIds']
        assert family_state['dependentId'] in family_state['homeTenants']
        assert family_state['homeListed'] is False
        assert family_state['placedObjects'] + family_state['storedObjects'] >= 4
        assert family_state['roomAssignments'] == 1
        assert family_page.locator('text=Selected autonomous dependent').count() == 1
        assert family_page.locator('text=Not directly playable').count() >= 1
        assert family_page.locator('[data-action="family-care"]').count() == 7

        # Care consumes time and always leaves evidence; acceptance and refusal are both valid outcomes.
        before_care = family_page.evaluate('''(personId) => {
          const world = window.AXM.Game.world;
          const unit = window.AXM.Family.playerFamily(world);
          const record = window.AXM.Family.careRecordForDay(world, unit, personId, true);
          return { absoluteHour: world.time.day * 24 + world.time.hour, actions: record.actions.length, money: world.player.money };
        }''', family_state['dependentId'])
        family_page.locator(f'[data-action="family-care"][data-id="{family_state["dependentId"]}"][data-kind="listen_check_in"]').click()
        family_page.wait_for_timeout(120)
        after_care = family_page.evaluate('''(personId) => {
          const world = window.AXM.Game.world;
          const unit = window.AXM.Family.playerFamily(world);
          const record = window.AXM.Family.careRecordForDay(world, unit, personId, true);
          const latest = record.actions[record.actions.length - 1];
          return { absoluteHour: world.time.day * 24 + world.time.hour, actions: record.actions.length, accepted: latest.accepted, cost: latest.cost, money: world.player.money };
        }''', family_state['dependentId'])
        assert after_care['absoluteHour'] > before_care['absoluteHour']
        assert after_care['actions'] == before_care['actions'] + 1
        assert isinstance(after_care['accepted'], bool)
        if after_care['accepted']:
            assert after_care['money'] <= before_care['money']
        else:
            assert after_care['cost'] == 0

        # The general People view exposes a dependent summary, never adult romance or direct-control actions.
        family_page.locator(f'[data-action="select-person"][data-id="{family_state["dependentId"]}"]').click()
        family_page.wait_for_timeout(100)
        assert family_page.locator('text=Autonomous Teen').count() >= 1
        assert family_page.locator('text=Open family continuity').count() == 1
        assert family_page.locator(f'[data-action="social"][data-id="{family_state["dependentId"]}"]').count() == 0
        assert family_page.locator(f'[data-action="propose-commitment"][data-id="{family_state["dependentId"]}"]').count() == 0

        # An autonomous family proposal may be declined without altering the relationship behind the interface.
        proposal_state = family_page.evaluate('''(personId) => {
          const world = window.AXM.Game.world;
          const unit = window.AXM.Family.playerFamily(world);
          const before = JSON.stringify(world.player.relationships[personId] || null);
          const result = window.AXM.Family.createFamilyProposal(world, 'family_ritual', personId, ['player'], {
            label: 'Quiet Sunday table',
            meaning: 'A voluntary weekly pause chosen by the family.'
          }, {
            status: 'awaiting_player', familyUnitId: unit.id, householdId: unit.linkedHouseholdId,
            dueDay: world.time.day, expiresDay: world.time.day + 10
          });
          window.AXM.Game.afterMutation('browser-family-proposal');
          return { id: result.proposal.id, before };
        }''', family_state['dependentId'])
        family_page.locator('[data-action="tab"][data-id="family"]').click()
        decline_selector = f'[data-action="respond-family-proposal"][data-id="{proposal_state["id"]}"][data-response="decline"]'
        assert family_page.locator(decline_selector).count() == 1
        family_page.locator(decline_selector).click()
        family_page.wait_for_timeout(100)
        declined_state = family_page.evaluate('''(args) => {
          const world = window.AXM.Game.world;
          const proposal = window.AXM.Family.familyProposalById(world, args.id);
          return { status: proposal.status, relation: JSON.stringify(world.player.relationships[args.personId] || null) };
        }''', {'id': proposal_state['id'], 'personId': family_state['dependentId']})
        assert declined_state['status'] == 'declined'
        assert declined_state['relation'] == proposal_state['before']

        # A life chapter opens only by explicit choice and still preserves identity and objects.
        transition = family_page.evaluate('''(personId) => {
          const world = window.AXM.Game.world;
          const person = window.AXM.World.getPerson(world, personId);
          const home = window.AXM.World.getProperty(world, person.homePropertyId);
          const beforeObjects = home.furniture.filter((object) => object.ownerId === personId).map((object) => object.id)
            .concat((person.storedFurniture || []).map((object) => object.id)).sort();
          const result = window.AXM.Systems.advanceLifeChapter(world, personId);
          if (!result.ok) throw new Error(result.reason);
          window.AXM.Game.afterMutation('browser-family-choice-transition');
          const afterHome = window.AXM.World.getProperty(world, person.homePropertyId);
          const afterObjects = afterHome.furniture.filter((object) => object.ownerId === personId).map((object) => object.id)
            .concat((person.storedFurniture || []).map((object) => object.id)).sort();
          return {
            stage: person.lifeCourse.stage,
            role: window.AXM.Family.playerFamily(world).members.find((entry) => entry.personId === personId).role,
            controlled: person.isPlayerControlled === true,
            objectsPreserved: JSON.stringify(beforeObjects) === JSON.stringify(afterObjects),
            transitions: world.metrics.lifeStageTransitions,
            mode: result.transition.mode,
            noMissedWindow: result.transition.noMissedWindow
          };
        }''', family_state['dependentId'])
        assert transition['stage'] == 'young_adult'
        assert transition['role'] == 'adult_child'
        assert transition['controlled'] is False
        assert transition['objectsPreserved'] is True
        assert transition['transitions'] >= 1
        assert transition['mode'] == 'choice'
        assert transition['noMissedWindow'] is True

        family_page.locator('[data-action="tab"][data-id="lab"]').click()
        assert family_page.locator('[data-action="export-world"]').count() >= 1
        assert family_page.locator('[data-action="trigger-import"]').count() == 1
        family_page.close()

        # Community adventures are tested in another fresh world: possibilities, not obligation.
        community_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        community_page.on('pageerror', lambda error: page_errors.append(str(error)))
        community_page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        community_page.set_content(html, wait_until='load')
        community_page.wait_for_timeout(300)
        assert community_page.locator('.tab-button').count() == 18

        community_page.locator('[data-action="tab"][data-id="life"]').click()
        assert community_page.locator('[data-action="activity"][data-id="gentle_routine"]').count() == 1
        before_routine_time = community_page.locator('.time-badge').inner_text()
        community_page.locator('[data-action="activity"][data-id="gentle_routine"]').click()
        community_page.wait_for_timeout(100)
        assert community_page.locator('.time-badge').inner_text() != before_routine_time

        community_page.locator('[data-action="tab"][data-id="community"]').click()
        assert community_page.locator('text=Community as possibility, not obligation').count() == 1
        assert community_page.locator('text=Be yourself').count() >= 1
        assert community_page.locator('text=No deadline, no quest failure').count() == 1
        assert community_page.locator('[data-action="prepare-community-experiment"]').count() == 1
        community_page.locator('[data-action="prepare-community-experiment"]').click()
        community_page.wait_for_timeout(140)
        assert community_page.locator('.adventure-card.status-active').count() == 1
        assert community_page.locator('[data-action="continue-adventure"]').count() == 1
        assert community_page.locator('[data-action="release-adventure"]').count() == 1
        assert community_page.locator('[data-action="respond-community-opportunity"][data-response="decline"]').count() == 1

        refusal_before = community_page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const invite = world.communityOpportunities.find((entry) => entry.status === 'awaiting_player');
          const otherId = invite.participantIds.find((id) => id !== 'player') || invite.hostId || invite.initiatorId;
          return {
            inviteId: invite.id,
            otherId,
            relationship: JSON.stringify(world.player.relationships[otherId] || null),
            playerState: JSON.stringify({ money: world.player.money, needs: world.player.needs, skills: world.player.skills })
          };
        }''')
        community_page.locator(f'[data-action="respond-community-opportunity"][data-id="{refusal_before["inviteId"]}"][data-response="decline"]').click()
        community_page.wait_for_timeout(100)
        refusal_after = community_page.evaluate('''(args) => {
          const world = window.AXM.Game.world;
          const invite = window.AXM.Community.opportunityById(world, args.inviteId);
          return {
            status: invite.status,
            relationship: JSON.stringify(world.player.relationships[args.otherId] || null),
            playerState: JSON.stringify({ money: world.player.money, needs: world.player.needs, skills: world.player.skills })
          };
        }''', refusal_before)
        assert refusal_after['status'] == 'declined'
        assert refusal_after['relationship'] == refusal_before['relationship']
        assert refusal_after['playerState'] == refusal_before['playerState']

        community_page.locator('[data-action="release-adventure"]').click()
        community_page.wait_for_timeout(100)
        assert community_page.locator('.adventure-card.status-active').count() == 0
        assert community_page.locator('[data-action="discover-adventure"]').count() == 1
        assert community_page.locator('text=Adventure history').count() == 1
        community_page.close()

        # Personal directions use choice-first life chapters and never create an age countdown.
        directions_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        directions_page.on('pageerror', lambda error: page_errors.append(str(error)))
        directions_page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        directions_page.set_content(html, wait_until='load')
        directions_page.wait_for_timeout(300)
        assert directions_page.locator('.tab-button').count() == 18
        directions_page.locator('[data-action="tab"][data-id="directions"]').click()
        assert directions_page.locator('text=Personal directions without a timetable').count() == 1
        assert directions_page.locator('text=No age pressure').count() >= 1
        assert directions_page.locator('text=Age is never a countdown').count() == 1
        assert directions_page.locator('[data-action="set-life-course-mode"][data-mode="choice"]').is_disabled()

        clock_state = directions_page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const before = { age: world.player.age, ageDays: world.player.lifeCourse.ageDays, stage: world.player.lifeCourse.stage };
          window.AXM.Systems.advanceHours(world, 30 * 24, { freezePlayer: true });
          window.AXM.Game.afterMutation('browser-choice-first-clock-proof');
          return {
            before,
            after: { age: world.player.age, ageDays: world.player.lifeCourse.ageDays, stage: world.player.lifeCourse.stage },
            chapterDays: world.player.lifeCourse.chapterDays,
            mode: world.settings.lifeCourseMode,
            agePressure: world.settings.agePressure
          };
        }''')
        assert clock_state['before'] == clock_state['after']
        assert clock_state['chapterDays'] >= 30
        assert clock_state['mode'] == 'choice'
        assert clock_state['agePressure'] is False

        directions_page.locator('[data-action="prepare-directions-experiment"]').click()
        directions_page.wait_for_timeout(140)
        assert directions_page.locator('.personal-project-card.status-active').count() == 1
        assert directions_page.locator('text=No deadline').count() >= 1
        project_before = directions_page.evaluate('''() => {
          const world = window.AXM.Game.world;
          const project = world.personalProjects.find((entry) => entry.ownerId === 'player' && entry.status === 'active');
          return { id: project.id, objectId: project.target.objectId, stage: world.player.lifeCourse.stage, status: project.status };
        }''')
        directions_page.locator('[data-action="advance-life-chapter"][data-id="player"]').click()
        directions_page.wait_for_timeout(120)
        project_after = directions_page.evaluate('''(id) => {
          const world = window.AXM.Game.world;
          const project = window.AXM.Directions.projectById(world, id);
          return { objectId: project.target.objectId, stage: world.player.lifeCourse.stage, status: project.status };
        }''', project_before['id'])
        assert project_after['stage'] != project_before['stage']
        assert project_after['objectId'] == project_before['objectId']
        assert project_after['status'] == 'active'

        directions_page.locator('[data-action="pause-personal-project"]').click()
        assert directions_page.locator('.personal-project-card.status-paused').count() == 1
        directions_page.locator('[data-action="resume-personal-project"]').click()
        directions_page.locator('[data-action="release-personal-project"]').click()
        directions_page.wait_for_timeout(100)
        assert directions_page.locator('.personal-project-card.status-released').count() == 1
        assert directions_page.locator('text=Preserved project history').count() == 1
        directions_page.close()

        # The local economy is a choice-first life direction, not a mandatory tycoon ladder.
        economy_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        economy_page.on('pageerror', lambda error: page_errors.append(str(error)))
        economy_page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        economy_page.set_content(html, wait_until='load')
        economy_page.wait_for_timeout(300)
        assert economy_page.locator('.tab-button').count() == 18
        economy_page.locator('[data-action="tab"][data-id="economy"]').click()
        assert economy_page.locator('text=Living local economy—not a mandatory business ladder').count() == 1
        assert economy_page.locator('text=Business is optional').count() >= 1
        assert economy_page.locator('text=Small stays valid').count() == 1
        assert economy_page.locator('[data-action="prepare-enterprise-experiment"]').count() == 1

        before_economy = economy_page.evaluate('''() => ({
          playerDirections: AXM.Game.world.enterprises.filter((entry) => entry.ownerId === 'player').length,
          age: AXM.Game.world.player.age,
          ageDays: AXM.Game.world.player.lifeCourse.ageDays,
          stage: AXM.Game.world.player.lifeCourse.stage,
          agePressure: AXM.Game.world.settings.agePressure
        })''')
        economy_page.locator('[data-action="prepare-enterprise-experiment"]').click()
        economy_page.wait_for_timeout(220)
        economy_state = economy_page.evaluate('''() => {
          const world = AXM.Game.world;
          const enterprise = world.enterprises.find((entry) => entry.ownerId === 'player');
          const session = enterprise && world.enterpriseSessions.find((entry) => entry.enterpriseId === enterprise.id);
          const premise = enterprise && AXM.Economy.premiseById(world, enterprise.premiseId);
          return {
            id: enterprise && enterprise.id,
            path: enterprise && enterprise.path,
            status: enterprise && enterprise.status,
            optional: enterprise && enterprise.optional,
            noAgeGate: enterprise && enterprise.noAgeGate,
            noGrowthRequirement: enterprise && enterprise.noGrowthRequirement,
            premiseLinked: Boolean(premise && premise.occupantEnterpriseId === enterprise.id),
            sessionStatus: session && session.status,
            customerIds: session ? session.customers.map((entry) => entry.personId) : [],
            allCustomersReal: session ? session.customers.every((entry) => world.people.some((person) => person.id === entry.personId)) : false,
            age: world.player.age,
            ageDays: world.player.lifeCourse.ageDays,
            stage: world.player.lifeCourse.stage,
            agePressure: world.settings.agePressure,
            valid: AXM.Systems.validateWorld(world)
          };
        }''')
        assert economy_state['id']
        assert economy_state['path'] == 'tiny_enterprise'
        assert economy_state['status'] == 'open'
        assert economy_state['optional'] is True
        assert economy_state['noAgeGate'] is True
        assert economy_state['noGrowthRequirement'] is True
        assert economy_state['premiseLinked'] is True
        assert economy_state['sessionStatus'] == 'completed'
        assert len(economy_state['customerIds']) >= 1
        assert economy_state['allCustomersReal'] is True
        assert economy_state['age'] == before_economy['age']
        assert economy_state['ageDays'] == before_economy['ageDays']
        assert economy_state['stage'] == before_economy['stage']
        assert economy_state['agePressure'] is False
        assert economy_state['valid']['ok'] is True
        assert economy_page.locator('text=Recent actual resident customers').count() >= 1

        # Entering the work block is optional and uses the same bounded session authority.
        economy_page.locator(f'[data-action="start-enterprise-session"][data-id="{economy_state["id"]}"][data-mode="interactive"]').click()
        economy_page.wait_for_timeout(100)
        assert economy_page.locator('text=Entered enterprise session').count() == 1
        for _ in range(3):
            economy_page.locator(f'[data-action="enterprise-task"][data-id="{economy_state["id"]}"]').first.click()
            economy_page.wait_for_timeout(90)
        after_interactive = economy_page.evaluate('''(enterpriseId) => {
          const world = AXM.Game.world;
          const enterprise = AXM.Economy.enterpriseById(world, enterpriseId);
          const sessions = world.enterpriseSessions.filter((entry) => entry.enterpriseId === enterpriseId);
          return {
            activeId: world.activeEnterpriseSessionId,
            sessions: sessions.length,
            completed: sessions.filter((entry) => entry.status === 'completed').length,
            actual: sessions.every((entry) => entry.customers.every((customer) => world.people.some((person) => person.id === customer.personId))),
            currentSessionId: enterprise.currentSessionId
          };
        }''', economy_state['id'])
        assert after_interactive['activeId'] is None
        assert after_interactive['currentSessionId'] is None
        assert after_interactive['sessions'] >= 2
        assert after_interactive['completed'] >= 2
        assert after_interactive['actual'] is True

        # Pause, resume, and closure are explicit life choices rather than failure states.
        economy_page.locator(f'[data-action="pause-enterprise-keep"][data-id="{economy_state["id"]}"]').click()
        economy_page.wait_for_timeout(80)
        assert economy_page.locator('.proposal-card.status-paused').count() >= 1
        economy_page.locator(f'[data-action="resume-enterprise"][data-id="{economy_state["id"]}"]').click()
        economy_page.wait_for_timeout(80)
        economy_page.locator(f'[data-action="close-enterprise"][data-id="{economy_state["id"]}"]').click()
        economy_page.wait_for_timeout(100)
        closure = economy_page.evaluate('''(enterpriseId) => {
          const world = AXM.Game.world;
          const enterprise = AXM.Economy.enterpriseById(world, enterpriseId);
          const closedEntry = enterprise.history.find((entry) => entry.type === 'closed');
          return {
            status: enterprise.status,
            premiseId: enterprise.premiseId,
            equipmentCount: enterprise.equipment.length,
            customerHistory: enterprise.customerHistory.length,
            closedMessage: closedEntry && closedEntry.message,
            valid: AXM.Systems.validateWorld(world)
          };
        }''', economy_state['id'])
        assert closure['status'] == 'closed'
        assert closure['premiseId'] is None
        assert closure['equipmentCount'] >= 1
        assert closure['customerHistory'] >= 1
        assert 'failure' in closure['closedMessage'].lower()
        assert closure['valid']['ok'] is True
        assert economy_page.locator('.proposal-card.status-closed').count() >= 1
        economy_page.close()

        # Walkable places preserve exterior identity and route provenance without
        # making visible travel statistically better than compressed travel.
        walkable_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        walkable_page.on('pageerror', lambda error: page_errors.append(str(error)))
        walkable_page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        walkable_page.set_content(html, wait_until='load')
        walkable_page.wait_for_timeout(300)
        assert walkable_page.locator('.tab-button').count() == 18
        walkable_page.locator('[data-action="tab"][data-id="street"]').click()
        assert walkable_page.locator('text=Walkable places with their own exterior identity').count() == 1
        assert walkable_page.locator('#streetCanvas').count() == 1
        assert walkable_page.locator('text=No walking obligation').count() >= 1

        walkable_initial = walkable_page.evaluate('''() => {
          const world = AXM.Game.world;
          const addresses = world.places.map((place) => place.exterior && place.exterior.address).filter(Boolean);
          return {
            locationId: world.player.locationId,
            age: world.player.age,
            ageDays: world.player.lifeCourse.ageDays,
            stage: world.player.lifeCourse.stage,
            travelCompressionAllowed: world.settings.travelCompressionAllowed,
            walkingObligation: world.settings.walkingObligation,
            hasWalkingStreak: Object.prototype.hasOwnProperty.call(world.player, 'walkingStreak') || Object.prototype.hasOwnProperty.call(world.metrics, 'walkingStreak'),
            allAddressesPresent: addresses.length === world.places.length,
            addressesUnique: new Set(addresses).size === addresses.length,
            valid: AXM.Systems.validateWorld(world)
          };
        }''')
        assert walkable_initial['travelCompressionAllowed'] is True
        assert walkable_initial['walkingObligation'] is False
        assert walkable_initial['hasWalkingStreak'] is False
        assert walkable_initial['allAddressesPresent'] is True
        assert walkable_initial['addressesUnique'] is True
        assert walkable_initial['valid']['ok'] is True

        # Select a real destination and begin a minute-level visible route.
        walkable_page.evaluate('''() => {
          AXM.Game.world.ui.selectedPlaceId = 'place_market';
          AXM.Game.afterMutation('browser-walkable-select');
        }''')
        walkable_page.locator('[data-action="tab"][data-id="street"]').click()
        before_visible = walkable_page.evaluate('''() => ({
          time: { ...AXM.Game.world.time },
          energy: AXM.Game.world.player.needs.energy,
          hunger: AXM.Game.world.player.needs.hunger,
          records: AXM.Game.world.travelRecords.length,
          moments: AXM.Game.world.streetMoments.length
        })''')
        walkable_page.locator('[data-action="start-visible-travel"][data-id="place_market"]').click()
        walkable_page.wait_for_timeout(80)
        # v0.11 lawfully exits the current building before beginning the street route.
        if walkable_page.evaluate('() => Boolean(AXM.Game.world.activeIndoorMovement)'):
            walkable_page.evaluate("() => AXM.Game.invoke('finishIndoorMovementCompressed')")
            walkable_page.wait_for_timeout(100)
            walkable_page.locator('[data-action="tab"][data-id="street"]').click()
        assert walkable_page.locator('text=Visible route in progress').count() == 1
        walkable_page.locator('[data-action="step-player-travel"]').click()
        walkable_page.wait_for_timeout(80)
        after_step = walkable_page.evaluate('''() => {
          const world = AXM.Game.world;
          const record = AXM.Exteriors.recordById(world, world.activeTravel && world.activeTravel.recordId);
          const moment = world.streetMoments[world.streetMoments.length - 1];
          return {
            active: Boolean(world.activeTravel),
            elapsed: record && record.elapsedMinutes,
            observationCount: record && record.observations.length,
            momentConsequence: moment && moment.consequence,
            moments: world.streetMoments.length
          };
        }''')
        assert after_step['active'] is True
        assert after_step['elapsed'] > 0
        assert after_step['observationCount'] >= 1
        assert after_step['momentConsequence'] == 'observation_only'
        assert after_step['moments'] == before_visible['moments'] + 1
        walkable_page.locator('[data-action="finish-player-travel"]').click()
        walkable_page.wait_for_timeout(100)
        visible_complete = walkable_page.evaluate('''() => {
          const world = AXM.Game.world;
          const record = world.travelRecords.filter((entry) => entry.actorId === 'player' && entry.mode === 'visible').slice(-1)[0];
          return {
            locationId: world.player.locationId,
            activeTravel: world.activeTravel,
            status: record && record.status,
            duration: record && record.route.durationMinutes,
            elapsed: record && record.elapsedMinutes,
            timeAccounting: record && record.timeAccounting,
            routeNodes: record && record.route.nodeIds.length,
            visibleJourneys: world.metrics.playerVisibleJourneys,
            valid: AXM.Systems.validateWorld(world)
          };
        }''')
        assert visible_complete['locationId'] == 'place_market'
        assert visible_complete['activeTravel'] is None
        assert visible_complete['status'] == 'completed'
        assert visible_complete['duration'] == visible_complete['elapsed']
        assert visible_complete['timeAccounting'] == 'minute_level'
        assert visible_complete['routeNodes'] >= 2
        assert visible_complete['visibleJourneys'] == 1
        assert visible_complete['valid']['ok'] is True

        # The same authoritative network can be compressed by player choice.
        walkable_page.evaluate('''() => {
          AXM.Game.world.ui.selectedPlaceId = 'place_school';
          AXM.Game.afterMutation('browser-walkable-select-compressed');
        }''')
        walkable_page.locator('[data-action="tab"][data-id="street"]').click()
        walkable_page.locator('[data-action="start-compressed-travel"][data-id="place_school"]').click()
        walkable_page.wait_for_timeout(100)
        walkable_complete = walkable_page.evaluate('''() => {
          const world = AXM.Game.world;
          const compressed = world.travelRecords.filter((entry) => entry.actorId === 'player' && entry.mode === 'compressed').slice(-1)[0];
          return {
            locationId: world.player.locationId,
            status: compressed && compressed.status,
            duration: compressed && compressed.route.durationMinutes,
            elapsed: compressed && compressed.elapsedMinutes,
            compressedJourneys: world.metrics.playerCompressedJourneys,
            age: world.player.age,
            ageDays: world.player.lifeCourse.ageDays,
            stage: world.player.lifeCourse.stage,
            travelCompressionAllowed: world.settings.travelCompressionAllowed,
            walkingObligation: world.settings.walkingObligation,
            hasWalkingStreak: Object.prototype.hasOwnProperty.call(world.player, 'walkingStreak') || Object.prototype.hasOwnProperty.call(world.metrics, 'walkingStreak'),
            valid: AXM.Systems.validateWorld(world)
          };
        }''')
        assert walkable_complete['locationId'] == 'place_school'
        assert walkable_complete['status'] == 'completed'
        assert walkable_complete['duration'] == walkable_complete['elapsed']
        assert walkable_complete['compressedJourneys'] == 1
        assert walkable_complete['age'] == walkable_initial['age']
        assert walkable_complete['ageDays'] == walkable_initial['ageDays']
        assert walkable_complete['stage'] == walkable_initial['stage']
        assert walkable_complete['travelCompressionAllowed'] is True
        assert walkable_complete['walkingObligation'] is False
        assert walkable_complete['hasWalkingStreak'] is False
        assert walkable_complete['valid']['ok'] is True
        walkable_page.close()
        browser.close()

    if page_errors or console_errors:
        print('Page errors:', page_errors)
        print('Console errors:', console_errors)
        return 1
    print('PASS browser smoke test: 17-view navigation including building shells and lived-building presence, life/work/build flows, read-only resident interiors, autonomous stewardship, adult household consent, unilateral separation, fresh-world family continuity, dependent agency, care evidence, refusal-safe family proposals, life-stage transition, casual basics compression, refusal-safe community invitations, no-deadline adventures, choice-first no-aging time, undated personal directions across explicit life chapters, pause/resume/release freedom, optional resident enterprise, actual resident customers, entered/compressed enterprise work, graceful pause/resume/closure, unique exterior addresses, connected minute-level visible travel, observation-only street moments, equally authoritative compressed travel, no walking obligation or streak, object continuity, and export/import controls.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
