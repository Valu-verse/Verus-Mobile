/*
  PersonalProfileWidget
  - Matches Attestation/VerusID card format
  - Simple title-only card: "Personal Profile"
  - Opens Personal profile when pressed (handled by onPress in Home)
*/
import React from 'react';
import { View, Dimensions } from 'react-native';
import { Card, Paragraph } from 'react-native-paper';

const PersonalProfileWidget = () => {
  const { width } = Dimensions.get('window');
  const cardWidth = width / 2 - 16;
  const cardHeight = 110;

  return (
    <Card
      style={{
        height: cardHeight,
        width: cardWidth,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
      }}
      mode="elevated"
      elevation={5}
    >
      <Card.Content style={{ height: cardHeight, padding: 12 }}>
        <View
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
          }}
        >
          <Paragraph style={{ fontSize: 18, color: '#000', fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 }}>
            {'Personal profile'}
          </Paragraph>
        </View>
      </Card.Content>
    </Card>
  );
};

export default PersonalProfileWidget;


