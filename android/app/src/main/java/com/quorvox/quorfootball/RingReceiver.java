package com.quorvox.quorfootball;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Срабатывание будильника и кнопка «Экстренно не могу» в уведомлении. */
public class RingReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String key = intent.getStringExtra("key");
        if (key == null || intent.getAction() == null) return;
        if (Rem.ACT_RING.equals(intent.getAction())) Rem.fire(ctx, key);
        else if (Rem.ACT_EMERGENCY.equals(intent.getAction())) Rem.emergency(ctx, key);
    }
}
