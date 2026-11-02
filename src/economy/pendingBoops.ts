let pending = 0;

export function noteBoopBurst(amount: number): void {
  if (amount > 0) {
    pending += amount;
  }
}

export function takeBoopBurst(): number {
  const amount = pending;
  pending = 0;
  return amount;
}
