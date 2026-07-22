import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './LoginScreen';

type CountryId = 'argentina' | 'bolivia';

type CountrySelectorScreenProps = {
  onContinue?: (country: CountryId) => void;
};

const countries: Array<{
  id: CountryId;
  flag: string;
  label: string;
}> = [
  { id: 'argentina', flag: '🇦🇷', label: 'Argentina' },
  { id: 'bolivia', flag: '🇧🇴', label: 'Bolivia' },
];

const logo = require('../assets/country-selector/fundacion-huesped.png');
const arrowRight = require('../assets/country-selector/arrow-right.png');
const emptyRadio = require('../assets/country-selector/radio-empty.png');

export function CountrySelectorScreen({
  onContinue,
}: CountrySelectorScreenProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryId | null>(
    null,
  );
  const [hasContinued, setHasContinued] = useState(false);

  const handleContinue = () => {
    if (selectedCountry) {
      onContinue?.(selectedCountry);
      setHasContinued(true);
    }
  };

  if (hasContinued) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

      <View style={styles.content}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />

        <Text style={styles.title}>¿Desde qué país estás{`\n`}ingresando?</Text>

        <View style={styles.countryList}>
          {countries.map(country => {
            const isSelected = country.id === selectedCountry;

            return (
              <Pressable
                key={country.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={country.label}
                onPress={() => setSelectedCountry(country.id)}
                style={({ pressed }) => [
                  styles.countryOption,
                  isSelected && styles.countryOptionSelected,
                  pressed && styles.countryOptionPressed,
                ]}
              >
                <View style={styles.radioContainer}>
                  <Image source={emptyRadio} style={styles.radioImage} />
                  {isSelected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.countryLabel}>
                  {country.flag} {country.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.description}>
            Esto nos ayuda a mostrarte guías y{`\n`}protocolos específicos de tu
            jurisdicción.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !selectedCountry }}
            disabled={!selectedCountry}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              selectedCountry
                ? styles.continueButtonEnabled
                : styles.continueButtonDisabled,
              pressed && selectedCountry ? styles.continueButtonPressed : null,
            ]}
          >
            <Text style={styles.continueButtonText}>Continuar</Text>
            <Image source={arrowRight} style={styles.arrowIcon} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  logo: {
    width: 80,
    height: 75,
    alignSelf: 'center',
    marginTop: 50,
  },
  title: {
    marginTop: 159,
    color: '#000000',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.45,
    textAlign: 'center',
  },
  countryList: {
    gap: 10,
    marginTop: 33,
  },
  countryOption: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 7,
    paddingHorizontal: 13,
  },
  countryOptionSelected: {
    borderColor: 'rgba(243, 39, 53, 0.45)',
  },
  countryOptionPressed: {
    backgroundColor: '#FAFAFA',
  },
  radioContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioImage: {
    position: 'absolute',
    width: 18,
    height: 18,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F32735',
  },
  countryLabel: {
    marginLeft: 14,
    color: '#000000',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  footer: {
    marginTop: 'auto',
  },
  description: {
    width: 282,
    alignSelf: 'center',
    color: '#525252',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  continueButton: {
    height: 48,
    marginTop: 16,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(243, 39, 53, 0.25)',
  },
  continueButtonEnabled: {
    backgroundColor: '#F32735',
  },
  continueButtonPressed: {
    opacity: 0.86,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  arrowIcon: {
    width: 20,
    height: 20,
    marginLeft: 8,
  },
});
