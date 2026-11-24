import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation, type SharedValue } from "react-native-reanimated";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ui/Button";
import { useCustomerStore } from "../store/useCustomerStore";

const slides = [
  {
    key: "city",
    title: "Your City. Your Journey.",
    body: "Get wherever you need to go with just a few taps. Your next ride is always within reach.",
    photo: require("../../assets/onboarding/earn.jpg"),
  },
  {
    key: "ride",
    title: "Your Ride, Your Way.",
    body: "Choose your preferred ride, see your fare upfront, and travel comfortably.",
    photo: require("../../assets/onboarding/map.jpg"),
  },
  {
    key: "follow",
    title: "Follow Every Journey.",
    body: "Track your driver in real time, know when they arrive, and stay informed throughout your trip.",
    photo: require("../../assets/onboarding/earnings.jpg"),
  },
  {
    key: "safe",
    title: "Your Safety Comes First.",
    body: "Travel confidently with trip sharing, verified drivers, emergency assistance, and dedicated support.",
    photo: require("../../assets/onboarding/safety.jpg"),
  },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const setOnboarded = useCustomerStore((s) => s.setOnboarded);
  const mode = useCustomerStore((s) => s.mode);
  const setMode = useCustomerStore((s) => s.setMode);
  const [index, setIndex] = useState(0);
  const x = useSharedValue(0);
  const scroller = useRef<Animated.ScrollView>(null);

  const onScroll = useAnimatedScrollHandler((event) => {
    x.value = event.contentOffset.x;
  });

  function finish() {
    setOnboarded();
    router.replace(useCustomerStore.getState().hasSession ? "/home" : "/welcome");
  }

  function next() {
    if (index >= slides.length - 1) {
      finish();
      return;
    }
    const following = index + 1;
    scroller.current?.scrollTo({ x: following * width, animated: true });
    setIndex(following);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070707" }}>
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {slides.map((slide) => (
          <View key={slide.key} style={{ width, height }}>
            <Image source={slide.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "68%" }}>
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={`fade-${slide.key}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#070707" stopOpacity="0" />
                    <Stop offset="0.42" stopColor="#070707" stopOpacity="0.28" />
                    <Stop offset="1" stopColor="#070707" stopOpacity="0.94" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#fade-${slide.key})`} />
              </Svg>
            </View>
            <View style={{ position: "absolute", left: 24, right: 24, bottom: insets.bottom + 132 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 34, lineHeight: 40, fontWeight: "800" }}>{slide.title}</Text>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 17, lineHeight: 26, marginTop: 10 }}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </Animated.ScrollView>
      <View style={{ position: "absolute", top: insets.top + 8, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable accessibilityRole="button" onPress={finish} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Skip</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === "dark" ? "Light mode" : "Dark mode"}
          onPress={() => setMode(mode === "dark" ? "light" : "dark")}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)" }}
        >
          <Ionicons name={mode === "dark" ? "sunny-outline" : "moon-outline"} size={22} color="#1A140C" />
        </Pressable>
      </View>
      <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 12, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          {slides.map((slide, dot) => (
            <Dot key={slide.key} index={dot} page={width} x={x} />
          ))}
        </View>
        <Button label={index === slides.length - 1 ? "Get Started" : "Next"} onPress={next} />
      </View>
    </View>
  );
}

function Dot({ index, page, x }: { index: number; page: number; x: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const width = interpolate(x.value, [(index - 1) * page, index * page, (index + 1) * page], [8, 22, 8], Extrapolation.CLAMP);
    return { width };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 8, backgroundColor: "#FFFFFF" }, style]} />;
}
