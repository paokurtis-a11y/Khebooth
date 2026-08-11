# KHE Booth — Phase 1 completion

Status: **COMPLETED**

## Scope validated

Phase 1 delivers the event portal and API foundation without starting video capture.

Validated capabilities:

- NestJS Prisma service against PostgreSQL.
- JWT email/password authentication with Argon2 password hashes.
- RBAC roles: OWNER, ADMIN, OPERATOR, SHARE_HOST.
- Organization isolation through `organizationId` for clients, events and presets.
- Client CRUD.
- Event CRUD.
- Preset CRUD.
- Event activation with a limited-duration code.
- Previous active activation revoked when a new code is generated.
- Activation codes stored only as Argon2 hashes.
- Versioned event manifest.
- Minimal audit log for authentication and resource mutations.
- DTO validation and global whitelist validation.
- Web portal: login, dashboard, clients, events, presets and event creation/configuration.
- Production API deployed on Vercel and connected to Neon PostgreSQL.
- Production web portal deployed on Vercel.

## Manifest contract

The Phase 1 manifest exposes:

- organization identity;
- event information;
- optional client information;
- optional preset and preset configuration;
- separate Capture and Sharing station capability;
- required MVP aspect ratios: 9:16 and 1:1;
- offline-first policy;
- preservation of unsynchronized media;
- idempotent and resumable upload requirements;
- target export contract: MP4 / H.264 / AAC.

The manifest never exposes activation codes or password data.

## Security and isolation validation

The integration suite validates two independent organizations and verifies that one organization cannot retrieve another organization's clients, presets, events or manifests.

RBAC expectations validated end-to-end:

| Role | Read | Create / Update | Delete | Activate event |
| --- | --- | --- | --- | --- |
| OWNER | yes | yes | yes | yes |
| ADMIN | yes | yes | yes | yes |
| OPERATOR | yes | yes | no | yes |
| SHARE_HOST | yes | no | no | no |

## Automated validation gate

GitHub Actions runs against an isolated PostgreSQL service and must pass:

1. dependency installation;
2. Prisma generation;
3. Prisma migrations;
4. lint;
5. unit tests;
6. PostgreSQL integration/e2e tests;
7. build.

Phase 1 was declared complete only after this full gate passed.

## Production endpoints

- Web portal: `https://khebooth.vercel.app`
- API: `https://khebooth-api.vercel.app/api`
- Health: `https://khebooth-api.vercel.app/api/health`

## Non-goals kept intact

Phase 1 does **not** implement video capture, local media processing, upload queues or sharing workflows. Those begin in Phase 2 after the offline-first data model and synchronization contracts are established.
