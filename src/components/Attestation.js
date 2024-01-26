import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, View, Dimensions } from 'react-native';
import { Button, Dialog, Portal, Text, List, Paragraph } from 'react-native-paper';
import { connect } from 'react-redux';
import Colors from '../globals/colors';
import { getIdentity } from '../utils/api/channels/verusid/callCreators';
import { primitives } from 'verusid-ts-client';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const getIdentities = async (signatures) => {

  const iaddresses = Object.keys(signatures);
  const identity = await Promise.all(iaddresses
    .map(async (iaddress) => { return (await getIdentity(signatures[iaddress].system, iaddress)).result })
    );
  return identity;
}

const AttestationModal = (props) => {

  const { visible, loginConsentResponse, attestation, viewOnly, buttons = [], mainTitle, onError = () => {} } = props;
  const [signers, setSigners] = useState([]);
  const [loading, setLoading] = useState(false);

  let attestationValues = {};

  for (let [key, value] of attestation.components) {
    if (primitives.ATTESTATION_IDENTITY_DATA[value.attestationKey]) {
      attestationValues[primitives.ATTESTATION_IDENTITY_DATA[value.attestationKey].detail] = value.value;
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const ids = await getIdentities(attestation.signatures);
        setSigners(ids);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        onError(err);
      }
    };
    fetchData();
  }, []);

  const title = attestationValues["Document Type"] || '';

  if (attestationValues["Document Type"]) {
    delete attestationValues["Document Type"];
  }

  if (attestationValues["Attestor"]) {
    delete attestationValues["Attestor"];
  }

  const { height } = Dimensions.get('window');
  const dialogContentMaxHeight = height * 0.6; // Adjust this value as needed

  if (signers.length === 0 || loading) {
    return null
  }

  return (
    <SafeAreaView>
      <Portal>
        <View style={{ flex: 1, paddingTop: 10 }}>
          <Dialog
            dismissable={!!viewOnly === true}
            visible={visible}
            onDismiss={viewOnly ? cancel : () => { }}
            style={{ maxHeight: '100%', marginBottom: 36, paddingTop: 10 }}
          >
            <Dialog.Title>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={'text-box-check'} size={50} color={Colors.primaryColor} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20 }}>
                  <Paragraph style={{ fontSize: 20 }}>{mainTitle}</Paragraph>
                </View>
              </View>
            </Dialog.Title>
            <Dialog.Content style={{ maxHeight: dialogContentMaxHeight }}>
              <ScrollView>
                <List.Item key={id.fullyqualifiedname}
                  title={(<Paragraph style={{ fontSize: 14, fontWeight: 'bold', color: Colors.primaryColor }}>{`${signers.map((id) => id.fullyqualifiedname).join()}`}</Paragraph>)}
                  description={"Issuing Verus ID: "} style={{ height: 50 }} />
                {title && <List.Item key={title}
                  title={title}
                  description={"Type of Attestation: "} style={{ height: 50 }} />}
                <List.Section>
                  {Object.entries(attestationValues).map(([key, value]) => (
                    <List.Item key={value} title={value} description={key} style={{ height: 50 }} />
                  ))}
                </List.Section>
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              {buttons != null
                ? buttons.map((button, index) => (
                  <Button
                    disabled={button.disabled || viewOnly}
                    onPress={button.onPress}
                    color={Colors.primaryColor}
                    key={index}
                  >
                    {button.text}
                  </Button>
                ))
                : null}
            </Dialog.Actions>
          </Dialog>
        </View>
      </Portal>
    </SafeAreaView>
  );

};

const mapStateToProps = (state) => {
  return {
    activeAlert: state.alert.active,
  };
};

export default connect(mapStateToProps)(AttestationModal);