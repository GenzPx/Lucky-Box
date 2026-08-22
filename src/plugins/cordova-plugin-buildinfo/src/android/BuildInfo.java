























package org.apache.cordova.buildinfo;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.lang.reflect.Field;
import java.text.SimpleDateFormat;







public class BuildInfo extends CordovaPlugin {
	private static final String TAG = "BuildInfo";

	


	private static JSONObject mBuildInfoCache;

	


	public BuildInfo() {
	}

	







	public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {

		if ("init".equals(action)) {
			String buildConfigClassName = null;
			if (1 < args.length()) {
				buildConfigClassName = args.getString(0);
			}

			init(buildConfigClassName, callbackContext);
			return true;
		}

		return false;
	}

	




	private void init(String buildConfigClassName, CallbackContext callbackContext) {
		
		if (null != mBuildInfoCache) {
			callbackContext.success(mBuildInfoCache);
			return;
		}

		
		Activity activity = cordova.getActivity();
		String packageName = activity.getPackageName();
		String basePackageName = packageName;
		CharSequence displayName = "";
		long firstInstallTime = 0;

		PackageManager pm = activity.getPackageManager();

		try {
			PackageInfo pi = pm.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES);
			firstInstallTime = pi.firstInstallTime;

			if (null != pi.applicationInfo) {
				displayName = pi.applicationInfo.loadLabel(pm);
			}
		} catch (PackageManager.NameNotFoundException e) {
			e.printStackTrace();
		}

		
		Class c = null;

		if (null == buildConfigClassName) {
			buildConfigClassName = packageName + ".BuildConfig";
		}

		try {
			c = Class.forName(buildConfigClassName);
		} catch (ClassNotFoundException e) {
		}

		if (null == c) {
			basePackageName = activity.getClass().getPackage().getName();
			buildConfigClassName = basePackageName + ".BuildConfig";

			try {
				c = Class.forName(buildConfigClassName);
			} catch (ClassNotFoundException e) {
				callbackContext.error("BuildConfig ClassNotFoundException: " + e.getMessage());
				return;
			}
		}

		
		mBuildInfoCache = new JSONObject();
		try {
			boolean debug = getClassFieldBoolean(c, "DEBUG", false);

			mBuildInfoCache.put("packageName"    , packageName);
			mBuildInfoCache.put("basePackageName", basePackageName);
			mBuildInfoCache.put("displayName"    , displayName);
			mBuildInfoCache.put("name"           , displayName); 
			mBuildInfoCache.put("version"        , getClassFieldString(c, "VERSION_NAME", ""));
			mBuildInfoCache.put("versionCode"    , getClassFieldInt(c, "VERSION_CODE", 0));
			mBuildInfoCache.put("debug"          , debug);
			
			mBuildInfoCache.put("installDate"    , convertLongToDateTimeString(firstInstallTime));
			mBuildInfoCache.put("buildType"      , getClassFieldString(c, "BUILD_TYPE", ""));
			mBuildInfoCache.put("flavor"         , getClassFieldString(c, "FLAVOR", ""));

			if (debug) {
				Log.d(TAG, "packageName    : \"" + mBuildInfoCache.getString("packageName") + "\"");
				Log.d(TAG, "basePackageName: \"" + mBuildInfoCache.getString("basePackageName") + "\"");
				Log.d(TAG, "displayName    : \"" + mBuildInfoCache.getString("displayName") + "\"");
				Log.d(TAG, "name           : \"" + mBuildInfoCache.getString("name") + "\"");
				Log.d(TAG, "version        : \"" + mBuildInfoCache.getString("version") + "\"");
				Log.d(TAG, "versionCode    : " + mBuildInfoCache.getInt("versionCode"));
				Log.d(TAG, "debug          : " + (mBuildInfoCache.getBoolean("debug") ? "true" : "false"));
				Log.d(TAG, "buildType      : \"" + mBuildInfoCache.getString("buildType") + "\"");
				Log.d(TAG, "flavor         : \"" + mBuildInfoCache.getString("flavor") + "\"");
				
				Log.d(TAG, "installDate    : \"" + mBuildInfoCache.getString("installDate") + "\"");
			}
		} catch (JSONException e) {
			e.printStackTrace();
			callbackContext.error("JSONException: " + e.getMessage());
			return;
		}

		callbackContext.success(mBuildInfoCache);
	}

	






	private static boolean getClassFieldBoolean(Class c, String fieldName, boolean defaultReturn) {
		boolean ret = defaultReturn;
		Field field = getClassField(c, fieldName);

		if (null != field) {
			try {
				ret = field.getBoolean(c);
			} catch (IllegalAccessException iae) {
				iae.printStackTrace();
			}
		}

		return ret;
	}

	






	private static String getClassFieldString(Class c, String fieldName, String defaultReturn) {
		String ret = defaultReturn;
		Field field = getClassField(c, fieldName);

		if (null != field) {
			try {
				ret = (String)field.get(c);
			} catch (IllegalAccessException iae) {
				iae.printStackTrace();
			}
		}

		return ret;
	}

	






	private static int getClassFieldInt(Class c, String fieldName, int defaultReturn) {
		int ret = defaultReturn;
		Field field = getClassField(c, fieldName);

		if (null != field) {
			try {
				ret = field.getInt(c);
			} catch (IllegalAccessException iae) {
				iae.printStackTrace();
			}
		}

		return ret;
	}

	






	private static long getClassFieldLong(Class c, String fieldName, long defaultReturn) {
		long ret = defaultReturn;
		Field field = getClassField(c, fieldName);

		if (null != field) {
			try {
				ret = field.getLong(c);
			} catch (IllegalAccessException iae) {
				iae.printStackTrace();
			}
		}

		return ret;
	}

	





	private static Field getClassField(Class c, String fieldName) {
		Field field = null;

		try {
			field = c.getField(fieldName);
		} catch (NoSuchFieldException nsfe) {
			nsfe.printStackTrace();
		}

		return field;
	}

	private static String convertLongToDateTimeString(long mills) {
		SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ");
		return formatter.format(mills);
	}
}
