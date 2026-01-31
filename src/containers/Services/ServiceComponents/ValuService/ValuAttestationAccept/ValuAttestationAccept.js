import React, { Component } from "react"
import { connect } from 'react-redux'
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native'
import { Divider, List, Button, Text, Card } from 'react-native-paper'

import { primitives } from "verusid-ts-client"
import { VdxfUniValue } from "verus-typescript-primitives/dist/pbaas/VdxfUniValue"
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys"
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData"

const { ATTESTATION_NAME, DataDescriptorKey } = primitives

import Styles from "../../../../../styles"
import Colors from '../../../../../globals/colors'
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert'

class ValuAttestationAccept extends Component {
    constructor(props) {
        super(props);
        this.state = {
            attestationData: {},
            signer: "",
            processing: false,
            transactionData: null
        };
    }

    componentDidMount() {
        this.updateDisplay();
    }

    getAttestationData = (dataDescriptors) => {
        const data = {};
        dataDescriptors.forEach((dataDescriptor) => {
            const label = dataDescriptor[DataDescriptorKey.vdxfid].label;
            let key = "";

            if (label === ATTESTATION_NAME.vdxfid) {
                key = `Attestation name`
            } else {
                key = IdentityVdxfidMap[label]?.EN || label;
            }

            const mime = dataDescriptor[DataDescriptorKey.vdxfid].mimetype || "";
            if (mime.startsWith("text/")) {
                data[key] = { "message": dataDescriptor[DataDescriptorKey.vdxfid].objectdata.message };
            } else if (mime.startsWith("image/")) {
                if (mime === "image/jpeg" || mime === "image/png") {
                    data[key] = { "image": `data:${mime};base64,${Buffer.from(dataDescriptor[DataDescriptorKey.vdxfid].objectdata, "hex").toString("base64")}` };
                }
            }
        });

        return data;
    }

    updateDisplay() {
        const { attestation, transactionData } = this.props.route.params;
        
        if (attestation) {
            try {
                // Check if this is a demo/mock attestation
                if (attestation.data === "demo_mock_data") {
                    // Handle demo data
                    const mockAttestationData = {
                        "Full Name": { "message": "John Doe" },
                        "Email": { "message": "john.doe@example.com" },
                        "Country": { "message": "United States" },
                        "KYC Status": { "message": "Verified" },
                        "Verification Date": { "message": new Date().toLocaleDateString() }
                    };
                    
                    this.setState({ 
                        attestationData: mockAttestationData, 
                        signer: attestation.signer,
                        transactionData: transactionData || null
                    });
                } else {
                    // Handle real attestation data
                    const dataDescriptorObject = new VdxfUniValue();
                    dataDescriptorObject.fromBuffer(Buffer.from(attestation.data, "hex"));
                    
                    const vdxfObjectsKeys = {};
                    dataDescriptorObject.values.map((value) => vdxfObjectsKeys[Object.keys(value)[0]] = Object.values(value)[0]);

                    const attestationItems = vdxfObjectsKeys[VDXF_Data.MMRDescriptorKey.vdxfid].dataDescriptors;
                    const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);
                    const containingData = this.getAttestationData(attestationDataDescriptors);
                    
                    this.setState({ 
                        attestationData: containingData, 
                        signer: attestation.signer,
                        transactionData: transactionData || null
                    });
                }
            } catch (error) {
                console.error("Error parsing attestation data:", error);
                // Set fallback data in case of parsing errors
                this.setState({ 
                    attestationData: { "Error": { "message": "Failed to parse attestation data" } }, 
                    signer: attestation.signer || "Unknown Signer",
                    transactionData: transactionData || null
                });
            }
        }
    }

    handleAcceptAttestation = () => {
        createAlert(
            "Accept Private Identity",
            "🎉 You're about to accept your verified private identity! This will securely store your credentials on the blockchain, enabling instant verification for all future transactions while keeping your personal information completely private.",
            [
                {
                    text: 'Cancel',
                    onPress: () => resolveAlert(false),
                    style: 'cancel',
                },
                {
                    text: '✨ Accept Identity',
                    onPress: () => {
                        this.processAcceptAttestation();
                        resolveAlert(true);
                    }
                },
            ],
            { cancelable: true }
        );
    }

    processAcceptAttestation = async () => {
        this.setState({ processing: true });
        
        try {
            // TODO: Implement the actual attestation acceptance logic
            // This might involve storing the attestation locally or sending it to a servic
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Navigate back to the main screen or show success
            this.navigateToComplete();
            
        } catch (error) {
            console.error("Error accepting private identity:", error);
            createAlert(
                "Error", 
                "Failed to accept the private identity. Please try again.",
                [{ text: 'OK', onPress: () => resolveAlert(false) }]
            );
        } finally {
            this.setState({ processing: false });
        }
    }

    navigateToComplete = () => {
        // Navigate back to the main ValuServiceAccount screen
        if (this.props.setSubScreen) {
            // Use the setSubScreen method from parent ValuServiceAccount
            this.props.setSubScreen(null); // null resets to main screen
        } else {
            // Fallback: try to navigate back in the navigation stack
            this.props.navigation.goBack();
        }
    }

    renderTransactionSummary() {
        const { transactionData } = this.state;
        
        if (!transactionData) return null;

        return (
            <Card style={styles.transactionCard}>
                <Card.Content>
                    <Text style={styles.cardTitle}>Transaction Completed</Text>
                    <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Amount:</Text>
                        <Text style={styles.transactionValue}>
                            {transactionData.amount} {transactionData.currency || 'USD'}
                        </Text>
                    </View>
                    <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Received:</Text>
                        <Text style={styles.transactionValue}>
                            {transactionData.received} vUSDC
                        </Text>
                    </View>
                    <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>To Address:</Text>
                        <Text style={[styles.transactionValue, styles.addressText]}>
                            {transactionData.address || 'Your Wallet'}
                        </Text>
                    </View>
                </Card.Content>
            </Card>
        );
    }

    renderAttestationData() {
        const { attestationData, signer } = this.state;

        return (
            <Card style={styles.attestationCard}>
                <Card.Content>
                    <Text style={styles.celebrationEmoji}>🎉</Text>
                    <Text style={styles.cardTitle}>Identity Verification Complete!</Text>
                    <Text style={styles.signerText}>
                        Verified by: <Text style={styles.signerName}>{signer}</Text>
                    </Text>
                    
                    <Text style={styles.attestationDescription}>
                        Congratulations! Your identity has been successfully verified and you've received a private identity attestation. 
                        This secure credential will enable faster, seamless transactions while keeping your personal information private.
                    </Text>

                    {Object.keys(attestationData).length > 0 && (
                        <View style={styles.attestationDataContainer}>
                            <Text style={styles.dataTitle}>✅ Verified Information:</Text>
                            {Object.keys(attestationData).map(key => (
                                <React.Fragment key={key}>
                                    <List.Item
                                        title={key}
                                        description={attestationData[key]?.message}
                                        titleStyle={styles.listItemTitle}
                                        descriptionStyle={styles.listItemDescription}
                                        right={() => attestationData[key]?.image ? 
                                            <List.Icon icon={{ uri: attestationData[key]?.image }} /> : null
                                        }
                                        style={styles.compactListItem}
                                    />
                                    {Object.keys(attestationData).indexOf(key) < Object.keys(attestationData).length - 1 && 
                                        <Divider style={styles.divider} />
                                    }
                                </React.Fragment>
                            ))}
                        </View>
                    )}

                    <Text style={styles.benefitsTitle}>🔐 Benefits:</Text>
                    <Text style={styles.benefitsText}>• Skip future KYC • Enhanced privacy • Faster processing • Secure storage</Text>
                </Card.Content>
            </Card>
        );
    }

    render() {
        const { processing } = this.state;

        return (
            <SafeAreaView style={Styles.defaultRoot}>
                <ScrollView 
                    style={Styles.fullWidth}
                    contentContainerStyle={styles.scrollContainer}
                >
                    <View style={styles.container}>
                      
                        
                        {this.renderTransactionSummary()}
                        
                        {/* Button positioned between transaction summary and identity verification */}
                        <View style={styles.buttonContainer}>
                            <Button
                                mode="contained"
                                onPress={this.handleAcceptAttestation}
                                disabled={processing}
                                loading={processing}
                                style={[styles.button, styles.acceptButton]}
                                labelStyle={styles.buttonLabel}
                                icon="shield-check"
                            >
                                Accept Private Identity
                            </Button>

                            <Text style={styles.helpText}>
                                Your private identity is ready to be downloaded to your VALU wallet
                            </Text>
                        </View>

                        {this.renderAttestationData()}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        padding: 15,
        paddingBottom: 30, // Reduced padding since button is now at top
    },
    container: {
        flex: 1,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        color: Colors.verusGreenColor,
    },
    celebrationEmoji: {
        fontSize: 30,
        textAlign: 'center',
        marginBottom: 5,
    },
    transactionCard: {
        width: '100%',
        marginBottom: 15,
        backgroundColor: '#f0f8ff',
        elevation: 3,
    },
    attestationCard: {
        width: '100%',
        marginBottom: 15,
        backgroundColor: '#ffffff',
        elevation: 5,
        borderColor: Colors.verusGreenColor,
        borderWidth: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: Colors.verusGreenColor,
        textAlign: 'center',
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    transactionLabel: {
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    transactionValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        flex: 2,
        textAlign: 'right',
    },
    addressText: {
        fontSize: 12,
    },
    signerText: {
        fontSize: 15,
        marginBottom: 10,
        textAlign: 'center',
    },
    signerName: {
        fontWeight: 'bold',
        color: Colors.primaryColor,
    },
    attestationDescription: {
        fontSize: 14,
        lineHeight: 18,
        color: '#333',
        textAlign: 'center',
        marginBottom: 15,
        paddingHorizontal: 10,
    },
    attestationDataContainer: {
        marginTop: 8,
        marginBottom: 8,
    },
    dataTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: Colors.verusGreenColor,
        textAlign: 'center',
    },
    benefitsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 5,
        color: Colors.primaryColor,
        textAlign: 'center',
    },
    benefitsText: {
        fontSize: 13,
        lineHeight: 16,
        color: '#555',
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 5,
    },
    listItemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    listItemDescription: {
        fontSize: 13,
        color: '#666',
    },
    compactListItem: {
        paddingVertical: 2,
        minHeight: 40,
        paddingHorizontal: 10,
    },
    divider: {
        marginVertical: 1,
        backgroundColor: '#e0e0e0',
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 20,
        marginBottom: 10,
    },
    button: {
        width: '85%',
        marginBottom: 10,
        height: 52,
        justifyContent: 'center',
    },
    acceptButton: {
        backgroundColor: Colors.verusGreenColor,
        elevation: 3,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    helpText: {
        fontSize: 12,
        color: Colors.verusGreenColor,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 16,
        fontWeight: '500',
    },
});

const mapStateToProps = (state) => {
    return {
        activeAccount: state.authentication.activeAccount,
        encryptedPersonalData: state.personal
    }
};

export default connect(mapStateToProps)(ValuAttestationAccept);
