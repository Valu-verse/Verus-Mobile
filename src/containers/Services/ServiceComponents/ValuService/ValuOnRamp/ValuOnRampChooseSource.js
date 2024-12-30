import React, { Component, useEffect } from "react"
import { connect } from 'react-redux'

import { primitives } from "verusid-ts-client"

import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

const { ATTESTATION_NAME } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { SafeAreaView, ScrollView, View, Image, Linking, StyleSheet, Alert } from 'react-native'

import { Divider, List, Button, Text, RadioButton, Portal, TextInput, IconButton, ActivityIndicator, MD2Colors } from 'react-native-paper';
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { ValuOnRamp as ValuOnRampIcon, VUSDC } from "../../../../../images/customIcons";
import ValuService from '../../../../../utils/services/ValuService';
import { provideCustomBackButton } from "../../../../../utils/navigation/customBack";
import {
    formatCurrency,
    getSupportedCurrencies,
} from "react-native-format-currency";
import { ISO_3166_COUNTRIES, ISO_3166_ALPHA_2_CODES } from "../../../../../utils/constants/iso3166";
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
const { IDENTITY_HOMEADDRESS_COUNTRY } = primitives;
import { requestPersonalData } from "../../../../../utils/auth/authBox";
import { PERSONAL_LOCATIONS } from "../../../../../utils/constants/personal";
import { modifyPersonalDataForUser } from "../../../../../actions/actionDispatchers";
import ValuProvider from "../../../../../utils/services/ValuProvider";

const ALLOWED_COUNTRIES = ["US", "CA", "GB", "AT", // Austria
    "BE", // Belgium
    //"BG", // Bulgaria
    "CY", // Cyprus
    "CZ", // Czech Republic
    //  "DK", // Denmark
    "EE", // Estonia
    "FI", // Finland
    "FR", // France
    "DE", // Germany
    "GR", // Greece
    //  "HU", // Hungary
    "IE", // Ireland
    "IT", // Italy
    "LV", // Latvia
    "LT", // Lithuania
    "LU", // Luxembourg
    "MT", // Malta
    "NL", // Netherlands
    //  "PL", // Poland
    "PT", // Portugal
    "RO", // Romania
    "SK", // Slovakia
    "SI", // Slovenia
    "ES", // Spain
    //  "SE"  // Sweden
];

const routes = [
    { route: 'Stripe-Base', fee: '3%', value: 0 },
    { route: 'Verus Ethereum Bridge', fee: '2% + $60', value: 1 },
    { route: 'Paybis-Stellar', fee: '4%', value: 2 },
];

class ValuOnRampChooseSource extends Component {
    constructor(props) {
        super(props);
        this.state = {
            attestationData: {},
            signer: "",
            radioValue: 0,
            amount: "100",
            converted: 0,
            modalVisible: false,
            taxCountry: null,
            currency: "USD",
            countryModalOpen: false,
            address: {},
            locations: {},
            options: [],
            loading: false,
            updatingfee: false,
            totalFee: "0",
            error: null
        };
        this.handleChange = this.handleChange.bind(this);
    }

    componentDidMount() {
        this.setState({ loading: true }, async () => {
            const location = await requestPersonalData(PERSONAL_LOCATIONS);

            const valuReply = await ValuProvider.getOnRampOptions({ countryCode: location.tax_countries[0].country, amount: 100 });
            this.setState({
                locations: location,
                taxCountry: location.tax_countries[0] || [],
                currency: valuReply.currency,
                options: valuReply.options,
                loading: false,
            });
        });
    }

    toggleModal = () => {
        this.setState({ modalVisible: !this.state.modalVisible });
    };

    async selectCountry(countryCode) {
        const valuReply = await ValuProvider.getOnRampOptions({ countryCode: countryCode, amount: Number(this.state.amount) });
        this.setState({
            taxCountry: {
                ...this.state.taxCountry,
                country: countryCode,
            },
            currency: valuReply.currency,
            options: valuReply.options
        }, () => this.updateTaxCountry())
    }

    updateTaxCountry() {
        this.setState({ loading: true }, async () => {
            let taxCountries = this.state.locations.tax_countries

            taxCountries = [this.state.taxCountry]

            await modifyPersonalDataForUser(
                { ...this.state.locations, tax_countries: taxCountries },
                PERSONAL_LOCATIONS,
                this.props.activeAccount.accountHash
            );

            this.setState({
                loading: false
            });
        })
    }

    async startOnRamp() {

        const reply = await ValuProvider.getOnRampURL({option: this.state.options[this.state.radioValue], amount: this.state.amount, countryCode: this.state.taxCountry.country });

        console.log(reply);

        Linking.openURL(reply.url);
    }

    validateAmount(value, min, max) {
        console.log(value, min, max);
        if (isNaN(value)) {
            this.setState({ error: " - Please enter a valid number" });
            return false;
        }

        if (Number(value) < Number(min)) {
            this.setState({ error: ` - Min ${min}` });
            return false;
        }

        if (Number(value) > Number(max)) {
            this.setState({ error: ` - Max ${(formatCurrency({ amount: Number(max).toFixed(2), code: 'USD' }))[1]}` });
            return false;
        }

        this.setState({ error: null });
        return true;

    }

    handleChange(value) {
        this.setState({ loading: true, updatingfee: true, amount: value }, async () => {
            const valuReply = await ValuProvider.getOnRampOptions({ countryCode: this.state.taxCountry.country, amount: value });

            this.validateAmount(value, valuReply.options[this.state.radioValue].minAmount, valuReply.options[this.state.radioValue].maxAmount);

            const fee = valuReply.options ? valuReply.options[this.state.radioValue].feePercentage : 1;

            const converted = Number(value) * (1 - fee / 100);

            const formattedValue = formatCurrency({ amount: Number(converted).toFixed(2), code: 'USD' });

            this.setState({
                totalFee: (parseFloat(converted) - parseFloat(value)).toFixed(2),
                options: valuReply.options, loading: false, updatingfee: false
            });
            this.setState({ converted: formattedValue[1] });
        });
    };

    render() {

        const feeoptions = "Please select the payment method you would like to use to purchase vUSDC tokens. \n\n" +
            "Stripe-Base: Using stripe payments to Base network < $1,000\n\n" +
            "Stripe-ETH-Verus Ethereum Bridge: Using stripe to Etheruem on ETH then through the Verus bridge > $1,000 \n\n" +
            "Paybis-Stellar: Using Paybis payments to Stellar network < $1,000\n";



        return (
            <SafeAreaView style={Styles.defaultRoot}>
                <ScrollView
                    style={Styles.fullWidth}
                    contentContainerStyle={Styles.focalCenter}>
                    <View style={{ alignContent: 'center', alignItems: 'center' }}>
                        <Portal>

                            {this.state.countryModalOpen && (
                                <ListSelectionModal
                                    title="Select a Country"
                                    flexHeight={3}
                                    visible={this.state.countryModalOpen}
                                    onSelect={(item) => this.selectCountry(item.key)}
                                    data={ALLOWED_COUNTRIES.map((code) => {
                                        const item = ISO_3166_COUNTRIES[code];

                                        return {
                                            key: code,
                                            title: `${item.emoji} ${item.name}`,
                                        };
                                    })}
                                    cancel={() => this.setState({ countryModalOpen: false })}
                                />
                            )}
                        </Portal>


                        <Text style={{ fontSize: 25, textAlign: 'center', paddingVertical: 5 }}>
                            Valu On Ramp
                        </Text>
                        {/* <Image source={ValuOnRampIcon} style={{ aspectRatio: 2, height: 120, alignSelf: 'center', marginBottom: 1 }} /> */}
                        {/* <Text style={{ fontSize: 12, textAlign: 'left', width: 300 }}>
                                You spend
                            </Text> */}
                        <TextInput
                            style={{
                                borderWidth: 1, // Set the border width
                                paddingHorizontal: 10,
                                width: 300,
                                alignSelf: 'center',
                                backgroundColor: "#eeeeee",
                                fontSize: 18,
                            }}
                            placeholder={`Enter amount in ${this.state.currency}`}
                            value={this.state.amount}
                            onChangeText={this.handleChange}
                            keyboardType="numeric"
                            label={`${this.state.currency}` + (this.state.error ? this.state.error : "")}
                            error={this.state.error != null}

                        />

                        <View style={{ alignContent: 'center', alignItems: 'center' }}>
                            <List.Section title=" " style={{ width: 380, marginTop: -30 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text >Choose Payment Method</Text>
                                    <IconButton
                                        icon="information"
                                        color={Colors.primaryColor}
                                        onPress={() => { Alert.alert("Purchase Options", feeoptions) }}
                                    />
                                </View>
                                <View style={{ maxHeight: 300, height: 300 }}>
                                    <ScrollView style={{ flexGrow: 0 }}>
                                        {(this.state.loading && !this.state.updatingfee) ? <ActivityIndicator animating={true}
                                            size={100}
                                            style={{
                                                width: 300, height: 300, flex: 1,
                                                alignSelf: 'center',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }} /> :
                                            <RadioButton.Group
                                                value={this.state.radioValue}
                                                onValueChange={(value) => { this.setState({ radioValue: value }, () => this.handleChange(this.state.amount)); }}
                                            >
                                                <View style={[styles.tableRow, { marginRight: 20 }]}>
                                                    <Text style={[styles.tableCell, { flex: 4, fontWeight: "bold", textAlign: "left" }]}>Method</Text>
                                                    <Text style={[styles.tableCell, { flex: 3, fontWeight: "bold" }]}>via</Text>
                                                    <Text style={[styles.tableCell, { flex: 3, fontWeight: "bold", textAlign: "left" }]}>Fee</Text>
                                                </View>
                                                {this.state.options.map((route, index) => (
                                                    <View key={index} style={[styles.tableRow, { marginRight: 20 }]}>
                                                        <View style={[styles.tableCell, { flex: 4 }]}>
                                                            <Text style={{ fontSize: 12, color: '#888', textAlign: "left" }}>
                                                                {route.provider || 'Payment Provider'} {/* Add description to your route object */}
                                                            </Text>
                                                            <Text style={{ fontSize: 14, textAlign: "left" }}>
                                                                {route.paymentMethod}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.tableCell, { flex: 3, textAlign: "right" }]}>{route.destinationCurrency.toUpperCase()}</Text>
                                                        {this.state.updatingfee ? <ActivityIndicator animating={true} color='#aaa' size={20} style={{ flex: 3 }} /> : (
                                                            <Text style={[styles.tableCell, { flex: 3 }]}>{`${route.feePercentage}%`}</Text>)}
                                                        <RadioButton value={index} style={{ flex: 1 }} />
                                                    </View>))}
                                            </RadioButton.Group>}
                                    </ScrollView>
                                </View>
                            </List.Section>
                            <Text style={{ marginTop: 10 }}>{`You will receive ${this.state.loading ? "-" : this.state.converted} vUSDC`}</Text>
                            <Text style={{ color: '#888' }}>{`Total fee ${this.state.loading ? "-" : isNaN(this.state.totalFee) ? 0 : this.state.totalFee} vUSDC`}</Text>
                        </View>
                        <Button
                            onPress={() => {this.startOnRamp() }}
                            uppercase={false}
                            mode="contained"
                            disabled={this.state.loading || this.state.error != null}
                            labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
                            style={{ height: 41, marginTop: 6, width: 180, }}
                        >
                            {'Buy vUSDC'}
                        </Button>
                        <React.Fragment >
                            <List.Subheader>{"Country"}</List.Subheader>
                            <List.Item
                                style={{ width: 200, height: 50 }}
                                title={
                                    ISO_3166_COUNTRIES[this.state.taxCountry?.country] == null
                                        ? "Select a country"
                                        : `${ISO_3166_COUNTRIES[this.state.taxCountry.country].emoji} ${ISO_3166_COUNTRIES[this.state.taxCountry.country].name
                                        }`
                                }
                                titleStyle={{
                                    color: "black"
                                }}
                                right={(props) => (
                                    <List.Icon {...props} icon={"account-edit"} size={20} />
                                )}
                                onPress={
                                    this.state.loading
                                        ? () => { }
                                        : () => this.setState({ countryModalOpen: true })
                                }
                            />
                        </React.Fragment>
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

const styles = StyleSheet.create({
    input: {
        height: 40,
        borderColor: 'black', // Set the border color to black
        borderWidth: 1, // Set the border width
        paddingHorizontal: 10,
        width: 300,
        alignSelf: 'center',
        backgroundColor: "#eeeeee",
    },
    picker: {
        height: 50,
        width: '80%',
        alignSelf: 'center',
        marginBottom: 20,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    tableCell: {
        flex: 1,
        textAlign: 'center',
    },
});

export default connect(mapStateToProps)(ValuOnRampChooseSource);