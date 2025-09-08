import React, { useEffect, useState, useCallback } from "react"
import { connect, useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { primitives } from "verusid-ts-client"

import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

const { ATTESTATION_NAME } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
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
    VALU_POL_IDENTITY_PROVISIONED_PENDING, VALU_POL_IDENTITY_PROVISIONED, VALU_POL_READY, NOTIFICATION_TYPE_VERUSID_PENDING
} from '../../../../../utils/constants/services';
import AnimatedActivityIndicator from "../../../../../components/AnimatedActivityIndicator";
import ValuProvider from "../../../../../utils/services/ValuProvider";
import { VALU_SERVICE_ID } from "../../../../../utils/constants/services";
import { VALU_SERVICE } from "../../../../../utils/constants/intervalConstants";
import { setServiceLoading } from "../../../../../actions/actionCreators";
import { updatePendingVerusIds } from "../../../../../actions/actions/channels/verusid/dispatchers/VerusidWalletReduxManager"
import { setRequestedVerusId } from '../../../../../actions/actions/services/dispatchers/verusid/verusid';


const ValuAttestation = (props) => {
    const activeAccount = useSelector(state => state.authentication.activeAccount);
    const signedIn = useSelector(state => state.authentication.signedIn);
    const valuAuthenticated = useSelector(state => state.channelStore_valu_service.authenticated);
    const verusNetwork = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'VRSCTEST' : 'VRSC';
    const [attestationData, setAttestationData] = useState({});
    const [signer, setSigner] = useState("");
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
    const acchash = useSelector(state =>
        state.authentication.activeAccount
    ).accountHash;
    const notifications = useSelector(state =>
        state.notifications
    );
    const encryptedIds = useObjectSelector(state => state.services.stored[VERUSID_SERVICE_ID]);

    const buttonMessages = {
        [VALU_POL_PAYMENT_STARTED]: "START",
        [VALU_POL_PAYMENT_PENDING]: "RESUME",
        [VALU_POL_PAYMENT_RECEIVED]: "CONTINUE",
        [VALU_POL_PAYMENT_FAILED]: "RETRY",
        [VALU_POL_READY]: "CONTINUE",
        [VALU_POL_IDENTITY_PROVISIONED_PENDING]: "WAIT FOR IDENTITY",
        [VALU_POL_IDENTITY_PROVISIONED]: "CONTINUE"

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

            // Navigate home (reset stack)
            resetToHome();
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
                `An error occurred while trying to start the Valu Proof of Humanity process. ${e.message}`, "RETRY")
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
        await provisionNewIdentity(chosenIdentity, 'ValuChooseIdentity screen');
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
            // Use the selected identity's name for the deep link
            const identityName = linkedIds[verusNetwork] && linkedIds[verusNetwork][iAddress];
            if (!identityName) {
                throw new Error("Identity name not found");
            }
            const newRep = await ValuProvider.getValuIdDeepLink({ identityName, isNew: false });
            if (newRep.success === false) {
                throw new Error(newRep.error);
            }
            console.log("newRep", newRep.data);
            // Trigger internal deeplink handler instead of opening externally
            updateDeeplinkUrl(newRep.data);
            setLoading(false);
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
        await provisionNewIdentity(identityName, 'new identity request');
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
            console.log("Registered user authentication failed:", error);
        }

        // If registered user authentication fails or user not authenticated, use fallback authentication

        ValuProvider.reset();
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
            `Valu Proof of Humanity Attestation`,
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
                    newLoadingNotification.title = [`Complete Valu Proof of Humanity`]
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
                    `You already have a Valu Proof of Humanity in progress.`, "RESUME", () => { Linking.openURL(valuReply.data.url) });

            } else if (status === VALU_POL_PAYMENT_FAILED) {
                createAlertDialog(
                    `Your previous payment attempt failed, would you like to try again?`, "RETRY")
            } else if (status === VALU_POL_PAYMENT_RECEIVED) {
                // Show identity choice modal first instead of directly navigating
                setLoading(false);
                showIdentityChoiceModal();
                return;
            } else if (status === "VALU_POL_READY") {
                const newRep = await ValuProvider.getValuAttestationStatus();
                if (newRep.success === false) {
                    throw new Error(newRep.error);
                }
                // Trigger internal deeplink handler instead of opening externally
                updateDeeplinkUrl(newRep.data);
            }

            //    throw new Error(reply.error);


            //  console.log(newLoadingNotification)
        } catch (e) {
            console.log("startOnRamp error", e)
            setLoading(false);
            createAlertDialog(
                `An error occurred while trying to start the Valu Proof of Humanity process. ${e}`, "OK"
            )

        }
        //  Linking.openURL(reply);
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
            Purchase a ValuID and KYC attestation off Valu for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),
        ["VALU_POL_READY"]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Your Valu Proof of Humanity is ready to retrieve.
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