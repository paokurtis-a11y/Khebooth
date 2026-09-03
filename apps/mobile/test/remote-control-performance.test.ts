import assert from 'node:assert/strict';
import test from 'node:test';
import type { StationControlContract } from '@khe/contracts';
import { shouldHideCaptureControls } from '../src/live/clean-live-mode';
import {
  CAPTURE_COMMAND_POLL_MS,
  CAPTURE_HEARTBEAT_MS,
  hasPendingCommand,
  preferencesFromControl,
  SHARING_STATUS_POLL_MS,
} from '../src/station/remote-control-performance';

const control: StationControlContract = {
  eventId: 'event-1',
  command: 'START',
  commandVersion: 8,
  acknowledgedVersion: 7,
  runtimeState: 'IDLE',
  selectedEffect: 'NONE',
  maxDurationSeconds: 15,
  elapsedSeconds: 0,
  captureSeenAt: new Date(),
  updatedAt: new Date(),
  preferences: { captureKind: 'VIDEO', aspectRatio: '9:16', countdownSeconds: 3, updatedAt: new Date() },
};

test('la régie distante réagit en moins d’une seconde et détecte la commande en attente', () => {
  assert.ok(CAPTURE_COMMAND_POLL_MS <= 500);
  assert.ok(SHARING_STATUS_POLL_MS <= 500);
  assert.ok(CAPTURE_HEARTBEAT_MS <= 1_000);
  assert.equal(hasPendingCommand(control), true);
});

test('les préférences voyagent avec le même instantané que la commande', () => {
  assert.equal(preferencesFromControl(control, {
    captureKind: 'PHOTO', aspectRatio: '1:1', countdownSeconds: 10, updatedAt: new Date(0),
  }).countdownSeconds, 3);
});

test('le live masque les commandes CAPTURE sauf si le flux est indisponible', () => {
  assert.equal(shouldHideCaptureControls(true, 'LOADING'), true);
  assert.equal(shouldHideCaptureControls(true, 'LIVE'), true);
  assert.equal(shouldHideCaptureControls(true, 'ERROR'), false);
  assert.equal(shouldHideCaptureControls(false, 'OFF'), false);
});
