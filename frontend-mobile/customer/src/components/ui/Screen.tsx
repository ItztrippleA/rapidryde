import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "../../theme/Theme";

export function Screen({
  children,
  header,
  footer,
  scroll = true,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const palette = usePalette();
  const body = scroll ? (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: 20 }}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>{header}</View> : null}
        {body}
        {footer ? <View style={{ padding: 20, paddingTop: 8, gap: 10 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
