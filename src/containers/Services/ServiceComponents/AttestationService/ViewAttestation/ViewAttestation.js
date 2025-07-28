import React, { Component } from "react"
import { connect } from 'react-redux'

import { primitives } from "verusid-ts-client"
import { VdxfUniValue } from "verus-typescript-primitives/dist/pbaas/VdxfUniValue";
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

const { ATTESTATION_NAME, DataDescriptorKey } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { SafeAreaView, ScrollView, View, Image } from 'react-native'

import { Divider, List, Button, Text } from 'react-native-paper';
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';

class ViewAttestation extends Component {
    constructor(props) {
        super(props);
        this.state = {
            attestationData: {},
            signer: ""
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
    
    if (!dataDescriptors || !Array.isArray(dataDescriptors)) {
      console.error('Invalid dataDescriptors provided');
      return data;
    }

    dataDescriptors.forEach((dataDescriptor) => {
      try {
        const label = dataDescriptor[DataDescriptorKey.vdxfid]?.label;
        if (!label) return;

        let key = "";

        if (label === ATTESTATION_NAME.vdxfid) {
          key = `Attestation name`;
        } else {
          key = IdentityVdxfidMap[label]?.EN || label;
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
        }
      } catch (error) {
        console.error('Error processing data descriptor:', error);
      }
    });

    return data;
  }

    updateDisplay = () => {
        try {
            const { attestation } = this.props.route.params;
            
            if (!attestation || !attestation.data) {
                console.error('No attestation data provided');
                return;
            }

            const dataDescriptorObject = new VdxfUniValue();
            dataDescriptorObject.fromBuffer(Buffer.from(attestation.data, "hex"));
            
            const vdxfObjectsKeys = {};
            dataDescriptorObject.values.map((value) => vdxfObjectsKeys[Object.keys(value)[0]] = Object.values(value)[0]);

            if (!vdxfObjectsKeys[VDXF_Data.MMRDescriptorKey.vdxfid]) {
                console.error('No MMR descriptor found in attestation data');
                return;
            }

            const attestationItems = vdxfObjectsKeys[VDXF_Data.MMRDescriptorKey.vdxfid].dataDescriptors;
            const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);
            const containingData = this.getAttestationData(attestationDataDescriptors);
            
            this.setState({ 
                attestationData: containingData, 
                signer: attestation.signer || 'Unknown' 
            });
        } catch (error) {
            console.error('Error updating display:', error);
            this.setState({ 
                attestationData: {}, 
                signer: 'Error loading attestation' 
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

                            <Text style={{ fontSize: 20, textAlign: 'center', paddingBottom: 20 }}>
                                {`From: `}<Text style={{ fontSize: 20, color: Colors.primaryColor, fontWeight: 'bold', marginVertical: 5, }}>{`${this.state.signer}`}</Text>
                            </Text>
                            {this.state.attestationData && Object.keys(this.state.attestationData).length > 0 ? (
                                Object.keys(this.state.attestationData).map(request => {
                                    const item = this.state.attestationData[request];
                                    return (
                                        <React.Fragment key={request}>
                                            <List.Item
                                                title={request}
                                                description={item?.message || 'No description available'}
                                                right={() => item?.image ? (
                                                    <Image 
                                                        source={{ uri: item.image }} 
                                                        style={{ width: 50, height: 50, borderRadius: 25 }}
                                                        onError={(error) => console.error('Image load error:', error)}
                                                    />
                                                ) : null}
                                            />
                                            <Divider />
                                        </React.Fragment>
                                    );
                                })
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