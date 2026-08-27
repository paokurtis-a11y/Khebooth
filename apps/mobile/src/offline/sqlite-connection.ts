export interface SQLiteConnection {
  execAsync(source: string): Promise<void>;
}

export interface SQLiteFreshConnectionOptions {
  useNewConnection: true;
}

export type SQLiteConnectionOpener<TDatabase extends SQLiteConnection> = (
  databaseName: string,
  options: SQLiteFreshConnectionOptions,
) => Promise<TDatabase>;

const DEAD_NATIVE_HANDLE_PATTERN =
  /NativeDatabase|prepareAsync|execAsync|NullPointerException|database.*(?:closed|unavailable)/i;

export function isDeadSQLiteNativeHandle(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return DEAD_NATIVE_HANDLE_PATTERN.test(message);
}

async function openFreshConnection<TDatabase extends SQLiteConnection>(
  openDatabase: SQLiteConnectionOpener<TDatabase>,
  databaseName: string,
  schema: string,
): Promise<TDatabase> {
  const database = await openDatabase(databaseName, { useNewConnection: true });
  await database.execAsync(schema);
  return database;
}

export async function openInitializedSQLiteDatabase<TDatabase extends SQLiteConnection>(
  openDatabase: SQLiteConnectionOpener<TDatabase>,
  databaseName: string,
  schema: string,
): Promise<TDatabase> {
  try {
    return await openFreshConnection(openDatabase, databaseName, schema);
  } catch (error) {
    if (!isDeadSQLiteNativeHandle(error)) throw error;

    // expo-sqlite can return a poisoned cached NativeDatabase after an Android
    // runtime restart. A plain reopen returns the same handle; a genuinely new
    // connection is the supported recovery path.
    return openFreshConnection(openDatabase, databaseName, schema);
  }
}
