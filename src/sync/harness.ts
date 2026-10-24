export type HarnessClient = {
  databasePath: string;
  ownerId: string;
  installId: string;
};

/** Two clients must not share a database, owner, or install id. Expo SQLite stays out of this module. */
export function createHarnessClient(client: HarnessClient): HarnessClient {
  return client;
}

export function assertClientsDiffer(left: HarnessClient, right: HarnessClient): void {
  if (left.installId === right.installId || left.ownerId === right.ownerId || left.databasePath === right.databasePath) {
    throw new Error('harness clients are the same device');
  }
}
