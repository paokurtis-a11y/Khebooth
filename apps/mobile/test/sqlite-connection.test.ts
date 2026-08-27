import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  isDeadSQLiteNativeHandle,
  openInitializedSQLiteDatabase,
  type SQLiteConnection,
  type SQLiteFreshConnectionOptions,
} from '../src/offline/sqlite-connection';

class FakeDatabase implements SQLiteConnection {
  execCalls = 0;

  constructor(private readonly failure?: Error) {}

  async execAsync(): Promise<void> {
    this.execCalls += 1;
    if (this.failure) throw this.failure;
  }
}

test('SQLite initialization always bypasses the cached Android native handle', async () => {
  const database = new FakeDatabase();
  const options: SQLiteFreshConnectionOptions[] = [];

  const opened = await openInitializedSQLiteDatabase(
    async (_name, nextOptions) => {
      options.push(nextOptions);
      return database;
    },
    'khe-booth.db',
    'CREATE TABLE test(id TEXT);',
  );

  assert.equal(opened, database);
  assert.deepEqual(options, [{ useNewConnection: true }]);
  assert.equal(database.execCalls, 1);
});

test('a poisoned Android NativeDatabase is replaced with one fresh connection', async () => {
  const poisoned = new FakeDatabase(
    new Error("Call to function 'NativeDatabase.execAsync' has been rejected. Caused by: java.lang.NullPointerException"),
  );
  const recovered = new FakeDatabase();
  const databases = [poisoned, recovered];
  const options: SQLiteFreshConnectionOptions[] = [];

  const opened = await openInitializedSQLiteDatabase(
    async (_name, nextOptions) => {
      options.push(nextOptions);
      const database = databases.shift();
      if (!database) throw new Error('unexpected third open');
      return database;
    },
    'khe-booth.db',
    'CREATE TABLE test(id TEXT);',
  );

  assert.equal(opened, recovered);
  assert.deepEqual(options, [{ useNewConnection: true }, { useNewConnection: true }]);
  assert.equal(poisoned.execCalls, 1);
  assert.equal(recovered.execCalls, 1);
});

test('schema errors are not hidden by the native-handle recovery', async () => {
  let opens = 0;
  const schemaError = new Error('SQLITE_ERROR: near BROKEN: syntax error');

  await assert.rejects(
    () => openInitializedSQLiteDatabase(
      async () => {
        opens += 1;
        return new FakeDatabase(schemaError);
      },
      'khe-booth.db',
      'BROKEN SQL',
    ),
    schemaError,
  );

  assert.equal(opens, 1);
  assert.equal(isDeadSQLiteNativeHandle(schemaError), false);
});

test('CAPTURE and SHARING reuse one root SQLite store', async () => {
  const [mainSource, sharingSource] = await Promise.all([
    readFile(resolve(process.cwd(), 'src/main.tsx'), 'utf8'),
    readFile(resolve(process.cwd(), 'src/sharing/sharing-station-panel.tsx'), 'utf8'),
  ]);

  assert.match(mainSource, /<SharingStationPanel[^>]+store=\{store\}/);
  assert.doesNotMatch(sharingSource, /new SQLiteLocalStore/);
  assert.match(sharingSource, /store:LocalStore/);
});
