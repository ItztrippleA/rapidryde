type Draft = {
  mode: "signup" | "reset";
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  referral: string;
  verificationToken: string;
};

export const authDraft: Draft = {
  mode: "signup",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  referral: "",
  verificationToken: "",
};

export function clearAuthDraft() {
  authDraft.password = "";
  authDraft.firstName = "";
  authDraft.lastName = "";
  authDraft.email = "";
  authDraft.referral = "";
  authDraft.verificationToken = "";
}
