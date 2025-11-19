/*
  New file: valuPaymentMethodMeta
  - Normalizes Valu payment method names to canonical display labels
  - Provides icon configuration (SVG or Material icon) for each known method
  - Supplies lookup helpers used by Valu on/off-ramp flows
*/

import RevolutPaySvg from '../../../../../images/paymentIcons/revolut1.svg';
import SkrillSvg from '../../../../../images/paymentIcons/skrill1.svg';
import SepaSvg from '../../../../../images/paymentIcons/sepa.svg';
import NetellerSvg from '../../../../../images/paymentIcons/neteller.svg';
import AstroPaySvg from '../../../../../images/paymentIcons/astropay.svg';
import ApplePaySvg from '../../../../../images/paymentIcons/apple-pay.svg';
import GooglePaySvg from '../../../../../images/paymentIcons/googlepay.svg';
import PayPalSvg from '../../../../../images/paymentIcons/PayPal.svg';

const ICON_COLOR_DEFAULT = '#1A1A1A';

const normalizeKey = (value) => {
  if (typeof value !== 'string') return '';

  return value
    .trim()
    .toLowerCase()
    .replace(/[\/]/g, ' ')
    .replace(/\s+/g, ' ');
};

const PAYMENT_METHOD_MAP = {
  'revolut pay': {
    label: 'Revolut Pay',
    icon: {
      type: 'svg',
      Component: RevolutPaySvg,
    },
  },
  'online banking': {
    label: 'Online banking',
    icon: {
      type: 'mcicon',
      name: 'bank',
      color: ICON_COLOR_DEFAULT,
    },
  },
  'credit or debit card': {
    label: 'Credit or debit card',
    icon: {
      type: 'mcicon',
      name: 'credit-card-outline',
      color: ICON_COLOR_DEFAULT,
    },
  },
  'credit debit card': {
    label: 'Credit or debit card',
    icon: {
      type: 'mcicon',
      name: 'credit-card-outline',
      color: ICON_COLOR_DEFAULT,
    },
  },
  astropay: {
    label: 'AstroPay',
    icon: {
      type: 'mcicon',
      name: 'credit-card-outline',
      color: ICON_COLOR_DEFAULT,
    },
  },
  skrill: {
    label: 'Skrill',
    icon: {
      type: 'svg',
      Component: SkrillSvg,
    },
  },
  neteller: {
    label: 'Neteller',
    icon: {
      type: 'mcicon',
      name: 'credit-card-outline',
      color: ICON_COLOR_DEFAULT,
    },
  },
  'sepa bank transfer': {
    label: 'SEPA bank transfer',
    icon: {
      type: 'mcicon',
      name: 'bank',
      color: ICON_COLOR_DEFAULT,
    },
  },
  'bank transfer': {
    label: 'Bank transfer',
    icon: {
      type: 'mcicon',
      name: 'bank',
      color: ICON_COLOR_DEFAULT,
    },
  },
  spei: {
    label: 'SPEI',
    icon: {
      type: 'mcicon',
      name: 'bank',
      color: ICON_COLOR_DEFAULT,
    },
  },
  'swift bank transfer': {
    label: 'SWIFT bank transfer',
    icon: {
      type: 'mcicon',
      name: 'bank',
      color: ICON_COLOR_DEFAULT,
    },
  },
  'apple pay': {
    label: 'Apple Pay',
    icon: {
      type: 'svg',
      Component: ApplePaySvg,
    },
  },
  'google pay': {
    label: 'Google Pay',
    icon: {
      type: 'svg',
      Component: GooglePaySvg,
    },
  },
  paypal: {
    label: 'PayPal',
    icon: {
      type: 'svg',
      Component: PayPalSvg,
    },
  },
};

export const getPaymentMethodMeta = (rawValue) => {
  const rawLabel = typeof rawValue === 'string' ? rawValue.trim() : '';
  const key = normalizeKey(rawValue);
  const meta = PAYMENT_METHOD_MAP[key];

  if (meta) {
    return meta;
  }

  return {
    label: rawLabel,
    icon: {
      type: 'mcicon',
      name: 'credit-card-outline',
      color: ICON_COLOR_DEFAULT,
    },
  };
};

export const normalizePaymentMethodLabel = (rawValue) =>
  getPaymentMethodMeta(rawValue).label || '';

