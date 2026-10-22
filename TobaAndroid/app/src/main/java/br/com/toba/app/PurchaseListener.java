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

/**
 * Escuta as notificações do celular. Só olha as que têm "R$"; das que vêm de
 * um app de banco/carteira conhecido (ou liberado pelo usuário), tira valor e
 * loja e põe na fila. Desde v1.47 o Gastos mostra a fila como "pendentes"
 * pra você aprovar (lançar/descartar); só sai da fila depois disso.
 *
 * Reenvio (APK 1.3): alguns apps postam de novo a mesma notificação (reinício
 * do celular, atualização). O id da compra é estável (pacote + texto + hora
 * original da notificação, Notification.when) e fica na lista de "já vistas"
 * (TobaStore.KEY_SEEN), então a mesma notificação nunca vira duas compras.
 * A data é a da hora original; se ela chegou mais de 6 h depois, vai pras
 * pendentes marcada como "antiga" (old: true) e você decide.
 */
public class PurchaseListener extends NotificationListenerService {
    private static final long REPOST_LATE_MS = 6 * 60 * 60 * 1000L;
    private static final long WHEN_SLACK_MS = 5 * 60 * 1000L;

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

        long postAt = sbn.getPostTime();
        long when = n.when;
        boolean whenOk = when > 0 && when <= postAt + WHEN_SLACK_MS;
        long at = whenOk ? when : postAt; // hora da compra
        boolean late = whenOk && postAt - when > REPOST_LATE_MS;
        String raw = (title + " · " + body).trim();
        if (TobaStore.isRecentDuplicate(this, pkg, raw, postAt)) return;
        String seenKey = pkg + "|" + raw + "|" + (whenOk ? when : postAt / 60000L);

        JSONObject log = new JSONObject();
        log.put("pkg", pkg);
        log.put("app", appLabel(pkg));
        log.put("raw", raw);
        log.put("at", postAt);
        if (whenOk) log.put("when", when);

        if (TobaStore.isSeen(this, seenKey)) {
            log.put("status", "repetida");
            log.put("reason", "Mesma notificação de novo (já tinha sido lida)");
            TobaStore.addLog(this, log);
            return;
        }

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
        if (TobaStore.hasSameAmountRecently(this, r.amount, postAt, 3 * 60 * 1000L)) {
            log.put("status", "repetida");
            log.put("reason", "Mesmo valor avisado por outro app há pouco");
            TobaStore.addLog(this, log);
            return;
        }

        JSONObject purchase = new JSONObject();
        purchase.put("id", "n" + at + "-" + Integer.toString(seenKey.hashCode() & 0x7fffffff, 36));
        purchase.put("amount", r.amount);
        purchase.put("desc", r.desc);
        purchase.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(at)));
        purchase.put("app", appLabel(pkg));
        purchase.put("at", at);
        purchase.put("postedAt", postAt);
        purchase.put("raw", raw);
        if (late) purchase.put("old", true);
        TobaStore.addPending(this, purchase);
        TobaStore.markSeen(this, seenKey, postAt);

        log.put("status", "detectada");
        log.put("amount", r.amount);
        log.put("desc", r.desc);
        if (late) log.put("reason", "Notificação antiga reenviada: vai pras pendentes marcada");
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
