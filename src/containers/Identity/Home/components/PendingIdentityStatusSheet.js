/*
  PendingIdentityStatusSheet
  - Action sheet for pending VerusID items shown on the Identity home screen.
  - Supports refresh, removal, and retry (for error items with request payload).
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import Colors from '../../../../globals/colors';
import GradientButton from '../../../../components/GradientButton';
import SemiModal from '../../../../components/SemiModal';
import { NOTIFICATION_TYPE_VERUSID_ERROR } from '../../../../utils/constants/services';

const PendingIdentityStatusSheet = ({
  visible,
  item,
  activeAction,
  onClose,
  onRefresh,
  onRemove,
  onRetry,
}) => {
  const isError = item?.status === NOTIFICATION_TYPE_VERUSID_ERROR;
  const canRetry = isError && !!item?.details?.loginRequest;
  const busy = !!activeAction;

  const statusLabel = isError ? 'Needs attention' : 'In progress';

  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      closeDisabled={busy}
      title="Identity status"
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.sheetBody}>
        <View style={styles.identityBlock}>
          <Text style={styles.identityName} numberOfLines={1}>
            {item?.display || 'Unknown identity'}
          </Text>
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        <Text style={styles.description}>
          {isError
            ? 'This request appears stuck or failed. You can refresh, retry, or remove it from your list.'
            : 'This request is still being processed. You can refresh or remove it from your list.'}
        </Text>

        <Button
          mode="contained"
          onPress={onRefresh}
          disabled={busy}
          contentStyle={styles.actionButtonContent}
          uppercase={false}
          buttonColor="#EBF6FF"
          textColor={Colors.primaryColor}
          style={[styles.secondaryButton, styles.noShadow]}
          labelStyle={styles.actionButtonLabel}
        >
          {activeAction === 'refresh' ? 'Refreshing...' : 'Refresh now'}
        </Button>

        {canRetry && (
          <Button
            mode="contained"
            onPress={onRetry}
            disabled={busy}
            contentStyle={styles.actionButtonContent}
            uppercase={false}
            buttonColor="#EBF6FF"
            textColor={Colors.primaryColor}
            style={[styles.secondaryButton, styles.noShadow]}
            labelStyle={styles.actionButtonLabel}
          >
            {activeAction === 'retry' ? 'Retrying...' : 'Retry request'}
          </Button>
        )}

        <GradientButton
          onPress={onRemove}
          topColor="#EF5350"
          bottomColor="#D32F2F"
          disabled={busy}
          style={styles.removeButton}
        >
          {activeAction === 'remove' ? 'Removing...' : 'Remove from list'}
        </GradientButton>

        {isError && !canRetry && (
          <Text style={styles.helperText}>
            Retry is unavailable because the original request payload is missing.
          </Text>
        )}
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
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  identityBlock: {
    marginBottom: 12,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.quinaryColor,
  },
  statusLabel: {
    fontSize: 13,
    color: Colors.verusDarkGray,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 14,
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: '#EBF6FF',
    marginBottom: 10,
    overflow: 'hidden',
  },
  actionButtonContent: {
    height: 44,
  },
  actionButtonLabel: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0,
    textTransform: 'none',
  },
  noShadow: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  removeButton: {
    marginTop: 2,
    width: '100%',
    height: 44,
    borderRadius: 22,
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: Colors.verusDarkGray,
    lineHeight: 16,
  },
});

export default PendingIdentityStatusSheet;
