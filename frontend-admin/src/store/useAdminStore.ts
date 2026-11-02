"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { freshData } from "@/data/seed";
import type { Activity, AppConfig, ChatMessage, ChatStatus, ChatThread, Customer, Delivery, DeliveryZone, Driver, NoticeTemplate, OutboxItem, Plan, Pricing, Promo, Ride, RideZone, Staff, Subscription } from "@/lib/types";

function completedFare(ride: Ride | undefined) {
  return ride?.status === "completed" ? ride.fare : 0;
}

function adjustRideSpend(customers: Customer[], previous: Ride | undefined, next: Ride | undefined) {
  const delta = new Map<string, number>();
  if (previous && completedFare(previous)) delta.set(previous.customerId, (delta.get(previous.customerId) ?? 0) - completedFare(previous));
  if (next && completedFare(next)) delta.set(next.customerId, (delta.get(next.customerId) ?? 0) + completedFare(next));
  if (delta.size === 0) return customers;
  return customers.map((customer) => {
    const change = delta.get(customer.id);
    if (!change) return customer;
    return { ...customer, rideSpend: Math.max(0, (customer.rideSpend ?? 0) + change) };
  });
}

type Data = ReturnType<typeof freshData>;

type AdminState = Data & {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  reset: () => void;
  note: (text: string) => void;
  saveDriver: (driver: Driver, creating: boolean) => void;
  removeDriver: (id: string) => void;
  saveCustomer: (customer: Customer, creating: boolean) => void;
  removeCustomer: (id: string) => void;
  savePlan: (plan: Plan, creating: boolean) => void;
  removePlan: (id: string) => void;
  saveSubscription: (subscription: Subscription, creating: boolean) => void;
  removeSubscription: (id: string) => void;
  saveRideZone: (zone: RideZone, creating: boolean) => void;
  removeRideZone: (id: string) => void;
  saveDeliveryZone: (zone: DeliveryZone, creating: boolean) => void;
  removeDeliveryZone: (id: string) => void;
  saveRide: (ride: Ride, creating: boolean) => void;
  removeRide: (id: string) => void;
  saveDelivery: (delivery: Delivery, creating: boolean) => void;
  removeDelivery: (id: string) => void;
  savePromo: (promo: Promo, creating: boolean) => void;
  removePromo: (id: string) => void;
  saveTemplate: (template: NoticeTemplate, creating: boolean) => void;
  removeTemplate: (id: string) => void;
  queueNotice: (item: OutboxItem) => void;
  setPricing: (pricing: Pricing) => void;
  setConfig: (config: AppConfig) => void;
  saveStaff: (member: Staff, creating: boolean) => void;
  removeStaff: (id: string) => void;
  startChat: (thread: ChatThread) => void;
  replyToChat: (id: string, message: ChatMessage) => void;
  setChatStatus: (id: string, status: ChatStatus) => void;
};

function upsert<T extends { id: string }>(rows: T[], row: T, creating: boolean) {
  return creating ? [row, ...rows] : rows.map((item) => (item.id === row.id ? row : item));
}

function stamp(text: string): Activity {
  return { id: `act_${Math.random().toString(36).slice(2, 7)}`, at: "Just now", text };
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      ...freshData(),
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      reset: () => set({ ...freshData() }),
      note: (text) => set((state) => ({ activity: [stamp(text), ...state.activity].slice(0, 30) })),
      saveDriver: (driver, creating) =>
        set((state) => ({
          drivers: upsert(state.drivers, driver, creating),
          activity: [stamp(`${creating ? "Added" : "Updated"} driver ${driver.name}.`), ...state.activity].slice(0, 30),
        })),
      removeDriver: (id) =>
        set((state) => ({
          drivers: state.drivers.filter((driver) => driver.id !== id),
          subscriptions: state.subscriptions.filter((sub) => !(sub.holder === "driver" && sub.holderId === id)),
          activity: [stamp("Removed a driver."), ...state.activity].slice(0, 30),
        })),
      saveCustomer: (customer, creating) =>
        set((state) => ({
          customers: upsert(state.customers, customer, creating),
          activity: [stamp(`${creating ? "Added" : "Updated"} customer ${customer.name}.`), ...state.activity].slice(0, 30),
        })),
      removeCustomer: (id) =>
        set((state) => ({
          customers: state.customers.filter((customer) => customer.id !== id),
          subscriptions: state.subscriptions.filter((sub) => !(sub.holder === "customer" && sub.holderId === id)),
          activity: [stamp("Removed a customer."), ...state.activity].slice(0, 30),
        })),
      savePlan: (plan, creating) => set((state) => ({ plans: upsert(state.plans, plan, creating) })),
      removePlan: (id) =>
        set((state) => ({
          plans: state.plans.filter((plan) => plan.id !== id),
          subscriptions: state.subscriptions.filter((sub) => sub.planId !== id),
        })),
      saveSubscription: (subscription, creating) => set((state) => ({ subscriptions: upsert(state.subscriptions, subscription, creating) })),
      removeSubscription: (id) => set((state) => ({ subscriptions: state.subscriptions.filter((sub) => sub.id !== id) })),
      saveRideZone: (zone, creating) => set((state) => ({ rideZones: upsert(state.rideZones, zone, creating) })),
      removeRideZone: (id) => set((state) => ({ rideZones: state.rideZones.filter((zone) => zone.id !== id) })),
      saveDeliveryZone: (zone, creating) => set((state) => ({ deliveryZones: upsert(state.deliveryZones, zone, creating) })),
      removeDeliveryZone: (id) => set((state) => ({ deliveryZones: state.deliveryZones.filter((zone) => zone.id !== id) })),
      saveRide: (ride, creating) =>
        set((state) => {
          const previous = creating ? undefined : state.rides.find((item) => item.id === ride.id);
          return { rides: upsert(state.rides, ride, creating), customers: adjustRideSpend(state.customers, previous, ride) };
        }),
      removeRide: (id) =>
        set((state) => {
          const previous = state.rides.find((ride) => ride.id === id);
          return { rides: state.rides.filter((ride) => ride.id !== id), customers: adjustRideSpend(state.customers, previous, undefined) };
        }),
      saveDelivery: (delivery, creating) => set((state) => ({ deliveries: upsert(state.deliveries, delivery, creating) })),
      removeDelivery: (id) => set((state) => ({ deliveries: state.deliveries.filter((delivery) => delivery.id !== id) })),
      savePromo: (promo, creating) => set((state) => ({ promos: upsert(state.promos, promo, creating) })),
      removePromo: (id) => set((state) => ({ promos: state.promos.filter((promo) => promo.id !== id) })),
      saveTemplate: (template, creating) => set((state) => ({ templates: upsert(state.templates, template, creating) })),
      removeTemplate: (id) => set((state) => ({ templates: state.templates.filter((template) => template.id !== id) })),
      queueNotice: (item) => set((state) => ({ outbox: [item, ...state.outbox], activity: [stamp(`Queued a ${item.channel} notification.`), ...state.activity].slice(0, 30) })),
      setPricing: (pricing) => set((state) => ({ pricing, activity: [stamp("Updated pricing."), ...state.activity].slice(0, 30) })),
      setConfig: (config) => set({ config }),
      saveStaff: (member, creating) =>
        set((state) => {
          const previous = state.staff.find((item) => item.id === member.id);
          const next = upsert(state.staff, member, creating);
          const owners = next.filter((item) => item.role === "owner" && item.status === "active");
          if (previous?.role === "owner" && previous.status === "active" && owners.length === 0) return state;
          return { staff: next, activity: [stamp(`${creating ? "Added" : "Updated"} ${member.name}.`), ...state.activity].slice(0, 30) };
        }),
      removeStaff: (id) =>
        set((state) => {
          const target = state.staff.find((member) => member.id === id);
          const owners = state.staff.filter((member) => member.role === "owner" && member.status === "active");
          if (target?.role === "owner" && target.status === "active" && owners.length < 2) return state;
          return { staff: state.staff.filter((member) => member.id !== id) };
        }),
      startChat: (thread) => set((state) => ({ chats: [thread, ...state.chats], activity: [stamp("Opened a support chat."), ...state.activity].slice(0, 30) })),
      replyToChat: (id, message) =>
        set((state) => ({
          chats: state.chats.map((thread) =>
            thread.id === id ? { ...thread, status: "open", updatedAt: message.at, messages: [...thread.messages, message] } : thread,
          ),
          activity: [stamp(`Replied in a ${state.chats.find((thread) => thread.id === id)?.party ?? "support"} chat.`), ...state.activity].slice(0, 30),
        })),
      setChatStatus: (id, status) =>
        set((state) => ({
          chats: state.chats.map((thread) => (thread.id === id ? { ...thread, status, updatedAt: "Just now" } : thread)),
        })),
    }),
    {
      name: "rapyd-admin",
      skipHydration: true,
      partialize: (state) => ({
        drivers: state.drivers,
        customers: state.customers,
        plans: state.plans,
        subscriptions: state.subscriptions,
        rideZones: state.rideZones,
        deliveryZones: state.deliveryZones,
        rides: state.rides,
        deliveries: state.deliveries,
        promos: state.promos,
        templates: state.templates,
        outbox: state.outbox,
        pricing: state.pricing,
        config: state.config,
        activity: state.activity,
        staff: state.staff,
        chats: state.chats,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Data>;
        const seedSpend = new Map(current.customers.map((customer) => [customer.id, customer.rideSpend]));
        const seedPassword = new Map(current.staff.map((member) => [member.id, member.password]));
        const customers = (saved.customers ?? current.customers).map((customer) => ({
          ...customer,
          rideSpend: customer.rideSpend ?? seedSpend.get(customer.id) ?? 0,
        }));
        const staff = (saved.staff ?? current.staff).map((member) => ({
          ...member,
          password: member.password || seedPassword.get(member.id) || "",
        }));
        return { ...current, ...saved, chats: saved.chats ?? current.chats, customers, staff };
      },
    },
  ),
);
