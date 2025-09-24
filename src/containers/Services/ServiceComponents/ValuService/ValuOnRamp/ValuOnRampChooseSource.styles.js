import { StyleSheet, Platform } from 'react-native';
import Colors from '../../../../../globals/colors';

const styles = StyleSheet.create({
  modernContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  modernActionButton: {
    borderRadius: 24,
    backgroundColor: Colors.primaryColor,
  },
  modernActionButtonContent: {
    height: 48,
  },
  modernActionButtonLabel: {
    color: Colors.secondaryColor,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0,
    textTransform: 'none',
  },
  fullWidthKeypadContainer: {
    backgroundColor: '#FAFAFA',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    width: '100%',
    alignSelf: 'stretch',
  },
});

export default styles;

