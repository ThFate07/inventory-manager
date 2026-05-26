const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_MS = 1500;
const MAX_FAILURES_PER_KEY = 5;
const MAX_FAILURES_PER_IP = 12;
const MAX_TRACKED_ENTRIES = 500;

const attemptStore = new Map();

function createEmptyEntry() {
  return {
    failures: [],
    blockedUntil: 0,
    lastAttemptAt: 0,
  };
}

function getAttemptKey(ipAddress, username) {
  const normalizedIpAddress = String(ipAddress || "unknown").trim() || "unknown";
  const normalizedUsername = String(username || "").trim().toLowerCase() || "*";
  return `${normalizedIpAddress}::${normalizedUsername}`;
}

function getOrCreateEntry(key) {
  const existingEntry = attemptStore.get(key);

  if (existingEntry) {
    return existingEntry;
  }

  const entry = createEmptyEntry();
  attemptStore.set(key, entry);
  return entry;
}

function pruneFailures(entry, now) {
  entry.failures = entry.failures.filter((timestamp) => now - timestamp < LOGIN_WINDOW_MS);

  if (entry.blockedUntil && entry.blockedUntil <= now) {
    entry.blockedUntil = 0;
  }
}

function pruneStore(now) {
  for (const [key, entry] of attemptStore.entries()) {
    pruneFailures(entry, now);

    if (entry.failures.length === 0 && !entry.blockedUntil && !entry.lastAttemptAt) {
      attemptStore.delete(key);
      continue;
    }

    if (
      entry.failures.length === 0 &&
      !entry.blockedUntil &&
      now - entry.lastAttemptAt > LOGIN_WINDOW_MS
    ) {
      attemptStore.delete(key);
    }
  }

  if (attemptStore.size <= MAX_TRACKED_ENTRIES) {
    return;
  }

  const sortedEntries = [...attemptStore.entries()].sort(
    (left, right) => left[1].lastAttemptAt - right[1].lastAttemptAt,
  );

  for (const [key] of sortedEntries.slice(0, attemptStore.size - MAX_TRACKED_ENTRIES)) {
    attemptStore.delete(key);
  }
}

function getRetryAfterSeconds(retryAfterMs) {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function buildLimitResult(retryAfterMs, error) {
  return {
    allowed: false,
    error,
    retryAfterMs,
    retryAfterSeconds: getRetryAfterSeconds(retryAfterMs),
  };
}

function getEntryStatus(entry, now) {
  pruneFailures(entry, now);

  if (entry.blockedUntil > now) {
    return buildLimitResult(
      entry.blockedUntil - now,
      "Too many failed login attempts. Try again later.",
    );
  }

  if (entry.lastAttemptAt && now - entry.lastAttemptAt < LOGIN_THROTTLE_MS) {
    return buildLimitResult(
      LOGIN_THROTTLE_MS - (now - entry.lastAttemptAt),
      "Please wait a moment before trying again.",
    );
  }

  return { allowed: true };
}

export function getAdminLoginIdentifier(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cloudflareIp = request.headers.get("cf-connecting-ip");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    cloudflareIp?.trim() ||
    "unknown"
  );
}

export function checkAdminLoginLimit({ ipAddress, username }) {
  const now = Date.now();
  pruneStore(now);

  const scopedEntry = getOrCreateEntry(getAttemptKey(ipAddress, username));
  const scopedStatus = getEntryStatus(scopedEntry, now);

  if (!scopedStatus.allowed) {
    return scopedStatus;
  }

  const ipEntry = getOrCreateEntry(getAttemptKey(ipAddress, "*"));
  return getEntryStatus(ipEntry, now);
}

export function recordAdminLoginFailure({ ipAddress, username }) {
  const now = Date.now();
  const keys = [
    { key: getAttemptKey(ipAddress, username), maxFailures: MAX_FAILURES_PER_KEY },
    { key: getAttemptKey(ipAddress, "*"), maxFailures: MAX_FAILURES_PER_IP },
  ];

  for (const { key, maxFailures } of keys) {
    const entry = getOrCreateEntry(key);
    pruneFailures(entry, now);
    entry.lastAttemptAt = now;
    entry.failures.push(now);

    if (entry.failures.length >= maxFailures) {
      entry.blockedUntil = now + LOGIN_LOCKOUT_MS;
    }
  }

  pruneStore(now);
}

export function clearAdminLoginFailures({ ipAddress, username }) {
  const scopedKey = getAttemptKey(ipAddress, username);
  const scopedEntry = attemptStore.get(scopedKey);

  if (scopedEntry) {
    attemptStore.delete(scopedKey);
  }

  const ipKey = getAttemptKey(ipAddress, "*");
  const ipEntry = attemptStore.get(ipKey);

  if (ipEntry) {
    ipEntry.failures = [];
    ipEntry.blockedUntil = 0;
    ipEntry.lastAttemptAt = 0;
    attemptStore.delete(ipKey);
  }
}
