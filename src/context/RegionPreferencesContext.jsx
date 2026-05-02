import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  REGION_STORAGE_KEY,
  clearRegionalSalaryDraftStorage,
  getPreset,
  readStoredRegionId,
} from "../utils/regionPresets.js";

/** @typedef {import("../utils/regionPresets.js").RegionId} RegionId */

/** @type {React.Context<null | { regionId: RegionId; preset: import("../utils/regionPresets.js").RegionPreset; regionSeq: number; requestRegionChange: (nextId: RegionId) => void }>} */
const RegionPreferencesContext = createContext(null);

export function RegionPreferencesProvider({ children }) {
  const [regionId, setRegionId] = useState(readStoredRegionId);
  const [regionSeq, setRegionSeq] = useState(0);
  /** Pending region after user picks from control — confirmed via modal. */
  const [pendingNextId, setPendingNextId] = useState(null);

  const preset = useMemo(() => getPreset(regionId), [regionId]);

  const requestRegionChange = useCallback((nextId) => {
    if (nextId !== "US" && nextId !== "UK" && nextId !== "IN") return;
    if (nextId === regionId) return;
    setPendingNextId(nextId);
  }, [regionId]);

  const cancelPendingRegionChange = useCallback(() => {
    setPendingNextId(null);
  }, []);

  const confirmPendingRegionChange = useCallback(() => {
    if (!pendingNextId) return;
    try {
      localStorage.setItem(REGION_STORAGE_KEY, pendingNextId);
    } catch {
      /* ignore */
    }
    clearRegionalSalaryDraftStorage();
    setRegionId(pendingNextId);
    setPendingNextId(null);
    setRegionSeq((s) => s + 1);
  }, [pendingNextId]);

  const value = useMemo(
    () => ({
      regionId,
      preset,
      regionSeq,
      requestRegionChange,
      pendingNextId,
      cancelPendingRegionChange,
      confirmPendingRegionChange,
    }),
    [
      regionId,
      preset,
      regionSeq,
      requestRegionChange,
      pendingNextId,
      cancelPendingRegionChange,
      confirmPendingRegionChange,
    ]
  );

  return (
    <RegionPreferencesContext.Provider value={value}>
      {children}
    </RegionPreferencesContext.Provider>
  );
}

export function useRegionPreferences() {
  const ctx = useContext(RegionPreferencesContext);
  if (!ctx) {
    throw new Error("useRegionPreferences must be used within RegionPreferencesProvider");
  }
  return ctx;
}
