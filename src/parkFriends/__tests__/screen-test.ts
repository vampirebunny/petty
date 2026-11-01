import { parkIsOpen } from '../screen';

describe('park presence screen', () => {
  it('broadcasts only while the park scene is the open screen', () => {
    expect(parkIsOpen('park', false)).toBe(true);
    expect(parkIsOpen('park', true)).toBe(false);
    expect(parkIsOpen('livingroom', false)).toBe(false);
  });
});
