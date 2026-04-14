/**
 * src/components/CrispChat.jsx
 *
 * Crisp chat widget integration for OfferAdvisor.
 * Loads the Crisp script once and cleans up on unmount.
 *
 * Requires VITE_CRISP_WEBSITE_ID in .env
 */

import { useEffect } from "react";

const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID;

export default function CrispChat() {
  useEffect(() => {
    if (!CRISP_WEBSITE_ID) {
      console.warn("CrispChat: VITE_CRISP_WEBSITE_ID is not set — skipping widget load");
      return;
    }

    // Initialize Crisp globals before loading the script
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    // Load Crisp script
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
}
