package id.luckybox.security;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKeys;
import java.io.IOException;
import java.security.GeneralSecurityException;

public class EncryptedPreferenceManager {
  private SharedPreferences sharedPreferences;

  public EncryptedPreferenceManager(Context context, String prefName) {
    try {
      String masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC);
      sharedPreferences = EncryptedSharedPreferences.create(
        prefName,
        masterKeyAlias,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
      );
    } catch (GeneralSecurityException | IOException error) {
      sharedPreferences = context.getSharedPreferences(prefName, Context.MODE_PRIVATE);
    }
  }

  public void setString(String key, String value) {
    sharedPreferences.edit().putString(key, value).apply();
  }

  public String getString(String key, String defaultValue) {
    return sharedPreferences.getString(key, defaultValue);
  }

  public void setInt(String key, int value) {
    sharedPreferences.edit().putInt(key, value).apply();
  }

  public int getInt(String key, int defaultValue) {
    return sharedPreferences.getInt(key, defaultValue);
  }

  public void setBoolean(String key, boolean value) {
    sharedPreferences.edit().putBoolean(key, value).apply();
  }

  public boolean getBoolean(String key, boolean defaultValue) {
    return sharedPreferences.getBoolean(key, defaultValue);
  }

  public void remove(String key) {
    sharedPreferences.edit().remove(key).apply();
  }

  public boolean exists(String key) {
    return sharedPreferences.contains(key);
  }

  public void clear() {
    sharedPreferences.edit().clear().apply();
  }
}
