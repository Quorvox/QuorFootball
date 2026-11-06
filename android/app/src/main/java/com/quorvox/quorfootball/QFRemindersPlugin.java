package com.quorvox.quorfootball;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;

import java.util.Locale;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Мост между страницей и будильниками: расписание, разрешения, события «Начать» и «Экстренно не могу». */
@CapacitorPlugin(name = "QFReminders", permissions = {
        @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})
})
public class QFRemindersPlugin extends Plugin {
    static String pendingUrl;
    private static QFRemindersPlugin instance;

    // голос тренера: в WebView нет речи, поэтому говорит Android
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingSpeech = null;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; ttsReady = false; }
    }

    private void ensureTts() {
        if (tts != null) return;
        tts = new TextToSpeech(getContext().getApplicationContext(), (status) -> {
            if (status != TextToSpeech.SUCCESS || tts == null) return;
            int r = tts.setLanguage(new Locale("ru", "RU"));
            ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            if (ttsReady) {
                tts.setSpeechRate(1.05f);
                if (pendingSpeech != null) { tts.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, null, "qf"); pendingSpeech = null; }
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        if (text != null && !text.isEmpty()) {
            ensureTts();
            if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "qf");
            else pendingSpeech = text;
        }
        call.resolve();
    }

    @PluginMethod
    public void stopSpeak(PluginCall call) {
        pendingSpeech = null;
        if (tts != null) tts.stop();
        call.resolve();
    }

    @PluginMethod
    public void canSpeak(PluginCall call) {
        ensureTts();
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    /** Из MainActivity: приложение открыли по напоминанию. */
    static void deliver(String url) {
        pendingUrl = url;
        if (instance != null && url != null) {
            JSObject o = new JSObject();
            o.put("url", url);
            instance.notifyListeners("open", o, true);
        }
    }

    private JSObject state() {
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        boolean fullScreen = true;
        if (Build.VERSION.SDK_INT >= 34) {
            android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            fullScreen = nm != null && nm.canUseFullScreenIntent();
        }
        boolean denied = !enabled && (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.DENIED);
        JSObject r = new JSObject();
        r.put("notifications", enabled ? "granted" : denied ? "denied" : "prompt");
        r.put("fullScreen", fullScreen);
        return r;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(state());
    }

    @PluginMethod
    public void ask(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "askDone");
        } else {
            call.resolve(state());
        }
    }

    @PermissionCallback
    private void askDone(PluginCall call) {
        call.resolve(state());
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            JSArray items = call.getArray("items", new JSArray());
            JSArray done = call.getArray("done", new JSArray());
            JSObject cfg = call.getObject("cfg", new JSObject());
            Rem.schedule(getContext(), items, done, cfg);
            call.resolve();
        } catch (JSONException e) {
            call.reject("Не удалось поставить напоминания: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        try {
            Rem.cancelAll(getContext());
            call.resolve();
        } catch (JSONException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void hold(PluginCall call) {
        String key = call.getString("key");
        if (key != null) Rem.hold(getContext(), key, call.getInt("minutes", 60));
        call.resolve();
    }

    @PluginMethod
    public void test(PluginCall call) {
        try {
            Rem.test(getContext(), call.getInt("seconds", 8));
            call.resolve();
        } catch (JSONException e) {
            call.reject(e.getMessage());
        }
    }

    /** События с прошлого раза (нажато «Начать» или «Экстренно не могу») и ссылка, по которой открыли приложение. */
    @PluginMethod
    public void consume(PluginCall call) {
        JSONArray ev = Rem.takeEvents(getContext());
        JSObject r = new JSObject();
        r.put("events", ev);
        r.put("url", pendingUrl);
        pendingUrl = null;
        call.resolve(r);
    }

    /** Для диагностики: что сейчас запланировано и какие повторы идут. */
    @PluginMethod
    public void dump(PluginCall call) {
        JSObject r = new JSObject();
        r.put("state", Rem.load(getContext()).toString());
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String what = call.getString("what", "notifications");
        Intent i;
        if ("fullscreen".equals(what) && Build.VERSION.SDK_INT >= 34) {
            i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName()));
        } else {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) { /* нет такого экрана настроек */ }
        call.resolve();
    }
}
