const DEFAULT_MESSAGE = "Updating OpenCode configuration...";

type ConfigUpdateListener = (state: {
  isUpdating: boolean;
  message: string;
}) => void;

let pendingCount = 0;
let currentMessage = DEFAULT_MESSAGE;
const listeners = new Set<ConfigUpdateListener>();

// Safety watchdog. The config-update overlay is a full-screen, input-blocking
// element (fixed inset-0, z-9999). It is driven by a counted semaphore, so a
// single start() that never gets a matching finish() — e.g. an upstream reload
// step that hangs — would freeze the entire app with no way to recover. This
// hard cap force-clears the counter so the UI can never be permanently locked.
// It is generous (longer than the intended reload/health-wait budget) so it only
// ever fires on a genuine leak, never during normal operation.
const MAX_CONFIG_UPDATE_MS = 45000;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function clearWatchdog() {
  if (watchdog !== null) {
    clearTimeout(watchdog);
    watchdog = null;
  }
}

function armWatchdog() {
  clearWatchdog();
  watchdog = setTimeout(() => {
    if (pendingCount > 0) {
      console.warn(
        `[configUpdate] force-clearing stuck config-update overlay after ${MAX_CONFIG_UPDATE_MS}ms ` +
          `(pendingCount=${pendingCount}); a start() was never matched by finish().`,
      );
    }
    pendingCount = 0;
    currentMessage = DEFAULT_MESSAGE;
    watchdog = null;
    notify();
  }, MAX_CONFIG_UPDATE_MS);
  // Don't keep a Node process alive purely for the watchdog (no-op in browsers).
  (watchdog as unknown as { unref?: () => void })?.unref?.();
}

function notify() {
  const snapshot = {
    isUpdating: pendingCount > 0,
    message: currentMessage,
  };
  listeners.forEach((listener) => listener(snapshot));
}

export function startConfigUpdate(message?: string) {
  pendingCount += 1;
  if (pendingCount === 1) {
    currentMessage = message || DEFAULT_MESSAGE;
    armWatchdog();
    notify();
  } else if (message) {
    currentMessage = message;
    notify();
  }
}

export function finishConfigUpdate() {
  if (pendingCount === 0) {
    return;
  }

  pendingCount -= 1;
  if (pendingCount === 0) {
    currentMessage = DEFAULT_MESSAGE;
    clearWatchdog();
    notify();
  }
}

export function updateConfigUpdateMessage(message: string) {
  if (currentMessage === message && pendingCount > 0) {
    return;
  }
  currentMessage = message;
  if (pendingCount > 0) {
    notify();
  }
}

export function subscribeConfigUpdate(listener: ConfigUpdateListener) {
  listeners.add(listener);
  listener({
    isUpdating: pendingCount > 0,
    message: currentMessage,
  });
  return () => {
    listeners.delete(listener);
  };
}

export function getConfigUpdateSnapshot() {
  return {
    isUpdating: pendingCount > 0,
    message: currentMessage,
  };
}
