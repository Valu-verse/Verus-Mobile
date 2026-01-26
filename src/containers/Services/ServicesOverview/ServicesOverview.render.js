/*
  ServicesOverview.render
  - 2026-01-23: Fixed Android header positioning bug by restructuring layout to match Home/Identity pattern.
    Moved header outside ScrollView, added SafeAreaView edges={['top']}, updated header padding (paddingTop: 12, paddingBottom: 16).
    Removed marginTop/marginBottom from title, switched to react-native-safe-area-context SafeAreaView.
  - 2026-01-23: Hidden ATTESTATION_SERVICE_ID from the Decentralized services list.
    Attestations are now accessed through the Identity tab via the VerusIdDetails screen.
    The AttestationWidget ("Get your Proof of Personhood") remains visible.
  - 2026-01-23: Removed VerusIdWidget card from Services screen.
    Added ValuSocialWidget above AttestationWidget.
    Fixed "Address book" capitalization.
    Removed orphan Divider after widget section.
  - 2026-01-23: Changed ValuSocial widget to open ValuSocialModal instead of navigating.
*/
import React from 'react';
import { ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider, List, Provider } from 'react-native-paper';
import Styles from '../../../styles';
import {
  CONNECTED_SERVICE_DISPLAY_INFO,
  CONNECTED_SERVICES,
  VALU_SERVICE_ID,
  VERUSID_SERVICE_ID,
  ATTESTATION_SERVICE_ID,
} from '../../../utils/constants/services';
import ValuSocialWidget from '../../Home/HomeWidgets/ValuSocialWidget';
import AttestationWidget from '../../Home/HomeWidgets/AttestationWidget';
import AddressBookWidget from '../../Home/HomeWidgets/AddressBookWidget';
import ValuSocialModal from '../../../components/ValuSocialModal/ValuSocialModal';
import { HomeListItemThemeLight } from '../../Home/Home.themes';
import { ATTESTATION_WIDGET_TYPE, ADDRESS_BOOK_WIDGET_TYPE, VALU_SOCIAL_WIDGET_TYPE } from '../../../utils/constants/widgets';

export const ServicesOverviewRender = ({ 
  activeAccount, 
  openService, 
  hasValuProofOfPersonhood,
  handleWidgetPress,
  addressBookCount = 0,
  valuSocialModalVisible = false,
  onCloseValuSocialModal,
}) => {
  // Note: VerusIdWidget removed from Services screen per 2026-01-23 update
  const centralized = [];
  const decentralized = [];
  const disabledServices = activeAccount ? activeAccount.disabledServices : {};

  CONNECTED_SERVICES.map((service, index) => {
    // Skip disabled services, VALU, VERUSID (shown as widgets), and ATTESTATION (now in Identity tab)
    if (disabledServices[service] || service === VALU_SERVICE_ID || service === VERUSID_SERVICE_ID || service === ATTESTATION_SERVICE_ID) {
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerContainer}>
        <Text style={styles.mainTitle}>Services</Text>
      </View>
      <ScrollView style={Styles.fullWidth} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleWidgetPress(VALU_SOCIAL_WIDGET_TYPE)}
            style={{ width: '100%', marginBottom: 16 }}
          >
            <Provider theme={HomeListItemThemeLight}>
              <ValuSocialWidget />
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

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleWidgetPress(ADDRESS_BOOK_WIDGET_TYPE)}
            style={{ width: '100%', marginBottom: 16 }}
          >
            <Provider theme={HomeListItemThemeLight}>
              <AddressBookWidget addressCount={addressBookCount} />
            </Provider>
          </TouchableOpacity>
        </View>
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
      <ValuSocialModal
        visible={valuSocialModalVisible}
        onClose={onCloseValuSocialModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
  },
});
