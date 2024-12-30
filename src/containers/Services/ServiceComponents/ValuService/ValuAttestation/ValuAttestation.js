import React, { useEffect, useState, useCallback } from "react"
import { connect, useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native';
import { primitives } from "verusid-ts-client"

import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

const { ATTESTATION_NAME } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { SafeAreaView, ScrollView, View, Image, Linking, AppState } from 'react-native'

import { Divider, List, Button, Text } from 'react-native-paper';
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { AttesationBadge, VUSDC } from "../../../../../images/customIcons";
import { requestAttestationData, requestSeeds } from "../../../../../utils/auth/authBox";
import { ATTESTATIONS_PROVISIONED } from "../../../../../utils/constants/attestations";
import { signIdProvisioningRequest } from '../../../../../utils/api/channels/vrpc/requests/signIdProvisioningRequest';
import { NavigationNotification } from '../../../../../utils/notification';
import { dispatchAddNotification } from '../../../../../actions/actions/notifications/dispatchers/notifications';
import { NOTIFICATION_ICON_VALU } from '../../../../../utils/constants/notifications';
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert';
import { VALU_POL_PAYMENT_PENDING, VALU_POL_PAYMENT_RECEIVED, VALU_POL_PAYMENT_STARTED, VALU_POL_PAYMENT_FAILED } from '../../../../../utils/constants/services';
import AnimatedActivityIndicator from "../../../../../components/AnimatedActivityIndicator";
import ValuProvider from "../../../../../utils/services/ValuProvider";
import { VALU_SERVICE_ID } from "../../../../../utils/constants/services";
import { VALU_SERVICE } from "../../../../../utils/constants/intervalConstants";
import { setServiceLoading } from "../../../../../actions/actionCreators";


const ValuAttestation = ({ props } = props) => {
    const activeAccount = useSelector(state => state.authentication.activeAccount);
    const valuAuthenticated = useSelector(state => state.channelStore_valu_service.authenticated);
    const verusNetwork = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'VRSCTEST' : 'VRSC';
    const [attestationData, setAttestationData] = useState({});
    const [signer, setSigner] = useState("");
    const [valuReply, setValuReply] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [attestationStatus, setAttestationStatus] = useState("");
    const [mainButtonText, setMainButtonText] = useState("START");
    const [signedRequest, setSignedRequest] = useState({});
    const [appState, setAppState] = useState(AppState.currentState);
    const acchash = useSelector(state =>
        state.authentication.activeAccount
    ).accountHash;
    const notifications = useSelector(state =>
        state.notifications
    );

    const buttonMessages = {
        [VALU_POL_PAYMENT_RECEIVED]: "CONTINUE",
        [VALU_POL_PAYMENT_PENDING]: "RESUME",
        [VALU_POL_PAYMENT_STARTED]: "START",
        [VALU_POL_PAYMENT_FAILED]: "RETRY",
        ["VALU_POL_READY"]: "CONTINUE"

    }

    const fetchData = useCallback(async () => {
        // Check for data in the wallet that says there is an attestation present.
        // If there is, then take the user to the attestation page.
        // If there is not, then display the 
        const VALU_ATTESTATION = "isdffds" //TODO: make a function to check whether POL is provisioned
        const attestations = await requestAttestationData(ATTESTATIONS_PROVISIONED);

        if (attestations[VALU_ATTESTATION]) {
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

            setSignedRequest(signedRequestReply);
            const reply = await ValuProvider.getAttestationPaymentStatus({ request: signedRequestReply.toBuffer().toString('base64') })

            if (reply.success === false) {
                throw new Error(reply.error);
            }
            let POLStatus = reply.data.status;
            let POLAttestationStatus = reply.data?.attestation_status;
             setMainButtonText(buttonMessages[POLStatus]);
            setValuReply(reply);
            setStatus(POLStatus);
            setAttestationStatus(POLAttestationStatus);

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
            createAlertDialog(
                `An error occurred while trying to start the Valu Proof of Life Attestation process. ${e.message}`,"RETRY")
        }

    }, [props.navigation]);

    // useFocusEffect(fetchData);

    useEffect(() => {
        initAccountStatus().then(() => {
            fetchData();
        });
    }, []);

    const checkAccountCreationStatus = async () => {
        if (!valuAuthenticated) {
            ValuProvider.reset();
            const seed = (await requestSeeds())[VALU_SERVICE];
            if (seed == null) throw new Error("No Valu seed present");
            await ValuProvider.authenticate(seed);
        }
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
                "Failed to retrieve Valu account status from server.","RETRY",
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
            `Valu Proof of Life Attestation`,
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
            console.log("state set2222222222", status, valuReply)
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
                    newLoadingNotification.title = [`Complete Valu Proof of Life Attestation`]
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
                    `You already have a Valu Proof of Life Attestation in progress.`, "RESUME", () => { Linking.openURL(valuReply.data.url) });

            } else if (status === VALU_POL_PAYMENT_FAILED) {
                createAlertDialog(
                    `Your previous payment attempt failed, would you like to try again?`, "RETRY")
            } else if (status === VALU_POL_PAYMENT_RECEIVED)  {
                const newRep = await ValuProvider.getValuIdDeepLink();
                if (newRep.success === false) {
                    throw new Error(newRep.error);
                }
                Linking.openURL(newRep.data);
            } else if (status === "VALU_POL_READY") {
                const newRep = await ValuProvider.getValuAttestationStatus();
                if (newRep.success === false) {
                    throw new Error(newRep.error);
                }
                Linking.openURL(newRep.data);
            }

            //    throw new Error(reply.error);

            
            //  console.log(newLoadingNotification)
        } catch (e) {
            console.log("state set4", e)
            setLoading(false);
            createAlertDialog(
                `An error occurred while trying to start the Valu Proof of Life Attestation process. ${e}`, "OK"
            )

        }
        //  Linking.openURL(reply);
    }

    const stageMessages = {
        [VALU_POL_PAYMENT_RECEIVED]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Payment received for Valu Proof of Life Attestation. Proceed to get your ValuID.
        </Text>),
        [VALU_POL_PAYMENT_PENDING]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            You already have a Valu Proof of Life Attestation in progress.
        </Text>),
        [VALU_POL_PAYMENT_STARTED]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Purchase a ValuID and KYC attestation off Valu for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),
        "": (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Purchase a ValuID and KYC attestation off Valu for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),
        ["VALU_POL_READY"]: (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Your Valu Proof of Life is ready to retrieve.
        </Text>)
    }

    return (<SafeAreaView style={Styles.defaultRoot}>
        <ScrollView
            style={Styles.fullWidth}
            contentContainerStyle={Styles.focalCenter}>
            <View style={{ alignContent: 'center', alignItems: 'center' }}>
                {loading ? (
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
    </SafeAreaView>)

};

export default ValuAttestation;