package cn.interviewlab.offline;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net/";
    private static final String EMPTY_STATE = "__INTERVIEW_LAB_EMPTY_STATE_V1__";
    private static final int EXPORT = 11, IMPORT = 12;
    private WebView web;
    private SQLiteDatabase db;
    private String exportJson;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        db = openOrCreateDatabase("practice.db", MODE_PRIVATE, null);
        db.execSQL("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");
        web = new WebView(this);
        web.setPadding(0, 0, 0, 0);
        // Insets keep controls clear of Android status/navigation bars, including target 35 edge-to-edge.
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (isFinishing()) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("请确认").setMessage(message)
                    .setPositiveButton("确认", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                if (isFinishing()) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("提示").setMessage(message)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "OfflineNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // loadDataWithBaseURL uses a data: document for the bundled
                // entry page. It is local bootstrap content, not an external
                // navigation; blocking it produces ERR_HTTP_RESPONSE_CODE_FAILURE.
                if ("data".equals(uri.getScheme())) return false;
                return !local(uri);
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!local(uri) || !"GET".equals(request.getMethod())) return denied();
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0) return denied();
                String mime = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".json") ? "application/json" : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
                try { return new WebResourceResponse(mime, "UTF-8", getAssets().open("www" + path)); }
                catch (IOException e) { return denied(); }
            }
        });
        // Some Android WebView builds do not start a top-level navigation to the
        // synthetic appassets host. Load the bundled document directly while
        // retaining the HTTPS base URL for module imports and fetch().
        try (InputStream input = getAssets().open("www/index.html")) {
            ByteArrayOutputStream html = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int count;
            while ((count = input.read(chunk)) != -1) html.write(chunk, 0, count);
            web.loadDataWithBaseURL(ORIGIN, html.toString(StandardCharsets.UTF_8.name()),
                "text/html", "UTF-8", null);
        } catch (IOException error) {
            web.loadData("<h1>无法读取应用资源</h1><p>请重新安装 APK。</p>", "text/html", "UTF-8");
        }
    }
    private boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPort() == -1;
    }
    private WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", null, new ByteArrayInputStream(new byte[0]));
    }
    private void notifyResult(String message) {
        runOnUiThread(() -> web.evaluateJavascript("window.onNativeFileResult && window.onNativeFileResult(" + JSONObject.quote(message) + ")", null));
    }
    public final class Bridge {
        @JavascriptInterface public synchronized String readState() {
            try (Cursor cursor = db.rawQuery("SELECT json FROM state WHERE id=1", null)) {
                // Returning Java null becomes `undefined` in some Android WebView
                // versions. Use an explicit sentinel for a valid first launch.
                return cursor.moveToFirst() ? cursor.getString(0) : EMPTY_STATE;
            }
        }
        @JavascriptInterface public synchronized boolean writeState(String json) {
            try {
                new JSONObject(json);
                db.execSQL("INSERT OR REPLACE INTO state(id,json) VALUES(1,?)", new Object[]{json});
                return true;
            } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void exportBackup(String json) {
            runOnUiThread(() -> {
                exportJson = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json")
                    .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "interview-backup.json");
                try { startActivityForResult(intent, EXPORT); }
                catch (Exception e) { exportJson = null; notifyResult("无法打开文件保存器"); }
            });
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(intent, IMPORT); }
                catch (Exception e) { notifyResult("无法打开文件选择器"); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != EXPORT && request != IMPORT) return;
        if (result != RESULT_OK || data == null || data.getData() == null) {
            exportJson = null; notifyResult("已取消"); return;
        }
        try {
            if (request == EXPORT) {
                if (exportJson == null) throw new IOException("Export interrupted");
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (out == null) throw new IOException("No output");
                    out.write(exportJson.getBytes(StandardCharsets.UTF_8));
                }
                notifyResult("备份已导出");
            } else {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                try (InputStream in = getContentResolver().openInputStream(data.getData())) {
                    if (in == null) throw new IOException("No input");
                    byte[] chunk = new byte[8192]; int count;
                    while ((count = in.read(chunk)) != -1) {
                        if (buffer.size() + count > 8 * 1024 * 1024) throw new IOException("Backup too large");
                        buffer.write(chunk, 0, count);
                    }
                }
                String json = new String(buffer.toByteArray(), StandardCharsets.UTF_8);
                web.evaluateJavascript("window.onNativeImport && window.onNativeImport(" + JSONObject.quote(json) + ")", null);
            }
        } catch (Exception e) { notifyResult(request == EXPORT ? "导出失败，请重试" : "读取备份失败，请选择有效文件（不超过8MB）"); }
        finally { exportJson = null; }
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.evaluateJavascript("window.history.back()", null);
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        web.removeJavascriptInterface("OfflineNative"); web.destroy(); db.close(); super.onDestroy();
    }
}
