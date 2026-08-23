# Autonomy and Authority Model — v0.5.0

## Core rule

The player directly controls one character. Every other person is an autonomous resident whose state may be influenced through relationships, agreements, care, resources, shared environments, and lawful requests.

Autonomy does not mean randomness. It means the actor retains a separate decision path and attributable history.

## Authority planes

v0.5 distinguishes three major planes that must not be collapsed.

### 1. Adult household agreement authority

Applies to adult-to-adult arrangements such as:

- commitment and cohabitation;
- expense shares and shared reserve;
- common/private room arrangements;
- relocation proposals;
- household conflict, repair, and exit.

It does not create parenthood, property ownership, construction authority, object ownership, employment control, or legal status.

### 2. Family-care authority

Applies to dependent and family-continuity decisions such as:

- welcoming a dependent;
- care activities and schedules;
- education or community-support proposals;
- private-room arrangements;
- whole-family relocation;
- transition into autonomous adulthood.

A care role is responsibility and influence, not ownership of the dependent. The dependent retains identity, preferences, refusal evidence, relationships, belongings, and a future independent life.

### 3. Property and construction authority

Applies to:

- ownership and tenancy;
- room access and edit permissions;
- fixtures versus personal objects;
- construction requests;
- funding and material provenance;
- labor and structural validation.

Family or household membership does not automatically create ownership or remote decorating control.

## Additional independent authorities

The engine also tracks:

- **self-action authority:** who may directly perform an action;
- **object authority:** who owns, may move, store, upgrade, or transfer an object;
- **resource authority:** who may spend personal, shared, escrow, or property funds;
- **institution policy:** future bounded capacity/eligibility decisions;
- **simulation validity:** the deterministic engine may reject any result that violates structural, identity, or no-loss invariants.

## Authority matrix

| Action | Player self | Adult partner | Dependent | Property owner | Deterministic engine |
|---|---:|---:|---:|---:|---:|
| Move player character directly | yes | no | no | no | validates |
| Accept adult partnership | proposes/answers | proposes/answers | not applicable | no | records only |
| Accept care activity | may offer | may offer | accepts/refuses where supported | no | resolves evidence |
| Assign adult job to dependent | no | no | no | no | blocks |
| Spend player money | yes | only exact accepted scope | no | no | validates funds |
| Spend property reserve | only with actual authority | only exact accepted scope | no | policy/owner scope | validates provenance |
| Move dependent with family | participates in proposal | participates in proposal | continuity/agency evidence | no | validates whole group |
| Edit common room | bounded agreement/permission | bounded agreement/permission | age-appropriate only if explicit | owner/tenant contract may matter | validates room/object state |
| Edit occupied remote rental | no direct control | no | no | may answer exact request | blocks remote puppeteering |
| Transfer someone else’s object | no | no | no | no | blocks |
| End adult agreement | yes, unilateral | autonomous path | not applicable | no | preserves continuity |

## Proposal rule

A proposal is evidence of intent, not consent. An accepted proposal is evidence of a bounded decision, not automatic execution.

For high-impact changes, the path remains:

```text
intent → exact proposal → required responses → resources → lawful action → validation → history
```

## Refusal rule

Refusal must be a real state:

- no hidden relationship punishment flag;
- no silent fallback that performs the same action;
- no fabricated consent;
- no deletion of the proposal history;
- no permanent lockout unless a visible rule justifies it.

## Dependent agency

The dependent is autonomous but age-appropriate. v0.5 supports preference and refusal evidence without pretending that every legal or developmental decision belongs solely to a child.

This is a simulation boundary, not a claim about real custody, medicine, schooling, or safeguarding law.

## Engine authority

The deterministic engine is authoritative only over simulation validity. It may reject an impossible or corrupt transition. It does not own the people in the world and should not invent consent, moral legitimacy, or real-world legal authority.

## Model/AI boundary

A future local model may propose dialogue, décor, activities, or candidate intentions. It may not directly mutate authoritative state. Every proposal must pass the same actor, consent, resource, property, and invariant gates as deterministic actions.
