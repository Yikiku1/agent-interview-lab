package cn.interviewlab.offline.tests;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Runs against the actual signed APK, its WebView, and its private SQLite bridge. */
public final class SmokeTest extends Instrumentation {
    private WebView web;
    private Activity activity;
    private String phase;

    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        phase = arguments == null ? null : arguments.getString("phase");
        start();
    }
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView result = findWeb(group.getChildAt(i));
                if (result != null) return result;
            }
        }
        return null;
    }
    private Object js(String code) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        String[] result = new String[1];
        runOnMainSync(() -> web.evaluateJavascript(code, value -> { result[0] = value; latch.countDown(); }));
        if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("WebView JS timeout");
        return new JSONTokener(result[0]).nextValue();
    }
    private void until(String expression) throws Exception {
        long deadline = System.currentTimeMillis() + (("export".equals(phase) || "import".equals(phase)) ? 120000 : 20000);
        while (System.currentTimeMillis() < deadline) {
            if (Boolean.TRUE.equals(js(expression))) return;
            Thread.sleep(100);
        }
        throw new AssertionError("Timed out: " + expression + "\n" + js("document.body.innerText"));
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            activity = startActivitySync(new Intent().setClassName("cn.interviewlab.offline", "cn.interviewlab.offline.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            runOnMainSync(() -> web = findWeb(activity.getWindow().getDecorView()));
            if (web == null) throw new AssertionError("No native WebView");
            until("document.body.innerText.includes('今天，练一点。')");
            String probe = "android-webview-sqlite-regression-answer";
            if ("export".equals(phase) || "import".equals(phase)) {
                js("location.hash='#backup'");
                until("!!document.querySelector('#export-backup')");
                js("document.querySelector('#" + ("export".equals(phase) ? "export-backup" : "import-backup") + "').click()");
                until("document.querySelector('#toast')?.innerText.includes('" + ("export".equals(phase) ? "备份已导出" : "恢复完成") + "')");
                if (!Boolean.TRUE.equals(js("JSON.parse(OfflineNative.readState()).events.some(e=>e.answer==='" + probe + "')")))
                    throw new AssertionError("Backup operation lost saved answer");
                result.putString("stream", "PASS: actual Android system document picker " + phase + "; SQLite answer preserved\n");
            } else if ("restore".equals(phase)) {
                until("typeof OfflineNative.readState() === 'string'");
                if (!Boolean.TRUE.equals(js("JSON.parse(OfflineNative.readState()).events.some(e=>e.answer==='" + probe + "')")))
                    throw new AssertionError("Saved answer missing after force-stop/upgrade");
                js("document.querySelector('a[href=\"#practice\"]').click()");
                until("document.querySelector('#practice-answer')?.value === '" + probe + "'");
                result.putString("stream", "PASS: actual WebView startup; SQLite answer restored after process stop/upgrade\n");
            } else {
                js("document.querySelector('[data-start]').click()");
                until("!!document.querySelector('#practice-answer')");
                js("(()=>{const a=document.querySelector('#practice-answer');a.value='"+probe+"';a.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
                if (!Boolean.TRUE.equals(js("Object.values(JSON.parse(OfflineNative.readState()).drafts).includes('"+probe+"')"))) throw new AssertionError("Native SQLite draft not persisted");
                js("document.querySelector('[data-complete]').click()");
                until("!!document.querySelector('[data-next]')");
                if (!Boolean.TRUE.equals(js("JSON.parse(OfflineNative.readState()).events.some(e=>e.answer==='" + probe + "')"))) throw new AssertionError("Formal answer not persisted");
                js("location.hash='#questions'");
                until("!!document.querySelector('#filter-preset')");
                js("(()=>{const s=document.querySelector('#filter-preset');s.value='resume_focus';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
                until("document.body.innerText.includes('找到 100 题')");
                js("location.hash='#backup'");
                until("!!document.querySelector('#export-backup')");
                js("(()=>{const s=JSON.parse(OfflineNative.readState());return s.events.length>0&&s.progress[Object.keys(s.progress)[0]].practiceCount>0})()");
                result.putString("stream", "PASS: actual WebView startup; fresh SQLite; draft; formal completion; 100 resume filter; backup screen\n");
            }
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("stream", "FAIL: " + error + "\n");
            finish(Activity.RESULT_CANCELED, result);
        }
    }
}
