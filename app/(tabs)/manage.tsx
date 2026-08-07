import { Redirect } from 'expo-router';

export default function ManageScreen() {
  return <Redirect href="/(tabs)/collection?mode=manage" />;
}
