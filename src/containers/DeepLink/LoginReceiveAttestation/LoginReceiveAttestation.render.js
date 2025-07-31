import React from "react";
import { SafeAreaView, ScrollView, View, Image } from "react-native";
import { Divider, List, Button, Text, Card } from "react-native-paper";
import Styles from "../../../styles";
import Colors from '../../../globals/colors';
import {convertFqnToDisplayFormat} from '../../../utils/fullyqualifiedname';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';
import { getIdentity } from "../../../utils/api/channels/verusid/callCreators";

export const LoginReceiveAttestationRender = function () {
  const { attestationName, signerFqn, attestationData, isDownloadedAttestation, downloadedAttestations, ready, loading, attestationFqns } = this.state;
  const { attestationMetadata } = this.props.route.params || {};

  // Show loading spinner until data is ready
  if (!ready || loading) {
    return <AnimatedActivityIndicatorBox />;
  }

  return (
    <SafeAreaView style={{ 
      flex: 1, 
      backgroundColor: Colors.secondaryColor 
    }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
        showsVerticalScrollIndicator={true}>
        
        {/* Header Section */}
        <Card style={{ marginBottom: 16, elevation: 2 }}>
          <Card.Content style={{ paddingVertical: 20 }}>
            <Text variant="headlineSmall" style={{ 
              textAlign: 'center', 
              marginBottom: 16,
              color: Colors.primaryColor,
              fontWeight: '600'
            }}>
              {isDownloadedAttestation ? 'Downloaded Attestation' : 'Receive Attestation'}
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
        {!isDownloadedAttestation && attestationData && Object.keys(attestationData).length > 0 && (
          <Card style={{ marginBottom: 16, elevation: 2 }}>
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

        {/* Additional info for downloaded attestations */}
        {isDownloadedAttestation && downloadedAttestations && (
          <Card style={{ marginBottom: 16, elevation: 2 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ 
                marginBottom: 16, 
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                Download Information
              </Text>
              
              <List.Item
                title="Count"
                description={`${downloadedAttestations.attestations ? downloadedAttestations.attestations.length : 1} attestation(s)`}
                titleStyle={{ fontWeight: '500', fontSize: 14 }}
                descriptionStyle={{ color: '#666', fontSize: 12 }}
                left={() => (
                  <List.Icon 
                    icon="counter" 
                    color={Colors.primaryColor}
                    size={20}
                  />
                )}
                style={{ paddingHorizontal: 0, paddingVertical: 4 }}
              />
              
              <List.Item
                title="Attestation Validated"
                description="Yes"
                titleStyle={{ fontWeight: '500', fontSize: 14 }}
                descriptionStyle={{ color: Colors.verusGreenColor, fontSize: 12 }}
                left={() => (
                  <List.Icon 
                    icon="check-circle" 
                    color={Colors.verusGreenColor}
                    size={20}
                  />
                )}
                style={{ paddingHorizontal: 0, paddingVertical: 4 }}
              />
              
              {downloadedAttestations.timestamp && (
                <List.Item
                  title="Generated"
                  description={new Date(downloadedAttestations.timestamp).toLocaleDateString()}
                  titleStyle={{ fontWeight: '500', fontSize: 14 }}
                  descriptionStyle={{ color: '#666', fontSize: 12 }}
                  left={() => (
                    <List.Icon 
                      icon="calendar" 
                      color={Colors.primaryColor}
                      size={20}
                    />
                  )}
                  style={{ paddingHorizontal: 0, paddingVertical: 4 }}
                />
              )}
            </Card.Content>
          </Card>
        )}

        {/* Multiple attestations detail */}
        {isDownloadedAttestation && downloadedAttestations && downloadedAttestations.attestations && Array.isArray(downloadedAttestations.attestations) && downloadedAttestations.attestations.length > 1 && (
          <Card style={{ marginBottom: 16, elevation: 2 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ 
                marginBottom: 16, 
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                Multiple Attestations ({downloadedAttestations.attestations.length})
              </Text>
              
              {Object.entries(attestationData).map(([key, data], index) => (
                <View key={index}>
                  <List.Item
                    title={data.attestationName || key}
                    titleStyle={{ fontWeight: '500', fontSize: 14 }}
                    description={`From: ${attestationFqns?.[key] || signerFqn}`}
                    descriptionStyle={{ color: '#666', fontSize: 12 }}
                    left={() => (
                      <List.Icon 
                        icon="file-document" 
                        color={Colors.primaryColor}
                        size={20}
                      />
                    )}
                    right={() => (
                      <Text style={{ fontSize: 10, color: '#999', alignSelf: 'center' }}>
                        {data.validated ? 'Validated' : 'Invalid'}
                      </Text>
                    )}
                    style={{ 
                      paddingHorizontal: 0,
                      paddingVertical: 8
                    }}
                  />
                  {index < Object.entries(attestationData).length - 1 && (
                    <Divider style={{ marginVertical: 4 }} />
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
            {isDownloadedAttestation ? 'Save' : 'Accept'}
          </Button>
        </View>
    </SafeAreaView>
  );
};
