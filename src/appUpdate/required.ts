import { appVersion, versionAllows } from '../economy/remoteDefs';

const semver = /^(\d+)\.(\d+)\.(\d+)$/;

// True only for a real major.minor.patch that this binary is older than.
// A blank or unreadable minimum stays open.
export function updateRequired(min: string | null | undefined, current = appVersion()): boolean {
  if (min == null || !semver.test(min.trim())) {
    return false;
  }
  return !versionAllows(min, current);
}
