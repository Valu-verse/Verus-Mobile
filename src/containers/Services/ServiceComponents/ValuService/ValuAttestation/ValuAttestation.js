import React, { Component } from "react"
import { connect } from 'react-redux'

import { primitives } from "verusid-ts-client"

import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfDataKeys";

const { ATTESTATION_NAME } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { SafeAreaView, ScrollView, View, Image, Linking } from 'react-native'

import { Divider, List, Button, Text } from 'react-native-paper';
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { AttesationBadge, VUSDC } from "../../../../../images/customIcons";
import ValuService from '../../../../../utils/services/ValuService';

class ValuAttestation extends Component {
    constructor(props) {
        super(props);
        this.state = {
            attestationData: {},
            signer: ""
        };
    }

    componentDidMount() {
               
        // Check for data in the wallet that says there is an attestation present.
        // If there is, then take the user to the attestation page.
        // If there is not, then display the 
        requestAttestationData(ATTESTATIONS_PROVISIONED).then((attestations) => {

                        
            if (attestations[VALU_ATTESTATION]) {
                this.props.navigation.navigate('Attestation', {attestations: attestations});
            }

        })
        this.updateDisplay();
    }

    updateDisplay() {

    }

    async startOnRamp() {

        const reply = await ValuService.build().getAttestationPaymentURL();

        console.log(reply);
        Linking.openURL(reply);
    }

    render() {
        return (
            <SafeAreaView style={Styles.defaultRoot}>
                <ScrollView
                    style={Styles.fullWidth}
                    contentContainerStyle={Styles.focalCenter}>
                    <View style={{ alignContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 25, textAlign: 'center', paddingBottom: 20 }}>
                            Valu Attestation Service
                        </Text>
                        <Image source={AttesationBadge} style={{ aspectRatio: 1.5, height: 120, alignSelf: 'center', marginBottom: 1 }} />
                        <Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal:50 }}>
                            
                            Purchase a ValuID and KYC attestation off Valu for:<Text style={{ fontWeight: 'bold' }}> 10 vUSDC</Text> 
                        </Text>
                        <Button
                            onPress={() => {this.startOnRamp() }}
                            uppercase={false}
                            mode="contained"
                            labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
                            style={{ height: 41, marginTop: 60, width: 180, }}
                        >
                            {'Start'}
                        </Button>
                    </View>
                </ScrollView>
            </SafeAreaView>)
    }
}

const mapStateToProps = (state) => {
    return {
        activeAccount: state.authentication.activeAccount,
        encryptedPersonalData: state.personal
    }
};

export default connect(mapStateToProps)(ValuAttestation);