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
import { ValuOnRamp as ValuOnRampIcon, VUSDC } from "../../../../../images/customIcons";
import ValuService from '../../../../../utils/services/ValuService';

class ValuOnRamp extends Component {
    constructor(props) {
        super(props);
        this.state = {
            attestationData: {},
            signer: ""
        };
    }

    componentDidMount() {
        this.updateDisplay();
    }

    updateDisplay() {

    }

    async startOnRamp() {

        const reply = await ValuService.build().getOnRampURL();

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
                            Valu On Ramp
                        </Text>
                        <Image source={ValuOnRampIcon} style={{ aspectRatio: 2, height: 120, alignSelf: 'center', marginBottom: 1 }} />
                        <Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal:10 }}>
                            Purchase vUSDC tokens on Verus from your bank account or credit/debit card.
                        </Text>
                        <Image source={VUSDC} style={{ aspectRatio: 1.1, height: 80, alignSelf: 'center', marginTop: 50 }} />
                        <Text style={{ fontSize: 20, textAlign: 'center', paddingBottom: 20 }}>
                            vUSDC
                        </Text>
                        <Button
                            onPress={() => {this.startOnRamp() }}
                            uppercase={false}
                            mode="contained"
                            labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
                            style={{ height: 41, marginTop: 6, width: 180, }}
                        >
                            {'Buy vUSDC'}
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

export default connect(mapStateToProps)(ValuOnRamp);