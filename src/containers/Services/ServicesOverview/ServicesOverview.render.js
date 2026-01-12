import React from 'react';
import { SafeAreaView, ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Divider, List, Provider } from 'react-native-paper';
import Styles from '../../../styles';
import {
  CONNECTED_SERVICE_DISPLAY_INFO,
  CONNECTED_SERVICES,
  VALU_SERVICE_ID,
  VERUSID_SERVICE_ID,
} from '../../../utils/constants/services';
import VerusIdWidget from '../../Home/HomeWidgets/VerusIdWidget';
import AttestationWidget from '../../Home/HomeWidgets/AttestationWidget';
import { HomeListItemThemeLight } from '../../Home/Home.themes';
import { VERUSID_WIDGET_TYPE, ATTESTATION_WIDGET_TYPE } from '../../../utils/constants/widgets';

export const ServicesOverviewRender = ({ 
  activeAccount, 
  openService, 
  hasValuProofOfPersonhood,
  handleWidgetPress 
}) => {
  const centralized = [];
  const decentralized = [];
  const disabledServices = activeAccount ? activeAccount.disabledServices : {};

  CONNECTED_SERVICES.map((service, index) => {
    if (disabledServices[service] || service === VALU_SERVICE_ID || service === VERUSID_SERVICE_ID) {
      return;
    }

    const comp = (
      <React.Fragment key={index}>
        <List.Item
          title={CONNECTED_SERVICE_DISPLAY_INFO[service].title}
          description={CONNECTED_SERVICE_DISPLAY_INFO[service].description}
          onPress={() => openService(service)}
          right={props => (
            <List.Icon {...props} icon={'chevron-right'} size={20} />
          )}
        />
        <Divider />
      </React.Fragment>
    );

    if (CONNECTED_SERVICE_DISPLAY_INFO[service].decentralized) {
      decentralized.push(comp);
    } else {
      centralized.push(comp);
    }
  });

  return (
    <SafeAreaView style={Styles.defaultRoot}>
      <ScrollView style={Styles.fullWidth} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.headerContainer}>
          <Text style={styles.mainTitle}>Services</Text>
        </View>
        <View style={{ padding: 16 }}>
           <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleWidgetPress(VERUSID_WIDGET_TYPE)}
            style={{ width: '100%', marginBottom: 16 }}
          >
            <Provider theme={HomeListItemThemeLight}>
              <VerusIdWidget />
            </Provider>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleWidgetPress(ATTESTATION_WIDGET_TYPE)}
            style={{ width: '100%', marginBottom: 16 }}
          >
            <Provider theme={HomeListItemThemeLight}>
              <AttestationWidget hasValuProofOfPersonhood={hasValuProofOfPersonhood} />
            </Provider>
          </TouchableOpacity>
        </View>
        
        <Divider />
        {decentralized.length > 0 && (
          <React.Fragment>
            <List.Subheader>{'Decentralized'}</List.Subheader>
            <Divider />
          </React.Fragment>
        )}
        {decentralized}
        {centralized.length > 0 && (
          <React.Fragment>
            <List.Subheader>{'Centralized'}</List.Subheader>
            <Divider />
          </React.Fragment>
        )}
        {centralized}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 0,
    marginTop: 8,
  },
});
