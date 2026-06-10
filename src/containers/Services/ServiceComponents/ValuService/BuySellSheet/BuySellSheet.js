import React, { useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity, Platform, FlatList, Keyboard, StyleSheet } from 'react-native';
import { Portal, List, Button, Text, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useObjectSelector } from '../../../../../hooks/useObjectSelector';
import { ISO_3166_COUNTRIES } from '../../../../../utils/constants/iso3166';
// Removed ListSelectionModal to avoid nested modal issues
import { requestPersonalData } from '../../../../../utils/auth/authBox';
import { PERSONAL_LOCATIONS } from '../../../../../utils/constants/personal';
import { modifyPersonalDataForUser } from '../../../../../actions/actionDispatchers';
import Colors from '../../../../../globals/colors';
import { CoinDirectory } from '../../../../../utils/CoinData/CoinDirectory';
import SemiModal from '../../../../../components/SemiModal';
import { useDispatch } from 'react-redux';
import { addCoin, addKeypairs, setUserCoins } from '../../../../../actions/actionCreators';
import { refreshActiveChainLifecycles } from '../../../../../actions/actions/intervals/dispatchers/lifecycleManager';
import { createAlert } from '../../../../../actions/actions/alert/dispatchers/alert';
import { initiatePartnerUserId } from '../../../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager';
import { requestSeeds } from '../../../../../utils/auth/authBox';
import { API_GET_BALANCES, ERC20, ETH, VALU_SERVICE } from '../../../../../utils/constants/intervalConstants';
import { extractLedgerData } from '../../../../../utils/ledger/extractLedgerData';
// No drag handle – we follow other modals with a Close button in header

/*
  BuySellSheet
  - Bottom-sheet stepper: Prerequisites -> Buy/Sell selection -> Address selection
  - 2026-02-09: Filter out Private subwallet from address list (vUSDC cannot be on private addresses).
  - 2026-02-09: Address step redesign: remove wallet icon, use grey card style (#F8F8F8) matching SendSourceSubwalletSheet.
  - 2026-02-09: Removed "My wallet" badge from Buy address step.
*/

const VUSDC_VETH_ID = 'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd'; // vUSDC.vETH coin id (used for sell flow balance)
const USDC_ETH_ID = 'USDC'; // Ethereum USDC (ERC20) – destination for buy flow
const ETH_COIN_ID = 'ETH';   // Ethereum coin – used to derive ETH address

const ALLOWED_COUNTRIES = [
  'US', 'CA', 'GB', 'AT', 'BE', 'CY', 'CZ', 'EE', 'FI', 'FR', 'DE',
  'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'RO', 'SK', 'SI', 'ES'
];

const computeVusdcVethBalances = (balances, allSubWallets, ticker) => {
  const addrs = allSubWallets[ticker] || [];
  const map = {};
  let total = 0;
  for (const addr of addrs) {
    const amt = balances[VUSDC_VETH_ID] && balances[VUSDC_VETH_ID][addr.id] && balances[VUSDC_VETH_ID][addr.id].total
      ? Number(balances[VUSDC_VETH_ID][addr.id].total)
      : 0;
    map[addr.id] = amt;
    total += amt;
  }
  return { map, total };
};

const styles = StyleSheet.create({
  skeletonListItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 8,
    paddingLeft: 56, // Space for left icon
    paddingRight: 16, // Space for right chevron
  },
  skeletonTitle: {
    height: 22,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    width: '30%',
    marginBottom: 6,
  },
  skeletonDescription: {
    height: 18,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    width: '50%',
  },
  // Address step: grey card style matching SendSourceSubwalletSheet
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  addressCardLeft: {
    flex: 1,
  },
  addressCardRight: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  addressPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  addressSecondaryText: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  addressChevron: {
    marginLeft: 4,
  },
});

const BuySellSheet = ({ visible, onClose, onComplete }) => {
  const dispatch = useDispatch();
  const activeAccount = useObjectSelector((s) => s.authentication.activeAccount);
  const balances = useObjectSelector((s) => extractLedgerData(s, 'balances', API_GET_BALANCES));
  const allSubWallets = useObjectSelector((s) => s.coinMenus.allSubWallets);
  const activeCoinList = useObjectSelector((s) => s.coins.activeCoinList);
  const valuService = useObjectSelector((s) => s.channelStore_valu_service);

  const ticker = Object.keys(activeAccount.testnetOverrides).length > 0 ? 'VRSCTEST' : 'VRSC';
  const [loading, setLoading] = useState(false);
  const [countryExpanded, setCountryExpanded] = useState(false); // legacy inline selector flag (no longer used for UI)
  const [countrySearch, setCountrySearch] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [locations, setLocations] = useState({});
  const [taxCountry, setTaxCountry] = useState(null);
  const activeCoinsForUser = useObjectSelector((s) => s.coins.activeCoinsForUser);
  const [step, setStep] = useState('prereq'); // 'prereq' | 'country' | 'buysell' | 'address'
  const [action, setAction] = useState(null); // 'buy' | 'sell'
  const [selectedAddress, setSelectedAddress] = useState(null);

  const { map: addrBalanceMap, total: totalVusdcVeth } = useMemo(() => computeVusdcVethBalances(balances, allSubWallets, ticker), [balances, allSubWallets, ticker]);

  const addresses = allSubWallets[ticker] || [];
  // vUSDC cannot be on private (dlight) addresses; exclude PRIVATE_WALLET from source/destination list
  const vusdcEligibleAddresses = useMemo(
    () => addresses.filter((addr) => addr.id !== 'PRIVATE_WALLET'),
    [addresses]
  );
  const canSell = true;

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Ensure partner user ID is initialized
        if (!valuService.partnerUserId) {
          const seed = (await requestSeeds())[VALU_SERVICE];
          if (seed == null) throw new Error('No Valu seed present');
          await initiatePartnerUserId(seed);
        }

        const location = await requestPersonalData(PERSONAL_LOCATIONS);
        setLocations(location || {});
        const tc = location?.tax_countries?.[0] || null;
        setTaxCountry(tc);
      } catch (e) {
        createAlert('Error initializing VALU service', e.message || String(e));
      }
      setLoading(false);
    };
    if (visible) init();
  }, [visible]);

  // Track keyboard to adjust dropdown position
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, []);

  const enabledCurrency = useMemo(() => {
    return Array.isArray(activeCoinsForUser) && activeCoinsForUser.some((c) => c.id === USDC_ETH_ID);
  }, [activeCoinsForUser]);

  // Derive the user's Ethereum address from their account keys
  const ethAddress = useMemo(() => {
    return (
      activeAccount?.keys?.[USDC_ETH_ID]?.[ERC20]?.addresses?.[0] ||
      activeAccount?.keys?.[ETH_COIN_ID]?.[ETH]?.addresses?.[0] ||
      null
    );
  }, [activeAccount]);

  const handleEnableCurrency = async () => {
    setLoading(true);
    try {
      // 1) Find USDC (ERC20 on Ethereum) coin definition
      const fullCoinData = CoinDirectory.findCoinObj(USDC_ETH_ID);

      // 2) Add keypairs for user (idempotent)
      await dispatch(
        await addKeypairs(
          fullCoinData,
          activeAccount.keys,
          activeAccount.keyDerivationVersion == null ? 0 : activeAccount.keyDerivationVersion,
        ),
      );

      // 3) Add coin to active coins (idempotent)
      const addCoinAction = await addCoin(
        fullCoinData,
        activeCoinList,
        activeAccount.id,
        fullCoinData.compatible_channels,
      );

      if (addCoinAction) {
        dispatch(addCoinAction);

        // 4) Update user coins and lifecycles so it appears on dashboard
        const setUserCoinsAction = setUserCoins(activeCoinList, activeAccount.id);
        dispatch(setUserCoinsAction);
        refreshActiveChainLifecycles(setUserCoinsAction.payload.activeCoinsForUser);
      }
    } catch (e) {
      createAlert('Could not enable USDC', e.message || String(e));
    }
    setLoading(false);
  };

  const updateTaxCountry = async (next) => {
    if (taxCountry?.country === next.country) return; // No-op if same country
    
    setLoading(true);
    try {
      const taxCountries = [next];
      await modifyPersonalDataForUser(
        { ...locations, tax_countries: taxCountries },
        PERSONAL_LOCATIONS,
        activeAccount.accountHash
      );
      setTaxCountry(next);
    } catch (e) {
      createAlert('Error updating country', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const selectCountry = (countryCode) => {
    setCountryExpanded(false);
    setCountrySearch('');
    const next = { ...(taxCountry || {}), country: countryCode };
    // Defer to next tick to avoid update loops
    setTimeout(() => updateTaxCountry(next), 0);
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return ALLOWED_COUNTRIES;
    const search = countrySearch.toLowerCase();
    return ALLOWED_COUNTRIES.filter(code => {
      const country = ISO_3166_COUNTRIES[code];
      return country?.name?.toLowerCase().includes(search) || code.toLowerCase().includes(search);
    });
  }, [countrySearch]);

  // Auto-advance logic only
  const goNext = () => {
    if (step === 'prereq') setStep('buysell');
    else if (step === 'buysell') setStep('address');
  };

  if (!visible) return null;

  const prereqsSatisfied = enabledCurrency && !!taxCountry?.country;

  // Auto-skip prerequisites if both requirements are met (avoid loops during country selection or country step)
  useEffect(() => {
    if (visible && step === 'prereq' && prereqsSatisfied && !loading) {
      setStep('buysell');
    }
  }, [visible, step, prereqsSatisfied, loading]);

  const renderSkeletonPrereq = () => {
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Buy Option Skeleton */}
        <View style={styles.skeletonListItem}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonDescription} />
        </View>

        {/* Sell Option Skeleton */}
        <View style={styles.skeletonListItem}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonDescription} />
        </View>
      </View>
    );
  };

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={true}
        onRequestClose={onClose}
        title="Buy & sell"
        flexHeight={0.01} // Minimal flex to override default
        contentContainerStyle={{ 
          borderTopLeftRadius: 16, 
          borderTopRightRadius: 16,
          flex: 0, // Override flex behavior
          alignSelf: 'flex-end',
          width: '100%',
          maxHeight: '70%',
          marginBottom: keyboardHeight > 0 ? keyboardHeight : 0 // Move sheet above keyboard
        }}
      >
        <View>
          {loading ? (
            renderSkeletonPrereq()
          ) : (
            <>
            {step === 'prereq' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                {/* Introduction */}
                <View style={{ marginBottom: 36 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: 'black' }}>
                    Buy USDC directly to your Ethereum wallet
                  </Text>
                  <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 32 }}>
                    Purchase USDC using your bank account or credit card. It arrives in your Ethereum wallet first, and you can then bridge it to the Verus network whenever you like.
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: 'black' }}>
                    Two simple steps
                  </Text>
                  <Text style={{ fontSize: 14, color: '#666', lineHeight: 20 }}>
                    Step 1: Buy USDC — it lands in your Ethereum wallet address.{`\n`}Step 2: Bridge USDC to Verus using the Convert screen to receive vUSDC.vETH.
                  </Text>
                </View>

                {/* Requirements */}
                  <Text style={{ fontSize: 16, marginBottom: 8, fontWeight: '500' }}>Requirements</Text>
                <List.Item
                  title={enabledCurrency ? 'USDC (Ethereum) enabled' : 'Enable USDC (Ethereum)'}
                  right={() => (
                    enabledCurrency ? (
                      <Text style={{ color: Colors.verusGreenColor, fontWeight: '600' }}>✓ Enabled</Text>
                    ) : (
                      <Button 
                        mode="contained" 
                        onPress={handleEnableCurrency}
                        style={{
                          borderRadius: 22,
                          backgroundColor: Colors.primaryColor,
                          elevation: 0,
                          shadowColor: 'transparent',
                          shadowOpacity: 0,
                          shadowRadius: 0,
                          shadowOffset: { width: 0, height: 0 },
                        }}
                        contentStyle={{ height: 36 }}
                        labelStyle={{ 
                          color: Colors.secondaryColor, 
                          fontWeight: '600', 
                          fontSize: 14, 
                          textTransform: 'none',
                          letterSpacing: 0
                        }}
                      >
                        Enable now
                      </Button>
                    )
                  )}
                />
                <List.Item
                  title={taxCountry?.country ? `${ISO_3166_COUNTRIES[taxCountry.country]?.emoji} ${ISO_3166_COUNTRIES[taxCountry.country]?.name}` : 'Select country'}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => {
                    setCountrySearch('');
                    setStep('country');
                  }}
                  style={{ height: 44, justifyContent: 'center', marginBottom: 12 }}
                />
              </View>
            )}

            {step === 'buysell' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                
                {/* Buy Option */}
                <List.Item
                  title="Buy"
                  description="Buy USDC on Ethereum with cash"
                  onPress={() => { setAction('buy'); setStep('address'); }}
                  left={(props) => (
                    <List.Icon {...props} icon="plus" color={'black'} />
                  )}
                  right={(props) => <List.Icon {...props} icon="chevron-right" color="#888" />}
                  titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
                  descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
                  style={{ 
                    backgroundColor: 'white',
                    borderRadius: 12,
                    marginBottom: 12,
                    paddingVertical: 8
                  }}
                />

                {/* Sell Option */}
                <List.Item
                  title="Sell"
                  description={canSell ? 'Sell vUSDC for cash' : 'No vUSDC to sell'}
                  onPress={() => { if (canSell) { setAction('sell'); setStep('address'); } }}
                  disabled={!canSell}
                  left={(props) => (
                    <List.Icon {...props} icon="minus" color={'black'} />
                  )}
                  right={(props) => <List.Icon {...props} icon="chevron-right" color={canSell ? '#888' : '#C0C0C0'} />}
                  titleStyle={{ 
                    fontSize: 18, 
                    fontWeight: '600', 
                    color: canSell ? 'black' : '#A0A0A0' 
                  }}
                  descriptionStyle={{ 
                    fontSize: 14, 
                    color: canSell ? '#666' : '#C0C0C0',
                    marginTop: 6
                  }}
                  style={{ 
                    backgroundColor: canSell ? 'white' : '#F8F8F8',
                    borderRadius: 12,
                    marginBottom: 12,
                    paddingVertical: 8,
                    opacity: canSell ? 1 : 0.6
                  }}
                />
              </View>
            )}

            {step === 'country' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12, maxHeight: keyboardHeight > 0 ? 300 : undefined }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Select country</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  style={{ backgroundColor: '#F8F8F8', marginBottom: 8, height: 40 }}
                  contentStyle={{ fontSize: 14 }}
                  outlineStyle={{ borderWidth: 0 }}
                  left={<TextInput.Icon icon="magnify" size={18} />}
                />
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(code) => code}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps={'handled'}
                  style={{ flexGrow: 0, maxHeight: keyboardHeight > 0 ? 240 : 360 }}
                  renderItem={({ item: code }) => {
                    const country = ISO_3166_COUNTRIES[code];
                    const isSelected = taxCountry?.country === code;
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          selectCountry(code);
                          // Auto-advance depending on prerequisites
                          setStep(enabledCurrency ? 'buysell' : 'prereq');
                        }}
                        activeOpacity={0.7}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 8,
                          borderRadius: 8,
                          backgroundColor: isSelected ? '#E8F5E8' : 'transparent',
                        }}
                      >
                        <Text style={{ 
                          fontSize: 14, 
                          color: isSelected ? Colors.primaryColor : 'black',
                          fontWeight: isSelected ? '600' : '400'
                        }}>
                          {country.emoji} {country.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            )}

            {step === 'address' && action === 'buy' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 4 }}>How it works</Text>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 }}>
                  Your USDC is purchased in two steps.
                </Text>

                {/* Step 1 */}
                <View style={[styles.addressCard, { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 10 }]}>
                  <Text style={{ fontSize: 12, color: Colors.primaryColor, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 }}>STEP 1 — BUY NOW</Text>
                  <Text style={styles.addressPrimaryText}>Purchase USDC on Ethereum</Text>
                  <Text style={[styles.addressSecondaryText, { marginTop: 6 }]}>
                    Your USDC will be deposited directly to your Ethereum wallet:
                  </Text>
                  <Text
                    style={[styles.addressSecondaryText, { marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {ethAddress || 'Ethereum address not found'}
                  </Text>
                </View>

                {/* Step 2 */}
                <View style={[styles.addressCard, { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 20, opacity: 0.7 }]}>
                  <Text style={{ fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 }}>STEP 2 — BRIDGE LATER</Text>
                  <Text style={styles.addressPrimaryText}>Send USDC to Verus Network</Text>
                  <Text style={[styles.addressSecondaryText, { marginTop: 6 }]}>
                    Once your USDC arrives on Ethereum, use the Convert screen to move your USDC to Verus.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    {
                      backgroundColor: Colors.primaryColor,
                      borderRadius: 22,
                      paddingVertical: 14,
                      alignItems: 'center',
                      opacity: ethAddress ? 1 : 0.5,
                    }
                  ]}
                  onPress={() => {
                    if (!ethAddress) return;
                    onComplete({
                      action: 'buy',
                      address: { id: ethAddress, name: 'Ethereum Wallet', addressType: 'ethereum' },
                    });
                  }}
                  disabled={!ethAddress}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Continue to payment</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'address' && action === 'sell' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Choose source address</Text>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 }}>
                  Select the address from which you want to sell your vUSDC.
                </Text>
                <View>
                  {vusdcEligibleAddresses.map((addr) => {
                    const amountNum = (addrBalanceMap[addr.id] || 0).toFixed(2);
                    const amountFormatted = (Math.floor(Number(amountNum) * 100) / 100).toFixed(2);
                    return (
                      <TouchableOpacity
                        key={addr.id || addr.address}
                        style={styles.addressCard}
                        onPress={() => { setSelectedAddress(addr); onComplete({ action, address: addr }); }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.addressCardLeft}>
                          <Text style={styles.addressPrimaryText}>
                            {amountFormatted + ' vUSDC'}
                            <Text style={[styles.addressSecondaryText, { marginTop: 0, fontWeight: '500', color: '#777' }]}>.vETH</Text>
                          </Text>
                          <Text style={styles.addressSecondaryText} numberOfLines={1}>
                            {addr.name || addr.address}
                          </Text>
                        </View>
                        <View style={styles.addressCardRight}>
                          <MaterialCommunityIcons name="chevron-right" size={20} color="#CCC" style={styles.addressChevron} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Country modal removed - now inline */}
            </>
          )}
        </View>
      </SemiModal>
    </Portal>
  );
};

export default BuySellSheet;


