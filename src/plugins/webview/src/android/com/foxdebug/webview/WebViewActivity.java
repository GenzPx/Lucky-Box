package com.foxdebug.webview;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;

public class WebViewActivity extends Activity {

  private WebView webView;
  private String webviewId;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    webviewId = getIntent().getStringExtra("webviewId");

    
    
    
    
    WebViewPlugin plugin = WebViewPlugin.getInstance();
    WebViewInstance instance = plugin != null ? plugin.getInstance(webviewId) : null;
    if (instance == null) {
      finish();
      return;
    }

    instance.createWebView(this);
    webView = instance.getWebView();
    if (webView == null) {
      finish();
      return;
    }
    instance.setHostingActivity(this);

    String title = instance.getTitle();
    if (title != null && !title.isEmpty()) {
      setTitle(title);
    }

    if (webView.getParent() != null) {
      ((ViewGroup) webView.getParent()).removeView(webView);
    }
    FrameLayout container = new FrameLayout(this);
    
    
    WebViewInstance.applySystemBarInsets(container);
    container.addView(webView, new FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    ));
    setContentView(container);

    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
    }
  }

  @Override
  public void onBackPressed() {
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
    } else {
      finish();
    }
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();

    WebViewPlugin plugin = WebViewPlugin.getInstance();
    if (plugin != null && webviewId != null) {
      WebViewInstance instance = plugin.getInstance(webviewId);
      if (instance != null) {
        instance.clearHostingActivity(this);
        
        
        
        
        instance.destroy();
        plugin.removeInstance(webviewId);
      }
      plugin.sendEventToCordova(webviewId, "closed", null);
    }

    webView = null;
  }
}
