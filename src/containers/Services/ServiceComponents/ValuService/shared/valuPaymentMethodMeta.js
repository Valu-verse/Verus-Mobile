/*
  New file: valuPaymentMethodMeta
  - Normalizes Valu payment method names to canonical display labels
  - Provides icon configuration (SVG or Material icon) for each known method
  - Supplies lookup helpers used by Valu on/off-ramp flows
*/

import RevolutPaySvg from '../../../../../images/paymentIcons/revolutpay.svg';
import SkrillSvg from '../../../../../images/paymentIcons/skrill.svg';
import SepaSvg from '../../../../../images/paymentIcons/sepa.svg';
import NetellerSvg from '../../../../../images/paymentIcons/neteller.svg';
import AstroPaySvg from '../../../../../images/paymentIcons/astropay.svg';

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
      type: 'svg',
      Component: AstroPaySvg,
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
      type: 'svg',
      Component: NetellerSvg,
    },
  },
  'sepa bank transfer': {
    label: 'SEPA bank transfer',
    icon: {
      type: 'svg',
      Component: SepaSvg,
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

