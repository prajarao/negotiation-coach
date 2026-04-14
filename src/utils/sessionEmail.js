export async function sendSessionSummaryEmail(sessionData) {
  const {
    userEmail,
    userName,
    sessionType,
    ...data
  } = sessionData;

  try {
    const response = await fetch("/api/send-session-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail,
        userName,
        sessionType,
        sessionData: data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API returned ${response.status}`);
    }

    console.log("✓ Session summary email sent");
    return true;
  } catch (error) {
    console.error("Failed to send session summary email:", error);
    return false;
  }
}