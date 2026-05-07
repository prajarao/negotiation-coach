/** Free plan: max one BRIDGE snapshot → coach AI message per signed-in account (browser localStorage). */

const STORAGE_KEY = "offeradvisor_bridge_snap_coach_free_v1";

/** Signed-out users: one Signal Room–tab coach send per browser (shared with strip + “Discuss” CTA). */
const GUEST_SIGNAL_ROOM_KEY = "offeradvisor_signal_room_guest_coach_v1";

/** @returns {Record<string, true>} */
function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

/** @param {string | null | undefined} userId */
export function freeSnapshotCoachUsed(userId) {
  if (!userId) return false;
  return readMap()[userId] === true;
}

/** @param {string | null | undefined} userId */
export function markFreeSnapshotCoachUsed(userId) {
  if (!userId) return;
  try {
    const next = { ...readMap(), [userId]: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function guestSignalRoomCoachUsed() {
  try {
    return localStorage.getItem(GUEST_SIGNAL_ROOM_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGuestSignalRoomCoachUsed() {
  try {
    localStorage.setItem(GUEST_SIGNAL_ROOM_KEY, "1");
  } catch {
    /* ignore */
  }
}
