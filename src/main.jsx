import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import OfferAdvisor from "./App.jsx";
import { RegionPreferencesProvider } from "./context/RegionPreferencesContext.jsx";
import { offeradvisorClerkAppearance } from "./clerkAppearance.js";

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
      afterSignInUrl="/app"
      afterSignUpUrl="/app"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      appearance={offeradvisorClerkAppearance()}
    >
      <RegionPreferencesProvider>
        <OfferAdvisor />
      </RegionPreferencesProvider>
    </ClerkProvider>
  </StrictMode>
);
