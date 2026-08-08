import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { RefObject, useEffect } from 'react';

type TabNavigation = {
  addListener: (eventName: 'tabPress', callback: () => void) => () => void;
};

type ScrollableRef =
  | {
      scrollTo?: (options: { animated?: boolean; y?: number }) => void;
      scrollToOffset?: (options: { animated?: boolean; offset: number }) => void;
    }
  | null;

function scrollToTop(ref: RefObject<ScrollableRef>) {
  ref.current?.scrollTo?.({ animated: true, y: 0 });
  ref.current?.scrollToOffset?.({ animated: true, offset: 0 });
}

export function useTabReset(ref: RefObject<ScrollableRef>, onReset?: () => void) {
  const navigation = useNavigation();
  useScrollToTop(ref as RefObject<any>);

  useEffect(() => {
    const tabNavigation = navigation as unknown as TabNavigation;
    const unsubscribe = tabNavigation.addListener('tabPress', () => {
      onReset?.();
      requestAnimationFrame(() => scrollToTop(ref));
    });
    return unsubscribe;
  }, [navigation, onReset, ref]);
}
