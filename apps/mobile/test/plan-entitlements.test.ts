import assert from 'node:assert/strict';
import test from 'node:test';
import { canRemoveKheBranding, normalizeKhePlan, planIncludes } from '../src/subscription/plan-entitlements';

test('le retrait du logo KHE est disponible à partir de PRO', () => {
  assert.equal(canRemoveKheBranding('DISCOVERY'), false);
  assert.equal(canRemoveKheBranding('STARTER'), false);
  assert.equal(canRemoveKheBranding('PRO'), true);
  assert.equal(canRemoveKheBranding('BUSINESS'), true);
  assert.equal(canRemoveKheBranding('ENTERPRISE'), true);
});

test('une réponse explicite du serveur reste prioritaire et les plans sont normalisés', () => {
  assert.equal(canRemoveKheBranding('starter', { REMOVE_KHE_BRANDING: true }), true);
  assert.equal(normalizeKhePlan(' enterprise '), 'ENTERPRISE');
  assert.equal(normalizeKhePlan('inconnu'), 'DISCOVERY');
  assert.equal(planIncludes('BUSINESS', 'PRO'), true);
});
