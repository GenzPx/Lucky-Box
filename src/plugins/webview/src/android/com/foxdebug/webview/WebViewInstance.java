package com.foxdebug.webview;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.cordova.CallbackContext;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

public class WebViewInstance {

  private static final String TAG = "WebViewInstance";

  





  private static final String BRIDGE_JS =
    "(function(){" +
    "if(window.webview&&window.webview.__acodeBridge){return;}" +
    "var callbacks=[];" +
    "window.webview={" +
    "__acodeBridge:true," +
    "onMessage:function(cb){if(typeof cb==='function'){callbacks.push(cb);}}," +
    "offMessage:function(cb){callbacks=callbacks.filter(function(c){return c!==cb;});}," +
    "postMessage:function(msg){" +
    "var data=(typeof msg==='string')?msg:JSON.stringify(msg);" +
    "window.AcodeWebViewNative.postMessage(String(data));" +
    "}," +
    "_dispatch:function(msg){" +
    "callbacks.slice().forEach(function(cb){try{cb(msg);}catch(e){console.error(e);}});" +
    "}" +
    "};" +
    "})();";

  final String id;
  final String mode;
  final String title;
  final boolean allowNavigation;
  final boolean allowDownloads;
  final WebViewPlugin plugin;

  private WebView webView;
  
  private WebViewActivity hostingActivity = null;
  private boolean isDestroyed = false;
  
  private String pendingUrl = null;
  private String pendingHtml = null;

  WebViewInstance(
    String id, String mode, String title,
    boolean allowNavigation, boolean allowDownloads,
    WebViewPlugin plugin
  ) {
    this.id = id;
    this.mode = mode;
    this.title = title;
    this.allowNavigation = allowNavigation;
    this.allowDownloads = allowDownloads;
    this.plugin = plugin;
  }

  public WebView getWebView() {
    return webView;
  }

  String getTitle() {
    return title;
  }

  boolean isFullscreen() {
    return "fullscreen".equals(mode);
  }

  WebViewActivity getHostingActivity() {
    return hostingActivity;
  }

  void setHostingActivity(WebViewActivity activity) {
    hostingActivity = activity;
  }

  void clearHostingActivity(WebViewActivity activity) {
    if (hostingActivity == activity) {
      hostingActivity = null;
    }
  }

  void createWebView(Activity activity) {
    
    
    if (webView != null) return;
    webView = new WebView(activity);

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    
    
    
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    setFileUrlAccessFlags(settings);
    settings.setDisplayZoomControls(false);
    settings.setLoadWithOverviewMode(true);
    settings.setUseWideViewPort(true);

    webView.setWebViewClient(new InstanceWebViewClient());
    webView.setWebChromeClient(new InstanceWebChromeClient());
    webView.setFocusable(true);
    webView.setFocusableInTouchMode(true);

    webView.addJavascriptInterface(new JsBridge(), "AcodeWebViewNative");

    if (allowDownloads) {
      webView.setDownloadListener(new InstanceDownloadListener(activity));
    }

    injectBridge(webView);

    
    
    if (pendingUrl != null) {
      webView.loadUrl(pendingUrl);
      pendingUrl = null;
      pendingHtml = null;
    } else if (pendingHtml != null) {
      webView.loadDataWithBaseURL(null, pendingHtml, "text/html", "UTF-8", null);
      pendingHtml = null;
    }
  }

  @SuppressWarnings("deprecation")
  private static void setFileUrlAccessFlags(WebSettings settings) {
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
  }

  private static void injectBridge(WebView view) {
    view.evaluateJavascript(BRIDGE_JS, null);
  }

  





  @SuppressWarnings("deprecation")
  static void applySystemBarInsets(final View view) {
    view.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
      @Override
      public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
        int left, top, right, bottom;
        if (Build.VERSION.SDK_INT >= 30) {
          Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
          left = bars.left;
          top = bars.top;
          right = bars.right;
          bottom = bars.bottom;
        } else {
          left = insets.getSystemWindowInsetLeft();
          top = insets.getSystemWindowInsetTop();
          right = insets.getSystemWindowInsetRight();
          bottom = insets.getSystemWindowInsetBottom();
        }
        v.setPadding(left, top, right, bottom);
        return insets;
      }
    });
  }

  private static final Pattern SCHEME_PATTERN =
    Pattern.compile("^([a-zA-Z][a-zA-Z0-9+\\-.]*)://");

  






  private static String sanitizeUrl(String url) {
    if (url == null) return null;
    String trimmed = url.trim();
    if (trimmed.isEmpty()) return null;
    Matcher matcher = SCHEME_PATTERN.matcher(trimmed);
    if (matcher.find()) {
      String scheme = matcher.group(1);
      if (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) {
        return trimmed;
      }
      return null; 
    }
    return "https://" + trimmed;
  }

  void loadURL(String url, final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }

    final String safeUrl = sanitizeUrl(url);
    if (safeUrl == null) {
      callbackContext.error("Blocked URL: only http:// and https:// URLs are allowed");
      return;
    }

    
    if (webView == null) {
      pendingUrl = safeUrl;
      pendingHtml = null;
      callbackContext.success();
      return;
    }

    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        webView.loadUrl(safeUrl);
        callbackContext.success();
      }
    });
  }

  void loadHTML(final String html, final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }

    if (webView == null) {
      pendingHtml = html;
      pendingUrl = null;
      callbackContext.success();
      return;
    }

    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        callbackContext.success();
      }
    });
  }

  void evaluate(String js, final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }
    if (webView == null) {
      callbackContext.error("WebView is not ready");
      return;
    }
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        webView.evaluateJavascript(js, new ValueCallback<String>() {
          @Override
          public void onReceiveValue(String value) {
            callbackContext.success(decodeJsResult(value));
          }
        });
      }
    });
  }

  




  private static String decodeJsResult(String value) {
    if (value == null) return null;
    try {
      Object parsed = new JSONTokener(value).nextValue();
      if (parsed == JSONObject.NULL) return null;
      return String.valueOf(parsed);
    } catch (JSONException e) {
      return value;
    }
  }

  void postMessage(String message, final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }
    if (webView == null) {
      callbackContext.error("WebView is not ready");
      return;
    }

    
    
    
    
    final String js =
      "(function(){" +
      "var raw=" + JSONObject.quote(message) + ";" +
      "var msg;try{msg=JSON.parse(raw);}catch(e){msg=raw;}" +
      "if(window.webview&&window.webview._dispatch){window.webview._dispatch(msg);}" +
      "})();";

    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        webView.evaluateJavascript(js, null);
        callbackContext.success();
      }
    });
  }

  void show(final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }
    if (!isFullscreen()) {
      callbackContext.error("Hidden WebViews cannot be shown; use mode \"fullscreen\" to display content");
      return;
    }
    
    
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        plugin.showFullscreenActivity(id);
      }
    });
    callbackContext.success();
  }

  void hide(final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }
    if (!isFullscreen()) {
      
      callbackContext.success();
      return;
    }
    hideFullscreen(callbackContext);
  }

  






  private void hideFullscreen(CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        if (hostingActivity != null
          && !hostingActivity.isFinishing()
          && !hostingActivity.isDestroyed()) {
          hostingActivity.moveTaskToBack(true);
        }
      }
    });
    callbackContext.success();
  }

  void reload(final CallbackContext callbackContext) {
    if (isDestroyed) {
      callbackContext.error("WebView has been destroyed");
      return;
    }
    if (webView == null) {
      callbackContext.error("WebView is not ready");
      return;
    }
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        webView.reload();
        callbackContext.success();
      }
    });
  }

  void destroy() {
    if (isDestroyed) return;
    isDestroyed = true;

    
    
    WebViewActivity hosting = hostingActivity;
    hostingActivity = null;
    if (hosting != null && !hosting.isFinishing()) {
      hosting.finish();
    }

    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        if (webView != null) {
          if (webView.getParent() != null) {
            ((ViewGroup) webView.getParent()).removeView(webView);
          }
          webView.removeJavascriptInterface("AcodeWebViewNative");
          webView.setDownloadListener(null);
          webView.setWebChromeClient(null);
          webView.setWebViewClient(null);
          webView.loadUrl("about:blank");
          webView.destroy();
        }
        webView = null;
      }
    });
  }

  void onPageFinished(WebView view) {
    
    
    injectBridge(view);
    try {
      JSONObject data = new JSONObject();
      String url = view.getUrl();
      String pageTitle = view.getTitle();
      data.put("url", url != null ? url : "");
      data.put("title", pageTitle != null ? pageTitle : "");
      plugin.sendEventToCordova(id, "pageFinished", data);
    } catch (JSONException e) {
      Log.e(TAG, "onPageFinished error", e);
    }
  }

  private static void runOnUiThread(Runnable runnable) {
    new Handler(Looper.getMainLooper()).post(runnable);
  }

  private class InstanceWebViewClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      return shouldBlockNavigation(request.getUrl());
    }

    @SuppressWarnings("deprecation")
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
      return shouldBlockNavigation(Uri.parse(url));
    }

    





    private boolean shouldBlockNavigation(Uri uri) {
      if (!allowNavigation) return true;
      String scheme = uri.getScheme();
      return scheme == null
        || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"));
    }

    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
      super.onPageStarted(view, url, favicon);
      
      injectBridge(view);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
      super.onPageFinished(view, url);
      WebViewInstance.this.onPageFinished(view);
    }
  }

  private class InstanceWebChromeClient extends WebChromeClient {
    @Override
    public void onReceivedTitle(WebView view, String pageTitle) {
      super.onReceivedTitle(view, pageTitle);
      try {
        JSONObject data = new JSONObject();
        data.put("title", pageTitle != null ? pageTitle : "");
        plugin.sendEventToCordova(id, "titleChanged", data);
      } catch (JSONException e) {
        Log.e(TAG, "onReceivedTitle error", e);
      }
    }
  }

  private class InstanceDownloadListener implements DownloadListener {
    private final Context context;

    InstanceDownloadListener(Context context) {
      this.context = context;
    }

    @Override
    public void onDownloadStart(final String url, final String userAgent, String contentDisposition, final String mimeType, long contentLength) {
      if (isDestroyed) return;
      if (context instanceof Activity && ((Activity) context).isFinishing()) return;

      
      String scheme = Uri.parse(url).getScheme();
      if (scheme == null
        || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
        runOnUiThread(new Runnable() {
          @Override
          public void run() {
            Toast.makeText(context, "This download type is not supported", Toast.LENGTH_SHORT).show();
          }
        });
        return;
      }

      final String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
      String size = formatSize(contentLength);
      final String message = size.isEmpty()
        ? "Do you want to download \"" + fileName + "\"?"
        : "Do you want to download \"" + fileName + "\" (" + size + ")?";

      runOnUiThread(new Runnable() {
        @Override
        public void run() {
          new AlertDialog.Builder(context)
            .setTitle("Download file")
            .setMessage(message)
            .setPositiveButton("Download", new DialogInterface.OnClickListener() {
              @Override
              public void onClick(DialogInterface dialog, int which) {
                plugin.download(url, userAgent, mimeType, fileName);
              }
            })
            .setNegativeButton("Cancel", null)
            .show();
        }
      });
    }
  }

  private static String formatSize(long bytes) {
    if (bytes <= 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return String.format(Locale.US, "%.1f KB", bytes / 1024.0);
    if (bytes < 1024L * 1024 * 1024) return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024));
    return String.format(Locale.US, "%.1f GB", bytes / (1024.0 * 1024 * 1024));
  }

  public class JsBridge {
    @JavascriptInterface
    public void postMessage(String message) {
      plugin.sendMessageToCordova(id, message);
    }
  }
}
