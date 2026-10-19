package br.com.toba.app;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tira valor e loja do texto de uma notificação de compra.
 * Carteiras (Google/Samsung Wallet): título = loja, texto = "R$ 25,90 com Visa ••1234".
 * Bancos: "Compra de R$ 25,90 APROVADA em PADARIA X para o cartão final 1234".
 * Mudou o texto de algum app? Ajuste as listas abaixo e gere o APK de novo.
 */
final class PurchaseParser {
    static final Set<String> WALLETS = new HashSet<>(Arrays.asList(
            "com.google.android.apps.walletnfcrel", // Google Wallet
            "com.samsung.android.spay",             // Samsung Wallet
            "com.samsung.android.samsungpay.gear"
    ));

    static final Set<String> BANKS = new HashSet<>(Arrays.asList(
            "com.nu.production",       // Nubank
            "com.itau",                // Itaú
            "br.com.intermedium",      // Inter
            "com.c6bank.app",          // C6
            "com.bradesco",            // Bradesco
            "br.com.bradesco.next",    // Next
            "com.santander.app",       // Santander
            "br.com.bb.android",       // Banco do Brasil
            "br.com.gabba.Caixa",      // Caixa
            "com.picpay",              // PicPay
            "com.mercadopago.wallet",  // Mercado Pago
            "br.com.neon"              // Neon
    ));

    private static final Pattern AMOUNT = Pattern.compile("R\\$\\s*([\\d.]+,\\d{2})");

    // "no estabelecimento X", "em X", "na X" até "para / com / no cartão / às ..." ou o fim da frase.
    private static final Pattern MERCHANT = Pattern.compile(
            "(?iu)\\b(?:no estabelecimento|na loja|em|no|na)\\s+(.+?)"
                    + "(?=\\s+(?:(?:foi|para|pelo|pela|com|via|valor)\\b|no cart|na data|às? \\d|dia \\d|em \\d|aprovad|realizad|utilizando|usando)"
                    + "|\\.(?:\\s|$)|[;!\\n]|$)");

    private static final String[] BUY = {
            "compra", "pagamento", "pago", "pagou", "debito", "credito", "transacao", "aprovad", "gasto"
    };
    // Nunca é gasto.
    private static final String[] NEVER = {
            "recebeu", "recebido", "recebida", "estorno", "estornad", "devolvid", "devolucao", "cashback",
            "negad", "recusad", "nao aprovad", "cancelad", "rendeu", "rendimento", "reembolso"
    };
    // Só descarta se também não falar em compra (ex.: "limite disponível" vem junto da compra).
    private static final String[] WEAK = {
            "fatura", "boleto", "vence", "deposito", "saldo", "limite", "investi", "resgate"
    };

    static final class Result {
        final double amount;
        final String desc;
        final String reason; // != null quando não é compra

        Result(double amount, String desc, String reason) {
            this.amount = amount;
            this.desc = desc;
            this.reason = reason;
        }
    }

    private PurchaseParser() {}

    static boolean isKnownApp(String pkg) {
        return WALLETS.contains(pkg) || BANKS.contains(pkg);
    }

    static Result parse(String pkg, String title, String text) {
        String all = (title + "\n" + text).trim();
        Matcher m = AMOUNT.matcher(all);
        if (!m.find()) return new Result(0, "", "Sem valor em R$");
        double amount;
        try {
            amount = Double.parseDouble(m.group(1).replace(".", "").replace(",", "."));
        } catch (NumberFormatException e) {
            return new Result(0, "", "Valor ilegível");
        }
        if (amount <= 0) return new Result(0, "", "Valor zerado");

        String plain = plain(all);
        if (containsAny(plain, NEVER)) return new Result(amount, "", "Não é gasto (recebimento, estorno...)");
        boolean wallet = WALLETS.contains(pkg);
        boolean buy = containsAny(plain, BUY);
        if (!wallet && !buy) return new Result(amount, "", "Não fala em compra/pagamento");
        if (!buy && containsAny(plain, WEAK)) return new Result(amount, "", "Parece aviso de fatura/saldo");

        String desc = "";
        if (wallet && !title.contains("R$")) desc = clean(title);
        // Procura a loja depois do valor ("R$ 25,90 em PADARIA"); se não achar, no texto todo.
        if (desc.isEmpty()) desc = merchant(all.substring(m.end()));
        if (desc.isEmpty()) desc = merchant(all);
        if (desc.isEmpty()) desc = "Compra no cartão";
        return new Result(amount, desc, null);
    }

    private static String merchant(String text) {
        Matcher m = MERCHANT.matcher(text);
        while (m.find()) {
            String candidate = clean(m.group(1));
            if (candidate.length() < 2) continue;
            String p = plain(candidate);
            if (p.startsWith("cart") || p.startsWith("credito") || p.startsWith("debito") || p.startsWith("dia ")
                    || p.startsWith("valor") || p.startsWith("r$") || Character.isDigit(p.charAt(0))) continue;
            return candidate;
        }
        return "";
    }

    private static String clean(String s) {
        String out = s == null ? "" : s.replaceAll("\\s+", " ").trim();
        out = out.replaceAll("[\\s.,;:!-]+$", "");
        return out.length() > 40 ? out.substring(0, 40).trim() : out;
    }

    // minúsculo e sem acento, para comparar palavras
    private static String plain(String s) {
        String n = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}", "");
    }

    private static boolean containsAny(String s, String[] words) {
        for (String w : words) if (s.contains(w)) return true;
        return false;
    }
}
