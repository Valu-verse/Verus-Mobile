export const PERSONAL_ATTRIBUTES = "attributes"
export const PERSONAL_CONTACT = "contact"
export const PERSONAL_LOCATIONS = "locations"
export const PERSONAL_PAYMENT_METHODS = "payment_methods"
export const PERSONAL_IMAGES = 'images'
export const PERSONAL_IMAGES_DOCUMENTS = 'documents'

// Document types
export const PERSONAL_DOCUMENT_GOVT_ID = 'govt_id'
export const PERSONAL_DOCUMENT_DRIVING_LICENSE = 'driving_license'
export const PERSONAL_DOCUMENT_PASSPORT_CARD = 'passport_card'
export const PERSONAL_DOCUMENT_PASSPORT = 'passport'
export const PERSONAL_DOCUMENT_UTILITY_BILL = 'utility_bill'
export const PERSONAL_DOCUMENT_BANK_STATEMENT = 'bank_statement'
export const PERSONAL_DOCUMENT_OTHER = 'other'
export const PERSONAL_DOCUMENT_SUBTYPE_FRONT = 'front'
export const PERSONAL_DOCUMENT_SUBTYPE_BACK = 'back'

export const PERSONAL_IMAGE_TYPE_SCHEMA = {
  [PERSONAL_DOCUMENT_GOVT_ID]: {
    id: PERSONAL_DOCUMENT_GOVT_ID,
    title: "Government ID",
    description: "General government issued identity",
    images: [{
      key: PERSONAL_DOCUMENT_SUBTYPE_FRONT,
      title: "Front",
      addLabel: "Add image of front"
    }, {
      key: PERSONAL_DOCUMENT_SUBTYPE_BACK,
      title: "Back",
      addLabel: "Add image of back"
    }],
  },
  [PERSONAL_DOCUMENT_PASSPORT]: {
    id: PERSONAL_DOCUMENT_PASSPORT,
    title: "Passport",
    description: "Government issued passport booklet",
    images: [{
      key: PERSONAL_DOCUMENT_SUBTYPE_FRONT,
      title: "Front",
      addLabel: "Add image of picture page"
    }],
  },
  [PERSONAL_DOCUMENT_PASSPORT_CARD]: {
    id: PERSONAL_DOCUMENT_PASSPORT_CARD,
    title: "Passport card",
    description: "Government issued passport card",
    images: [{
      key: PERSONAL_DOCUMENT_SUBTYPE_FRONT,
      title: "Front",
      addLabel: "Add image of front"
    }, {
      key: PERSONAL_DOCUMENT_SUBTYPE_BACK,
      title: "Back",
      addLabel: "Add image of back"
    }],
  },
  [PERSONAL_DOCUMENT_DRIVING_LICENSE]: {
    id: PERSONAL_DOCUMENT_DRIVING_LICENSE,
    title: "Driving licence",
    description: "Government issued driving licence",
    images: [{
      key: PERSONAL_DOCUMENT_SUBTYPE_FRONT,
      title: "Front",
      addLabel: "Add image of front"
    }, {
      key: PERSONAL_DOCUMENT_SUBTYPE_BACK,
      title: "Back",
      addLabel: "Add image of back"
    }],
  },
  [PERSONAL_DOCUMENT_BANK_STATEMENT]: {
    id: PERSONAL_DOCUMENT_BANK_STATEMENT,
    title: "Bank statement",
    description: "Bank statement with address included",
  },
  [PERSONAL_DOCUMENT_UTILITY_BILL]: {
    id: PERSONAL_DOCUMENT_UTILITY_BILL,
    title: "Utility bill",
    description: "Utility bill with address included",
  },
  [PERSONAL_DOCUMENT_OTHER]: {
    id: PERSONAL_DOCUMENT_OTHER,
    title: "Other",
    description: "Any image not listed here",
    images: [{
      key: PERSONAL_DOCUMENT_SUBTYPE_FRONT,
      title: "Front",
      addLabel: "Add image of front"
    }, {
      key: PERSONAL_DOCUMENT_SUBTYPE_BACK,
      title: "Back",
      addLabel: "Add image of back"
    }],
  },
};

export const PERSONAL_IMAGE_SUBTYPE_SCHEMA = {
  [PERSONAL_DOCUMENT_SUBTYPE_FRONT]: {
    id: PERSONAL_DOCUMENT_SUBTYPE_FRONT,
    title: "Front",
  },
  [PERSONAL_DOCUMENT_SUBTYPE_BACK]: {
    id: PERSONAL_DOCUMENT_SUBTYPE_BACK,
    title: "Back",
  },
}

export const PERSONAL_NAME = 'name'
export const PERSONAL_NATIONALITIES = "nationalities"
export const PERSONAL_BIRTHDAY = "birthday"

export const PERSONAL_PHONE_NUMBERS = 'phone_numbers'
export const PERSONAL_EMAILS = 'emails'

export const PERSONAL_PHONE_TYPE_MOBILE = 'mobile'
export const PERSONAL_PHONE_TYPE_HOME = 'home'
export const PERSONAL_PHONE_TYPE_WORK = 'work'

export const PERSONAL_TAX_COUNTRIES = 'tax_countries'
export const PERSONAL_PHYSICAL_ADDRESSES = 'physical_addresses'

export const PERSONAL_BANK_COUNTRY = 'country'
export const PERSONAL_BANK_PRIMARY_CURRENCY = 'primary_currency'
export const PERSONAL_BANK_BENEFICIARY_TYPE = 'beneficiary_type'
export const PERSONAL_BANK_BENEFICIARY_PHYSICAL_ADDRESS = 'beneficiary_physical_address'
export const PERSONAL_BANK_BENEFICIARY_NAME_FULL = 'beneficiary_name_full'
export const PERSONAL_BANK_BENEFICIARY_NAME_FIRST = 'beneficiary_name_first'
export const PERSONAL_BANK_BENEFICIARY_NAME_LAST = 'beneficiary_name_last'
export const PERSONAL_BANK_BENEFICIARY_PHONE = 'beneficiary_phone_number'
export const PERSONAL_BANK_SWIFT_BIC = 'swift_bic'
export const PERSONAL_BANK_BENEFICIARY_DOB = 'beneficiary_dob'
export const PERSONAL_BANK_ACCOUNT_NUMBER = 'account_number'
export const PERSONAL_BANK_ACCOUNT_TYPE = 'account_type'
export const PERSONAL_BANK_BSB_NUMBER = 'bsb_number'
export const PERSONAL_BANK_CODE = 'bank_code'
export const PERSONAL_BANK_NAME = 'bank_name'
export const PERSONAL_BANK_BRANCH_CODE = 'branch_code'
export const PERSONAL_BANK_BRANCH_NAME = 'branch_name'
export const PERSONAL_BANK_CPF_CNPJ = 'cpf_cnpj'
export const PERSONAL_BANK_CHINESE_NATIONAL_ID = 'chinese_national_id_number'
export const PERSONAL_BANK_CLABE = 'clabe'
export const PERSONAL_BANK_CITY = 'bank_city'
export const PERSONAL_BANK_PROVINCE = 'bank_province'
export const PERSONAL_BANK_ROUTING_NUMBER = 'routing_number'

export const PERSONAL_BENEFICIARY_TYPE_INDIVIDUAL = 'individual'
export const PERSONAL_BENEFICIARY_TYPE_CORPORATE = 'corporate'

export const PERSONAL_BANK_ACCOUNT_TYPE_CHECKING = 'checking'
export const PERSONAL_BANK_ACCOUNT_TYPE_SAVINGS = 'savings'

import  * as identitykeys from "verus-typescript-primitives";

export const defaultPersonalProfileDataTemplate = [
  {
    vdxfid: identitykeys.IDENTITY_PERSONALDETAILS.vdxfid,
    data: [
      identitykeys.IDENTITY_FIRSTNAME.vdxfid,
      identitykeys.IDENTITY_LASTNAME.vdxfid,
      identitykeys.IDENTITY_MIDDLENAME.vdxfid,
      identitykeys.IDENTITY_DATEOFBIRTH.vdxfid,
      identitykeys.IDENTITY_NATIONALITY.vdxfid
    ],
    category: "Personal Details",
    details: "Name, birthday, nationality"
  },
  {
    vdxfid: identitykeys.IDENTITY_CONTACTDETAILS.vdxfid,
    data: [
      identitykeys.IDENTITY_EMAIL.vdxfid,
      identitykeys.IDENTITY_PHONENUMBER.vdxfid
    ],
    category: "Contact",
    details: "Email, phone number"
  },
  {
    vdxfid: identitykeys.IDENTITY_LOCATION.vdxfid,
    data: [
      identitykeys.IDENTITY_HOMEADDRESS_STREET1.vdxfid,
      identitykeys.IDENTITY_HOMEADDRESS_STREET2.vdxfid,
      identitykeys.IDENTITY_HOMEADDRESS_CITY.vdxfid,
      identitykeys.IDENTITY_HOMEADDRESS_REGION.vdxfid,
      identitykeys.IDENTITY_HOMEADDRESS_POSTCODE.vdxfid,
      identitykeys.IDENTITY_HOMEADDRESS_COUNTRY.vdxfid,
    ],
    category: "Locations",
    details: "Tax residency, home address"
  },
  {
    vdxfid: identitykeys.IDENTITY_BANKINGDETAILS.vdxfid,
    data: [
      identitykeys.IDENTITY_BANKACCOUNT.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_CURRENCY.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_COUNTRY.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_STREET1.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_STREET2.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_CITY.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_REGION.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_POSTALCODE.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_TAXNUMBER.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_TAXCOUNTRY.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_FIRSTNAME.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_LASTNAME.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_PHONENUMBER.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_NUMBER.vdxfid,
      identitykeys.IDENTITY_BANKINGDETAILS_TYPE.vdxfid
    ],
    category: "Banking Information",
    details: "Bank accounts"
  },
  {
    vdxfid: identitykeys.IDENTITY_DOCUMENTS.vdxfid,
    data: [
      identitykeys.IDENTITY_PASSPORT.vdxfid,
      identitykeys.IDENTITY_DRIVINGLICENCE.vdxfid,
      identitykeys.IDENTITY_RESIDENCEPERMIT.vdxfid,
      identitykeys.IDENTITY_RESIDENTCARD.vdxfid,
      identitykeys.IDENTITY_VISA.vdxfid,
      identitykeys.IDENTITY_IDCARD.vdxfid,
      identitykeys.IDENTITY_SELFIECHECK_IMAGE.vdxfid,
    ],
    category: "Documents",
    details: "Passport, ID, driving license"
  }

]