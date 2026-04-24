import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";

/**
 * Inner component — must sit under ConversationProvider.
 */
function AlexRoleplayInner({ T, contextualText }) {
  const { getToken: getClerkToken } = useAuth();
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [localError, setLocalError] = useState(null);
  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const contextSentRef = useRef(false);

  const onDisconnect = useCallback(() => {
    contextSentRef.current = false;
  }, []);

  const { startSession, endSession, status, isSpeaking, isListening, sendContextualUpdate } = useConversation({
    onConnect: () => setLocalError(null),
    onDisconnect,
    onError: (e) => setLocalError(e?.message || "Connection error"),
    micMuted: !micOn,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!camOn) {
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach((t) => t.stop());
          videoStreamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
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
    };
  }, [camOn]);

  const handleStop = useCallback(() => {
    void endSession();
  }, [endSession]);

  useEffect(() => {
    return () => {
      void endSession();
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
      }
    };
  }, [endSession]);

  const handleStart = async () => {
    setLocalError(null);
    try {
      const test = await navigator.mediaDevices.getUserMedia({ audio: true });
      test.getTracks().forEach((t) => t.stop());
      const jwt = await getClerkToken();
      if (!jwt) {
        setLocalError("You must be signed in.");
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
        return;
      }
      const { token } = j;
      if (!token) {
        setLocalError("No token returned");
        return;
      }
      const p = startSession({ conversationToken: token, connectionType: "webrtc" });
      if (p && typeof p.then === "function") await p;
    } catch (e) {
      setLocalError(e?.message || "Could not start. Allow microphone when prompted.");
    }
  };

  const isLive = status === "connected";
  const isBusy = status === "connecting";
  const labelStyle = { fontSize: "0.68rem", color: T.textMuted, marginBottom: "6px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 800, margin: "0 auto", width: "100%" }}>
      <div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, marginBottom: "0.3rem" }}>Mock interview with Alex</h2>
        <p style={{ fontSize: "0.82rem", color: T.textSecondary, margin: 0, lineHeight: 1.6 }}>
          Live voice with your ElevenLabs agent. Your camera is preview-only (not sent to the model). Use the coach below to prepare context before you start.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
          minHeight: 220,
        }}
        className="alex-roleplay-grid"
      >
        <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: `1px solid ${T.border}`, background: "linear-gradient(160deg, rgba(29,78,216,0.12), rgba(124,58,237,0.08))" }}>
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isLive ? (isSpeaking ? "#a78bfa" : isListening ? "#22c55e" : T.textHint) : T.textHint,
              }}
            />
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: T.textPrimary }}>Alex</span>
            {(isLive || isBusy) && (
              <span style={{ fontSize: "0.65rem", color: T.textMuted }}>{isBusy ? "Connecting…" : isSpeaking ? "Speaking" : isListening ? "Listening" : status}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "1.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  margin: "0 auto 0.75rem",
                  borderRadius: "20px",
                  background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "2rem",
                  fontWeight: 600,
                  boxShadow: "0 8px 24px rgba(29, 78, 216, 0.35)",
                }}
              >
                A
              </div>
              <div style={{ fontSize: "0.8rem", color: T.textSecondary, fontWeight: 500 }}>Recruiter</div>
              <div style={{ fontSize: "0.7rem", color: T.textMuted, marginTop: 4 }}>OfferAdvisor · ElevenLabs</div>
            </div>
          </div>
        </div>

        <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: `1px solid ${T.border}`, background: T.cardBg, minHeight: 200 }}>
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: camOn ? "#3b82f6" : T.textHint }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: T.textPrimary }}>You (preview)</span>
          </div>
          {camOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: 200, objectFit: "cover", background: "#0f172a" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: T.textMuted, fontSize: "0.8rem" }}>Camera off</div>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 700px) {
          .alex-roleplay-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
        <div>
          <div style={labelStyle}>Camera (local preview)</div>
          <button
            type="button"
            onClick={() => setCamOn((v) => !v)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "8px",
              border: `1px solid ${T.border}`,
              background: camOn ? "rgba(59,130,246,0.12)" : T.cardBg,
              color: T.textPrimary,
              fontSize: "0.78rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {camOn ? "Turn camera off" : "Turn camera on"}
          </button>
        </div>
        <div>
          <div style={labelStyle}>Microphone (Alex)</div>
          <button
            type="button"
            onClick={() => setMicOn((v) => !v)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "8px",
              border: `1px solid ${T.border}`,
              background: micOn ? "rgba(34,197,94,0.12)" : T.cardBg,
              color: T.textPrimary,
              fontSize: "0.78rem",
              cursor: "pointer",
              fontFamily: "inherit",
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
                padding: "0.5rem 1.1rem",
                borderRadius: "10px",
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                color: T.textPrimary,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              End session
            </button>
          ) : isBusy ? (
            <button
              type="button"
              disabled
              style={{
                padding: "0.5rem 1.1rem",
                borderRadius: "10px",
                border: "none",
                background: T.border,
                color: T.textMuted,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "not-allowed",
                fontFamily: "inherit",
              }}
            >
              Connecting…
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              style={{
                padding: "0.5rem 1.1rem",
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
        </div>
      </div>

      <div style={{ fontSize: "0.72rem", color: T.textMuted, lineHeight: 1.5 }}>
        Status: <strong style={{ color: T.textSecondary }}>{status}</strong>
        {localError && <span style={{ color: "#f87171", marginLeft: 8 }}>— {localError}</span>}
      </div>
    </div>
  );
}

/**
 * PRO-only: ElevenLabs ConvAI (WebRTC) with local camera preview.
 */
export default function AlexRoleplayTab({ T, contextualText }) {
  return (
    <ConversationProvider>
      <AlexRoleplayInner T={T} contextualText={contextualText} />
    </ConversationProvider>
  );
}
