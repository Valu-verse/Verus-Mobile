/*
  NotificationWidget - Action Card notification component for Wallet dashboard.
  2025-10-27: Reintroduced tray that surfaces actionable VerusID notifications only.
  2026-01-22: Simplified to minimal design - light grey background, no borders or accents.
              Clean pill CTA button with state-based tinted backgrounds.
*/

import React, {useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSelector, useDispatch} from 'react-redux';
import Colors from '../../../globals/colors';
import {
  NOTIFICATION_ICON_ERROR,
  NOTIFICATION_ICON_VERUSID,
  NOTIFICATION_TYPE_VERUS_ID_PROVISIONING,
  NOTIFICATION_TYPE_LOADING,
} from '../../../utils/constants/notifications';
import {dispatchRemoveNotification} from '../../../actions/actions/notifications/dispatchers/notifications';
import {useObjectSelector} from '../../../hooks/useObjectSelector';
import {VerusIdProvisioningNotification} from '../../../utils/notification';
import {processVerusId} from '../../Services/ServiceComponents/VerusIdService/VerusIdLogin';
// State color configuration
const STATE_COLORS = {
  action: {
    ctaBackground: '#EBF6FF',
    ctaText: Colors.primaryColor,
  },
  pending: {
    ctaBackground: '#FFF4E5',
    ctaText: '#B45309',
  },
  error: {
    ctaBackground: '#FEE2E2',
    ctaText: '#B91C1C',
  },
};

const getNotificationState = (notification) => {
  if (notification.iconType === NOTIFICATION_ICON_ERROR) {
    return 'error';
  }
  if (notification.type === NOTIFICATION_TYPE_LOADING) {
    return 'pending';
  }
  return 'action';
};

const NotificationWidget = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const notifications = useObjectSelector((state) => state.notifications);
  const activeAccount = useSelector(
    (state) => state.authentication.activeAccount,
  );
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
        const state = getNotificationState(notification);
        const colors = STATE_COLORS[state];

        return (
          <View
            key={notification.uid}
            style={[
              styles.card,
              !isLast && styles.cardSpacing,
            ]}>
            {/* Main content row */}
            <View style={styles.contentRow}>
              <View style={styles.textContent}>
                <Text style={styles.title} numberOfLines={2}>
                  <Text style={styles.highlight}>{highlight}</Text>
                  {remainder.length > 0 ? ` ${remainder}` : ''}
                </Text>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => notification.onAction({navigation, dispatch})}
                  style={[
                    styles.ctaButton,
                    {
                      backgroundColor: colors.ctaBackground,
                    },
                  ]}
                  activeOpacity={0.8}>
                  <Text style={[styles.ctaText, {color: colors.ctaText}]}>
                    {ctaLabel}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Dismiss button */}
              <TouchableOpacity
                onPress={() => dispatchRemoveNotification(notification.uid)}
                style={styles.dismissButton}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityLabel="Dismiss notification"
                accessibilityRole="button">
                <Text style={styles.dismissText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const formatCtaLabel = (body) => {
  if (typeof body !== 'string' || body.trim().length === 0) return 'Continue';
  const trimmed = body.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 6,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#F7F8F9',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardSpacing: {
    marginBottom: 10,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
  },
  textContent: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 8,
  },
  highlight: {
    color: '#1F2937',
    fontWeight: '600',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginTop: -2,
  },
  dismissText: {
    fontSize: 18,
    lineHeight: 18,
    color: '#9CA3AF',
  },
});

export default NotificationWidget;
