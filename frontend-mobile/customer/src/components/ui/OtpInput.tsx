import { useEffect, useRef, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { usePalette } from "../../theme/Theme";

/**
 * 6-digit OTP boxes with iOS/Android SMS autofill.
 * Autofill lands on the first cell (oneTimeCode / sms-otp) and is split across boxes.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired once when all 6 digits are present (autofill or typing). */
  onComplete?: (code: string) => void;
  error?: string;
}) {
  const palette = usePalette();
  const refs = useRef<Array<TextInput | null>>([]);
  const [focused, setFocused] = useState(0);
  const lastComplete = useRef("");

  useEffect(() => {
    const timer = setTimeout(() => refs.current[0]?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (value.length === 6 && value !== lastComplete.current) {
      lastComplete.current = value;
      onComplete?.(value);
    }
    if (value.length < 6) lastComplete.current = "";
  }, [onComplete, value]);

  function emit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length < 6) {
      refs.current[clean.length]?.focus();
    } else {
      refs.current[5]?.blur();
    }
  }

  function write(index: number, text: string) {
    const clean = text.replace(/\D/g, "");
    if (!clean) {
      const chars = value.split("");
      chars[index] = "";
      emit(chars.join(""));
      return;
    }
    // Autofill / paste of the full code into the focused cell
    if (clean.length > 1) {
      emit(`${value.slice(0, index)}${clean}`);
      return;
    }
    const chars = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
    chars[index] = clean;
    emit(chars.join(""));
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        {Array.from({ length: 6 }, (_, index) => (
          <TextInput
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={value[index] ?? ""}
            onChangeText={(text) => write(index, text)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace" && !value[index] && index > 0) {
                refs.current[index - 1]?.focus();
              }
            }}
            onFocus={() => setFocused(index)}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={index === 0 ? 6 : 1}
            // Autofill: only the first box should advertise OTP to the OS
            textContentType={index === 0 ? "oneTimeCode" : "none"}
            autoComplete={index === 0 ? "sms-otp" : "off"}
            importantForAutofill={index === 0 ? "yes" : "no"}
            autoCorrect={false}
            spellCheck={false}
            caretHidden={Platform.OS === "ios"}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 14,
              textAlign: "center",
              fontSize: 22,
              fontWeight: "700",
              color: palette.ink,
              backgroundColor: palette.raised,
              borderWidth: 1,
              borderColor: error ? "#C4482D" : focused === index ? palette.accent : palette.line,
            }}
          />
        ))}
      </View>
      {error ? <Text style={{ color: "#C4482D" }}>{error}</Text> : null}
    </View>
  );
}
