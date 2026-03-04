import React, { Component } from "react"
import { connect } from 'react-redux'

import { primitives } from "verusid-ts-client"

const { ATTESTATION_NAME, DataDescriptorKey } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { SafeAreaView, ScrollView, View, Image } from 'react-native'

import { Divider, List, Button, Text, Card, Avatar } from 'react-native-paper';
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { Valu } from '../../../../../images/customIcons';
import { tryGetClaim, flattenClaimData, formatClaimKey } from '../../../../../utils/attestation/claimParser';

// Claim type constants
const CLAIM_EMPLOYMENT = {
  "vdxfid": "i3bgiLuaxTr6smF8q6xLG4jvvhF1mmrkM2",
  "indexid": "x8RoB9Lfon4mVw8AgncVETGTxMG2jfebR7",
  "hash160result": "3efffa2be6e73fd7320b7c3d035266359fa85a01",
  "qualifiedname": {
    "namespace": "iNQFA8jtYe9JYq6Qr49ZxAhvWErFurWjTa",
    "name": "valu.vrsc::claim.employment"
  }
};

const CLAIM_ACHIEVEMENT = {
  "vdxfid": "i51jfK8wZrKa5LgF7pkbow8hV1Hv6nBm2K",
  "indexid": "x9qr87a2RAYEhWZGyWQknKfEWfJw51yvxx",
  "hash160result": "75c441fa22d809f7f213ac9476e2ed8d6b3adf10",
  "qualifiedname": {
    "namespace": "iNQFA8jtYe9JYq6Qr49ZxAhvWErFurWjTa",
    "name": "valu.vrsc::claim.achievement"
  }
};

const CLAIM_CERTIFICATION = {
  "vdxfid": "iPkJZJiwZSJrgnmunhQPnkWsyY28tngW2W",
  "indexid": "xUaR27A2QkXXJxeweP4Ym93R1C39mLRF52",
  "hash160result": "3bf5d779348c057ff91cd978418dd3ef5a6c5ede",
  "qualifiedname": {
    "namespace": "iNQFA8jtYe9JYq6Qr49ZxAhvWErFurWjTa",
    "name": "valu.vrsc::claim.certification"
  }
};

const CLAIM_EDUCATION = {
  "vdxfid": "iJ5sikvjEbSkijSxwWQ2J197XVTzunm6kP",
  "indexid": "xNuzBZMp5ufRLuKzoC4BGPfeZ9V1nwEu4R",
  "hash160result": "603c2e5af4e38e6270277a80393510d53f4141a0",
  "qualifiedname": {
    "namespace": "iNQFA8jtYe9JYq6Qr49ZxAhvWErFurWjTa",
    "name": "valu.vrsc::claim.education"
  }
};

const CLAIM_SKILL = {
  "vdxfid": "iEpYe4cC73H7i9ay3G8geAjD1tFAhWscvj",
  "indexid": "xKef6s3GxMVnLuKTztwnqcZFk3YGBZqbnP7",
  "hash160result": "53c4491d3168594da785eb6e3c7bbed4cab5727c",
  "qualifiedname": {
    "namespace": "iNQFA8jtYe9JYq6Qr49ZxAhvWErFurWjTa",
    "name": "valu.vrsc::claim.skill"
  }
};

const CLAIM_EXPERIENCE = {
  "vdxfid": "iFqtB6XGZmuUKW3Bzongrnum4QAf25Hgfu",
  "indexid": "xLfzdtxMR688wfvDrVSqqBSJ64BfzAv3s9",
  "hash160result": "4570c7949267c52bfdedd9d1147d91db148fab87",
  "qualifiedname": {
    "namespace": "iNQFA8jtYe9JYq6Qr49ZxAhvWErFurWjTa",
    "name": "valu.vrsc::claim.experience"
  }
};

// Claim type lookup map using vdxfid as key
const ClaimTypeMap = {
  [CLAIM_EMPLOYMENT.vdxfid]: "Employment Verification",
  [CLAIM_ACHIEVEMENT.vdxfid]: "Achievement Recognition", 
  [CLAIM_CERTIFICATION.vdxfid]: "Professional Certification",
  [CLAIM_EDUCATION.vdxfid]: "Educational Qualification",
  [CLAIM_SKILL.vdxfid]: "Skill Validation",
  [CLAIM_EXPERIENCE.vdxfid]: "Professional Experience"
};

// Custom VDXF label map for labels not in IdentityVdxfidMap
// Fallback lookup when IdentityVdxfidMap[label]?.EN is undefined
const CustomVdxfLabelMap = {
  "i4d7U1aZhmoxZbWx8AVezh6z1YewAnuw3V": "Valu Claim",
  "iAkd3VBhYQ3MK6PUCtfhXrLVNbqSghxxpn": "Attestation Recipient",
  "i6htkAtLSyUFr1YBFD13U9TSgPgQe2yDQZ": "Claim ID"
};

class ViewAttestation extends Component {
    constructor(props) {
        super(props);
        this.state = {
            attestationData: {},
            signer: "",
            attestationName: ""
        };
    }

    componentDidMount() {
        try {
            this.updateDisplay();
        } catch (error) {
            console.error('Error mounting ViewAttestation:', error);
        }
    }


  getAttestationData = (dataDescriptors) => {
    const data = {};
    let attestationName = "";
    
    if (!dataDescriptors || !Array.isArray(dataDescriptors)) {
      console.error('Invalid dataDescriptors provided');
      return { data, attestationName };
    }

    // First pass: check if receiving_identity is present
    const hasReceivingIdentity = dataDescriptors.some((dd) => {
      try {
        return dd[DataDescriptorKey.vdxfid]?.label === 'receiving_identity';
      } catch {
        return false;
      }
    });

    dataDescriptors.forEach((dataDescriptor) => {
      try {
        const label = dataDescriptor[DataDescriptorKey.vdxfid]?.label;
        if (!label) return;

        // Skip ATTESTATION_RECIPIENT_VDXFID if receiving_identity is present
        // (iAkd3VBhYQ3MK6PUCtfhXrLVNbqSghxxpn is the wrong/override recipient)
        if (hasReceivingIdentity && label === 'iAkd3VBhYQ3MK6PUCtfhXrLVNbqSghxxpn') {
          return;
        }

        let key = "";

        if (label === ATTESTATION_NAME.vdxfid) {
          key = `Attestation name`;
          // Extract attestation name for top display
          const objectdata = dataDescriptor[DataDescriptorKey.vdxfid]?.objectdata;
          if (objectdata && objectdata.message) {
            attestationName = objectdata.message;
          }
        } else {
          // Try IdentityVdxfidMap first, then CustomVdxfLabelMap, then fall back to raw label
          key = IdentityVdxfidMap[label]?.EN || CustomVdxfLabelMap[label] || label;
        }

        const mime = dataDescriptor[DataDescriptorKey.vdxfid]?.mimetype || "";
        const objectdata = dataDescriptor[DataDescriptorKey.vdxfid]?.objectdata;

        if (!objectdata) return;

        if (mime.startsWith("text/")) {
          data[key] = { "message": objectdata.message };
        } else if (mime.startsWith("image/")) {
          if (mime === "image/jpeg" || mime === "image/png") {
            try {
              data[key] = { "image": `data:${mime};base64,${Buffer.from(objectdata, "hex").toString("base64")}` };
            } catch (bufferError) {
              console.error('Error processing image data:', bufferError);
            }
          }
        } else if (mime == ""){
            // Check if this is a known claim type using the label as vdxfid
            const claimDescription = ClaimTypeMap[label];
            if (claimDescription) {
              data[key] = { 
                "message": claimDescription
              };
            } else {
              // Try to parse as a claim object
              const claim = tryGetClaim(objectdata);
              if (claim && claim.data) {
                // Successfully parsed as a claim - flatten and store the data
                const claimFields = flattenClaimData(claim.data);
                data[key] = { 
                  "claim": claim,
                  "claimFields": claimFields
                };
              } else {
                // Not a claim, display as message
                data[key] = { 
                  "message": objectdata.message || (typeof objectdata === 'string' && objectdata.length > 20 ? objectdata.slice(0,20)+"..." : objectdata.message || "-")
                };
              }
            }
        }
      } catch (error) {
        console.error('Error processing data descriptor:', error);
      }
    });

    return { data, attestationName };
  }

    updateDisplay = () => {
        try {
            const { attestation } = this.props.route.params;
            
            if (!attestation || !attestation.data) {
                console.error('No attestation data provided');
                return;
            }
         
            // The data is a hex string representing an AttestationPair buffer
            const attestationPairBuffer = Buffer.from(attestation.data, "hex");
            
            // Import AttestationPair from the correct location
            const { AttestationPair } = require("verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails.js");
            
            // Create AttestationPair from the buffer using the constructor and fromBuffer method
            const attestationPair = new AttestationPair();
            attestationPair.fromBuffer(attestationPairBuffer);

            if (!attestationPair || !attestationPair.mmrDescriptor) {
                console.error('No MMR descriptor found in attestation data');
                return;
            }

            const attestationItems = attestationPair.mmrDescriptor.dataDescriptors;
            const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);
            const { data: containingData, attestationName } = this.getAttestationData(attestationDataDescriptors);
            
            this.setState({ 
                attestationData: containingData, 
                signer: attestation.signer || 'Unknown',
                attestationName: attestationName || attestation.name || 'Attestation'
            });
        } catch (error) {
            console.error('Error updating display:', error);
            console.error('Error details:', error.stack);
            this.setState({ 
                attestationData: {}, 
                signer: 'Error loading attestation',
                attestationName: ''
            });
        }
    }

    render() {
        try {
            return (
                <SafeAreaView style={Styles.defaultRoot}>
                    <ScrollView
                        style={Styles.fullWidth}
                        contentContainerStyle={{ flexGrow: 1, paddingVertical: 20, paddingHorizontal: 16 }}
                        showsVerticalScrollIndicator={true}>
                        <View style={Styles.fullWidth}>
                            {this.state.attestationName && (
                                <View style={{
                                    marginBottom: 28,
                                    backgroundColor: '#ffffff',
                                    borderRadius: 20,
                                    elevation: 6,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 12,
                                    borderWidth: 0.5,
                                    borderColor: '#e0e0e0',
                                    overflow: 'hidden'
                                }}>
                                    {/* Header Gradient Strip */}
                                    <View style={{
                                        height: 4,                                        
                                        opacity: 0.8
                                    }} />
                                    
                                    <View style={{ padding: 24 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                            {this.state.signer === 'ValuID.VRSCTEST@' ? (
                                                <View style={{
                                                    width: 56,
                                                    height: 56,
                                                    borderRadius: 28,
                                                    backgroundColor: '#f8f9fa',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 16,
                                                    borderWidth: 2,
                                                    borderColor: Colors.primaryColor + '20'
                                                }}>
                                                    <Image 
                                                        source={Valu} 
                                                        style={{ width: 32, height: 32 }}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                            ) : (
                                                <View style={{
                                                    width: 56,
                                                    height: 56,
                                                    borderRadius: 28,
                                                    backgroundColor: Colors.primaryColor + '10',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 16,
                                                    borderWidth: 2,
                                                    borderColor: Colors.primaryColor + '20'
                                                }}>
                                                    <Avatar.Icon 
                                                        size={28} 
                                                        icon="certificate" 
                                                        style={{ 
                                                            backgroundColor: Colors.primaryColor,
                                                            elevation: 0
                                                        }}
                                                    />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ 
                                                    fontSize: 10, 
                                                    color: '#9ca3af',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 1.2,
                                                    fontWeight: '700',
                                                    marginBottom: 4
                                                }}>
                                                    Attestation
                                                </Text>
                                                <Text style={{ 
                                                    fontSize: 22, 
                                                    fontWeight: '800', 
                                                    color: '#111827',
                                                    lineHeight: 28,
                                                    letterSpacing: -0.5
                                                }}>
                                                    {this.state.attestationName}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        {/* Issuer Section */}
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingTop: 16,
                                            borderTopWidth: 1,
                                            borderTopColor: '#f3f4f6'
                                        }}>
                                            <View style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: '#10b981',
                                                marginRight: 12
                                            }} />
                                            <Text style={{ 
                                                fontSize: 14, 
                                                color: '#6b7280',
                                                fontWeight: '500',
                                                marginRight: 8
                                            }}>
                                                Issued by
                                            </Text>
                                            <Text style={{ 
                                                fontSize: 14, 
                                                color: '#111827',
                                                fontWeight: '700',
                                                flex: 1
                                            }}>
                                                {this.state.signer}
                                            </Text>
                                            {/* <View style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                backgroundColor: '#10b981',
                                                borderRadius: 6
                                            }}>
                                                <Text style={{
                                                    fontSize: 10,
                                                    color: '#ffffff',
                                                    fontWeight: '600',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5
                                                }}>
                                                    Verified
                                                </Text>
                                            </View> */}
                                        </View>
                                    </View>
                                </View>
                            )}
                            {this.state.attestationData && Object.keys(this.state.attestationData).length > 0 ? (
                                <View style={{ marginTop: 8 }}>
                                    <Text style={{ 
                                        fontSize: 16, 
                                        fontWeight: '600', 
                                        color: '#1d1d1f',
                                        marginBottom: 20,
                                        paddingLeft: 4
                                    }}>
                                        Attestation Details
                                    </Text>
                                    <View style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        elevation: 2,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.06,
                                        shadowRadius: 6,
                                        borderWidth: 1,
                                        borderColor: '#f0f0f0'
                                    }}>
                                        {Object.keys(this.state.attestationData).map((request, index) => {
                                            const item = this.state.attestationData[request];
                                            const isLast = index === Object.keys(this.state.attestationData).length - 1;
                                            
                                            return (
                                                <View key={request}>
                                                    <View style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        paddingVertical: 16,
                                                        paddingHorizontal: 20,
                                                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc'
                                                    }}>
                                                        {item?.image ? (
                                                            <View style={{
                                                                width: 44,
                                                                height: 44,
                                                                borderRadius: 22,
                                                                overflow: 'hidden',
                                                                marginRight: 16,
                                                                backgroundColor: '#f8f8f8',
                                                                elevation: 1,
                                                                shadowColor: '#000',
                                                                shadowOffset: { width: 0, height: 1 },
                                                                shadowOpacity: 0.1,
                                                                shadowRadius: 2,
                                                            }}>
                                                                <Image 
                                                                    source={{ uri: item.image }} 
                                                                    style={{ width: '100%', height: '100%' }}
                                                                    onError={(error) => console.error('Image load error:', error)}
                                                                />
                                                            </View>
                                                        ) : (
                                                            <View style={{
                                                                width: 44,
                                                                height: 44,
                                                                borderRadius: 22,
                                                                backgroundColor: Colors.primaryColor + '15',
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                marginRight: 16
                                                            }}>
                                                                <Avatar.Icon 
                                                                    size={24} 
                                                                    icon="shield-check" 
                                                                    style={{ 
                                                                        backgroundColor: Colors.primaryColor,
                                                                        elevation: 0
                                                                    }}
                                                                />
                                                            </View>
                                                        )}
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ 
                                                                fontSize: 11, 
                                                                color: '#8e8e93',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: 0.8,
                                                                fontWeight: '600',
                                                                marginBottom: 3
                                                            }}>
                                                                {request}
                                                            </Text>
                                                            {item?.claim && item?.claimFields ? (
                                                                // Render claim data as nested key-value list
                                                                <View style={{ marginTop: 4 }}>
                                                                    <Text style={{ 
                                                                        fontSize: 13, 
                                                                        color: Colors.primaryColor,
                                                                        fontWeight: '600',
                                                                        marginBottom: 8
                                                                    }}>
                                                                        {item.claim.typeName}
                                                                    </Text>
                                                                    {item.claimFields.map((field, fieldIndex) => (
                                                                        <View key={fieldIndex} style={{
                                                                            flexDirection: 'row',
                                                                            paddingVertical: 4,
                                                                            paddingLeft: 8,
                                                                            borderLeftWidth: 2,
                                                                            borderLeftColor: Colors.primaryColor + '30',
                                                                            marginBottom: 4
                                                                        }}>
                                                                            <Text style={{ 
                                                                                fontSize: 12, 
                                                                                color: '#6b7280',
                                                                                fontWeight: '500',
                                                                                minWidth: 80
                                                                            }}>
                                                                                {formatClaimKey(field.key)}:
                                                                            </Text>
                                                                            <Text style={{ 
                                                                                fontSize: 12, 
                                                                                color: '#1d1d1f',
                                                                                fontWeight: '500',
                                                                                flex: 1,
                                                                                marginLeft: 8
                                                                            }}>
                                                                                {field.value}
                                                                            </Text>
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            ) : (
                                                                <Text style={{ 
                                                                    fontSize: 16, 
                                                                    color: '#1d1d1f',
                                                                    fontWeight: '500',
                                                                    lineHeight: 22
                                                                }}>
                                                                    {item?.message || ''}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <View style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: 3,
                                                            backgroundColor: Colors.primaryColor + '40',
                                                            marginLeft: 12
                                                        }} />
                                                    </View>
                                                    {!isLast && (
                                                        <View style={{
                                                            height: 1,
                                                            backgroundColor: '#f0f0f0',
                                                            marginLeft: 76
                                                        }} />
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : (
                                <Text style={{ textAlign: 'center', padding: 20, color: Colors.secondaryColor }}>
                                    No attestation data available
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                </SafeAreaView>
            );
        } catch (error) {
            console.error('Render error in ViewAttestation:', error);
            return (
                <SafeAreaView style={Styles.defaultRoot}>
                    <View style={[Styles.fullWidth, Styles.focalCenter]}>
                        <Text style={{ textAlign: 'center', padding: 20, color: 'red' }}>
                            Error displaying attestation data
                        </Text>
                    </View>
                </SafeAreaView>
            );
        }
    }
}

const mapStateToProps = (state) => {
    return {
        activeAccount: state.authentication.activeAccount,
        encryptedPersonalData: state.personal
    }
};

export default connect(mapStateToProps)(ViewAttestation);