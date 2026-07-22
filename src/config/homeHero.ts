/**
 * Same default hero as web (`road/src/config/heroImages.ts` → HERO.home).
 * Optional override: EXPO_PUBLIC_HOME_HERO_URL in .env
 */
const GCS = 'https://storage.googleapis.com/images-road/ui-heroes';

const fromEnv = process.env.EXPO_PUBLIC_HOME_HERO_URL?.trim();

export const HOME_HERO_IMAGE_URI =
  fromEnv && fromEnv.length > 0 ? fromEnv : `${GCS}/home-hero-marketplace-combined.jpg`;
