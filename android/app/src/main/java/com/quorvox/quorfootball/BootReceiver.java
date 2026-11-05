package com.quorvox.quorfootball;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Перезагрузка, обновление приложения, смена времени: будильники сбрасываются, ставим их заново. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Rem.restore(ctx);
    }
}
