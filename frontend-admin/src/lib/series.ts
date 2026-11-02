import { titleCase } from "@/lib/format";

export type Point = { label: string; value: number; display?: string };

export function tally<T>(items: T[], keys: readonly string[], pick: (item: T) => string, name: (key: string) => string = titleCase): Point[] {
  return keys.map((key) => ({ label: name(key), value: items.filter((item) => pick(item) === key).length }));
}

export function sumBy<T>(items: T[], keys: readonly string[], pick: (item: T) => string, amount: (item: T) => number, name: (key: string) => string = titleCase): Point[] {
  return keys.map((key) => ({
    label: name(key),
    value: items.filter((item) => pick(item) === key).reduce((total, item) => total + amount(item), 0),
  }));
}
