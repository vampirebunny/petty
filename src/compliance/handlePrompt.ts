const listeners = new Set<() => void>();
let strict = false;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function onHandlePrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The handle screen just after a link has no Later button. */
export function requireHandleNow(): void {
  strict = true;
  emit();
}

export function handlePromptIsStrict(): boolean {
  return strict;
}

export function finishHandlePrompt(): void {
  strict = false;
  emit();
}
