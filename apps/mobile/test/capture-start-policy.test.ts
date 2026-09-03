import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartCapture, isPendingRemoteCommand } from '../src/capture/capture-start-policy';

test('une capture démarre depuis le bouton local ou une nouvelle commande SHARING explicite', () => {
  assert.equal(canStartCapture('LOCAL_BUTTON'), true);
  assert.equal(canStartCapture('REMOTE_COMMAND'), true);
});

test('une commande distante déjà acquittée ou déjà traitée ne redémarre jamais CAPTURE', () => {
  assert.equal(isPendingRemoteCommand(8, 7, 7), true);
  assert.equal(isPendingRemoteCommand(8, 8, 0), false);
  assert.equal(isPendingRemoteCommand(8, 7, 8), false);
});
