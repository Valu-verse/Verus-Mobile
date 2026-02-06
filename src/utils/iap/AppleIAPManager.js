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
    clearTransactionIOS,
} from 'react-native-iap';
import ValuProvider from '../services/ValuProvider';

// Product ID for Valu Proof of Personhood attestation (configure in App Store Connect)
export const VALU_POP_PRODUCT_ID = 'valuPoP.mobile';

class AppleIAPManager {
    constructor() {
        this.isConnected = false;
        this.purchaseUpdateSubscription = null;
        this.purchaseErrorSubscription = null;
        this.currentPurchaseResolver = null;
        this.currentPurchaseRejecter = null;
        this.invoiceNumber = null;
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
            
            // Clear any pending transactions from previous sessions
            await this.clearPendingTransactions();
            
            return true;
        } catch (error) {
            console.error('AppleIAPManager: Failed to initialize connection', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Clear any pending/unfinished transactions
     */
    async clearPendingTransactions() {
        if (Platform.OS !== 'ios') return;
        
        try {
            await clearTransactionIOS();
            console.log('AppleIAPManager: Cleared pending transactions');
        } catch (error) {
            console.log('AppleIAPManager: No pending transactions to clear', error);
        }
    }

    /**
     * Setup purchase listeners for handling purchase updates
     * @param {Function} onPurchaseSuccess - Callback for successful purchase
     * @param {Function} onPurchaseError - Callback for purchase errors
     */
    setupListeners(onPurchaseSuccess, onPurchaseError) {
        // Remove existing listeners if any
        this.removeListeners();

        this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
            console.log('AppleIAPManager: Purchase update received', purchase);
            
            if (purchase && purchase.transactionReceipt) {
                try {
                    // Verify the purchase with Valu server
                    const verificationResult = await this.verifyAndConfirmPurchase(purchase);
                    
                    if (verificationResult.success) {
                        // Finish the transaction to acknowledge it
                        // Non-consumable: isConsumable = false
                        await finishTransaction({ purchase, isConsumable: false });
                        
                        if (this.currentPurchaseResolver) {
                            this.currentPurchaseResolver(verificationResult);
                        }
                        if (onPurchaseSuccess) {
                            onPurchaseSuccess(verificationResult);
                        }
                    } else {
                        throw new Error(verificationResult.error || 'Purchase verification failed');
                    }
                } catch (error) {
                    console.error('AppleIAPManager: Error processing purchase', error);
                    
                    if (this.currentPurchaseRejecter) {
                        this.currentPurchaseRejecter(error);
                    }
                    if (onPurchaseError) {
                        onPurchaseError(error);
                    }
                }
            }
        });

        this.purchaseErrorSubscription = purchaseErrorListener((error) => {
            console.error('AppleIAPManager: Purchase error', error);
            
            if (this.currentPurchaseRejecter) {
                this.currentPurchaseRejecter(error);
            }
            if (onPurchaseError) {
                onPurchaseError(error);
            }
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
            console.log('AppleIAPManager: Products details:', JSON.stringify(products, null, 2));
            
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
            
            this.invoiceNumber = response.data.invoiceNumber;
            console.log('AppleIAPManager: Payment session initiated, invoice:', this.invoiceNumber);
            
            return {
                invoiceNumber: this.invoiceNumber,
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

        return new Promise(async (resolve, reject) => {
            this.currentPurchaseResolver = resolve;
            this.currentPurchaseRejecter = reject;
            this.invoiceNumber = invoiceNumber;

            try {
                // Setup listeners before requesting purchase
                this.setupListeners(
                    (result) => {
                        this.currentPurchaseResolver = null;
                        this.currentPurchaseRejecter = null;
                    },
                    (error) => {
                        this.currentPurchaseResolver = null;
                        this.currentPurchaseRejecter = null;
                    }
                );

                // Request the purchase
                // The applicationUsername helps link the purchase to our invoice
                await requestPurchase({
                    sku: VALU_POP_PRODUCT_ID,
                    andDangerouslyFinishTransactionAutomaticallyIOS: false,
                    appAccountToken: invoiceNumber, // Links purchase to our invoice
                });
            } catch (error) {
                console.error('AppleIAPManager: Failed to request purchase', error);
                this.currentPurchaseResolver = null;
                this.currentPurchaseRejecter = null;
                reject(error);
            }
        });
    }

    /**
     * Verify and confirm purchase with Valu server
     * @param {Object} purchase - Purchase object from IAP
     */
    async verifyAndConfirmPurchase(purchase) {
        try {
            const response = await ValuProvider.confirmIAPPayment({
                invoiceNumber: this.invoiceNumber,
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
            const product = await this.getProduct();
            console.log('AppleIAPManager: Product verified:', product.productId, 'Price:', product.localizedPrice);

            // Step 3: Initiate payment session with Valu server
            const session = await this.initiatePaymentSession();
            
            // Step 4: Purchase the product
            const purchaseResult = await this.purchaseProduct(session.invoiceNumber);
            
            return purchaseResult;
        } catch (error) {
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
