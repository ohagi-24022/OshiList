import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type OshiProfile = {
  id: string;
  oshiName: string;
  seriesName: string;
  imageUrl: string | null;
  note: string;
  markIcon: string;
  markColor: string | null;
};

type ProfileContextValue = {
  profile: OshiProfile;
  profiles: OshiProfile[];
  activeProfileId: string;
  updateProfile: (patch: Partial<OshiProfile>) => Promise<void>;
  addProfilePreset: (input: Partial<OshiProfile>) => Promise<void>;
  replaceProfiles: (nextProfiles: OshiProfile[], nextActiveProfileId?: string) => Promise<void>;
  selectProfile: (id: string) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
};

const PROFILE_STORAGE_KEY = 'oshilist.profile.v1';

const defaultProfile: OshiProfile = {
  id: 'default-oshi',
  oshiName: '',
  seriesName: '',
  imageUrl: null,
  note: '',
  markIcon: 'heart',
  markColor: null,
};

type StoredProfileState = {
  activeProfileId: string;
  profiles: OshiProfile[];
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function normalizeProfile(input: Partial<OshiProfile>, fallbackId = `oshi-${Date.now()}`): OshiProfile {
  return {
    ...defaultProfile,
    ...input,
    id: input.id || fallbackId,
  };
}

function readStoredProfileState(stored: string): StoredProfileState {
  try {
    const parsed = JSON.parse(stored) as Partial<OshiProfile> | Partial<StoredProfileState>;
    if ('profiles' in parsed && Array.isArray(parsed.profiles)) {
      const profiles = parsed.profiles.map((item, index) => normalizeProfile(item, item.id || `oshi-${index}`));
      const activeProfileId = parsed.activeProfileId && profiles.some((item) => item.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : profiles[0]?.id ?? defaultProfile.id;
      return {
        activeProfileId,
        profiles: profiles.length ? profiles : [defaultProfile],
      };
    }
    const profile = normalizeProfile(parsed as Partial<OshiProfile>, defaultProfile.id);
    return { activeProfileId: profile.id, profiles: [profile] };
  } catch {
    return { activeProfileId: defaultProfile.id, profiles: [defaultProfile] };
  }
}

function serializeProfileState(activeProfileId: string, profiles: OshiProfile[]) {
  return JSON.stringify({ activeProfileId, profiles });
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profiles, setProfiles] = useState<OshiProfile[]>([defaultProfile]);
  const [activeProfileId, setActiveProfileId] = useState(defaultProfile.id);
  const profile = profiles.find((item) => item.id === activeProfileId) ?? profiles[0] ?? defaultProfile;

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_STORAGE_KEY).then((stored) => {
      if (stored) {
        const state = readStoredProfileState(stored);
        setProfiles(state.profiles);
        setActiveProfileId(state.activeProfileId);
      }
    });
  }, []);

  const updateProfile = async (patch: Partial<OshiProfile>) => {
    const nextProfiles = profiles.map((item) => (item.id === profile.id ? normalizeProfile({ ...item, ...patch }, item.id) : item));
    setProfiles(nextProfiles);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, serializeProfileState(profile.id, nextProfiles));
  };

  const addProfilePreset = async (input: Partial<OshiProfile>) => {
    const nextProfile = normalizeProfile(input, `oshi-${Date.now()}`);
    const nextProfiles = [nextProfile, ...profiles];
    setProfiles(nextProfiles);
    setActiveProfileId(nextProfile.id);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, serializeProfileState(nextProfile.id, nextProfiles));
  };

  const replaceProfiles = async (nextProfiles: OshiProfile[], nextActiveProfileId = '') => {
    const sanitizedProfiles = nextProfiles.map((item, index) => normalizeProfile(item, item.id || `oshi-${Date.now()}-${index}`));
    const profilesToSave = sanitizedProfiles.length ? sanitizedProfiles : [defaultProfile];
    const activeId = profilesToSave.some((item) => item.id === nextActiveProfileId) ? nextActiveProfileId : profilesToSave[0].id;
    setProfiles(profilesToSave);
    setActiveProfileId(activeId);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, serializeProfileState(activeId, profilesToSave));
  };

  const selectProfile = async (id: string) => {
    if (!profiles.some((item) => item.id === id)) return;
    setActiveProfileId(id);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, serializeProfileState(id, profiles));
  };

  const removeProfile = async (id: string) => {
    if (profiles.length <= 1) return;
    const nextProfiles = profiles.filter((item) => item.id !== id);
    const nextActiveId = activeProfileId === id ? nextProfiles[0].id : activeProfileId;
    setProfiles(nextProfiles);
    setActiveProfileId(nextActiveId);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, serializeProfileState(nextActiveId, nextProfiles));
  };

  const value = useMemo(
    () => ({ profile, profiles, activeProfileId, updateProfile, addProfilePreset, replaceProfiles, selectProfile, removeProfile }),
    [activeProfileId, profile, profiles],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }
  return context;
}
