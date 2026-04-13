/**
 * AppleIAPManager - Handles Apple In-App Purchases for iOS
 * 
 * This module manages the IAP lifecycle for purchasing the Valu Proof of Personhood attestation.
 * It handles:
 * - IAP connection and product fetching
 * - Purchase flow with transaction verification
 * - Server notification of successful purchases
 */
import { Platform } from 'react-native';
import {
    initConnection,
    endConnection,
    getProducts,
    requestPurchase,
    finishTransaction,
    purchaseUpdatedListener,
    purchaseErrorListener,
    getAvailablePurchases,
} from 'react-native-iap';
import ValuProvider from '../services/ValuProvider';

// Product ID for Valu Proof of Personhood attestation (configure in App Store Connect)
export const VALU_POP_PRODUCT_ID = 'valu.arkeytyp.pop';

// Timeout for the purchase flow (5 minutes)
const PURCHASE_TIMEOUT_MS = 5 * 60 * 1000;

class AppleIAPManager {
    constructor() {
        this.isConnected = false;
        this.purchaseUpdateSubscription = null;
        this.purchaseErrorSubscription = null;
        this.currentPurchaseResolver = null;
        this.currentPurchaseRejecter = null;
        this.invoiceNumber = null;
        this._purchaseTimeout = null;
    }

    /**
     * Initialize IAP connection
     * Must be called before any IAP operations
     */
    async initialize() {
        if (Platform.OS !== 'ios') {
            console.log('AppleIAPManager: Not iOS, skipping initialization');
            return false;
        }

        try {
            const result = await initConnection();
            this.isConnected = true;
            console.log('AppleIAPManager: Connection initialized', result);
            return true;
        } catch (error) {
            console.error('AppleIAPManager: Failed to initialize connection', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Setup purchase listeners for handling purchase updates.
     * The invoiceNumber is passed explicitly to avoid stale singleton state.
     */
    setupListeners(invoiceNumber) {
        // Remove existing listeners if any
        this.removeListeners();

        this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
            console.log('AppleIAPManager: Purchase update received', purchase);
            
            if (purchase && purchase.transactionReceipt) {
                try {
                    // Verify the purchase with Valu server
                    const verificationResult = await this.verifyAndConfirmPurchase(purchase, invoiceNumber);
                    
                    if (verificationResult.success) {
                        // Resolve the Promise first — payment is confirmed server-side
                        if (this.currentPurchaseResolver) {
                            this.currentPurchaseResolver(verificationResult);
                            this.currentPurchaseResolver = null;
                            this.currentPurchaseRejecter = null;
                        }
                        this._clearPurchaseTimeout();

                        // Finish the transaction best-effort; Apple re-delivers if this fails
                        try {
                            await finishTransaction({ purchase, isConsumable: false });
                        } catch (finishError) {
                            console.warn('AppleIAPManager: finishTransaction failed, Apple will re-deliver', finishError);
                        }
                    } else {
                        throw new Error(verificationResult.error || 'Purchase verification failed');
                    }
                } catch (error) {
                    console.error('AppleIAPManager: Error processing purchase', error);
                    
                    if (this.currentPurchaseRejecter) {
                        this.currentPurchaseRejecter(error);
                        this.currentPurchaseResolver = null;
                        this.currentPurchaseRejecter = null;
                    }
                    this._clearPurchaseTimeout();
                }
            }
        });

        this.purchaseErrorSubscription = purchaseErrorListener((error) => {
            console.error('AppleIAPManager: Purchase error', error);
            
            if (this.currentPurchaseRejecter) {
                this.currentPurchaseRejecter(error);
                this.currentPurchaseResolver = null;
                this.currentPurchaseRejecter = null;
            }
            this._clearPurchaseTimeout();
        });
    }

    /**
     * Remove purchase listeners
     */
    removeListeners() {
        if (this.purchaseUpdateSubscription) {
            this.purchaseUpdateSubscription.remove();
            this.purchaseUpdateSubscription = null;
        }
        if (this.purchaseErrorSubscription) {
            this.purchaseErrorSubscription.remove();
            this.purchaseErrorSubscription = null;
        }
    }

    /**
     * Clear the purchase timeout timer
     */
    _clearPurchaseTimeout() {
        if (this._purchaseTimeout) {
            clearTimeout(this._purchaseTimeout);
            this._purchaseTimeout = null;
        }
    }

    /**
     * Get product details for Valu POP attestation
     */
    async getProduct() {
        if (!this.isConnected) {
            await this.initialize();
        }

        try {
            console.log('AppleIAPManager: Requesting product with SKU:', VALU_POP_PRODUCT_ID);
            const products = await getProducts({ skus: [VALU_POP_PRODUCT_ID] });
            console.log('AppleIAPManager: Products fetched, count:', products.length);
            
            if (products.length === 0) {
                throw new Error(`Purchase is not available yet. The product may still be pending review by Apple. Please try again later.`);
            }
            
            return products[0];
        } catch (error) {
            console.error('AppleIAPManager: Failed to get products', error);
            throw error;
        }
    }

    /**
     * Initiate a payment session with Valu server and get invoice number
     * This creates a pending payment record on the server
     */
    async initiatePaymentSession() {
        try {
            const response = await ValuProvider.initiateIAPSession();
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to initiate payment session');
            }
            
            const invoiceNumber = response.data.invoiceNumber;
            console.log('AppleIAPManager: Payment session initiated, invoice:', invoiceNumber);
            
            return {
                invoiceNumber,
                ...response.data
            };
        } catch (error) {
            console.error('AppleIAPManager: Failed to initiate payment session', error);
            throw error;
        }
    }

    /**
     * Purchase the Valu POP attestation product
     * @param {string} invoiceNumber - Invoice number from initiatePaymentSession
     * @returns {Promise} - Resolves with purchase result
     */
    async purchaseProduct(invoiceNumber) {
        if (!this.isConnected) {
            await this.initialize();
        }

        // Guard against concurrent purchases
        if (this.currentPurchaseResolver) {
            throw new Error('A purchase is already in progress');
        }

        // Use deferred pattern to avoid async Promise executor anti-pattern
        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });

        this.currentPurchaseResolver = resolve;
        this.currentPurchaseRejecter = reject;
        this.invoiceNumber = invoiceNumber;

        // Setup listeners before requesting purchase, passing invoiceNumber explicitly
        this.setupListeners(invoiceNumber);

        // Set a timeout so the UI doesn't hang forever
        this._purchaseTimeout = setTimeout(() => {
            if (this.currentPurchaseRejecter) {
                this.currentPurchaseRejecter(new Error('Purchase timed out. Please try again.'));
                this.currentPurchaseResolver = null;
                this.currentPurchaseRejecter = null;
                this.removeListeners();
            }
        }, PURCHASE_TIMEOUT_MS);

        try {
            // Request the purchase
            // The appAccountToken helps link the purchase to our invoice
            await requestPurchase({
                sku: VALU_POP_PRODUCT_ID,
                andDangerouslyFinishTransactionAutomaticallyIOS: false,
                appAccountToken: invoiceNumber,
            });
        } catch (error) {
            console.error('AppleIAPManager: Failed to request purchase', error);
            this.currentPurchaseResolver = null;
            this.currentPurchaseRejecter = null;
            this._clearPurchaseTimeout();
            this.removeListeners();
            reject(error);
        }

        return promise;
    }

    /**
     * Verify and confirm purchase with Valu server
     * @param {Object} purchase - Purchase object from IAP
     * @param {string} invoiceNumber - Invoice number for this purchase
     */
    async verifyAndConfirmPurchase(purchase, invoiceNumber) {
        try {
            const response = await ValuProvider.confirmIAPPayment({
                invoiceNumber,
                transactionId: purchase.transactionId,
                transactionReceipt: purchase.transactionReceipt,
                productId: purchase.productId,
                originalTransactionId: purchase.originalTransactionIdentifierIOS,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to confirm payment with server');
            }

            console.log('AppleIAPManager: Payment confirmed with server', response);
            return response;
        } catch (error) {
            console.error('AppleIAPManager: Failed to confirm payment', error);
            throw error;
        }
    }

    /**
     * Complete purchase flow - initiates session and purchases product
     * This is the main method to call for purchasing
     */
    async completePurchaseFlow() {
        if (Platform.OS !== 'ios') {
            throw new Error('Apple IAP is only available on iOS');
        }

        try {
            // Step 1: Initialize connection
            await this.initialize();

            // Step 2: Verify product is available BEFORE initiating payment session
            console.log('AppleIAPManager: Verifying product availability...');
            await this.getProduct();

            // Step 3: Initiate payment session with Valu server
            const session = await this.initiatePaymentSession();
            
            // Step 4: Purchase the product
            const purchaseResult = await this.purchaseProduct(session.invoiceNumber);
            
            return purchaseResult;
        } catch (error) {
            // Clean up listeners on any failure in the flow
            this.removeListeners();
            this._clearPurchaseTimeout();
            console.error('AppleIAPManager: Purchase flow failed', error);
            throw error;
        }
    }

    /**
     * Restore previous purchases (if needed for non-consumable products)
     */
    async restorePurchases() {
        if (!this.isConnected) {
            await this.initialize();
        }

        try {
            const purchases = await getAvailablePurchases();
            console.log('AppleIAPManager: Available purchases', purchases);
            return purchases;
        } catch (error) {
            console.error('AppleIAPManager: Failed to restore purchases', error);
            throw error;
        }
    }

    /**
     * Cleanup - call when done with IAP operations
     */
    async cleanup() {
        this.removeListeners();
        this._clearPurchaseTimeout();

        // Reject any in-flight purchase so the caller's await doesn't hang
        if (this.currentPurchaseRejecter) {
            this.currentPurchaseRejecter(new Error('IAP manager cleaned up'));
        }
        this.currentPurchaseResolver = null;
        this.currentPurchaseRejecter = null;
        this.invoiceNumber = null;
        
        if (this.isConnected) {
            try {
                await endConnection();
                this.isConnected = false;
                console.log('AppleIAPManager: Connection ended');
            } catch (error) {
                console.error('AppleIAPManager: Error ending connection', error);
            }
        }
    }
}

// Export a singleton instance
export default new AppleIAPManager();
