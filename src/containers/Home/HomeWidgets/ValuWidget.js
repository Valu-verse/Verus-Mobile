import React from 'react';
import { View, Dimensions, Image } from 'react-native';
import { Card, Paragraph } from 'react-native-paper';
import Colors from '../../../globals/colors';
import { ValuLogo, Valu } from '../../../images/customIcons';
import Styles from '../../../styles';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const ValuWidget = props => {
    const { width } = Dimensions.get('window');

    return (
        <Card
            style={{
                height: 110,
                width: width / 2 - 16,
                borderRadius: 10,
                backgroundColor: Colors.primaryColor
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
                    <Paragraph style={{ fontSize: 12, color: 'white' }}>
                        {0}
                    </Paragraph>
                    <MaterialCommunityIcons
                        name={'star'}
                        color={Colors.secondaryColor}
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
                        <Image source={Valu} style={{
                            width: '20%',
                            height: '100%',
                            resizeMode: "contain",
                            marginBottom: 20,
                            marginLeft: -5,
                            marginRight: 5
                        }} />
                        <Paragraph style={{ fontSize: 16, color: 'white', fontWeight: 'bold' }}>
                            {'Buy / Sell '}
                        </Paragraph>
                    </View>
                    <Paragraph style={{ fontSize: 12, color: 'white', marginTop:20 }}>
                        {"Use Valu's on/off ramp"}
                    </Paragraph>

                </View>

            </Card.Content>
        </Card>
    );
};

export default ValuWidget;
