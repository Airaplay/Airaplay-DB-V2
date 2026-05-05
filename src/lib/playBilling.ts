import { Capacitor } from '@capacitor/core';

/** Fields needed by `verify-google-play-purchase` after a consumable purchase. */
export interface GooglePlayPurchaseResult {
  purchaseToken: string;
  productId: string;
  orderId: string;
}

interface NativePurchaseTransaction {
  purchaseToken?: string;
  transactionId?: string;
  productIdentifier?: string;
  orderId?: string;
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

  const module = await import('@capgo/native-purchases');
  const { NativePurchases, PURCHASE_TYPE } = module;

  const transaction = (await NativePurchases.purchaseProduct({
    productIdentifier: sku,
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
    isConsumable: true,
    autoAcknowledgePurchases: true,
  })) as NativePurchaseTransaction;

  const purchaseToken = transaction.purchaseToken?.trim() || transaction.transactionId?.trim();
  const productId = transaction.productIdentifier?.trim() || sku;
  const orderId = transaction.orderId?.trim() || transaction.transactionId?.trim();

  if (!purchaseToken || !productId || !orderId) {
    throw new Error(
      `Google Play purchase succeeded but required verification fields are missing for "${sku}".`
    );
  }

  return {
    purchaseToken,
    productId,
    orderId,
  };
}
