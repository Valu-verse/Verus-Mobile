import React, { Component } from "react"
import { connect } from 'react-redux'
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native'
import { Button, Text, Card, TextInput } from 'react-native-paper'

import Styles from "../../../../../styles"
import Colors from '../../../../../globals/colors'
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert'
import ValuProvider from "../../../../../utils/services/ValuProvider"

class ValuChooseIdentity extends Component {
    constructor(props) {
        super(props);
        
        // Get props for customization with defaults
        const {
            identityType = "ValuID",
            identitySuffix = ".valuid@",
            title,
            description,
            previewLabel
        } = this.props.route?.params || {};
        
        this.state = {
            identityName: "",
            processing: false,
            identitySuffix: identitySuffix,
            identityType: identityType,
            customTitle: title || `Choose Your ${identityType}`,
            customDescription: description || `Your ${identityType} will be your unique identifier on the Verus network.`,
            customPreviewLabel: previewLabel || `Your ${identityType} will be:`
        };
    }

    handleNameChange = (text) => {
        // Only prevent specific special characters: . / * : ;
        const cleanText = text.replace(/[./*:;]/g, '');
        this.setState({ identityName: cleanText });
    }
 
    getFullyQualifiedName = () => {
        const { identityName, identitySuffix } = this.state;
        return identityName + identitySuffix;
    }

    handleSubmit = async () => {
        const { identityName, identityType } = this.state;
        
        if (!identityName || identityName.length < 1) {
            createAlert(
                "Invalid Name",
                `${identityType} name must be at least 1 characters long.`,
                [{ text: 'OK', onPress: () => resolveAlert(false) }]
            );
            return;
        }

        this.setState({ processing: true });
        
        try {
            const fqn = this.getFullyQualifiedName();
                   
            // Check if the identity name is available
            const availabilityCheck = await ValuProvider.checkIdentityAvailable(fqn);
            
            if (!availabilityCheck.success) {
                throw new Error(availabilityCheck.error || `Failed to check ${identityType.toLowerCase()} availability`);
            }
            
            if (!availabilityCheck.data.available) {
                createAlert(
                    "ValuID Not Available",
                    `The VerusID "${fqn}" is already taken. Please choose a different name.`,
                    [{ text: 'OK', onPress: () => resolveAlert(false) }]
                );
                this.setState({ processing: false });
                return;
            }
            
            // Identity is available, navigate back to ValuAttestation with the chosen name
            this.props.navigation.navigate('ValuAttestation', { 
                chosenIdentity: fqn,
                continueFlow: true 
            });
            
        } catch (error) {
            console.error("Error checking identity availability:", error);
            createAlert(
                "Error", 
                `Failed to check ${identityType.toLowerCase()} availability. Please try again.`,
                [{ text: 'OK', onPress: () => resolveAlert(false) }]
            );
        } finally {
            this.setState({ processing: false });
        }
    }

    render() {
        const { identityName, processing, customTitle, customDescription, customPreviewLabel, identityType } = this.state;
        const fqn = this.getFullyQualifiedName();

        return (
            <SafeAreaView style={Styles.defaultRoot}>
                <ScrollView 
                    style={Styles.fullWidth}
                    contentContainerStyle={styles.scrollContainer}
                >
                    <View style={styles.container}>
                        <Card style={styles.identityCard}>
                            <Card.Content>
                                <Text style={styles.celebrationEmoji}>🆔</Text>
                                <Text style={styles.cardTitle}>{customTitle}</Text>
                                
                                <Text style={styles.description}>
                                    {customDescription}
                                </Text>

                                <View style={styles.inputSection}>
                                    <Text style={styles.inputLabel}>Enter your identity name:</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={identityName}
                                        onChangeText={this.handleNameChange}
                                        placeholder="yourname"
                                        style={styles.textInput}
                                        outlineColor={Colors.verusGreenColor}
                                        activeOutlineColor={Colors.verusGreenColor}
                                        maxLength={20}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    
                                    <View style={styles.previewSection}>
                                        <Text style={styles.previewLabel}>{customPreviewLabel}</Text>
                                        <Text style={styles.previewText}>{fqn}</Text>
                                    </View>
                                </View>

                                <View style={styles.requirementsSection}>
                                    <Text style={styles.requirementsTitle}>Requirements:</Text>
                                    <Text style={styles.requirementText}>• Minimum 1 character</Text>
                                    <Text style={styles.requirementText}>• No . \ / * : characters</Text>
                                    <Text style={styles.requirementText}>• Must be unique</Text>
                                </View>

                                <Button
                                    mode="contained"
                                    onPress={this.handleSubmit}
                                    disabled={processing || identityName.length < 1}
                                    loading={processing}
                                    style={[styles.button, styles.submitButton]}
                                    labelStyle={styles.buttonLabel}
                                    icon="check"
                                >
                                    {processing ? "Checking Availability..." : `Continue with this VerusID`}
                                </Button>
                            </Card.Content>
                        </Card>
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
        paddingBottom: 30,
    },
    container: {
        flex: 1,
        alignItems: 'center',
    },
    celebrationEmoji: {
        fontSize: 30,
        textAlign: 'center',
        marginBottom: 5,
    },
    identityCard: {
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
        marginBottom: 15,
        color: Colors.verusGreenColor,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        lineHeight: 18,
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    inputSection: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: Colors.primaryColor,
    },
    textInput: {
        marginBottom: 15,
        backgroundColor: '#f8f8f8',
    },
    previewSection: {
        backgroundColor: '#f0f8ff',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.verusGreenColor,
        alignItems: 'center',
    },
    previewLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    previewText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.verusGreenColor,
    },
    requirementsSection: {
        marginTop: 15,
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    requirementsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: Colors.primaryColor,
    },
    requirementText: {
        fontSize: 13,
        color: '#555',
        marginBottom: 3,
    },
    button: {
        width: '100%',
        height: 52,
        justifyContent: 'center',
        marginTop: 10,
    },
    submitButton: {
        backgroundColor: Colors.verusGreenColor,
        elevation: 3,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
});

const mapStateToProps = (state) => {
    return {
        activeAccount: state.authentication.activeAccount,
    }
};

export default connect(mapStateToProps)(ValuChooseIdentity);
