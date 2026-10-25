const handlePattern = /^[a-zA-Z0-9]{3,20}$/;

export function buildFriendLink(handle: string): string {
  return `https://boopboop.mylisto.app/add/${handle}`;
}

/** The handle from a Boop Boop add link, or null when the URL is not one. */
export function parseFriendLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'boopboop.mylisto.app') {
    return null;
  }
  const parts = parsed.pathname.split('/').filter((part) => part.length > 0);
  if (parts.length !== 2 || parts[0] !== 'add') {
    return null;
  }
  let handle = parts[1];
  try {
    handle = decodeURIComponent(handle);
  } catch {
    return null;
  }
  if (!handlePattern.test(handle)) {
    return null;
  }
  return handle;
}
