import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Rise } from "../../components/ui/Rise";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { useCustomerStore } from "../../store/useCustomerStore";
import { naira, todayKey } from "../../lib/format";

export default function Wallet() {
  const palette = usePalette();
  const wallet = useCustomerStore((s) => s.wallet);
  const pending = useCustomerStore((s) => s.pending);
  const ledger = useCustomerStore((s) => s.ledger);
  const credits = ledger.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  const spent = ledger.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = todayKey(date);
    const value = ledger.filter((row) => row.amount < 0 && todayKey(new Date(row.at)) === key).reduce((sum, row) => sum + Math.abs(row.amount), 0);
    return { key, value, label: date.toLocaleDateString("en-NG", { weekday: "short" }) };
  });
  const max = Math.max(...days.map((day) => day.value), 1);

  return (
    <Screen footer={<Button label="Add money" onPress={() => router.push("/fund")} />}>
      <Rise>
        <Text style={{ color: palette.muted, fontWeight: "800" }}>WALLET</Text>
        <Text style={{ color: palette.ink, fontSize: 40, fontWeight: "800" }}>{naira(wallet)}</Text>
        <Text style={{ color: palette.muted }}>Available now · pending {naira(pending)}</Text>
      </Rise>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="Credits" value={naira(credits)} />
        <Stat label="Spent" value={naira(spent)} />
      </View>
      <Text style={{ color: palette.ink, fontWeight: "700" }}>Spending</Text>
      {spent === 0 ? <Text style={{ color: palette.muted }}>Nothing to chart yet.</Text> : (
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 8 }}>
          {days.map((day) => (
            <View key={day.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <View style={{ width: 16, height: Math.max(4, (day.value / max) * 90), borderRadius: 8, backgroundColor: palette.accent }} />
              <Text style={{ color: palette.muted, fontSize: 11, marginTop: 6 }}>{day.label}</Text>
            </View>
          ))}
        </View>
      )}
      {ledger.map((row) => (
        <View key={row.id} style={{ paddingVertical: 8 }}>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>{row.label}</Text>
          <Text style={{ color: palette.muted }}>{naira(row.amount)}{row.pending ? " · pending" : ""}</Text>
        </View>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line }}>
      <Text style={{ color: palette.muted }}>{label}</Text>
      <Text style={{ color: palette.ink, fontWeight: "700", fontSize: 18 }}>{value}</Text>
    </View>
  );
}
