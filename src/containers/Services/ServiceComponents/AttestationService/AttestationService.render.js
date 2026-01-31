import React from "react";
import { View, Text, ScrollView } from 'react-native'
import styles from "../../../../styles";
import AnimatedActivityIndicator from "../../../../components/AnimatedActivityIndicator";
import {Divider, List, Portal, Dialog, Button, IconButton} from 'react-native-paper';

export const VerusAttestationRender = function () {
  return (
    <React.Fragment>
      {(this.props.loading) && (
        <View
          style={{
            ...styles.centerContainer,
            ...styles.backgroundColorWhite,
            width: '100%',
            height: '100%',
            position: 'absolute',
            zIndex: 999,
          }}>
          <AnimatedActivityIndicator
            style={{
              width: 128,
            }}
          />
        </View>
      )}
      {!this.props.loading && (
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >
        {Object.values(this.state.attestations || {}).length === 0 && (
          <Text style={{fontSize: 20, textAlign: 'center', padding: 20, color: 'black'}}>No attestations present</Text>
        )}
        {Object.values(this.state.attestations || {}).map((attestation, index) => {
          // Helper function to format date strings
          const formatDate = (dateValue) => {
            if (!dateValue) return null;
            
            try {
              // If it's already a formatted string (contains letters), check if it needs reformatting
              if (typeof dateValue === 'string' && /[a-zA-Z]/.test(dateValue)) {
                // Try to parse it to reformat it consistently
                const parsedDate = new Date(dateValue);
                if (!isNaN(parsedDate.getTime())) {
                  return formatToOrdinalDate(parsedDate);
                }
                return dateValue; // Return as-is if can't parse
              }
              
              // If it's a timestamp (number or numeric string)
              if (typeof dateValue === 'number' || !isNaN(Number(dateValue))) {
                const timestamp = Number(dateValue);
                // If it looks like a Unix timestamp (10 digits) vs milliseconds (13 digits)
                const date = timestamp < 10000000000 ? 
                  new Date(timestamp * 1000) : 
                  new Date(timestamp);
                return formatToOrdinalDate(date);
              }
              
              // If it's an ISO string or other date format
              const date = new Date(dateValue);
              if (!isNaN(date.getTime())) {
                return formatToOrdinalDate(date);
              }
              
              return null;
            } catch (e) {
              console.warn('Failed to parse date:', dateValue, e);
              return null;
            }
          };

          // Helper function to format date as "1st Jun 2025"
          const formatToOrdinalDate = (date) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            const day = date.getDate();
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            
            // Add ordinal suffix to day
            const getOrdinalSuffix = (day) => {
              if (day > 3 && day < 21) return 'th';
              switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
              }
            };
            
            return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
          };

          // Extract date/timestamp information from various possible fields
          let dateStr = '';
          const possibleDateFields = [
            attestation?.date,
            attestation?.dateReceived,
            attestation?.timestamp,
            attestation?.created_at,
            attestation?.createdAt,
            attestation?.updatedAt,
            attestation?.updated_at
          ];
          
          for (const dateField of possibleDateFields) {
            const formatted = formatDate(dateField);
            if (formatted) {
              dateStr = formatted;
              break;
            }
          }
          
          if (!dateStr) {
            dateStr = 'Date unknown';
          }

          const signerName = attestation?.signer || 
                           attestation?.identityAttested || 
                           attestation?.issuer ||
                           attestation?.from ||
                           'Unknown';
          
          const description = `Signed by: ${signerName}${dateStr !== 'Date unknown' ? ` • ${dateStr}` : ''}`;

          return (
            <React.Fragment key={index}>
              <List.Item
                title={attestation?.name || attestation?.claimName || attestation?.title || 'Unnamed Attestation'}
                description={description}
                descriptionNumberOfLines={2}
                onPress={() => this.viewDetails(attestation)}
                right={props => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => this.showDeleteModal(attestation)}
                      iconColor="#ac2f2fff"
                      style={{ margin: 0 }}
                    />
                    <List.Icon {...props} icon={'chevron-right'} size={20} />
                  </View>
                )}
              />
              <Divider />
            </React.Fragment>
          );


        })}
        </ScrollView>
      )}

      {/* Delete Confirmation Modal */}
      <Portal>
        <Dialog 
          visible={this.state.deleteModalVisible} 
          onDismiss={this.hideDeleteModal}
          style={{
            borderRadius: 20,
            backgroundColor: 'white',
          }}
        >
          <Dialog.Title style={{
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
            color: '#333'
          }}>
            Delete Attestation
          </Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 20 }}>
            <Text style={{
              fontSize: 16,
              textAlign: 'center',
              color: '#666',
              lineHeight: 24
            }}>
              Are you sure you want to delete this attestation?
            </Text>
            {this.state.attestationToDelete && (
              <Text style={{
                fontSize: 14,
                textAlign: 'center',
                color: '#999',
                marginTop: 10,
                fontStyle: 'italic'
              }}>
                {this.state.attestationToDelete.name}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ 
            justifyContent: 'space-around',
            paddingHorizontal: 20,
            paddingBottom: 20
          }}>
            <Button 
              onPress={this.hideDeleteModal}
              mode="outlined"
              style={{
                borderColor: '#ddd',
                borderRadius: 25,
                minWidth: 100
              }}
              labelStyle={{ color: '#666' }}
            >
              Cancel
            </Button>
            <Button 
              onPress={this.deleteAttestation}
              mode="contained"
              style={{
                backgroundColor: '#ff4444',
                borderRadius: 25,
                minWidth: 100
              }}
              labelStyle={{ color: 'white' }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </React.Fragment>
  );
};
