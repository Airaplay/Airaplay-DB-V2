import { Capacitor } from '@capacitor/core';

/** Fields needed by `verify-google-play-purchase` after a consumable purchase. */
export interface GooglePlayPurchaseResult {
  purchaseToken: string;
  productId: string;
  orderId: string;
}

/**
 * Purchase a consumable SKU via Google Play Billing (Android app only).
 * Web bundles include this module; treat checkout hides Google Play on web.
 *
 * When you add a Capacitor IAP plugin (e.g. native purchases), implement the
 * Android branch here and return token + ids for server verification.
 */
export async function purchaseGooglePlayConsumable(sku: string): Promise<GooglePlayPurchaseResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Google Play Billing is only available in the Android app.');
  }

  throw new Error(
    `Google Play Billing is not wired for product "${sku}" in this build. ` +
      'Register a Capacitor in-app purchase plugin and implement purchaseGooglePlayConsumable in src/lib/playBilling.ts.'
  );
}
