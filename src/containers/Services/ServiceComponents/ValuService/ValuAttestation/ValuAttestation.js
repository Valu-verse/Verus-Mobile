/*
  ValuAttestation (first-screen UX update)
  - Rename and refocus: Big gradient title "Proof of Personhood" (uses AttestationWidget gradient)
  - Remove header image and blue-heavy styling; neutral copy and layout
  - Update price to $9.99 and improve first-visit explanation
  - Primary button mirrors LandingScreen primary (no glow/shadow)
  - Add "How it works" semi-modal using BuySellSheet modal styling (SemiModal)
  - No pre-start confirmation dialog; rest of flow unchanged
*/
import React, { useEffect, useState, useCallback } from "react"
import { connect, useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { primitives, VerusIdInterface } from "verusid-ts-client"
import { SafeAreaView, ScrollView, View, Linking, AppState, Dimensions, TouchableOpacity } from 'react-native'

import { Divider, List, Button, Text, Portal, Dialog } from 'react-native-paper';
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
import { requestServiceStoredData } from "../../../../../utils/auth/authBox";
import { VERUSID_SERVICE_ID } from "../../../../../utils/constants/services";
import { CoinDirectory } from "../../../../../utils/CoinData/CoinDirectory";
import { openLinkIdentityModal } from "../../../../../actions/actions/sendModal/dispatchers/sendModal";
import { useObjectSelector } from "../../../../../hooks/useObjectSelector";
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { VUSDC } from "../../../../../images/customIcons";
import { requestAttestationData, requestSeeds } from "../../../../../utils/auth/authBox";
import { ATTESTATIONS_PROVISIONED } from "../../../../../utils/constants/attestations";
import { signIdProvisioningRequest } from '../../../../../utils/api/channels/vrpc/requests/signIdProvisioningRequest';
import { NavigationNotification, LoadingNotification } from '../../../../../utils/notification';
import { dispatchAddNotification } from '../../../../../actions/actions/notifications/dispatchers/notifications';
import { NOTIFICATION_ICON_VALU, NOTIFICATION_TYPE_NAVIGATION, NOTIFICATION_ICON_VERUSID } from '../../../../../utils/constants/notifications';
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert';
import { updateDeeplinkUrl } from '../../../../../actions/actionDispatchers';
import {
    VALU_POL_PAYMENT_PENDING, VALU_POL_PAYMENT_RECEIVED, VALU_POL_PAYMENT_STARTED, VALU_POL_PAYMENT_FAILED,
    VALU_POL_IDENTITY_PROVISIONED_PENDING, VALU_POL_IDENTITY_PROVISIONED, VALU_POL_READY, NOTIFICATION_TYPE_VERUSID_PENDING,
    VALU_POL_PENDING, NOTIFICATION_TYPE_VERUSID_READY
} from '../../../../../utils/constants/services';
import AnimatedActivityIndicator from "../../../../../components/AnimatedActivityIndicator";
import ValuProvider from "../../../../../utils/services/ValuProvider";
import { VALU_SERVICE_ID } from "../../../../../utils/constants/services";
import { VALU_SERVICE } from "../../../../../utils/constants/intervalConstants";
import { setServiceLoading } from "../../../../../actions/actionCreators";
import { updatePendingVerusIds } from "../../../../../actions/actions/channels/verusid/dispatchers/VerusidWalletReduxManager"
import { setRequestedVerusId, linkVerusId, deleteProvisionedIds } from '../../../../../actions/actions/services/dispatchers/verusid/verusid';
import { getInfo } from "../../../../../utils/api/channels/vrpc/callCreators";
import { getIdentity } from "../../../../../utils/api/channels/verusid/callCreators";
import { Buffer } from 'buffer';
import { requestPrivKey } from "../../../../../utils/auth/authBox";
import { VRPC } from "../../../../../utils/constants/intervalConstants";
import { sha256 } from "@bitgo/utxo-lib/dist/src/crypto";
import { dispatchRemoveNotification } from '../../../../../actions/actions/notifications/dispatchers/notifications';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText, TSpan } from 'react-native-svg';
import SemiModal from '../../../../../components/SemiModal';


const ValuAttestation = (props) => {
    const activeAccount = useSelector(state => state.authentication.activeAccount);
    const signedIn = useSelector(state => state.authentication.signedIn);
    const verusNetwork = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'VRSCTEST' : 'VRSC';
    const [valuReply, setValuReply] = useState(null);
    const [loading, setLoading] = useState(true); // Start with loading true
    const [status, setStatus] = useState(null); // Start with null instead of empty string
    const [mainButtonText, setMainButtonText] = useState("Get Proof for $9.99");
    const [appState, setAppState] = useState(AppState.currentState);
    const [identityChoiceModalVisible, setIdentityChoiceModalVisible] = useState(false);
    const [existingIdentityModalVisible, setExistingIdentityModalVisible] = useState(false);
    const [linkedIds, setLinkedIds] = useState({});
    const [sortedIds, setSortedIds] = useState({});
    const [isProvisioningIdentity, setIsProvisioningIdentity] = useState(false);
    const [showIdentityProvisioningProgress, setShowIdentityProvisioningProgress] = useState(false);
    const [showPendingIdentityModal, setShowPendingIdentityModal] = useState(false);
    const [pendingIdentityInfo, setPendingIdentityInfo] = useState(null);
    const [howItWorksVisible, setHowItWorksVisible] = useState(false);
    const acchash = useSelector(state =>
        state.authentication.activeAccount
    ).accountHash;
    const systemId = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq' : 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV';
    const notifications = useSelector(state =>
        state.notifications
    );
    const encryptedIds = useObjectSelector(state => state.services.stored[VERUSID_SERVICE_ID]);
    const pendingIds = useSelector(state => state.channelStore_verusid.pendingIds);

    const buttonMessages = {
        [VALU_POL_PAYMENT_STARTED]: "Get Proof for $9.99",
        [VALU_POL_PAYMENT_PENDING]: "RESUME",
        [VALU_POL_PAYMENT_RECEIVED]: "CONTINUE",
        [VALU_POL_PAYMENT_FAILED]: "RETRY",
        [VALU_POL_READY]: "CONTINUE",
        [VALU_POL_IDENTITY_PROVISIONED_PENDING]: "WAIT FOR IDENTITY",
        [VALU_POL_IDENTITY_PROVISIONED]: "CONTINUE",
        [VALU_POL_PENDING]: "CONTINUE",
        "POP_RECEIVED": "Go to Attestations",

    }

    // Navigation reset function similar to DeepLink.js
    const resetToHome = () => {
        let resetAction

        if (signedIn) {
            resetAction = CommonActions.reset({
                index: 0,
                routes: [{ name: 'SignedInStack' }],
            });
        } else {
            resetAction = CommonActions.reset({
                index: 0,
                routes: [{ name: 'SignedOutStack' }],
            });
        }
        props.navigation.dispatch(resetAction);
    }

    // Shared function for new identity provisioning
    const provisionNewIdentity = async (identityName, source = 'identity request') => {
        setIsProvisioningIdentity(true);
        setShowIdentityProvisioningProgress(true);
        try {
            console.log(`Provisioning new identity from ${source}:`, identityName);

            const valuDeepLink = await ValuProvider.getValuIdDeepLink({ identityName, isNew: true });
            if (valuDeepLink.success === false) {
                throw new Error(valuDeepLink.error);
            }

            const loginRequest = primitives.LoginConsentRequest.fromWalletDeeplinkUri(valuDeepLink.data);

            const provisionRequest = new primitives.LoginConsentProvisioningRequest({
                signing_address: activeAccount.keys[verusNetwork].vrpc.addresses[0],
                challenge: new primitives.LoginConsentProvisioningChallenge({
                    challenge_id: loginRequest.challenge.challenge_id,
                    created_at: Number((Date.now() / 1000).toFixed(0)),
                    name: identityName,
                    system_id: loginRequest.system_id,
                    parent: "iQ2TqQot9W7mLrcCRJKnAZmaPTTY6sx4S4" //TODO: change to a variable
                }),
            });

            const signedRequest = await signIdProvisioningRequest(CoinDirectory.findCoinObj(verusNetwork), provisionRequest);

            const valuProvisioningResponse = await ValuProvider.provisionIdentityRequest(signedRequest);

            if (valuProvisioningResponse?.error) {
                throw new Error(valuProvisioningResponse.error);
            }

            console.log("newRep", valuProvisioningResponse);
            
            const response = new primitives.LoginConsentProvisioningResponse(valuProvisioningResponse);

            const {decision} = response;
            const {result} = decision;

            const identityAddress = result?.identity_address;
            const url = result.info_uri;

            const newLoadingNotification = new LoadingNotification();
            newLoadingNotification.body = "";
            await handleProvisioningResponse(newLoadingNotification.uid, identityName, identityAddress, url, loginRequest);

            let formattedName = identityName;
            const lastDotIndex = identityName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                formattedName = identityName.substring(0, lastDotIndex);
            }

            newLoadingNotification.title = [formattedName + '@', ' is being provisioned by ', 'Valuid@'];
            newLoadingNotification.acchash = activeAccount.accountHash;
            newLoadingNotification.icon = NOTIFICATION_ICON_VERUSID;

            dispatchAddNotification(newLoadingNotification);
            setShowIdentityProvisioningProgress(false);
            setIsProvisioningIdentity(false);

            // Instead of navigating home, return the identity info to continue the attestation process
            return { identityName, identityAddress, continueFlow: true };

        } catch (error) {
            console.error(`Error provisioning identity from ${source}:`, error);
            setShowIdentityProvisioningProgress(false);
            setIsProvisioningIdentity(false);
            createAlert(
                'Identity Registration Failed',
                'An error occurred while setting up your identity. ' + error.message,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            resolveAlert();
                            resetToHome();
                        }
                    }
                ],
                { cancelable: false }
            );
        }
        throw error;
    };

    // New function to continue with proof of personhood
    const continueProofOfPersonhood = async (identityInfo) => {
        try {
            setLoading(true);
            console.log("Continuing proof of personhood with identity:", identityInfo);
            // Get the SumSub session URL with the selected identity
            const newRep = await ValuProvider.startSumsubSession({ 
                identityName: identityInfo.identityName, 
                isNew: !identityInfo.isExisting 
            });
            
            if (newRep.success === false) {
                throw new Error(newRep.error);
            }
            
            console.log("Starting SumSub session:", newRep.data);
            
            // Create signature for authentication
            const coinObj = CoinDirectory.findCoinObj(systemId, null, true);
            const chainInfo = await getInfo(systemId);
            const height = chainInfo.result.longestchain;
            const message = `Authentication request for ${identityInfo.identityName} at ${Date.now()}`;
            const messageHash = sha256(Buffer.from(message, 'utf-8'));
            
            // Sign the message using the identity address
            const RAddress = activeAccount.keys[verusNetwork].vrpc.addresses[0];
            const wif = await requestPrivKey(coinObj.id, VRPC);

            const signature = await VerusIdInterface.signHashWithAddress(messageHash, wif);

            console.log("Signature:", signature);

            // Append signature and related data to URL as query parameters
            const url = new URL(newRep.data.url);
            url.searchParams.append('signature', signature);
            url.searchParams.append('message', message);
            url.searchParams.append('RAddress', RAddress);
            url.searchParams.append('height', height.toString());
            url.searchParams.append('systemId', coinObj.system_id);
            
            const authenticatedUrl = url.toString();
            console.log("Opening authenticated URL:", authenticatedUrl);
            
            // Open the SumSub URL in InAppBrowser
            if (await InAppBrowser.isAvailable()) {
                InAppBrowser.open(authenticatedUrl, {
                    // iOS Properties
                    dismissButtonStyle: 'cancel',
                    preferredBarTintColor: '#00A1CC',
                    preferredControlTintColor: 'white',
                    readerMode: false,
                    animated: true,
                    modalPresentationStyle: 'fullScreen',
                    modalTransitionStyle: 'coverVertical',
                    modalEnabled: true,
                    enableBarCollapsing: false,
                    // Android Properties
                    showTitle: false,
                    toolbarColor: '#00A1CC',
                    secondaryToolbarColor: 'black',
                    navigationBarColor: 'black',
                    navigationBarDividerColor: 'white',
                    enableUrlBarHiding: true,
                    enableDefaultShare: false,
                    forceCloseOnRedirection: false,
                    hasBackButton: false,
                    waitForRedirectDelay: 500,
                    showInRecents: true,
                    ephemeralWebSession: false,
                    animations: {
                        startEnter: 'slide_in_right',
                        startExit: 'slide_out_left',
                        endEnter: 'slide_in_left',
                        endExit: 'slide_out_right'
                    }
                });
            } else {
                Linking.openURL(authenticatedUrl);
            }
            
            setLoading(false);
            
        } catch (error) {
            console.error("Error continuing proof of personhood:", error);
            setLoading(false);
            createAlertDialog(
                'An error occurred while continuing with your proof of personhood. ' + error.message, "OK"
            );
        }
    };

    const handleProvisioningResponse = async (
        notificationUid,
        identityName,
        identityID,
        uri,
        loginRequest
    ) => {

        const verusIdState = {
            status: NOTIFICATION_TYPE_VERUSID_PENDING,
            fqn: identityName,
            loginRequest: loginRequest.toBuffer().toString('base64'),
            fromService: false,
            createdAt: Number((Date.now() / 1000).toFixed(0)),
            infoUri: uri,
            provisioningName: "Valuid",
            notificationUid: notificationUid
        }

        await setRequestedVerusId(identityID, verusIdState, CoinDirectory.findCoinObj(verusNetwork).id);
        await updatePendingVerusIds();

    };

    const fetchData = useCallback(async () => {
        // Don't fetch data if we're currently provisioning an identity
        if (isProvisioningIdentity) {
            return;
        }

        // Check for data in the wallet that says there is an attestation present.
        let attestaionPresent = false
          try {
            const attestations = await requestAttestationData(ATTESTATIONS_PROVISIONED);
            console.log("Attestations fetched in ValuAttestation:", attestations);
            // Check if user has "Valu Proof of Personhood" attestation
            attestaionPresent = Object.values(attestations || {}).some(attestationItem => 
                attestationItem && 
                typeof attestationItem === 'object' && 
                attestationItem.name === "Valu Proof of Personhood"
            );
            
           
        } catch (e) {
            console.log("Error checking for existing Proof of Personhood:", e);
            
        }

        if (attestaionPresent) {
            // Use the navigation object
            setStatus("POP_RECEIVED");
            return;
        }

        setLoading(true);
        try {

            const provisionRequest = new primitives.LoginConsentProvisioningRequest({
                signing_address: activeAccount.keys[verusNetwork].vrpc.addresses[0],
                challenge: new primitives.LoginConsentProvisioningChallenge({
                    challenge_id: "i4c69dWkwS5XvuuuqbbA7J9W7kfSk2SnQm", //"name": "valuid.vrsc::attestation.session"
                    created_at: Number((Date.now() / 1000).toFixed(0)),
                    name: "Valu attestation session",
                }),
            });

            const signedRequestReply = await signIdProvisioningRequest({ id: verusNetwork }, provisionRequest);
            const reply = await ValuProvider.getAttestationPaymentStatus({ request: signedRequestReply.toBuffer().toString('base64') })

            if (reply.success === false) {
                throw new Error(reply.error);
            }
            let POLStatus = reply.data.status;
            console.log("POLStatus", POLStatus);

            setMainButtonText(buttonMessages[POLStatus]);
            setValuReply(reply);
            setStatus(POLStatus);

            if (POLStatus === VALU_POL_PAYMENT_FAILED) {
                createAlertDialog(
                    `Your previous payment attempt failed, would you like to try again?`, "RETRY", () => {
                        ValuProvider.retryAttestationPayment({ request: signedRequestReply.toBuffer().toString('base64') }).then((innerreply) => {
                            setValuReply(innerreply);
                            setStatus(POLStatus);
                            Linking.openURL(innerreply.data.url)
                        });
                    })
            } else if (POLStatus === VALU_POL_PAYMENT_RECEIVED) {
                // maybe add notification.
            }
            setLoading(false);

        } catch (e) {
            console.log("Error from check status of POL: ", e.message ? e.message : e)
            setLoading(false);
            setStatus("error");
            setMainButtonText("RETRY");
            createAlertDialog(
                `An error occurred while trying to start the Valu Proof of Personhood process. ${e.message}`, "RETRY")
        }

    }, [props.navigation, isProvisioningIdentity]);

    // useFocusEffect(fetchData);

    useEffect(() => {
        initAccountStatus().then(() => {
            fetchData();
        });
    }, []);

    // Reload linked identities when encrypted IDs change
    useEffect(() => {
        if (encryptedIds) {
            loadLinkedIdentities();
        }
    }, [encryptedIds]);

    // Handle navigation from ValuChooseIdentity screen
    useFocusEffect(
        useCallback(() => {
            const routeParams = props.route?.params;
            if (routeParams?.continueFlow && routeParams?.chosenIdentity) {
                // Continue with the deep link flow using the chosen identity
                continueWithIdentity(routeParams.chosenIdentity);
                // Clear the params to avoid re-execution
                props.navigation.setParams({ continueFlow: false, chosenIdentity: null });
            }
        }, [props.route?.params])
    );

    const continueWithIdentity = async (chosenIdentity) => {
        try {
            const result = await provisionNewIdentity(chosenIdentity, 'ValuChooseIdentity screen');
            if (result?.continueFlow) {
                // Continue with proof of personhood after identity provisioning
                await continueProofOfPersonhood(result);
            }
        } catch (error) {
            console.error('Error in continueWithIdentity:', error);
        }
    };

    // Load existing identities from VerusID service
    const loadLinkedIdentities = async () => {
        try {
            const verusIdServiceData = await requestServiceStoredData(VERUSID_SERVICE_ID);

            if (verusIdServiceData.linked_ids) {
                setLinkedIds(verusIdServiceData.linked_ids);

                // Sort identities like in LoginRequestIdentity
                const sortedIdKeysPerChain = {};
                const chainIds = Object.keys(verusIdServiceData.linked_ids);

                for (const chainId of chainIds) {
                    sortedIdKeysPerChain[chainId] = verusIdServiceData.linked_ids[chainId]
                        ? Object.keys(verusIdServiceData.linked_ids[chainId]).sort(function (x, y) {
                            if (verusIdServiceData.linked_ids[chainId][x] < verusIdServiceData.linked_ids[chainId][y]) {
                                return -1;
                            }
                            if (verusIdServiceData.linked_ids[chainId][x] > verusIdServiceData.linked_ids[chainId][y]) {
                                return 1;
                            }
                            return 0;
                        })
                        : [];
                }
                setSortedIds(sortedIdKeysPerChain);
            } else {
                setLinkedIds({});
                setSortedIds({});
            }
        } catch (e) {
            console.error('Error Loading Linked VerusIDs:', e.message);
            setLinkedIds({});
            setSortedIds({});
        }
    };


    // Handle selection of existing identity
    const selectExistingIdentity = async (iAddress) => {
        setExistingIdentityModalVisible(false);
        setLoading(true);
        try {
            const identityName = linkedIds[verusNetwork] && linkedIds[verusNetwork][iAddress];
            if (!identityName) {
                throw new Error("Identity name not found");
            }
            
            // Continue with proof of personhood using existing identity
            await continueProofOfPersonhood({ identityName, identityAddress: iAddress, isExisting: true });
            
        } catch (error) {
            console.error("Error using existing identity:", error);
            setLoading(false);
            createAlertDialog(
                'An error occurred while using your existing identity. ' + error.message, "OK"
            );
        }
    };

    // Handle requesting a new identity (ValuChooseIdentity flow)
    const handleNewIdentityRequest = async (identityName) => {
        try {
            const result = await provisionNewIdentity(identityName, 'new identity request');
            if (result?.continueFlow) {
                // Continue with proof of personhood after identity provisioning
                await continueProofOfPersonhood(result);
            }
        } catch (error) {
            console.error('Error in handleNewIdentityRequest:', error);
        }
    };

    // Handle linking new identity
    const openLinkIdentityModalFromChain = () => {
        setExistingIdentityModalVisible(false);
        return openLinkIdentityModal(CoinDirectory.findCoinObj(verusNetwork, null, true));
    };

    // Show identity choice modal
    const showIdentityChoiceModal = async () => {
        await loadLinkedIdentities();
        setIdentityChoiceModalVisible(true);
    };


    // Continue with new ValuID flow
    const continueWithNewValuId = () => {
        setIdentityChoiceModalVisible(false);
        // Navigate to ValuChooseIdentity screen, but pass a callback for when the user submits a new identity
        const parentNav = props.navigation?.getParent();
        if (parentNav) {
            parentNav.navigate('ServicesHome', {
                screen: 'ValuChooseIdentity',
                params: {
                    onIdentitySubmit: handleNewIdentityRequest
                }
            });
        }
    };

    // Show existing identity selection modal
    const showExistingIdentityModal = () => {
        setIdentityChoiceModalVisible(false);
        setExistingIdentityModalVisible(true);
    };

    // Check for pending identities and handle accordingly
    const checkForPendingIdentity = async () => {
        try {

            if (pendingIds[verusNetwork]) {
                const identityAddresses = Object.keys(pendingIds[verusNetwork]);
                if (identityAddresses.length > 0) {
                    // Get the first pending identity (you might want to handle multiple differently)
                    const firstAddress = identityAddresses[0];
                    const identityDetails = pendingIds[verusNetwork][firstAddress];
                    
                    // Check if the identity has been mined in using getidentity
                    try {
                        const identityResult = await getIdentity(systemId, firstAddress);

                        if (identityResult && identityResult.result && identityResult.result.identity) {
                            // Identity is mined in, automatically link it and remove notification
                            const identityName = identityDetails.fqn || identityDetails.provisioningName || 'Unknown';
                            
                            // Link the VerusID
                            await linkVerusId(firstAddress, identityName, verusNetwork);
                            
                            // Delete from pending IDs
                            await deleteProvisionedIds(firstAddress, verusNetwork);
                            
                            // Update pending IDs in Redux store
                            await updatePendingVerusIds();
                            
                            // Remove notification if it exists
                            if (identityDetails.notificationUid) {
                                await dispatchRemoveNotification(identityDetails.notificationUid);
                            }
                         
                            return 'auto_linked'; // Identity was automatically linked
                        }
                    } catch (getIdentityError) {
                        console.log('Error checking identity status with getidentity:', getIdentityError);
                        // Continue with normal flow if getidentity fails
                    }
                    
                    if (identityDetails.status === NOTIFICATION_TYPE_VERUSID_READY) {
                        // Identity is ready to be linked
                        setPendingIdentityInfo({
                            address: firstAddress,
                            details: identityDetails
                        });
                        setShowPendingIdentityModal(true);
                        return 'ready'; // Found ready identity
                    } else if (identityDetails.status === NOTIFICATION_TYPE_VERUSID_PENDING) {
                        // Identity is still being processed
                        const identityName = identityDetails.fqn || identityDetails.provisioningName || 'Unknown';
                        createAlertDialog(
                            `You have a pending ID "${identityName}" please wait a few more minutes for this to be confirmed then you can link, try again in a few minutes.`,
                            "OK"
                        );
                        return 'pending'; // Found pending identity
                    }
                }
            }
            return false; // No pending identity found
        } catch (error) {
            console.log('Error checking for pending identity:', error);
            return false;
        }
    };

    // Link the pending identity
    const linkPendingIdentity = async () => {
        if (!pendingIdentityInfo) return;
        
        try {
            setLoading(true);
            
            const { address, details } = pendingIdentityInfo;
            const identityName = details.provisioningName || details.fqn;
            
            // Link the VerusID
            await linkVerusId(address, identityName, verusNetwork);
            
            // Delete from pending IDs
            await deleteProvisionedIds(address, verusNetwork);
            
            // Update pending IDs in Redux store
            await updatePendingVerusIds();
            
            // Remove notification if it exists
            if (details.notificationUid) {
                await dispatchRemoveNotification(details.notificationUid);
            }
            
            // Close the modal and show success message
            setShowPendingIdentityModal(false);
            setPendingIdentityInfo(null);
            
            createAlertDialog(
                `Successfully linked identity: ${identityName}. Now proceeding to get your Valu Attestation.`,
                "CONTINUE",
                async () => {
                    try {
                        // Now proceed with the attestation flow
                        const newRep = await ValuProvider.getValuAttestationStatus();
                        if (newRep.success === false) {
                            throw new Error(newRep.error);
                        }
                        // Trigger internal deeplink handler instead of opening externally
                        updateDeeplinkUrl(newRep.data);
                    } catch (error) {
                        console.log('Error proceeding with attestation:', error);
                        createAlertDialog(
                            `Failed to proceed with attestation: ${error.message}`,
                            "OK"
                        );
                    }
                }
            );
            
        } catch (error) {
            console.log('Error linking pending identity:', error);
            createAlertDialog(
                `Failed to link identity: ${error.message}`,
                "OK"
            );
        } finally {
            setLoading(false);
        }
    };

    const checkAccountCreationStatus = async () => {

        // First, try to authenticate with registered user
        try {
            const authResult = await ValuProvider.authenticateRegisteredUser();
       
            // If authentication is successful, user is already authenticated
            if (authResult.success) {
               
                return;
            }
        } catch (error) {
            console.log("Registered user authentication failed:", error?.message ? error.message : error);
        }

        // If registered user authentication fails or user not authenticated, use fallback authentication

        const seed = (await requestSeeds())[VALU_SERVICE];
        if (seed == null) throw new Error("No Valu seed present");
        await ValuProvider.authenticate(seed, true);

    }

    const initAccountStatus = async () => {
        props.dispatch(setServiceLoading(true, VALU_SERVICE_ID))
        setLoading(true);
        try {
            await checkAccountCreationStatus();
            props.dispatch(setServiceLoading(false, VALU_SERVICE_ID))
            setLoading(false);
        } catch (e) {
            setLoading(false);
            console.log(e)

            createAlertDialog(
                "Failed to retrieve Valu account status from server.", "RETRY",
                () => { resolveAlert(); setLoading(false); });
        }
    };

    // useEffect(() => {
    //     fetchData();
    // }, [fetchData]);

    useEffect(() => {
        // make sure teh screen reloads when the app is brought back to the foreground
        const handleAppStateChange = (nextAppState) => {
            if (appState.match(/inactive|background/) && nextAppState === 'active') {
                setLoading(true);
                fetchData();
            }
            setAppState(nextAppState);
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [appState, fetchData]);

    const createAlertDialog = (message, button, func = () => { }) => {
        createAlert(
            `Valu Proof of Personhood Attestation`,
            message, [
            {
                text: 'CANCEL',
                onPress: () => resolveAlert(false),
                style: 'cancel',
            },
            {
                text: button, onPress: () => {
                    func();
                    resolveAlert(true);
                }
            },
        ],
            { cancelable: false }
        );
    }

    const startOnRamp = async () => {

        try {
            setLoading(true);
            if (status === VALU_POL_PAYMENT_STARTED) {

                const { directory } = notifications;
                let skipDispatchNotification = false;
                const keys = Object.keys(directory || {});
                keys.forEach((uid, index) => {
                    if (directory[uid].acchash === acchash && directory[uid].type === NOTIFICATION_TYPE_NAVIGATION) {
                        skipDispatchNotification = true;
                    }
                });

                const newRep = await ValuProvider.getAttestationPaymentURL();

                Linking.openURL(newRep.data.url);
                if (skipDispatchNotification) {
                    const newLoadingNotification = new NavigationNotification();
                    newLoadingNotification.body = "Continue";
                    newLoadingNotification.title = [`Complete Valu Proof of Personhood`]
                    newLoadingNotification.acchash = activeAccount.accountHash;
                    newLoadingNotification.icon = NOTIFICATION_ICON_VALU;
                    newLoadingNotification.navigate = () => {
                        props.navigation.navigate('ServicesHome', {
                            screen: 'ValuAttestation',
                        });
                    };

                    dispatchAddNotification(newLoadingNotification);
                }

            } else if (status === VALU_POL_PAYMENT_PENDING) {
                createAlertDialog(
                    `You already have a Valu Proof of Personhood in progress.`, "RESUME", () => { Linking.openURL(valuReply.data.url) });

            } else if (status === VALU_POL_PAYMENT_FAILED) {
                createAlertDialog(
                    `Your previous payment attempt failed, would you like to try again?`, "RETRY")
            } else if (status === VALU_POL_PENDING) {
                // Show loading spinner while checking status
                setLoading(false);
                showIdentityChoiceModal();
                return;
                // Loading will be set to false in fetchData
            } else if (status === VALU_POL_PAYMENT_RECEIVED) {
                // Show identity choice modal first instead of directly navigating
                setLoading(false);
                showIdentityChoiceModal();
                return;
            } else if (status === VALU_POL_READY) {
                // First check if there are any pending identities that need to be handled
                const pendingStatus = await checkForPendingIdentity();
                
                if (pendingStatus === 'pending') {
                    // Identity is still being processed, alert was already shown, don't proceed
                    setLoading(false);
                    return;
                } else if (pendingStatus === 'ready') {
                    // Identity is ready to link, modal was shown, don't proceed to deeplink yet
                    setLoading(false);
                    return;
                } else if (pendingStatus === 'auto_linked') {
                    // Identity was automatically linked, proceed with attestation flow
                    createAlertDialog(
                        `Your identity has been successfully confirmed and linked! Now proceeding to get your Valu Attestation.`,
                        "CONTINUE",
                        async () => {
                            try {
                                const newRep = await ValuProvider.getValuAttestationStatus();
                                if (newRep.success === false) {
                                    throw new Error(newRep.error);
                                }
                                // Trigger internal deeplink handler instead of opening externally
                                updateDeeplinkUrl(newRep.data);
                            } catch (error) {
                                console.log('Error proceeding with attestation after auto-link:', error);
                                createAlertDialog(
                                    `Failed to proceed with attestation: ${error.message}`,
                                    "OK"
                                );
                            }
                        }
                    );
                } else {
                    // No pending identity, proceed with normal flow
                    const newRep = await ValuProvider.getValuAttestationStatus();
                    if (newRep.success === false) {
                        throw new Error(newRep.error);
                    }
                    // Trigger internal deeplink handler instead of opening externally
                    updateDeeplinkUrl(newRep.data);
                }
            } else if (status === "POP_RECEIVED") {
                // User already has Proof of Personhood attestation, navigate to attestations
                setLoading(false);
                  props.navigation.navigate('ServicesHome');
            }
        } catch (e) {
            console.log("startOnRamp error", e)
            setLoading(false);
            createAlertDialog(
                `An error occurred while trying to start the Valu Proof of Personhood process. ${e}`, "OK"
            )

        }
        
    }

    const stageMessages = {
        [VALU_POL_PAYMENT_RECEIVED]: (<Text style={{ fontSize: 16, textAlign: 'left', color: 'black' }}>
            Payment received. Continue to finish your Proof of Personhood.
        </Text>),
        [VALU_POL_PAYMENT_PENDING]: (<Text style={{ fontSize: 16, textAlign: 'left', color: 'black' }}>
            You already have an attestation in progress.
        </Text>),
        [VALU_POL_READY]: (<Text style={{ fontSize: 16, textAlign: 'left', color: 'black' }}>
            Your Proof of Personhood is ready to retrieve.
        </Text>),
        [VALU_POL_PENDING]: (<Text style={{ fontSize: 16, textAlign: 'left', color: 'black' }}>
            Your details are being processed. Tap continue to check if your proof is ready.
        </Text>),

        [VALU_POL_READY]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Your Valu Proof of Personhood is ready to retrieve.
        </Text>),
        [VALU_POL_PENDING]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Continue with your Proof of Personhood.
        </Text>),
        "error": (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50, color: Colors.WarningRed }}>

            An error occurred. Please try again.
        </Text>),
        "POP_RECEIVED": (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            You already have a Proof of Personhood attestation.
        </Text>),
        [null]: null
    }

    const screenWidth = Dimensions.get('window').width;
    const isInitialStatus = status === VALU_POL_PAYMENT_STARTED || status === "" || status === null;
    const statusMeta = {
        [VALU_POL_PAYMENT_RECEIVED]: { title: 'Payment received', body: 'Continue to finish your Proof of Personhood.', cta: 'Continue' },
        [VALU_POL_PAYMENT_PENDING]: { title: 'Purchase in progress', body: 'Resume your purchase to finish payment.', cta: 'Resume purchase' },
        [VALU_POL_PAYMENT_FAILED]: { title: 'Payment failed', body: 'Please try again.', cta: 'Retry purchase' },
        [VALU_POL_PENDING]: { title: 'Processing your details', body: 'Tap continue to check if your proof is ready.', cta: 'Check status' },
        [VALU_POL_READY]: { title: 'Your proof is ready', body: 'Retrieve your Proof of Personhood now.', cta: 'Get your proof' },
        "POP_RECEIVED": { title: 'Proof of Personhood complete', body: 'View your attestations and manage your proof.', cta: 'Go to Attestations' }
    };
    const ctaLabel = isInitialStatus ? 'Purchase for $9.99' : (statusMeta[status]?.cta || mainButtonText);

    return (
        <SafeAreaView style={Styles.defaultRoot}>
            <ScrollView
                style={Styles.fullWidth}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', alignItems: 'stretch' }}>
                <View style={{ alignContent: 'center', alignItems: 'stretch', alignSelf: 'stretch', width: '100%', flexGrow: 1 }}>
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', alignItems: 'stretch' }}>
                <View style={{ alignContent: 'center', alignItems: 'stretch', alignSelf: 'stretch', width: '100%', flexGrow: 1 }}>
                    {showIdentityProvisioningProgress ? (
                        <React.Fragment>
                            <Text style={{ fontSize: 30, textAlign: 'center', paddingBottom: 20 }}>
                                Registering Identity
                            </Text>
                            <AnimatedActivityIndicator
                                style={{
                                    width: 128,
                                    marginBottom: 20
                                }}
                            />
                            <Text style={{ fontSize: 18, textAlign: 'center', marginHorizontal: 50, color: Colors.BasicBlue }}>
                                Please wait while we register your identity request...
                            </Text>
                        </React.Fragment>
                    ) : loading || status === null ? (
                        <AnimatedActivityIndicator
                            style={{
                                width: 128,
                            }}
                        />
                    ) : (
                        <React.Fragment>
                            {/* Large gradient title - left aligned, two lines */}
                            {/* Header box with subtle divider */}
                            <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 32, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#EDEDED' }}>
                                <Svg width={screenWidth - 48} height={125}>
                                    <Defs>
                                        <SvgLinearGradient id="valuGradient" x1="0" y1="0" x2="1" y2="1">
                                            <Stop offset="0" stopColor="#00C8FF" />
                                            <Stop offset="1" stopColor="#0077A9" />
                                        </SvgLinearGradient>
                                    </Defs>
                                    <SvgText
                                        x={0}
                                        y={45}
                                        fontSize={54}
                                        fontWeight={'800'}
                                        textAnchor={'start'}
                                        fill={'url(#valuGradient)'}
                                    >
                                        {Array.from('Proof of').map((ch, i) => (
                                            <TSpan key={`p1-${i}`} dx={i === 0 ? 0 : -1.5}>{ch}</TSpan>
                                        ))}
                                    </SvgText>
                                    <SvgText
                                        x={0}
                                        y={95}
                                        fontSize={54}
                                        fontWeight={'800'}
                                        textAnchor={'start'}
                                        fill={'url(#valuGradient)'}
                                    >
                                        {Array.from('Personhood').map((ch, i) => (
                                            <TSpan key={`p2-${i}`} dx={i === 0 ? 0 : -1.5}>{ch}</TSpan>
                                        ))}
                                    </SvgText>
                                </Svg>
                                
                                {/* Tagline */}
                                <Text style={{ fontSize: 18, color: '#666', marginTop: -8, marginBottom: 12, textAlign: 'left' }}>
                                    {'Verify once. Prove privately anywhere.'}
                                </Text>
                            </View>
                            
                            {/* Content area (no background) */}
                            <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, paddingVertical: 20, marginTop: 16 }}>
                                {/* What you get section (initial only) */}
                                {isInitialStatus && (
                                <View style={{ marginBottom: 32 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 }}>What you get</Text>
                                    <Text style={{ fontSize: 14, color: '#555', lineHeight: 20 }}>
                                        You receive a reusable Proof of Personhood attestation linked to your VerusID. It lets you prove you're a unique, verified person—without exposing your personal details by default.
                                    </Text>
                                </View>)}
                                
                                {/* Benefits list (initial only) */}
                                {isInitialStatus && (
                                <View style={{ width: '100%', marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'column' }}>
                                        <View style={{ width: '100%', marginBottom: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={{ fontSize: 16, marginRight: 6 }}>🔒</Text>
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }}>Privacy‑first</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#555', lineHeight: 18 }}>
                                                Share a cryptographic proof, not your documents.
                                            </Text>
                                        </View>
                                        <View style={{ width: '100%', marginBottom: 0 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={{ fontSize: 16, marginRight: 6 }}>⚡</Text>
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }}>One‑time setup</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#555', lineHeight: 18 }}>
                                                Verify once and reuse across supported services.
                                            </Text>
                                        </View>
                                    </View>
                                </View>)}

                                {/* Status copy (non-initial only) */}
                                {!isInitialStatus && (
                                    <View>
                                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 }}>{statusMeta[status]?.title}</Text>
                                        <Text style={{ fontSize: 15, color: '#555', lineHeight: 21 }}>{statusMeta[status]?.body}</Text>
                                    </View>
                                )}
                                
                                {/* old stage messages suppressed */}
                            </View>
                            
                        </React.Fragment>
                    )}
                </View>
                {/* Bottom container pinned by space-between */}
                <View style={{ width: '100%', alignSelf: 'stretch' }}>
                    <TouchableOpacity onPress={() => setHowItWorksVisible(true)} activeOpacity={0.7} style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, color: '#666', textDecorationLine: 'underline', textAlign: 'center' }}>{'How it works'}</Text>
                    </TouchableOpacity>
                    <View style={{ paddingHorizontal: 20, paddingBottom: 24, width: '100%', alignSelf: 'stretch' }}>
                        <Button
                            onPress={() => { startOnRamp() }}
                            mode="contained"
                            disabled={status === 'error'}
                            style={{
                                borderRadius: 24,
                                backgroundColor: Colors.primaryColor,
                                elevation: 0,
                                shadowColor: 'transparent',
                                shadowOpacity: 0,
                                shadowRadius: 0,
                                shadowOffset: { width: 0, height: 0 },
                                width: '100%',
                                alignSelf: 'stretch'
                            }}
                            contentStyle={{ height: 48 }}
                            labelStyle={{
                                color: Colors.secondaryColor,
                                fontWeight: '600',
                                fontSize: 15,
                                letterSpacing: 0,
                                textTransform: 'none',
                            }}
                        >
                            {ctaLabel}
                        </Button>
                    </View>
                </View>
            </ScrollView>

            {/* How it works SemiModal */}
            <Portal>
                {howItWorksVisible && (
                    <SemiModal
                        animationType={'slide'}
                        transparent={true}
                        visible={true}
                        onRequestClose={() => setHowItWorksVisible(false)}
                        flexHeight={0.01}
                        contentContainerStyle={{
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            flex: 0,
                            alignSelf: 'flex-end',
                            width: '100%',
                            maxHeight: '70%',
                        }}
                    >
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 16 }}>
                                <Button onPress={() => setHowItWorksVisible(false)} textColor={Colors.primaryColor}>{'Close'}</Button>
                                <Text style={{ fontSize: 16, fontWeight: '600' }}>{'How it works'}</Text>
                                <View style={{ width: 64 }} />
                            </View>
                            <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                                
                                
                                {/* Step 1 */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.secondaryColor }}>1</Text>
                                    </View>
                                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Choose or create your VerusID (included with the purchase).</Text>
                                </View>
                                
                                {/* Step 2 */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.secondaryColor }}>2</Text>
                                    </View>
                                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Complete a quick one‑time identity check (ID + selfie).</Text>
                                </View>
                                
                                {/* Step 3 */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.secondaryColor }}>3</Text>
                                    </View>
                                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>We issue a cryptographic proof bound to your VerusID—not your personal data.</Text>
                                </View>
                                
                                {/* Step 4 */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.secondaryColor }}>4</Text>
                                    </View>
                                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Reuse this proof to verify in seconds across supported services.</Text>
                                </View>
                                
                                <Text style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>{'Estimated time: About 5–10 minutes'}</Text>
                                
                                {/* Got it button */}
                                <Button
                                    onPress={() => setHowItWorksVisible(false)}
                                    mode="contained"
                                    style={{
                                        borderRadius: 24,
                                        backgroundColor: Colors.primaryColor,
                                        elevation: 0,
                                        shadowColor: 'transparent',
                                        shadowOpacity: 0,
                                        shadowRadius: 0,
                                        shadowOffset: { width: 0, height: 0 },
                                        width: '100%',
                                        alignSelf: 'stretch',
                                        marginBottom: 20
                                    }}
                                    contentStyle={{ height: 48 }}
                                    labelStyle={{
                                        color: Colors.secondaryColor,
                                        fontWeight: '600',
                                        fontSize: 15,
                                        letterSpacing: 0,
                                        textTransform: 'none',
                                    }}
                                >
                                    Got it
                                </Button>
                            </View>
                        </View>
                    </SemiModal>
                )}

                {/* Identity Choice Modal */}
                <Dialog visible={identityChoiceModalVisible} onDismiss={() => setIdentityChoiceModalVisible(false)}>
                    <Dialog.Title>Choose Identity Option</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 20 }}>
                            Do you want to register a new ValuID or use an existing identity for your attestation?
                        </Text>
                        <List.Item
                            title="Register New ValuID"
                            description="Create a new ValuID for this attestation"
                            left={props => <List.Icon {...props} icon="plus" />}
                            onPress={continueWithNewValuId}
                        />
                        <Divider />
                        <List.Item
                            title="Use Existing Identity"
                            description="Link attestation to an existing VerusID"
                            left={props => <List.Icon {...props} icon="account" />}
                            onPress={showExistingIdentityModal}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIdentityChoiceModalVisible(false)}>Cancel</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Existing Identity Selection Modal */}
                {existingIdentityModalVisible && (
                    <ListSelectionModal
                        title="Select Identity"
                        flexHeight={3}
                        visible={existingIdentityModalVisible}
                        onSelect={(item) => selectExistingIdentity(item.key)}
                        data={[
                            // Existing identities from the network
                            ...((sortedIds[verusNetwork] || []).map((iAddr) => ({
                                key: iAddr,
                                title: linkedIds[verusNetwork][iAddr],
                                description: iAddr
                            }))),
                            // Link new identity option
                            {
                                key: 'link_new',
                                title: 'Link VerusID',
                                description: 'Connect a new VerusID to your wallet',
                                isAction: true
                            }
                        ]}
                        cancel={() => setExistingIdentityModalVisible(false)}
                        renderItem={(item, index, onSelect) => {
                            if (item.isAction) {
                                return (
                                    <React.Fragment key={item.key}>
                                        <Divider />
                                        <List.Item
                                            title={item.title}
                                            description={item.description}
                                            left={props => <List.Icon {...props} icon={'plus'} />}
                                            onPress={() => openLinkIdentityModalFromChain()}
                                        />
                                    </React.Fragment>
                                );
                            }
                            return (
                                <React.Fragment key={item.key}>
                                    <Divider />
                                    <List.Item
                                        title={item.title}
                                        description={item.description}
                                        descriptionNumberOfLines={1}
                                        titleNumberOfLines={1}
                                        left={props => <List.Icon {...props} icon={'account'} />}
                                        right={props => (
                                            <List.Icon {...props} icon={'chevron-right'} size={20} />
                                        )}
                                        onPress={() => onSelect(item)}
                                    />
                                </React.Fragment>
                            );
                        }}
                    />
                )}

                {/* Pending Identity Link Modal */}
                <Dialog visible={showPendingIdentityModal} onDismiss={() => setShowPendingIdentityModal(false)}>
                    <Dialog.Title>Link Your New Identity</Dialog.Title>
                    <Dialog.Content>
                        {pendingIdentityInfo && (
                            <View>
                                <Text style={{ fontSize: 16, marginBottom: 10 }}>
                                    Your new VerusID is ready to be linked:
                                </Text>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 5 }}>
                                    {pendingIdentityInfo.details.provisioningName || pendingIdentityInfo.details.fqn}
                                </Text>
                                <Text style={{ fontSize: 14, color: Colors.secondaryColor, marginBottom: 15 }}>
                                    Address: {pendingIdentityInfo.address}
                                </Text>
                                <Text style={{ fontSize: 14, marginBottom: 10 }}>
                                    Would you like to link this identity to your wallet now?
                                </Text>
                            </View>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowPendingIdentityModal(false)}>Cancel</Button>
                        <Button 
                            onPress={linkPendingIdentity}
                            mode="contained"
                            disabled={loading}
                        >
                            Link Identity
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </SafeAreaView>
    );

};

const mapStateToProps = (state) => {
    return {
        activeAccount: state.authentication.activeAccount,
    }
};

export default connect(mapStateToProps)(ValuAttestation);