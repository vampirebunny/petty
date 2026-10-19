// Account screens are not part of this flow. When they are, convert the anonymous user
// with supabase.auth.updateUser({ email }) or supabase.auth.linkIdentity so the user id stays the same.
export async function upgradeAnonymousAccount(): Promise<void> {
  throw new Error('upgradeAnonymousAccount is not implemented');
}
