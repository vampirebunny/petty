// Remap legacy breed ids so saved pets and drafts keep working after renames.
const breedIdMap: Record<string, string> = {
  black: 'bombay',
  tabby: 'domesticshorthair',
};

export function migrateBreedId(breedId: string): string {
  return breedIdMap[breedId] ?? breedId;
}
