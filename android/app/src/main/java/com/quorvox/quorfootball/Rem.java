package com.quorvox.quorfootball;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Напоминания, которые не пропустишь: будильник Android, полноэкранный экран и повтор каждые N минут,
 * пока тренировка не сделана или не нажато «Экстренно не могу». Всё состояние лежит в SharedPreferences.
 */
final class Rem {
    static final String CHANNEL = "qf_ring";
    static final String ACT_RING = "com.quorvox.quorfootball.RING";
    static final String ACT_EMERGENCY = "com.quorvox.quorfootball.EMERGENCY";
    private static final String PREFS = "qf_rem";
    private static final long HOLD_AFTER_START_MIN = 20;

    private Rem() {}

    // ---------- состояние ----------

    static synchronized JSONObject load(Context ctx) {
        try {
            String s = prefs(ctx).getString("state", null);
            if (s != null) return new JSONObject(s);
        } catch (JSONException ignored) { /* начнём с пустого */ }
        return new JSONObject();
    }

    static synchronized void save(Context ctx, JSONObject st) {
        prefs(ctx).edit().putString("state", st.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject obj(JSONObject st, String name) {
        JSONObject o = st.optJSONObject(name);
        if (o == null) { o = new JSONObject(); try { st.put(name, o); } catch (JSONException ignored) { } }
        return o;
    }

    private static JSONArray arr(JSONObject st, String name) {
        JSONArray a = st.optJSONArray(name);
        if (a == null) { a = new JSONArray(); try { st.put(name, a); } catch (JSONException ignored) { } }
        return a;
    }

    private static String today() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    // ---------- будильники ----------

    private static PendingIntent ringPi(Context ctx, String key, boolean create) {
        Intent i = new Intent(ctx, RingReceiver.class).setAction(ACT_RING).putExtra("key", key).setData(Uri.parse("qf://ring/" + Uri.encode(key)));
        int flags = PendingIntent.FLAG_IMMUTABLE | (create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(ctx, key.hashCode(), i, flags);
    }

    private static void setAlarm(Context ctx, String key, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent show = PendingIntent.getActivity(ctx, 1, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent pi = ringPi(ctx, key, true);
        try {
            // setAlarmClock срабатывает даже в режиме сна
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), pi);
        } catch (SecurityException e) {
            // нет права на точные будильники: напомним чуть неточно, но приложение не упадёт
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static void cancelAlarm(Context ctx, String key) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = ringPi(ctx, key, false);
        if (am != null && pi != null) { am.cancel(pi); pi.cancel(); }
    }

    private static void cancelNotification(Context ctx, String key) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(key.hashCode());
    }

    private static void stopChain(Context ctx, JSONObject st, String key) {
        cancelAlarm(ctx, key);
        cancelNotification(ctx, key);
        obj(st, "chains").remove(key);
    }

    // ---------- расписание из приложения ----------

    /** Заменяет расписание: items (будущие напоминания), done (ключи уже сделанных тренировок), cfg (настройки). */
    static synchronized void schedule(Context ctx, JSONArray items, JSONArray done, JSONObject cfg) throws JSONException {
        JSONObject st = load(ctx);
        st.put("cfg", cfg);
        JSONObject chains = obj(st, "chains");
        String today = today();
        // сделанное и вчерашнее больше не напоминаем
        java.util.Iterator<String> it = chains.keys();
        java.util.ArrayList<String> stop = new java.util.ArrayList<>();
        while (it.hasNext()) {
            String k = it.next();
            if (contains(done, k) || k.substring(0, Math.min(10, k.length())).compareTo(today) < 0) stop.add(k);
        }
        for (String k : stop) stopChain(ctx, st, k);

        JSONArray old = arr(st, "items");
        for (int i = 0; i < old.length(); i++) {
            String k = old.getJSONObject(i).optString("key");
            if (!chains.has(k)) cancelAlarm(ctx, k);
        }
        JSONArray keep = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.getJSONObject(i);
            String k = o.getString("key");
            long at = o.getLong("at");
            if (contains(done, k) || chains.has(k) || at <= now) continue;
            setAlarm(ctx, k, at);
            keep.put(o);
        }
        st.put("items", keep);
        save(ctx, st);
    }

    static synchronized void cancelAll(Context ctx) throws JSONException {
        JSONObject st = load(ctx);
        JSONArray items = arr(st, "items");
        for (int i = 0; i < items.length(); i++) cancelAlarm(ctx, items.getJSONObject(i).optString("key"));
        java.util.Iterator<String> it = obj(st, "chains").keys();
        java.util.ArrayList<String> ks = new java.util.ArrayList<>();
        while (it.hasNext()) ks.add(it.next());
        for (String k : ks) stopChain(ctx, st, k);
        st.put("items", new JSONArray());
        save(ctx, st);
    }

    private static boolean contains(JSONArray a, String v) {
        if (a == null) return false;
        for (int i = 0; i < a.length(); i++) if (v.equals(a.optString(i))) return true;
        return false;
    }

    // ---------- срабатывание ----------

    static synchronized void fire(Context ctx, String key) {
        try {
            JSONObject st = load(ctx);
            JSONObject cfg = st.optJSONObject("cfg");
            if (cfg == null) cfg = new JSONObject();
            JSONObject chains = obj(st, "chains");
            JSONObject chain = chains.optJSONObject(key);
            JSONObject item = null;
            JSONArray items = arr(st, "items");
            JSONArray rest = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.getJSONObject(i);
                if (key.equals(o.optString("key"))) item = o; else rest.put(o);
            }
            st.put("items", rest);
            JSONObject src = item != null ? item : chain;
            if (src == null) return; // отменено, пока ждали
            int attempt = chain == null ? 1 : chain.optInt("attempt") + 1;
            int gap = Math.max(1, cfg.optInt("gap", 5));
            int max = Math.max(0, cfg.optInt("max", 12));
            boolean repeat = cfg.optBoolean("repeat", true) && !src.optBoolean("once", false);
            String title = src.optString("title", "Тренировка");
            String body = src.optString("body", "Пора заниматься");
            String url = src.optString("url", "#/");
            notifyNow(ctx, key, title, body, url, attempt, gap, cfg.optBoolean("fullScreen", true));
            if (repeat && attempt <= max) {
                JSONObject c = new JSONObject().put("attempt", attempt).put("title", title).put("body", body).put("url", url);
                long next = System.currentTimeMillis() + gap * 60_000L;
                c.put("next", next);
                chains.put(key, c);
                setAlarm(ctx, key, next);
            } else {
                chains.remove(key);
            }
            save(ctx, st);
        } catch (JSONException ignored) { /* битое состояние не должно ронять приложение */ }
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Напоминания о тренировке", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Звонок и полноэкранное напоминание. Повторяется каждые несколько минут, пока тренировка не сделана");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 400, 250, 400, 250, 600});
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        nm.createNotificationChannel(ch);
    }

    private static void notifyNow(Context ctx, String key, String title, String body, String url, int attempt, int gap, boolean fullScreen) {
        ensureChannel(ctx);
        String t = title;
        String text = body;
        if (attempt > 1) {
            t = "Ты ещё не начал";
            text = "Прошло " + ((attempt - 1) * gap) + " мин. " + body;
        }
        Intent open = new Intent(ctx, MainActivity.class).putExtra("qf_key", key).putExtra("qf_url", url).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(ctx, key.hashCode() ^ 11, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent emergency = new Intent(ctx, RingReceiver.class).setAction(ACT_EMERGENCY).putExtra("key", key).setData(Uri.parse("qf://emergency/" + Uri.encode(key)));
        PendingIntent emergencyPi = PendingIntent.getBroadcast(ctx, key.hashCode() ^ 13, emergency, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_qf)
                .setContentTitle(t)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(fullScreen ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(0xFF7BC96F)
                .setAutoCancel(true)
                .setContentIntent(openPi)
                .addAction(0, "Начать", openPi)
                .addAction(0, "Экстренно не могу", emergencyPi);
        if (Build.VERSION.SDK_INT < 26) {
            b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)).setVibrate(new long[]{0, 400, 250, 400, 250, 600});
        }
        if (fullScreen) {
            Intent ring = new Intent(ctx, RingActivity.class)
                    .putExtra("key", key).putExtra("title", t).putExtra("body", text).putExtra("url", url)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            b.setFullScreenIntent(PendingIntent.getActivity(ctx, key.hashCode() ^ 17, ring, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT), true);
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            if (nm != null) nm.notify(key.hashCode(), b.build());
        } catch (SecurityException ignored) { /* уведомления запрещены */ }
    }

    // ---------- действия человека ----------

    /** «Экстренно не могу»: больше не беспокоим по этой тренировке. */
    static synchronized void emergency(Context ctx, String key) {
        JSONObject st = load(ctx);
        stopChain(ctx, st, key);
        addEvent(st, "emergency", key);
        save(ctx, st);
    }

    /** Открыл приложение по напоминанию: даём время дойти и начать, потом снова напомним, если не сделал. */
    static synchronized void onStart(Context ctx, String key) {
        JSONObject st = load(ctx);
        cancelNotification(ctx, key);
        holdIn(ctx, st, key, HOLD_AFTER_START_MIN);
        addEvent(st, "start", key);
        save(ctx, st);
    }

    static synchronized void hold(Context ctx, String key, int minutes) {
        JSONObject st = load(ctx);
        holdIn(ctx, st, key, minutes);
        save(ctx, st);
    }

    private static void holdIn(Context ctx, JSONObject st, String key, long minutes) {
        JSONObject chain = obj(st, "chains").optJSONObject(key);
        if (chain == null) return;
        long next = System.currentTimeMillis() + minutes * 60_000L;
        try { chain.put("next", next); } catch (JSONException ignored) { }
        setAlarm(ctx, key, next);
    }

    private static void addEvent(JSONObject st, String type, String key) {
        try { arr(st, "events").put(new JSONObject().put("type", type).put("key", key).put("at", System.currentTimeMillis())); } catch (JSONException ignored) { }
    }

    static synchronized JSONArray takeEvents(Context ctx) {
        JSONObject st = load(ctx);
        JSONArray ev = arr(st, "events");
        try { st.put("events", new JSONArray()); } catch (JSONException ignored) { }
        save(ctx, st);
        return ev;
    }

    /** Пробный звонок через несколько секунд, без повторов. */
    static synchronized void test(Context ctx, int seconds) throws JSONException {
        JSONObject st = load(ctx);
        String key = today() + "|test";
        JSONObject o = new JSONObject().put("key", key).put("at", System.currentTimeMillis() + seconds * 1000L)
                .put("title", "Время тренировки").put("body", "Так будет выглядеть напоминание.").put("url", "#/").put("once", true);
        arr(st, "items").put(o);
        save(ctx, st);
        setAlarm(ctx, key, o.getLong("at"));
    }

    /** После перезагрузки телефона и смены времени ставим будильники заново. */
    static synchronized void restore(Context ctx) {
        JSONObject st = load(ctx);
        long now = System.currentTimeMillis();
        JSONArray items = arr(st, "items");
        JSONArray keep = new JSONArray();
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            if (at > now) { setAlarm(ctx, o.optString("key"), at); keep.put(o); }
        }
        try { st.put("items", keep); } catch (JSONException ignored) { }
        JSONObject chains = obj(st, "chains");
        java.util.Iterator<String> it = chains.keys();
        while (it.hasNext()) {
            String k = it.next();
            JSONObject c = chains.optJSONObject(k);
            if (c == null) continue;
            long next = Math.max(c.optLong("next"), now + 15_000L);
            try { c.put("next", next); } catch (JSONException ignored) { }
            setAlarm(ctx, k, next);
        }
        save(ctx, st);
    }
}
