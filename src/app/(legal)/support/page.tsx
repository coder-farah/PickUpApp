import type { Metadata } from "next";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <>
      <h1>Support</h1>
      <p>
        Something not working, or a player or game to report? Email <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>. We
        reply within two days.
      </p>
      <h2>Common questions</h2>
      <ul>
        <li>No login code? Check the number, wait 30 seconds and tap Resend. You can request 5 codes every 15 minutes.</li>
        <li>On the waitlist? When a spot opens we hold it for you and send a notification. Tap it to take the spot before the hold runs out.</li>
        <li>Can&apos;t make it? Open the game, tap Edit RSVP, then I can&apos;t make it. Your spot goes to the next person.</li>
        <li>Deleting your account: in the app, go to You, then Delete account.</li>
      </ul>
    </>
  );
}
