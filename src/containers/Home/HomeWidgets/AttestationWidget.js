import React from 'react';
import { View, Dimensions, Image } from 'react-native';
import { Card, Paragraph } from 'react-native-paper';
import Colors from '../../../globals/colors';
import { AttesationBadge, Valu } from '../../../images/customIcons';
import Styles from '../../../styles';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const AttestationWidget = props => {
    const { width } = Dimensions.get('window');

    return (
        <Card
            style={{
                height: 110,
                width: width / 2 - 16,
                borderRadius: 10,
                backgroundColor: 'white'
            }}
            mode="elevated"
            elevation={5}>
            <Card.Content>
                <View
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        marginRight: -10,
                        marginTop: -12,
                    }}>
                    <Paragraph style={{ fontSize: 12, color: Colors.primaryColor }}>
                        {0}
                    </Paragraph>
                    <MaterialCommunityIcons
                        name={'star'}
                        color={Colors.primaryColor}
                        size={16}
                    />
                </View>
                <View
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-evenly',
                        marginTop: -10
                    }}>
                    <View
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'flex-start',
                        }}>
                        <Image source={AttesationBadge} style={{
                            width: '20%',
                            height: '100%',
                            resizeMode: "contain",
                            marginBottom: 20,
                            marginLeft: -5,
                            marginRight: 0
                        }} />
                        <Paragraph style={{ fontSize: 16, color: Colors.primaryColor, fontWeight: 'bold' }}>
                            {'Valu Attestations'}
                        </Paragraph>
                    </View>
                    <Paragraph style={{ fontSize: 12, color: Colors.primaryColor, marginTop:20 }}>
                        {'Get your proof of Life'}
                    </Paragraph>

                </View>

            </Card.Content>
        </Card>
    );
};

export default AttestationWidget;
