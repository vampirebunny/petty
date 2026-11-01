/** The park scene id stays set on the town map. Broadcast only while that scene is the open screen. */
export function parkIsOpen(sceneId: string, away: boolean): boolean {
  return sceneId === 'park' && !away;
}
