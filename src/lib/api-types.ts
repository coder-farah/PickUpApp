/**
 * The JSON the iPhone app reads from /api/v1. Dates are ISO strings; display strings are made on
 * the server so the app and the website always word things the same way.
 *
 * mobile/src/api/types.ts is a copy of this file. tests/mobile-copies.test.ts fails when they drift.
 */

export type Tone = "neutral" | "pitch" | "pitch-solid" | "lime" | "amber" | "signal" | "danger";
export type SpotStatus = "in" | "waitlist" | "offered" | "out";
export type SportKey = "soccer" | "basketball" | "volleyball" | "ultimate" | "other";

export type FaceView = { id: string; name: string; photo: string | null };

export type GameCardView = {
  id: string;
  code: string;
  title: string;
  sport: SportKey;
  weekly: boolean;
  startsAt: string;
  timezone: string;
  /** "2026-10-21", for grouping by day */
  dayKey: string;
  /** "Today", "Tomorrow" or "Tue, Oct 21" */
  dayLabel: string;
  /** "7:00" and "PM" */
  time: string;
  ampm: string;
  /** "Tue, Oct 21 · 7:00 PM" */
  when: string;
  /** "in 2h 5m" when it starts within 12 hours */
  soon: string | null;
  locationName: string;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  /** "1.2 mi" when searched by location */
  distance: string | null;
  capacity: number | null;
  inCount: number;
  /** "14/14" for capped games, "30" without a cap */
  going: string;
  /** "Full", "3 left", or "" without a cap */
  room: string;
  state: { key: "cancelled" | "played" | "soon" | "full" | "on" | "open" | "live"; label: string; tone: Tone };
  my: { status: SpotStatus; label: string; tone: Tone } | null;
  offerExpiresAt: string | null;
  group: { name: string; slug: string } | null;
  faces: FaceView[];
};

export type RosterView = {
  spotId: string;
  userId: string;
  name: string;
  photo: string | null;
  /** Set on guests: who brought them */
  broughtBy: string | null;
  status: SpotStatus;
  isMe: boolean;
};

export type GameDetailView = {
  game: GameCardView & {
    status: "scheduled" | "open" | "on" | "cancelled" | "completed";
    notes: string | null;
    minPlayers: number;
    claimMinutes: number;
    guestsAllowed: boolean;
    visibility: "public" | "private";
    cancelReason: string | null;
    /** "Tue, Oct 21 · 7:00 PM" or null */
    opensAt: string;
    decisionAt: string | null;
    shareUrl: string;
  };
  host: FaceView;
  playing: RosterView[];
  /** Waitlist in order. Empty for games without a cap. */
  queue: RosterView[];
  me: {
    spotId: string;
    status: SpotStatus;
    /** Place in line, only while waiting */
    position: number | null;
    offerExpiresAt: string | null;
    guests: { spotId: string; name: string; status: SpotStatus }[];
  } | null;
  canManage: boolean;
  viewerIsMember: boolean;
};

export type CrewCardView = {
  id: string;
  slug: string;
  name: string;
  sport: SportKey;
  /** "Tue 7:00 PM, Sat 10:00 AM" */
  schedule: string;
  members: number;
  distance: string | null;
  role?: "organizer" | "member";
};

export type CrewView = {
  crew: CrewCardView & {
    description: string | null;
    homeField: string | null;
    area: string | null;
    visibility: "public" | "private";
    shareUrl: string;
    /** Only for organizers of invite-only crews */
    inviteUrl: string | null;
  };
  members: (FaceView & { role: "organizer" | "member" })[];
  schedules: { id: string; label: string; active: boolean }[];
  games: GameCardView[];
  isMember: boolean;
  isOrganizer: boolean;
};

export type UserView = {
  id: string;
  name: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  photo: string | null;
  smsEnabled: boolean;
  onboarded: boolean;
  area: { label: string; lat: number; lng: number; miles: number } | null;
};

export type SessionView = { token: string; expiresAt: string; user: UserView };

export type MeView = {
  user: UserView;
  stats: { played: number; hosted: number; lateDrops: number };
  managedCrews: { id: string; name: string; slug: string }[];
  unread: number;
};

export type HomeView = {
  offers: GameCardView[];
  playing: GameCardView[];
  other: GameCardView[];
  crews: CrewCardView[];
  unread: number;
};

export type DiscoverView = {
  place: { label: string; lat: number; lng: number };
  miles: number;
  games: GameCardView[];
  crews: CrewCardView[];
};

export type InboxItemView = { id: string; title: string; body: string; url: string | null; read: boolean; ago: string };
export type InboxView = { items: InboxItemView[]; unread: number };

export type UsernameCheckView = { ok: boolean; username: string; message: string; suggestion?: string };
export type PlaceView = { label: string; lat: number; lng: number };

export type ApiErrorView = { error: string };
