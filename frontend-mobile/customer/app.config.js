const appJson = require("./app.json");

const mapsKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "";

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      config: {
        ...(appJson.expo.ios?.config || {}),
        googleMapsApiKey: mapsKey || appJson.expo.ios?.config?.googleMapsApiKey || "",
      },
    },
    android: {
      ...appJson.expo.android,
      config: {
        ...(appJson.expo.android?.config || {}),
        googleMaps: {
          apiKey: mapsKey || appJson.expo.android?.config?.googleMaps?.apiKey || "",
        },
      },
    },
    plugins: (appJson.expo.plugins || []).map((plugin) => {
      if (Array.isArray(plugin) && plugin[0] === "react-native-maps") {
        return [
          "react-native-maps",
          {
            iosGoogleMapsApiKey: mapsKey,
            androidGoogleMapsApiKey: mapsKey,
          },
        ];
      }
      return plugin;
    }),
  },
};
