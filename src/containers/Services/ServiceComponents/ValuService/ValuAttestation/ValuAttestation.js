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
import ValuService from '../../../../../utils/services/ValuService';
import { requestAttestationData } from "../../../../../utils/auth/authBox";
import { ATTESTATIONS_PROVISIONED } from "../../../../../utils/constants/attestations";
import { signIdProvisioningRequest } from '../../../../../utils/api/channels/vrpc/requests/signIdProvisioningRequest';
import { NavigationNotification } from '../../../../../utils/notification';
import { dispatchAddNotification } from '../../../../../actions/actions/notifications/dispatchers/notifications';
import { NOTIFICATION_ICON_VALU } from '../../../../../utils/constants/notifications';
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert';
import { VALU_POL_PAYMENT_PENDING, VALU_POL_PAYMENT_RECEIVED, VALU_POL_PAYMENT_STARTED, VALU_POL_PAYMENT_FAILED } from '../../../../../utils/constants/services';
import AnimatedActivityIndicator from "../../../../../components/AnimatedActivityIndicator";


const ValuAttestation = ({ navigation }) => {
    const activeAccount = useSelector(state => state.authentication.activeAccount)
    const verusNetwork = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'VRSCTEST' : 'VRSC';
    const [attestationData, setAttestationData] = useState({});
    const [signer, setSigner] = useState("");
    const [valuReply, setValuReply] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [mainButtonText, setMainButtonText] = useState("START");
    const [signedRequest, setSignedRequest] = useState({});
    const [appState, setAppState] = useState(AppState.currentState);
    const asdf=234

    const fetchData = useCallback(() => {
        // Check for data in the wallet that says there is an attestation present.
        // If there is, then take the user to the attestation page.
        // If there is not, then display the 
        const VALU_ATTESTATION = "isdffds"
        requestAttestationData(ATTESTATIONS_PROVISIONED).then((attestations) => {
            if (attestations[VALU_ATTESTATION]) {
                navigation.navigate('Attestation', { attestations: attestations });
                return;
            }
        }).then(() => {
            setLoading(true);

            const provisionRequest = new primitives.LoginConsentProvisioningRequest({
                signing_address: activeAccount.keys[verusNetwork].vrpc.addresses[0],
                challenge: new primitives.LoginConsentProvisioningChallenge({
                    challenge_id: "i4c69dWkwS5XvuuuqbbA7J9W7kfSk2SnQm", //"name": "valuid.vrsc::attestation.session"
                    created_at: Number((Date.now() / 1000).toFixed(0)),
                    name: "Valu attestation session",
                }),
            });

            signIdProvisioningRequest({ id: verusNetwork }, provisionRequest).then((signedRequestReply) => {
                setSignedRequest(signedRequestReply);
                ValuService.build().getAttestationPaymentStatus({ request: signedRequestReply.toBuffer().toString('base64') }).then((reply) => {

                    let POLStatus = reply.data.status;
                    console.log("state set1vcfd", reply);
                    setMainButtonText(POLStatus === VALU_POL_PAYMENT_PENDING ? "RESUME" : POLStatus === VALU_POL_PAYMENT_RECEIVED ? "CONTINUE" : "START");
                    setLoading(false);
                    setValuReply(reply);
                    setStatus(POLStatus);

                    if (reply.success === false) {
                        throw new Error(reply.error);
                    }

                    if (POLStatus === VALU_POL_PAYMENT_FAILED) {
                        createAlertDialog(
                            `Your previous payment attempt failed, would you like to try again?`, "RETRY", () => {
                                ValuService.build().retryAttestationPayment({ request: signedRequestReply.toBuffer().toString('base64') }).then((innerreply) => {
                                    setValuReply(innerreply);
                                    setStatus(POLStatus);
                                    Linking.openURL(innerreply.data.url)});
                                })
                    } else if (POLStatus === VALU_POL_PAYMENT_RECEIVED) {
                        // maybe add notification.
                    }

                }).catch((e) => {
                    console.log("stateg set4x4a", e)
                    setLoading(false);
                    setStatus("error");
                    createAlert(
                        `Valu Proof of Life Attestation`,
                        `An error occurred while trying to start the Valu Proof of Life Attestation process. ${e.message}`)
                })

            });

        })
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    const createAlertDialog = (message, button, func = ()=>{}) => {
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
            { cancelable: true })
    }

    const startOnRamp = async () => {

        try {
            console.log("state set2", status, valuReply)
            if (status === VALU_POL_PAYMENT_STARTED) {
                const newRep = await ValuService.build().getAttestationPaymentURL({ request: signedRequest.toBuffer().toString('base64') })
               
                Linking.openURL(newRep.data.url);
                setLoading(true);
                const newLoadingNotification = new NavigationNotification();

                newLoadingNotification.body = "Continue";
                newLoadingNotification.title = [`Complete Valu Proof of Life Attestation`]
                newLoadingNotification.acchash = activeAccount.accountHash;
                newLoadingNotification.icon = NOTIFICATION_ICON_VALU;
                newLoadingNotification.navigate = () => {
                    navigation.navigate('ServicesHome', {
                        screen: 'ValuAttestation',
                    });
                };

                dispatchAddNotification(newLoadingNotification);

            } else if (status === VALU_POL_PAYMENT_PENDING) {
                createAlertDialog(
                    `You already have a Valu Proof of Life Attestation in progress.`, "RESUME", () => {Linking.openURL(valuReply.data.url)});

            } else if (status === VALU_POL_PAYMENT_FAILED) {
                createAlertDialog(
                    `Your previous payment attempt failed, would you like to try again?`, "RETRY")
            } else if (status === VALU_POL_PAYMENT_RECEIVED) { 
                const newRep = await ValuService.build().getValuIdDeepLink({ request: signedRequest.toBuffer().toString('base64') });
                if (newRep.success === false) {
                    throw new Error(newRep.error);
                }
                Linking.openURL(newRep.data);
            }

            //    throw new Error(reply.error);


            //  console.log(newLoadingNotification)
        } catch (e) {
            console.log("state set4", e)
            createAlert(
                `Valu Proof of Life Attestation`,
                `An error occurred while trying to start the Valu Proof of Life Attestation process. ${e}`
            )

        }
        //  Linking.openURL(reply);
    }

    const stageMessages = {
        [VALU_POL_PAYMENT_RECEIVED] :(<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Payment received for Valu Proof of Life Attestation. Proceed to get your ValuID.
        </Text>),
        [VALU_POL_PAYMENT_PENDING] : (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            You already have a Valu Proof of Life Attestation in progress.
        </Text>),
        [VALU_POL_PAYMENT_STARTED] : (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Purchase a ValuID and KYC attestation off Valu for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),
        "" : (<Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 50 }}>
            Purchase a ValuID and KYC attestation off Valu for:<Text style={{ fontWeight: 'bold' }}> $10 USD</Text>
        </Text>),



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