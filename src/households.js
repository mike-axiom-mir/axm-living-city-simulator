(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  const PROPOSAL_TYPES = [
    'commitment',
    'cohabitation',
    'finance',
    'space',
    'relocation',
    'goal',
    'renovation'
  ];
  const PROPOSAL_STATUSES = [
    'pending_npc',
    'awaiting_player',
    'accepted',
    'implemented',
    'countered',
    'declined',
    'withdrawn',
    'expired',
    'failed'
  ];
  const FINANCE_MODES = ['equal', 'income_weighted', 'player_covers_more', 'partner_covers_more', 'separate'];
  const SPACE_MODES = ['mostly_shared', 'private_edges_shared_center', 'strong_private'];
  const GOAL_TYPES = ['shared_safety_fund', 'improve_home', 'move_to_better_home', 'protect_free_time'];
  const REPAIR_APPROACHES = ['listen', 'practical_plan', 'give_space'];
  const RENOVATION_KINDS = ['partner_recolor', 'partner_upgrade', 'structural_project'];

  const METRIC_DEFAULTS = {
    householdProposals: 0,
    householdProposalsAccepted: 0,
    householdProposalsDeclined: 0,
    householdCounteroffers: 0,
    householdAgreementsCreated: 0,
    householdRenegotiations: 0,
    householdConflicts: 0,
    householdRepairs: 0,
    householdRelocations: 0,
    householdReserveContributions: 0,
    householdSharedExpensePayments: 0,
    npcHouseholdInitiatives: 0,
    householdRenovations: 0,
    householdSeparations: 0
  };

  function ensureState(world) {
    if (!Array.isArray(world.households)) world.households = [];
    if (!Array.isArray(world.householdProposals)) world.householdProposals = [];
    if (!Array.isArray(world.householdIssues)) world.householdIssues = [];
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    Object.entries(METRIC_DEFAULTS).forEach(([key, value]) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = value;
    });
    if (!world.player) return world;
    if (world.player.householdId === undefined) world.player.householdId = null;
    world.people.forEach((person) => {
      if (person.householdId === undefined) person.householdId = null;
      if (!Number.isFinite(person.householdInitiativeCooldownUntil)) person.householdInitiativeCooldownUntil = 0;
    });
    if (!world.ui) world.ui = {};
    if (world.ui.selectedHouseholdId === undefined) world.ui.selectedHouseholdId = null;
    if (world.ui.selectedProposalId === undefined) world.ui.selectedProposalId = null;
    if (world.ui.selectedIssueId === undefined) world.ui.selectedIssueId = null;
    if (!world.flags) world.flags = {};
    if (world.flags.householdExperimentPrepared === undefined) world.flags.householdExperimentPrepared = false;
    return world;
  }

  function householdById(world, householdId) {
    ensureState(world);
    return world.households.find((entry) => entry.id === householdId) || null;
  }

  function proposalById(world, proposalId) {
    ensureState(world);
    return world.householdProposals.find((entry) => entry.id === proposalId) || null;
  }

  function issueById(world, issueId) {
    ensureState(world);
    return world.householdIssues.find((entry) => entry.id === issueId) || null;
  }

  function playerHousehold(world) {
    ensureState(world);
    const pointer = world.player.householdId;
    const byPointer = pointer ? householdById(world, pointer) : null;
    if (byPointer && byPointer.status !== 'ended') return byPointer;
    return world.households.find((entry) => entry.status !== 'ended' && entry.memberIds.includes('player')) || null;
  }

  function partnerIdFor(household) {
    return household?.memberIds.find((id) => id !== 'player') || null;
  }

  function partnerFor(world, household) {
    return World.getPerson(world, partnerIdFor(household));
  }

  function isCohabiting(world, household) {
    if (!household || household.status !== 'active' || !household.homePropertyId) return false;
    const partnerId = partnerIdFor(household);
    return world.player.homePropertyId === household.homePropertyId
      && World.getPerson(world, partnerId)?.homePropertyId === household.homePropertyId;
  }

  function appendHouseholdHistory(world, household, type, message, details = {}) {
    if (!Array.isArray(household.history)) household.history = [];
    const entry = {
      id: Core.uniqueId(world, 'household_event'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      proposalId: details.proposalId || null,
      issueId: details.issueId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    household.history.push(entry);
    if (household.history.length > 500) household.history.splice(0, household.history.length - 500);
    return entry;
  }

  function appendProposalHistory(world, proposal, type, message, details = {}) {
    if (!Array.isArray(proposal.history)) proposal.history = [];
    const entry = {
      id: Core.uniqueId(world, 'proposal_event'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorId: details.actorId || null,
      evidence: details.evidence || null
    };
    proposal.history.push(entry);
    return entry;
  }

  function appendIssueHistory(world, issue, type, message, details = {}) {
    if (!Array.isArray(issue.history)) issue.history = [];
    const entry = {
      id: Core.uniqueId(world, 'issue_event'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorId: details.actorId || null,
      evidence: details.evidence || null
    };
    issue.history.push(entry);
    return entry;
  }

  function getPlayerRelation(world, npcId) {
    return Systems.getRelation(world.player, npcId);
  }

  function syncMutualStatus(world, npc, relation) {
    const reverse = Systems.getRelation(npc, 'player');
    reverse.status = relation.status;
    reverse.friendship = Core.clamp(Core.round(relation.friendship * 0.9, 1), -100, 100);
    reverse.trust = Core.clamp(Core.round(relation.trust * 0.9, 1), -100, 100);
    reverse.romance = Core.clamp(Core.round(relation.romance * 0.92, 1), -100, 100);
    return reverse;
  }

  function computeFinancialShares(world, household, modeOverride = null) {
    const partner = partnerFor(world, household);
    if (!partner) return { player: 1 };
    const mode = modeOverride || household.agreement.finances.mode;
    let playerShare = 0.5;
    if (mode === 'income_weighted') {
      const playerIncome = Math.max(1, Systems.playerMonthlyIncome(world));
      const partnerIncome = Math.max(1, Systems.npcMonthlyIncome(partner));
      playerShare = Core.clamp(playerIncome / (playerIncome + partnerIncome), 0.3, 0.7);
    } else if (mode === 'player_covers_more') {
      playerShare = 0.65;
    } else if (mode === 'partner_covers_more') {
      playerShare = 0.35;
    }
    return {
      player: Core.round(playerShare, 4),
      [partner.id]: Core.round(1 - playerShare, 4)
    };
  }

  function defaultAgreement(world, partnerId, terms = {}) {
    const placeholder = {
      memberIds: ['player', partnerId],
      agreement: { finances: { mode: terms.financeMode || 'income_weighted' } }
    };
    return {
      commitment: 'partner',
      finances: {
        mode: terms.financeMode || 'income_weighted',
        shares: computeFinancialShares(world, placeholder, terms.financeMode || 'income_weighted'),
        weeklyReserveTarget: Core.clamp(Core.safeNumber(terms.weeklyReserveTarget, 10), 0, 120),
        personalAccountsRemainSeparate: true,
        sharedReserveRequiresMutualConsent: true
      },
      space: {
        mode: terms.spaceMode || 'private_edges_shared_center',
        editPolicy: 'owner_or_accepted_proposal',
        zones: [],
        roomPermissions: [],
        roomGraphRevision: null
      },
      relocation: {
        requiresUnanimousConsent: true,
        noUnilateralDisplacement: true
      },
      renovation: {
        partnerObjectsRequireOwnerConsent: true,
        commonChangesRequireAcceptedProposal: true
      },
      goals: [],
      dissolution: {
        exitIsUnilateral: true,
        noForcedEviction: true,
        reserveRule: 'recorded_contributions_or_equal'
      }
    };
  }

  function refreshSpaceZones(world, household) {
    const property = World.getProperty(world, household.homePropertyId);
    if (!property || !isCohabiting(world, household)) {
      household.agreement.space.zones = [];
      return [];
    }
    const partner = partnerFor(world, household);
    const [gridW, gridH] = property.roomGrid;
    const mode = household.agreement.space.mode;
    let privateWidth = 1;
    if (mode === 'private_edges_shared_center') privateWidth = Math.max(1, Math.floor(gridW * 0.23));
    if (mode === 'strong_private') privateWidth = Math.max(1, Math.floor(gridW * 0.34));
    privateWidth = Math.min(privateWidth, Math.max(1, Math.floor((gridW - 1) / 2)));
    const commonWidth = Math.max(1, gridW - privateWidth * 2);
    household.agreement.space.zones = [
      { id: `${household.id}_zone_player`, kind: 'player_private', label: 'Your private zone', holderIds: ['player'], rect: { x: 0, y: 0, w: privateWidth, h: gridH } },
      { id: `${household.id}_zone_common`, kind: 'common', label: 'Common zone', holderIds: ['player', partner.id], rect: { x: privateWidth, y: 0, w: commonWidth, h: gridH } },
      { id: `${household.id}_zone_partner`, kind: 'partner_private', label: `${partner.name}'s private zone`, holderIds: [partner.id], rect: { x: privateWidth + commonWidth, y: 0, w: privateWidth, h: gridH } }
    ];
    AXM.Habitats?.syncHouseholdRoomPermissions(world, household, mode);
    return household.agreement.space.zones;
  }

  function zonesForProperty(world, propertyId) {
    const household = playerHousehold(world);
    if (!household || household.homePropertyId !== propertyId || !isCohabiting(world, household)) return [];
    if (!Array.isArray(household.agreement.space.zones) || !household.agreement.space.zones.length) refreshSpaceZones(world, household);
    return household.agreement.space.zones;
  }

  function zoneAtCell(zones, x, y) {
    return zones.find((zone) => x >= zone.rect.x && x < zone.rect.x + zone.rect.w && y >= zone.rect.y && y < zone.rect.y + zone.rect.h) || null;
  }

  function placementPermission(world, property, actorId, object, x, y, footprint = object.footprint) {
    if (AXM.Habitats?.placementPermission && property?.habitat) {
      return AXM.Habitats.placementPermission(world, property, actorId, object, x, y, footprint);
    }
    const zones = zonesForProperty(world, property.id);
    if (!zones.length) return { ok: true, zoneKinds: [] };
    const household = playerHousehold(world);
    if (!household?.memberIds.includes(actorId)) return { ok: true, zoneKinds: [] };
    const partnerId = partnerIdFor(household);
    const forbiddenKind = actorId === 'player' ? 'partner_private' : actorId === partnerId ? 'player_private' : null;
    const kinds = new Set();
    for (let dy = 0; dy < footprint[1]; dy += 1) {
      for (let dx = 0; dx < footprint[0]; dx += 1) {
        const zone = zoneAtCell(zones, x + dx, y + dy);
        if (zone) kinds.add(zone.kind);
        if (zone?.kind === forbiddenKind) {
          return {
            ok: false,
            reason: actorId === 'player'
              ? `${partnerFor(world, household).name}'s private zone requires their agreement.`
              : 'The placement would cross into the player-private zone.',
            zoneKinds: Array.from(kinds)
          };
        }
      }
    }
    return { ok: true, zoneKinds: Array.from(kinds) };
  }

  function canPlacePlayerObject(world, property, object, x, y, footprint = object.footprint) {
    return placementPermission(world, property, 'player', object, x, y, footprint);
  }

  function canPlaceNpcObject(world, property, npcId, object, x, y, footprint = object.footprint) {
    return placementPermission(world, property, npcId, object, x, y, footprint);
  }

  function rebalanceHouseholdObjects(world, household, reason = 'accepted household space agreement') {
    if (!household || !isCohabiting(world, household)) return { moved: 0, stored: 0 };
    const property = World.getProperty(world, household.homePropertyId);
    if (!property) return { moved: 0, stored: 0 };
    let moved = 0;
    let stored = 0;
    const memberIds = new Set(household.memberIds);
    const candidates = property.furniture.filter((object) => object.ownershipMode !== 'property_fixture' && memberIds.has(object.ownerId));
    candidates.forEach((object) => {
      const permission = object.ownerId === 'player'
        ? canPlacePlayerObject(world, property, object, object.position.x, object.position.y, object.footprint)
        : canPlaceNpcObject(world, property, object.ownerId, object, object.position.x, object.position.y, object.footprint);
      if (permission.ok) return;
      property.furniture = property.furniture.filter((entry) => entry.id !== object.id);
      const rule = object.ownerId === 'player'
        ? (x, y, footprint) => canPlacePlayerObject(world, property, object, x, y, footprint).ok
        : (x, y, footprint) => canPlaceNpcObject(world, property, object.ownerId, object, x, y, footprint).ok;
      if (World.addFurnitureToProperty(world, property, object, null, rule)) {
        moved += 1;
        Core.appendObjectHistory(world, object, 'agreement_reposition', `${World.personName(world, object.ownerId)}'s object was repositioned to honor the accepted private-space boundary.`, {
          actorId: object.ownerId,
          causes: [reason, 'object ownership preserved']
        });
      } else {
        const owner = World.getPerson(world, object.ownerId);
        if (!Array.isArray(owner.storedFurniture)) owner.storedFurniture = [];
        owner.storedFurniture.push(object);
        stored += 1;
        Core.appendObjectHistory(world, object, 'agreement_storage', `The object entered its owner's storage because no permitted floor position remained.`, {
          actorId: object.ownerId,
          causes: [reason, 'no-loss storage fallback']
        });
      }
    });
    if (moved || stored) {
      appendHouseholdHistory(world, household, 'space_rebalanced', `${moved} objects were repositioned and ${stored} stored so the accepted private zones became real permissions rather than decorative labels.`, {
        actorIds: household.memberIds,
        causes: [reason, 'private-zone enforcement'],
        evidence: { moved, stored, propertyId: property.id }
      });
    }
    return { moved, stored };
  }

  function eligibleJointMoveProperties(world, household) {
    if (!household) return [];
    const dependentIds = AXM.Family?.dependentIdsForHousehold(world, household) || [];
    const requiredCapacity = AXM.Family?.requiredCapacityForHousehold(world, household) || household.memberIds.length;
    const memberSet = new Set(household.memberIds.concat(dependentIds));
    return world.places.filter((property) => {
      if (property.kind !== 'residential' || property.capacity < requiredCapacity) return false;
      if (property.tenants.some((id) => !memberSet.has(id))) return false;
      if (property.ownerId !== 'player' && property.tenants.length === 0 && !property.listedForRent) return false;
      return true;
    }).sort((a, b) => a.currentRent - b.currentRent || b.condition - a.condition);
  }

  function validateProposalTerms(world, type, terms, household = null) {
    if (!PROPOSAL_TYPES.includes(type)) return { ok: false, reason: 'Unknown agreement proposal type.' };
    if (!terms || typeof terms !== 'object' || Array.isArray(terms)) return { ok: false, reason: 'Proposal terms must be a readable object.' };
    if (type === 'finance') {
      if (!FINANCE_MODES.includes(terms.mode)) return { ok: false, reason: 'Unknown expense-sharing mode.' };
      const reserve = Core.safeNumber(terms.weeklyReserveTarget, 0);
      if (reserve < 0 || reserve > 120) return { ok: false, reason: 'Weekly shared reserve must stay between €0 and €120.' };
    }
    if (type === 'space' && !SPACE_MODES.includes(terms.mode)) return { ok: false, reason: 'Unknown space-permission mode.' };
    if (type === 'goal') {
      if (!GOAL_TYPES.includes(terms.goalType)) return { ok: false, reason: 'Unknown household goal.' };
      if (!Number.isFinite(Number(terms.target)) || Number(terms.target) <= 0) return { ok: false, reason: 'Household goal needs a positive target.' };
    }
    if (['cohabitation', 'relocation'].includes(type)) {
      const property = World.getProperty(world, terms.destinationPropertyId);
      if (!property) return { ok: false, reason: 'The proposed destination does not exist.' };
      const targetHousehold = household || playerHousehold(world);
      if (!targetHousehold) return { ok: false, reason: 'A commitment agreement is required first.' };
      if (!eligibleJointMoveProperties(world, targetHousehold).some((entry) => entry.id === property.id)) {
        return { ok: false, reason: 'That home lacks pair capacity or contains residents whose consent is not modelled yet.' };
      }
    }
    if (type === 'renovation') {
      if (!RENOVATION_KINDS.includes(terms.kind)) return { ok: false, reason: 'Unknown renovation proposal.' };
      if (!household || !isCohabiting(world, household)) return { ok: false, reason: 'Renovation agreements require a shared home.' };
      const home = World.getProperty(world, household.homePropertyId);
      if (terms.kind === 'structural_project') {
        if (!AXM.Habitats) return { ok: false, reason: 'Structural habitat module is unavailable.' };
        if (terms.propertyId !== household.homePropertyId) return { ok: false, reason: 'A shared structural proposal must target the current shared home.' };
        const validation = AXM.Habitats.validateProjectSpec(world, home, terms.projectSpec, { forProposal: true });
        if (!validation.ok) return validation;
      } else {
        const object = home?.furniture.find((entry) => entry.id === terms.objectId);
        const partnerId = partnerIdFor(household);
        if (!object || object.ownerId !== partnerId || object.ownershipMode === 'property_fixture') {
          return { ok: false, reason: 'The proposal must target an object personally owned by your partner.' };
        }
        if (terms.kind === 'partner_recolor' && !Content.PALETTE.some((entry) => entry.id === terms.colorId)) return { ok: false, reason: 'Unknown finish color.' };
        if (terms.kind === 'partner_upgrade' && !Systems.UPGRADE_AXES.includes(terms.axis)) return { ok: false, reason: 'Unknown upgrade direction.' };
      }
    }
    return { ok: true };
  }

  function hasPendingProposal(world, householdId, type = null) {
    return world.householdProposals.some((proposal) => {
      const pending = ['pending_npc', 'awaiting_player'].includes(proposal.status);
      return pending && proposal.householdId === householdId && (!type || proposal.type === type);
    });
  }

  function createProposal(world, options) {
    ensureState(world);
    const type = options.type;
    const household = options.householdId ? householdById(world, options.householdId) : null;
    const validation = validateProposalTerms(world, type, options.terms || {}, household);
    if (!validation.ok) return validation;
    const recipientIds = Array.isArray(options.recipientIds) ? options.recipientIds.slice() : [];
    const status = options.proposerId === 'player' ? 'pending_npc' : 'awaiting_player';
    if (world.householdProposals.some((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status)
      && proposal.type === type
      && proposal.householdId === (options.householdId || null)
      && proposal.recipientIds.join('|') === recipientIds.join('|'))) {
      return { ok: false, reason: 'A proposal of this type is already waiting for a response.' };
    }
    const proposal = {
      id: Core.uniqueId(world, 'proposal'),
      householdId: options.householdId || null,
      type,
      proposerId: options.proposerId,
      recipientIds,
      status,
      terms: Core.deepClone(options.terms || {}),
      parentProposalId: options.parentProposalId || null,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      dueDay: status === 'pending_npc' ? world.time.day + Core.randomInt(world, 1, 2) : world.time.day,
      expiresDay: world.time.day + 14,
      response: null,
      history: []
    };
    world.householdProposals.push(proposal);
    appendProposalHistory(world, proposal, 'created', `${World.personName(world, proposal.proposerId)} created a ${Core.titleCase(type)} proposal.`, {
      actorId: proposal.proposerId,
      evidence: { terms: Core.deepClone(proposal.terms), dueDay: proposal.dueDay }
    });
    world.metrics.householdProposals += 1;
    if (proposal.proposerId !== 'player') world.metrics.npcHouseholdInitiatives += 1;
    Core.appendLedger(world, 'household', `${World.personName(world, proposal.proposerId)} proposed ${proposalSummary(world, proposal)}.`, {
      actorIds: [proposal.proposerId].concat(recipientIds),
      placeId: household?.homePropertyId || null,
      causes: ['explicit agreement proposal', 'no automatic consent'],
      evidence: { proposalId: proposal.id, terms: proposal.terms, responseDueDay: proposal.dueDay }
    });
    return { ok: true, proposal };
  }

  function proposalSummary(world, proposal) {
    const terms = proposal.terms || {};
    if (proposal.type === 'commitment') return 'a committed partnership';
    if (proposal.type === 'cohabitation') return `living together at ${World.getProperty(world, terms.destinationPropertyId)?.name || 'a shared home'}`;
    if (proposal.type === 'relocation') return `moving together to ${World.getProperty(world, terms.destinationPropertyId)?.name || 'another home'}`;
    if (proposal.type === 'finance') return `${Core.titleCase(terms.mode)} shared expenses with a ${Core.formatMoney(terms.weeklyReserveTarget || 0)} weekly reserve`;
    if (proposal.type === 'space') return `${Core.titleCase(terms.mode)} space permissions`;
    if (proposal.type === 'goal') return `${Core.titleCase(terms.goalType)} as a household goal`;
    if (proposal.type === 'renovation') {
      if (terms.kind === 'structural_project') return terms.summary || 'a phased structural habitat project';
      return terms.kind === 'partner_recolor' ? 'a new finish for a partner-owned object' : 'an upgrade to a partner-owned object';
    }
    return Core.titleCase(proposal.type);
  }

  function makePlayerProposal(world, options) {
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday before starting a household conversation.' };
    const result = createProposal(world, { ...options, proposerId: 'player' });
    if (!result.ok) return result;
    world.player.influenceActions += 1;
    Systems.advanceHours(world, 1);
    Systems.toast(world, `Proposal sent. ${World.personName(world, result.proposal.recipientIds[0])} will respond on day ${result.proposal.dueDay}.`, 'info');
    return result;
  }

  function proposeCommitment(world, npcId) {
    ensureState(world);
    if (playerHousehold(world)) return { ok: false, reason: 'An active partnership agreement already exists.' };
    const npc = World.getPerson(world, npcId);
    if (!npc || npc.id === 'player') return { ok: false, reason: 'Resident unavailable.' };
    const relation = getPlayerRelation(world, npc.id);
    if (!['dating', 'partner'].includes(relation.status) || relation.friendship < 50 || relation.trust < 38 || relation.romance < 30) {
      return { ok: false, reason: 'A mutual dating relationship with stronger trust is required before proposing commitment.' };
    }
    return makePlayerProposal(world, {
      type: 'commitment',
      recipientIds: [npc.id],
      terms: { commitment: 'partner', preserveSeparateAgency: true }
    });
  }

  function proposeCohabitation(world, npcId, destinationPropertyId) {
    ensureState(world);
    const household = playerHousehold(world);
    if (!household || partnerIdFor(household) !== npcId) return { ok: false, reason: 'A partnership agreement with this resident is required first.' };
    const type = isCohabiting(world, household) ? 'relocation' : 'cohabitation';
    return makePlayerProposal(world, {
      householdId: household.id,
      type,
      recipientIds: [npcId],
      terms: { destinationPropertyId }
    });
  }

  function proposeHouseholdChange(world, householdId, type, terms) {
    ensureState(world);
    const household = householdById(world, householdId);
    if (!household || !household.memberIds.includes('player') || household.status !== 'active') return { ok: false, reason: 'Active household agreement not found.' };
    if (!['finance', 'space', 'relocation', 'goal', 'renovation'].includes(type)) return { ok: false, reason: 'That change is not a supported household proposal.' };
    return makePlayerProposal(world, {
      householdId: household.id,
      type,
      recipientIds: [partnerIdFor(household)],
      terms
    });
  }

  function proposalScore(world, proposal) {
    const npcId = proposal.proposerId === 'player' ? proposal.recipientIds[0] : proposal.proposerId;
    const npc = World.getPerson(world, npcId);
    const relation = getPlayerRelation(world, npcId);
    const fit = Systems.playerNpcCompatibility(world, npc);
    const household = proposal.householdId ? householdById(world, proposal.householdId) : null;
    const factors = [];
    let score = 0;
    const add = (name, value, note) => {
      const rounded = Core.round(value, 1);
      score += rounded;
      factors.push({ name, value: rounded, note });
    };

    add('relationship foundation', relation.friendship * 0.18 + relation.trust * 0.26 + relation.romance * 0.2, 'friendship, trust, and romance');
    add('compatibility', fit * 0.16, 'known personality and preference fit');

    if (proposal.type === 'commitment') {
      add('stability preference', npc.traits.stability * 0.1, 'comfort with continuity');
      add('independence pressure', -npc.traits.independence * 0.11, 'commitment cannot erase independence');
      add('commitment baseline', 20, 'dating relationship is already established');
    }

    if (['cohabitation', 'relocation'].includes(proposal.type)) {
      const destination = World.getProperty(world, proposal.terms.destinationPropertyId);
      const combinedIncome = Math.max(1, Systems.playerMonthlyIncome(world) + Systems.npcMonthlyIncome(npc));
      const rentRatio = destination.currentRent / combinedIncome;
      const privacy = destination.tenants.every((id) => household?.memberIds.includes(id)) ? 12 : -24;
      const current = World.homeOf(world, npc.id);
      const conditionGain = destination.condition - (current?.condition || 70);
      add('destination affordability', Core.clamp(24 - rentRatio * 70, -25, 22), 'rent compared with combined income');
      add('pair privacy', privacy, 'no unrelated resident is displaced or silently included');
      add('home condition change', conditionGain * 0.28, 'visible condition compared with current home');
      add('independence pressure', -npc.traits.independence * 0.13, 'sharing a home changes personal space');
      add('stability preference', proposal.type === 'relocation' ? -npc.traits.stability * 0.08 : npc.traits.stability * 0.05, 'moving pace');
    }

    if (proposal.type === 'finance') {
      const mode = proposal.terms.mode;
      const reserve = Core.safeNumber(proposal.terms.weeklyReserveTarget, 0);
      if (mode === 'income_weighted') add('fairness fit', 14, 'contributions follow current income');
      if (mode === 'equal') add('simplicity fit', 8, 'equal shares are easy to understand');
      if (mode === 'player_covers_more') add('player support', Systems.playerMonthlyIncome(world) >= Systems.npcMonthlyIncome(npc) ? 12 : -8, 'higher earner covering more');
      if (mode === 'partner_covers_more') add('partner burden', Systems.npcMonthlyIncome(npc) > Systems.playerMonthlyIncome(world) * 1.25 ? 5 : -18, 'requested partner contribution');
      if (mode === 'separate') add('independence fit', npc.traits.independence * 0.13, 'keeps obligations separate');
      add('reserve affordability', Core.clamp(12 - reserve / 4, -18, 12), 'weekly reserve compared with ordinary cash flow');
      add('thrift fit', reserve > 0 ? npc.traits.thrift * 0.08 : -npc.traits.thrift * 0.04, 'saving preference');
    }

    if (proposal.type === 'space') {
      const mode = proposal.terms.mode;
      if (mode === 'strong_private') add('privacy fit', npc.traits.independence * 0.2, 'larger private zones');
      if (mode === 'private_edges_shared_center') add('balanced-space fit', 13 + Math.abs(55 - npc.traits.independence) * -0.04, 'clear private edges and common center');
      if (mode === 'mostly_shared') add('shared-space fit', npc.traits.social * 0.13 - npc.traits.independence * 0.1, 'more common floor area');
      add('trust in boundaries', relation.trust * 0.12, 'permission rules depend on trust');
    }

    if (proposal.type === 'goal') {
      const goal = proposal.terms.goalType;
      const target = Core.safeNumber(proposal.terms.target, 1);
      if (goal === 'shared_safety_fund') add('security fit', npc.traits.thrift * 0.13 + npc.traits.stability * 0.07, 'saving and stability preferences');
      if (goal === 'improve_home') add('home-making fit', npc.traits.creativity * 0.1 + npc.traits.neatness * 0.08, 'creative and maintenance preferences');
      if (goal === 'move_to_better_home') add('mobility fit', npc.traits.ambition * 0.09 - npc.traits.stability * 0.07, 'ambition versus attachment');
      if (goal === 'protect_free_time') add('wellbeing fit', (100 - npc.traits.ambition) * 0.09 + npc.traits.independence * 0.05, 'protecting time outside work');
      add('target pressure', Core.clamp(10 - Math.log10(Math.max(10, target)) * 4, -10, 8), 'larger targets require more commitment');
    }

    if (proposal.type === 'renovation') {
      const home = household ? World.getProperty(world, household.homePropertyId) : null;
      if (proposal.terms.kind === 'structural_project') {
        const spec = proposal.terms.projectSpec || {};
        add('shared-home authorship', 14, 'structure changes only after both residents agree');
        add('stability pressure', spec.type === 'partition' ? -npc.traits.stability * 0.05 : npc.traits.stability * 0.04, 'walls and doors change familiar circulation');
        add('creative fit', ['surface', 'partition'].includes(spec.type) ? npc.traits.creativity * 0.1 : npc.traits.thrift * 0.08, 'project direction compared with preferences');
        add('no instant mutation', 10, 'acceptance creates a phased project rather than changing the home immediately');
        if (spec.type === 'surface') {
          const finish = AXM.Habitats?.finishById(spec.target?.finishId);
          add('finish tone', npc.preferences.colors.some((colorId) => Content.paletteById(colorId).hex === finish?.color) ? 8 : 1, 'aesthetic fit remains bounded');
        }
      } else {
        const object = home?.furniture.find((entry) => entry.id === proposal.terms.objectId);
        if (proposal.terms.kind === 'partner_recolor') {
          add('color preference', npc.preferences.colors.includes(proposal.terms.colorId) ? 24 : -6, 'partner keeps final aesthetic authority');
          add('creative interest', npc.traits.creativity * 0.1, 'willingness to experiment');
        } else if (proposal.terms.kind === 'partner_upgrade') {
          const axisFit = proposal.terms.axis === 'beauty' ? npc.traits.creativity : proposal.terms.axis === 'durability' || proposal.terms.axis === 'efficiency' ? npc.traits.thrift : 55;
          add('upgrade preference', axisFit * 0.12, 'requested improvement matches priorities');
        }
        add('object attachment', Core.safeNumber(object?.sentimental, 0) * 0.05, 'the object remains theirs and keeps its history');
        add('owner consent baseline', 12, 'proposal does not directly edit their object');
      }
    }

    if (household) add('current household strain', -household.strain * 0.16, 'unresolved pressure reduces easy agreement');
    return { score: Core.clamp(Core.round(score, 1), 0, 100), factors, compatibility: fit };
  }

  function counterTerms(world, proposal, npc) {
    const terms = Core.deepClone(proposal.terms || {});
    if (proposal.type === 'finance') {
      terms.mode = 'income_weighted';
      terms.weeklyReserveTarget = Math.min(15, Math.max(0, Math.round(Core.safeNumber(terms.weeklyReserveTarget, 0) / 2)));
      return terms;
    }
    if (proposal.type === 'space') {
      terms.mode = npc.traits.independence > 68 ? 'strong_private' : 'private_edges_shared_center';
      return terms;
    }
    if (proposal.type === 'goal') {
      terms.target = Math.max(1, Math.round(Core.safeNumber(terms.target, 1) * 0.7));
      return terms;
    }
    if (['cohabitation', 'relocation'].includes(proposal.type)) {
      const household = householdById(world, proposal.householdId);
      const candidates = eligibleJointMoveProperties(world, household)
        .filter((property) => property.id !== proposal.terms.destinationPropertyId)
        .sort((a, b) => (a.currentRent - a.condition * 5) - (b.currentRent - b.condition * 5));
      if (candidates[0]) terms.destinationPropertyId = candidates[0].id;
      return terms;
    }
    if (proposal.type === 'renovation' && proposal.terms.kind === 'partner_recolor') {
      terms.colorId = npc.preferences.colors[0];
      return terms;
    }
    if (proposal.type === 'renovation' && proposal.terms.kind === 'partner_upgrade') {
      terms.axis = npc.traits.creativity > npc.traits.thrift ? 'beauty' : 'durability';
      return terms;
    }
    return null;
  }

  function decideProposal(world, proposal) {
    const npcId = proposal.recipientIds[0];
    const npc = World.getPerson(world, npcId);
    const scored = proposalScore(world, proposal);
    const roll = Core.randomInt(world, 0, 100);
    let decision = 'declined';
    if (scored.score >= 63 && scored.score - roll >= -12) decision = 'accepted';
    else if (proposal.type !== 'commitment' && scored.score >= 44 && scored.score - roll >= -28) decision = 'countered';
    return { decision, score: scored.score, roll, factors: scored.factors, compatibility: scored.compatibility, npcId: npc.id };
  }

  function createHousehold(world, npc, proposal) {
    if (playerHousehold(world)) return { ok: false, reason: 'A household agreement already exists.' };
    const relation = getPlayerRelation(world, npc.id);
    relation.status = 'partner';
    relation.romance = Math.max(45, relation.romance);
    syncMutualStatus(world, npc, relation);
    const household = {
      id: Core.uniqueId(world, 'household'),
      memberIds: ['player', npc.id],
      status: 'active',
      homePropertyId: world.player.homePropertyId === npc.homePropertyId ? world.player.homePropertyId : null,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      revision: 1,
      agreement: defaultAgreement(world, npc.id, proposal.terms),
      sharedReserve: 0,
      strain: 0,
      unresolvedIssueIds: [],
      lastConflictDay: world.time.day,
      lastReviewDay: world.time.day,
      nextNpcInitiativeDay: world.time.day + Core.randomInt(world, 8, 15),
      lastReserveWeek: -1,
      completedRelocations: 0,
      history: []
    };
    world.households.push(household);
    world.player.householdId = household.id;
    npc.householdId = household.id;
    if (household.homePropertyId) refreshSpaceZones(world, household);
    world.ui.selectedHouseholdId = household.id;
    world.metrics.householdAgreementsCreated += 1;
    appendHouseholdHistory(world, household, 'created', `${world.player.name} and ${npc.name} established a partnership agreement without merging identities or accounts.`, {
      actorIds: ['player', npc.id], proposalId: proposal.id,
      causes: ['mutual accepted commitment'],
      evidence: { personalAccountsRemainSeparate: true, revision: household.revision }
    });
    Core.appendLedger(world, 'household', `${world.player.name} and ${npc.name} became committed partners. Direct control did not change hands.`, {
      actorIds: ['player', npc.id], placeId: household.homePropertyId,
      causes: ['accepted commitment proposal', 'separate agency preserved'],
      evidence: { householdId: household.id, agreementRevision: 1 }
    });
    return { ok: true, household };
  }

  function payJointDeposit(world, household, amount) {
    if (amount <= 0) return { ok: true, payments: { player: 0, [partnerIdFor(household)]: 0 } };
    const partner = partnerFor(world, household);
    const shares = computeFinancialShares(world, household);
    let playerDue = Core.round(amount * shares.player, 2);
    let partnerDue = Core.round(amount - playerDue, 2);
    const flexible = household.agreement.finances.mode !== 'separate';
    if (world.player.money < playerDue && flexible) {
      const gap = playerDue - world.player.money;
      if (partner.money - partnerDue >= gap) {
        playerDue -= gap;
        partnerDue += gap;
      }
    }
    if (partner.money < partnerDue && flexible) {
      const gap = partnerDue - partner.money;
      if (world.player.money - playerDue >= gap) {
        partnerDue -= gap;
        playerDue += gap;
      }
    }
    if (world.player.money + 0.001 < playerDue || partner.money + 0.001 < partnerDue) {
      return { ok: false, reason: `The visible ${Core.formatMoney(amount)} deposit cannot be covered under the current contribution agreement.` };
    }
    world.player.money -= playerDue;
    world.player.lifetimeSpend += playerDue;
    partner.money -= partnerDue;
    return { ok: true, payments: { player: playerDue, [partner.id]: partnerDue } };
  }

  function movePlayerToProperty(world, destination, causes) {
    const origin = World.homeOf(world, 'player');
    if (origin?.id === destination.id) return { ok: true, movedObjects: 0, origin };
    if (destination.tenants.length >= destination.capacity) return { ok: false, reason: 'No capacity remains for the player.' };
    let movedObjects = 0;
    if (origin) {
      origin.tenants = origin.tenants.filter((id) => id !== 'player');
      origin.listedForRent = origin.tenants.length < origin.capacity;
      movedObjects = Systems.transferPersonalFurniture(world, 'player', origin, destination);
      Core.appendPropertyHistory(world, origin, 'move_out', `${world.player.name} moved out through a mutually accepted household relocation.`, {
        actorIds: ['player'], causes
      });
    }
    if (!destination.tenants.includes('player')) destination.tenants.push('player');
    destination.listedForRent = destination.tenants.length < destination.capacity;
    world.player.homePropertyId = destination.id;
    world.player.locationId = destination.id;
    world.metrics.totalMoves += 1;
    world.metrics.playerMoves += 1;
    Core.appendPropertyHistory(world, destination, 'move_in', `${world.player.name} moved in through a mutually accepted household relocation.`, {
      actorIds: ['player'], causes
    });
    return { ok: true, movedObjects, origin };
  }

  function executeJointMove(world, household, destinationPropertyId, proposal) {
    const destination = World.getProperty(world, destinationPropertyId);
    const eligible = eligibleJointMoveProperties(world, household).some((entry) => entry.id === destinationPropertyId);
    if (!destination || !eligible) return { ok: false, reason: 'The destination no longer satisfies capacity and consent boundaries.' };
    const partner = partnerFor(world, household);
    const pairAlreadyThere = world.player.homePropertyId === destination.id && partner.homePropertyId === destination.id;
    const externalRental = destination.ownerId !== 'player';
    const depositRequired = externalRental && !destination.tenants.some((id) => household.memberIds.includes(id)) ? destination.currentRent : 0;
    const deposit = payJointDeposit(world, household, depositRequired);
    if (!deposit.ok) return deposit;

    const causes = ['accepted joint relocation proposal', 'no resident displaced', 'visible contribution agreement'];
    const playerMove = movePlayerToProperty(world, destination, causes);
    if (!playerMove.ok) return playerMove;
    let partnerMove = { ok: true };
    if (partner.homePropertyId !== destination.id) {
      partnerMove = Systems.moveNpc(world, partner, destination, { waiveCost: true, causes });
      if (!partnerMove.ok) return partnerMove;
    }

    const familyMove = AXM.Family?.syncAfterHouseholdMove(world, household, destination, proposal) || { ok: true };
    if (!familyMove.ok) return familyMove;
    household.homePropertyId = destination.id;
    household.completedRelocations += pairAlreadyThere ? 0 : 1;
    household.lastReviewDay = world.time.day;
    household.strain = Math.max(0, household.strain - 4);
    refreshSpaceZones(world, household);
    const rebalance = rebalanceHouseholdObjects(world, household, 'accepted joint relocation');
    world.ui.viewPropertyId = destination.id;
    world.metrics.householdRelocations += pairAlreadyThere ? 0 : 1;
    appendHouseholdHistory(world, household, pairAlreadyThere ? 'cohabitation_confirmed' : 'relocation', `${world.player.name} and ${partner.name} established their shared home at ${destination.name}.`, {
      actorIds: household.memberIds,
      proposalId: proposal.id,
      causes,
      evidence: { destinationPropertyId, deposit: depositRequired, depositPayments: deposit.payments }
    });
    Core.appendLedger(world, 'household', `${world.player.name} and ${partner.name} moved together to ${destination.name}.`, {
      actorIds: household.memberIds, placeId: destination.id,
      causes,
      evidence: { proposalId: proposal.id, deposit: depositRequired, contributions: deposit.payments }
    });
    return { ok: true, destination, depositPayments: deposit.payments };
  }

  function recordAgreementRevision(world, household, proposal, message, evidence = {}) {
    household.revision += 1;
    household.lastReviewDay = world.time.day;
    world.metrics.householdRenegotiations += 1;
    appendHouseholdHistory(world, household, 'agreement_revision', message, {
      actorIds: household.memberIds,
      proposalId: proposal.id,
      causes: ['mutually accepted renegotiation'],
      evidence: { revision: household.revision, ...evidence }
    });
  }

  function executeRenovation(world, household, proposal) {
    const home = World.getProperty(world, household.homePropertyId);
    const partner = partnerFor(world, household);
    if (proposal.terms.kind === 'structural_project') {
      const result = AXM.Habitats?.createAuthorizedProject(world, household, proposal)
        || { ok: false, reason: 'Structural habitat module unavailable.' };
      if (!result.ok) return result;
      world.metrics.householdRenovations += 1;
      Core.appendPropertyHistory(world, home, 'agreement_construction_project', `${partner.name} and the player authorized a phased habitat project. No structural change occurs until the work is completed.`, {
        actorIds: ['player', partner.id], projectId: result.project.id,
        causes: ['accepted household proposal', 'phased construction', 'no instant mutation']
      });
      appendHouseholdHistory(world, household, 'construction_project_authorized', `A mutually accepted habitat project entered the construction queue.`, {
        actorIds: ['player', partner.id], proposalId: proposal.id,
        causes: ['shared authorship', 'room-level authority'],
        evidence: { projectId: result.project.id, projectSpec: Core.deepClone(proposal.terms.projectSpec) }
      });
      return { ok: true, project: result.project };
    }
    const object = home?.furniture.find((entry) => entry.id === proposal.terms.objectId);
    if (!object || object.ownerId !== partner.id) return { ok: false, reason: 'The partner-owned object is no longer available.' };
    const definition = Content.furnitureById(object.catalogId);
    if (proposal.terms.kind === 'partner_recolor') {
      const colorId = proposal.terms.colorId;
      if (object.colorId === colorId) return { ok: false, reason: 'The object already has that finish.' };
      if (partner.money < 6) return { ok: false, reason: `${partner.name} cannot currently cover the recoloring cost.` };
      const oldColor = object.colorId;
      partner.money -= 6;
      object.colorId = colorId;
      object.sentimental = Core.clamp(object.sentimental + 2, 0, 100);
      Core.appendObjectHistory(world, object, 'agreement_recolor', `${partner.name} accepted a household proposal and personally changed this object from ${Content.paletteById(oldColor).name} to ${Content.paletteById(colorId).name}.`, {
        actorId: partner.id, causes: ['owner consent', 'accepted household proposal']
      });
    } else {
      const axis = proposal.terms.axis;
      if (object.upgrades[axis] >= 5) return { ok: false, reason: 'That upgrade direction is already complete.' };
      const cost = Core.objectUpgradeCost(definition, object, axis).money * 0.75;
      if (partner.money < cost) return { ok: false, reason: `${partner.name} cannot currently cover the upgrade.` };
      partner.money -= cost;
      object.upgrades[axis] += 1;
      object.condition = Core.clamp(object.condition + 3, 0, 100);
      object.sentimental = Core.clamp(object.sentimental + 4, 0, 100);
      world.metrics.npcObjectUpgrades += 1;
      Core.appendObjectHistory(world, object, 'agreement_upgrade', `${partner.name} accepted a household proposal and improved ${axis} without surrendering ownership.`, {
        actorId: partner.id, causes: ['owner consent', 'upgrade without replacement']
      });
    }
    world.metrics.householdRenovations += 1;
    Core.appendPropertyHistory(world, home, 'agreement_renovation', `${partner.name} carried out an accepted change to their ${definition.name}.`, {
      actorIds: ['player', partner.id], objectId: object.id,
      causes: ['influence through agreement, not direct control']
    });
    appendHouseholdHistory(world, household, 'renovation', `${partner.name} carried out an agreed change to their ${definition.name}.`, {
      actorIds: ['player', partner.id], proposalId: proposal.id,
      causes: ['owner consent'], evidence: Core.deepClone(proposal.terms)
    });
    return { ok: true };
  }

  function applyProposal(world, proposal) {
    const npcId = proposal.proposerId === 'player' ? proposal.recipientIds[0] : proposal.proposerId;
    const npc = World.getPerson(world, npcId);
    let result = { ok: false, reason: 'Proposal could not be applied.' };
    if (proposal.type === 'commitment') result = createHousehold(world, npc, proposal);
    else {
      const household = householdById(world, proposal.householdId);
      if (!household) return { ok: false, reason: 'The referenced household agreement no longer exists.' };
      if (['cohabitation', 'relocation'].includes(proposal.type)) result = executeJointMove(world, household, proposal.terms.destinationPropertyId, proposal);
      if (proposal.type === 'finance') {
        household.agreement.finances.mode = proposal.terms.mode;
        household.agreement.finances.weeklyReserveTarget = Core.clamp(Core.safeNumber(proposal.terms.weeklyReserveTarget, 0), 0, 120);
        household.agreement.finances.shares = computeFinancialShares(world, household);
        recordAgreementRevision(world, household, proposal, `Shared expenses changed to ${Core.titleCase(proposal.terms.mode)} with a ${Core.formatMoney(household.agreement.finances.weeklyReserveTarget)} weekly reserve.`, {
          finances: Core.deepClone(household.agreement.finances)
        });
        result = { ok: true };
      }
      if (proposal.type === 'space') {
        household.agreement.space.mode = proposal.terms.mode;
        refreshSpaceZones(world, household);
        const rebalance = rebalanceHouseholdObjects(world, household, 'accepted space renegotiation');
        recordAgreementRevision(world, household, proposal, `Space permissions changed to ${Core.titleCase(proposal.terms.mode)}.`, {
          spaceMode: proposal.terms.mode, zones: Core.deepClone(household.agreement.space.zones), rebalance
        });
        result = { ok: true };
      }
      if (proposal.type === 'goal') {
        const existing = household.agreement.goals.find((goal) => goal.status === 'active');
        if (existing) existing.status = 'replaced';
        const goal = {
          id: Core.uniqueId(world, 'household_goal'),
          type: proposal.terms.goalType,
          target: Core.safeNumber(proposal.terms.target, 1),
          progress: 0,
          status: 'active',
          createdDay: world.time.day,
          completedDay: null
        };
        household.agreement.goals.push(goal);
        recordAgreementRevision(world, household, proposal, `The household adopted ${Core.titleCase(goal.type)} as a shared direction.`, { goal: Core.deepClone(goal) });
        result = { ok: true, goal };
      }
      if (proposal.type === 'renovation') result = executeRenovation(world, household, proposal);
    }
    if (result.ok) {
      proposal.status = 'implemented';
      proposal.response = { ...(proposal.response || {}), decision: proposal.response?.decision || 'accepted', implemented: true, implementedDay: world.time.day, implementedHour: world.time.hour };
      world.metrics.householdProposalsAccepted += 1;
      appendProposalHistory(world, proposal, 'implemented', `${proposalSummary(world, proposal)} was accepted and implemented.`, {
        actorId: npcId,
        evidence: { result: Core.deepClone(result) }
      });
    } else {
      proposal.status = 'failed';
      proposal.response = { decision: 'accepted_but_failed', day: world.time.day, hour: world.time.hour, reason: result.reason };
      appendProposalHistory(world, proposal, 'failed', result.reason || 'Accepted proposal could not be implemented.', { actorId: npcId });
    }
    return result;
  }

  function resolveNpcProposal(world, proposal) {
    if (proposal.status !== 'pending_npc' || proposal.dueDay > world.time.day) return null;
    const decision = decideProposal(world, proposal);
    const npc = World.getPerson(world, decision.npcId);
    const evidence = { score: decision.score, roll: decision.roll, factors: decision.factors, compatibility: decision.compatibility };
    if (decision.decision === 'accepted') {
      proposal.status = 'accepted';
      proposal.response = { decision: 'accepted', day: world.time.day, hour: world.time.hour, evidence };
      appendProposalHistory(world, proposal, 'accepted', `${npc.name} accepted after considering the recorded factors.`, { actorId: npc.id, evidence });
      const result = applyProposal(world, proposal);
      Core.appendLedger(world, 'household', `${npc.name} accepted ${proposalSummary(world, proposal)}.`, {
        actorIds: ['player', npc.id], placeId: householdById(world, proposal.householdId)?.homePropertyId || null,
        causes: ['autonomous response', 'proposal score and deterministic roll'],
        evidence: { proposalId: proposal.id, ...evidence, implemented: result.ok }
      });
      Systems.toast(world, `${npc.name} accepted the ${Core.titleCase(proposal.type)} proposal.`, result.ok ? 'success' : 'warning');
      return { decision: 'accepted', result };
    }
    if (decision.decision === 'countered') {
      const terms = counterTerms(world, proposal, npc);
      if (terms) {
        proposal.status = 'countered';
        proposal.response = { decision: 'countered', day: world.time.day, hour: world.time.hour, evidence, counterTerms: Core.deepClone(terms) };
        appendProposalHistory(world, proposal, 'countered', `${npc.name} proposed different terms rather than accepting or refusing the whole direction.`, { actorId: npc.id, evidence: { ...evidence, counterTerms: terms } });
        const counter = createProposal(world, {
          householdId: proposal.householdId,
          type: proposal.type,
          proposerId: npc.id,
          recipientIds: ['player'],
          terms,
          parentProposalId: proposal.id
        });
        world.metrics.householdCounteroffers += 1;
        Core.appendLedger(world, 'household', `${npc.name} countered with ${counter.ok ? proposalSummary(world, counter.proposal) : 'different terms'}.`, {
          actorIds: [npc.id, 'player'], placeId: householdById(world, proposal.householdId)?.homePropertyId || null,
          causes: ['partial agreement', 'NPC retained negotiation agency'],
          evidence: { proposalId: proposal.id, counterProposalId: counter.proposal?.id || null, ...evidence, counterTerms: terms }
        });
        Systems.toast(world, `${npc.name} sent a counteroffer.`, 'info');
        return { decision: 'countered', counter };
      }
    }
    proposal.status = 'declined';
    proposal.response = { decision: 'declined', day: world.time.day, hour: world.time.hour, evidence };
    world.metrics.householdProposalsDeclined += 1;
    appendProposalHistory(world, proposal, 'declined', `${npc.name} declined without transferring control or creating a hidden penalty.`, { actorId: npc.id, evidence });
    Core.appendLedger(world, 'household', `${npc.name} declined ${proposalSummary(world, proposal)}.`, {
      actorIds: ['player', npc.id], placeId: householdById(world, proposal.householdId)?.homePropertyId || null,
      causes: ['autonomous response', 'boundary respected'], evidence: { proposalId: proposal.id, ...evidence }
    });
    Systems.toast(world, `${npc.name} declined the ${Core.titleCase(proposal.type)} proposal.`, 'info');
    return { decision: 'declined' };
  }

  function respondToHouseholdProposal(world, proposalId, response) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday before responding.' };
    const proposal = proposalById(world, proposalId);
    if (!proposal || proposal.status !== 'awaiting_player' || !proposal.recipientIds.includes('player')) return { ok: false, reason: 'No player response is currently requested.' };
    if (!['accept', 'decline'].includes(response)) return { ok: false, reason: 'Unknown response.' };
    Systems.advanceHours(world, 1);
    if (response === 'accept') {
      proposal.status = 'accepted';
      proposal.response = { decision: 'accepted_by_player', day: world.time.day, hour: world.time.hour };
      appendProposalHistory(world, proposal, 'accepted', 'The player accepted the NPC-authored proposal.', { actorId: 'player' });
      const result = applyProposal(world, proposal);
      Systems.toast(world, result.ok ? 'Agreement accepted and implemented.' : result.reason, result.ok ? 'success' : 'warning');
      return result;
    }
    proposal.status = 'declined';
    proposal.response = { decision: 'declined_by_player', day: world.time.day, hour: world.time.hour };
    world.metrics.householdProposalsDeclined += 1;
    appendProposalHistory(world, proposal, 'declined', 'The player declined. Boundaries are not treated as misconduct.', { actorId: 'player' });
    Core.appendLedger(world, 'household', `You declined ${proposalSummary(world, proposal)}.`, {
      actorIds: ['player', proposal.proposerId], placeId: householdById(world, proposal.householdId)?.homePropertyId || null,
      causes: ['explicit player boundary'], evidence: { proposalId: proposal.id }
    });
    Systems.toast(world, 'Proposal declined without a hidden relationship penalty.', 'info');
    return { ok: true };
  }

  function withdrawHouseholdProposal(world, proposalId) {
    const proposal = proposalById(world, proposalId);
    if (!proposal || proposal.proposerId !== 'player' || proposal.status !== 'pending_npc') return { ok: false, reason: 'Only a still-pending player proposal can be withdrawn.' };
    proposal.status = 'withdrawn';
    proposal.response = { decision: 'withdrawn', day: world.time.day, hour: world.time.hour };
    appendProposalHistory(world, proposal, 'withdrawn', 'The player withdrew the proposal before an answer was due.', { actorId: 'player' });
    Core.appendLedger(world, 'household', `You withdrew ${proposalSummary(world, proposal)} before it was answered.`, {
      actorIds: ['player'].concat(proposal.recipientIds), causes: ['explicit withdrawal'], evidence: { proposalId: proposal.id }
    });
    Systems.toast(world, 'Proposal withdrawn.', 'info');
    return { ok: true };
  }

  function redistributePropertyExpense(world, property, kind, baseDues) {
    ensureState(world);
    const dues = { ...baseDues };
    const household = playerHousehold(world);
    if (!household || household.homePropertyId !== property.id || !isCohabiting(world, household)) return dues;
    const partnerId = partnerIdFor(household);
    if (!(Object.prototype.hasOwnProperty.call(dues, 'player') && Object.prototype.hasOwnProperty.call(dues, partnerId))) return dues;
    if (household.agreement.finances.mode === 'separate') return dues;
    if (kind === 'rent' && property.ownerId === 'player') {
      dues.player = 0;
      dues[partnerId] = 0;
      return dues;
    }
    const pairTotal = Core.safeNumber(dues.player, 0) + Core.safeNumber(dues[partnerId], 0);
    const shares = computeFinancialShares(world, household);
    household.agreement.finances.shares = shares;
    dues.player = Core.round(pairTotal * shares.player, 2);
    dues[partnerId] = Core.round(pairTotal - dues.player, 2);
    return dues;
  }

  function recordSharedExpensePayment(world, property, personId, kind, due, paid) {
    const household = playerHousehold(world);
    if (!household || household.homePropertyId !== property.id || !household.memberIds.includes(personId)) return;
    world.metrics.householdSharedExpensePayments += 1;
    appendHouseholdHistory(world, household, 'shared_expense', `${World.personName(world, personId)} paid ${Core.formatMoney(paid)} toward ${kind}.`, {
      actorIds: [personId], causes: ['current contribution agreement'], evidence: { kind, due, paid, shortfall: Core.round(Math.max(0, due - paid), 2) }
    });
  }

  function processWeeklyReserve(world, options = {}) {
    if ((world.time.day - 1) % 7 !== 0 || world.time.day === 1) return;
    const week = Math.floor((world.time.day - 1) / 7);
    world.households.filter((entry) => entry.status === 'active' && isCohabiting(world, entry)).forEach((household) => {
      if (household.lastReserveWeek === week) return;
      household.lastReserveWeek = week;
      const target = Core.clamp(Core.safeNumber(household.agreement.finances.weeklyReserveTarget, 0), 0, 120);
      if (target <= 0) return;
      const partner = partnerFor(world, household);
      const shares = computeFinancialShares(world, household);
      household.agreement.finances.shares = shares;
      const due = { player: target * shares.player, [partner.id]: target * shares[partner.id] };
      const paid = { player: 0, [partner.id]: 0 };
      if (!options.freezePlayer) {
        const available = Math.max(0, world.player.money - 40);
        paid.player = Math.min(available, due.player);
        world.player.money -= paid.player;
        world.player.lifetimeSpend += paid.player;
      }
      const partnerSafety = Math.max(30, World.homeOf(world, partner.id)?.currentRent * 0.2 || 30);
      const partnerAvailable = Math.max(0, partner.money - partnerSafety);
      paid[partner.id] = Math.min(partnerAvailable, due[partner.id]);
      partner.money -= paid[partner.id];
      const total = paid.player + paid[partner.id];
      household.sharedReserve += total;
      if (total > 0) world.metrics.householdReserveContributions += 1;
      appendHouseholdHistory(world, household, 'reserve_contribution', `The household added ${Core.formatMoney(total)} to its mutually governed reserve.`, {
        actorIds: household.memberIds,
        causes: ['weekly reserve agreement', options.freezePlayer ? 'observer mode froze player contribution' : 'separate personal accounts'],
        evidence: { target, due, paid, reserveAfter: household.sharedReserve }
      });
      Core.appendLedger(world, 'household', `${world.player.name} and ${partner.name} added ${Core.formatMoney(total)} to their shared reserve.`, {
        actorIds: household.memberIds, placeId: household.homePropertyId,
        causes: ['accepted finance agreement'], evidence: { target, paid, reserveAfter: household.sharedReserve }
      });
    });
  }

  function updateHouseholdGoals(world, household) {
    const active = household.agreement.goals.filter((goal) => goal.status === 'active');
    if (!active.length) return;
    const home = World.getProperty(world, household.homePropertyId);
    const partner = partnerFor(world, household);
    active.forEach((goal) => {
      if (goal.type === 'shared_safety_fund') goal.progress = household.sharedReserve;
      if (goal.type === 'improve_home') goal.progress = home ? home.furniture.reduce((sum, object) => sum + Core.sumObjectUpgrades(object), 0) : 0;
      if (goal.type === 'move_to_better_home') goal.progress = household.completedRelocations;
      if (goal.type === 'protect_free_time') goal.progress = Core.round(Core.average([world.player.needs.energy, world.player.needs.mood, partner.needs.energy, partner.needs.mood]), 1);
      if (goal.progress >= goal.target) {
        goal.status = 'complete';
        goal.completedDay = world.time.day;
        appendHouseholdHistory(world, household, 'goal_complete', `${Core.titleCase(goal.type)} reached its agreed target.`, {
          actorIds: household.memberIds, causes: ['measured goal progress'], evidence: Core.deepClone(goal)
        });
        Core.appendLedger(world, 'household', `${world.player.name} and ${partner.name} completed their household goal: ${Core.titleCase(goal.type)}.`, {
          actorIds: household.memberIds, placeId: household.homePropertyId,
          causes: ['shared goal reached'], evidence: Core.deepClone(goal)
        });
      }
    });
  }

  function householdPressure(world, household) {
    const partner = partnerFor(world, household);
    const home = World.getProperty(world, household.homePropertyId);
    const density = home ? home.furniture.length / Math.max(1, home.roomGrid[0] * home.roomGrid[1]) : 0;
    const factors = {
      money: Core.clamp((world.player.rentArrears + partner.rentArrears) * 0.2 + Math.abs(55 - partner.traits.thrift) * 0.2 + (world.player.money < 60 ? 18 : 0) + (partner.money < 80 ? 14 : 0), 0, 100),
      space: Core.clamp(density * 130 + partner.traits.independence * 0.18 + (home?.tenants.length || 0) * 3, 0, 100),
      style: Core.clamp(Math.abs(partner.traits.creativity - 66) * 0.3 + Math.abs(partner.traits.neatness - 50) * 0.25, 0, 100),
      time: Core.clamp((100 - Core.average([world.player.needs.energy, world.player.needs.mood, partner.needs.energy, partner.needs.mood])) * 0.8, 0, 100),
      independence: Core.clamp(partner.traits.independence * 0.45 + hasPendingProposal(world, household.id) * 15, 0, 100)
    };
    const ranked = Object.entries(factors).sort((a, b) => b[1] - a[1]);
    return { factors, primary: ranked[0][0], max: ranked[0][1], total: Core.average(Object.values(factors)) };
  }

  function createHouseholdIssue(world, household, cause, severity, evidence) {
    const partner = partnerFor(world, household);
    const messages = {
      money: `${partner.name} raised concern about how money pressure is landing between you.`,
      space: `${partner.name} felt the shared home was crowding personal space.`,
      style: `${partner.name} felt their preferences were disappearing inside the shared interior.`,
      time: `${partner.name} noticed that exhaustion was replacing real time together.`,
      independence: `${partner.name} asked for clearer boundaries so influence does not become control.`
    };
    const issue = {
      id: Core.uniqueId(world, 'household_issue'),
      householdId: household.id,
      type: cause,
      status: 'open',
      severity: Core.clamp(Math.round(severity), 1, 10),
      createdDay: world.time.day,
      createdHour: world.time.hour,
      resolvedDay: null,
      repairAttempts: 0,
      message: messages[cause],
      evidence: Core.deepClone(evidence),
      history: []
    };
    world.householdIssues.push(issue);
    household.unresolvedIssueIds.push(issue.id);
    household.lastConflictDay = world.time.day;
    household.strain = Core.clamp(household.strain + issue.severity * 1.5, 0, 100);
    const relation = getPlayerRelation(world, partner.id);
    relation.trust = Core.clamp(relation.trust - issue.severity * 0.35, -100, 100);
    relation.friendship = Core.clamp(relation.friendship - issue.severity * 0.18, -100, 100);
    syncMutualStatus(world, partner, relation);
    world.metrics.householdConflicts += 1;
    appendIssueHistory(world, issue, 'opened', issue.message, { actorId: partner.id, evidence });
    appendHouseholdHistory(world, household, 'conflict', issue.message, {
      actorIds: [partner.id, 'player'], issueId: issue.id,
      causes: [cause, 'simulated pressure rather than random punishment'], evidence
    });
    Core.appendLedger(world, 'household', issue.message, {
      actorIds: [partner.id, 'player'], placeId: household.homePropertyId,
      causes: [cause, 'household pressure became visible'], evidence: { issueId: issue.id, severity: issue.severity, ...evidence }
    });
    return issue;
  }

  function processHouseholdDynamics(world, household) {
    updateHouseholdGoals(world, household);
    if (!isCohabiting(world, household)) return;
    const openIssues = household.unresolvedIssueIds.map((id) => issueById(world, id)).filter((issue) => issue?.status === 'open');
    if (!openIssues.length) household.strain = Math.max(0, household.strain - 0.35);
    if (world.time.day - household.lastConflictDay < 6 || openIssues.length >= 2) return;
    const pressure = householdPressure(world, household);
    const probability = Core.clamp(0.015 + pressure.max / 480 + household.strain / 650, 0.015, 0.28);
    if (!Core.chance(world, probability)) return;
    const severity = Core.clamp(2 + pressure.max / 18 + household.strain / 22, 2, 10);
    createHouseholdIssue(world, household, pressure.primary, severity, { pressure: pressure.factors, probability: Core.round(probability, 3) });
  }

  function repairHouseholdIssue(world, householdId, issueId, approach) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first.' };
    if (!REPAIR_APPROACHES.includes(approach)) return { ok: false, reason: 'Unknown repair approach.' };
    const household = householdById(world, householdId);
    const issue = issueById(world, issueId);
    if (!household || !issue || issue.householdId !== household.id || issue.status !== 'open') return { ok: false, reason: 'Open household issue not found.' };
    const partner = partnerFor(world, household);
    const relation = getPlayerRelation(world, partner.id);
    const bestApproach = ['space', 'independence'].includes(issue.type) ? 'give_space' : issue.type === 'money' ? 'practical_plan' : 'listen';
    const fitBonus = approach === bestApproach ? 28 : 4;
    const score = Core.clamp(24 + relation.trust * 0.34 + world.player.skills.social * 0.4 + fitBonus + world.player.needs.mood * 0.08 - issue.severity * 2.2, 0, 100);
    const roll = Core.randomInt(world, 0, 100);
    const margin = score - roll;
    issue.repairAttempts += 1;
    Systems.advanceHours(world, 2);
    let message;
    let outcome;
    if (margin >= 10) {
      issue.status = 'resolved';
      issue.resolvedDay = world.time.day;
      household.unresolvedIssueIds = household.unresolvedIssueIds.filter((id) => id !== issue.id);
      household.strain = Math.max(0, household.strain - issue.severity * 1.8 - 4);
      relation.trust = Core.clamp(relation.trust + 5 + issue.severity * 0.35, -100, 100);
      relation.friendship = Core.clamp(relation.friendship + 2.5, -100, 100);
      world.metrics.householdRepairs += 1;
      outcome = 'resolved';
      message = `${partner.name} felt heard, and the issue reached a real repair rather than disappearing silently.`;
    } else if (margin >= -18) {
      issue.severity = Math.max(1, issue.severity - 2);
      household.strain = Math.max(0, household.strain - 2);
      relation.trust = Core.clamp(relation.trust + 1, -100, 100);
      outcome = 'partial';
      message = `${partner.name} saw the effort, but the issue still needs more than one conversation.`;
    } else {
      outcome = 'not_ready';
      message = `${partner.name} was not ready to call the issue repaired. The conversation was not treated as a control command.`;
    }
    syncMutualStatus(world, partner, relation);
    const evidence = { approach, bestApproach, score: Core.round(score, 1), roll, margin: Core.round(margin, 1), outcome };
    appendIssueHistory(world, issue, 'repair_attempt', message, { actorId: 'player', evidence });
    appendHouseholdHistory(world, household, 'repair_attempt', message, {
      actorIds: ['player', partner.id], issueId: issue.id,
      causes: ['explicit repair conversation', 'partner response remained autonomous'], evidence
    });
    Core.appendLedger(world, 'household', message, {
      actorIds: ['player', partner.id], placeId: household.homePropertyId,
      causes: ['repair attempt', issue.type], evidence: { issueId: issue.id, ...evidence }
    });
    Systems.toast(world, message, outcome === 'resolved' ? 'success' : 'info');
    return { ok: true, outcome, score, roll };
  }

  function expireWaitingProposals(world) {
    world.householdProposals.forEach((proposal) => {
      if (!['pending_npc', 'awaiting_player'].includes(proposal.status) || world.time.day <= proposal.expiresDay) return;
      proposal.status = 'expired';
      proposal.response = { decision: 'expired', day: world.time.day, hour: world.time.hour };
      appendProposalHistory(world, proposal, 'expired', 'The proposal expired without manufacturing consent from silence.', { actorId: null });
      Core.appendLedger(world, 'household', `${proposalSummary(world, proposal)} expired without an answer. Silence was not treated as agreement.`, {
        actorIds: [proposal.proposerId].concat(proposal.recipientIds), causes: ['proposal expiry', 'no consent from silence'], evidence: { proposalId: proposal.id }
      });
    });
  }

  function maybeNpcCommitmentInitiative(world) {
    if (playerHousehold(world) || world.householdProposals.some((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status) && proposal.type === 'commitment')) return;
    const candidates = world.people.filter((npc) => {
      const relation = world.player.relationships[npc.id];
      if (!relation || relation.status !== 'dating') return false;
      return relation.friendship >= 65 && relation.trust >= 55 && relation.romance >= 50 && world.time.day >= npc.householdInitiativeCooldownUntil;
    });
    if (!candidates.length || !Core.chance(world, 0.035)) return;
    const npc = Core.weightedChoice(world, candidates, (person) => {
      const relation = world.player.relationships[person.id];
      return relation.trust + relation.romance + person.traits.stability - person.traits.independence * 0.4;
    });
    npc.householdInitiativeCooldownUntil = world.time.day + Core.randomInt(world, 14, 28);
    createProposal(world, {
      type: 'commitment',
      proposerId: npc.id,
      recipientIds: ['player'],
      terms: { commitment: 'partner', preserveSeparateAgency: true }
    });
  }

  function maybeNpcHouseholdInitiative(world, household) {
    if (world.time.day < household.nextNpcInitiativeDay || hasPendingProposal(world, household.id)) return;
    const partner = partnerFor(world, household);
    let type = 'goal';
    let terms = { goalType: 'shared_safety_fund', target: Math.max(120, Math.round(household.sharedReserve + 180)) };
    const pressure = isCohabiting(world, household) ? householdPressure(world, household) : null;
    if (pressure?.primary === 'money' || household.agreement.finances.weeklyReserveTarget > 35) {
      type = 'finance';
      terms = { mode: 'income_weighted', weeklyReserveTarget: Math.min(20, household.agreement.finances.weeklyReserveTarget) };
    } else if (pressure && ['space', 'independence'].includes(pressure.primary)) {
      type = 'space';
      terms = { mode: partner.traits.independence > 68 ? 'strong_private' : 'private_edges_shared_center' };
    } else if (isCohabiting(world, household)) {
      const current = World.getProperty(world, household.homePropertyId);
      const candidates = eligibleJointMoveProperties(world, household).filter((property) => property.id !== current.id && property.condition > current.condition + 5 && property.currentRent <= current.currentRent * 1.25);
      if (candidates.length && Core.chance(world, 0.35)) {
        type = 'relocation';
        terms = { destinationPropertyId: candidates[0].id };
      }
    }
    const result = createProposal(world, {
      householdId: household.id,
      type,
      proposerId: partner.id,
      recipientIds: ['player'],
      terms
    });
    household.nextNpcInitiativeDay = world.time.day + Core.randomInt(world, 12, 24);
    if (result.ok) appendHouseholdHistory(world, household, 'npc_initiative', `${partner.name} initiated ${proposalSummary(world, result.proposal)}.`, {
      actorIds: [partner.id, 'player'], proposalId: result.proposal.id,
      causes: ['NPC household initiative'], evidence: { type, terms }
    });
  }

  function dailyTick(world, options = {}) {
    ensureState(world);
    expireWaitingProposals(world);
    world.householdProposals.filter((proposal) => proposal.status === 'pending_npc' && proposal.dueDay <= world.time.day).forEach((proposal) => resolveNpcProposal(world, proposal));
    processWeeklyReserve(world, options);
    world.households.filter((household) => household.status === 'active').forEach((household) => {
      processHouseholdDynamics(world, household);
      maybeNpcHouseholdInitiative(world, household);
    });
    maybeNpcCommitmentInitiative(world);
  }

  function handleNpcHousingDecision(world, npc, current, best, evidence) {
    const household = npc.householdId ? householdById(world, npc.householdId) : null;
    if (!household || !household.memberIds.includes('player') || !isCohabiting(world, household)) return false;
    if (hasPendingProposal(world, household.id, 'relocation')) return true;
    const result = createProposal(world, {
      householdId: household.id,
      type: 'relocation',
      proposerId: npc.id,
      recipientIds: ['player'],
      terms: { destinationPropertyId: best.id }
    });
    if (result.ok) {
      appendHouseholdHistory(world, household, 'relocation_proposed', `${npc.name} proposed moving from ${current.name} to ${best.name} instead of moving unilaterally.`, {
        actorIds: [npc.id, 'player'], proposalId: result.proposal.id,
        causes: ['NPC housing evaluation', 'joint relocation agreement'], evidence
      });
    }
    return true;
  }

  function playerMovePermission(world, destinationPropertyId) {
    const household = playerHousehold(world);
    if (!household || !isCohabiting(world, household) || household.homePropertyId === destinationPropertyId) return { ok: true };
    return { ok: false, reason: 'Your active cohabitation agreement requires a joint relocation proposal. Open Agreements instead of moving your partner by omission.' };
  }

  function eligiblePlayerExitProperties(world, household) {
    if (!household || household.status !== 'active') return [];
    const currentId = world.player.homePropertyId;
    return world.places.filter((property) => {
      if (property.kind !== 'residential' || property.id === currentId) return false;
      if (property.tenants.length >= property.capacity) return false;
      if (property.ownerId !== 'player' && !property.listedForRent) return false;
      return true;
    }).sort((a, b) => a.currentRent - b.currentRent || b.condition - a.condition);
  }

  function reserveDissolutionShares(world, household) {
    const partnerId = partnerIdFor(household);
    const paid = { player: 0, [partnerId]: 0 };
    (household.history || []).filter((entry) => entry.type === 'reserve_contribution').forEach((entry) => {
      const evidencePaid = entry.evidence?.paid || {};
      paid.player += Math.max(0, Core.safeNumber(evidencePaid.player, 0));
      paid[partnerId] += Math.max(0, Core.safeNumber(evidencePaid[partnerId], 0));
    });
    const total = paid.player + paid[partnerId];
    const playerShare = total > 0 ? Core.clamp(paid.player / total, 0, 1) : 0.5;
    return { player: Core.round(playerShare, 6), [partnerId]: Core.round(1 - playerShare, 6), contributions: paid };
  }

  function endHouseholdAgreement(world, householdId, destinationPropertyId = null, acknowledged = false) {
    ensureState(world);
    if (!acknowledged) return { ok: false, reason: 'Ending an agreement requires explicit acknowledgement.' };
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday before changing your household state.' };
    const household = householdById(world, householdId);
    if (!household || household.status !== 'active' || !household.memberIds.includes('player')) return { ok: false, reason: 'Active household agreement not found.' };
    const partner = partnerFor(world, household);
    if (!partner) return { ok: false, reason: 'Agreement partner is unavailable.' };
    const cohabiting = isCohabiting(world, household);
    const currentHome = World.homeOf(world, 'player');
    let destination = null;
    let deposit = 0;
    if (cohabiting && destinationPropertyId && destinationPropertyId !== currentHome?.id) {
      destination = eligiblePlayerExitProperties(world, household).find((property) => property.id === destinationPropertyId) || null;
      if (!destination) return { ok: false, reason: 'The chosen exit home is unavailable or would displace somebody.' };
      deposit = destination.ownerId === 'player' ? 0 : destination.currentRent;
      if (world.player.money + 0.001 < deposit) return { ok: false, reason: `You need ${Core.formatMoney(deposit)} for the visible deposit. Remaining as autonomous co-tenants is still available.` };
    }

    const objectIdsBefore = new Set();
    world.places.filter((place) => place.kind === 'residential').forEach((property) => property.furniture
      .filter((object) => object.ownerId === 'player' && object.ownershipMode !== 'property_fixture')
      .forEach((object) => objectIdsBefore.add(object.id)));
    (world.player.storedFurniture || []).forEach((object) => objectIdsBefore.add(object.id));

    if (destination) {
      if (deposit > 0) {
        world.player.money -= deposit;
        world.player.lifetimeSpend += deposit;
      }
      const moved = movePlayerToProperty(world, destination, ['explicit separation notice', 'no forced eviction', 'player-selected exit home']);
      if (!moved.ok) {
        world.player.money += deposit;
        world.player.lifetimeSpend -= deposit;
        return moved;
      }
    }

    const reserveBefore = household.sharedReserve;
    const shares = reserveDissolutionShares(world, household);
    const playerPayout = Core.round(reserveBefore * shares.player, 2);
    const partnerPayout = Core.round(reserveBefore - playerPayout, 2);
    world.player.money += playerPayout;
    partner.money += partnerPayout;
    household.sharedReserve = 0;

    world.householdProposals.filter((proposal) => proposal.householdId === household.id && ['pending_npc', 'awaiting_player'].includes(proposal.status)).forEach((proposal) => {
      proposal.status = 'withdrawn';
      proposal.response = { decision: 'agreement_ended', day: world.time.day, hour: world.time.hour };
      appendProposalHistory(world, proposal, 'closed', 'The household agreement ended before this proposal received a final answer.', { actorId: 'player' });
    });
    world.householdIssues.filter((issue) => issue.householdId === household.id && issue.status === 'open').forEach((issue) => {
      issue.status = 'closed';
      issue.resolvedDay = world.time.day;
      appendIssueHistory(world, issue, 'closed', 'The issue closed with the agreement; this is not recorded as a successful repair.', { actorId: 'player' });
    });
    household.unresolvedIssueIds = [];

    const relation = getPlayerRelation(world, partner.id);
    relation.status = 'former_partner';
    const reverse = Systems.getRelation(partner, 'player');
    reverse.status = 'former_partner';
    household.status = 'ended';
    household.endedDay = world.time.day;
    household.endedHour = world.time.hour;
    household.endMode = destination ? 'player_moved' : cohabiting ? 'autonomous_cotenants' : 'separate_homes';
    household.revision += 1;
    household.agreement.space.zones = [];
    const familySeparation = AXM.Family?.handleHouseholdSeparation(world, household, partner, { destinationPropertyId: destination?.id || null }) || { ok: true };
    if (!familySeparation.ok) return familySeparation;
    household.homePropertyId = null;
    world.player.householdId = null;
    partner.householdId = null;
    world.metrics.householdSeparations += 1;

    const objectIdsAfter = new Set();
    world.places.filter((place) => place.kind === 'residential').forEach((property) => property.furniture
      .filter((object) => object.ownerId === 'player' && object.ownershipMode !== 'property_fixture')
      .forEach((object) => objectIdsAfter.add(object.id)));
    (world.player.storedFurniture || []).forEach((object) => objectIdsAfter.add(object.id));
    const lostObjectIds = Array.from(objectIdsBefore).filter((id) => !objectIdsAfter.has(id));
    if (lostObjectIds.length) throw new Error(`Separation object-preservation invariant failed: ${lostObjectIds.join(', ')}`);

    const message = destination
      ? `${world.player.name} ended the household agreement with ${partner.name} and moved to ${destination.name}; ${partner.name} was not evicted.`
      : cohabiting
        ? `${world.player.name} ended the household agreement with ${partner.name}; both remain autonomous co-tenants until either chooses to move.`
        : `${world.player.name} ended the household agreement with ${partner.name} while both retained their existing homes.`;
    appendHouseholdHistory(world, household, 'ended', message, {
      actorIds: ['player', partner.id],
      causes: ['unilateral right to leave', 'no forced eviction', 'object ownership preserved'],
      evidence: {
        endMode: household.endMode,
        destinationPropertyId: destination?.id || null,
        deposit,
        reserveBefore,
        reserveShares: shares,
        reservePayouts: { player: playerPayout, [partner.id]: partnerPayout },
        lostObjectIds
      }
    });
    Core.appendLedger(world, 'household', message, {
      actorIds: ['player', partner.id], placeId: destination?.id || currentHome?.id || null,
      causes: ['explicit separation acknowledgement', 'agreement exit cannot require partner permission'],
      evidence: {
        householdId: household.id,
        endMode: household.endMode,
        destinationPropertyId: destination?.id || null,
        deposit,
        reserveRule: household.agreement.dissolution.reserveRule,
        reservePayouts: { player: playerPayout, [partner.id]: partnerPayout }
      }
    });
    Systems.toast(world, 'Household agreement ended without transferring control or forcing an eviction.', 'info');
    return { ok: true, household, destination, reservePayouts: { player: playerPayout, [partner.id]: partnerPayout } };
  }

  function prepareHouseholdExperiment(world, npcId = null) {
    ensureState(world);
    if (world.flags.householdExperimentPrepared) return { ok: false, reason: 'The household experiment setup was already used in this save.' };
    if (playerHousehold(world)) return { ok: false, reason: 'An active household agreement already exists.' };
    const candidates = world.people.slice().sort((a, b) => Systems.playerNpcCompatibility(world, b) - Systems.playerNpcCompatibility(world, a));
    const npc = World.getPerson(world, npcId) || candidates[0];
    if (!npc || npc.id === 'player') return { ok: false, reason: 'No resident available for the experiment.' };
    const relation = Systems.getRelation(world.player, npc.id);
    relation.friendship = Math.max(78, relation.friendship);
    relation.trust = Math.max(72, relation.trust);
    relation.romance = Math.max(64, relation.romance);
    relation.status = 'dating';
    relation.interactions = Math.max(4, relation.interactions);
    syncMutualStatus(world, npc, relation);
    world.player.money += 2500;
    world.flags.householdExperimentPrepared = true;
    Core.appendLedger(world, 'research', `Prototype household conditions were prepared with ${npc.name}. This is labeled test state, not normal relationship progression.`, {
      actorIds: ['player', npc.id], causes: ['explicit developer experiment'], evidence: { moneyAdded: 2500, relation: Core.deepClone(relation) }
    });
    Systems.toast(world, `${npc.name} is ready for a labeled agreement experiment.`, 'warning');
    return { ok: true, npcId: npc.id };
  }

  function validate(world, add) {
    const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const people = Array.isArray(world.people) ? world.people : [];
    const households = Array.isArray(world.households) ? world.households : [];
    const proposals = Array.isArray(world.householdProposals) ? world.householdProposals : [];
    const issues = Array.isArray(world.householdIssues) ? world.householdIssues : [];
    if (!Array.isArray(world.households)) add('Households must be an array.');
    if (!Array.isArray(world.householdProposals)) add('Household proposals must be an array.');
    if (!Array.isArray(world.householdIssues)) add('Household issues must be an array.');
    const knownPeople = new Set(['player', ...people.map((person) => person.id)]);
    const householdIds = new Set();
    const memberPointers = new Map();
    households.forEach((household, index) => {
      if (!isRecord(household) || typeof household.id !== 'string') {
        add(`Household at index ${index} has no valid id.`);
        return;
      }
      if (householdIds.has(household.id)) add(`Duplicate household id: ${household.id}.`);
      householdIds.add(household.id);
      if (!Array.isArray(household.memberIds) || household.memberIds.length < 2) add(`${household.id} must contain at least two members.`);
      else household.memberIds.forEach((id) => {
        if (!knownPeople.has(id)) add(`${household.id} contains unknown member ${String(id)}.`);
        if (household.status !== 'ended') {
          if (memberPointers.has(id)) add(`${id} appears in both ${memberPointers.get(id)} and ${household.id}.`);
          memberPointers.set(id, household.id);
        }
      });
      if (!['active', 'ended'].includes(household.status)) add(`${household.id} has invalid status.`);
      if (!Number.isInteger(household.revision) || household.revision < 1) add(`${household.id} has invalid revision.`);
      if (!Number.isFinite(household.sharedReserve) || household.sharedReserve < 0) add(`${household.id} has invalid shared reserve.`);
      if (!Number.isFinite(household.strain) || household.strain < 0 || household.strain > 100) add(`${household.id} has invalid strain.`);
      const agreement = isRecord(household.agreement) ? household.agreement : null;
      const finances = agreement && isRecord(agreement.finances) ? agreement.finances : null;
      const space = agreement && isRecord(agreement.space) ? agreement.space : null;
      if (!finances || !FINANCE_MODES.includes(finances.mode)) add(`${household.id} has invalid finance agreement.`);
      if (!space || !SPACE_MODES.includes(space.mode) || !Array.isArray(space.zones)) add(`${household.id} has invalid space agreement.`);
      if (!Array.isArray(agreement?.goals)) add(`${household.id} goals must be an array.`);
      const dissolution = agreement && isRecord(agreement.dissolution) ? agreement.dissolution : null;
      if (!dissolution || dissolution.exitIsUnilateral !== true || dissolution.noForcedEviction !== true || dissolution.reserveRule !== 'recorded_contributions_or_equal') add(`${household.id} has invalid dissolution safeguards.`);
      if (!Array.isArray(household.history)) add(`${household.id} history must be an array.`);
      if (!Array.isArray(household.unresolvedIssueIds)) add(`${household.id} unresolvedIssueIds must be an array.`);
      if (household.homePropertyId) {
        const property = World.getProperty(world, household.homePropertyId);
        if (!property) add(`${household.id} points to unknown home ${household.homePropertyId}.`);
        else if (household.status === 'active' && Array.isArray(household.memberIds) && household.memberIds.some((id) => World.getPerson(world, id)?.homePropertyId !== household.homePropertyId)) add(`${household.id} home pointer does not match every member.`);
        const zones = Array.isArray(space?.zones) ? space.zones : [];
        zones.forEach((zone) => {
          if (!isRecord(zone) || !isRecord(zone.rect) || !Number.isInteger(zone.rect.x) || !Number.isInteger(zone.rect.y) || !Number.isInteger(zone.rect.w) || !Number.isInteger(zone.rect.h) || zone.rect.w < 1 || zone.rect.h < 1) add(`${household.id} has malformed space zone.`);
          else if (property && (zone.rect.x < 0 || zone.rect.y < 0 || zone.rect.x + zone.rect.w > property.roomGrid[0] || zone.rect.y + zone.rect.h > property.roomGrid[1])) add(`${household.id} space zone exceeds home bounds.`);
        });
        if (property && zones.length && Array.isArray(household.memberIds) && !AXM.Habitats?.placementPermission) {
          // v0.2 fallback only. In v0.3 the rectangles remain migration evidence,
          // while authoritative permissions are mapped onto real room IDs and
          // validated by the Structural Habitat Engine.
          const partnerId = household.memberIds.find((id) => id !== 'player');
          property.furniture.filter((object) => object.ownershipMode !== 'property_fixture' && household.memberIds.includes(object.ownerId)).forEach((object) => {
            const forbidden = object.ownerId === 'player' ? 'partner_private' : object.ownerId === partnerId ? 'player_private' : null;
            if (!forbidden) return;
            for (let dy = 0; dy < object.footprint[1]; dy += 1) {
              for (let dx = 0; dx < object.footprint[0]; dx += 1) {
                const zone = zones.find((entry) => isRecord(entry?.rect) && object.position.x + dx >= entry.rect.x && object.position.x + dx < entry.rect.x + entry.rect.w && object.position.y + dy >= entry.rect.y && object.position.y + dy < entry.rect.y + entry.rect.h);
                if (zone?.kind === forbidden) add(`${object.id} crosses an agreed private-space boundary in ${property.name || property.id}.`);
              }
            }
          });
        }
      }
    });
    if ((world.player.householdId || null) !== (memberPointers.get('player') || null)) add('Player household pointer does not match active household membership.');
    people.forEach((person) => {
      if ((person.householdId || null) !== (memberPointers.get(person.id) || null)) add(`${person.name || person.id} household pointer does not match active membership.`);
    });

    const proposalIds = new Set();
    proposals.forEach((proposal, index) => {
      if (!isRecord(proposal) || typeof proposal.id !== 'string') {
        add(`Household proposal at index ${index} has no valid id.`);
        return;
      }
      if (proposalIds.has(proposal.id)) add(`Duplicate household proposal id: ${proposal.id}.`);
      proposalIds.add(proposal.id);
      if (!PROPOSAL_TYPES.includes(proposal.type)) add(`${proposal.id} has invalid proposal type.`);
      if (!PROPOSAL_STATUSES.includes(proposal.status)) add(`${proposal.id} has invalid proposal status.`);
      if (!knownPeople.has(proposal.proposerId)) add(`${proposal.id} has unknown proposer.`);
      if (!Array.isArray(proposal.recipientIds) || proposal.recipientIds.some((id) => !knownPeople.has(id))) add(`${proposal.id} has invalid recipients.`);
      if (proposal.householdId && !householdIds.has(proposal.householdId)) add(`${proposal.id} references unknown household.`);
      if (!isRecord(proposal.terms)) add(`${proposal.id} terms must be an object.`);
      if (!Array.isArray(proposal.history)) add(`${proposal.id} history must be an array.`);
      if (!Number.isInteger(proposal.createdDay) || !Number.isInteger(proposal.dueDay) || !Number.isInteger(proposal.expiresDay)) add(`${proposal.id} has invalid proposal dates.`);
    });

    const issueIds = new Set();
    issues.forEach((issue, index) => {
      if (!isRecord(issue) || typeof issue.id !== 'string') {
        add(`Household issue at index ${index} has no valid id.`);
        return;
      }
      if (issueIds.has(issue.id)) add(`Duplicate household issue id: ${issue.id}.`);
      issueIds.add(issue.id);
      if (!householdIds.has(issue.householdId)) add(`${issue.id} references unknown household.`);
      if (!['open', 'resolved', 'closed'].includes(issue.status)) add(`${issue.id} has invalid issue status.`);
      if (!Number.isFinite(issue.severity) || issue.severity < 1 || issue.severity > 10) add(`${issue.id} has invalid severity.`);
      if (!Array.isArray(issue.history)) add(`${issue.id} history must be an array.`);
    });
    households.forEach((household) => (Array.isArray(household.unresolvedIssueIds) ? household.unresolvedIssueIds : []).forEach((id) => {
      const issue = issues.find((entry) => entry.id === id);
      if (!issue || issue.householdId !== household.id || issue.status !== 'open') add(`${household.id} points to invalid unresolved issue ${id}.`);
    }));
  }

  Object.assign(Systems, {
    proposeCommitment,
    proposeCohabitation,
    proposeHouseholdChange,
    respondToHouseholdProposal,
    withdrawHouseholdProposal,
    repairHouseholdIssue,
    endHouseholdAgreement,
    prepareHouseholdExperiment
  });

  AXM.Households = {
    PROPOSAL_TYPES,
    PROPOSAL_STATUSES,
    FINANCE_MODES,
    SPACE_MODES,
    GOAL_TYPES,
    REPAIR_APPROACHES,
    RENOVATION_KINDS,
    ensureState,
    householdById,
    proposalById,
    issueById,
    playerHousehold,
    partnerIdFor,
    partnerFor,
    isCohabiting,
    computeFinancialShares,
    refreshSpaceZones,
    zonesForProperty,
    canPlacePlayerObject,
    canPlaceNpcObject,
    rebalanceHouseholdObjects,
    eligibleJointMoveProperties,
    proposalSummary,
    proposalScore,
    redistributePropertyExpense,
    recordSharedExpensePayment,
    dailyTick,
    handleNpcHousingDecision,
    playerMovePermission,
    eligiblePlayerExitProperties,
    reserveDissolutionShares,
    validate
  };
}(typeof window !== 'undefined' ? window : globalThis));
