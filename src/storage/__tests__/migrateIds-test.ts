import { migrateBreedId } from '../migrateIds';

it('maps every legacy cat id to the current one and leaves current ids alone', () => {
  expect(migrateBreedId('tabby')).toBe('domesticShorthair');
  expect(migrateBreedId('domesticshorthair')).toBe('domesticShorthair');
  expect(migrateBreedId('mainecoon')).toBe('maineCoon');
  expect(migrateBreedId('bombay')).toBe('scottishFold');
  expect(migrateBreedId('black')).toBe('scottishFold');
  for (const id of ['domesticShorthair', 'siamese', 'persian', 'maineCoon', 'scottishFold', 'husky']) {
    expect(migrateBreedId(id)).toBe(id);
  }
});
