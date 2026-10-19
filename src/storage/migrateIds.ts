// Remap legacy breed ids so saved pets and drafts keep working after renames.
const breedIdMap: Record<string, string> = {
  black: 'scottishFold',
  bombay: 'scottishFold',
  tabby: 'domesticShorthair',
  domesticshorthair: 'domesticShorthair',
  mainecoon: 'maineCoon',
};

export function migrateBreedId(breedId: string): string {
  return breedIdMap[breedId] ?? breedId;
}
