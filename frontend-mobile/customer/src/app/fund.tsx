import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "../components/ui/Screen";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";
import { api, ApiError, hasPaystack } from "../lib/api";
import { useCustomerStore } from "../store/useCustomerStore";
import { naira, uid } from "../lib/format";

export default function Fund() {
  const palette = usePalette();
  const applyWallet = useCustomerStore((s) => s.applyWallet);
  const wallet = useCustomerStore((s) => s.wallet);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function fund() {
    const value = Number(amount.replace(/\D/g, ""));
    if (!value || value < 100) {
      setError("Enter at least ₦100.");
      return;
    }
    setLoading(true);
    setError("");
    setNote("");
    try {
      if (!hasPaystack()) {
        setNote("Paystack connects when a key is set. This amount is not added.");
        return;
      }
      const body = await api<{ balance: number }>("/wallet/fund", { method: "POST", body: JSON.stringify({ amount: value }) });
      applyWallet(body.balance, { id: uid("pay"), label: "Added to wallet", amount: value, at: Date.now(), pending: false });
      setNote(`Wallet is now ${naira(body.balance)}.`);
    } catch (err) {
      if (err instanceof ApiError && err.message === "NO_API") setNote("Paystack connects when a key is set. This amount is not added.");
      else setError(err instanceof ApiError ? err.message : "The top-up did not complete.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen footer={<><Button label="Continue" onPress={() => void fund()} loading={loading} /><Button label="Back" kind="quiet" onPress={() => router.back()} /></>}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Add money</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>Wallet balance {naira(wallet)}. Enter an amount. Nothing is added until Paystack or the wallet service accepts it.</Text>
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={error} hint={note} />
    </Screen>
  );
}
