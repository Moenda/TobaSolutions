package br.com.toba.auto;

import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/**
 * v1.75: porta de entrada do Android Auto. O Auto (no celular ou o DHU no PC)
 * liga neste serviço e ganha uma {@link TobaCarSession} por tela de carro.
 */
public final class TobaCarAppService extends CarAppService {
    @Override
    public HostValidator createHostValidator() {
        // App pessoal, instalado por fora da Play Store: aceita qualquer host
        // (Android Auto do celular, DHU do Android Studio).
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @Override
    public Session onCreateSession() {
        return new TobaCarSession();
    }
}
