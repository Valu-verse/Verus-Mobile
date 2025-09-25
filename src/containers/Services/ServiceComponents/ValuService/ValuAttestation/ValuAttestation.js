import React, { useEffect, useState, useCallback } from "react"
import { connect, useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { primitives, VerusIdInterface } from "verusid-ts-client"
import { SafeAreaView, ScrollView, View, Image, Linking, AppState } from 'react-native'

import { Divider, List, Button, Text, Portal, Dialog } from 'react-native-paper';
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
import { requestServiceStoredData } from "../../../../../utils/auth/authBox";
import { VERUSID_SERVICE_ID } from "../../../../../utils/constants/services";
import { CoinDirectory } from "../../../../../utils/CoinData/CoinDirectory";
import { openLinkIdentityModal } from "../../../../../actions/actions/sendModal/dispatchers/sendModal";
import { useObjectSelector } from "../../../../../hooks/useObjectSelector";
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { AttesationBadge, VUSDC } from "../../../../../images/customIcons";
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
import { Buffer } from 'buffer';
import { requestPrivKey } from "../../../../../utils/auth/authBox";
import { VRPC } from "../../../../../utils/constants/intervalConstants";
import { sha256 } from "@bitgo/utxo-lib/dist/src/crypto";
import { dispatchRemoveNotification } from '../../../../../actions/actions/notifications/dispatchers/notifications';


const ValuAttestation = (props) => {
    const activeAccount = useSelector(state => state.authentication.activeAccount);
    const signedIn = useSelector(state => state.authentication.signedIn);
    const verusNetwork = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'VRSCTEST' : 'VRSC';
    const [valuReply, setValuReply] = useState(null);
    const [loading, setLoading] = useState(true); // Start with loading true
    const [status, setStatus] = useState(null); // Start with null instead of empty string
    const [mainButtonText, setMainButtonText] = useState("START");
    const [appState, setAppState] = useState(AppState.currentState);
    const [identityChoiceModalVisible, setIdentityChoiceModalVisible] = useState(false);
    const [existingIdentityModalVisible, setExistingIdentityModalVisible] = useState(false);
    const [linkedIds, setLinkedIds] = useState({});
    const [sortedIds, setSortedIds] = useState({});
    const [isProvisioningIdentity, setIsProvisioningIdentity] = useState(false);
    const [showIdentityProvisioningProgress, setShowIdentityProvisioningProgress] = useState(false);
    const [showPendingIdentityModal, setShowPendingIdentityModal] = useState(false);
    const [pendingIdentityInfo, setPendingIdentityInfo] = useState(null);
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
        [VALU_POL_PAYMENT_STARTED]: "START",
        [VALU_POL_PAYMENT_PENDING]: "RESUME",
        [VALU_POL_PAYMENT_RECEIVED]: "CONTINUE",
        [VALU_POL_PAYMENT_FAILED]: "RETRY",
        [VALU_POL_READY]: "CONTINUE",
        [VALU_POL_IDENTITY_PROVISIONED_PENDING]: "WAIT FOR IDENTITY",
        [VALU_POL_IDENTITY_PROVISIONED]: "CONTINUE",
        [VALU_POL_PENDING]: "REFRESH STATUS",

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
        // If there is, then take the user to the attestation page.
        // If there is not, then display the 
        const VALU_ATTESTATION = "isdffds" //TODO: make a function to check whether POL is provisioned
        const attestations = await requestAttestationData(ATTESTATIONS_PROVISIONED);

        if (attestations[VALU_ATTESTATION]) {
            // Use the navigation object
            props.navigation.navigate('Attestation', { attestations: attestations });
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
            console.log("Checking for pending identities on network:", pendingIds);
            if (pendingIds[verusNetwork]) {
                const identityAddresses = Object.keys(pendingIds[verusNetwork]);
                if (identityAddresses.length > 0) {
                    // Get the first pending identity (you might want to handle multiple differently)
                    const firstAddress = identityAddresses[0];
                    const identityDetails = pendingIds[verusNetwork][firstAddress];
                    
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
            console.log("authResult", authResult);
            // If authentication is successful, user is already authenticated
            if (authResult.success) {
                console.log("User already authenticated with registered credentials");
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
                setLoading(true);
                await fetchData();
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
                } else {
                    // No pending identity, proceed with normal flow
                    const newRep = await ValuProvider.getValuAttestationStatus();
                    if (newRep.success === false) {
                        throw new Error(newRep.error);
                    }
                    // Trigger internal deeplink handler instead of opening externally
                    updateDeeplinkUrl(newRep.data);
                }
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
        [VALU_POL_PAYMENT_RECEIVED]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Payment received. Proceed to get your Valu Attestation.
        </Text>),
        [VALU_POL_PAYMENT_PENDING]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            You already have a Valu Identity in progress.
        </Text>),
        [VALU_POL_PAYMENT_STARTED]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Purchase a ValuID and Valu Identity for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),
        "": (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Purchase a Valu Proof of Personhood with a free VerusID for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),
        [VALU_POL_READY]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Your Valu Proof of Personhood is ready to retrieve.
        </Text>),
        [VALU_POL_PENDING]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Your Personal details are being processed. Click continue to check if your Proof of Personhood is ready.
        </Text>),
        "error": (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50, color: Colors.WarningRed }}>
            An error occurred. Please try again.
        </Text>),
        // Add null case to prevent showing anything while loading
        [null]: null
    }

    return (
        <SafeAreaView style={Styles.defaultRoot}>
            <ScrollView
                style={Styles.fullWidth}
                contentContainerStyle={Styles.focalCenter}>
                <View style={{ alignContent: 'center', alignItems: 'center' }}>
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
                            <Text style={{ fontSize: 30, textAlign: 'center', paddingBottom: 20 }}>
                                Valu Attestation Service
                            </Text>
                            <Image source={AttesationBadge} style={{ aspectRatio: 1.5, height: 120, alignSelf: 'center', marginBottom: 1 }} />
                            {stageMessages[status]}
                            <Button
                                onPress={() => { startOnRamp() }}
                                disabled={status === 'error'}
                                uppercase={false}
                                mode="contained"
                                labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
                                style={{ height: 41, marginTop: 60, width: 180, }}
                            >
                                {mainButtonText}
                            </Button>
                        </React.Fragment>
                    )}
                </View>
            </ScrollView>

            {/* Identity Choice Modal */}
            <Portal>
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