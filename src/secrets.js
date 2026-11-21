// API key 只存本机 Keychain（expo-secure-store），不写数据库、不进日志、不上云。
import * as SecureStore from 'expo-secure-store';

const K_KEY = 'vv_ai_key';
const K_PROVIDER = 'vv_ai_provider';

export async function getAiConfig() {
  try {
    const [provider, key] = await Promise.all([
      SecureStore.getItemAsync(K_PROVIDER),
      SecureStore.getItemAsync(K_KEY),
    ]);
    return { provider: provider || 'openai', key: key || '' };
  } catch (e) {
    return { provider: 'openai', key: '' };
  }
}

export async function saveAiConfig(provider, key) {
  if (key) {
    await SecureStore.setItemAsync(K_KEY, key.trim());
  } else {
    await SecureStore.deleteItemAsync(K_KEY);
  }
  await SecureStore.setItemAsync(K_PROVIDER, provider || 'openai');
}

export async function clearAiConfig() {
  await SecureStore.deleteItemAsync(K_KEY);
  await SecureStore.deleteItemAsync(K_PROVIDER);
}

export async function hasAiKey() {
  const { key } = await getAiConfig();
  return !!key;
}
