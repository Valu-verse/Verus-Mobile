import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Divider, List, Button, Text, Card } from "react-native-paper";
import { IdentityVdxfidMap } from 'verus-typescript-primitives/dist/utils/IdentityData';

import Styles from "../../../styles";
import Colors from '../../../globals/colors';

export const LoginShareAttestationRender = function (props) {

  return (
    <SafeAreaView style={Styles.defaultRoot}>
      <ScrollView
        style={Styles.fullWidth}
        contentContainerStyle={Styles.focalCenter}>
        <View style={Styles.fullWidth}>

          {/* Compact Header Section */}
          <View style={{ 
            backgroundColor: Colors.lightGray || '#f5f5f5', 
            paddingVertical: 8, 
            paddingHorizontal: 12, 
            marginBottom: 16, 
            borderRadius: 8,
          }}>
            <Text style={{ fontSize: 16, textAlign: 'center', fontWeight: 'bold', marginBottom: 4 }}>
              Share Personal Data
            </Text>
            
            {this.state.multipleAttestations ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: Colors.primaryColor, fontWeight: 'bold' }}>
                  {`${this.state.selectedAttestations.length} Item${this.state.selectedAttestations.length > 1 ? 's' : ''} of Personal Information Selected`}
                </Text>
                {this.state.attestationAcceptedAttestorsFqns && this.state.attestationAcceptedAttestorsFqns.length > 0 && (
                  <Text style={{ fontSize: 12, color: Colors.primaryColor, marginTop: 2 }}>
                    From: <Text style={{ fontWeight: 'bold', color: Colors.primaryColor }}>{this.state.attestationAcceptedAttestorsFqns[0]}</Text>
                  </Text>
                )}
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: Colors.primaryColor, fontWeight: 'bold' }}>
                  {this.state.attestationName}
                </Text>
                {this.state.attestationAcceptedAttestorsFqns && this.state.attestationAcceptedAttestorsFqns.length > 0 && (
                  <Text style={{ fontSize: 12, color: Colors.primaryColor, marginTop: 2 }}>
                    From: <Text style={{ fontWeight: 'bold' }}>{this.state.attestationAcceptedAttestorsFqns[0]}</Text>
                  </Text>
                )}
              </View>
            )}
          </View>

          {this.state.multipleAttestations ? (
            // Multiple attestations rendering - Compact cards
            <>
              {this.state.selectedAttestations.map((attestation, attestationIndex) => {
                // Use the name from the attestation object instead of extracting from details
                const attestationName = attestation.name || "Unknown Personal Information";
                
                // Determine what fields to show based on request format
                let fieldsToShow = [];
                let requestTypeText = "";
                
                if (attestation.requestFormat) {
                  if (attestation.requestFormat.isPartial) {
                    // PARTIAL_DATA: Show only requested keys
                    fieldsToShow = attestation.requestFormat.requestedKeys.map(k => {
                      // Try to get human-readable name, fallback to key
                      return IdentityVdxfidMap[k]?.EN || k;
                    });
                    requestTypeText = "Partial";
                  } else if (attestation.requestFormat.isFullData) {
                    // FULL_DATA: Show full attestation
                    fieldsToShow = ["⚠️ All Information"];
                    requestTypeText = "Full";
                  } else if (attestation.requestFormat.isCollection) {
                    // COLLECTION: Show all fields or specific descriptors
                    fieldsToShow = attestation.fields || ["Collection"];
                    requestTypeText = "Collection";
                  }
                } else {
                  // Fallback to original fields
                  fieldsToShow = attestation.fields || ["⚠️ All Information"];
                  requestTypeText = "Standard";
                }
                
                return (
                  <Card key={attestation.id} style={{ 
                    marginBottom: 8, 
                    elevation: 2, 
                    backgroundColor: '#fafafa'
                  }}>
                    <Card.Content style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        {/* Green numbered tag on top left */}
                        <View style={{ 
                          backgroundColor: Colors.verusGreenColor || '#28a745', 
                          paddingHorizontal: 6, 
                          paddingVertical: 2, 
                          borderRadius: 4,
                          marginRight: 8,
                          minWidth: 20,
                          alignItems: 'center'
                        }}>
                          <Text style={{ fontSize: 10, color: 'white', fontWeight: 'bold' }}>
                            {attestationIndex + 1}
                          </Text>
                        </View>
                        
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: Colors.quaternaryColor, flex: 1 }}>
                          {attestationName}
                        </Text>
                        
                        {/* Request type tag on top right */}
                        <View style={{ 
                          backgroundColor: Colors.primaryColor + '20', 
                          paddingHorizontal: 6, 
                          paddingVertical: 2, 
                          borderRadius: 4 
                        }}>
                          <Text style={{ fontSize: 10, color: Colors.primaryColor, fontWeight: 'bold' }}>
                            {requestTypeText}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primaryColor || '#333', marginBottom: 8 }}>
                        Personal Information Requested:
                      </Text>
                      
                      {fieldsToShow.map((field, fieldIndex) => (
                        <View key={`${attestation.id}-${fieldIndex}`} style={{ 
                          paddingVertical: 3, 
                          paddingLeft: 8,
                          borderLeftWidth: 2,
                          borderLeftColor: Colors.primaryColor + '40',
                          marginBottom: 2
                        }}>
                          <Text style={{ fontSize: 12, color: Colors.textColor || '#333' }}>{field}</Text>
                        </View>
                      ))}
                    </Card.Content>
                  </Card>
                );
              })}
            </>
          ) : (
            // Single attestation rendering - Compact version
            <Card style={{ 
              marginBottom: 8, 
              elevation: 2, 
              backgroundColor: '#fafafa'
            }}>
              <Card.Content style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primaryColor || '#333', marginBottom: 8 }}>
                  Personal Information Requested:
                </Text>
                
                {this.state.attestationRequestedFields.map((request, index) => (
                  <View key={`single-${index}`} style={{ 
                    paddingVertical: 2, 
                    paddingLeft: 8,
                    borderLeftWidth: 2,
                    borderLeftColor: Colors.primaryColor + '40',
                    marginBottom: 2
                  }}>
                    <Text style={{ fontSize: 12, color: Colors.textColor || '#333' }}>{request}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

        </View>
      </ScrollView>
      <View
        style={{
          ...Styles.fullWidthBlock,
          paddingHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          display: 'flex',
          paddingBottom: 24,
        }}>
        <Button
          color={Colors.warningButtonColor}
          style={{ width: 148 }}
          onPress={() => this.cancel()}>
          Cancel
        </Button>
        <Button
          color={Colors.verusGreenColor}
          style={{ width: 148 }}
          onPress={() => this.handleContinue()}>
          Accept
        </Button>
      </View>
    </SafeAreaView>
  );
};
