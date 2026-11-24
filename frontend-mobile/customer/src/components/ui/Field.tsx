import { Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { usePalette } from "../../theme/Theme";

export function Field({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize = "sentences",
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  multiline?: boolean;
}) {
  const palette = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: palette.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        multiline={multiline}
        style={{
          minHeight: multiline ? 96 : 56,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 12 : 0,
          backgroundColor: palette.raised,
          color: palette.ink,
          fontSize: 16,
          borderWidth: 1,
          borderColor: error ? "#C4482D" : palette.line,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      {error ? <Text style={{ color: "#C4482D", fontSize: 13 }}>{error}</Text> : null}
      {hint && !error ? <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 18 }}>{hint}</Text> : null}
    </View>
  );
}
