import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";

/**
 * Avatar media:
 * - Drop `public/alex-avatar.png` — shown by default (no env needed).
 * - Override: VITE_ALEX_AVATAR_IMAGE (path or URL); VITE_ALEX_AVATAR_VIDEO overrides image (looped webm/mp4).
 */
function AlexVisualAvatar({ isSpeaking, isLive }) {
  const videoSrc = import.meta.env.VITE_ALEX_AVATAR_VIDEO || "";
  const imageSrc =
    import.meta.env.VITE_ALEX_AVATAR_IMAGE || "/alex-avatar.png";
  const [videoErr, setVideoErr] = useState(false);
  const [imageErr, setImageErr] = useState(false);

  const useVideo = Boolean(videoSrc) && !videoErr;
  const useImage = !useVideo && Boolean(imageSrc) && !imageErr;
  const pulse = Boolean(isLive && isSpeaking);

  return (
    <div
      className="alex-avatar-tile"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 200,
        margin: 0,
        borderRadius: 0,
        overflow: "hidden",
        background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
        boxShadow: pulse ? undefined : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        animation: pulse ? "oaAlexPulse 0.75s ease-in-out infinite" : undefined,
      }}
    >
      {useVideo ? (
        <video
          key={videoSrc}
          src={videoSrc}
          muted
          loop
          playsInline
          autoPlay
          onError={() => setVideoErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : useImage ? (
        <img
          src={imageSrc}
          alt="Alex, your recruiter"
          onError={() => setImageErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "2rem",
            fontWeight: 600,
          }}
        >
          A
        </div>
      )}
    </div>
  );
}

/**
 * Inner component — must sit under ConversationProvider (pass `isMuted={!micOn}` on provider).
 */
function AlexRoleplayInner({ T, contextualText, micOn, setMicOn }) {
  const { getToken: getClerkToken } = useAuth();
  const [camOn, setCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localError, setLocalError] = useState(null);
  /** Bump after voice connects or errors so camera preview restarts (avoids mic/WebRTC contention with an active video capture). */
  const [cameraSession, setCameraSession] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const contextSentRef = useRef(false);

  const onDisconnect = useCallback(() => {
    contextSentRef.current = false;
  }, []);

  const bumpCameraPreview = useCallback(() => {
    setCameraSession((s) => s + 1);
  }, []);

  const { startSession, endSession, status, isSpeaking, isListening, sendContextualUpdate, sendUserActivity, getInputVolume } = useConversation({
    onConnect: () => {
      setLocalError(null);
      bumpCameraPreview();
    },
    onDisconnect,
    onError: (e) => setLocalError(e?.message || "Connection error"),
  });

  useEffect(() => {
    if (status === "connected" && contextualText?.trim() && !contextSentRef.current) {
      sendContextualUpdate(contextualText.trim());
      contextSentRef.current = true;
    }
    if (status === "disconnected") {
      contextSentRef.current = false;
    }
  }, [status, contextualText, sendContextualUpdate]);

  /** Keeps server-side silence timers honest when returning from another tab. */
  useEffect(() => {
    if (status !== "connected") return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        try {
          sendUserActivity();
        } catch {
          /* noop */
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [status, sendUserActivity]);

  /** Input level meter while connected — confirms mic audio reaches the SDK/LiveKit. */
  useEffect(() => {
    if (status !== "connected") {
      setInputLevel(0);
      return;
    }
    let rafId = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      try {
        const v = typeof getInputVolume === "function" ? getInputVolume() : 0;
        setInputLevel(typeof v === "number" && !Number.isNaN(v) ? Math.min(1, Math.max(0, v)) : 0);
      } catch {
        setInputLevel(0);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [status, getInputVolume]);

  const releaseCameraPreview = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!camOn) {
        releaseCameraPreview();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setLocalError(null);
      } catch {
        if (!cancelled) setLocalError("Camera unavailable or permission denied. You can still use the microphone for Alex.");
      }
    })();
    return () => {
      cancelled = true;
      releaseCameraPreview();
    };
  }, [camOn, cameraSession, releaseCameraPreview]);

  const handleStop = useCallback(() => {
    void endSession();
  }, [endSession]);

  useEffect(() => {
    return () => {
      void endSession();
      releaseCameraPreview();
    };
  }, [endSession, releaseCameraPreview]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  const handleStart = async () => {
    setLocalError(null);
    try {
      const test = await navigator.mediaDevices.getUserMedia({ audio: true });
      test.getTracks().forEach((t) => t.stop());
      /* Release local camera before ElevenLabs/LiveKit grabs the mic — avoids broken uplink on some Windows/browser combos. Preview restarts in onConnect via cameraSession. */
      if (camOn) {
        releaseCameraPreview();
      }
      const jwt = await getClerkToken();
      if (!jwt) {
        setLocalError("You must be signed in.");
        bumpCameraPreview();
        return;
      }
      const r = await fetch("/api/alex-token", { headers: { Authorization: `Bearer ${jwt}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const extra = [j.hint, j.detail, j.elevenStatus ? `HTTP ${j.elevenStatus}` : null]
          .filter(Boolean)
          .join(" — ");
        setLocalError(
          [j.error || (r.status === 403 || r.status === 401 ? "Not allowed" : "Could not start session"), extra].filter(Boolean).join(" — "),
        );
        bumpCameraPreview();
        return;
      }
      const { token } = j;
      if (!token) {
        setLocalError("No token returned");
        bumpCameraPreview();
        return;
      }
      // Must match allowlisted origins in ElevenLabs (e.g. www vs apex) — we send the real page origin.
      const p = startSession({
        conversationToken: token,
        connectionType: "webrtc",
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (p && typeof p.then === "function") await p;
    } catch (e) {
      setLocalError(e?.message || "Could not start. Allow microphone when prompted.");
      bumpCameraPreview();
    }
  };

  const isLive = status === "connected";
  const isBusy = status === "connecting";
  const overlayTextColor = isFullscreen ? "rgba(255,255,255,0.92)" : T.textPrimary;
  const overlayMutedColor = isFullscreen ? "rgba(255,255,255,0.68)" : T.textMuted;
  const labelStyle = { fontSize: "0.68rem", color: T.textMuted, marginBottom: "6px" };
  const mediaHeight = isFullscreen ? "100%" : 200;
  const wrapperStyle = isFullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100dvh",
        background: "#020617",
      }
    : {
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        maxWidth: 800,
        margin: "0 auto",
        width: "100%",
      };
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: isFullscreen ? "1fr" : "1fr 1fr",
    gridTemplateRows: isFullscreen ? "1fr 1fr" : undefined,
    gap: isFullscreen ? 0 : "0.75rem",
    minHeight: isFullscreen ? 0 : 220,
    height: isFullscreen ? "100%" : undefined,
    flex: isFullscreen ? 1 : undefined,
  };
  const tileStyle = {
    position: "relative",
    borderRadius: isFullscreen ? 0 : "12px",
    overflow: "hidden",
    border: isFullscreen ? "none" : `1px solid ${T.border}`,
  };
  const controlButtonStyle = {
    padding: isFullscreen ? "0.45rem 0.75rem" : "0.4rem 0.9rem",
    borderRadius: "8px",
    border: `1px solid ${isFullscreen ? "rgba(255,255,255,0.22)" : T.border}`,
    background: isFullscreen ? "rgba(15,23,42,0.72)" : T.cardBg,
    color: isFullscreen ? "white" : T.textPrimary,
    fontSize: "0.78rem",
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: isFullscreen ? "blur(10px)" : undefined,
  };

  return (
    <div className={isFullscreen ? "alex-roleplay-fullscreen" : undefined} style={wrapperStyle}>
      {!isFullscreen && <div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, marginBottom: "0.3rem" }}>Mock interview with Alex</h2>
        <p style={{ fontSize: "0.82rem", color: T.textSecondary, margin: 0, lineHeight: 1.6 }}>
          Practice live with Alex as your recruiter. Your camera is only for your own preview. Use the text coach below to shape context before you start. If Alex keeps asking whether you are still there, use headphones or earbuds — speakers can confuse echo cancellation and mute your mic.
        </p>
      </div>}

      <div
        style={gridStyle}
        className={`alex-roleplay-grid${isFullscreen ? " alex-roleplay-grid-fullscreen" : ""}`}
      >
        <div style={{ ...tileStyle, background: "linear-gradient(160deg, rgba(29,78,216,0.12), rgba(124,58,237,0.08))" }}>
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isLive ? (isSpeaking ? "#a78bfa" : isListening ? "#22c55e" : T.textHint) : T.textHint,
              }}
            />
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: overlayTextColor }}>Alex</span>
            {(isLive || isBusy) && (
              <span style={{ fontSize: "0.65rem", color: overlayMutedColor }}>{isBusy ? "Connecting…" : isSpeaking ? "Speaking" : isListening ? "Listening" : status}</span>
            )}
          </div>
          <div style={{ width: "100%", height: mediaHeight, position: "relative" }}>
            <AlexVisualAvatar isSpeaking={isSpeaking} isLive={isLive} />
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 10,
                right: 10,
                zIndex: 1,
                pointerEvents: "none",
                fontSize: "0.68rem",
                color: "rgba(255,255,255,0.92)",
                textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                fontWeight: 600,
              }}
            >
              Recruiter · OfferAdvisor
            </div>
          </div>
        </div>

        <div style={{ ...tileStyle, background: T.cardBg, minHeight: isFullscreen ? 0 : 200 }}>
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: camOn ? "#3b82f6" : T.textHint }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: overlayTextColor }}>You (preview)</span>
          </div>
          {camOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: mediaHeight, objectFit: "cover", background: "#0f172a" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: mediaHeight, color: T.textMuted, fontSize: "0.8rem" }}>Camera off</div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes oaAlexPulse {
          0%, 100% { box-shadow: inset 0 0 0 2px rgba(167, 139, 250, 0.45); }
          50% { box-shadow: inset 0 0 0 3px rgba(167, 139, 250, 0.85), 0 0 28px rgba(124, 58, 237, 0.35); }
        }
        @media (max-width: 700px) {
          .alex-roleplay-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 701px) {
          .alex-roleplay-grid-fullscreen {
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: 1fr !important;
          }
        }
        .alex-roleplay-fullscreen .alex-avatar-tile {
          min-height: 0 !important;
        }
      `}</style>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem",
        ...(isFullscreen
          ? {
              position: "absolute",
              right: 12,
              bottom: 12,
              zIndex: 3,
              justifyContent: "flex-end",
              maxWidth: "calc(100vw - 24px)",
            }
          : {}),
      }}>
        <div>
          {!isFullscreen && <div style={labelStyle}>Camera (local preview)</div>}
          <button
            type="button"
            onClick={() => setCamOn((v) => !v)}
            style={{
              ...controlButtonStyle,
              background: camOn && !isFullscreen ? "rgba(59,130,246,0.12)" : controlButtonStyle.background,
            }}
          >
            {camOn ? "Turn camera off" : "Turn camera on"}
          </button>
        </div>
        <div>
          {!isFullscreen && <div style={labelStyle}>Microphone (Alex)</div>}
          <button
            type="button"
            onClick={() => setMicOn((v) => !v)}
            style={{
              ...controlButtonStyle,
              background: micOn && !isFullscreen ? "rgba(34,197,94,0.12)" : controlButtonStyle.background,
            }}
          >
            {micOn ? "Mute microphone" : "Unmute microphone"}
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          {isLive ? (
            <button
              type="button"
              onClick={handleStop}
              style={{
                padding: isFullscreen ? "0.45rem 0.75rem" : "0.5rem 1.1rem",
                borderRadius: "10px",
                border: `1px solid ${isFullscreen ? "rgba(255,255,255,0.22)" : T.border}`,
                background: isFullscreen ? "rgba(15,23,42,0.72)" : T.cardBg,
                color: isFullscreen ? "white" : T.textPrimary,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                backdropFilter: isFullscreen ? "blur(10px)" : undefined,
              }}
            >
              End session
            </button>
          ) : isBusy ? (
            <button
              type="button"
              disabled
              style={{
                padding: isFullscreen ? "0.45rem 0.75rem" : "0.5rem 1.1rem",
                borderRadius: "10px",
                border: "none",
                background: isFullscreen ? "rgba(15,23,42,0.72)" : T.border,
                color: isFullscreen ? "white" : T.textMuted,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "not-allowed",
                fontFamily: "inherit",
                backdropFilter: isFullscreen ? "blur(10px)" : undefined,
              }}
            >
              Connecting…
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              style={{
                padding: isFullscreen ? "0.45rem 0.75rem" : "0.5rem 1.1rem",
                borderRadius: "10px",
                border: "none",
                background: "#1d4ed8",
                color: "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Start interview
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            style={{
              padding: isFullscreen ? "0.45rem 0.75rem" : "0.5rem 1.1rem",
              borderRadius: "10px",
              border: `1px solid ${isFullscreen ? "rgba(255,255,255,0.22)" : T.border}`,
              background: isFullscreen ? "rgba(15,23,42,0.72)" : T.cardBg,
              color: isFullscreen ? "white" : T.textPrimary,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              backdropFilter: isFullscreen ? "blur(10px)" : undefined,
            }}
          >
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>

      {isLive && micOn && !isFullscreen && (
        <div style={{ marginTop: "-0.25rem" }}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Mic signal (should move when you speak)</div>
          <div
            style={{
              height: 6,
              borderRadius: 4,
              background: T.border,
              overflow: "hidden",
              maxWidth: 280,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round(inputLevel * 100)}%`,
                background: inputLevel > 0.02 ? "#22c55e" : "transparent",
                transition: "width 50ms linear",
              }}
            />
          </div>
        </div>
      )}

      <div style={{
        fontSize: "0.72rem",
        color: isFullscreen ? "rgba(255,255,255,0.72)" : T.textMuted,
        lineHeight: 1.5,
        ...(isFullscreen
          ? { position: "absolute", left: 12, bottom: 14, zIndex: 3, textShadow: "0 1px 3px rgba(0,0,0,0.55)" }
          : {}),
      }}>
        Status: <strong style={{ color: isFullscreen ? "white" : T.textSecondary }}>{status}</strong>
        {localError && <span style={{ color: "#f87171", marginLeft: 8 }}>— {localError}</span>}
      </div>
    </div>
  );
}

/**
 * PRO-only: voice mock interview with local camera preview.
 */
export default function AlexRoleplayTab({ T, contextualText }) {
  const [micOn, setMicOn] = useState(true);
  return (
    <ConversationProvider isMuted={!micOn}>
      <AlexRoleplayInner T={T} contextualText={contextualText} micOn={micOn} setMicOn={setMicOn} />
    </ConversationProvider>
  );
}
