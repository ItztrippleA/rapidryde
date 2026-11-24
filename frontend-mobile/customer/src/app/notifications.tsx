import { Text, View } from "react-native";
import { router } from "expo-router";
import { useEffect } from "react";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";
import { useCustomerStore } from "../store/useCustomerStore";
import { whenLabel } from "../lib/format";

export default function Notifications() {
  const palette = usePalette();
  const notices = useCustomerStore((s) => s.notices);
  const markNotices = useCustomerStore((s) => s.markNotices);

  useEffect(() => {
    markNotices();
  }, [markNotices]);

  return (
    <Screen footer={<Button label="Back" kind="quiet" onPress={() => router.back()} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Notifications</Text>
      {notices.length === 0 ? <Text style={{ color: palette.muted }}>No notices yet.</Text> : null}
      {notices.map((notice) => (
        <View key={notice.id} style={{ paddingVertical: 10, gap: 4 }}>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>{notice.title}</Text>
          <Text style={{ color: palette.muted }}>{notice.body}</Text>
          <Text style={{ color: palette.muted, fontSize: 12 }}>{whenLabel(notice.at)}</Text>
        </View>
      ))}
    </Screen>
  );
}
