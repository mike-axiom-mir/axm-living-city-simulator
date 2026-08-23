(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  const INSTITUTION_SCHEMA = 'axm.living-city.community-institution/v0.6.0';
  const OPPORTUNITY_SCHEMA = 'axm.living-city.community-opportunity/v0.6.0';
  const CONNECTION_SCHEMA = 'axm.living-city.community-connection/v0.6.0';
  const ADVENTURE_SCHEMA = 'axm.living-city.adventure-thread/v0.6.0';

  const MEMBERSHIP_STATUSES = ['active', 'waiting', 'left', 'withdrawn'];
  const OPPORTUNITY_STATUSES = ['open', 'awaiting_player', 'pending_npc', 'available', 'in_progress', 'completed', 'declined', 'expired', 'cancelled'];
  const CONNECTION_KINDS = ['peer', 'mentor', 'neighbor', 'family_friend', 'creative_partner'];
  const ADVENTURE_STATUSES = ['active', 'completed', 'released'];

  const INSTITUTION_BLUEPRINTS = [
    {
      id: 'community_learning_house',
      name: 'Neighborhood Learning House',
      kind: 'learning_house',
      placeId: 'place_school',
      capacity: 8,
      tags: ['learning', 'focus', 'creativity', 'care', 'practical'],
      description: 'A small learning house where study, practical projects, play, and mutual help can mix without one correct path.',
      opening: { days: [0, 1, 2, 3, 4, 5], hour: 9, closes: 20 }
    },
    {
      id: 'community_repair_circle',
      name: 'Repair & Share Circle',
      kind: 'maker_circle',
      placeId: 'place_workshop',
      capacity: 5,
      tags: ['repair', 'practical', 'creativity', 'care'],
      description: 'People restore useful things, teach one another, and keep object history alive instead of treating replacement as progress.',
      opening: { days: [1, 3, 5, 6], hour: 11, closes: 21 }
    },
    {
      id: 'community_story_room',
      name: 'Quiet Story Room',
      kind: 'library_circle',
      placeId: 'place_library',
      capacity: 6,
      tags: ['quiet', 'learning', 'creativity', 'social'],
      description: 'Reading, local stories, source-preserving research, and small conversations for people who do not want a loud club.',
      opening: { days: [0, 1, 2, 3, 4, 5], hour: 10, closes: 20 }
    },
    {
      id: 'community_open_square',
      name: 'Open Square Commons',
      kind: 'commons',
      placeId: 'place_square',
      capacity: 10,
      tags: ['social', 'food', 'care', 'play', 'neighborhood'],
      description: 'A loose community commons for shared meals, small markets, games, and unplanned meetings. Membership never gates the public square.',
      opening: { days: [0, 1, 2, 3, 4, 5, 6], hour: 8, closes: 22 }
    },
    {
      id: 'community_pocket_park',
      name: 'Pocket Park Friends',
      kind: 'outdoor_circle',
      placeId: 'place_park',
      capacity: 8,
      tags: ['outdoors', 'quiet', 'social', 'care', 'play'],
      description: 'Walks, garden care, quiet sitting, and small neighborhood explorations. Participation can be as social or solitary as the person chooses.',
      opening: { days: [0, 1, 2, 3, 4, 5, 6], hour: 7, closes: 21 }
    }
  ];

  const OPPORTUNITY_TEMPLATES = [
    {
      id: 'open_learning_table', institutionId: 'community_learning_house', kind: 'drop_in', title: 'Open learning table',
      description: 'Bring a question, project, or half-formed curiosity. There is no test and no mandatory subject.',
      tags: ['learning', 'focus', 'creativity'], durationHours: 2, cost: 0, capacity: 6, startHours: [11, 15, 18], windowDays: 2,
      skillEffects: { focus: 0.8, creativity: 0.5 }, needEffects: { mood: 7, social: 4, energy: -4 }
    },
    {
      id: 'practical_skill_swap', institutionId: 'community_learning_house', kind: 'drop_in', title: 'Practical skill swap',
      description: 'Everyone brings one thing they can show and one thing they would like to understand.',
      tags: ['learning', 'practical', 'social'], durationHours: 3, cost: 2, capacity: 7, startHours: [12, 17], windowDays: 3,
      skillEffects: { focus: 0.4, repair: 0.5, cooking: 0.4, social: 0.5 }, needEffects: { mood: 8, social: 8, energy: -6 }
    },
    {
      id: 'repair_share_table', institutionId: 'community_repair_circle', kind: 'drop_in', title: 'Repair & share table',
      description: 'Diagnose one broken thing, learn one repair, and leave with more agency than dependency.',
      tags: ['repair', 'practical', 'care'], durationHours: 3, cost: 4, capacity: 5, startHours: [13, 18], windowDays: 3,
      skillEffects: { repair: 1.1, focus: 0.4 }, needEffects: { mood: 9, social: 5, energy: -7 }
    },
    {
      id: 'weird_small_build', institutionId: 'community_repair_circle', kind: 'drop_in', title: 'Make something weird and small',
      description: 'A deliberately low-stakes build session. Strange is allowed; usefulness is optional.',
      tags: ['repair', 'creativity', 'play'], durationHours: 3, cost: 5, capacity: 5, startHours: [14, 19], windowDays: 3,
      skillEffects: { creativity: 1.0, repair: 0.7 }, needEffects: { mood: 13, social: 3, energy: -7 }
    },
    {
      id: 'quiet_story_circle', institutionId: 'community_story_room', kind: 'drop_in', title: 'Quiet story circle',
      description: 'Listen, read, or tell something. Silence and simply being present are valid participation.',
      tags: ['quiet', 'creativity', 'social'], durationHours: 2, cost: 0, capacity: 6, startHours: [14, 18], windowDays: 3,
      skillEffects: { creativity: 0.6, social: 0.4, focus: 0.3 }, needEffects: { mood: 10, social: 6, energy: 1 }
    },
    {
      id: 'source_hunt', institutionId: 'community_story_room', kind: 'drop_in', title: 'Local source hunt',
      description: 'Trace an old neighborhood story back to what is observed, remembered, disputed, and actually documented.',
      tags: ['learning', 'focus', 'neighborhood'], durationHours: 3, cost: 0, capacity: 5, startHours: [12, 17], windowDays: 4,
      skillEffects: { focus: 1.0, creativity: 0.4 }, needEffects: { mood: 7, social: 3, energy: -5 }
    },
    {
      id: 'shared_meal_table', institutionId: 'community_open_square', kind: 'drop_in', title: 'Shared neighborhood meal',
      description: 'Bring something, contribute a little, or simply sit down. It is a meal, not a networking event.',
      tags: ['food', 'social', 'care', 'neighborhood'], durationHours: 2, cost: 6, capacity: 9, startHours: [12, 18], windowDays: 2,
      skillEffects: { cooking: 0.5, social: 0.5 }, needEffects: { hunger: 42, mood: 11, social: 10, energy: 2 }
    },
    {
      id: 'small_game_evening', institutionId: 'community_open_square', kind: 'drop_in', title: 'Small game evening',
      description: 'A casual shared-screen or table game where winning matters less than what happens around it.',
      tags: ['play', 'social', 'creativity'], durationHours: 3, cost: 1, capacity: 8, startHours: [18, 19], windowDays: 3,
      skillEffects: { social: 0.6, creativity: 0.5, focus: 0.3 }, needEffects: { mood: 14, social: 10, energy: -5 }
    },
    {
      id: 'quiet_corner_walk', institutionId: 'community_pocket_park', kind: 'drop_in', title: 'Map the quiet corners',
      description: 'Walk slowly and notice where the town feels safe, strange, beautiful, unfinished, or yours.',
      tags: ['outdoors', 'quiet', 'neighborhood', 'creativity'], durationHours: 2, cost: 0, capacity: 7, startHours: [10, 16, 19], windowDays: 3,
      skillEffects: { creativity: 0.6, focus: 0.3 }, needEffects: { mood: 15, social: 2, energy: -4 }
    },
    {
      id: 'garden_patch', institutionId: 'community_pocket_park', kind: 'drop_in', title: 'Restore a forgotten garden patch',
      description: 'A little repair, a little dirt, and visible improvement without pretending the whole world was fixed.',
      tags: ['outdoors', 'repair', 'care', 'neighborhood'], durationHours: 3, cost: 0, capacity: 6, startHours: [10, 15], windowDays: 4,
      skillEffects: { repair: 0.6, cooking: 0.3, focus: 0.3 }, needEffects: { mood: 12, social: 5, energy: -7, hygiene: -6 }
    }
  ];

  const ADVENTURE_TEMPLATES = [
    {
      id: 'forgotten_radio', title: 'The Forgotten Radio', theme: 'repair', institutionId: 'community_repair_circle',
      origin: 'A battered radio appears on the repair table with one station still faintly audible.',
      meaning: 'Follow an object history, meet the people attached to it, and decide what should be preserved.',
      tags: ['repair', 'story', 'neighborhood'],
      stages: [
        { id: 'listen_first', title: 'Listen before opening it', description: 'Trace the fault and ask where the radio came from before replacing anything.', durationHours: 2, cost: 0, skillEffects: { focus: 0.7, repair: 0.5 }, needEffects: { mood: 6, energy: -3 } },
        { id: 'find_the_voice', title: 'Find the voice behind the note', description: 'A name inside the casing points toward an old resident and an unfinished story.', durationHours: 3, cost: 2, skillEffects: { social: 0.6, focus: 0.5 }, needEffects: { mood: 9, social: 5, energy: -5 } },
        { id: 'restore_with_history', title: 'Restore it without erasing its history', description: 'Make it usable again while keeping the marks that explain where it has been.', durationHours: 3, cost: 5, skillEffects: { repair: 1.2, creativity: 0.5 }, needEffects: { mood: 14, energy: -6 } }
      ]
    },
    {
      id: 'quiet_map', title: 'A Map of Quiet Places', theme: 'exploration', institutionId: 'community_pocket_park',
      origin: 'Someone wonders whether a city can be mapped by how it feels instead of only by streets.',
      meaning: 'Discover small places where different kinds of people can breathe, think, meet, or be alone.',
      tags: ['quiet', 'outdoors', 'creativity'],
      stages: [
        { id: 'notice', title: 'Notice what maps usually ignore', description: 'Walk without a destination and mark three places by atmosphere rather than function.', durationHours: 2, cost: 0, skillEffects: { focus: 0.5, creativity: 0.6 }, needEffects: { mood: 12, energy: -3 } },
        { id: 'compare', title: 'Compare different kinds of quiet', description: 'Ask someone else which places let them feel most like themselves.', durationHours: 2, cost: 0, skillEffects: { social: 0.6, creativity: 0.4 }, needEffects: { mood: 9, social: 5, energy: -3 } },
        { id: 'leave_a_map', title: 'Leave a map that does not command anyone', description: 'Share suggestions as possibilities, not a ranking or route people must follow.', durationHours: 2, cost: 1, skillEffects: { creativity: 0.8, focus: 0.4 }, needEffects: { mood: 13, social: 3, energy: -3 } }
      ]
    },
    {
      id: 'new_neighbor', title: 'The New Neighbor Who Knows Nobody', theme: 'connection', institutionId: 'community_open_square',
      origin: 'A new resident keeps circling the square without quite joining anything.',
      meaning: 'Offer connection without trapping, fixing, or making yourself indispensable.',
      tags: ['social', 'care', 'neighborhood'],
      stages: [
        { id: 'make_room', title: 'Make room without demanding a story', description: 'Offer a seat and an easy exit. Let silence remain possible.', durationHours: 1, cost: 0, skillEffects: { social: 0.5 }, needEffects: { mood: 7, social: 4 } },
        { id: 'show_choices', title: 'Show choices, not a correct path', description: 'Share a few places and people they might like, while leaving the choice entirely theirs.', durationHours: 2, cost: 0, skillEffects: { social: 0.7, focus: 0.2 }, needEffects: { mood: 9, social: 6, energy: -2 } },
        { id: 'let_connection_breathe', title: 'Let the connection breathe', description: 'Meet again only because both of you choose to, not because the game demands a loyalty meter.', durationHours: 2, cost: 3, skillEffects: { social: 0.8 }, needEffects: { mood: 13, social: 8, hunger: 18, energy: -2 } }
      ]
    },
    {
      id: 'blank_wall', title: 'The Blank Wall Project', theme: 'creation', institutionId: 'community_learning_house',
      origin: 'A blank community wall has been left open because nobody wants one person to decide what belongs there.',
      meaning: 'Create something shared without flattening everyone into one visual voice.',
      tags: ['creativity', 'care', 'neighborhood'],
      stages: [
        { id: 'collect_fragments', title: 'Collect fragments, not votes', description: 'Ask for colors, words, objects, and memories without turning the project into a popularity contest.', durationHours: 2, cost: 0, skillEffects: { creativity: 0.6, social: 0.4 }, needEffects: { mood: 8, social: 4, energy: -3 } },
        { id: 'make_space', title: 'Make space for differences', description: 'Build a loose composition where contrasting pieces can remain themselves.', durationHours: 3, cost: 4, skillEffects: { creativity: 1.0, focus: 0.4 }, needEffects: { mood: 12, energy: -6 } },
        { id: 'leave_it_editable', title: 'Leave it editable', description: 'Finish the first version while preserving room for later people to add or remove their own contribution.', durationHours: 2, cost: 2, skillEffects: { creativity: 0.8, repair: 0.3 }, needEffects: { mood: 14, social: 4, energy: -4 } }
      ]
    },
    {
      id: 'seed_trail', title: 'The Trail of Tiny Planted Objects', theme: 'mystery', institutionId: 'community_story_room',
      origin: 'Small repaired objects begin appearing around the neighborhood, each with a hand-written clue.',
      meaning: 'Follow a harmless mystery whose reward is understanding the person and pattern behind it.',
      tags: ['focus', 'creativity', 'repair', 'neighborhood'],
      stages: [
        { id: 'first_clue', title: 'Follow the first clue', description: 'Notice the repair marks and trace where the material came from.', durationHours: 2, cost: 0, skillEffects: { focus: 0.7, repair: 0.3 }, needEffects: { mood: 10, energy: -3 } },
        { id: 'compare_sources', title: 'Compare stories without forcing certainty', description: 'Different residents remember different explanations. Keep observed, inferred, and disputed pieces separate.', durationHours: 3, cost: 0, skillEffects: { focus: 0.9, social: 0.4 }, needEffects: { mood: 9, social: 4, energy: -4 } },
        { id: 'meet_the_maker', title: 'Meet the maker', description: 'The trail leads to someone practicing courage through tiny acts of public creativity.', durationHours: 2, cost: 2, skillEffects: { social: 0.7, creativity: 0.7 }, needEffects: { mood: 15, social: 7, energy: -2 } }
      ]
    },
    {
      id: 'tiny_celebration', title: 'A Celebration Too Small to Sell Tickets For', theme: 'community', institutionId: 'community_open_square',
      origin: 'A few residents want to mark an ordinary day simply because life happened and they are still here.',
      meaning: 'Make a small celebration that does not require status, scarcity, or spectacle.',
      tags: ['social', 'food', 'play', 'creativity'],
      stages: [
        { id: 'ask_what_matters', title: 'Ask what people actually enjoy', description: 'Skip trend chasing and gather a few low-cost, genuinely wanted ideas.', durationHours: 2, cost: 0, skillEffects: { social: 0.6, focus: 0.3 }, needEffects: { mood: 8, social: 5, energy: -2 } },
        { id: 'build_lightly', title: 'Build it lightly', description: 'Use borrowed objects, simple food, music, and space that can return to normal afterward.', durationHours: 3, cost: 6, skillEffects: { creativity: 0.8, cooking: 0.5, repair: 0.3 }, needEffects: { mood: 12, hunger: 18, energy: -5 } },
        { id: 'let_it_end', title: 'Let it end without manufacturing FOMO', description: 'Enjoy the evening, clean up, and keep the memory without inventing a streak or annual obligation.', durationHours: 3, cost: 4, skillEffects: { social: 0.8, cooking: 0.3 }, needEffects: { mood: 18, social: 12, hunger: 24, energy: -5 } }
      ]
    },
    {
      id: 'unexpected_teacher', title: 'The Unexpected Teacher', theme: 'learning', institutionId: 'community_learning_house',
      origin: 'Someone you barely noticed is quietly excellent at a skill you have always found difficult.',
      meaning: 'Learn through mutual respect without turning a mentor into an authority over your life.',
      tags: ['learning', 'mentor', 'practical'],
      stages: [
        { id: 'notice_skill', title: 'Notice the real skill', description: 'Watch what they do and ask a specific question instead of assigning them a grand identity.', durationHours: 2, cost: 0, skillEffects: { focus: 0.6 }, needEffects: { mood: 7, social: 3, energy: -2 } },
        { id: 'practice_together', title: 'Practice together', description: 'Try, fail safely, and ask for feedback while remaining responsible for your own choices.', durationHours: 3, cost: 3, skillEffects: { focus: 0.5, repair: 0.5, creativity: 0.5 }, needEffects: { mood: 10, social: 5, energy: -6 } },
        { id: 'share_back', title: 'Share something back', description: 'Return value through your own strength so the relationship is not extraction disguised as learning.', durationHours: 2, cost: 1, skillEffects: { social: 0.6, creativity: 0.4 }, needEffects: { mood: 14, social: 7, energy: -3 } }
      ]
    }
  ];

  function stableRoll(text) {
    return (Core.hashString(String(text)) % 100000) / 100000;
  }

  function timeIndex(day, hour) {
    return day * 24 + hour;
  }

  function personIds(world) {
    return new Set(['player'].concat((world.people || []).map((person) => person.id)));
  }

  function institutionById(world, institutionId) {
    return (world.communityInstitutions || []).find((entry) => entry.id === institutionId) || null;
  }

  function opportunityById(world, opportunityId) {
    return (world.communityOpportunities || []).find((entry) => entry.id === opportunityId) || null;
  }

  function connectionById(world, connectionId) {
    return (world.communityConnections || []).find((entry) => entry.id === connectionId) || null;
  }

  function adventureById(world, adventureId) {
    return (world.adventureThreads || []).find((entry) => entry.id === adventureId) || null;
  }

  function activeAdventureFor(world, ownerId) {
    return (world.adventureThreads || []).find((entry) => entry.ownerId === ownerId && entry.status === 'active') || null;
  }

  function personProfile(world, person) {
    if (!person) return { social: 50, creativity: 50, repair: 20, focus: 30, cooking: 20, quiet: 50, outdoors: 45, care: 50, play: 50, practical: 40, learning: 45, neighborhood: 45 };
    const isPlayer = person.id === 'player';
    const traits = person.traits || (isPlayer ? { social: 55, creativity: 66, stability: 55, independence: 70, thrift: 58 } : {});
    const skills = person.skills || {};
    const social = Core.clamp((traits.social || 50) * 0.6 + (skills.social || 0) * 0.7, 0, 100);
    const creativity = Core.clamp((traits.creativity || 50) * 0.58 + (skills.creativity || 0) * 0.75, 0, 100);
    const repair = Core.clamp((skills.repair || 0) * 1.4 + (traits.creativity || 40) * 0.18, 0, 100);
    const focus = Core.clamp((skills.focus || 0) * 1.35 + (traits.stability || 50) * 0.22, 0, 100);
    const cooking = Core.clamp((skills.cooking || 0) * 1.6 + (traits.social || 45) * 0.18, 0, 100);
    const quiet = Core.clamp(100 - (traits.social || 50) * 0.65 + (traits.stability || 50) * 0.35, 0, 100);
    const care = Core.clamp((traits.stability || 50) * 0.48 + social * 0.42, 0, 100);
    const play = Core.clamp(creativity * 0.65 + (100 - (traits.stability || 50)) * 0.25 + 15, 0, 100);
    const practical = Core.clamp(repair * 0.55 + focus * 0.35 + cooking * 0.2, 0, 100);
    const learning = Core.clamp(focus * 0.55 + creativity * 0.35 + 15, 0, 100);
    const neighborhood = Core.clamp(social * 0.45 + care * 0.35 + 15, 0, 100);
    const outdoors = Core.clamp((traits.independence || 50) * 0.45 + quiet * 0.25 + 20, 0, 100);
    return { social, creativity, repair, focus, cooking, quiet, outdoors, care, play, practical, learning, neighborhood, mentor: learning };
  }

  function interestScore(world, person, tags) {
    const profile = personProfile(world, person);
    const values = (tags || []).map((tag) => profile[tag] == null ? 45 : profile[tag]);
    const base = values.length ? Core.average(values) : 45;
    const goal = String(person?.personalGoal || person?.activeObjective || '').toLowerCase();
    let goalBonus = 0;
    if (goal.includes('neighborhood') && tags.includes('neighborhood')) goalBonus += 12;
    if (goal.includes('craft') && (tags.includes('repair') || tags.includes('creativity'))) goalBonus += 12;
    if (goal.includes('freedom') && (tags.includes('quiet') || tags.includes('outdoors'))) goalBonus += 8;
    if (goal.includes('family') && tags.includes('care')) goalBonus += 8;
    if (goal.includes('beautiful') && tags.includes('creativity')) goalBonus += 9;
    return Core.clamp(Core.round(base + goalBonus, 1), 0, 100);
  }

  function appendInstitutionHistory(world, institution, type, message, details = {}) {
    if (!institution.history) institution.history = [];
    const entry = {
      id: Core.uniqueId(world, 'community_history'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    institution.history.push(entry);
    if (institution.history.length > 240) institution.history.splice(0, institution.history.length - 240);
    return entry;
  }

  function appendOpportunityHistory(world, opportunity, type, message, details = {}) {
    if (!opportunity.history) opportunity.history = [];
    const entry = {
      id: Core.uniqueId(world, 'opportunity_history'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    opportunity.history.push(entry);
    if (opportunity.history.length > 80) opportunity.history.splice(0, opportunity.history.length - 80);
    return entry;
  }

  function appendConnectionHistory(world, connection, type, message, details = {}) {
    if (!connection.history) connection.history = [];
    const entry = {
      id: Core.uniqueId(world, 'connection_history'), day: world.time.day, hour: world.time.hour, type, message,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [], evidence: details.evidence || null
    };
    connection.history.push(entry);
    if (connection.history.length > 120) connection.history.splice(0, connection.history.length - 120);
    return entry;
  }

  function appendAdventureHistory(world, adventure, type, message, details = {}) {
    if (!adventure.history) adventure.history = [];
    const entry = {
      id: Core.uniqueId(world, 'adventure_history'), day: world.time.day, hour: world.time.hour, type, message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [adventure.ownerId],
      causes: Array.isArray(details.causes) ? details.causes.slice() : [], evidence: details.evidence || null
    };
    adventure.history.push(entry);
    if (adventure.history.length > 120) adventure.history.splice(0, adventure.history.length - 120);
    return entry;
  }

  function ensureState(world) {
    if (!Array.isArray(world.communityInstitutions)) world.communityInstitutions = [];
    if (!Array.isArray(world.communityOpportunities)) world.communityOpportunities = [];
    if (!Array.isArray(world.communityConnections)) world.communityConnections = [];
    if (!Array.isArray(world.adventureThreads)) world.adventureThreads = [];
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (typeof world.settings.casualRealism !== 'boolean') world.settings.casualRealism = true;
    if (typeof world.settings.noDailyStreaks !== 'boolean') world.settings.noDailyStreaks = true;
    if (typeof world.settings.opportunityExpiryPenalty !== 'boolean') world.settings.opportunityExpiryPenalty = false;
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedCommunityInstitutionId === undefined) world.ui.selectedCommunityInstitutionId = null;
    if (world.ui.selectedCommunityOpportunityId === undefined) world.ui.selectedCommunityOpportunityId = null;
    if (world.ui.selectedCommunityConnectionId === undefined) world.ui.selectedCommunityConnectionId = null;
    if (world.ui.selectedAdventureId === undefined) world.ui.selectedAdventureId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.communityExperimentPrepared === undefined) world.flags.communityExperimentPrepared = false;
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    const defaults = {
      communityMembershipsStarted: 0,
      communityWaitlistEntries: 0,
      communityWaitlistPromotions: 0,
      communityMembershipsLeft: 0,
      communityOpportunitiesGenerated: 0,
      communityPlayerParticipations: 0,
      communityNpcParticipations: 0,
      communityRefusals: 0,
      communityOpportunityExpiries: 0,
      communityConnectionsFormed: 0,
      communityMentorLinks: 0,
      communityVisitsCompleted: 0,
      communityInvitesSent: 0,
      communityInvitesAccepted: 0,
      communityInvitesDeclined: 0,
      adventureThreadsStarted: 0,
      adventureStagesCompleted: 0,
      adventureThreadsCompleted: 0,
      adventureThreadsReleased: 0,
      npcAdventureThreadsStarted: 0,
      npcAdventureStagesCompleted: 0
    };
    Object.entries(defaults).forEach(([key, value]) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = value;
    });
    [world.player].concat(world.people || []).forEach((person) => {
      if (!person) return;
      if (!Number.isFinite(person.communityCooldownUntil)) person.communityCooldownUntil = 0;
      if (!Number.isFinite(person.adventureCooldownUntil)) person.adventureCooldownUntil = 0;
      if (!Array.isArray(person.communityTags)) person.communityTags = [];
    });
    return world;
  }

  function makeInstitution(world, blueprint) {
    return {
      schema: INSTITUTION_SCHEMA,
      id: blueprint.id,
      name: blueprint.name,
      kind: blueprint.kind,
      placeId: blueprint.placeId,
      capacity: blueprint.capacity,
      tags: blueprint.tags.slice(),
      description: blueprint.description,
      opening: Core.deepClone(blueprint.opening),
      status: 'active',
      members: [],
      mentorIds: [],
      foundedDay: world.time.day,
      history: []
    };
  }

  function membershipFor(institution, personId) {
    return (institution?.members || []).find((entry) => entry.personId === personId && ['active', 'waiting'].includes(entry.status)) || null;
  }

  function activeMembers(institution) {
    return (institution?.members || []).filter((entry) => entry.status === 'active');
  }

  function waitingMembers(institution) {
    return (institution?.members || []).filter((entry) => entry.status === 'waiting');
  }

  function addMembership(world, institution, personId, status, reason, seeded = false) {
    const existing = (institution.members || []).find((entry) => entry.personId === personId && ['active', 'waiting'].includes(entry.status));
    if (existing) return existing;
    const record = {
      id: Core.uniqueId(world, 'community_member'),
      personId,
      status,
      appliedDay: world.time.day,
      joinedDay: status === 'active' ? world.time.day : null,
      leftDay: null,
      participationCount: 0,
      lastParticipationDay: null,
      reasons: [reason],
      seeded: Boolean(seeded),
      history: [{ day: world.time.day, hour: world.time.hour, type: status === 'active' ? 'joined' : 'waitlisted', message: reason }]
    };
    institution.members.push(record);
    if (!seeded) {
      if (status === 'active') world.metrics.communityMembershipsStarted += 1;
      else world.metrics.communityWaitlistEntries += 1;
    }
    appendInstitutionHistory(world, institution, status === 'active' ? 'member_joined' : 'member_waitlisted', `${World.personName(world, personId)} ${status === 'active' ? 'joined' : 'entered the waiting state for'} ${institution.name}.`, {
      actorIds: [personId], causes: [reason], evidence: { membershipId: record.id, capacity: institution.capacity, activeMembers: activeMembers(institution).length }
    });
    return record;
  }

  function seedInstitutionMembers(world, institution) {
    const candidates = world.people.slice().sort((a, b) => {
      const difference = interestScore(world, b, institution.tags) - interestScore(world, a, institution.tags);
      if (Math.abs(difference) > 0.01) return difference;
      return a.id.localeCompare(b.id);
    });
    const target = institution.id === 'community_repair_circle'
      ? institution.capacity
      : Math.min(institution.capacity - 1, 3 + (Core.hashString(`${world.seed}|${institution.id}|seed-count`) % 3));
    candidates.slice(0, target).forEach((person) => addMembership(world, institution, person.id, 'active', 'autonomous starting affinity in a newly seeded world', true));
    const primaryTag = institution.tags[0];
    const mentorCandidates = activeMembers(institution).map((member) => World.getPerson(world, member.personId)).filter(Boolean)
      .sort((a, b) => interestScore(world, b, [primaryTag, 'learning']) - interestScore(world, a, [primaryTag, 'learning']));
    institution.mentorIds = mentorCandidates.slice(0, institution.capacity >= 8 ? 2 : 1).map((person) => person.id);
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    if (!world.communityInstitutions.length) {
      world.communityInstitutions = INSTITUTION_BLUEPRINTS.map((blueprint) => makeInstitution(world, blueprint));
      world.communityInstitutions.forEach((institution) => appendInstitutionHistory(world, institution, 'foundation', `${institution.name} entered the living city as optional community infrastructure.`, {
        causes: ['deterministic community foundation', 'membership does not control people'], evidence: { capacity: institution.capacity, placeId: institution.placeId }
      }));
      if (options.newWorld && !options.migration) world.communityInstitutions.forEach((institution) => seedInstitutionMembers(world, institution));
    }
    if (options.newWorld && !options.migration && world.communityOpportunities.length === 0) {
      ensureOpportunitySupply(world, 5, { initial: true });
    }
    if (!options.silent && !world.flags.communityFoundationLogged) {
      Core.appendLedger(world, 'community', 'Community life is now a field of optional invitations, relationships, and adventures. No streak, compulsory attendance, or universal growth path was created.', {
        causes: ['casual realism root', 'be yourself', 'find your adventure', 'do not reward harm', 'grow in your own way'],
        evidence: { institutions: world.communityInstitutions.length, noDailyStreaks: true, expiryPenalty: false }
      });
      world.flags.communityFoundationLogged = true;
    }
    return world;
  }

  function requestMembership(world, institutionId) {
    ensureState(world);
    const institution = institutionById(world, institutionId);
    if (!institution || institution.status !== 'active') return { ok: false, reason: 'That community place is not currently active.' };
    const existing = membershipFor(institution, 'player');
    if (existing) return { ok: false, reason: existing.status === 'active' ? 'You already belong here.' : 'You are already waiting for an opening.' };
    const status = activeMembers(institution).length < institution.capacity ? 'active' : 'waiting';
    const record = addMembership(world, institution, 'player', status, 'explicit player choice with no attendance obligation');
    Core.appendLedger(world, 'community', status === 'active'
      ? `You joined ${institution.name}. Nothing became a daily requirement.`
      : `You entered the visible waiting state for ${institution.name}. The rest of the community remains available without this membership.`, {
      actorIds: ['player'], placeId: institution.placeId,
      causes: ['explicit opt-in', 'no attendance streak', status === 'waiting' ? 'real membership capacity' : 'available membership capacity'],
      evidence: { institutionId, membershipId: record.id, status }
    });
    Systems.toast(world, status === 'active' ? `Joined ${institution.name}; attendance remains optional.` : `${institution.name} is full; your waiting state is visible and optional.`, status === 'active' ? 'success' : 'info');
    return { ok: true, membership: record, status };
  }

  function leaveInstitution(world, institutionId) {
    const institution = institutionById(world, institutionId);
    if (!institution) return { ok: false, reason: 'Unknown community place.' };
    const record = membershipFor(institution, 'player');
    if (!record) return { ok: false, reason: 'You have no active or waiting membership here.' };
    const wasActive = record.status === 'active';
    record.status = wasActive ? 'left' : 'withdrawn';
    record.leftDay = world.time.day;
    record.history.push({ day: world.time.day, hour: world.time.hour, type: record.status, message: 'Explicitly left without a hidden social or progression penalty.' });
    if (wasActive) world.metrics.communityMembershipsLeft += 1;
    appendInstitutionHistory(world, institution, 'member_left', `${world.player.name} ${wasActive ? 'left' : 'withdrew from the waiting state for'} ${institution.name}.`, {
      actorIds: ['player'], causes: ['explicit player choice', 'no hidden penalty']
    });
    processWaitlist(world, institution);
    Systems.toast(world, `${institution.name} released. Your history remains; no streak or relationship was damaged.`, 'info');
    return { ok: true };
  }

  function processWaitlist(world, institution) {
    let slots = institution.capacity - activeMembers(institution).length;
    if (slots <= 0) return [];
    const waiting = waitingMembers(institution).slice().sort((a, b) => a.appliedDay - b.appliedDay || a.id.localeCompare(b.id));
    const promoted = [];
    while (slots > 0 && waiting.length) {
      const record = waiting.shift();
      record.status = 'active';
      record.joinedDay = world.time.day;
      record.history.push({ day: world.time.day, hour: world.time.hour, type: 'promoted', message: 'A real membership place opened.' });
      world.metrics.communityWaitlistPromotions += 1;
      promoted.push(record);
      slots -= 1;
      appendInstitutionHistory(world, institution, 'waitlist_promoted', `${World.personName(world, record.personId)} received an opening at ${institution.name}.`, {
        actorIds: [record.personId], causes: ['membership capacity opened', 'oldest visible waiting state first'], evidence: { membershipId: record.id }
      });
      if (record.personId === 'player') {
        Core.appendLedger(world, 'community', `A membership opening became available at ${institution.name}. Joining still creates no attendance obligation.`, {
          actorIds: ['player'], placeId: institution.placeId, causes: ['visible waitlist promotion', 'no artificial urgency']
        });
      }
    }
    return promoted;
  }

  function templateById(templateId) {
    return OPPORTUNITY_TEMPLATES.find((entry) => entry.id === templateId) || null;
  }

  function adventureTemplateById(templateId) {
    return ADVENTURE_TEMPLATES.find((entry) => entry.id === templateId) || null;
  }

  function personAvailableFor(world, person, day, startHour, durationHours) {
    if (!person) return false;
    if (AXM.Family?.isDependent(person)) {
      if (Core.weekdayIndex(day) < 5 && startHour >= 9 && startHour < 16) return false;
      return true;
    }
    const job = Content.jobById(person.jobId);
    if (!job || Core.weekdayIndex(day) >= 5) return true;
    const eventStart = startHour;
    const eventEnd = startHour + durationHours;
    const workStart = job.shiftStart;
    const workEnd = job.shiftStart + job.hours;
    return eventEnd <= workStart || eventStart >= workEnd;
  }

  function chooseEventDay(world, template, ordinal) {
    const base = world.time.day + (ordinal % 2);
    for (let offset = 0; offset < 7; offset += 1) {
      const day = base + offset;
      const institution = institutionById(world, template.institutionId);
      if (!institution || institution.opening.days.includes(Core.weekdayIndex(day))) return day;
    }
    return base;
  }

  function createOpportunity(world, template, options = {}) {
    const institution = institutionById(world, template.institutionId);
    if (!institution) return null;
    const ordinal = world.metrics.communityOpportunitiesGenerated + world.communityOpportunities.length;
    const eventDay = options.eventDay || chooseEventDay(world, template, ordinal);
    const startHour = options.startHour == null
      ? template.startHours[Core.hashString(`${world.seed}|${eventDay}|${template.id}|start`) % template.startHours.length]
      : options.startHour;
    const opportunity = {
      schema: OPPORTUNITY_SCHEMA,
      id: Core.uniqueId(world, 'community_opportunity'),
      templateId: template.id,
      institutionId: template.institutionId,
      kind: template.kind,
      title: template.title,
      description: template.description,
      placeId: institution.placeId,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      eventDay,
      startHour,
      durationHours: template.durationHours,
      expiresDay: eventDay + template.windowDays,
      cost: template.cost,
      capacity: template.capacity,
      tags: template.tags.slice(),
      skillEffects: Core.deepClone(template.skillEffects),
      needEffects: Core.deepClone(template.needEffects),
      status: 'open',
      initiatorId: institution.id,
      hostId: null,
      inviteeId: null,
      participantIds: [],
      waitlistIds: [],
      playerResponse: null,
      playerCompletedDay: null,
      npcProcessed: false,
      authority: { tenancy: false, edit: false, storage: false, employment: false, care: false },
      history: []
    };
    const candidates = world.people.filter((person) => personAvailableFor(world, person, eventDay, startHour, template.durationHours))
      .map((person) => ({ person, score: interestScore(world, person, template.tags) + stableRoll(`${world.seed}|${eventDay}|${template.id}|${person.id}`) * 28 }))
      .sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
    const desiredNpcCount = Math.max(1, Math.min(template.capacity - 1, 2 + (Core.hashString(`${world.seed}|${eventDay}|${template.id}|attendance`) % Math.max(1, template.capacity - 2))));
    opportunity.participantIds = candidates.slice(0, desiredNpcCount).map((entry) => entry.person.id);
    appendOpportunityHistory(world, opportunity, 'created', `${opportunity.title} opened as an optional community possibility.`, {
      causes: ['deterministic community schedule', 'no attendance obligation'], evidence: { eventDay, startHour, capacity: opportunity.capacity, npcParticipants: opportunity.participantIds.length }
    });
    world.communityOpportunities.push(opportunity);
    world.metrics.communityOpportunitiesGenerated += 1;
    appendInstitutionHistory(world, institution, 'opportunity_opened', `${opportunity.title} opened for day ${eventDay}.`, {
      causes: ['community rhythm', 'optional participation'], evidence: { opportunityId: opportunity.id }
    });
    return opportunity;
  }

  function openOpportunities(world) {
    return world.communityOpportunities.filter((entry) => ['open', 'awaiting_player', 'pending_npc', 'available', 'in_progress'].includes(entry.status));
  }

  function ensureOpportunitySupply(world, target = 6, options = {}) {
    const existingTemplateKeys = new Set(openOpportunities(world).filter((entry) => entry.templateId).map((entry) => `${entry.templateId}|${entry.eventDay}`));
    let guard = 0;
    while (openOpportunities(world).filter((entry) => entry.kind === 'drop_in').length < target && guard < OPPORTUNITY_TEMPLATES.length * 3) {
      const index = (world.time.day * 3 + world.metrics.communityOpportunitiesGenerated + guard + (options.initial ? 2 : 0)) % OPPORTUNITY_TEMPLATES.length;
      const template = OPPORTUNITY_TEMPLATES[index];
      const eventDay = chooseEventDay(world, template, guard);
      const key = `${template.id}|${eventDay}`;
      if (!existingTemplateKeys.has(key)) {
        createOpportunity(world, template, { eventDay });
        existingTemplateKeys.add(key);
      }
      guard += 1;
    }
  }

  function socialRelation(world, aId, bId) {
    const a = World.getPerson(world, aId);
    const b = World.getPerson(world, bId);
    if (!a || !b) return null;
    if (!a.relationships) a.relationships = {};
    if (!b.relationships) b.relationships = {};
    if (!a.relationships[bId]) a.relationships[bId] = { friendship: 0, romance: 0, trust: 0, status: 'acquaintance', interactions: 0, lastInteractionDay: 0 };
    if (!b.relationships[aId]) b.relationships[aId] = { friendship: 0, romance: 0, trust: 0, status: 'acquaintance', interactions: 0, lastInteractionDay: 0 };
    return { a: a.relationships[bId], b: b.relationships[aId] };
  }

  function existingConnection(world, aId, bId, kind = null) {
    return world.communityConnections.find((entry) => entry.personIds.includes(aId) && entry.personIds.includes(bId) && (!kind || entry.kind === kind) && entry.status === 'active') || null;
  }

  function ensureConnection(world, aId, bId, kind = 'peer', details = {}) {
    if (!aId || !bId || aId === bId) return null;
    let connection = existingConnection(world, aId, bId, kind);
    if (!connection) {
      connection = {
        schema: CONNECTION_SCHEMA,
        id: Core.uniqueId(world, 'community_connection'),
        personIds: [aId, bId].sort(),
        kind: CONNECTION_KINDS.includes(kind) ? kind : 'peer',
        mentorId: details.mentorId || null,
        learnerId: details.learnerId || null,
        warmth: 8,
        trust: 5,
        sharedActivities: 0,
        createdDay: world.time.day,
        lastSharedDay: world.time.day,
        status: 'active',
        history: []
      };
      world.communityConnections.push(connection);
      world.metrics.communityConnectionsFormed += 1;
      if (connection.kind === 'mentor') world.metrics.communityMentorLinks += 1;
      appendConnectionHistory(world, connection, 'formed', `${World.personName(world, aId)} and ${World.personName(world, bId)} formed a ${connection.kind.replace('_', ' ')} connection.`, {
        causes: details.causes || ['shared voluntary activity']
      });
    }
    connection.sharedActivities += 1;
    connection.lastSharedDay = world.time.day;
    connection.warmth = Core.clamp(connection.warmth + (details.warmthGain == null ? 2 : details.warmthGain), 0, 100);
    connection.trust = Core.clamp(connection.trust + (details.trustGain == null ? 1 : details.trustGain), 0, 100);
    appendConnectionHistory(world, connection, 'shared_activity', details.message || 'Another voluntary shared experience was recorded.', {
      causes: details.causes || ['shared voluntary activity'], evidence: details.evidence || null
    });
    const relations = socialRelation(world, aId, bId);
    if (relations) {
      [relations.a, relations.b].forEach((relation) => {
        relation.friendship = Core.clamp((relation.friendship || 0) + 1.2, -100, 100);
        relation.trust = Core.clamp((relation.trust || 0) + 0.6, -100, 100);
        relation.interactions = (relation.interactions || 0) + 1;
        relation.lastInteractionDay = world.time.day;
        if (relation.friendship >= 45 && relation.status === 'acquaintance') relation.status = 'friend';
      });
    }
    return connection;
  }

  function mentorSkillForTags(tags) {
    if (tags.includes('repair')) return 'repair';
    if (tags.includes('creativity') || tags.includes('play')) return 'creativity';
    if (tags.includes('food')) return 'cooking';
    if (tags.includes('social') || tags.includes('care')) return 'social';
    return 'focus';
  }

  function createMentorLinkFromParticipants(world, opportunity, participantIds) {
    const skill = mentorSkillForTags(opportunity.tags || []);
    const people = participantIds.map((id) => World.getPerson(world, id)).filter(Boolean);
    if (people.length < 2) return null;
    const mentor = people.slice().sort((a, b) => (b.skills?.[skill] || 0) - (a.skills?.[skill] || 0))[0];
    const learner = people.slice().sort((a, b) => (a.skills?.[skill] || 0) - (b.skills?.[skill] || 0))[0];
    if (!mentor || !learner || mentor.id === learner.id || (mentor.skills?.[skill] || 0) - (learner.skills?.[skill] || 0) < 18) return null;
    return ensureConnection(world, mentor.id, learner.id, 'mentor', {
      mentorId: mentor.id, learnerId: learner.id,
      message: `${mentor.name} shared bounded ${Core.titleCase(skill)} guidance with ${learner.name}; the link grants no authority over the learner's life.`,
      causes: ['visible skill difference', 'shared voluntary activity', 'mentor role is bounded']
    });
  }

  function applyOpportunityEffects(person, opportunity, factor = 1) {
    const needEffects = {};
    Object.entries(opportunity.needEffects || {}).forEach(([key, value]) => { needEffects[key] = value * factor; });
    const skillEffects = {};
    Object.entries(opportunity.skillEffects || {}).forEach(([key, value]) => { skillEffects[key] = value * factor; });
    Systems.applyNeedEffects(person, needEffects);
    Systems.applySkillEffects(person, skillEffects);
  }

  function completeNpcOpportunity(world, opportunity) {
    if (opportunity.npcProcessed || !['open', 'available', 'in_progress'].includes(opportunity.status)) return false;
    const participants = opportunity.participantIds.filter((id) => id !== 'player').map((id) => World.getPerson(world, id)).filter(Boolean);
    participants.forEach((person) => {
      applyOpportunityEffects(person, opportunity, 0.65);
      person.autonomousActions = (person.autonomousActions || 0) + 1;
      person.communityCooldownUntil = world.time.day + 2 + (Core.hashString(`${opportunity.id}|${person.id}|cooldown`) % 4);
      const institution = institutionById(world, opportunity.institutionId);
      const membership = membershipFor(institution, person.id);
      if (membership?.status === 'active') {
        membership.participationCount += 1;
        membership.lastParticipationDay = world.time.day;
      }
      world.metrics.communityNpcParticipations += 1;
    });
    for (let i = 0; i < participants.length; i += 1) {
      for (let j = i + 1; j < participants.length; j += 1) {
        if (stableRoll(`${world.seed}|${opportunity.id}|${participants[i].id}|${participants[j].id}`) < 0.46) {
          ensureConnection(world, participants[i].id, participants[j].id, 'peer', {
            message: `${participants[i].name} and ${participants[j].name} shared ${opportunity.title.toLowerCase()}.`,
            causes: ['shared optional community activity'], evidence: { opportunityId: opportunity.id }
          });
        }
      }
    }
    createMentorLinkFromParticipants(world, opportunity, participants.map((person) => person.id));
    opportunity.npcProcessed = true;
    appendOpportunityHistory(world, opportunity, 'npc_session_completed', `${participants.length} autonomous resident${participants.length === 1 ? '' : 's'} took part without becoming player-controlled.`, {
      actorIds: participants.map((person) => person.id), causes: ['autonomous interest choice'], evidence: { participantCount: participants.length }
    });
    const institution = institutionById(world, opportunity.institutionId);
    if (institution) appendInstitutionHistory(world, institution, 'activity_completed', `${opportunity.title} became part of the place's history.`, {
      actorIds: participants.map((person) => person.id), evidence: { opportunityId: opportunity.id }
    });
    return true;
  }

  function locationForPerson(world, person) {
    if (!person || !world.communityOpportunities) return null;
    const now = timeIndex(world.time.day, world.time.hour);
    const opportunity = world.communityOpportunities.find((entry) => entry.participantIds.includes(person.id)
      && ['open', 'available', 'in_progress'].includes(entry.status)
      && now >= timeIndex(entry.eventDay, entry.startHour)
      && now < timeIndex(entry.eventDay, entry.startHour + entry.durationHours));
    if (!opportunity) return null;
    return { placeId: opportunity.placeId, activity: `taking part in ${opportunity.title.toLowerCase()}` };
  }

  function hourlyTick(world) {
    ensureState(world);
    const now = timeIndex(world.time.day, world.time.hour);
    world.communityOpportunities.forEach((opportunity) => {
      const end = timeIndex(opportunity.eventDay, opportunity.startHour + opportunity.durationHours);
      if (!opportunity.npcProcessed && now >= end) completeNpcOpportunity(world, opportunity);
    });
  }

  function waitUntilOpportunity(world, opportunity) {
    const now = timeIndex(world.time.day, world.time.hour);
    const start = timeIndex(opportunity.eventDay, opportunity.startHour);
    if (start <= now) return 0;
    const hours = start - now;
    Systems.advanceHours(world, hours);
    return hours;
  }

  function participateOpportunity(world, opportunityId) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first. Community life remains available afterward.' };
    const opportunity = opportunityById(world, opportunityId);
    if (!opportunity) return { ok: false, reason: 'That community possibility no longer exists.' };
    if (opportunity.playerCompletedDay) return { ok: false, reason: 'You already lived this particular community moment.' };
    if (['awaiting_player', 'pending_npc'].includes(opportunity.status)) return { ok: false, reason: 'This invitation still needs a real answer.' };
    if (!['open', 'available'].includes(opportunity.status)) return { ok: false, reason: `This opportunity is ${opportunity.status.replace('_', ' ')}.` };
    if (world.player.money < opportunity.cost) return { ok: false, reason: 'You do not currently have enough money for this optional activity.' };
    if (!opportunity.participantIds.includes('player') && opportunity.participantIds.length >= opportunity.capacity) {
      if (!opportunity.waitlistIds.includes('player')) opportunity.waitlistIds.push('player');
      appendOpportunityHistory(world, opportunity, 'player_waitlisted', 'The event reached its visible capacity. The waiting state creates no penalty or urgency.', {
        actorIds: ['player'], causes: ['real event capacity', 'no artificial urgency']
      });
      Systems.toast(world, 'This session is full. You can leave it alone; nothing is lost.', 'info');
      return { ok: true, waitlisted: true };
    }
    const waitedHours = waitUntilOpportunity(world, opportunity);
    if (!['open', 'available'].includes(opportunity.status) || world.time.day > opportunity.expiresDay) return { ok: false, reason: 'The event window passed while time advanced. Nothing was deducted or punished.' };
    const originalLocation = world.player.locationId;
    const originalHomePropertyId = world.player.homePropertyId;
    opportunity.status = 'in_progress';
    if (!opportunity.participantIds.includes('player')) opportunity.participantIds.push('player');
    world.player.money -= opportunity.cost;
    world.player.lifetimeSpend += opportunity.cost;
    world.player.locationId = opportunity.placeId;
    Systems.advanceHours(world, opportunity.durationHours);
    applyOpportunityEffects(world.player, opportunity, 1);
    const otherIds = opportunity.participantIds.filter((id) => id !== 'player');
    otherIds.slice(0, 4).forEach((personId) => ensureConnection(world, 'player', personId, opportunity.kind === 'home_visit' ? 'neighbor' : 'peer', {
      message: `${world.player.name} and ${World.personName(world, personId)} shared ${opportunity.title.toLowerCase()}.`,
      causes: ['explicit player participation', 'shared voluntary activity'], evidence: { opportunityId: opportunity.id }
    }));
    createMentorLinkFromParticipants(world, opportunity, opportunity.participantIds);
    opportunity.playerCompletedDay = world.time.day;
    opportunity.status = 'completed';
    opportunity.playerResponse = opportunity.playerResponse || 'joined';
    world.player.locationId = opportunity.kind === 'home_visit' ? world.player.homePropertyId : opportunity.placeId;
    world.metrics.communityPlayerParticipations += 1;
    if (opportunity.kind === 'home_visit') world.metrics.communityVisitsCompleted += 1;
    const institution = institutionById(world, opportunity.institutionId);
    const membership = membershipFor(institution, 'player');
    if (membership?.status === 'active') {
      membership.participationCount += 1;
      membership.lastParticipationDay = world.time.day;
    }
    appendOpportunityHistory(world, opportunity, 'player_completed', `${world.player.name} chose to take part. Participation was one life moment, not a recurring obligation.`, {
      actorIds: opportunity.participantIds.slice(), causes: ['explicit player choice', 'no streak', 'no optimal build requirement'],
      evidence: { waitedHours, cost: opportunity.cost, durationHours: opportunity.durationHours, returnedTo: world.player.locationId }
    });
    if (opportunity.kind === 'home_visit' && world.player.homePropertyId !== originalHomePropertyId) {
      throw new Error('A community visit changed the player’s legal home pointer. The transaction was blocked by invariant evidence.');
    }
    Systems.toast(world, `${opportunity.title} became part of your story. Nothing new became mandatory.`, 'success');
    return { ok: true, waitedHours, opportunity };
  }

  function respondToCommunityOpportunity(world, opportunityId, response) {
    const opportunity = opportunityById(world, opportunityId);
    if (!opportunity) return { ok: false, reason: 'Unknown community invitation.' };
    if (opportunity.status !== 'awaiting_player') return { ok: false, reason: 'This invitation is not waiting for your answer.' };
    if (!['accept', 'decline'].includes(response)) return { ok: false, reason: 'Response must be accept or decline.' };
    opportunity.playerResponse = response;
    if (response === 'accept') {
      opportunity.status = 'available';
      world.metrics.communityInvitesAccepted += 1;
      appendOpportunityHistory(world, opportunity, 'accepted', 'The invitation became available. Acceptance did not create tenancy, edit rights, storage rights, or an attendance streak.', {
        actorIds: ['player', opportunity.hostId].filter(Boolean), causes: ['explicit player acceptance'], evidence: Core.deepClone(opportunity.authority)
      });
      Systems.toast(world, 'Invitation accepted. Join when it feels right before the visible window closes.', 'success');
      return { ok: true, accepted: true };
    }
    opportunity.status = 'declined';
    world.metrics.communityRefusals += 1;
    world.metrics.communityInvitesDeclined += 1;
    appendOpportunityHistory(world, opportunity, 'declined', 'The invitation was declined without a hidden relationship, progression, or reputation penalty.', {
      actorIds: ['player', opportunity.hostId].filter(Boolean), causes: ['explicit player refusal', 'no hidden penalty']
    });
    Systems.toast(world, 'Invitation declined. The relationship was not secretly punished.', 'info');
    return { ok: true, accepted: false };
  }

  function makeVisitOpportunity(world, hostId, inviteeId, status, options = {}) {
    const host = World.getPerson(world, hostId);
    const invitee = World.getPerson(world, inviteeId);
    if (!host || !invitee) return null;
    const hostHome = World.homeOf(world, hostId);
    if (!hostHome) return null;
    const eventDay = world.time.day + (options.delayDays == null ? 1 : options.delayDays);
    return {
      schema: OPPORTUNITY_SCHEMA,
      id: Core.uniqueId(world, 'community_opportunity'),
      templateId: null,
      institutionId: null,
      kind: 'home_visit',
      title: `A casual visit with ${host.name}`,
      description: 'Spend a little time together in a real home. Visiting grants no tenancy, storage, construction, or edit authority.',
      placeId: hostHome.id,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      eventDay,
      startHour: 18,
      durationHours: 2,
      expiresDay: eventDay + 5,
      cost: 2,
      capacity: Math.max(2, Math.min(hostHome.capacity + 2, 6)),
      tags: ['social', 'neighbor', 'care'],
      skillEffects: { social: 0.5, cooking: 0.2 },
      needEffects: { mood: 12, social: 10, hunger: 16, energy: -2 },
      status,
      initiatorId: options.initiatorId || hostId,
      hostId,
      inviteeId,
      participantIds: [hostId],
      waitlistIds: [],
      playerResponse: null,
      playerCompletedDay: null,
      npcProcessed: false,
      authority: { tenancy: false, edit: false, storage: false, employment: false, care: false },
      history: []
    };
  }

  function inviteCommunityConnection(world, personId) {
    ensureState(world);
    const person = World.getPerson(world, personId);
    if (!person || personId === 'player') return { ok: false, reason: 'Choose another resident.' };
    if (AXM.Family?.isDependent(person)) return { ok: false, reason: 'Dependent social time uses family and age-appropriate community paths, not an adult home invitation.' };
    const existing = world.communityOpportunities.find((entry) => entry.kind === 'home_visit' && entry.initiatorId === 'player' && entry.inviteeId === personId && ['pending_npc', 'available'].includes(entry.status));
    if (existing) return { ok: false, reason: 'A visible invitation with this resident is already open.' };
    const opportunity = makeVisitOpportunity(world, 'player', personId, 'pending_npc', { initiatorId: 'player', delayDays: 2 });
    if (!opportunity) return { ok: false, reason: 'A lawful home visit could not be prepared.' };
    opportunity.dueDay = world.time.day + 1;
    world.communityOpportunities.push(opportunity);
    world.metrics.communityInvitesSent += 1;
    appendOpportunityHistory(world, opportunity, 'invited', `${world.player.name} invited ${person.name}. Sending did not create consent or a visit.`, {
      actorIds: ['player', person.id], causes: ['explicit player invitation'], evidence: Core.deepClone(opportunity.authority)
    });
    Systems.toast(world, `${person.name} will answer autonomously.`, 'info');
    return { ok: true, opportunity };
  }

  function resolvePendingNpcInvites(world) {
    world.communityOpportunities.filter((entry) => entry.status === 'pending_npc' && world.time.day >= (entry.dueDay || entry.createdDay + 1)).forEach((opportunity) => {
      const invitee = World.getPerson(world, opportunity.inviteeId);
      const relation = invitee?.relationships?.player || world.player.relationships?.[invitee?.id] || { friendship: 0, trust: 0 };
      const score = (relation.friendship || 0) * 0.48 + (relation.trust || 0) * 0.35 + (invitee?.traits?.social || 50) * 0.22 - (invitee?.traits?.independence || 50) * 0.1;
      const roll = stableRoll(`${world.seed}|${opportunity.id}|npc-visit-answer`) * 100;
      if (score + 30 >= roll) {
        opportunity.status = 'available';
        opportunity.participantIds = Array.from(new Set([opportunity.hostId, opportunity.inviteeId]));
        world.metrics.communityInvitesAccepted += 1;
        appendOpportunityHistory(world, opportunity, 'npc_accepted', `${invitee.name} accepted the invitation autonomously.`, {
          actorIds: ['player', invitee.id], causes: ['relationship evidence', 'autonomous answer'], evidence: { score: Core.round(score, 1), roll: Core.round(roll, 1) }
        });
      } else {
        opportunity.status = 'declined';
        world.metrics.communityInvitesDeclined += 1;
        world.metrics.communityRefusals += 1;
        appendOpportunityHistory(world, opportunity, 'npc_declined', `${invitee.name} declined. No hidden friendship or trust penalty was applied.`, {
          actorIds: ['player', invitee.id], causes: ['autonomous answer', 'no hidden penalty'], evidence: { score: Core.round(score, 1), roll: Core.round(roll, 1) }
        });
      }
    });
  }

  function maybeCreateNpcInvite(world) {
    const openIncoming = world.communityOpportunities.some((entry) => entry.status === 'awaiting_player');
    if (openIncoming || world.time.day < 4 || world.time.day % 7 !== (Core.hashString(world.seed) % 7)) return null;
    const candidates = world.people.filter((person) => !AXM.Family?.isDependent(person))
      .map((person) => ({ person, relation: world.player.relationships[person.id] || { friendship: 0, trust: 0 } }))
      .filter((entry) => (entry.relation.friendship || 0) >= 15)
      .sort((a, b) => (b.relation.friendship + b.relation.trust) - (a.relation.friendship + a.relation.trust));
    if (!candidates.length) return null;
    const selected = candidates[Core.hashString(`${world.seed}|${world.time.day}|incoming-visit`) % Math.min(4, candidates.length)].person;
    const opportunity = makeVisitOpportunity(world, selected.id, 'player', 'awaiting_player', { initiatorId: selected.id, delayDays: 1 });
    if (!opportunity) return null;
    opportunity.participantIds = [selected.id];
    world.communityOpportunities.push(opportunity);
    world.metrics.communityInvitesSent += 1;
    appendOpportunityHistory(world, opportunity, 'npc_invited_player', `${selected.name} invited you to a casual visit. Accepting and declining are both valid.`, {
      actorIds: [selected.id, 'player'], causes: ['autonomous resident initiative', 'existing relationship evidence'], evidence: Core.deepClone(opportunity.authority)
    });
    Core.appendLedger(world, 'community', `${selected.name} invited you to spend a little time together. It is an invitation, not an obligation.`, {
      actorIds: [selected.id, 'player'], placeId: opportunity.placeId, causes: ['autonomous invitation', 'player retains refusal']
    });
    return opportunity;
  }

  function chooseAdventureCompanion(world, template, ownerId) {
    const owner = World.getPerson(world, ownerId);
    if (!owner) return null;
    const connected = world.communityConnections.filter((connection) => connection.status === 'active' && connection.personIds.includes(ownerId))
      .map((connection) => ({
        person: World.getPerson(world, connection.personIds.find((id) => id !== ownerId)),
        score: connection.warmth + connection.trust + connection.sharedActivities * 3
      })).filter((entry) => entry.person);
    const pool = connected.length ? connected : world.people.filter((person) => person.id !== ownerId).map((person) => ({ person, score: interestScore(world, person, template.tags) }));
    if (!pool.length) return null;
    pool.sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
    const top = pool.slice(0, Math.min(5, pool.length));
    return top[Core.hashString(`${world.seed}|${world.time.day}|${ownerId}|${template.id}|companion`) % top.length].person;
  }

  function chooseAdventureTemplate(world, owner) {
    const activeTemplateIds = new Set(world.adventureThreads.filter((entry) => entry.ownerId === owner.id).slice(-4).map((entry) => entry.templateId));
    const ranked = ADVENTURE_TEMPLATES.map((template) => ({
      template,
      weight: 10 + interestScore(world, owner, template.tags) + (activeTemplateIds.has(template.id) ? -28 : 0) + stableRoll(`${world.seed}|${world.time.day}|${owner.id}|${template.id}`) * 24
    })).sort((a, b) => b.weight - a.weight || a.template.id.localeCompare(b.template.id));
    return ranked[0].template;
  }

  function createAdventure(world, ownerId, options = {}) {
    const owner = World.getPerson(world, ownerId);
    if (!owner) return null;
    const template = options.templateId ? adventureTemplateById(options.templateId) : chooseAdventureTemplate(world, owner);
    if (!template) return null;
    const companion = options.companionId ? World.getPerson(world, options.companionId) : chooseAdventureCompanion(world, template, ownerId);
    const institution = institutionById(world, template.institutionId);
    const adventure = {
      schema: ADVENTURE_SCHEMA,
      id: Core.uniqueId(world, 'adventure'),
      ownerId,
      templateId: template.id,
      title: template.title,
      theme: template.theme,
      origin: template.origin,
      meaning: template.meaning,
      tags: template.tags.slice(),
      institutionId: template.institutionId,
      originPlaceId: institution?.placeId || null,
      companionId: companion?.id || null,
      status: 'active',
      stageIndex: 0,
      stages: template.stages.map((stage) => ({ ...Core.deepClone(stage), status: 'open', completedDay: null })),
      createdDay: world.time.day,
      completedDay: null,
      releasedDay: null,
      noDeadline: true,
      history: []
    };
    world.adventureThreads.push(adventure);
    appendAdventureHistory(world, adventure, 'discovered', `${owner.name} discovered ${adventure.title}. It has no deadline and can be released without punishment.`, {
      actorIds: [owner.id, companion?.id].filter(Boolean), causes: ['interest-led discovery', 'no quest deadline'], evidence: { companionId: companion?.id || null }
    });
    return adventure;
  }

  function discoverAdventure(world) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first; adventure should not silently abandon an active responsibility.' };
    const existing = activeAdventureFor(world, 'player');
    if (existing) return { ok: false, reason: `You already have an open thread: ${existing.title}. Continue it, pause indefinitely, or release it without penalty.` };
    const adventure = createAdventure(world, 'player');
    if (!adventure) return { ok: false, reason: 'No grounded adventure spark could be formed.' };
    world.ui.selectedAdventureId = adventure.id;
    world.metrics.adventureThreadsStarted += 1;
    world.player.locationId = adventure.originPlaceId || world.player.locationId;
    Systems.advanceHours(world, 1);
    Systems.applyNeedEffects(world.player, { mood: 5, energy: -1 });
    Core.appendLedger(world, 'adventure', `${adventure.title} entered your life as an optional thread: ${adventure.origin}`, {
      actorIds: ['player', adventure.companionId].filter(Boolean), placeId: adventure.originPlaceId,
      causes: ['player chose to wander for a spark', 'no deadline', 'no fixed hero path'], evidence: { adventureId: adventure.id, theme: adventure.theme }
    });
    Systems.toast(world, `${adventure.title} found you. Follow it whenever it still feels yours.`, 'success');
    return { ok: true, adventure };
  }

  function continueAdventure(world, adventureId) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first.' };
    const adventure = adventureById(world, adventureId);
    if (!adventure || adventure.ownerId !== 'player') return { ok: false, reason: 'That is not your active adventure thread.' };
    if (adventure.status !== 'active') return { ok: false, reason: `This adventure is ${adventure.status}.` };
    const stage = adventure.stages[adventure.stageIndex];
    if (!stage) return { ok: false, reason: 'The active stage is missing.' };
    if (world.player.money < stage.cost) return { ok: false, reason: 'You cannot currently cover this optional step. The adventure waits without a deadline.' };
    const institution = institutionById(world, adventure.institutionId);
    world.player.money -= stage.cost;
    world.player.lifetimeSpend += stage.cost;
    world.player.locationId = institution?.placeId || adventure.originPlaceId || world.player.locationId;
    Systems.advanceHours(world, stage.durationHours);
    Systems.applyNeedEffects(world.player, stage.needEffects || {});
    Systems.applySkillEffects(world.player, stage.skillEffects || {});
    stage.status = 'completed';
    stage.completedDay = world.time.day;
    adventure.stageIndex += 1;
    world.metrics.adventureStagesCompleted += 1;
    if (adventure.companionId) ensureConnection(world, 'player', adventure.companionId, adventure.theme === 'learning' ? 'mentor' : 'creative_partner', {
      mentorId: adventure.theme === 'learning' ? adventure.companionId : null,
      learnerId: adventure.theme === 'learning' ? 'player' : null,
      message: `${world.player.name} and ${World.personName(world, adventure.companionId)} lived the “${stage.title}” chapter of ${adventure.title}.`,
      causes: ['optional adventure step', 'shared agency'], evidence: { adventureId: adventure.id, stageId: stage.id }
    });
    appendAdventureHistory(world, adventure, 'stage_completed', `${stage.title} was completed. Growth remained multidirectional rather than a universal level.`, {
      actorIds: ['player', adventure.companionId].filter(Boolean), causes: ['explicit player continuation', 'no optimal path'], evidence: { stageId: stage.id, cost: stage.cost, durationHours: stage.durationHours }
    });
    if (adventure.stageIndex >= adventure.stages.length) {
      adventure.status = 'completed';
      adventure.completedDay = world.time.day;
      world.metrics.adventureThreadsCompleted += 1;
      appendAdventureHistory(world, adventure, 'completed', `${adventure.title} ended as a lived history, not an unlock chain.`, {
        actorIds: ['player', adventure.companionId].filter(Boolean), causes: ['all chosen stages completed']
      });
      Core.appendLedger(world, 'adventure', `${adventure.title} became a completed part of your history. ${adventure.meaning}`, {
        actorIds: ['player', adventure.companionId].filter(Boolean), placeId: adventure.originPlaceId,
        causes: ['player followed the thread to its natural end'], evidence: { adventureId: adventure.id }
      });
      Systems.toast(world, `${adventure.title} is complete. Nothing new became compulsory.`, 'success');
    } else {
      Systems.toast(world, `${stage.title} completed. The next step waits without a deadline.`, 'success');
    }
    return { ok: true, adventure, stage };
  }

  function releaseAdventure(world, adventureId) {
    const adventure = adventureById(world, adventureId);
    if (!adventure || adventure.ownerId !== 'player') return { ok: false, reason: 'Unknown personal adventure thread.' };
    if (adventure.status !== 'active') return { ok: false, reason: `This adventure is already ${adventure.status}.` };
    adventure.status = 'released';
    adventure.releasedDay = world.time.day;
    world.metrics.adventureThreadsReleased += 1;
    appendAdventureHistory(world, adventure, 'released', `${world.player.name} released the thread without a hidden mood, relationship, reputation, or progression penalty.`, {
      actorIds: ['player'], causes: ['explicit player choice', 'adventure is not obligation']
    });
    Systems.toast(world, `${adventure.title} released. Its history remains; no penalty was added.`, 'info');
    return { ok: true, adventure };
  }

  function npcAdventureTick(world) {
    const activeNpc = world.adventureThreads.filter((entry) => entry.ownerId !== 'player' && entry.status === 'active');
    const activeByOwner = new Set(activeNpc.map((entry) => entry.ownerId));
    if (activeNpc.length < 10) {
      world.people.filter((person) => !activeByOwner.has(person.id) && person.adventureCooldownUntil <= world.time.day)
        .forEach((person) => {
          const probability = AXM.Family?.isDependent(person) ? 0.012 : 0.02;
          if (stableRoll(`${world.seed}|${world.time.day}|${person.id}|adventure-start`) < probability) {
            const adventure = createAdventure(world, person.id);
            if (adventure) {
              person.adventureCooldownUntil = world.time.day + 18 + (Core.hashString(adventure.id) % 30);
              world.metrics.npcAdventureThreadsStarted += 1;
            }
          }
        });
    }
    world.adventureThreads.filter((entry) => entry.ownerId !== 'player' && entry.status === 'active').forEach((adventure) => {
      if (stableRoll(`${world.seed}|${world.time.day}|${adventure.id}|progress`) >= 0.18) return;
      const owner = World.getPerson(world, adventure.ownerId);
      const stage = adventure.stages[adventure.stageIndex];
      if (!owner || !stage || owner.money < stage.cost) return;
      owner.money -= stage.cost;
      applyOpportunityEffects(owner, { needEffects: stage.needEffects, skillEffects: stage.skillEffects }, 0.65);
      stage.status = 'completed';
      stage.completedDay = world.time.day;
      adventure.stageIndex += 1;
      world.metrics.npcAdventureStagesCompleted += 1;
      if (adventure.companionId) ensureConnection(world, adventure.ownerId, adventure.companionId, adventure.theme === 'learning' ? 'mentor' : 'creative_partner', {
        mentorId: adventure.theme === 'learning' ? adventure.companionId : null,
        learnerId: adventure.theme === 'learning' ? adventure.ownerId : null,
        message: `${owner.name} and ${World.personName(world, adventure.companionId)} continued ${adventure.title}.`,
        causes: ['autonomous adventure growth']
      });
      appendAdventureHistory(world, adventure, 'npc_stage_completed', `${owner.name} autonomously completed ${stage.title}.`, {
        actorIds: [owner.id, adventure.companionId].filter(Boolean), causes: ['autonomous interest-led choice']
      });
      if (adventure.stageIndex >= adventure.stages.length) {
        adventure.status = 'completed';
        adventure.completedDay = world.time.day;
        appendAdventureHistory(world, adventure, 'npc_completed', `${owner.name} completed the thread and kept their own history.`, {
          actorIds: [owner.id, adventure.companionId].filter(Boolean), causes: ['autonomous continuity']
        });
      }
    });
    if (world.adventureThreads.length > 260) {
      const removable = world.adventureThreads.filter((entry) => entry.status !== 'active').sort((a, b) => (a.completedDay || a.releasedDay || a.createdDay) - (b.completedDay || b.releasedDay || b.createdDay));
      const removeIds = new Set(removable.slice(0, world.adventureThreads.length - 260).map((entry) => entry.id));
      world.adventureThreads = world.adventureThreads.filter((entry) => !removeIds.has(entry.id));
    }
  }

  function expireOpportunities(world) {
    world.communityOpportunities.forEach((opportunity) => {
      if (!['open', 'awaiting_player', 'available'].includes(opportunity.status)) return;
      if (world.time.day <= opportunity.expiresDay) return;
      opportunity.status = 'expired';
      world.metrics.communityOpportunityExpiries += 1;
      appendOpportunityHistory(world, opportunity, 'expired', 'The possibility passed without a hidden relationship, mood, reputation, or progression penalty.', {
        actorIds: ['player'], causes: ['visible time window ended', 'no FOMO mechanics', 'no daily streak']
      });
    });
    if (world.communityOpportunities.length > 300) {
      const closed = world.communityOpportunities.filter((entry) => !['open', 'awaiting_player', 'pending_npc', 'available', 'in_progress'].includes(entry.status))
        .sort((a, b) => a.createdDay - b.createdDay || a.id.localeCompare(b.id));
      const removeIds = new Set(closed.slice(0, world.communityOpportunities.length - 300).map((entry) => entry.id));
      world.communityOpportunities = world.communityOpportunities.filter((entry) => !removeIds.has(entry.id));
    }
  }

  function maybeAutonomousMembershipChanges(world) {
    world.communityInstitutions.forEach((institution) => {
      if (world.time.day % 14 === Core.hashString(`${world.seed}|${institution.id}|membership-day`) % 14) {
        const active = activeMembers(institution);
        const leaveCandidate = active.find((record) => record.personId !== 'player'
          && stableRoll(`${world.seed}|${world.time.day}|${institution.id}|${record.personId}|leave`) < 0.08);
        if (leaveCandidate) {
          leaveCandidate.status = 'left';
          leaveCandidate.leftDay = world.time.day;
          leaveCandidate.history.push({ day: world.time.day, hour: world.time.hour, type: 'left', message: 'Autonomously changed direction without being punished.' });
          appendInstitutionHistory(world, institution, 'member_left', `${World.personName(world, leaveCandidate.personId)} left to follow a different rhythm.`, {
            actorIds: [leaveCandidate.personId], causes: ['autonomous direction change', 'no membership lock-in']
          });
        }
        processWaitlist(world, institution);
        if (activeMembers(institution).length < institution.capacity) {
          const candidates = world.people.filter((person) => !membershipFor(institution, person.id) && person.communityCooldownUntil <= world.time.day)
            .map((person) => ({ person, score: interestScore(world, person, institution.tags) }))
            .filter((entry) => entry.score >= 48)
            .sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
          if (candidates.length && stableRoll(`${world.seed}|${world.time.day}|${institution.id}|new-member`) < 0.45) {
            addMembership(world, institution, candidates[0].person.id, 'active', 'autonomous interest and an available place', false);
          }
        }
      }
      institution.mentorIds = institution.mentorIds.filter((personId) => membershipFor(institution, personId)?.status === 'active');
      if (!institution.mentorIds.length) {
        const candidate = activeMembers(institution).map((member) => World.getPerson(world, member.personId)).filter(Boolean)
          .sort((a, b) => interestScore(world, b, institution.tags) - interestScore(world, a, institution.tags))[0];
        if (candidate) institution.mentorIds = [candidate.id];
      }
    });
  }

  function prepareCommunityAdventureExperiment(world) {
    ensureState(world);
    if (world.flags.communityExperimentPrepared) return { ok: false, reason: 'The labeled community experiment was already prepared.' };
    const institution = institutionById(world, 'community_repair_circle');
    if (!institution) return { ok: false, reason: 'Repair & Share Circle is unavailable.' };
    while (activeMembers(institution).length < institution.capacity) {
      const candidate = world.people.find((person) => !membershipFor(institution, person.id));
      if (!candidate) break;
      addMembership(world, institution, candidate.id, 'active', 'explicit labeled capacity experiment', true);
    }
    const membership = membershipFor(institution, 'player') || addMembership(world, institution, 'player', 'waiting', 'explicit labeled waiting-state experiment', false);
    membership.status = 'waiting';
    membership.joinedDay = null;
    if (!waitingMembers(institution).includes(membership)) institution.members.push(membership);
    const relationCandidate = world.people.find((person) => !AXM.Family?.isDependent(person));
    if (relationCandidate) {
      const relation = Systems.getRelation(world.player, relationCandidate.id);
      relation.friendship = Math.max(relation.friendship, 36);
      relation.trust = Math.max(relation.trust, 28);
      ensureConnection(world, 'player', relationCandidate.id, 'neighbor', {
        message: 'A labeled connection was prepared for visit-boundary QA.', causes: ['explicit developer experiment']
      });
      const invite = makeVisitOpportunity(world, relationCandidate.id, 'player', 'awaiting_player', { initiatorId: relationCandidate.id, delayDays: 1 });
      world.communityOpportunities.push(invite);
      appendOpportunityHistory(world, invite, 'experiment_prepared', 'A labeled incoming visit was created to test refusal, participation, and no-tenancy boundaries.', {
        actorIds: ['player', relationCandidate.id], causes: ['explicit developer experiment']
      });
    }
    const existingAdventure = activeAdventureFor(world, 'player');
    const adventure = existingAdventure || createAdventure(world, 'player', { templateId: 'forgotten_radio', companionId: relationCandidate?.id });
    if (adventure) {
      world.ui.selectedAdventureId = adventure.id;
      if (!existingAdventure) world.metrics.adventureThreadsStarted += 1;
    }
    world.flags.communityExperimentPrepared = true;
    world.ui.selectedCommunityInstitutionId = institution.id;
    Core.appendLedger(world, 'research', 'A labeled community-adventure experiment prepared real membership capacity, a visible waiting state, a bounded home invitation, and a no-deadline adventure thread.', {
      actorIds: ['player', relationCandidate?.id].filter(Boolean), placeId: institution.placeId,
      causes: ['explicit developer experiment', 'not normal progression'], evidence: { institutionId: institution.id, membershipId: membership.id, adventureId: adventure?.id || null }
    });
    Systems.toast(world, 'Community experiment prepared: waiting state, invitation, and adventure are all visible.', 'warning');
    return { ok: true, institutionId: institution.id, adventureId: adventure?.id || null };
  }

  function dailyTick(world) {
    ensureState(world);
    resolvePendingNpcInvites(world);
    expireOpportunities(world);
    maybeAutonomousMembershipChanges(world);
    maybeCreateNpcInvite(world);
    npcAdventureTick(world);
    ensureOpportunitySupply(world, 6);
    world.communityInstitutions.forEach((institution) => processWaitlist(world, institution));
  }

  function metrics(world) {
    ensureState(world);
    const activeMemberships = world.communityInstitutions.reduce((sum, institution) => sum + activeMembers(institution).length, 0);
    const waiting = world.communityInstitutions.reduce((sum, institution) => sum + waitingMembers(institution).length, 0);
    const open = openOpportunities(world);
    const playerConnections = world.communityConnections.filter((entry) => entry.status === 'active' && entry.personIds.includes('player'));
    const activeAdventures = world.adventureThreads.filter((entry) => entry.status === 'active');
    return {
      institutions: world.communityInstitutions.length,
      activeMemberships,
      waitingMemberships: waiting,
      openOpportunities: open.length,
      awaitingPlayer: open.filter((entry) => entry.status === 'awaiting_player').length,
      availableInvites: open.filter((entry) => entry.status === 'available' && entry.kind === 'home_visit').length,
      playerConnections: playerConnections.length,
      mentorLinks: world.communityConnections.filter((entry) => entry.status === 'active' && entry.kind === 'mentor').length,
      activeAdventures: activeAdventures.length,
      playerActiveAdventure: Boolean(activeAdventureFor(world, 'player')),
      completedAdventures: world.adventureThreads.filter((entry) => entry.status === 'completed').length,
      visitsCompleted: world.metrics.communityVisitsCompleted || 0
    };
  }

  function validate(world, add) {
    if (!Array.isArray(world.communityInstitutions)) add('communityInstitutions must be an array.');
    if (!Array.isArray(world.communityOpportunities)) add('communityOpportunities must be an array.');
    if (!Array.isArray(world.communityConnections)) add('communityConnections must be an array.');
    if (!Array.isArray(world.adventureThreads)) add('adventureThreads must be an array.');
    if (!Array.isArray(world.communityInstitutions) || !Array.isArray(world.communityOpportunities) || !Array.isArray(world.communityConnections) || !Array.isArray(world.adventureThreads)) return;
    const people = personIds(world);
    const institutionIds = new Set();
    const membershipIds = new Set();
    world.communityInstitutions.forEach((institution) => {
      if (!institution.id || institutionIds.has(institution.id)) add(`Duplicate or missing community institution id ${String(institution.id)}.`);
      institutionIds.add(institution.id);
      if (institution.schema !== INSTITUTION_SCHEMA) add(`${institution.id} has invalid community institution schema.`);
      if (!World.getPlace(world, institution.placeId) || World.getProperty(world, institution.placeId)) add(`${institution.id} must point to a public place.`);
      if (!Number.isInteger(institution.capacity) || institution.capacity < 1) add(`${institution.id} has invalid capacity.`);
      if (!Array.isArray(institution.members)) add(`${institution.id} members must be an array.`);
      const activePeople = new Set();
      (institution.members || []).forEach((member) => {
        if (!member.id || membershipIds.has(member.id)) add(`Duplicate or missing community membership id ${String(member.id)}.`);
        membershipIds.add(member.id);
        if (!people.has(member.personId)) add(`${institution.id} references unknown member ${String(member.personId)}.`);
        if (!MEMBERSHIP_STATUSES.includes(member.status)) add(`${member.id} has invalid membership status.`);
        if (['active', 'waiting'].includes(member.status)) {
          if (activePeople.has(member.personId)) add(`${institution.id} has duplicate live membership for ${member.personId}.`);
          activePeople.add(member.personId);
        }
        if (!Array.isArray(member.history)) add(`${member.id} history must be an array.`);
      });
      if (activeMembers(institution).length > institution.capacity) add(`${institution.id} exceeds membership capacity.`);
      if (!Array.isArray(institution.mentorIds) || institution.mentorIds.some((id) => !people.has(id))) add(`${institution.id} has invalid mentor ids.`);
      if (!Array.isArray(institution.history)) add(`${institution.id} history must be an array.`);
    });
    const opportunityIds = new Set();
    world.communityOpportunities.forEach((opportunity) => {
      if (!opportunity.id || opportunityIds.has(opportunity.id)) add(`Duplicate or missing community opportunity id ${String(opportunity.id)}.`);
      opportunityIds.add(opportunity.id);
      if (opportunity.schema !== OPPORTUNITY_SCHEMA) add(`${opportunity.id} has invalid opportunity schema.`);
      if (opportunity.institutionId && !institutionIds.has(opportunity.institutionId)) add(`${opportunity.id} references unknown institution.`);
      if (!World.getPlace(world, opportunity.placeId)) add(`${opportunity.id} references unknown place.`);
      if (!OPPORTUNITY_STATUSES.includes(opportunity.status)) add(`${opportunity.id} has invalid opportunity status.`);
      if (!Number.isInteger(opportunity.capacity) || opportunity.capacity < 1) add(`${opportunity.id} has invalid capacity.`);
      if (!Array.isArray(opportunity.participantIds) || opportunity.participantIds.some((id) => !people.has(id))) add(`${opportunity.id} has invalid participants.`);
      if (new Set(opportunity.participantIds || []).size !== (opportunity.participantIds || []).length) add(`${opportunity.id} has duplicate participants.`);
      if ((opportunity.participantIds || []).length > opportunity.capacity) add(`${opportunity.id} exceeds event capacity.`);
      if (!Array.isArray(opportunity.waitlistIds) || opportunity.waitlistIds.some((id) => !people.has(id))) add(`${opportunity.id} has invalid waitlist.`);
      if (!Number.isInteger(opportunity.eventDay) || !Number.isInteger(opportunity.startHour) || !Number.isInteger(opportunity.durationHours)) add(`${opportunity.id} has invalid schedule.`);
      if (!opportunity.authority || Object.values(opportunity.authority).some((value) => value !== false)) add(`${opportunity.id} may not invent tenancy, edit, storage, employment, or care authority.`);
      if (!Array.isArray(opportunity.history)) add(`${opportunity.id} history must be an array.`);
    });
    const connectionIds = new Set();
    world.communityConnections.forEach((connection) => {
      if (!connection.id || connectionIds.has(connection.id)) add(`Duplicate or missing community connection id ${String(connection.id)}.`);
      connectionIds.add(connection.id);
      if (connection.schema !== CONNECTION_SCHEMA) add(`${connection.id} has invalid connection schema.`);
      if (!Array.isArray(connection.personIds) || connection.personIds.length !== 2 || connection.personIds[0] === connection.personIds[1] || connection.personIds.some((id) => !people.has(id))) add(`${connection.id} has invalid people.`);
      if (!CONNECTION_KINDS.includes(connection.kind)) add(`${connection.id} has invalid connection kind.`);
      if (!Number.isFinite(connection.warmth) || connection.warmth < 0 || connection.warmth > 100) add(`${connection.id} has invalid warmth.`);
      if (!Number.isFinite(connection.trust) || connection.trust < 0 || connection.trust > 100) add(`${connection.id} has invalid trust.`);
      if (connection.kind === 'mentor' && (!connection.mentorId || !connection.learnerId || connection.mentorId === connection.learnerId)) add(`${connection.id} has invalid mentor direction.`);
      if (!Array.isArray(connection.history)) add(`${connection.id} history must be an array.`);
    });
    const adventureIds = new Set();
    const activeOwners = new Set();
    world.adventureThreads.forEach((adventure) => {
      if (!adventure.id || adventureIds.has(adventure.id)) add(`Duplicate or missing adventure id ${String(adventure.id)}.`);
      adventureIds.add(adventure.id);
      if (adventure.schema !== ADVENTURE_SCHEMA) add(`${adventure.id} has invalid adventure schema.`);
      if (!people.has(adventure.ownerId)) add(`${adventure.id} has unknown owner.`);
      if (adventure.companionId && !people.has(adventure.companionId)) add(`${adventure.id} has unknown companion.`);
      if (!ADVENTURE_STATUSES.includes(adventure.status)) add(`${adventure.id} has invalid adventure status.`);
      if (!Array.isArray(adventure.stages) || !adventure.stages.length) add(`${adventure.id} has no stages.`);
      if (!Number.isInteger(adventure.stageIndex) || adventure.stageIndex < 0 || adventure.stageIndex > (adventure.stages || []).length) add(`${adventure.id} has invalid stage index.`);
      if (adventure.noDeadline !== true) add(`${adventure.id} must preserve the no-deadline root.`);
      if (adventure.status === 'active') {
        if (activeOwners.has(adventure.ownerId)) add(`${adventure.ownerId} has more than one active adventure thread.`);
        activeOwners.add(adventure.ownerId);
      }
      if (!Array.isArray(adventure.history)) add(`${adventure.id} history must be an array.`);
    });
    if (world.settings.noDailyStreaks !== true) add('Community root requires noDailyStreaks=true.');
    if (world.settings.opportunityExpiryPenalty !== false) add('Community root requires opportunityExpiryPenalty=false.');
  }

  Object.assign(Systems, {
    requestCommunityMembership: requestMembership,
    leaveCommunityInstitution: leaveInstitution,
    participateCommunityOpportunity: participateOpportunity,
    respondToCommunityOpportunity,
    inviteCommunityConnection,
    discoverAdventure,
    continueAdventure,
    releaseAdventure,
    prepareCommunityAdventureExperiment
  });

  AXM.Community = {
    INSTITUTION_SCHEMA,
    OPPORTUNITY_SCHEMA,
    CONNECTION_SCHEMA,
    ADVENTURE_SCHEMA,
    MEMBERSHIP_STATUSES,
    OPPORTUNITY_STATUSES,
    CONNECTION_KINDS,
    ADVENTURE_STATUSES,
    INSTITUTION_BLUEPRINTS,
    OPPORTUNITY_TEMPLATES,
    ADVENTURE_TEMPLATES,
    ensureState,
    initializeWorld,
    institutionById,
    opportunityById,
    connectionById,
    adventureById,
    activeAdventureFor,
    membershipFor,
    activeMembers,
    waitingMembers,
    requestMembership,
    leaveInstitution,
    processWaitlist,
    createOpportunity,
    ensureOpportunitySupply,
    ensureConnection,
    locationForPerson,
    hourlyTick,
    participateOpportunity,
    respondToCommunityOpportunity,
    inviteCommunityConnection,
    discoverAdventure,
    continueAdventure,
    releaseAdventure,
    prepareCommunityAdventureExperiment,
    dailyTick,
    metrics,
    validate,
    interestScore
  };
}(typeof window !== 'undefined' ? window : globalThis));
