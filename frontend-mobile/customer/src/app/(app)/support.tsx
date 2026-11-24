import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "../../theme/Theme";
import { Rise } from "../../components/ui/Rise";
import { useCustomerStore } from "../../store/useCustomerStore";

const templates = ["A charge looks wrong", "My driver has not arrived", "A trip needs a look"];

export default function Support() {
  const palette = usePalette();
  const support = useCustomerStore((s) => s.support);
  const sendSupport = useCustomerStore((s) => s.sendSupport);
  const [text, setText] = useState("");
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    const pull = () => useCustomerStore.getState().syncSupport();
    pull();
    const timer = setInterval(pull, 8_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [support.length]);

  function send(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    sendSupport(trimmed);
    setText("");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Rise style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 4 }}>
          <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "800" }}>HELP</Text>
          <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "800" }}>Support</Text>
          <Text style={{ color: palette.muted }}>Message the Rapyd Ryd desk about trips, wallet, or your account.</Text>
        </Rise>

        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20, gap: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {support.map((line) => (
            <View
              key={line.id}
              style={{
                alignSelf: line.from === "customer" ? "flex-end" : "flex-start",
                maxWidth: "78%",
                backgroundColor: line.from === "customer" ? palette.accent : palette.paper,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <Text style={{ color: line.from === "customer" ? palette.accentInk : palette.ink }}>{line.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.bg }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}
          >
            {templates.map((line) => (
              <Pressable
                key={line}
                onPress={() => send(line)}
                style={{
                  height: 32,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                  backgroundColor: palette.raised,
                }}
              >
                <Text style={{ color: palette.ink }}>{line}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message support"
              placeholderTextColor={palette.muted}
              onSubmitEditing={() => send(text)}
              returnKeyType="send"
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 14,
                paddingHorizontal: 14,
                color: palette.ink,
                backgroundColor: palette.paper,
              }}
            />
            <Pressable onPress={() => send(text)} hitSlop={8} style={{ justifyContent: "center", minHeight: 44 }}>
              <Text style={{ color: palette.accent, fontWeight: "700" }}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
