import type { Metadata } from "next";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="mono text-[11px] text-muted">Last updated October 18, 2026</p>
      <p>Pitchin helps you find and run pickup games. We collect only what that needs, we don&apos;t sell it, and we don&apos;t track you across other apps or websites.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your phone number, if you sign in with it. We use it to send your login code and, if you allow it, texts about your games.</li>
        <li>Your Apple ID&apos;s private identifier and the email Apple shares, if you sign in with Apple.</li>
        <li>Your name, and optionally a username and a profile photo. Other players see these on rosters.</li>
        <li>The games and crews you join or host, and your RSVPs.</li>
        <li>The area you search from in Explore, if you save one. The app asks for your location only when you tap &quot;Use my location&quot;, and only to search near you.</li>
        <li>A push token for your phone, if you turn on notifications.</li>
      </ul>
      <h2>What we don&apos;t collect</h2>
      <p>We don&apos;t read your contacts, track your location in the background, show ads, or use analytics or advertising trackers.</p>
      <h2>Who else sees it</h2>
      <p>
        Players in a game see the names and photos of others on its roster. We use Twilio to send login codes and texts, Expo and Apple to deliver push
        notifications, and our hosting provider to run the service. They handle data only to provide those services.
      </p>
      <h2>Deleting your account</h2>
      <p>
        In the app, go to You, then Delete account. We remove your phone number, Apple ID link, email, name, username, photo, push tokens and notifications,
        take you off upcoming games, and revoke Sign in with Apple. Past games keep an anonymous &quot;Former player&quot; spot so their history still adds up.
      </p>
      <h2>Contact</h2>
      <p>
        Questions or requests: <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>
      </p>
    </>
  );
}
