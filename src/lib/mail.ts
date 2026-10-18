import "server-only";

// Sends one plain-text email through Brevo's HTTP API. Nothing is sent, and nothing is pretended, until the
// two settings exist (BREVO_API_KEY and MAIL_FROM, a sender verified with Brevo). Both live in .env.local and Vercel only.
export function mailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean; reason?: string }> {
  if (!mailConfigured()) return { sent: false, reason: "email is not set up" };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY as string, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: process.env.MAIL_FROM, name: "CommitteeKeeper" }, to: [{ email: to }], subject, textContent: text }),
    });
    return response.ok ? { sent: true } : { sent: false, reason: `the email service answered ${response.status}` };
  } catch {
    return { sent: false, reason: "the email service could not be reached" };
  }
}
