import React from "react";
import { SafeAreaView, ScrollView, View, TouchableOpacity } from "react-native";
import { Divider, List, Button, Text, Card } from "react-native-paper";
import Styles from "../../../styles";
import Colors from '../../../globals/colors';
import { convertFqnToDisplayFormat } from '../../../utils/fullyqualifiedname';
import AnimatedActivityIndicatorBox from '../../../components/AnimatedActivityIndicatorBox';

export const LoginSignDataRequestRender = function () {
  const { signerFqn, endorsementDetails, ready, loading } = this.state;

  // Show loading spinner until data is ready
  if (!ready || loading) {
    return <AnimatedActivityIndicatorBox />;
  }

  if (!endorsementDetails) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.secondaryColor }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="titleLarge">No endorsement data found</Text>
        </View>
      </SafeAreaView>
    );
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
            <View style={{ alignItems: 'center' }}>
              <Text variant="bodyMedium" style={{ color: '#666', marginBottom: 8 }}>Request From</Text>
              <Text variant="headlineMedium" style={{ 
                color: Colors.primaryColor, 
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                {convertFqnToDisplayFormat(signerFqn)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Endorsement Details Section */}
        <Card style={{ marginBottom: 16, elevation: 2 }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ 
              marginBottom: 16, 
              fontWeight: '600',
              color: '#1a1a1a'
            }}>
              Endorsement Request
            </Text>
            
            {/* Endorsee */}
            {endorsementDetails.endorsee && (
              <>
                <List.Item
                  title="Endorsee"
                  description={convertFqnToDisplayFormat(endorsementDetails.endorsee)}
                  titleStyle={{ color: '#666', fontSize: 12 }}
                  descriptionStyle={{ fontSize: 14, color: 'black' }}
                  left={() => (
                    <List.Icon 
                      icon="account" 
                      color={Colors.primaryColor}
                      size={20}
                    />
                  )}
                  style={{ paddingHorizontal: 0, paddingVertical: 4 }}
                />
                <Divider style={{ marginVertical: 4 }} />
              </>
            )}

            {/* Message */}
            {endorsementDetails.message && (
              <>
                <TouchableOpacity>
                  <List.Item
                    title="Message"
                    description={endorsementDetails.message}
                    titleStyle={{ color: '#666', fontSize: 12 }}
                    descriptionStyle={{ fontSize: 14, color: 'black', fontWeight: 'bold' }}
                    descriptionNumberOfLines={0}
                    left={() => (
                      <List.Icon 
                        icon="message-text" 
                        color={Colors.verusGreenColor}
                        size={20}
                      />
                    )}
                    style={{ 
                      paddingHorizontal: 0, 
                      paddingVertical: 8,
                      backgroundColor: '#f8f8f8',
                      borderRadius: 8,
                      marginVertical: 4
                    }}
                  />
                </TouchableOpacity>
                <Divider style={{ marginVertical: 4 }} />
              </>
            )}

            {/* Reference */}
            {endorsementDetails.reference && (
              <>
                <List.Item
                  title="Reference"
                  description={endorsementDetails.reference}
                  titleStyle={{ color: '#666', fontSize: 12 }}
                  descriptionStyle={{ fontSize: 14, color: 'black', fontFamily: 'monospace' }}
                  descriptionNumberOfLines={0}
                  left={() => (
                    <List.Icon 
                      icon="link" 
                      color={Colors.primaryColor}
                      size={20}
                    />
                  )}
                  style={{ paddingHorizontal: 0, paddingVertical: 4 }}
                />
                <Divider style={{ marginVertical: 4 }} />
              </>
            )}

            {/* Transaction ID */}
            {endorsementDetails.txid && (
              <>
                <List.Item
                  title="Transaction ID"
                  description={endorsementDetails.txid}
                  titleStyle={{ color: '#666', fontSize: 12 }}
                  descriptionStyle={{ fontSize: 14, color: 'black', fontFamily: 'monospace' }}
                  descriptionNumberOfLines={0}
                  left={() => (
                    <List.Icon 
                      icon="receipt" 
                      color={Colors.primaryColor}
                      size={20}
                    />
                  )}
                  style={{ paddingHorizontal: 0, paddingVertical: 4 }}
                />
                <Divider style={{ marginVertical: 4 }} />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Redirect URL Section */}
        {endorsementDetails.redirectUrl && (
          <Card style={{ marginBottom: 16, elevation: 2 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ 
                marginBottom: 16, 
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                Destination
              </Text>
              
              <TouchableOpacity>
                <List.Item
                  title="Your signature will be sent to"
                  description={endorsementDetails.redirectUrl}
                  titleStyle={{ color: '#666', fontSize: 14, fontWeight: '600' }}
                  descriptionStyle={{ fontSize: 16, color: Colors.verusGreenColor, textDecorationLine: 'underline', fontWeight: 'bold' }}
                  descriptionNumberOfLines={0}
                  left={() => (
                    <List.Icon 
                      icon="send" 
                      color={Colors.verusGreenColor}
                      size={24}
                    />
                  )}
                  style={{ 
                    paddingHorizontal: 0, 
                    paddingVertical: 12,
                    backgroundColor: '#f0f8ff',
                    borderRadius: 8,
                    marginVertical: 4,
                    borderWidth: 2,
                    borderColor: Colors.verusGreenColor
                  }}
                />
              </TouchableOpacity>
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
          textColor={Colors.warningButtonColor}
          style={{ width: 148 }}
          onPress={() => this.handleCancel()}>
          Cancel
        </Button>
        <Button
          buttonColor={Colors.verusGreenColor}
          textColor={Colors.secondaryColor}
          style={{ width: 148 }}
          onPress={() => this.handleAccept()}>
          Accept
        </Button>
      </View>
    </SafeAreaView>
  );
};
