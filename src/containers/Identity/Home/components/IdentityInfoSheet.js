/*
  IdentityInfoSheet
  - 2026-01-12: Updated copy to match product messaging (personal database, universal identity),
    added a small note about signing into apps/services, removed all CTAs (informational only),
    and converted to a quick summary + single-open FAQ accordion for better UX.
  - 2026-01-12: Standardized sheet close affordance to the shared SemiModal header (top-right X).
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import Colors from '../../../../globals/colors';
import SemiModal from '../../../../components/SemiModal';

const FAQ_ITEMS = [
  {
    key: 'what-is',
    title: 'What is VerusID?',
    body: `Your VerusID is a blockchain-based identity that belongs entirely to you. It works as both a universal login and a personal database — letting you authenticate across apps and store your data in your wallet rather than on company servers.`,
  },
  {
    key: 'sign-in',
    title: 'Signing in with VerusID',
    body: `Instead of creating usernames and passwords for every app, you authenticate with your VerusID.\n\n• The app presents a QR code or link\n• Your wallet opens\n• You select which VerusID to use\n• You review and approve the request\n\nNo passwords needed.`,
  },
  {
    key: 'personal-db',
    title: 'Your personal database',
    body: `Apps can request to store data in your VerusID or read data you've previously saved. Each request appears in your wallet for you to approve or deny.\n\nYour data is encrypted and written directly to your identity on the blockchain.`,
  },
  {
    key: 'different',
    title: 'What makes this different?',
    body: `Traditional apps store your data in their databases — they can analyze it, sell it, or lose it in a breach. With VerusID, your data lives in your identity.\n\nYou decide exactly what to share with each app, when you share it.`,
  },
  {
    key: 'recovery',
    title: 'Permanent and recoverable',
    body: `Your VerusID never expires and has no renewal fees. No company can suspend or delete it.\n\nYou can designate recovery options to restore access if you ever lose your keys.`,
  },
];

const IdentityInfoSheet = ({ visible, onClose }) => {
  const [expandedKey, setExpandedKey] = React.useState(null);

  const toggle = (key) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const renderBody = (text) => {
    // Keep formatting predictable in RN Text: we split on newlines and render each line.
    const lines = String(text || '').split('\n');
    return (
      <View style={{ marginTop: 10 }}>
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <View key={idx} style={{ height: 10 }} />;
          }

          const isBullet = line.trim().startsWith('•');
          return (
            <Text
              key={idx}
              style={[
                styles.paragraph,
                isBullet && styles.bulletLine,
              ]}
            >
              {line}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      title="What is a VerusID?"
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View>
        <View style={styles.sheetBody}>
          {/* Option B: quick summary + expandable FAQ */}
          <Text style={styles.summary}>
            VerusID is a self-sovereign identity and personal data vault — controlled by you, not companies.
          </Text>

          <View style={styles.accordionWrap}>
            {FAQ_ITEMS.map((item, idx) => {
              const expanded = expandedKey === item.key;
              const isFirst = idx === 0;
              const isLast = idx === FAQ_ITEMS.length - 1;

              return (
                <View
                  key={item.key}
                  style={[
                    styles.accordionCard,
                    isFirst && styles.accordionCardFirst,
                    isLast && styles.accordionCardLast,
                  ]}
                >
                  <List.Accordion
                    title={item.title}
                    expanded={expanded}
                    onPress={() => toggle(item.key)}
                    style={styles.accordionHeader}
                    titleStyle={styles.accordionTitle}
                  >
                    <View style={styles.accordionBody}>
                      {renderBody(item.body)}
                    </View>
                  </List.Accordion>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </SemiModal>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flex: 0,
    alignSelf: 'flex-end',
    width: '100%',
    backgroundColor: 'white',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.quinaryColor,
  },
  spacer: {
    width: 64,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  summary: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  bulletLine: {
    marginLeft: 10,
    marginBottom: 6,
  },
  accordionWrap: {
    width: '100%',
  },
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDEFF3',
    borderTopWidth: 0,
  },
  accordionCardFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  accordionCardLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  accordionHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -0.2,
  },
  accordionBody: {
    // No icons: align body with the accordion title text.
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 12,
  },
});

export default IdentityInfoSheet;
