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

/** People a host can make a co-host: this game's list, its crew, and recent teammates. */
export type CohostCandidatesView = { people: FaceView[] };

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
  /** Only sent to organizers, for someone else's held spot */
  offerExpiresAt: string | null;
};

export type GameDetailView = {
  game: GameCardView & {
    status: "scheduled" | "open" | "on" | "cancelled" | "completed";
    notes: string | null;
    /** Minutes from kickoff to the end */
    durationMinutes: number;
    minPlayers: number;
    claimMinutes: number;
    guestsAllowed: boolean;
    visibility: "public" | "private";
    cancelReason: string | null;
    /** Where the game stands for the action panel */
    phase: "cancelled" | "played" | "live" | "soon" | "open";
    /** "Tue, Oct 21 · 7:00 PM – 8:30 PM" */
    timeRange: string;
    /** "Thu 7:00 PM" and "in 2 days", while RSVPs haven't opened */
    opensAt: string;
    opensIn: string;
    /** "Oct 21 · 4:00 PM": called off then if short */
    decisionAt: string | null;
    /** "Oct 21 · 4:00 PM": from then on, the first to tap gets an open spot */
    lastCall: string;
    lastCallPassed: boolean;
    /** Open spots counting held offers; null without a cap */
    spotsLeft: number | null;
    shareUrl: string;
    /** The message to paste in a group chat */
    shareText: string;
    mapsUrl: string;
  };
  host: FaceView;
  /** People who run the game with the host */
  cohosts: FaceView[];
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
  /** Host, co-host or crew organizer: can edit, manage the list and call it off */
  canManage: boolean;
  /** Host or crew organizer: can also hand the game to someone else */
  canHandOff: boolean;
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
  /** "Mission" or "San Francisco" */
  area: string | null;
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

/** The one game the Home hero shows: a spot held for you beats a game you're in, which beats a waitlist. */
export type NextUpView = GameCardView & {
  /** "Tonight", "Today", "Tomorrow" or "Tue, Oct 21" */
  whenLabel: string;
  /** "A spot opened and it's held for you", "You're #2 on the waitlist", "3 left · 2 on waitlist"… */
  note: string;
  position: number | null;
};

export type HomeView = {
  /** "Good evening, Pooya" */
  greeting: string;
  next: NextUpView | null;
  alsoPlaying: GameCardView[];
  openNear: GameCardView[];
  fromCrews: GameCardView[];
  area: { label: string; short: string; miles: number };
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
