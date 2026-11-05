package com.quorvox.quorfootball;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QFRemindersPlugin.class);
        super.onCreate(savedInstanceState);
        fromReminder(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        fromReminder(intent);
    }

    // открыли по уведомлению или полноэкранному напоминанию: запоминаем и просим страницу перейти на тренировку
    private void fromReminder(Intent i) {
        if (i == null) return;
        String key = i.getStringExtra("qf_key");
        if (key == null) return;
        Rem.onStart(this, key);
        QFRemindersPlugin.deliver(i.getStringExtra("qf_url"));
        i.removeExtra("qf_key");
    }
}
