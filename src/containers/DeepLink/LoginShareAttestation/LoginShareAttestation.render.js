import React from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import { Divider, List, Button, Text, Card } from "react-native-paper";

import Styles from "../../../styles";

import Colors from '../../../globals/colors';

export const LoginShareAttestationRender = function (props) {

  return (
    <SafeAreaView style={Styles.defaultRoot}>
      <ScrollView
        style={Styles.fullWidth}
        contentContainerStyle={Styles.focalCenter}>
        <View style={Styles.fullWidth}>

          <Text style={{ fontSize: 20, textAlign: 'center', paddingBottom: 20 }}>
            {"Agree to share the following\nattestation data."}
          </Text>

          {this.state.multipleAttestations ? (
            // Multiple attestations rendering
            <>
              <Text style={{ fontSize: 18, textAlign: 'center', paddingBottom: 20, color: Colors.primaryColor, fontWeight: 'bold' }}>
                {`${this.state.selectedAttestations.length} Attestation${this.state.selectedAttestations.length > 1 ? 's' : ''} Selected`}
              </Text>
              
              {this.state.attestationAcceptedAttestorsFqns && this.state.attestationAcceptedAttestorsFqns.length > 0 && (
                <Text style={{ fontSize: 16, textAlign: 'center', paddingBottom: 20 }}>
                  {"From:\n"}<Text style={{ fontSize: 16, color: Colors.primaryColor, fontWeight: 'bold', marginVertical: 5, }}>{`${this.state.attestationAcceptedAttestorsFqns[0]}`}</Text>
                </Text>
              )}

              {this.state.selectedAttestations.map((attestation, attestationIndex) => {
                // Use the name from the attestation object instead of extracting from details
                const attestationName = attestation.name || "Unknown Attestation";
                
                return (
                  <Card key={attestation.id} style={{ marginBottom: 16, elevation: 2 }}>
                    <Card.Content>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.primaryColor, marginBottom: 10, textAlign: 'center' }}>
                        {attestationName}
                      </Text>
                      
                      <List.Item
                        title={"Requested information:"}
                        titleStyle={{ fontWeight: 'bold' }}
                      />
                      
                      {attestation.fields.map((field, fieldIndex) => (
                        <React.Fragment key={`${attestation.id}-${fieldIndex}`}>
                          <List.Item title={field} />
                          {fieldIndex < attestation.fields.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </Card.Content>
                  </Card>
                );
              })}
            </>
          ) : (
            // Single attestation rendering (original behavior)
            <>
              <Text style={{ fontSize: 20, textAlign: 'center', paddingBottom: 20 }}>
                {"Attestation Name:\n"}<Text style={{ fontSize: 20, color: Colors.primaryColor, fontWeight: 'bold', marginVertical: 5, }}>{`${this.state.attestationName}`}</Text>
              </Text>
              {this.state.attestationAcceptedAttestorsFqns && <Text style={{ fontSize: 20, textAlign: 'center', paddingBottom: 20 }}>
                {"From:\n"}<Text style={{ fontSize: 20, color: Colors.primaryColor, fontWeight: 'bold', marginVertical: 5, }}>{`${this.state.attestationAcceptedAttestorsFqns[0]}`}</Text>
              </Text>}
              <List.Item
                title={"Requested information:"}
                key={"Requested information:"}
                titleStyle={{
                  fontWeight: 'bold',
                }}
              />

              {this.state.attestationRequestedFields.map((request, index) => {
                return (
                  <React.Fragment key={request}>
                    <List.Item
                      title={request}
                      key={index}
                    />
                    <Divider />
                  </React.Fragment>
                );
              })}
            </>
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
