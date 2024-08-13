import React from 'react'
import { Avatar } from 'react-native-paper';
import { CALLING_CODES_TO_ISO_3166 } from '../constants/callingCodes'
import { ISO_3166_COUNTRIES } from '../constants/iso3166'
import {
  PERSONAL_IMAGE_TYPE_SCHEMA,
  PERSONAL_IMAGE_SUBTYPE_SCHEMA,
} from "../constants/personal";
import { Platform } from 'react-native';
var RNFS = require('react-native-fs');
import { primitives } from "verusid-ts-client"
import { requestPersonalData } from "../auth/authBox";
import {
  PERSONAL_ATTRIBUTES,
  PERSONAL_CONTACT,
  PERSONAL_LOCATIONS,
  PERSONAL_PAYMENT_METHODS,
  PERSONAL_IMAGES,
  PERSONAL_BANK_COUNTRY,
  PERSONAL_BANK_ACCOUNT_NUMBER,
  PERSONAL_BANK_ACCOUNT_TYPE,
  PERSONAL_BANK_ACCOUNT_CURRENCY,

} from "../constants/personal";

import  { IdentityVdxfidMap }  from 'verus-typescript-primitives/dist/utils/IdentityData';
import Colors from '../../globals/colors';
import { defaultPersonalProfileDataTemplate } from "../constants/personal.js";

const { IDENTITY_FIRSTNAME, IDENTITY_LASTNAME, IDENTITY_MIDDLENAME } = primitives;
const { IDENTITY_HOMEADDRESS_STREET1, IDENTITY_HOMEADDRESS_STREET2, IDENTITY_HOMEADDRESS_CITY, IDENTITY_HOMEADDRESS_REGION, IDENTITY_HOMEADDRESS_POSTCODE, IDENTITY_HOMEADDRESS_COUNTRY } = primitives;
const { IDENTITY_CONTACTDETAILS, IDENTITY_PERSONALDETAILS, IDENTITY_LOCATION, IDENTITY_DOCUMENTS, IDENTITY_BANKINGDETAILS, IDENTITY_BANKACCOUNT } = primitives;


export const renderPersonalFullName = (state) => {

  if (!state[IDENTITY_FIRSTNAME.vdxfid] && !state[IDENTITY_LASTNAME.vdxfid]) {
    return {title: "John Doe"}
  }

  return {
    title: `${state[IDENTITY_FIRSTNAME.vdxfid] || ""} ${state[IDENTITY_MIDDLENAME.vdxfid] != null && state[IDENTITY_MIDDLENAME.vdxfid] > 0 ? state[IDENTITY_MIDDLENAME.vdxfid] + " " : ""
      }${state[IDENTITY_LASTNAME.vdxfid] || ""}`
  };
};

export const renderPersonalPhoneNumber = (phone, includeEmoji = true) => {
  return {
    title: `${includeEmoji &&
      CALLING_CODES_TO_ISO_3166[phone.calling_code] != null &&
      ISO_3166_COUNTRIES[CALLING_CODES_TO_ISO_3166[phone.calling_code]] != null
      ? ISO_3166_COUNTRIES[CALLING_CODES_TO_ISO_3166[phone.calling_code]]
        .emoji + " "
      : ""
      }${phone.calling_code.length > 0 ? phone.calling_code : "+0"} ${phone.number.length > 0 ? phone.number : "000000000"
      }`,
  };
};

export const renderPersonalBirthday = (birthday) => {
  const { day, month, year } = birthday;
  const date = new Date(Date.UTC(year, month, day, 3, 0, 0));

  return {
    title: date.toUTCString().split(' ').slice(0, 4).join(' '),
  };
};

export const getPersonalImageDisplayUri = uri => {
  if (uri && uri.startsWith('file://')) {
    return uri;
  } else if (uri != null) {
    const reconstructedUri = RNFS.DocumentDirectoryPath + `/${uri}`;

    if (reconstructedUri.startsWith('file://')) return reconstructedUri;
    else if (Platform.OS === 'android') return `file://${reconstructedUri}`;
    else return reconstructedUri;
  } else {
    return '';
  }
};

export const renderPersonalDocument = (document) => {
  const path = getPersonalImageDisplayUri(document.uris[0]);
  return {
    description: document.description,
    left: (props) => {
      return document.uris.length == 0 ? null : (
        <Avatar.Image
          {...props}
          size={96}
          source={{
            uri: path,
          }}
        />
      );
    },
    title:
      document.image_type == null
        ? 'Document'
        : PERSONAL_IMAGE_TYPE_SCHEMA[document.image_type] == null
          ? "??"
          : `${PERSONAL_IMAGE_TYPE_SCHEMA[document.image_type].title}${document.image_subtype == null ||
            PERSONAL_IMAGE_SUBTYPE_SCHEMA[document.image_subtype] == null
            ? ""
            : ` (${PERSONAL_IMAGE_SUBTYPE_SCHEMA[
              document.image_subtype
            ].title.toLowerCase()})`
          }`,
  };
};

export const renderPersonalEmail = (email) => {
  return {
    title: email.address
  }
}

export const renderPersonalTaxId = (taxCountry) => {
  return {
    title:
      taxCountry.tin.length > 2 ? `****${taxCountry.tin.slice(-2)}` : "****",
  };
};

export const renderPersonalAddress = (address) => {
  return {
    title:
      address[IDENTITY_HOMEADDRESS_COUNTRY.vdxfid].length > 0
        ? `${address[IDENTITY_HOMEADDRESS_STREET1.vdxfid]}${address[IDENTITY_HOMEADDRESS_STREET2.vdxfid] != null && address[IDENTITY_HOMEADDRESS_STREET2.vdxfid].length > 0 ? `, ${address[IDENTITY_HOMEADDRESS_STREET2.vdxfid]}` : ""
        }`
        : "Empty address",
    description: `${address[IDENTITY_HOMEADDRESS_POSTCODE.vdxfid].length > 0 ? `${address[IDENTITY_HOMEADDRESS_POSTCODE.vdxfid]} ` : ""}${address[IDENTITY_HOMEADDRESS_REGION.vdxfid]?.length > 0 ? `${address[IDENTITY_HOMEADDRESS_REGION.vdxfid]}, ` : ""
      }${address[IDENTITY_HOMEADDRESS_CITY.vdxfid]?.length > 0 ? `${address[IDENTITY_HOMEADDRESS_CITY.vdxfid]}, ` : "Unknown City, "}${ISO_3166_COUNTRIES[address[IDENTITY_HOMEADDRESS_COUNTRY.vdxfid]] != null
        ? `${ISO_3166_COUNTRIES[address[IDENTITY_HOMEADDRESS_COUNTRY.vdxfid]].emoji} ${ISO_3166_COUNTRIES[address[IDENTITY_HOMEADDRESS_COUNTRY.vdxfid]].name}`
        : "Unknown Country"
      }`,
  };
}

export const renderPersonalBankAccount = (account) => {
  console.log("test1",account)
  const accountLocaleString = ISO_3166_COUNTRIES[account[PERSONAL_BANK_COUNTRY]]
    ? `${ISO_3166_COUNTRIES[account[PERSONAL_BANK_COUNTRY]].emoji} Account`
    : "Bank Account";
  const accountNumberString =
    account[PERSONAL_BANK_ACCOUNT_NUMBER] != null && account[PERSONAL_BANK_ACCOUNT_NUMBER].length > 4
      ? ` ending in ${account[PERSONAL_BANK_ACCOUNT_NUMBER].slice(-4)}`
      : "";
  const accountDescription = `${account[PERSONAL_BANK_ACCOUNT_CURRENCY] != null && account[PERSONAL_BANK_ACCOUNT_CURRENCY].length > 0
    ? account[PERSONAL_BANK_ACCOUNT_CURRENCY] + " "
    : ""
    }${account[PERSONAL_BANK_ACCOUNT_TYPE]}`;

  return {
    title: `${accountLocaleString}${accountNumberString}`,
    description: accountDescription,
  };
};

/********************************/
// template defaultPersonalProfileDataTemplate in the order:
// new PersonalDataCategory(),
// new ContactDataCategory(),
// new LocationDataCategory(),
// new BankingDataCategory(),
// new DocumentsCategory()
/********************************/

export const checkPersonalDataCatagories = async (profileDataRequested = []) => {
  let success = true;
  await Promise.all(Object.keys(profileDataRequested).map(async (permission) => {
    let errorDetails = "";
    let profiletype;
    let optionalKeys = {}
    let attributes = {};
    switch (permission) {

      case IDENTITY_PERSONALDETAILS.vdxfid:
        attributes = await requestPersonalData(PERSONAL_ATTRIBUTES);
        optionalKeys = { [primitives.IDENTITY_MIDDLENAME.vdxfid]: true };
        profiletype = defaultPersonalProfileDataTemplate[0].data;
        break;
      case IDENTITY_CONTACTDETAILS.vdxfid:
        attributes = await requestPersonalData(PERSONAL_CONTACT);
        profiletype = defaultPersonalProfileDataTemplate[1].data;
        break;
      case IDENTITY_LOCATION.vdxfid:
        const locationReply = await requestPersonalData(PERSONAL_LOCATIONS);
        attributes = locationReply.physical_addresses && locationReply.physical_addresses.length > 0 ? locationReply.physical_addresses[0] : {};
        optionalKeys = { [primitives.IDENTITY_HOMEADDRESS_STREET2.vdxfid]: true };
        profiletype = defaultPersonalProfileDataTemplate[2].data;
        break;
      case IDENTITY_BANKINGDETAILS.vdxfid:
        const bankRetval = await checkBankAccountPresent();
        attributes = bankRetval.attributes;
        profiletype = bankRetval.profiletype;
        break;
      case IDENTITY_DOCUMENTS.vdxfid:
        const retval = await checkDocumentsPresent();
        attributes = retval.attributes;
        profiletype = retval.profiletype;
        break;
    }

    profiletype.forEach((templateCategory) => {
      const one = attributes[templateCategory.vdxfkey];
      if (!optionalKeys[templateCategory.vdxfkey] && ((typeof one === 'object' && Array.isArray(one) && one.length === 0) ||
        (typeof one === 'object' && Object.keys(one).length === 0) ||
        (typeof one === 'string' && one.length === 0)
        || one == undefined)) {
        errorDetails += (errorDetails ? ", " : "") +`${IdentityVdxfidMap[templateCategory.vdxfkey]?.name || templateCategory.vdxfkey}`;
      }
    })

    if (errorDetails.length > 0) {
      profileDataRequested[permission].details = "Missing Information: " + errorDetails;
      profileDataRequested[permission].color = Colors.warningButtonColor;
      success = false;
    } 

  }));
  return success;
}

export const checkBankAccountPresent = async () => {

  const paymentMethods = await requestPersonalData(PERSONAL_PAYMENT_METHODS);

  if (!paymentMethods.bank_accounts || paymentMethods.bank_accounts.length === 0) {
    return { profiletype: [{ vdxfkey: IDENTITY_BANKACCOUNT.vdxfid }], attributes: { [IDENTITY_BANKACCOUNT.vdxfid]: "" } };
  }
  return { profiletype: [{ vdxfkey: IDENTITY_BANKACCOUNT.vdxfid }], attributes: { [IDENTITY_BANKACCOUNT.vdxfid]: "OK" } };
}

export const checkDocumentsPresent = async () => {

  const images = await requestPersonalData(PERSONAL_IMAGES);

  if (!images.documents || images.documents.length === 0) {
    return { profiletype: [{ vdxfkey: primitives.IDENTITY_DOCUMENTS.vdxfid }], attributes: { [primitives.IDENTITY_DOCUMENTS.vdxfid]: "" }};
  }
  return { profiletype: [{ vdxfkey: primitives.IDENTITY_DOCUMENTS.vdxfid }], attributes: { [primitives.IDENTITY_DOCUMENTS.vdxfid]: "OK" }};

}

export const checkPersonalDataKeys = () => { }