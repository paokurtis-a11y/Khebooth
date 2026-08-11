# KHE Booth — Phase 2 plan

Status: **PREPARED — implementation not started**

## Goal

Phase 2 establishes the offline-first station, device and synchronization foundation required before real video capture is introduced.

The first implementation tranche must prove that two distinct tablets can join the same event as separate Capture and Sharing stations, keep operating through network loss, and synchronize safely without duplicating or deleting unsynchronized media.

## Non-negotiable rules

- Unsynchronized media must never be deleted automatically.
- Every resource and station session remains isolated by `organizationId`.
- Upload operations must be idempotent.
- Interrupted uploads must be resumable.
- Local state must survive app/process/device restarts.
- Required MVP aspect ratios remain 9:16 and 1:1.
- Target final video contract remains MP4 with H.264 video and AAC audio.
- Capture and Sharing Station must support two distinct tablets for the same event.
- Phase 2 foundation must not depend on permanent connectivity.

## Phase 2A — Shared station and sync contracts

Introduce typed contracts before implementation details:

- station modes: `CAPTURE` and `SHARING`;
- device/station registration;
- event station session;
- local media asset lifecycle;
- upload/synchronization state;
- idempotency key conventions;
- media integrity metadata such as content hash, byte size and local identifier;
- synchronization checkpoint and retry state.

Candidate server concepts:

- `Device`
- `StationSession`
- `MediaAsset`
- `UploadSession`

The exact Prisma changes must be designed and reviewed in a separate migration before production application.

## Phase 2B — Activation redemption and offline manifest cache

Phase 1 generates secure short-lived activation codes. Phase 2 must add the consuming side of that flow.

Expected flow:

1. tablet selects Capture or Sharing mode;
2. operator enters the temporary event activation code;
3. API validates the code hash, expiration and revocation state;
4. activation is marked as consumed according to the final multi-station policy;
5. API returns a device/station-scoped session credential;
6. tablet downloads the versioned event manifest;
7. manifest is persisted locally and can be used when the network becomes unavailable.

The activation response must never return the stored activation hash.

## Phase 2C — Durable local offline store

The mobile application needs a persistent local data layer before camera work starts.

Recommended first implementation target: SQLite-backed local persistence for:

- active event manifest;
- station identity and mode;
- queued synchronization operations;
- local media metadata;
- upload progress/checkpoints;
- last successful server synchronization marker.

Restarting the app must not lose queued work or unsynchronized media references.

## Phase 2D — Idempotent and resumable synchronization

Define and implement the server/client protocol before real capture files are produced.

Required properties:

- client-generated stable media identifier;
- idempotency key for creation/finalization calls;
- server-side uniqueness protection against duplicate retries;
- upload initialization endpoint;
- upload status/resume endpoint;
- resumable transfer or multipart strategy compatible with object storage;
- finalization step with integrity verification;
- server acknowledgement before an asset is considered synchronized;
- explicit local retention state after acknowledgement.

Network interruption at any step must be recoverable without producing a second logical media asset.

## Phase 2E — Two-station event synchronization

For one activated event:

- a Capture tablet can own capture-oriented local state;
- a Sharing tablet can own sharing-oriented local state;
- both use the same organization and event boundaries;
- media metadata synchronized by Capture becomes discoverable by Sharing after server acknowledgement;
- neither station can access another organization's event or media.

Real-time transport is optional for the first tranche. Correct durable synchronization is more important than instant delivery.

## Phase 2F — Capture implementation gate

Do not add real camera/video recording until the following foundation is proven:

- station activation/redeeming works;
- manifest works offline after caching;
- local durable queue survives restart;
- test media records synchronize after reconnection;
- retries are idempotent;
- interrupted transfers resume;
- unsynchronized local assets are retained;
- two separate station modes can join the same event;
- organization isolation is covered by integration tests.

Only after this gate should Expo/React Native camera capture and the MP4 H.264/AAC production pipeline be implemented.

## First implementation tranche

The first Phase 2 coding tranche should contain only:

1. shared TypeScript station/sync contracts;
2. reviewed Prisma models/migration for devices, station sessions and media/upload state;
3. activation-code redemption API;
4. station-scoped authorization/session handling;
5. mobile persistent store skeleton;
6. manifest cache/download workflow;
7. synchronization queue using synthetic/test media metadata, not camera files;
8. unit and PostgreSQL integration tests.

## Acceptance tests before camera work

The Phase 2 foundation is considered ready for capture only when automated tests prove:

- two device sessions can join one event in Capture and Sharing modes;
- invalid, expired and revoked activation codes are rejected;
- cross-organization device/event access is rejected;
- the cached manifest can be reopened without network access;
- a queued synthetic media record survives an application restart;
- reconnecting drains the queue;
- replaying the same create/upload/finalize request does not duplicate the logical media asset;
- an interrupted transfer resumes from stored progress;
- local unsynchronized media is never removed by synchronization cleanup.

## CI and production safety

Every Phase 2 schema change must use a Prisma migration reviewed before production deployment.

GitHub Actions should continue to provide an isolated PostgreSQL database and must pass migration, lint, unit tests, integration/e2e tests and build before a Phase 2 commit is considered deployable.

No production secret, object-storage credential or device session secret belongs in Git.
