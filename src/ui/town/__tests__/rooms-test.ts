import { homeRooms } from '../rooms';

describe('homeRooms', () => {
  it('offers the living room and bedroom to a dog', () => {
    expect(homeRooms('dog').map((room) => room.id)).toEqual(['livingroom', 'bedroom']);
  });

  it('adds the catio for a cat', () => {
    expect(homeRooms('cat').map((room) => room.id)).toEqual(['livingroom', 'bedroom', 'catio']);
  });
});
