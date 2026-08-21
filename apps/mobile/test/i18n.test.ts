import assert from 'node:assert/strict';
import test from 'node:test';
import { t, type AppLanguage } from '../src/experience/i18n';

const languages: AppLanguage[] = ['fr', 'en', 'de', 'it', 'es', 'pt'];

test('every supported language translates the core CAPTURE SHARING shell', () => {
  for (const language of languages) {
    for (const key of ['menu', 'event', 'profile', 'settings', 'creativeStudio', 'languages', 'stationEvent', 'tabletMode', 'activationCode', 'activateStation', 'openCamera', 'gallery']) {
      assert.notEqual(t(language, key), key, `${language} must translate ${key}`);
    }
  }
});

test('language switching changes visible shell labels immediately', () => {
  assert.equal(t('fr', 'settings'), 'Paramètres');
  assert.equal(t('en', 'settings'), 'Settings');
  assert.equal(t('de', 'settings'), 'Einstellungen');
  assert.equal(t('es', 'settings'), 'Ajustes');
  assert.equal(t('pt', 'settings'), 'Definições');
});

test('translated strings interpolate release values and safely fall back to French', () => {
  assert.match(t('en', 'updateAvailable', { version: '0.4.0' }), /0\.4\.0/);
  assert.equal(t('de', 'nonexistent-key'), 'nonexistent-key');
  assert.equal(t('de', 'studioNotice'), t('fr', 'studioNotice'));
});
