import { playdateConfig } from './config';

export function cooldownMs(cooldownMinutes = playdateConfig.cooldownMinutes): number {
  return cooldownMinutes * 60 * 1000;
}

// Remaining wait. A clock moved backward cannot report more than one full cooldown.
export function getCooldownRemaining(
  lastCompletedAt: number | null,
  now: number,
  cooldownMinutes = playdateConfig.cooldownMinutes,
): number {
  if (lastCompletedAt == null) {
    return 0;
  }
  const cooldown = cooldownMs(cooldownMinutes);
  const raw = lastCompletedAt + cooldown - now;
  if (raw <= 0) {
    return 0;
  }
  return Math.min(cooldown, raw);
}

export function formatCooldown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// A paid skip needs server-verified time. This stub does not change the cooldown.
export function skipCooldown(): void {}
