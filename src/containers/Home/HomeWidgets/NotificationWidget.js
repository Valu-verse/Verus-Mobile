/*
  NotificationWidget - Simplified actionable notification tray for Wallets dashboard.
  2025-10-27: Reintroduced tray that surfaces actionable VerusID notifications only.
*/

import React, {useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Card, IconButton} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useSelector, useDispatch} from 'react-redux';
import Colors from '../../../globals/colors';
import {
  NOTIFICATION_ICON_ERROR,
  NOTIFICATION_ICON_VERUSID,
  NOTIFICATION_TYPE_VERUS_ID_PROVISIONING,
} from '../../../utils/constants/notifications';
import {dispatchRemoveNotification} from '../../../actions/actions/notifications/dispatchers/notifications';
import {useObjectSelector} from '../../../hooks/useObjectSelector';
import {VerusIdProvisioningNotification} from '../../../utils/notification';
import {processVerusId} from '../../Services/ServiceComponents/VerusIdService/VerusIdLogin';
import {getNotificationIcon} from '../../../utils/notifications/notificationHelpers';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const NotificationWidget = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const notifications = useObjectSelector((state) => state.notifications);
  const activeAccount = useSelector((state) => state.authentication.activeAccount);
  const acchash = activeAccount?.accountHash ?? null;

  const actionableNotifications = useMemo(() => {
    if (!notifications?.directory || !acchash) return [];

    return Object.entries(notifications.directory)
      .filter(([_, value]) => {
        return (
          value.acchash === acchash &&
          value.type === NOTIFICATION_TYPE_VERUS_ID_PROVISIONING
        );
      })
      .map(([uid, value]) => {
        const notification = VerusIdProvisioningNotification.fromJson(
          value,
          processVerusId,
        );

        notification.uid = uid;
        notification.iconType = value.icon ?? NOTIFICATION_ICON_VERUSID;

        return notification;
      })
      .filter((notification) =>
        typeof notification.isActionable === 'function'
          ? notification.isActionable()
          : false,
      );
  }, [notifications, acchash]);

  if (actionableNotifications.length === 0) return null;

  return (
    <View style={styles.container}>
      <Card style={styles.card} elevation={1}>
        <Card.Content style={styles.content}>
          {actionableNotifications.map((notification, index) => {
            const segments = Array.isArray(notification.title)
              ? notification.title
              : [notification.title];
            const highlight = segments[0]?.trim() ?? '';
            const remainder = segments
              .slice(1)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            const ctaLabel = formatCtaLabel(notification.body);
            const isLast = index === actionableNotifications.length - 1;

            return (
              <View
                key={notification.uid}
                style={[styles.item, !isLast && styles.itemSpacing]}
              >
                <View style={styles.leading}>
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons
                      name={getNotificationIcon(notification)}
                      size={18}
                      color={Colors.quinaryColor}
                    />
                  </View>
                  <View style={styles.textBlock}>
                    <Text style={styles.title}>
                      <Text style={styles.highlight}>{highlight}</Text>
                      {remainder.length > 0 ? ` ${remainder}` : ''}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => notification.onAction({ navigation, dispatch })}
                      style={styles.ctaWrapper}
                    >
                      <Text style={styles.cta}>{ctaLabel}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <IconButton
                  icon="close"
                  size={18}
                  iconColor={Colors.verusDarkGray}
                  onPress={() => dispatchRemoveNotification(notification.uid)}
                  style={styles.dismiss}
                  accessibilityLabel="Dismiss notification"
                />
              </View>
            );
          })}
        </Card.Content>
      </Card>
    </View>
  );
};

const formatCtaLabel = (body) => {
  if (typeof body !== 'string' || body.trim().length === 0) return 'Open';

  const trimmed = body.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  content: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemSpacing: {
    marginBottom: 12,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EDEDED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    fontSize: 13,
    color: Colors.quinaryColor,
    fontWeight: '600',
  },
  highlight: {
    color: Colors.primaryColor,
  },
  ctaWrapper: {
    marginTop: 6,
  },
  cta: {
    fontSize: 12,
    color: Colors.primaryColor,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  dismiss: {
    margin: 0,
  },
});

export default NotificationWidget;