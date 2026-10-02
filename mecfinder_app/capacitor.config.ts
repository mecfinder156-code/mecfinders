import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mecfinder.app',
  appName: 'Mecfinders App',
  webDir: 'out',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['phone']
    }
  },
  server: {
    cleartext: true
  }
};

export default config;
