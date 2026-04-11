import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import OfferAdvisor from "./App.jsx";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY — add it to your .env file.\n" +
    "Get it from: https://dashboard.clerk.com → Your app → API Keys"
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignInUrl="/"
      afterSignUpUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#1d4ed8",
          colorBackground: "#0d1424",
          colorInputBackground: "#0a0f1a",
          colorInputText: "#e2e8f0",
          colorText: "#e2e8f0",
          colorTextSecondary: "#94a3b8",
          borderRadius: "10px",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        },
        elements: {
          card: {
            border: "1px solid #1e293b",
            boxShadow: "none",
          },
          headerTitle: {
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 500,
          },
          formButtonPrimary: {
            backgroundColor: "#1d4ed8",
          },
          footerActionLink: { color: "#3b82f6" },
        },
      }}
    >
      <OfferAdvisor />
    </ClerkProvider>
  </StrictMode>
);
