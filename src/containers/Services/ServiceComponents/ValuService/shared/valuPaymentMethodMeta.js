/*
  New file: valuPaymentMethodMeta
  - Normalizes Valu payment method names to canonical display labels
  - Provides icon configuration (SVG or Material icon) for each known method
  - Supplies lookup helpers used by Valu on/off-ramp flows
*/

import RevolutPaySvg from '../../../../../images/paymentIcons/revolut1.svg';
import SkrillSvg from '../../../../../images/paymentIcons/skrill1.svg';
import SepaSvg from '../../../../../images/paymentIcons/sepa.svg';
import NetellerAltSvg from '../../../../../images/paymentIcons/neteller1.svg';
import AstroPayPng from '../../../../../images/paymentIcons/astropay.png';
import ApplePaySvg from '../../../../../images/paymentIcons/apple-pay.svg';
import GooglePaySvg from '../../../../../images/paymentIcons/googlepay.svg';
import PayPalSvg from '../../../../../images/paymentIcons/PayPal.svg';
import PaysafeCardSvg from '../../../../../images/paymentIcons/paysafecard.svg';
import MPesaPng from '../../../../../images/paymentIcons/mpesa.png';
import PixSvg from '../../../../../images/paymentIcons/pix.svg';

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
      type: 'image',
      source: AstroPayPng,
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
      Component: NetellerAltSvg,
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
  'paysafe card': {
    label: 'Paysafe Card',
    icon: {
      type: 'svg',
      Component: PaysafeCardSvg,
    },
  },
  paysafecard: {
    label: 'Paysafe Card',
    icon: {
      type: 'svg',
      Component: PaysafeCardSvg,
    },
  },
  'm-pesa': {
    label: 'M-Pesa',
    icon: {
      type: 'image',
      source: MPesaPng,
    },
  },
  pix: {
    label: 'PIX',
    icon: {
      type: 'svg',
      Component: PixSvg,
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

