import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type OshiProfile = {
  oshiName: string;
  seriesName: string;
  imageUrl: string | null;
  note: string;
};

type ProfileContextValue = {
  profile: OshiProfile;
  updateProfile: (patch: Partial<OshiProfile>) => Promise<void>;
};

const PROFILE_STORAGE_KEY = 'oshilist.profile.v1';

const defaultProfile: OshiProfile = {
  oshiName: '',
  seriesName: '',
  imageUrl: null,
  note: '',
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<OshiProfile>(defaultProfile);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_STORAGE_KEY).then((stored) => {
      if (stored) {
        setProfile({ ...defaultProfile, ...(JSON.parse(stored) as Partial<OshiProfile>) });
      }
    });
  }, []);

  const updateProfile = async (patch: Partial<OshiProfile>) => {
    const nextProfile = { ...profile, ...patch };
    setProfile(nextProfile);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
  };

  const value = useMemo(() => ({ profile, updateProfile }), [profile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }
  return context;
}
