import { useRouter } from 'expo-router';

import { ManageGoodsPanel } from '../../src/components/ManageGoodsPanel';

export default function ManageScreen() {
  const router = useRouter();
  return <ManageGoodsPanel onShowCollection={() => router.push('/(tabs)/collection?mode=collection')} />;
}
