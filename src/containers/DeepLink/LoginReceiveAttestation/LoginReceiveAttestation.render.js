import React from "react";
import { SafeAreaView, ScrollView, View, Image } from "react-native";
import { Divider, List, Button, Text, Card } from "react-native-paper";
import Styles from "../../../styles";
import Colors from '../../../globals/colors';
import {convertFqnToDisplayFormat} from '../../../utils/fullyqualifiedname';

export const LoginReceiveAttestationRender = function () {
  const { attestationName, signerFqn, attestationData } = this.state;

  return (
    <SafeAreaView style={[Styles.defaultRoot, { flex: 1 }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          padding: 16,
        }}
        showsVerticalScrollIndicator={true}>
        
        {/* Header Section */}
        <Card style={{ marginBottom: 24, elevation: 2 }}>
          <Card.Content style={{ paddingVertical: 20 }}>
            <Text variant="headlineSmall" style={{ 
              textAlign: 'center', 
              marginBottom: 16,
              color: Colors.primaryColor,
              fontWeight: '600'
            }}>
              Receive Attestation
            </Text>
            
            <Text variant="titleLarge" style={{ 
              textAlign: 'center', 
              marginBottom: 16,
              fontWeight: 'bold',
              color: '#1a1a1a'
            }}>
              {convertFqnToDisplayFormat(attestationName)}
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
              <Text variant="bodyLarge" style={{ color: '#666' }}>From: </Text>
              <Text variant="bodyLarge" style={{ 
                color: Colors.primaryColor, 
                fontWeight: 'bold'
              }}>
                {signerFqn}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Attestation Data Section */}
        {attestationData && Object.keys(attestationData).length > 0 && (
          <Card style={{ marginBottom: 24, elevation: 2 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ 
                marginBottom: 16, 
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                Attestation Details
              </Text>
              
              {Object.keys(attestationData).map((request, index) => (
                <View key={request}>
                  <List.Item
                    title={request}
                    titleStyle={{ fontWeight: '500', fontSize: 16 }}
                    description={attestationData[request]?.message}
                    descriptionStyle={{ color: '#666', marginTop: 4 }}
                    right={() => 
                      attestationData[request]?.image ? (
                        <List.Icon 
                          icon={{ uri: attestationData[request]?.image }} 
                          style={{ marginRight: 8 }}
                        />
                      ) : null
                    }
                    style={{ 
                      paddingHorizontal: 0,
                      paddingVertical: 12
                    }}
                  />
                  {index < Object.keys(attestationData).length - 1 && (
                    <Divider style={{ marginVertical: 8 }} />
                  )}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
        
        {/* Spacer to push buttons to bottom */}
        <View style={{ flex: 1, minHeight: 50 }} />
      </ScrollView>
      
      {/* Fixed Button Container */}
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
