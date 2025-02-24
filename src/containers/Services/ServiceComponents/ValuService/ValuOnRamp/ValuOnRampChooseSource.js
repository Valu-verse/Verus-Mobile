import React, { Component, useEffect } from "react"
import { connect } from 'react-redux'

import { primitives } from "verusid-ts-client"

import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

const { ATTESTATION_NAME } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { SafeAreaView, ScrollView, View, TouchableWithoutFeedback, Linking, StyleSheet, Alert, Keyboard, Image } from 'react-native'

import { Divider, List, Button, Text, RadioButton, Portal, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { Valu, VUSDC } from "../../../../../images/customIcons";
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
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert';

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
            const value = this.state.amount // default landing pay amount

            const valuReply = await ValuProvider.getOnRampOptions({ countryCode: location.tax_countries[0].country, amount: value });
            this.setState({
                locations: location,
                taxCountry: location?.tax_countries[0] || [],
                currency: valuReply.currency,
                options: valuReply.options,
                loading: false,
            });
            const fee = valuReply.options ? valuReply.options[this.state.radioValue].feePercentage : 1;
            const cryptoReceived = valuReply.options[this.state.radioValue].amountReceived;

            const converted = Number(value) * (1 - fee / 100);

            const formattedValue = formatCurrency({ amount: Number(cryptoReceived).toFixed(2), code: 'USD' });

            this.setState({
                totalFee: (parseFloat(converted) - parseFloat(value)).toFixed(2),
                options: valuReply.options, loading: false, updatingfee: false
            });
            this.setState({ converted: formattedValue[1] });
        });
    }

    toggleModal = () => {
        this.setState({ modalVisible: !this.state.modalVisible });
    };

    
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
        
        createAlert(
            `Terms and Conditions`,
            `By proceeding with this transaction, you acknowledge and agree that the Polygon tokens you are purchasing will be automatically converted into vUSDC. \n\nThis conversion is conducted on a 1:1 basis and is required to facilitate seamless transactions within our platform.
            \nFor more details, please review our [Terms & Conditions] and/or [FAQ] section.`,
            [
                {
                    text: 'Cancel',
                    onPress: () => resolveAlert(false),
                    style: 'cancel',
                },
                {
                    text: 'Accept & Proceed', onPress: async () => {
                        const reply = await ValuProvider.getOnRampURL({ option: this.state.options[this.state.radioValue], amount: this.state.amount, countryCode: this.state.taxCountry.country });
                        Linking.openURL(reply.url);
                        resolveAlert(true);
                    }
                },
            ],
            {
                cancelable: true,
            },
        )
        
    }
    
    validateAmount(value, min, max) {

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

    
    handleChange(value = null, countryCode = null) {
        const youPay = value || this.state.amount;
        
        this.setState({ loading: true, updatingfee: true, amount: youPay }, async () => {

            
            const radioValue = this.state.radioValue;
            
            const valuReply = await ValuProvider.getOnRampOptions({ countryCode: countryCode || this.state.taxCountry.country, amount: youPay });
            
            this.validateAmount(youPay, valuReply.options[radioValue].minAmount, valuReply.options[radioValue].maxAmount);
            
            const fee = valuReply.options ? valuReply.options[radioValue].feePercentage : 1;
            
            const converted = Number(youPay) * (1 - fee / 100);
            const cryptoReceived = valuReply.options[radioValue].amountReceived;
            
            const formattedValue = formatCurrency({ amount: Number(cryptoReceived).toFixed(2), code: 'USD' });
            
            this.setState({
                totalFee: (parseFloat(converted) - parseFloat(youPay)).toFixed(2),
                options: valuReply.options, loading: false, updatingfee: false
            });
            this.setState({ converted: formattedValue[1] });

            if (countryCode) {
                this.setState({
                    taxCountry: {
                        ...this.state.taxCountry,
                        country: countryCode,
                    },
                    currency: valuReply.currency,
                    options: valuReply.options
                }, () => this.updateTaxCountry())
            }
        });
    };

    render() {

        const feeoptions = "Please select the payment method you would like to use to purchase vUSDC tokens. \n\n" +
            "Polygon: We use the Polygon network to provide the cheapest on-ramp prices.\n";



        return (
            <SafeAreaView style={Styles.defaultRoot}>
                <TouchableWithoutFeedback
                    onPress={Keyboard.dismiss} accessible={false}>
                    <View style={{ alignContent: 'center', alignItems: 'center' }}>
                        <Portal>
                            {this.state.countryModalOpen && (
                                <ListSelectionModal
                                    title="Select a Country"
                                    flexHeight={3}
                                    visible={this.state.countryModalOpen}
                                    onSelect={(item) => {this.handleChange(null, item.key)}}
                                    data={ALLOWED_COUNTRIES.map((code) => {
                                        const item = ISO_3166_COUNTRIES[code];

                                        return {
                                            key: code,
                                            title: `${item.emoji} ${item.name}`,
                                        };
                                    })}
                                    cancel={() => this.setState({ countryModalOpen: false })}
                                />)}
                        </Portal>
                        <Text style={{ fontSize: 18, textAlign: 'center', paddingVertical: 10, fontWeight: 'bold' }}>
                            Buy Crypto
                        </Text>
                        {/* <Image source={ValuOnRampIcon} style={{ aspectRatio: 2, height: 120, alignSelf: 'center', marginBottom: 1 }} /> */}
                        {/* <Text style={{ fontSize: 12, textAlign: 'left', width: 300 }}>
                                You spend
                            </Text> */}
                        <TextInput
                            style={{
                                paddingHorizontal: 10,
                                width: 300,
                                alignSelf: 'center',
                                backgroundColor: "#eeeeee",
                                fontSize: 18,
                            }}
                            mode="outlined"
                            value={this.state.amount}
                            right={<TextInput.Affix text={this.state.currency} />}
                            onChangeText={this.handleChange}
                            keyboardType="numeric"
                            label={`You Pay` + (this.state.error ? this.state.error : "")}
                            error={this.state.error != null}

                        />
                        <TextInput
                            style={{
                                paddingHorizontal: 10,
                                width: 300,
                                alignSelf: 'center',
                                backgroundColor: "#eeeeee",
                                fontSize: 18,
                                marginTop: 20
                            }}
                            mode="outlined"
                            placeholder={`Enter amount in ${this.state.currency}`}

                            value={this.state.loading ? "-" : this.state.converted}
                            right={<TextInput.Affix text={"vUSDC"} />}
                            onChangeText={() => { }}
                            keyboardType="numeric"
                            label={`You Receive` + (this.state.error ? this.state.error : "")}
                            error={this.state.error != null}

                        />

                        <View style={{ alignContent: 'center', alignItems: 'center' }}>
                            <List.Section title=" " style={{ width: 380, marginTop: -30, marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 40 }}>
                                    <Text >Choose Payment Method</Text>
                                    <IconButton
                                        icon="information"
                                        size={25}
                                        iconColor={Colors.verusGreenColor}
                                        onPress={() => { Alert.alert("Purchase Options", feeoptions) }}
                                    />
                                </View>
                                <View style={{ maxHeight: 300}}>
                                    <ScrollView style={{ flexGrow: 0 }}>
                                        {(this.state.loading && !this.state.updatingfee) ? <ActivityIndicator animating={true}
                                            size={100}
                                            style={{
                                                width: 200, height: 200, flex: 1,
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
                                                    <Text style={[styles.tableCell, { flex: 4, fontWeight: "bold", textAlign: "left" }]}>via</Text>
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

                                                        <View style={[styles.tableCell, { flex: 4 }]}>
                                                            <Text style={{ fontSize: 12, color: '#888', textAlign: "left" }}>
                                                                {route.destinationNetworkName} {/* Add description to your route object */}
                                                            </Text>
                                                            <Text style={{ fontSize: 14, textAlign: "left" }}>
                                                                {route.destinationCurrency.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={[styles.tableCell, { flex: 2 }]}>
                                                            {this.state.updatingfee ? <ActivityIndicator animating={true} color='#aaa' size={20} style={{ flex: 3 }} /> : (
                                                                <Text style={{ textAlign: "left" }}>{`${route.feePercentage}%`}</Text>)}
                                                        </View>
                                                        <RadioButton value={index} style={{ flex: 1 }} />
                                                    </View>))}
                                            </RadioButton.Group>}
                                    </ScrollView>
                                </View>
                            </List.Section>
                            <Text style={{ color: '#888' }}>{`Total fee ${this.state.loading ? "-" : isNaN(this.state.totalFee) ? 0 : this.state.totalFee} ${this.state.currency}`}</Text>
                        </View>
                        <Button
                            onPress={() => { this.startOnRamp() }}
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
                                style={{
                                    width: 200,
                                    height: 50,
                                    borderWidth: 1,
                                    borderColor: 'grey',
                                    borderRadius: 5,
                                    padding: 5
                                }}
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
                </TouchableWithoutFeedback>
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