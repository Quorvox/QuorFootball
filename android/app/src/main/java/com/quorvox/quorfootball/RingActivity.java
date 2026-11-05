package com.quorvox.quorfootball;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Полноэкранное напоминание поверх экрана блокировки: начать тренировку или «Экстренно не могу». */
public class RingActivity extends Activity {
    private static final int BG = 0xFF0F1411;
    private static final int INK = 0xFFEEF2EE;
    private static final int INK2 = 0xFFA9B5AA;
    private static final int ACCENT = 0xFF7BC96F;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 26) {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        }
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);

        final String key = getIntent().getStringExtra("key");
        final String url = getIntent().getStringExtra("url");
        String title = getIntent().getStringExtra("title");
        String body = getIntent().getStringExtra("body");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        int pad = dp(28);
        root.setPadding(pad, dp(72), pad, dp(40));

        TextView tag = text("ПОРА ТРЕНИРОВАТЬСЯ", 13, INK2, false);
        tag.setLetterSpacing(0.12f);
        root.addView(tag);

        TextView t = text(title == null ? "Время тренировки" : title, 38, INK, true);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(-1, -2);
        tp.topMargin = dp(12);
        root.addView(t, tp);

        TextView bd = text(body == null ? "" : body, 19, INK2, false);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-1, -2);
        bp.topMargin = dp(14);
        root.addView(bd, bp);

        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(-1, 0, 1f));

        Button start = button("Начать тренировку", ACCENT, 0xFF0F1411, false);
        start.setOnClickListener(v -> {
            Intent i = new Intent(this, MainActivity.class).putExtra("qf_key", key).putExtra("qf_url", url)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(i);
            finish();
        });
        root.addView(start, new LinearLayout.LayoutParams(-1, dp(64)));

        Button sos = button("Экстренно не могу", Color.TRANSPARENT, INK, true);
        sos.setOnClickListener(v -> {
            if (key != null) Rem.emergency(this, key);
            finish();
        });
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(-1, dp(56));
        sp.topMargin = dp(12);
        root.addView(sos, sp);

        TextView hint = text("Если закрыть без выбора, напомню ещё раз через несколько минут.", 14, INK2, false);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(-1, -2);
        hp.topMargin = dp(16);
        root.addView(hint, hp);

        setContentView(root);
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(s);
        v.setTextSize(sp);
        v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        return v;
    }

    private Button button(String s, int bg, int fg, boolean outline) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(18);
        b.setTextColor(fg);
        b.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        GradientDrawable d = new GradientDrawable();
        d.setCornerRadius(dp(18));
        d.setColor(bg);
        if (outline) d.setStroke(dp(2), 0xFF3A4A3F);
        b.setBackground(d);
        b.setStateListAnimator(null);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
