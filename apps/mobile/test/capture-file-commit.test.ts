import assert from 'node:assert/strict';
import test from 'node:test';
import { copyAndVerifyCapturedFile } from '../src/capture/capture-file-commit';

test('CAPTURE waits for the Android file copy before inspecting and persisting the raw media', async () => {
  let copied = false;
  let inspectedBeforeCopy = false;

  const result = await copyAndVerifyCapturedFile(
    async () => {
      await Promise.resolve();
      copied = true;
    },
    () => {
      if (!copied) inspectedBeforeCopy = true;
      return { exists: copied, byteSize: copied ? 12_345 : 0, contentHash: copied ? 'raw-md5' : null };
    },
  );

  assert.equal(inspectedBeforeCopy, false);
  assert.deepEqual(result, { byteSize: 12_345, contentHash: 'raw-md5' });
});

test('CAPTURE refuses a copied file that is empty or unverifiable', async () => {
  await assert.rejects(
    () => copyAndVerifyCapturedFile(async () => undefined, () => ({ exists: true, byteSize: 0, contentHash: null })),
    /sécurisé localement/,
  );
});
