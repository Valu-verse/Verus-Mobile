/*
  Update: Align bottom primary button with ValuAttestation.js
  - Replaced TallButton with react-native-paper Button
  - Matched styling (borderRadius, backgroundColor, elevation, content height, label style)
  - Removed unused primaryButton style
*/
import React, { Component } from "react"
import { connect } from 'react-redux'
import { SafeAreaView, ScrollView, View, StyleSheet, TextInput as RNTextInput } from 'react-native'
import { Button, Text } from 'react-native-paper'

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
            title = '',
            description,
            previewLabel
        } = this.props.route?.params || {};
        
        this.state = {
            identityName: "",
            processing: false,
            identitySuffix: identitySuffix,
            identityType: identityType,
            customTitle: title || `Register your VerusID`,
            customDescription: description || `This identity will be your unique identifier on the Verus network.`,
            customPreviewLabel: previewLabel || `Your VerusID will be:`,
            isFocused: false
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
        if (!identityName || identityName?.length < 1) {
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
                throw new Error(availabilityCheck?.error);
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
            
            // Identity is available, navigate back to the screen that called this component
            const returnScreen = this.props.route?.params?.returnScreen || 'ValuAttestation';
            this.props.navigation.navigate(returnScreen, { 
                chosenIdentity: fqn,
                continueFlow: true 
            });
            
        } catch (error) {
            console.error("Error checking identity availability in Choose:", error?.message ? error.message : error);
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
                    <View style={styles.pageContainer}>
                        {/* Title */}
                        <Text style={styles?.title}>{customTitle}</Text>

                        {/* Subtitle */}
                        <Text style={styles.subtitle}>{customDescription}</Text>

                        {/* Input */}
                        <View style={{ marginBottom: 8 }}>
                            <Text style={styles.inputLabel}>Enter your identity name</Text>
                            <RNTextInput
                                value={identityName}
                                onChangeText={this.handleNameChange}
                                onFocus={() => this.setState({ isFocused: true })}
                                onBlur={() => this.setState({ isFocused: false })}
                                placeholder="Your name"
                                placeholderTextColor="#999"
                                returnKeyType="done"
                                autoCorrect={false}
                                autoCapitalize="none"
                                maxLength={20}
                                style={[styles.textInput, { borderColor: this.state.isFocused ? Colors.primaryColor : '#E0E0E0' }]}
                            />
                            <Text style={styles.helperText}>{"1+ characters. Avoid special characters . / * : ;"}</Text>
                        </View>

                        {/* Preview */}
                        <View style={styles.previewBox}>
                            <Text style={styles.previewLabel}>{customPreviewLabel}</Text>
                            <Text style={styles.previewText}>{fqn}</Text>
                        </View>

                        {/* Requirements */}
                        <View style={styles.requirementsSectionPlain}>
                            <Text style={styles.requirementsTitlePlain}>Requirements</Text>
                            <Text style={styles.requirementTextPlain}>• Minimum 1 character</Text>
                            <Text style={styles.requirementTextPlain}>• No . \ / * : ; characters</Text>
                            <Text style={styles.requirementTextPlain}>• Must be unique</Text>
                        </View>

                        <View style={{ flex: 1 }} />

                        {/* Primary button (match ValuAttestation) */}
                        <Button
                            onPress={this.handleSubmit}
                            mode="contained"
                            disabled={processing || identityName?.length < 1}
                            style={{
                                borderRadius: 24,
                                backgroundColor: (processing || identityName?.length < 1) ? '#CFEAF2' : Colors.primaryColor,
                                elevation: 0,
                                shadowColor: 'transparent',
                                shadowOpacity: 0,
                                shadowRadius: 0,
                                shadowOffset: { width: 0, height: 0 },
                                width: '100%',
                                alignSelf: 'stretch',
                                marginTop: 12,
                                marginBottom: 24
                            }}
                            contentStyle={{ height: 48 }}
                            labelStyle={{
                                color: Colors.secondaryColor,
                                fontWeight: '600',
                                fontSize: 15,
                                letterSpacing: 0,
                                textTransform: 'none'
                            }}
                        >
                            {processing ? 'Checking availability…' : 'Register this VerusID'}
                        </Button>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 30,
    },
    pageContainer: {
        flex: 1,
    },
    title: {
        textAlign: 'left',
        color: '#1A1A1A',
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    subtitle: {
        textAlign: 'left',
        fontSize: 16,
        lineHeight: 22,
        color: '#555',
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    textInput: {
        height: 56,
        borderRadius: 12,
        borderWidth: 2,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#1A1A1A',
        backgroundColor: '#FAFAFA',
    },
    helperText: {
        textAlign: 'left',
        marginTop: 8,
        fontSize: 12,
        color: '#888'
    },
    previewBox: {
        marginTop: 12,
        marginBottom: 20,
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        alignItems: 'center'
    },
    previewLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    previewText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primaryColor,
    },
    requirementsSectionPlain: {
        marginTop: 8,
        marginBottom: 20,
    },
    requirementsTitlePlain: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1A1A1A',
    },
    requirementTextPlain: {
        fontSize: 13,
        color: '#555',
        marginBottom: 3,
    },
    
});

const mapStateToProps = (state) => {
    return {
        activeAccount: state.authentication.activeAccount,
    }
};

export default connect(mapStateToProps)(ValuChooseIdentity);
