import React, { useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity, Platform, FlatList, Keyboard } from 'react-native';
import { Portal, List, Button, Text, ActivityIndicator, TextInput } from 'react-native-paper';
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
import { VALU_SERVICE } from '../../../../../utils/constants/intervalConstants';
// No drag handle – we follow other modals with a Close button in header

/*
  Updated file: BuySellSheet
  - Bottom-sheet stepper: Prerequisites -> Buy/Sell selection -> Address selection
  - Modern UI with clear action buttons and visual feedback for disabled states
  - Automatic vUSDC.vETH enabling without modal navigation
  - Updated "About vUSDC" intro copy with two small headers and body text
  - Replaced circular backgrounds on Buy/Sell icons with standalone plus/minus icons
  - Icons set to black, added more spacing between title/subtitle, added extra bottom padding
*/

const VUSDC_VETH_ID = 'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd'; // vUSDC.vETH coin id

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

const BuySellSheet = ({ visible, onClose, onComplete }) => {
  const dispatch = useDispatch();
  const activeAccount = useObjectSelector((s) => s.authentication.activeAccount);
  const balances = useObjectSelector((s) => s.ledger.balances);
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
  const canSell = totalVusdcVeth > 0;

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
    return Array.isArray(activeCoinsForUser) && activeCoinsForUser.some((c) => c.id === VUSDC_VETH_ID);
  }, [activeCoinsForUser]);

  const handleEnableCurrency = async () => {
    setLoading(true);
    try {
      // 1) Find vUSDC.vETH coin definition
      const fullCoinData = CoinDirectory.findCoinObj(VUSDC_VETH_ID);

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
      createAlert('Could not enable vUSDC.vETH', e.message || String(e));
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

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={true}
        onRequestClose={onClose}
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
          {/* Modal header with Close button (align with existing SemiModal headers) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 16 }}>
            <Button onPress={onClose} textColor={Colors.primaryColor}>{'Close'}</Button>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{'Buy & sell'}</Text>
            <View style={{ width: 64 }} />
          </View>

          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
            {step === 'prereq' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                {/* Introduction */}
                <View style={{ marginBottom: 36 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: 'black' }}>
                    Cash transactions are now available for vUSDC
                  </Text>
                  <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 32 }}>
                    You can instantly buy vUSDC using your bank account or credit card, and sell it back to cash whenever you need.
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: 'black' }}>
                    vUSDC brings USDC to the Verus network
                  </Text>
                  <Text style={{ fontSize: 14, color: '#666', lineHeight: 20 }}>
                    vUSDC is the bridged version of USDC (regulated stablecoin issued by Circle) that moves from Ethereum to Verus, and back. This allows you to use the stability of USDC within the Verus ecosystem.
                  </Text>
                </View>

                {/* Requirements */}
                <Text style={{ fontSize: 16, marginBottom: 8, fontWeight: '500' }}>Requirements</Text>
                <List.Item
                  title={enabledCurrency ? 'vUSDC.vETH enabled' : 'Enable vUSDC.vETH'}
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
                  description="Buy vUSDC with cash"
                  onPress={() => { setAction('buy'); setStep('address'); }}
                  left={(props) => (
                    <List.Icon {...props} icon="plus" color={'black'} />
                  )}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
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
                  right={(props) => <List.Icon {...props} icon="chevron-right" color={canSell ? 'black' : '#C0C0C0'} />}
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

            {step === 'address' && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
                  {action === 'sell' ? 'Choose source address' : 'Choose destination address'}
                </Text>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 }}>
                  {action === 'sell' 
                    ? 'Select the address from which you want to sell your vUSDC.' 
                    : 'Select the address where you want to receive your vUSDC.'}
                </Text>
                <View>
                  {addresses.map((addr, index) => (
                    <TouchableOpacity
                      key={addr.id || addr.address}
                      onPress={() => { setSelectedAddress(addr); onComplete({ action, address: addr }); }}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: 12,
                        marginBottom: index === addresses.length - 1 ? 16 : 8,
                        paddingVertical: 4,
                        elevation: Platform.OS === 'android' ? 2 : 0,
                        shadowColor: '#000',
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                      }}
                    >
                      <List.Item
                        title={addr.name || addr.address}
                        description={(action === 'sell' ? 'Available: ' : 'Current: ') + (addrBalanceMap[addr.id] || 0).toFixed(2) + ' vUSDC.vETH'}
                        right={(props) => <List.Icon {...props} icon="chevron-right" />}
                        titleStyle={{ fontSize: 16, fontWeight: '500' }}
                        descriptionStyle={{ fontSize: 13, color: '#888' }}
                      />
                    </TouchableOpacity>
                  ))}
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


