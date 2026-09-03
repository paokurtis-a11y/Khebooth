export interface CapturedFileSnapshot {
  exists: boolean;
  byteSize: number;
  contentHash: string | null;
}

export interface VerifiedCapturedFile {
  byteSize: number;
  contentHash: string;
}

/**
 * Android exposes File.copy() as an asynchronous native operation. The
 * destination must only be inspected after that promise has completed.
 */
export async function copyAndVerifyCapturedFile(
  copy: () => Promise<unknown> | unknown,
  inspect: () => CapturedFileSnapshot,
): Promise<VerifiedCapturedFile> {
  await copy();
  const snapshot = inspect();
  if (!snapshot.exists || snapshot.byteSize <= 0 || !snapshot.contentHash) {
    throw new Error('Le média brut n’a pas pu être sécurisé localement.');
  }
  return { byteSize: snapshot.byteSize, contentHash: snapshot.contentHash };
}
