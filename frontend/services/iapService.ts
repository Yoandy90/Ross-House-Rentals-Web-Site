/**
 * In-App Purchase Service for iOS & Android
 * Uses expo-iap (modern replacement for expo-in-app-purchases)
 * Handles subscription and credit purchases through Apple StoreKit / Google Play Billing
 */
import { Platform, Alert } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import api from './api';

// Event names for global notifications
export const IAP_BALANCE_UPDATED_EVENT = 'IAP_BALANCE_UPDATED';
export const IAP_SUBSCRIPTION_UPDATED_EVENT = 'IAP_SUBSCRIPTION_UPDATED';

// Product IDs - Must match App Store Connect / Google Play Console
export const IAP_PRODUCT_IDS = {
  // Subscription Plans (Auto-Renewable)
  BASIC_MONTHLY: 'com.rosstax.plan.basic.monthly',
  PROFESSIONAL_MONTHLY: 'com.rosstax.plan.professional.monthly',
  RECEIPTS_PRO_MONTHLY: 'com.rosstax.plan.receipts.monthly',
  // Credit Packages (Consumables)
  CREDITS_50: 'com.rosstax.credits.50',
  CREDITS_100: 'com.rosstax.credits.100',
  CREDITS_200: 'com.rosstax.credits.200',
  CREDITS_500: 'com.rosstax.credits.500',
};

// All subscription product IDs
const SUBSCRIPTION_PRODUCT_IDS = [
  IAP_PRODUCT_IDS.BASIC_MONTHLY,
  IAP_PRODUCT_IDS.PROFESSIONAL_MONTHLY,
  IAP_PRODUCT_IDS.RECEIPTS_PRO_MONTHLY,
];

// All credit product IDs
const CREDIT_PRODUCT_IDS = [
  IAP_PRODUCT_IDS.CREDITS_50,
  IAP_PRODUCT_IDS.CREDITS_100,
  IAP_PRODUCT_IDS.CREDITS_200,
  IAP_PRODUCT_IDS.CREDITS_500,
];

// Credit packages configuration (1 credit = $1 USD)
export const CREDIT_PACKAGES = [
  { id: 'CREDITS_50', productId: 'com.rosstax.credits.50', credits: 50, price: 49.99, bonus: 0 },
  { id: 'CREDITS_100', productId: 'com.rosstax.credits.100', credits: 100, price: 99.99, bonus: 0 },
  { id: 'CREDITS_200', productId: 'com.rosstax.credits.200', credits: 200, price: 199.99, bonus: 0 },
  { id: 'CREDITS_500', productId: 'com.rosstax.credits.500', credits: 500, price: 499.99, bonus: 0 },
];

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  subscriptionPeriod?: string;
  localizedPrice?: string;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  error?: string;
  credits?: number;
}

type PurchaseCallback = (success: boolean, creditsAdded?: number) => void;

class IAPService {
  private isConnected: boolean = false;
  private products: IAPProduct[] = [];
  private ExpoIAP: any = null;
  private onPurchaseComplete: PurchaseCallback | null = null;
  private isSyncing = false;
  private lastSyncTime = 0;
  private syncedTransactions = new Set<string>();

  constructor() {
    // Try to load expo-iap dynamically (won't be available in Expo Go or web)
    try {
      this.ExpoIAP = require('expo-iap');
      console.log('IAP: expo-iap module loaded successfully');
    } catch (e) {
      console.log('IAP: expo-iap not available (Expo Go or web environment)');
      this.ExpoIAP = null;
    }
  }

  setOnPurchaseComplete(callback: PurchaseCallback | null): void {
    this.onPurchaseComplete = callback;
  }

  private notifyPurchaseComplete(success: boolean, creditsAdded?: number, isSubscription?: boolean): void {
    if (this.onPurchaseComplete) {
      this.onPurchaseComplete(success, creditsAdded);
    }
    if (success) {
      console.log('IAP: Emitting purchase events...', { creditsAdded, isSubscription });
      DeviceEventEmitter.emit(IAP_BALANCE_UPDATED_EVENT, { creditsAdded });
      if (isSubscription) {
        DeviceEventEmitter.emit(IAP_SUBSCRIPTION_UPDATED_EVENT, {});
      }
    }
  }

  /**
   * Initialize the IAP connection
   */
  async initialize(): Promise<boolean> {
    if (!this.ExpoIAP) {
      console.log('IAP: Module not available, skipping initialization');
      return false;
    }

    try {
      if (this.isConnected && this.products.length > 0) {
        console.log('IAP: Already connected with products, reusing');
        return true;
      }

      console.log('IAP: Connecting to store via expo-iap...');
      await this.ExpoIAP.initConnection();
      this.isConnected = true;
      console.log('IAP: Connected successfully');

      // Pre-load products
      console.log('IAP: Pre-loading products...');
      await this.getProducts();

      return true;
    } catch (error: any) {
      console.error('IAP: Failed to connect:', error);
      // Try recovery
      try {
        console.log('IAP: Attempting recovery...');
        try { await this.ExpoIAP.endConnection(); } catch (_e) {}
        await this.ExpoIAP.initConnection();
        this.isConnected = true;
        await this.getProducts();
        console.log('IAP: Recovery successful');
        return true;
      } catch (recoveryError) {
        console.error('IAP: Recovery also failed:', recoveryError);
        this.isConnected = false;
        return false;
      }
    }
  }

  /**
   * Force reconnect to the store
   */
  async reconnect(): Promise<boolean> {
    console.log('IAP: Force reconnecting...');
    if (!this.ExpoIAP) return false;

    try {
      if (this.isConnected) {
        try { await this.ExpoIAP.endConnection(); } catch (_e) {}
      }
      this.isConnected = false;
      this.products = [];
      return this.initialize();
    } catch (error) {
      console.error('IAP: Reconnect failed:', error);
      return false;
    }
  }

  /**
   * Soft connect - reuse existing connection
   */
  async ensureConnected(): Promise<boolean> {
    if (this.isConnected && this.products.length > 0) {
      return true;
    }
    return this.initialize();
  }

  /**
   * Get available products from the store
   */
  async getProducts(): Promise<IAPProduct[]> {
    if (!this.ExpoIAP) return [];
    if (!this.isConnected) await this.initialize();

    try {
      // Fetch subscriptions
      console.log('IAP: Fetching subscription products...');
      const subs = await this.ExpoIAP.getProducts({
        skus: SUBSCRIPTION_PRODUCT_IDS,
        type: 'subs',
      }).catch((e: any) => {
        console.log('IAP: Subscription fetch error (may not be available yet):', e.message);
        return [];
      });

      // Fetch consumables
      console.log('IAP: Fetching consumable products...');
      const consumables = await this.ExpoIAP.getProducts({
        skus: CREDIT_PRODUCT_IDS,
        type: 'inapp',
      }).catch((e: any) => {
        console.log('IAP: Consumable fetch error:', e.message);
        return [];
      });

      const allProducts = [...(subs || []), ...(consumables || [])];

      this.products = allProducts.map((product: any) => ({
        productId: product.productId || product.id,
        title: product.title || product.name || '',
        description: product.description || '',
        price: product.localizedPrice || product.price || '',
        priceAmountMicros: product.priceAmountMicros || 0,
        priceCurrencyCode: product.currency || product.priceCurrencyCode || 'USD',
        subscriptionPeriod: product.subscriptionPeriod || undefined,
        localizedPrice: product.localizedPrice || product.price || '',
      }));

      console.log('IAP: Products loaded:', this.products.length, this.products.map(p => p.productId));
      return this.products;
    } catch (error) {
      console.error('IAP: Failed to get products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(productId: string): Promise<PurchaseResult> {
    if (!this.ExpoIAP) {
      return { success: false, error: 'In-App Purchases no disponible en este dispositivo' };
    }

    if (!this.isConnected) await this.initialize();

    try {
      console.log('IAP: Starting subscription purchase for:', productId);

      const purchase = await this.ExpoIAP.requestPurchase({
        request: {
          apple: { sku: productId },
          google: { skus: [productId] },
        },
        type: 'subs',
      });

      console.log('IAP: Purchase response received:', JSON.stringify(purchase));

      if (purchase) {
        // Verify with backend
        await this.verifyAndFinishPurchase(purchase, false);
        return { success: true, productId, transactionId: purchase.transactionId };
      }

      // If no purchase returned, it might come through later or user cancelled
      // Try syncing after a delay
      this.scheduleSyncAfterPurchase();
      return { success: true, productId };
    } catch (error: any) {
      console.error('IAP: Subscription purchase failed:', error);

      // Check if user cancelled
      if (error.code === 'E_USER_CANCELLED' || error.message?.includes('cancel')) {
        return { success: false, error: 'Compra cancelada' };
      }

      // Try syncing — user might already be subscribed
      this.scheduleSyncAfterPurchase();

      return {
        success: false,
        error: error.message || 'La compra no se pudo completar',
      };
    }
  }

  /**
   * Purchase credits package (consumable)
   */
  async purchaseCredits(productId: string): Promise<PurchaseResult> {
    console.log('IAP: Purchasing credits:', productId);

    if (!this.ExpoIAP) {
      return { success: false, error: 'In-App Purchases no disponible en este dispositivo' };
    }

    let initialized = await this.ensureConnected();
    if (!initialized) {
      initialized = await this.reconnect();
    }
    if (!initialized) {
      return { success: false, error: 'No se pudo conectar con la App Store. Cierra la app y vuelve a abrirla.' };
    }

    // Verify product exists
    if (this.products.length === 0) await this.getProducts();
    const product = this.products.find(p => p.productId === productId);
    if (!product) {
      console.log('IAP: Product not found:', productId, 'Available:', this.products.map(p => p.productId));
      return { success: false, error: 'Producto no disponible. Verifica tu conexión e intenta de nuevo.' };
    }

    try {
      console.log('IAP: Starting credit purchase for:', productId, 'Price:', product.price);

      const purchase = await this.ExpoIAP.requestPurchase({
        request: {
          apple: { sku: productId },
          google: { skus: [productId] },
        },
        type: 'inapp',
      });

      console.log('IAP: Credit purchase response:', JSON.stringify(purchase));

      if (purchase) {
        await this.verifyAndFinishPurchase(purchase, true);
        return { success: true, productId, transactionId: purchase.transactionId };
      }

      return { success: true, productId };
    } catch (error: any) {
      console.error('IAP: Credit purchase failed:', error);
      this.isConnected = false;

      if (error.code === 'E_USER_CANCELLED' || error.message?.includes('cancel')) {
        return { success: false, error: 'Compra cancelada' };
      }

      return {
        success: false,
        error: error.message || 'La compra no se pudo completar. Intenta de nuevo.',
      };
    }
  }

  /**
   * Verify purchase with backend and finish transaction
   */
  private async verifyAndFinishPurchase(purchase: any, isConsumable: boolean): Promise<void> {
    const transactionId = purchase.transactionId || purchase.originalTransactionId || purchase.transactionIdentifier;
    const productId = purchase.productId;

    if (!productId) {
      console.error('IAP: Missing productId in purchase', purchase);
      return;
    }

    const finalTransactionId = transactionId || `iap_${Date.now()}_${productId}`;
    const isCredits = productId?.includes('credits') || false;

    console.log('IAP: Verifying purchase with backend...', { productId, transactionId: finalTransactionId });

    try {
      const payload = {
        productId,
        transactionId: finalTransactionId,
        transactionReceipt: purchase.transactionReceipt || purchase.receipt || '',
        purchaseTime: purchase.purchaseTime || purchase.transactionDate || Date.now(),
        type: isCredits ? 'credits' : 'subscription',
      };

      const response = await api.post('/payments/verify-apple-purchase', payload);
      console.log('IAP: Backend response:', JSON.stringify(response.data));

      if (response.data.success) {
        console.log('IAP: Purchase verified successfully');

        // Finish the transaction with Apple/Google
        try {
          await this.ExpoIAP.finishTransaction({ purchase, isConsumable });
          console.log('IAP: Transaction finished with store');
        } catch (finishError: any) {
          console.error('IAP: Error finishing transaction (non-critical):', finishError);
        }

        const isSubscription = response.data.type === 'subscription';
        const creditsAdded = response.data.credits_added || 0;
        this.notifyPurchaseComplete(true, creditsAdded, isSubscription);

        if (response.data.already_processed) {
          Alert.alert('Compra Restaurada', 'Esta compra ya fue procesada anteriormente.', [{ text: 'OK' }]);
        } else if (isCredits && response.data.credits_added) {
          Alert.alert('¡Créditos Agregados!', `Se han agregado ${response.data.credits_added} créditos a tu cuenta.`, [{ text: 'OK' }]);
        } else {
          Alert.alert('¡Suscripción Activada!', 'Tu suscripción ha sido activada exitosamente. ¡Gracias por tu compra!', [{ text: 'OK' }]);
        }
      } else {
        console.error('IAP: Backend verification failed', response.data);
        this.notifyPurchaseComplete(false);
        Alert.alert('Error', response.data.detail || 'No se pudo verificar tu compra. Contacta soporte.');
      }
    } catch (error: any) {
      console.error('IAP: Backend verification error:', error.message, error.response?.data);
      const errorMessage = error.response?.data?.detail || error.message || 'No se pudo verificar la compra.';
      Alert.alert('Error de Verificación', `${errorMessage} Contacta soporte.`, [{ text: 'OK' }]);
    }
  }

  /**
   * Silent verify (for background sync/restore)
   */
  private async verifyPurchaseSilent(purchase: any): Promise<void> {
    const transactionId = purchase.transactionId || purchase.originalTransactionId || purchase.transactionIdentifier;
    const productId = purchase.productId;
    if (!productId) return;

    const finalTransactionId = transactionId || `sandbox_${Date.now()}_${productId}`;
    const isCredits = productId?.includes('credits') || false;

    try {
      await api.post('/payments/verify-apple-purchase', {
        productId,
        transactionId: finalTransactionId,
        transactionReceipt: purchase.transactionReceipt || purchase.receipt || '',
        purchaseTime: purchase.purchaseTime || purchase.transactionDate || Date.now(),
        type: isCredits ? 'credits' : 'subscription',
      });
      console.log('IAP: Silent sync successful for', productId);
    } catch (error: any) {
      if (error.response?.status !== 409) {
        console.log('IAP: Silent sync error:', error.message);
      }
    }
  }

  /**
   * Schedule a sync after purchase attempt (delayed)
   */
  private scheduleSyncAfterPurchase(): void {
    if (!this.isSyncing) {
      setTimeout(async () => {
        try {
          console.log('IAP: Syncing subscription state after purchase...');
          await this.syncSubscriptionsWithBackend(true);
        } catch (syncError) {
          console.log('IAP: Post-purchase sync failed:', syncError);
        }
      }, 3000);
    }
  }

  /**
   * Sync all active subscriptions from Apple/Google to backend
   */
  async syncSubscriptionsWithBackend(silent: boolean = false): Promise<void> {
    if (!this.ExpoIAP) return;

    const now = Date.now();
    if (this.isSyncing || (now - this.lastSyncTime) < 30000) {
      console.log('IAP: Skipping sync - already syncing or synced recently');
      return;
    }

    this.isSyncing = true;
    this.lastSyncTime = now;

    try {
      console.log('IAP: Getting available purchases...');
      const purchases = await this.ExpoIAP.getAvailablePurchases();

      if (purchases && purchases.length > 0) {
        console.log('IAP: Found', purchases.length, 'purchases');

        const subscriptionPurchases = purchases.filter((p: any) =>
          p.productId?.includes('plan') ||
          p.productId?.includes('subscription') ||
          p.productId?.includes('monthly') ||
          p.productId?.includes('yearly')
        );

        let newSubscriptionSynced = false;

        for (const purchase of subscriptionPurchases) {
          const transactionKey = `${purchase.productId}_${purchase.transactionId}`;
          if (this.syncedTransactions.has(transactionKey)) continue;

          try {
            await this.verifyPurchaseSilent(purchase);
            this.syncedTransactions.add(transactionKey);
            newSubscriptionSynced = true;
          } catch (verifyError) {
            console.log('IAP: Error syncing subscription:', verifyError);
          }
        }

        if (newSubscriptionSynced && !silent) {
          this.notifyPurchaseComplete(false, subscriptionPurchases[0]?.productId);
        }
      }
    } catch (error) {
      console.error('IAP: Error syncing subscriptions:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(showAlerts: boolean = true): Promise<PurchaseResult> {
    if (!this.ExpoIAP) {
      return { success: false, error: 'In-App Purchases no disponible' };
    }
    if (!this.isConnected) await this.initialize();

    try {
      console.log('IAP: Restoring purchases... (showAlerts:', showAlerts, ')');
      const purchases = await this.ExpoIAP.getAvailablePurchases();

      if (purchases && purchases.length > 0) {
        console.log('IAP: Found', purchases.length, 'purchases to restore');

        purchases.forEach((p: any, i: number) => {
          console.log(`IAP: Purchase ${i}: ${p.productId}, txn: ${p.transactionId}`);
        });

        // Separate subscriptions and credits
        const subscriptionPurchases = purchases.filter((p: any) =>
          p.productId?.includes('plan') ||
          (p.productId?.includes('monthly') && !p.productId?.includes('credits')) ||
          (p.productId?.includes('yearly') && !p.productId?.includes('credits'))
        );

        const creditPurchases = purchases.filter((p: any) =>
          p.productId?.includes('credits')
        );

        let subscriptionRestored = false;
        let creditsRestored = false;

        // Subscriptions: only most recent
        if (subscriptionPurchases.length > 0) {
          const sortedSubs = subscriptionPurchases.sort((a: any, b: any) => {
            const timeA = a.purchaseTime || a.transactionDate || 0;
            const timeB = b.purchaseTime || b.transactionDate || 0;
            return timeB - timeA;
          });

          try {
            await this.verifyPurchaseSilent(sortedSubs[0]);
            subscriptionRestored = true;
          } catch (verifyError) {
            console.log('IAP: Error restoring subscription:', verifyError);
          }
        }

        // Credits: process all
        for (const purchase of creditPurchases) {
          try {
            await this.verifyPurchaseSilent(purchase);
            creditsRestored = true;
          } catch (verifyError) {
            console.log('IAP: Error restoring credit:', verifyError);
          }
        }

        if (subscriptionRestored) {
          this.notifyPurchaseComplete(true, 0, true);
        }
        if (creditsRestored) {
          this.notifyPurchaseComplete(true, 0, false);
        }

        if (showAlerts) {
          Alert.alert('Compras Restauradas', 'Tus compras anteriores han sido restauradas y sincronizadas.');
        }
        return { success: true };
      } else {
        if (showAlerts) {
          Alert.alert('Sin Compras', 'No se encontraron compras anteriores para restaurar.');
        }
        return { success: false, error: 'No purchases found' };
      }
    } catch (error: any) {
      console.error('IAP: Restore failed:', error);
      if (showAlerts) {
        Alert.alert('Error', 'No se pudieron restaurar las compras. Intenta de nuevo.');
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from the store
   */
  async disconnect(): Promise<void> {
    if (this.isConnected && this.ExpoIAP) {
      try {
        await this.ExpoIAP.endConnection();
        this.isConnected = false;
        console.log('IAP: Disconnected');
      } catch (error) {
        console.error('IAP: Failed to disconnect:', error);
      }
    }
  }

  /**
   * Check if IAP is available
   */
  isAvailable(): boolean {
    return this.ExpoIAP !== null;
  }
}

export const iapService = new IAPService();
export default iapService;
