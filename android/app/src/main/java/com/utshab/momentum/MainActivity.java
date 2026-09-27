package com.utshab.momentum;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Android host for the bundled interface; no browser, server, or network is used. */
public final class MainActivity extends ComponentActivity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";
    private static final int IMPORT_FILE = 10, EXPORT_FILE = 11;
    private WebView web;
    private TrackerDatabase database;
    private ValueCallback<Uri[]> fileCallback;
    private File pendingExport;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        database = new TrackerDatabase(getApplicationContext());
        pendingExport = new File(getCacheDir(), "pending-export");
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xfff6f7f8);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only user-selected backup documents.
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        CookieManager.getInstance().setAcceptCookie(false);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = assets.shouldInterceptRequest(request.getUrl());
                if (response != null) return response;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline only", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // No untrusted document may ever gain access to the native bridge.
                return !HOME.equals(request.getUrl().toString());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) Toast.makeText(MainActivity.this, "Could not open Momentum. Please reopen the app.", Toast.LENGTH_LONG).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent choose = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
                choose.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(choose, IMPORT_FILE); }
                catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        web.addJavascriptInterface(new LocalBridge(), "Momentum");
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { web.evaluateJavascript("window.dispatchEvent(new Event('momentum-back'))", null); }
        });
        web.loadUrl(HOME);
    }
    private String failure(Exception e) {
        try { return new JSONObject().put("error", e.getMessage() == null ? "Could not save on this phone. Please retry." : e.getMessage()).toString(); }
        catch (Exception ignored) { return "{\"error\":\"Storage unavailable\"}"; }
    }
    public final class LocalBridge {
        @JavascriptInterface public String read() {
            try { return database.read().toString(); } catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public String write(String document, long revision) {
            try { return database.write(document, revision).toString(); } catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public void closeApp() { runOnUiThread(() -> moveTaskToBack(true)); }
        @JavascriptInterface public void exportFile(String name, String content, String type) {
            runOnUiThread(() -> {
                try {
                    if (content == null || content.length() > 8000000) throw new IOException("Backup is too large");
                    try (FileOutputStream out = new FileOutputStream(pendingExport)) { out.write(content.getBytes(StandardCharsets.UTF_8)); }
                    String mime = "text/csv".equals(type) ? "text/csv" : "application/json";
                    Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);
                    create.putExtra(Intent.EXTRA_TITLE, name.replaceAll("[^a-zA-Z0-9._-]", "_"));
                    startActivityForResult(create, EXPORT_FILE);
                } catch (Exception e) { exportResult(false, "Could not open backup picker. Please retry."); }
            });
        }
    }
    private void exportResult(boolean saved, String error) {
        try {
            JSONObject result = new JSONObject().put("saved", saved);
            if (error != null) result.put("error", error);
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('momentum-export',{detail:" + result + "}))", null);
        } catch (Exception ignored) { /* The completed file remains safe if the screen closed. */ }
    }
    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        if (request == IMPORT_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && intent != null && intent.getData() != null ? new Uri[]{intent.getData()} : null);
            fileCallback = null;
        }
        if (request == EXPORT_FILE) {
            if (result == RESULT_OK && intent != null && intent.getData() != null) {
                try (InputStream in = new FileInputStream(pendingExport); OutputStream out = getContentResolver().openOutputStream(intent.getData(), "wt")) {
                    if (out == null) throw new IOException("No output stream");
                    byte[] buffer = new byte[8192]; int count;
                    while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                    out.flush();
                    exportResult(true, null);
                } catch (Exception e) { exportResult(false, "Backup could not be saved. Please retry."); }
            }
            if (pendingExport.exists() && !pendingExport.delete()) pendingExport.deleteOnExit();
        }
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("Momentum"); web.destroy(); }
        if (database != null) database.close();
        super.onDestroy();
    }
}
