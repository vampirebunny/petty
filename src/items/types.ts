export type Item = {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: 'free' | 'carried' | 'resting';
  holderId?: string;
};
