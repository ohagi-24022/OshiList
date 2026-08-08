import { useCallback, useRef } from 'react';
import { Animated, Dimensions, GestureResponderEvent } from 'react-native';

type UseSwipeBackOptions = {
  onClose: () => void;
  startOpen?: boolean;
  threshold?: number;
};

export function useSwipeBack({ onClose, startOpen = false, threshold = 66 }: UseSwipeBackOptions) {
  const translateX = useRef(new Animated.Value(startOpen ? Dimensions.get('window').width : 0)).current;
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const open = useCallback(() => {
    translateX.setValue(Dimensions.get('window').width);
    Animated.timing(translateX, { duration: 190, toValue: 0, useNativeDriver: true }).start();
  }, [translateX]);

  const close = useCallback(() => {
    Animated.timing(translateX, {
      duration: 190,
      toValue: Dimensions.get('window').width,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      requestAnimationFrame(() => {
        translateX.setValue(startOpen ? Dimensions.get('window').width : 0);
      });
    });
  }, [onClose, startOpen, translateX]);

  const closeWithRoute = useCallback((navigate: () => void) => {
    Animated.timing(translateX, {
      duration: 190,
      toValue: Dimensions.get('window').width,
      useNativeDriver: true,
    }).start(() => {
      navigate();
      requestAnimationFrame(() => translateX.setValue(0));
    });
  }, [translateX]);

  const rememberTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
      time: Date.now(),
    };
  }, []);

  const moveWithSwipe = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current;
    if (!start) return;

    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      translateX.setValue(Math.min(dx, 160));
    }
  }, [translateX]);

  const finishSwipe = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const fastEnough = Date.now() - start.time < 700;
    if (dx > threshold && Math.abs(dx) > Math.abs(dy) * 1.25 && fastEnough) {
      close();
      return;
    }

    Animated.spring(translateX, {
      damping: 18,
      stiffness: 220,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [close, threshold, translateX]);

  const cancelSwipe = useCallback(() => {
    touchStartRef.current = null;
    Animated.spring(translateX, {
      damping: 18,
      stiffness: 220,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const gestureHandlers = {
    onTouchCancel: cancelSwipe,
    onTouchEnd: finishSwipe,
    onTouchMove: moveWithSwipe,
    onTouchStart: rememberTouchStart,
  };

  return { close, closeWithRoute, gestureHandlers, open, translateX };
}
