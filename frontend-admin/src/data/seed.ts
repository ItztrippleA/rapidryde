import type { Activity, AppConfig, ChatThread, Customer, Delivery, DeliveryZone, Driver, NoticeTemplate, OutboxItem, Plan, Pricing, Promo, Ride, RideZone, Staff, Subscription } from "@/lib/types";

export const drivers: Driver[] = [
  { id: "d_amaka", name: "Amaka Obi", phone: "+234 803 441 2201", email: "amaka.obi@example.com", city: "abuja", ninStatus: "verified", status: "active", online: true, rating: 4.93, trips: 1284, vehicle: "Toyota Corolla · Silver", plate: "ABC-123AB", classId: "ryde", x: 22, y: 28, papers: "valid", earningsToday: 18600 },
  { id: "d_ibrahim", name: "Ibrahim Sule", phone: "+234 809 220 1184", email: "ibrahim.sule@example.com", city: "abuja", ninStatus: "verified", status: "active", online: true, rating: 4.88, trips: 986, vehicle: "Honda Accord · Black", plate: "LSD-441JK", classId: "comfort", x: 34, y: 42, papers: "valid", earningsToday: 24200 },
  { id: "d_fatima", name: "Fatima Bello", phone: "+234 701 558 9033", email: "fatima.bello@example.com", city: "abuja", ninStatus: "verified", status: "active", online: true, rating: 4.96, trips: 1502, vehicle: "Kia Rio · Blue", plate: "BDG-220FG", classId: "green", x: 18, y: 16, papers: "expiring", earningsToday: 16400 },
  { id: "d_chinedu", name: "Chinedu Adeyemi", phone: "+234 816 774 0091", email: "chinedu.adeyemi@example.com", city: "abuja", ninStatus: "pending", status: "pending", online: false, rating: 4.79, trips: 742, vehicle: "Hyundai Elantra · White", plate: "KJA-908DE", classId: "executive", x: 76, y: 68, papers: "valid", earningsToday: 0 },
  { id: "d_tunde", name: "Tunde Kalejaiye", phone: "+234 802 119 4470", email: "tunde.k@example.com", city: "lagos", ninStatus: "verified", status: "active", online: true, rating: 4.71, trips: 2104, vehicle: "TVS King · Yellow", plate: "KRD-118LA", classId: "keke", x: 24, y: 64, papers: "valid", earningsToday: 9800 },
  { id: "d_ngozi", name: "Ngozi Eze", phone: "+234 813 662 3308", email: "ngozi.eze@example.com", city: "lagos", ninStatus: "verified", status: "active", online: true, rating: 4.9, trips: 864, vehicle: "Bajaj Boxer · Red", plate: "FKJ-552AA", classId: "moto", x: 28, y: 24, papers: "valid", earningsToday: 12100 },
  { id: "d_seyi", name: "Seyi Adebayo", phone: "+234 805 990 2217", email: "seyi.adebayo@example.com", city: "lagos", ninStatus: "verified", status: "active", online: true, rating: 4.97, trips: 640, vehicle: "Toyota Camry · Black", plate: "SMK-304FG", classId: "executive", x: 72, y: 58, papers: "valid", earningsToday: 31800 },
  { id: "d_halima", name: "Halima Rasheed", phone: "+234 907 441 8820", email: "halima.rasheed@example.com", city: "lagos", ninStatus: "failed", status: "suspended", online: false, rating: 4.62, trips: 410, vehicle: "Toyota Corolla · Grey", plate: "APP-771BC", classId: "ryde", x: 36, y: 30, papers: "expired", earningsToday: 0 },
];

export const customers: Customer[] = [
  { id: "c_adaeze", name: "Adaeze Nwosu", phone: "+234 803 100 2244", email: "adaeze.nwosu@example.com", city: "abuja", ninStatus: "verified", status: "active", rating: 4.9, trips: 86, wallet: 12500, rideSpend: 148600, joined: "12 Jan 2026" },
  { id: "c_kunle", name: "Kunle Peters", phone: "+234 809 441 7781", email: "kunle.peters@example.com", city: "lagos", ninStatus: "verified", status: "active", rating: 4.8, trips: 142, wallet: 4200, rideSpend: 226900, joined: "3 Mar 2026" },
  { id: "c_zainab", name: "Zainab Musa", phone: "+234 701 220 6645", email: "zainab.musa@example.com", city: "abuja", ninStatus: "pending", status: "pending", rating: 5, trips: 0, wallet: 0, rideSpend: 0, joined: "28 Oct 2026" },
  { id: "c_bola", name: "Bola Adewale", phone: "+234 816 300 1192", email: "bola.adewale@example.com", city: "lagos", ninStatus: "verified", status: "active", rating: 4.7, trips: 54, wallet: 800, rideSpend: 86400, joined: "19 Jun 2026" },
  { id: "c_emeka", name: "Emeka Okafor", phone: "+234 802 775 4410", email: "emeka.okafor@example.com", city: "abuja", ninStatus: "verified", status: "suspended", rating: 4.2, trips: 21, wallet: 0, rideSpend: 31200, joined: "2 Feb 2026" },
  { id: "c_lara", name: "Lara Balogun", phone: "+234 813 908 2256", email: "lara.balogun@example.com", city: "lagos", ninStatus: "verified", status: "active", rating: 4.95, trips: 203, wallet: 18600, rideSpend: 412600, joined: "8 Nov 2025" },
];

export const plans: Plan[] = [
  { id: "p_care", name: "Driver Care", audience: "driver", price: 4500, interval: "week", perk: "Fuel partner codes and a written earnings summary.", commissionPercent: null, active: true },
  { id: "p_pro", name: "Driver Pro", audience: "driver", price: 15000, interval: "month", perk: "Commission drops to the plan rate while the week is paid.", commissionPercent: 12, active: true },
  { id: "p_plus", name: "Rapyd Plus", audience: "customer", price: 2500, interval: "month", perk: "10% off city rides, capped, on top of a promo.", commissionPercent: null, active: true },
];

export const subscriptions: Subscription[] = [
  { id: "s1", planId: "p_pro", holder: "driver", holderId: "d_seyi", status: "active", renewsOn: "18 Nov 2026" },
  { id: "s2", planId: "p_care", holder: "driver", holderId: "d_amaka", status: "active", renewsOn: "6 Nov 2026" },
  { id: "s3", planId: "p_plus", holder: "customer", holderId: "c_lara", status: "active", renewsOn: "1 Dec 2026" },
  { id: "s4", planId: "p_plus", holder: "customer", holderId: "c_kunle", status: "past_due", renewsOn: "30 Oct 2026" },
];

export const rideZones: RideZone[] = [
  { id: "rz_wuse", name: "Wuse and Garki", city: "abuja", active: true, surge: 1, minFare: 800, cx: 32, cy: 40, rx: 16, ry: 14 },
  { id: "rz_jabi", name: "Jabi and Gwarinpa", city: "abuja", active: true, surge: 1.1, minFare: 700, cx: 20, cy: 20, rx: 14, ry: 12 },
  { id: "rz_abjair", name: "Abuja airport corridor", city: "abuja", active: true, surge: 1.35, minFare: 2500, cx: 76, cy: 66, rx: 16, ry: 14 },
  { id: "rz_ikeja", name: "Ikeja", city: "lagos", active: true, surge: 1.15, minFare: 900, cx: 26, cy: 24, rx: 16, ry: 14 },
  { id: "rz_vi", name: "Island and Victoria Island", city: "lagos", active: true, surge: 1.25, minFare: 1200, cx: 70, cy: 62, rx: 18, ry: 16 },
  { id: "rz_yaba", name: "Yaba and Akoka", city: "lagos", active: true, surge: 1, minFare: 700, cx: 22, cy: 66, rx: 14, ry: 12 },
];

export const deliveryZones: DeliveryZone[] = [
  { id: "dz_wuse", name: "Wuse meals", city: "abuja", active: true, fee: 800, maxKm: 8, services: ["food", "grocery"], cx: 34, cy: 38, rx: 18, ry: 15 },
  { id: "dz_gwarinpa", name: "Gwarinpa parcels", city: "abuja", active: true, fee: 1200, maxKm: 18, services: ["courier", "freight"], cx: 22, cy: 22, rx: 16, ry: 14 },
  { id: "dz_ikeja", name: "Ikeja same-day", city: "lagos", active: true, fee: 1000, maxKm: 12, services: ["courier", "food", "grocery"], cx: 28, cy: 26, rx: 18, ry: 16 },
  { id: "dz_vi", name: "VI and Ikoyi", city: "lagos", active: true, fee: 1500, maxKm: 10, services: ["courier", "food"], cx: 72, cy: 58, rx: 16, ry: 14 },
];

export const rides: Ride[] = [
  { id: "r_2041", city: "abuja", customerId: "c_adaeze", driverId: "d_amaka", classId: "ryde", pickup: "Gwarinpa estate gate", dropoff: "Wuse II, Zone 5", distanceKm: 8.1, fare: 2100, status: "on_trip", when: "Today, 09:14" },
  { id: "r_2042", city: "abuja", customerId: "c_emeka", driverId: "d_ibrahim", classId: "comfort", pickup: "National Hospital", dropoff: "Jabi Lake Mall", distanceKm: 11.4, fare: 4800, status: "assigned", when: "Today, 09:02" },
  { id: "r_1888", city: "lagos", customerId: "c_lara", driverId: "d_seyi", classId: "executive", pickup: "Eko Hotel", dropoff: "Murtala Muhammed Airport", distanceKm: 22.6, fare: 14600, status: "completed", when: "Today, 07:40" },
  { id: "r_1881", city: "lagos", customerId: "c_kunle", driverId: "d_tunde", classId: "keke", pickup: "Yaba estate gate", dropoff: "Unilag main gate", distanceKm: 4.2, fare: 900, status: "completed", when: "Yesterday, 18:12" },
  { id: "r_1902", city: "lagos", customerId: "c_bola", driverId: null, classId: "ryde", pickup: "Computer Village", dropoff: "Ikeja City Mall", distanceKm: 3.4, fare: 1600, status: "searching", when: "Today, 09:20" },
];

export const deliveries: Delivery[] = [
  { id: "dl_441", kind: "food", city: "abuja", customerId: "c_adaeze", driverId: "d_fatima", zoneId: "dz_wuse", pickup: "Jabi Grills", dropoff: "Wuse II, Zone 5", distanceKm: 6.2, fee: 800, status: "picked_up", note: "Beef suya platter" },
  { id: "dl_442", kind: "courier", city: "abuja", customerId: "c_zainab", driverId: null, zoneId: "dz_gwarinpa", pickup: "Ceddi Plaza", dropoff: "Gwarinpa estate gate", distanceKm: 9.5, fee: 1200, status: "new", note: "Medium parcel, documents" },
  { id: "dl_510", kind: "grocery", city: "lagos", customerId: "c_bola", driverId: "d_ngozi", zoneId: "dz_ikeja", pickup: "Ikeja City Mall", dropoff: "Yaba estate gate", distanceKm: 7.1, fee: 1000, status: "assigned", note: "Rice 5kg, water pack" },
  { id: "dl_511", kind: "freight", city: "lagos", customerId: "c_lara", driverId: "d_seyi", zoneId: "dz_vi", pickup: "Balogun Market", dropoff: "Eko Hotel", distanceKm: 5.4, fee: 4500, status: "delivered", note: "Van, two cartons" },
];

export const promos: Promo[] = [
  { id: "pr_ryde", code: "RYDE", name: "First city ride", kind: "amount", value: 500, cap: null, minFare: 1500, audience: "customers", active: true, uses: 1280, maxUses: 20000, expires: "31 Dec 2026" },
  { id: "pr_ryde10", code: "RYDE10", name: "Ten percent off", kind: "percent", value: 10, cap: 2000, minFare: 2000, audience: "customers", active: true, uses: 640, maxUses: 8000, expires: "31 Dec 2026" },
  { id: "pr_airport", code: "AIRPORT", name: "Airport return", kind: "percent", value: 15, cap: 3000, minFare: 4000, audience: "customers", active: false, uses: 90, maxUses: 500, expires: "15 Nov 2026" },
  { id: "pr_week", code: "WEEKEND", name: "Driver weekend boost", kind: "amount", value: 1000, cap: null, minFare: 0, audience: "drivers", active: true, uses: 210, maxUses: 3000, expires: "30 Nov 2026" },
];

export const templates: NoticeTemplate[] = [
  { id: "n_assign", channel: "native", audience: "drivers", name: "Trip assigned", title: "A trip is yours", body: "Pickup, landmark note, and the fare are on the offer. Accept before the window closes.", enabled: true },
  { id: "n_pin", channel: "native", audience: "customers", name: "Trip PIN", title: "Your trip PIN", body: "Share the PIN only with the driver at the car. It expires when the trip starts.", enabled: true },
  { id: "n_receipt", channel: "email", audience: "customers", name: "Receipt", title: "Your Rapyd Ryd receipt", body: "The fare, the distance, and the payment line are attached. A case reference is included if one was opened.", enabled: true },
  { id: "n_payout", channel: "email", audience: "drivers", name: "Earnings", title: "Today's earnings", body: "Gross, commission, and take-home before fuel. This is an estimate, not a guarantee.", enabled: true },
  { id: "n_sos", channel: "native", audience: "both", name: "SOS opened", title: "A safety case is open", body: "Support has the trip. Stay on the line if you can. The trusted contact is notified.", enabled: true },
];

export const outbox: OutboxItem[] = [
  { id: "o1", channel: "email", audience: "customers", title: "Your Rapyd Ryd receipt", body: "Queued for riders who finished a trip this morning.", status: "queued", at: "Today, 08:05" },
  { id: "o2", channel: "native", audience: "drivers", title: "Airport corridor is busy", body: "Abuja airport surge is 1.35. The multiplier is on the offer before you accept.", status: "queued", at: "Today, 07:50" },
];

export const pricing: Pricing = {
  baseFare: 400,
  perMinute: 25,
  minimumFare: 700,
  bookingFee: 100,
  cancellationFee: 300,
  waitPerMinute: 40,
  commissionPercent: 15,
  airportMultiplier: 1.35,
  nightMultiplier: 1.15,
  rainMultiplier: 1.2,
  intercityPerKm: 180,
  bands: [
    { id: "b1", label: "First 3 km", upToKm: 3, perKm: 180 },
    { id: "b2", label: "3 to 10 km", upToKm: 10, perKm: 140 },
    { id: "b3", label: "Beyond 10 km", upToKm: null, perKm: 110 },
  ],
  classes: [
    { id: "ryde", label: "Ryde", multiplier: 1 },
    { id: "comfort", label: "Comfort", multiplier: 1.35 },
    { id: "xl", label: "XL", multiplier: 1.55 },
    { id: "executive", label: "Executive", multiplier: 2.05 },
    { id: "green", label: "Green", multiplier: 1.12 },
    { id: "moto", label: "Moto", multiplier: 0.62 },
    { id: "keke", label: "Keke", multiplier: 0.55 },
  ],
};

export const config: AppConfig = {
  abujaLive: true,
  lagosLive: true,
  ninRequired: true,
  stillPlay: true,
  supportEmail: "care@rapydryd.com",
  supportPhone: "+234 700 729 3743",
  searchRadiusKm: 6,
  offerWindowSec: 20,
  driver: {
    minVersion: "1.0.0",
    documentsRequired: true,
    destinationFilter: true,
    demandMap: true,
    maxOnlineHours: 12,
  },
  customer: {
    minVersion: "1.0.0",
    yourPrice: true,
    maxStops: 2,
    shareTrip: true,
    sos: true,
    quietRide: true,
    scheduleAheadHours: 72,
  },
};

export const staff: Staff[] = [
  { id: "st_ada", name: "Ada Okonkwo", email: "ada@rapydryd.com", password: "owner", role: "owner", status: "active" },
  { id: "st_tobi", name: "Tobi Ade", email: "tobi@rapydryd.com", password: "operations", role: "operations", status: "active" },
  { id: "st_nneka", name: "Nneka Udo", email: "nneka@rapydryd.com", password: "support", role: "support", status: "active" },
  { id: "st_femi", name: "Femi Lawal", email: "femi@rapydryd.com", password: "finance", role: "finance", status: "active" },
  { id: "st_chioma", name: "Chioma Edet", email: "chioma@rapydryd.com", password: "viewer", role: "viewer", status: "active" },
];

export const chats: ChatThread[] = [
  {
    id: "ch_amaka",
    party: "driver",
    partyId: "d_amaka",
    subject: "Vehicle licence still marked expiring",
    status: "waiting",
    city: "abuja",
    updatedAt: "Today, 09:41",
    messages: [
      { id: "m1", from: "party", author: "Amaka Obi", body: "I uploaded the new vehicle licence this morning. The app still says the papers are expiring.", at: "Today, 09:12" },
      { id: "m2", from: "staff", author: "Nneka Udo", body: "The upload is on the file. It stays expiring until the check finishes, and you can keep taking trips.", at: "Today, 09:18" },
      { id: "m3", from: "party", author: "Amaka Obi", body: "How long does that check usually take? I am online around Gwarinpa.", at: "Today, 09:41" },
    ],
  },
  {
    id: "ch_chinedu",
    party: "driver",
    partyId: "d_chinedu",
    subject: "Cannot go online while NIN is pending",
    status: "waiting",
    city: "abuja",
    updatedAt: "Today, 08:55",
    messages: [
      { id: "m4", from: "party", author: "Chinedu Adeyemi", body: "My NIN check is still pending, so the app will not let me go online. Can someone look at it?", at: "Today, 08:55" },
    ],
  },
  {
    id: "ch_tunde",
    party: "driver",
    partyId: "d_tunde",
    subject: "No keke offers around Ikeja",
    status: "waiting",
    city: "lagos",
    updatedAt: "Today, 09:05",
    messages: [
      { id: "m5", from: "party", author: "Tunde Kalejaiye", body: "I have been online since morning and Ikeja is not sending keke offers. Is that zone switched off?", at: "Today, 09:05" },
    ],
  },
  {
    id: "ch_halima",
    party: "driver",
    partyId: "d_halima",
    subject: "Suspension after a failed NIN check",
    status: "open",
    city: "lagos",
    updatedAt: "Yesterday, 16:40",
    messages: [
      { id: "m6", from: "party", author: "Halima Rasheed", body: "The account was suspended after the NIN check failed. I have a corrected slip.", at: "Yesterday, 16:02" },
      { id: "m7", from: "staff", author: "Ada Okonkwo", body: "Send the corrected slip from the driver app. We will review the suspension from this chat.", at: "Yesterday, 16:40" },
    ],
  },
  {
    id: "ch_bola",
    party: "customer",
    partyId: "c_bola",
    subject: "Computer Village pickup still searching",
    status: "waiting",
    city: "lagos",
    updatedAt: "Today, 09:22",
    messages: [
      { id: "m8", from: "party", author: "Bola Adewale", body: "My Ryde from Computer Village has been searching for a while. Can someone check whether an offer went out?", at: "Today, 09:22" },
    ],
  },
  {
    id: "ch_lara",
    party: "customer",
    partyId: "c_lara",
    subject: "Bag left in the car",
    status: "waiting",
    city: "lagos",
    updatedAt: "Today, 09:33",
    messages: [
      { id: "m9", from: "party", author: "Lara Balogun", body: "I left a black handbag in the executive car this morning.", at: "Today, 09:08" },
      { id: "m10", from: "staff", author: "Nneka Udo", body: "We have asked the driver to check the boot. Reply here if you need a callback.", at: "Today, 09:16" },
      { id: "m11", from: "party", author: "Lara Balogun", body: "Please do. The bag has my house keys.", at: "Today, 09:33" },
    ],
  },
  {
    id: "ch_zainab",
    party: "customer",
    partyId: "c_zainab",
    subject: "Booking blocked on a pending NIN",
    status: "closed",
    city: "abuja",
    updatedAt: "Yesterday, 18:10",
    messages: [
      { id: "m12", from: "party", author: "Zainab Musa", body: "I cannot book yet. The app says the NIN check is pending.", at: "Yesterday, 17:48" },
      { id: "m13", from: "staff", author: "Nneka Udo", body: "Booking opens after the check passes. This chat is closed, and we will write again if the check fails.", at: "Yesterday, 18:10" },
    ],
  },
];

export const activity: Activity[] = [
  { id: "a1", at: "Today, 09:20", text: "Bola Adewale is searching for a Ryde from Computer Village." },
  { id: "a2", at: "Today, 09:14", text: "Amaka Obi started the Gwarinpa to Wuse trip." },
  { id: "a3", at: "Today, 09:02", text: "Ibrahim Sule accepted the National Hospital offer." },
  { id: "a4", at: "Today, 08:05", text: "Receipt emails were queued for completed morning trips." },
];

export function freshData() {
  return {
    drivers,
    customers,
    plans,
    subscriptions,
    rideZones,
    deliveryZones,
    rides,
    deliveries,
    promos,
    templates,
    outbox,
    pricing,
    config,
    activity,
    staff,
    chats,
  };
}
