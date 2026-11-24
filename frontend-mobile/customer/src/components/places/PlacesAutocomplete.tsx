import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  GooglePlacesAutocomplete,
  type GooglePlacesAutocompleteRef,
  type GooglePlaceData,
  type GooglePlaceDetail,
} from "react-native-google-places-autocomplete";
import { placesKey } from "../../lib/api";
import type { Place } from "../../lib/places";
import { usePalette } from "../../theme/Theme";

type Props = {
  placeholder: string;
  autoFocus?: boolean;
  origin?: { latitude: number; longitude: number } | null;
  predefined?: Place[];
  onPlace: (place: Place) => void;
};

export function PlacesAutocomplete({ placeholder, autoFocus, origin, predefined = [], onPlace }: Props) {
  const palette = usePalette();
  const ref = useRef<GooglePlacesAutocompleteRef>(null);
  const presets = useMemo(
    () =>
      predefined
        .filter((place) => place.label && Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
        .slice(0, 6)
        .map((place) => ({
          description: place.label,
          geometry: { location: { lat: place.latitude, lng: place.longitude } },
        })),
    [predefined],
  );

  function pick(data: GooglePlaceData, details: GooglePlaceDetail | null) {
    const lat = details?.geometry?.location?.lat;
    const lng = details?.geometry?.location?.lng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onPlace({
      id: data.place_id || `plc_${Math.random().toString(36).slice(2, 8)}`,
      /** Keep the autocomplete row text the customer tapped — not a rewritten formatted address. */
      label: data.description || details?.formatted_address || details?.name || "Selected place",
      latitude: lat,
      longitude: lng,
    });
  }

  if (!placesKey) {
    return <View style={{ minHeight: 48 }} />;
  }

  return (
    <GooglePlacesAutocomplete
      ref={ref}
      placeholder={placeholder}
      fetchDetails
      enablePoweredByContainer={false}
      keyboardShouldPersistTaps="handled"
      keepResultsAfterBlur={false}
      debounce={280}
      minLength={2}
      predefinedPlaces={presets}
      predefinedPlacesAlwaysVisible={presets.length > 0}
      onPress={pick}
      query={{
        key: placesKey,
        language: "en",
        components: "country:ng",
        location: origin ? `${origin.latitude},${origin.longitude}` : "9.0765,7.3986",
        radius: "80000",
      }}
      textInputProps={{
        autoFocus,
        placeholderTextColor: palette.muted,
        returnKeyType: "search",
        clearButtonMode: "while-editing",
      }}
      styles={{
        container: { flex: 0, zIndex: 20 },
        textInputContainer: {
          backgroundColor: "transparent",
          paddingHorizontal: 0,
          paddingVertical: 0,
        },
        textInput: {
          height: 40,
          marginBottom: 0,
          marginTop: 0,
          paddingHorizontal: 0,
          backgroundColor: "transparent",
          color: palette.ink,
          fontSize: 16,
          fontWeight: "700",
        },
        listView: {
          backgroundColor: palette.paper,
          borderRadius: 16,
          marginTop: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.line,
          maxHeight: 280,
        },
        row: {
          backgroundColor: palette.paper,
          paddingVertical: 12,
          paddingHorizontal: 12,
        },
        separator: { backgroundColor: palette.line, height: StyleSheet.hairlineWidth },
        description: { color: palette.ink, fontWeight: "600" },
        predefinedPlacesDescription: { color: palette.accent, fontWeight: "700" },
      }}
    />
  );
}

export function placesAutocompleteReady() {
  return placesKey.length > 0;
}
