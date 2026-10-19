package br.com.toba.app;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Random;

/**
 * Escuta as notificações do celular. Só olha as que têm "R$"; das que vêm de
 * um app de banco/carteira conhecido (ou liberado pelo usuário), tira valor e
 * loja e põe na fila. O Gastos lança a fila no banco quando abre.
 */
public class PurchaseListener extends NotificationListenerService {
    private static final Random RANDOM = new Random();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            handle(sbn);
        } catch (Exception e) {
            Log.w("Toba", "Falha ao ler notificação", e);
        }
    }

    private void handle(StatusBarNotification sbn) throws JSONException {
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return;
        Notification n = sbn.getNotification();
        if (n == null || n.extras == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

        Bundle extras = n.extras;
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (!(title + body).contains("R$")) return; // sem dinheiro: nem guarda

        long at = sbn.getPostTime();
        String raw = (title + " · " + body).trim();
        if (TobaStore.isRecentDuplicate(this, pkg, raw, at)) return;

        JSONObject log = new JSONObject();
        log.put("pkg", pkg);
        log.put("app", appLabel(pkg));
        log.put("raw", raw);
        log.put("at", at);

        if (!PurchaseParser.isKnownApp(pkg) && !TobaStore.isExtraApp(this, pkg)) {
            log.put("status", "fora");
            TobaStore.addLog(this, log);
            return;
        }

        PurchaseParser.Result r = PurchaseParser.parse(pkg, title, body);
        if (r.reason != null) {
            log.put("status", "ignorada");
            log.put("reason", r.reason);
            TobaStore.addLog(this, log);
            return;
        }
        if (TobaStore.hasSameAmountRecently(this, r.amount, at, 3 * 60 * 1000L)) {
            log.put("status", "repetida");
            log.put("reason", "Mesmo valor avisado por outro app há pouco");
            TobaStore.addLog(this, log);
            return;
        }

        JSONObject purchase = new JSONObject();
        purchase.put("id", "n" + at + "-" + Integer.toString(RANDOM.nextInt(46656), 36));
        purchase.put("amount", r.amount);
        purchase.put("desc", r.desc);
        purchase.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(at)));
        purchase.put("app", appLabel(pkg));
        purchase.put("at", at);
        TobaStore.addPending(this, purchase);

        log.put("status", "detectada");
        log.put("amount", r.amount);
        log.put("desc", r.desc);
        TobaStore.addLog(this, log);
        Notifier.showPurchase(this, r.amount, r.desc);
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Exception e) {
            return pkg;
        }
    }

    private static String text(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }
}
