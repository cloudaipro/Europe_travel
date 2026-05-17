import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cloudaipro.tourcompanion",
  appName: "TourCompanion",
  webDir: "www",
  server: {
    androidScheme: "https"
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      overlaysWebView: false,
      backgroundColor: "#0e0f12"
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0e0f12",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
