export type DocItem = {
  title: string;
  detail: string;
  note?: string;
};

export type DocSection = {
  id: string;
  title: string;
  items: DocItem[];
};

export type AppDoc = {
  id: "customer" | "driver";
  label: string;
  summary: string;
  screens: string[];
  sections: DocSection[];
  limits: DocItem[];
  gaps: DocItem[];
};

export const appDocs: AppDoc[] = [
  {
    id: "customer",
    label: "Customer app",
    summary:
      "Expo rider app: book, Along seats, schedule, match, live trip, wallet, safety, and support. Works with the Nest API and ride socket when configured; otherwise runs a local demo.",
    screens: [
      "Splash / gate",
      "Onboarding (4 slides)",
      "Welcome, Login, Signup, OTP, Forgot, Reset",
      "Home (map + shortcuts)",
      "Search places",
      "Book (classes, fare, stops, promo, pay)",
      "Confirm",
      "Schedule",
      "Matching",
      "Live trip",
      "Summary / rating",
      "Trips history",
      "Wallet + Fund",
      "Account",
      "Safety",
      "Notifications",
      "Support chat",
    ],
    sections: [
      {
        id: "boot",
        title: "Boot & shell",
        items: [
          { title: "Hydration gate", detail: "Waits for Zustand + SecureStore token, then routes to onboarding, welcome, or home." },
          { title: "Tabs", detail: "Home · Trips · Wallet · Support." },
          { title: "Theme", detail: "Light / dark mode, persisted; toggle on onboarding and account." },
          { title: "Push shell", detail: "Local Expo notifications; optional OneSignal (role=customer); optional PostHog." },
          { title: "Offline demo", detail: "Without API URL, seeds dummy trips, wallet, home/work, and a scheduled ride." },
        ],
      },
      {
        id: "auth",
        title: "Auth",
        items: [
          { title: "Welcome", detail: "Create account, sign in, or continue as local preview when no API." },
          { title: "Login / signup", detail: "Nigerian mobile (+234, 10 digits starting 7–9), name, email, password, optional referral." },
          { title: "OTP", detail: "6-digit code; resend after 30s for signup or password reset." },
          { title: "Forgot / reset", detail: "Request OTP then set a new password (API: ≥8 characters)." },
          { title: "Session", detail: "SecureStore access + refresh tokens; refresh on tab mount; failed refresh signs out." },
        ],
      },
      {
        id: "onboarding",
        title: "Onboarding",
        items: [
          { title: "Slides", detail: "City journey, ride choice + fare, live tracking, safety (share / verified / emergency / support)." },
          { title: "Replay", detail: "Account can replay onboarding without wiping the session." },
        ],
      },
      {
        id: "home",
        title: "Home",
        items: [
          { title: "City map", detail: "Full-bleed map (default Abuja) with nearby sample cars when demo." },
          { title: "Location", detail: "Foreground location sets coords; can auto-fill pickup as Current location." },
          { title: "Shortcuts", detail: "Schedule (badge), notifications (unread), account." },
          { title: "Active cards", detail: "Next scheduled ride and active trip deep-link into schedule / matching / trip." },
          { title: "Where to?", detail: "Opens search for dropoff and clears booking filters." },
          { title: "Home / Work / Recent", detail: "Quick places; missing ones open search to save." },
          { title: "Visited destinations", detail: "Up to 5 completed dropoffs / recent / desk places as quick picks." },
          { title: "Promos & safety", detail: "Expandable teaser (e.g. RYDE10) and link to Safety." },
        ],
      },
      {
        id: "places",
        title: "Places & search",
        items: [
          { title: "Targets", detail: "Pickup, dropoff, stop, home, or work." },
          { title: "Autocomplete", detail: "Google Places when key is set (Nigeria bias); else recent + map pin + desk fallbacks." },
          { title: "Map pin", detail: "Drag pin and use that coordinate; pickup can use current position." },
          { title: "Recent", detail: "Up to 5 shown; store keeps up to 8 recent places." },
        ],
      },
      {
        id: "booking",
        title: "Booking & fare",
        items: [
          { title: "Route edit", detail: "Change pickup/dropoff, swap ends, add/reorder/remove stops (max 2)." },
          { title: "Traffic ETA", detail: "Route estimate via backend /routes/estimate → Google Routes → haversine fallback; refresh ~75s; heavy traffic if delay ≥30% and ≥5 min." },
          { title: "Classes", detail: "Ryde, Along, Comfort, XL, Executive, Green, Keke — multipliers from GET /pricing." },
          { title: "Quote", detail: "Fare = B + (D×Rd) + (T×Rt) + E; banded or flat km; ₦100 steps." },
          { title: "Your offer", detail: "Adjust within −20% / +40% of quote; optional breakdown." },
          { title: "Payment", detail: "Cash, wallet, or card on book; confirm warns on card and underfunded wallet." },
          { title: "Promos", detail: "RYDE (−₦500) and RYDE10 (10%, cap ₦2000) with minimum fare rules." },
          { title: "Confirm", detail: "Shows distance, traffic ETA, pay, cancel fee copy; then schedule, Along join, or matching." },
        ],
      },
      {
        id: "along",
        title: "Along (shared seats)",
        items: [
          { title: "Seat fare", detail: "Distance share of corridor quote; more riders lowers each share." },
          { title: "Cabin", detail: "3 passenger seats (Front, Rear L, Rear R); cabin picker UI." },
          { title: "Match radius", detail: "Pools within ~4 km of pickup; dropoff same area or within ~6 km of pool end." },
          { title: "Join or new", detail: "Join an open pool (skip matching) or request a new Along car." },
        ],
      },
      {
        id: "schedule",
        title: "Schedule",
        items: [
          { title: "Book later", detail: "Today or tomorrow only; 30-minute slots; must be > now + 15 minutes." },
          { title: "Reminders", detail: "Local notification ~30 minutes before pickup." },
          { title: "Manage", detail: "Change time or cancel scheduled rides; list other booked pickups." },
          { title: "Dispatch", detail: "Scheduled rides are not sent to drivers until embark time / driver embark flow." },
        ],
      },
      {
        id: "matching",
        title: "Matching",
        items: [
          { title: "Search", detail: "Standard radius 4 km; map + searching UI; live ride:request when ride URL set." },
          { title: "No nearby", detail: "If none within 4 km after ~10s → “No ride available” + Extend search." },
          { title: "Extend search", detail: "Widens to 25 km; far drivers accept with their own pickup price." },
          { title: "Offers", detail: "Nearby or extended drivers; distance + traffic ETA; Nearest / driver-set price badges." },
          { title: "Fare top-up", detail: "If drivers are visible but slow to accept (~14s), offer +20% of original quote for a quicker response." },
          { title: "Cancel", detail: "Cancel booking returns home and publishes ride:cancel." },
        ],
      },
      {
        id: "trip",
        title: "Live trip",
        items: [
          { title: "Stages", detail: "Assigned → to pickup / arrived / on trip → completed or cancelled." },
          { title: "Live map", detail: "Driver marker from socket location or sample lerp; ETA to pickup or dropoff." },
          { title: "Fare talk", detail: "Rider accepts a driver-set fare when asked (no counter). Extended search starts in waiting." },
          { title: "Pickup PIN", detail: "4-digit code on arrive; stored on device; not put in push or share text." },
          { title: "Chat", detail: "Templates, text, voice notes (max 45s); socket + optional REST chat." },
          { title: "Call / share", detail: "tel: if driver phone present; share trip text without PIN." },
          { title: "Safety", detail: "Shortcut to Safety screen from trip header." },
          { title: "Cancel", detail: "Allowed before on_trip; cancellation fee messaging (₦300 after assign)." },
        ],
      },
      {
        id: "history",
        title: "Summary & trips",
        items: [
          { title: "Summary", detail: "Route, fare, class, pay, driver; 1–5 stars + review required when completed." },
          { title: "Trips tab", detail: "Active ride, history → summary, Book this destination, scheduled section." },
        ],
      },
      {
        id: "wallet",
        title: "Wallet",
        items: [
          { title: "Balance", detail: "Available + pending; credits/spent; 7-day spend chart; ledger lines." },
          { title: "Fund", detail: "Top-up min ₦100 via Paystack/API when configured." },
        ],
      },
      {
        id: "safety-account",
        title: "Safety, account, notices, support",
        items: [
          { title: "Safety", detail: "Share explanation, emergency call +2347007293743, message support, care@rapydryd.com." },
          { title: "Account", detail: "Photo, name, email; home/work/saved places; theme; replay onboarding; sign out; delete account." },
          { title: "Notifications", detail: "In-app notice feed (cap 40); open marks all read." },
          { title: "Support", detail: "Desk chat with templates (wrong charge, driver not arrived, trip needs look)." },
        ],
      },
    ],
    limits: [
      { title: "Max stops", detail: "2" },
      { title: "Schedule ahead", detail: "72 hours · min lead 15 minutes · hourly slots" },
      { title: "Fare step / band", detail: "₦100 · −20% / +40% of quote" },
      { title: "Matching", detail: "≤3 offers · 45s timeout" },
      { title: "Along", detail: "3 seats · ~4 km match radius" },
      { title: "Voice notes", detail: "45 seconds max" },
      { title: "Fund minimum", detail: "₦100" },
      { title: "Cancellation fee (copy)", detail: "₦300 after driver assigned" },
    ],
    gaps: [
      { title: "Card at confirm", detail: "Warned in UI; cash/wallet preferred — card collection not fully wired on confirm." },
      { title: "Add saved place UI", detail: "Store supports up to 12 saved places; account only removes, no dedicated add UI." },
      { title: "SEARCH_RADIUS_KM", detail: "Defined in fare lib but unused on current screens." },
      { title: "Mid-trip add stop", detail: "Stops are booking-time only today; live stop + waiting charges are the next ops build." },
    ],
  },
  {
    id: "driver",
    label: "Driver app",
    summary:
      "Expo driver app: KYC setup, go online, dispatch range, destination filter, offers, trip lifecycle, schedule embark, earnings, wallet, cabin camera metadata, and support. Live when ride/API URLs are set; otherwise demo socket.",
    screens: [
      "Splash / gate",
      "Marketing onboarding",
      "Welcome, Phone, OTP, Password, Login, Forgot, Reset",
      "KYC: Personal, Identity, Licence, Vehicle, Inspection, Bank, Emergency, Review, Verification",
      "Home (map + go online)",
      "Range",
      "Destination filter",
      "Request / offer overlay",
      "Live trip",
      "Schedule + Embark",
      "Earnings",
      "Pay model",
      "Wallet + Withdraw",
      "Trips + History",
      "Inbox + Notifications",
      "Recordings",
      "Account",
      "Book a ride (preview)",
    ],
    sections: [
      {
        id: "boot",
        title: "Boot & shell",
        items: [
          { title: "Hydration gate", detail: "Onboarding → welcome → first incomplete KYC step → home when approved." },
          { title: "Tabs", detail: "Home · Earnings · Trips · Inbox." },
          { title: "Persist", detail: "KYC draft, range/destination, trips, balance, notices, support, payouts, scheduled — not live offer/trip/coords." },
          { title: "OTA", detail: "EAS update check with Restart / Later modal." },
          { title: "Theme", detail: "Light/dark with themeChosen gate." },
        ],
      },
      {
        id: "auth",
        title: "Auth",
        items: [
          { title: "Register", detail: "Phone (NG or international) → OTP (45s resend) → password (≥8 + digit)." },
          { title: "Login", detail: "Phone + password; offline preview can enter with weaker validation." },
          { title: "Forgot / reset", detail: "OTP purpose reset then new password." },
          { title: "Secrets", detail: "NIN/BVN/password stay masked or in SecureStore — not raw in Zustand." },
        ],
      },
      {
        id: "kyc",
        title: "Setup / KYC (8 steps)",
        items: [
          { title: "Personal", detail: "Name, DOB (18–80), gender, email, address (Places), state/city/LGA, photo." },
          { title: "Identity", detail: "11-digit NIN + consent; optional slip; API /kyc/nin; masked store." },
          { title: "Licence", detail: "Number, expiry, front+back photos." },
          { title: "Vehicle", detail: "Make/model/year/colour/plate/category, photos, insurance expiry, optional VIN/roadworthiness." },
          { title: "Inspection", detail: "Book a bay (demo Wuse 2 / Garki); status must progress to continue." },
          { title: "Bank", detail: "Holder, bank list, 10-digit account, name-check; optional BVN never stored." },
          { title: "Emergency", detail: "Name, relationship, reachable phone." },
          { title: "Review / verification", detail: "Submit → under_review; statuses through approve/reject/suspend; gate canReceiveRides." },
        ],
      },
      {
        id: "online",
        title: "Go online & map",
        items: [
          { title: "Requirements", detail: "Approved KYC (when API), location permission, GPS on, network when live, socket connected." },
          { title: "Presence", detail: "Location watch 25 m; background 15 s / 40 m; pulse every 8 s; REST location when online." },
          { title: "Map", detail: "Google Maps on Android, Apple Maps on iOS; demand dots when online; trip pins." },
          { title: "Issues", detail: "Denied / GPS / network / socket / session force offline with recovery copy." },
          { title: "Today strip", detail: "Earnings + completed-today on home." },
        ],
      },
      {
        id: "range",
        title: "Trip range",
        items: [
          { title: "Max pickup", detail: "3, 5, 8, 10, 15, 20, 30 km (default 10)." },
          { title: "Widen if quiet", detail: "After 3 hours with no in-range offer while online, +5 km steps up to 50 km; resets when an offer fits." },
          { title: "Sync", detail: "Preferences via /drivers/me/preferences; desk can push range changes." },
        ],
      },
      {
        id: "destination",
        title: "Destination filter",
        items: [
          { title: "Toggle + place", detail: "Filter offers toward a chosen destination; clear anytime." },
          { title: "Near radius", detail: "5–20 km chips (default 8); drop within radius counts as fit." },
          { title: "Along heading", detail: "Also fits if heading toward dest (≤90°) and not going farther than pickup (+1.5 km)." },
          { title: "Recent", detail: "Last 5 unique completed dropoffs as quick picks." },
        ],
      },
      {
        id: "offers",
        title: "Offers & fare talk",
        items: [
          { title: "Ingress", detail: "ride:offer (live) or demo offers (~2.5s then every 20s); board cap 7 after filters." },
          { title: "Overlay", detail: "Global RideRequestOverlay: chime + haptics; Accept / Reject." },
          { title: "Request screen", detail: "Countdown 15s (180s sample); fare adjust; Accept → trip; Decline / expire." },
          { title: "Fare bounds", detail: "Quote −20% … +40%, snap ₦100; waiting/counter blocks arrive until agreed." },
        ],
      },
      {
        id: "trip",
        title: "Trip lifecycle",
        items: [
          { title: "Stages", detail: "to_pickup → arrived → on_trip → completed | cancelled." },
          { title: "Actions", detail: "I've arrived, Start trip, Slide to complete; cancel with confirm (not mid on_trip)." },
          { title: "Navigate / call", detail: "Open Apple/Google Maps; call stub until passenger phone is wired." },
          { title: "Chat", detail: "Templates, text, voice notes (45s); socket + REST chat." },
          { title: "Nearby", detail: "Within 0.3 km of pickup publishes ride:nearby once." },
          { title: "ETA", detail: "Offer pickup/trip km·min; remaining decays in sample; traffic routing helper exists for live refresh." },
          { title: "Receipt", detail: "Earnings, rate 1–5 required, credit balance (skip sample ride)." },
        ],
      },
      {
        id: "along",
        title: "Along",
        items: [
          { title: "Protocol", detail: "Trip along flag + riders[]; along fare = quote −10% capped ₦2,000; history can show riders." },
          { title: "UI gap", detail: "No in-trip toggle currently — store/realtime ready, trip UI not wired." },
        ],
      },
      {
        id: "schedule",
        title: "Schedule & Embark",
        items: [
          { title: "List", detail: "Offered / accepted / declined / embarked scheduled pickups." },
          { title: "Accept / decline", detail: "Accept sets local reminder 15 minutes before pickup." },
          { title: "Embark", detail: "Starts to_pickup trip when no other active trip; publishes schedule:embark + stage." },
        ],
      },
      {
        id: "money",
        title: "Earnings, pay, wallet",
        items: [
          { title: "Earnings tab", detail: "Today ledger, week rollups, 7-day chart, available balance, queued payouts." },
          { title: "How you pay", detail: "Default 10% commission from pricing; Daily/Weekly/Monthly/Quarterly/Yearly subscriptions." },
          { title: "Wallet", detail: "Balance + trip credits + wallet:post lines." },
          { title: "Withdraw", detail: "Amount ≤ balance; bank verified/pending; queues payout locally until payout service is live." },
        ],
      },
      {
        id: "safety",
        title: "Safety & recordings",
        items: [
          { title: "Safety sheet", detail: "Emergency contact call; message support → inbox." },
          { title: "Cabin camera", detail: "Toggle on trip; seals metadata on complete/cancel — no video file stored on device." },
          { title: "Recordings", detail: "List camera-on trips; detail is placeholder (no clip)." },
        ],
      },
      {
        id: "history-inbox",
        title: "History, inbox, account",
        items: [
          { title: "Trips tab", detail: "Period filters; synthetic + on-device trips; newest/oldest." },
          { title: "History detail", detail: "Map, passenger, fare, along riders, cabin link, editable review." },
          { title: "Inbox", detail: "Support chat with desk templates; support:message realtime." },
          { title: "Notifications", detail: "In-app feed (offers, approvals, range widen, wallet, trips)." },
          { title: "Account", detail: "Documents, bank, pay, range, destination, theme, sign out, replay onboarding, delete account." },
          { title: "Book a ride preview", detail: "Demo Wuse→Jabi passenger-style flow for drivers." },
        ],
      },
    ],
    limits: [
      { title: "Offer window", detail: "15s live · 180s sample" },
      { title: "Offer board", detail: "Max 7 after radius + destination filters" },
      { title: "Dispatch radius", detail: "3–30 km selectable · idle widen to 50 km" },
      { title: "Destination near", detail: "5–20 km · heading ≤90°" },
      { title: "Close / nearby", detail: "0.3 km geofence for ride:nearby" },
      { title: "Voice notes", detail: "45 seconds max" },
      { title: "Commission default", detail: "10% (from pricing)" },
      { title: "Subscriptions", detail: "Daily ₦2k · Weekly ₦5k · Monthly ₦15k · Quarterly ₦45k · Yearly ₦180k" },
    ],
    gaps: [
      { title: "Along toggle", detail: "Store + protocol exist; trip UI does not toggle Along yet." },
      { title: "Multi-offer board UI", detail: "selectOffer / showOfferBoard in store only." },
      { title: "startPush", detail: "Push helper exists but is not started after login yet." },
      { title: "Flat ₦100/trip pay", detail: "Coded in fare lib; not selectable on Pay screen." },
      { title: "Passenger call", detail: "Stub until passenger phone is on the offer/trip payload." },
      { title: "Cabin video", detail: "Metadata only — no clip on device." },
    ],
  },
];
