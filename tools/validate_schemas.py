#!/usr/bin/env python3
"""Validate bundled Draft 2020-12 schemas against generated v0.11 evidence."""
from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any, Iterable

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print('ERROR: Python package jsonschema is required for this development QA command.', file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / 'schemas'
EXAMPLES = ROOT / 'examples'


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def residential_properties(world: dict[str, Any]) -> list[dict[str, Any]]:
    return [place for place in world.get('places', []) if place.get('kind') == 'residential']


def residential_habitats(world: dict[str, Any]) -> list[dict[str, Any]]:
    return [place['habitat'] for place in residential_properties(world) if isinstance(place.get('habitat'), dict)]


def property_stewardship_records(world: dict[str, Any]) -> list[dict[str, Any]]:
    return [place['stewardship'] for place in residential_properties(world) if isinstance(place.get('stewardship'), dict)]


def place_exteriors(world: dict[str, Any]) -> list[dict[str, Any]]:
    return [place['exterior'] for place in world.get('places', []) if isinstance(place.get('exterior'), dict)]


def construction_projects(world: dict[str, Any]) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    for habitat in residential_habitats(world):
        projects.extend(habitat.get('projects', []))
    return projects


def household_agreements(world: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        household['agreement']
        for household in world.get('households', [])
        if isinstance(household.get('agreement'), dict)
    ]


def room_permissions(world: dict[str, Any]) -> list[dict[str, Any]]:
    permissions: list[dict[str, Any]] = []
    for agreement in household_agreements(world):
        permissions.extend(agreement.get('space', {}).get('roomPermissions') or [])
    return permissions


def life_course_records(world: dict[str, Any]) -> list[dict[str, Any]]:
    people = [world.get('player'), *world.get('people', [])]
    return [person['lifeCourse'] for person in people if isinstance(person, dict) and isinstance(person.get('lifeCourse'), dict)]


def validate_many(schema_name: str, values: Iterable[Any], label: str) -> int:
    values = list(values)
    validator = Draft202012Validator(load(SCHEMAS / schema_name))
    for index, value in enumerate(values):
        errors = sorted(validator.iter_errors(value), key=lambda error: list(error.path))
        if errors:
            first = errors[0]
            location = '.'.join(str(part) for part in first.absolute_path) or '<root>'
            raise AssertionError(f'{label}[{index}] failed {schema_name} at {location}: {first.message}')
    print(f'PASS {label}: {schema_name} ({len(values)})')
    return len(values)


def validate_world(path: Path, schema_name: str = 'world-v0.11.0.schema.json') -> dict[str, Any]:
    world = load(path)
    errors = sorted(
        Draft202012Validator(load(SCHEMAS / schema_name)).iter_errors(world),
        key=lambda error: list(error.path),
    )
    if errors:
        first = errors[0]
        location = '.'.join(str(part) for part in first.absolute_path) or '<root>'
        raise AssertionError(f'{path.name} failed {schema_name} at {location}: {first.message}')
    print(f'PASS exported world: {path.name} against {schema_name}')
    return world


def main() -> int:
    schema_files = sorted(SCHEMAS.glob('*.schema.json'))
    if not schema_files:
        print('ERROR: no schema files found.', file=sys.stderr)
        return 1

    for path in schema_files:
        Draft202012Validator.check_schema(load(path))
        print(f'PASS schema definition: {path.name}')

    world_paths = [
        EXAMPLES / 'AXM_100_DAY_OBSERVER_SNAPSHOT.json',
        EXAMPLES / 'AXM_HOUSEHOLD_AGREEMENT_180_DAY_WORLD.json',
        EXAMPLES / 'AXM_STRUCTURAL_HABITAT_WORLD.json',
        EXAMPLES / 'AXM_AUTONOMOUS_STEWARDSHIP_WORLD.json',
        EXAMPLES / 'AXM_FAMILY_CONTINUITY_WORLD.json',
        EXAMPLES / 'AXM_COMMUNITY_ADVENTURES_WORLD.json',
        EXAMPLES / 'AXM_PERSONAL_DIRECTIONS_WORLD.json',
        EXAMPLES / 'AXM_LOCAL_ECONOMY_WORLD.json',
        EXAMPLES / 'AXM_WALKABLE_PLACES_WORLD.json',
        EXAMPLES / 'AXM_BUILDING_SHELLS_WORLD.json',
        EXAMPLES / 'AXM_LIVED_BUILDINGS_WORLD.json',
    ]
    worlds = [validate_world(path) for path in world_paths]
    observer_world, household_world, structural_world, stewardship_world, family_world, community_world, directions_world, economy_world, walkable_world, shell_world, lived_world = worlds

    structural_record = load(EXAMPLES / 'AXM_STRUCTURAL_HABITAT_RECORD.json')
    intention_record = load(EXAMPLES / 'AXM_AUTONOMOUS_STEWARDSHIP_INTENTION_RECORD.json')
    request_record = load(EXAMPLES / 'AXM_AUTONOMOUS_STEWARDSHIP_REQUEST_RECORD.json')
    property_record = load(EXAMPLES / 'AXM_AUTONOMOUS_STEWARDSHIP_PROPERTY_RECORD.json')
    family_unit_record = load(EXAMPLES / 'AXM_FAMILY_UNIT_RECORD.json')
    family_proposal_record = load(EXAMPLES / 'AXM_FAMILY_PROPOSAL_RECORD.json')
    care_record = load(EXAMPLES / 'AXM_CARE_RECORD.json')
    life_course_record = load(EXAMPLES / 'AXM_LIFE_COURSE_RECORD.json')
    community_institution_record = load(EXAMPLES / 'AXM_COMMUNITY_INSTITUTION_RECORD.json')
    community_opportunity_record = load(EXAMPLES / 'AXM_COMMUNITY_OPPORTUNITY_RECORD.json')
    community_connection_record = load(EXAMPLES / 'AXM_COMMUNITY_CONNECTION_RECORD.json')
    adventure_thread_record = load(EXAMPLES / 'AXM_ADVENTURE_THREAD_RECORD.json')
    personal_project_record = load(EXAMPLES / 'AXM_PERSONAL_PROJECT_RECORD.json')
    choice_first_life_course_record = load(EXAMPLES / 'AXM_CHOICE_FIRST_LIFE_COURSE_RECORD.json')
    local_need_record = load(EXAMPLES / 'AXM_LOCAL_NEED_RECORD.json')
    commercial_premise_record = load(EXAMPLES / 'AXM_COMMERCIAL_PREMISE_RECORD.json')
    enterprise_record = load(EXAMPLES / 'AXM_ENTERPRISE_RECORD.json')
    enterprise_equipment_record = load(EXAMPLES / 'AXM_ENTERPRISE_EQUIPMENT_RECORD.json')
    enterprise_session_record = load(EXAMPLES / 'AXM_ENTERPRISE_SESSION_RECORD.json')
    enterprise_work_offer_record = load(EXAMPLES / 'AXM_ENTERPRISE_WORK_OFFER_RECORD.json')
    place_exterior_record = load(EXAMPLES / 'AXM_PLACE_EXTERIOR_RECORD.json')
    street_network_record = load(EXAMPLES / 'AXM_STREET_NETWORK_RECORD.json')
    travel_record = load(EXAMPLES / 'AXM_TRAVEL_RECORD.json')
    street_moment_record = load(EXAMPLES / 'AXM_STREET_MOMENT_RECORD.json')
    building_shell_record = load(EXAMPLES / 'AXM_BUILDING_SHELL_RECORD.json')
    frontage_proposal_record = load(EXAMPLES / 'AXM_FRONTAGE_PROPOSAL_RECORD.json')
    frontage_project_record = load(EXAMPLES / 'AXM_FRONTAGE_PROJECT_RECORD.json')
    lived_presence_record = load(EXAMPLES / 'AXM_LIVED_PRESENCE_RECORD.json')
    indoor_movement_record = load(EXAMPLES / 'AXM_INDOOR_MOVEMENT_RECORD.json')
    ordinary_encounter_record = load(EXAMPLES / 'AXM_ORDINARY_ENCOUNTER_RECORD.json')
    presence_access_grant_record = load(EXAMPLES / 'AXM_PRESENCE_ACCESS_GRANT_RECORD.json')

    record_count = 0
    for name, world in zip(['observer', 'household', 'structural', 'stewardship', 'family', 'community', 'directions', 'economy', 'walkable', 'shell', 'lived'], worlds):
        record_count += validate_many(
            'structural-habitat-v0.4.0.schema.json',
            residential_habitats(world),
            f'{name}-world habitats',
        )
    record_count += validate_many(
        'structural-habitat-v0.4.0.schema.json',
        [structural_record],
        'standalone habitat record',
    )

    all_projects = [project for world in worlds for project in construction_projects(world)]
    record_count += validate_many(
        'construction-project-v0.4.0.schema.json',
        all_projects,
        'construction projects across exported worlds',
    )

    agreements = household_agreements(household_world)
    record_count += validate_many(
        'household-agreement-v0.3.0.schema.json',
        agreements,
        'household agreements',
    )
    record_count += validate_many(
        'household-proposal-v0.3.0.schema.json',
        household_world.get('householdProposals', []),
        'household proposals',
    )
    record_count += validate_many(
        'household-issue-v0.3.0.schema.json',
        household_world.get('householdIssues', []),
        'household issues',
    )
    record_count += validate_many(
        'room-permission-v0.3.0.schema.json',
        room_permissions(household_world),
        'graph room permissions',
    )

    all_intentions = [entry for world in worlds for entry in world.get('habitatIntentions', [])]
    all_requests = [entry for world in worlds for entry in world.get('stewardshipRequests', [])]
    all_property_records = [entry for world in worlds for entry in property_stewardship_records(world)]
    record_count += validate_many(
        'habitat-intention-v0.4.0.schema.json',
        [*all_intentions, intention_record],
        'habitat intentions',
    )
    record_count += validate_many(
        'stewardship-request-v0.4.0.schema.json',
        [*all_requests, request_record],
        'stewardship requests',
    )
    record_count += validate_many(
        'property-stewardship-v0.4.0.schema.json',
        [*all_property_records, property_record],
        'property stewardship records',
    )

    all_life_courses = [record for world in worlds for record in life_course_records(world)]
    all_family_units = [entry for world in worlds for entry in world.get('familyUnits', [])]
    all_family_proposals = [entry for world in worlds for entry in world.get('familyProposals', [])]
    all_care_records = [entry for world in worlds for entry in world.get('careRecords', [])]
    record_count += validate_many(
        'life-course-v0.5.0.schema.json',
        [*all_life_courses, life_course_record, choice_first_life_course_record],
        'preserved life-course records',
    )
    record_count += validate_many(
        'choice-first-life-course-v0.7.0.schema.json',
        [*all_life_courses, choice_first_life_course_record],
        'choice-first life-course extensions',
    )
    record_count += validate_many(
        'family-unit-v0.5.0.schema.json',
        [*all_family_units, family_unit_record],
        'family units',
    )
    record_count += validate_many(
        'family-proposal-v0.5.0.schema.json',
        [*all_family_proposals, family_proposal_record],
        'family proposals',
    )
    record_count += validate_many(
        'care-record-v0.5.0.schema.json',
        [*all_care_records, care_record],
        'care records',
    )

    all_institutions = [entry for world in worlds for entry in world.get('communityInstitutions', [])]
    all_opportunities = [entry for world in worlds for entry in world.get('communityOpportunities', [])]
    all_connections = [entry for world in worlds for entry in world.get('communityConnections', [])]
    all_adventures = [entry for world in worlds for entry in world.get('adventureThreads', [])]
    record_count += validate_many(
        'community-institution-v0.6.0.schema.json',
        [*all_institutions, community_institution_record],
        'community institutions',
    )
    record_count += validate_many(
        'community-opportunity-v0.6.0.schema.json',
        [*all_opportunities, community_opportunity_record],
        'community opportunities',
    )
    record_count += validate_many(
        'community-connection-v0.6.0.schema.json',
        [*all_connections, community_connection_record],
        'community connections',
    )
    record_count += validate_many(
        'adventure-thread-v0.6.0.schema.json',
        [*all_adventures, adventure_thread_record],
        'adventure threads',
    )


    all_personal_projects = [entry for world in worlds for entry in world.get('personalProjects', [])]
    record_count += validate_many(
        'personal-project-v0.7.0.schema.json',
        [*all_personal_projects, personal_project_record],
        'personal directions',
    )

    all_local_needs = [entry for world in worlds for entry in world.get('localNeeds', [])]
    all_commercial_premises = [
        place for world in worlds for place in world.get('places', [])
        if place.get('kind') == 'commercial'
    ]
    all_enterprises = [entry for world in worlds for entry in world.get('enterprises', [])]
    all_equipment = [equipment for enterprise in all_enterprises for equipment in enterprise.get('equipment', [])]
    all_enterprise_sessions = [entry for world in worlds for entry in world.get('enterpriseSessions', [])]
    all_work_offers = [entry for world in worlds for entry in world.get('enterpriseWorkOffers', [])]
    record_count += validate_many(
        'local-need-v0.8.0.schema.json',
        [*all_local_needs, local_need_record],
        'local need signals',
    )
    record_count += validate_many(
        'commercial-premise-v0.8.0.schema.json',
        [*all_commercial_premises, commercial_premise_record],
        'commercial premises',
    )
    record_count += validate_many(
        'enterprise-v0.8.0.schema.json',
        [*all_enterprises, enterprise_record],
        'resident enterprise directions',
    )
    record_count += validate_many(
        'enterprise-equipment-v0.8.0.schema.json',
        [*all_equipment, enterprise_equipment_record],
        'enterprise equipment objects',
    )
    record_count += validate_many(
        'enterprise-session-v0.8.0.schema.json',
        [*all_enterprise_sessions, enterprise_session_record],
        'enterprise sessions',
    )
    record_count += validate_many(
        'enterprise-work-offer-v0.8.0.schema.json',
        [*all_work_offers, enterprise_work_offer_record],
        'bounded enterprise work offers',
    )

    all_exteriors = [record for world in worlds for record in place_exteriors(world)]
    all_networks = [world.get('streetNetwork') for world in worlds if isinstance(world.get('streetNetwork'), dict)]
    all_travel_records = [entry for world in worlds for entry in world.get('travelRecords', [])]
    all_street_moments = [entry for world in worlds for entry in world.get('streetMoments', [])]
    record_count += validate_many(
        'place-exterior-v0.9.0.schema.json',
        [*all_exteriors, place_exterior_record],
        'place exterior identities',
    )
    record_count += validate_many(
        'street-network-v0.9.0.schema.json',
        [*all_networks, street_network_record],
        'pedestrian street networks',
    )
    record_count += validate_many(
        'travel-record-v0.9.0.schema.json',
        [*all_travel_records, travel_record],
        'travel records',
    )
    record_count += validate_many(
        'street-moment-v0.9.0.schema.json',
        [*all_street_moments, street_moment_record],
        'observation-only street moments',
    )


    all_buildings = [entry for world in worlds for entry in world.get('buildings', [])]
    all_frontage_proposals = [entry for world in worlds for entry in world.get('frontageProposals', [])]
    all_frontage_projects = [entry for world in worlds for entry in world.get('frontageProjects', [])]
    record_count += validate_many(
        'building-shell-v0.10.0.schema.json',
        [*all_buildings, building_shell_record],
        'building shells',
    )
    record_count += validate_many(
        'frontage-proposal-v0.10.0.schema.json',
        [*all_frontage_proposals, frontage_proposal_record],
        'resident frontage proposals',
    )
    record_count += validate_many(
        'frontage-project-v0.10.0.schema.json',
        [*all_frontage_projects, frontage_project_record],
        'resident frontage projects',
    )

    all_presence_snapshots = [entry for world in worlds for entry in world.get('presenceByPerson', {}).values()]
    all_indoor_movements = [entry for world in worlds for entry in world.get('presenceRecords', [])]
    all_ordinary_encounters = [entry for world in worlds for entry in world.get('ordinaryEncounters', [])]
    all_presence_grants = [entry for world in worlds for entry in world.get('presenceAccessGrants', [])]
    record_count += validate_many(
        'lived-presence-v0.11.0.schema.json',
        [*all_presence_snapshots, lived_presence_record],
        'bounded current-presence snapshots',
    )
    record_count += validate_many(
        'indoor-movement-v0.11.0.schema.json',
        [*all_indoor_movements, indoor_movement_record],
        'lawful indoor movement records',
    )
    record_count += validate_many(
        'ordinary-encounter-v0.11.0.schema.json',
        [*all_ordinary_encounters, ordinary_encounter_record],
        'refusal-safe ordinary encounters',
    )
    record_count += validate_many(
        'presence-access-grant-v0.11.0.schema.json',
        [*all_presence_grants, presence_access_grant_record],
        'bounded shared-space access grants',
    )

    observer_metrics = load(EXAMPLES / 'AXM_100_DAY_METRICS.json')
    observer_evidence = observer_metrics.get('observerEvidence', {})
    observer_report = {
        'before': observer_metrics.get('before', {}),
        'after': observer_metrics.get('after', {}),
        'changedPropertyCount': observer_evidence.get('changedPropertyCount', 0),
        'changedPropertyIds': observer_evidence.get('changedPropertyIds', []),
        'changedProperties': observer_evidence.get('changedProperties', []),
        'validation': observer_metrics.get('validation', {}),
    }
    record_count += validate_many(
        'observer-report-v0.4.0.schema.json',
        [observer_report],
        'observer reports',
    )

    print(
        f'\nPASS: {len(schema_files)}/{len(schema_files)} schema definitions, '
        f'{len(worlds)} exported worlds, and {record_count} v0.11-compatible records validated.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
