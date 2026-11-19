export const bankNames = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank",
  "Fidelity Bank",
  "First Bank",
  "FCMB",
  "GTBank",
  "Keystone Bank",
  "Polaris Bank",
  "Stanbic IBTC",
  "Sterling Bank",
  "UBA",
  "Union Bank",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
] as const;

export const relationships = ["Spouse", "Parent", "Sibling", "Friend", "Other"] as const;

export function listed(current: string, choices: readonly string[]) {
  if (current && !choices.includes(current)) return [current, ...choices];
  return [...choices];
}
