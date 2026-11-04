/* =====================================================================
 * Toba Health · Pesagem & Bioimpedância
 * Depende de ../assets/toba-common.js e health-core.js (healthDb, saveHealthDb).
 * ===================================================================== */
/* MOTOR DE DEMOGRAFIA E TEXTOS TOBERSON */
const TobaRules = {
  bmi: {
    title:
      "O clássico Índice de Massa Corporal. Diz se tu tá no chassi do grilo, padrão ou na fase do bulk sujo eterno.",
    getSegments: () => [
      { l: 18.5, c: "#58a6ff", n: "Baixo" },
      { l: 25.0, c: "#3fb950", n: "Padrão" },
      { l: 30.0, c: "#d29922", n: "Gordin" },
      { l: 40.0, c: "#f85149", n: "Obeso" },
    ],
    min: 15,
    max: 40,
    demo: "Padrão Universal (OMS)",
  },
  fat: {
    title:
      "A famosa capa da gaita! É a banha estocada. Baixar isso trinca o abdômen e faz as veias pularem.",
    getSegments: (g, a) => {
      if (g === "Masculino") {
        if (a <= 25)
          return [
            { l: 10, c: "#58a6ff", n: "Baixo" },
            { l: 20, c: "#3fb950", n: "Padrão" },
            { l: 25, c: "#d29922", n: "Alto" },
            { l: 45, c: "#f85149", n: "M.Alto" },
          ];
        if (a <= 35)
          return [
            { l: 12, c: "#58a6ff", n: "Baixo" },
            { l: 22, c: "#3fb950", n: "Padrão" },
            { l: 27, c: "#d29922", n: "Alto" },
            { l: 45, c: "#f85149", n: "M.Alto" },
          ];
        return [
          { l: 14, c: "#58a6ff", n: "Baixo" },
          { l: 24, c: "#3fb950", n: "Padrão" },
          { l: 29, c: "#d29922", n: "Alto" },
          { l: 45, c: "#f85149", n: "M.Alto" },
        ];
      } else {
        if (a <= 25)
          return [
            { l: 20, c: "#58a6ff", n: "Baixo" },
            { l: 30, c: "#3fb950", n: "Padrão" },
            { l: 35, c: "#d29922", n: "Alto" },
            { l: 45, c: "#f85149", n: "M.Alto" },
          ];
        if (a <= 35)
          return [
            { l: 22, c: "#58a6ff", n: "Baixo" },
            { l: 32, c: "#3fb950", n: "Padrão" },
            { l: 37, c: "#d29922", n: "Alto" },
            { l: 45, c: "#f85149", n: "M.Alto" },
          ];
        return [
          { l: 24, c: "#58a6ff", n: "Baixo" },
          { l: 34, c: "#3fb950", n: "Padrão" },
          { l: 39, c: "#d29922", n: "Alto" },
          { l: 45, c: "#f85149", n: "M.Alto" },
        ];
      }
    },
    min: 5,
    max: 45,
  },
  water: {
    title:
      "O suco de dinossauro do corpo. Ficar seco por dentro ferra os rins e mucha o músculo. Bebe água!",
    getSegments: (g) =>
      g === "Masculino"
        ? [
          { l: 50, c: "#f85149", n: "Baixo" },
          { l: 65, c: "#3fb950", n: "Padrão" },
          { l: 80, c: "#58a6ff", n: "Bom" },
        ]
        : [
          { l: 45, c: "#f85149", n: "Baixo" },
          { l: 60, c: "#3fb950", n: "Padrão" },
          { l: 80, c: "#58a6ff", n: "Bom" },
        ],
    min: 30,
    max: 80,
  },
  visceral: {
    title:
      "Gordura nos órgãos! A temida barriga dura de chopp. Nível alto é passaporte vip pro cardiologista.",
    getSegments: () => [
      { l: 9, c: "#3fb950", n: "Padrão" },
      { l: 14, c: "#d29922", n: "Alto" },
      { l: 25, c: "#f85149", n: "Perigo" },
    ],
    min: 1,
    max: 25,
    demo: "Padrão Universal de Saúde",
  },
  protein: {
    title:
      "O tijolo da construção do shape! Proteína baixa significa perda de massa e imunidade de paçoca.",
    getSegments: () => [
      { l: 16, c: "#f85149", n: "Baixo" },
      { l: 18, c: "#3fb950", n: "Padrão" },
      { l: 25, c: "#58a6ff", n: "Bom" },
    ],
    min: 10,
    max: 25,
    demo: "Padrão Universal de Saúde",
  },
  score: {
    title:
      "A nota geral da balança. É tipo a nota do Enem do fisiculturismo de garagem pra medir tua carcaça.",
    getSegments: () => [
      { l: 60, c: "#f85149", n: "Triste" },
      { l: 80, c: "#d29922", n: "Ok" },
      { l: 100, c: "#3fb950", n: "Mutante" },
    ],
    min: 30,
    max: 100,
    demo: "Algoritmo da Balança",
  },
  bmr: {
    title:
      "A fornalha interna! Calorias gastas só pra existir no sofá. Metabolismo alto = pode comer mais pizza.",
    getSegments: (g) =>
      g === "Masculino"
        ? [
          { l: 1500, c: "#f85149", n: "Lento" },
          { l: 1900, c: "#3fb950", n: "Normal" },
          { l: 3000, c: "#58a6ff", n: "Acelerado" },
        ]
        : [
          { l: 1200, c: "#f85149", n: "Lento" },
          { l: 1500, c: "#3fb950", n: "Normal" },
          { l: 3000, c: "#58a6ff", n: "Acelerado" },
        ],
    min: 1000,
    max: 3000,
  },
  muscle: {
    title:
      "Os quilos de puro músculo que te impedem de voar na ventania. Quanto mais pesada a carcaça, melhor!",
    getSegments: () => [
      { l: 40, c: "#d29922", n: "Baixo" },
      { l: 60, c: "#3fb950", n: "Bom" },
      { l: 100, c: "#58a6ff", n: "Monstro" },
    ],
    min: 20,
    max: 100,
    demo: "Variável por Altura",
  },
  bone: {
    title:
      "Teu esqueleto estrutural. Ossos densos seguram o tranco. Bora puxar ferro pesado pra reforçar!",
    getSegments: (g) =>
      g === "Masculino"
        ? [
          { l: 2.5, c: "#f85149", n: "Baixo" },
          { l: 3.5, c: "#3fb950", n: "Padrão" },
          { l: 5.0, c: "#58a6ff", n: "Forte" },
        ]
        : [
          { l: 1.5, c: "#f85149", n: "Baixo" },
          { l: 2.5, c: "#3fb950", n: "Padrão" },
          { l: 5.0, c: "#58a6ff", n: "Forte" },
        ],
    min: 1.0,
    max: 5.0,
  },
  bodyAge: {
    title:
      "A idade que tua carcaça acha que tem. Se der maior que tua idade real, tu tá enferrujado, pai!",
    getSegments: (g, a) => {
      let age = a || 30;
      return [
        { l: age, c: "#3fb950", n: "Jovem" },
        { l: age + 5, c: "#d29922", n: "Ok" },
        { l: 100, c: "#f85149", n: "Velho" },
      ];
    },
    min: 10,
    max: 100,
    demo: "Comparativo Biológico",
  },
  weight: {
    title:
      "O peso bruto no maquinário. Lembra que balança não diferencia músculo de banha, foco no espelho!",
    getSegments: () => [{ l: 150, c: "#3fb950", n: "Registros" }],
    min: 30,
    max: 150,
    demo: "Peso Absoluto",
  },
};

const metricAdvice = {
  bmi: { title: "IMC: a régua não sabe se você é forte ou só alto", text: "O IMC é um sinal grosseiro, não um diagnóstico. Ele não distingue músculo de gordura, então não deixe um número sozinho mandar na sua autoestima.\n\nPara melhorar a tendência: mantenha refeições consistentes, caminhe mais e faça treino de força. Se o resultado preocupa ou não combina com sua saúde, converse com um profissional em vez de brigar com a calculadora." },
  weight: { title: "Peso: a balança não é boletim escolar", text: "Peso muda com água, comida, sal e horário. Uma pesagem isolada pode fazer drama; acompanhe a tendência em condições parecidas.\n\nSe seu objetivo é reduzir: procure um déficit calórico moderado, priorize comida que sustenta e some caminhadas com treino de força. Nada de dieta-relâmpago: ela costuma voltar com juros." },
  score: { title: "Pontuação corporal: nota da balança, não da sua vida", text: "Cada fabricante inventa sua própria fórmula para essa nota. Use-a para observar tendências no mesmo aparelho, não como verdade universal.\n\nO plano pé no chão continua valendo: treino de força progressivo, movimento regular, refeições equilibradas e sono decente. A balança não aceita recurso, mas seu hábito aceita ajuste." },
  fat: { title: "Como reduzir gordura sem virar refém do alface", text: "Gordura corporal não baixa por decreto do espelho. O caminho costuma ser um déficit calórico moderado, refeições com proteína e fibras, treino de força e caminhadas regulares.\n\nAbdominal fortalece a barriga, mas não escolhe de onde o corpo tira gordura. Faça o básico por semanas, não por duas segundas-feiras. E desconfie de promessa de secar em sete dias: até boleto demora mais que isso." },
  muscle: { title: "Como ganhar músculo sem esperar milagre do whey", text: "Músculo responde a treino de força com progressão, recuperação e comida suficiente. Inclua fontes de proteína nas refeições e durma bem; suplemento é conveniência, não feitiço.\n\nAumente carga ou repetições aos poucos e dê tempo ao corpo. Se todo treino vira tentativa de recorde, a evolução pode ser trocar o halter pelo gelo." },
  water: { title: "Água: hidratação não é campeonato de litros", text: "A leitura da bioimpedância varia com hidratação, horário e exercício recente. Compare medições feitas em condições parecidas.\n\nBeba ao longo do dia e ajuste ao calor e à atividade. Não force litros de uma vez nem tente enganar a balança ficando desidratado: isso só engana você e deixa o corpo reclamando." },
  bmr: { title: "Metabolismo basal não é seu vale-pizza", text: "Esse número estima o que o corpo gasta em repouso; não é uma meta perfeita de ingestão nem uma autorização para comer só isso.\n\nEvite cortar comida agressivamente. Manter músculos com treino de força, alimentação adequada e sono ajuda mais do que tentar acelerar o metabolismo com chá misterioso de procedência duvidosa." },
  visceral: { title: "Gordura visceral: aqui vale cuidar sem pânico", text: "A bioimpedância dá uma estimativa, não um diagnóstico. Para melhorar a saúde metabólica, atividade regular, treino de força, alimentação equilibrada, sono e moderação no álcool são um começo honesto.\n\nSe a leitura continuar alta ou você tiver fatores de risco, leve os dados a um profissional de saúde. Google às duas da manhã não substitui consulta, por mais confiante que pareça." },
  protein: { title: "Proteína: constrói músculo, não argumento de academia", text: "A porcentagem da balança é uma estimativa e não define sozinha se sua dieta está adequada. Inclua fontes de proteína nas refeições e combine isso com treino e recuperação.\n\nNão precisa transformar todo alimento em suplemento. Se há doença renal ou outra condição clínica, converse com um profissional antes de aumentar muito o consumo." },
  bone: { title: "Massa óssea: não dá para resolver no modo maromba", text: "A balança estima esse valor; ela não mede densidade óssea como um exame clínico. Para cuidar dos ossos, atividade com carga apropriada, alimentação adequada e acompanhamento de saúde contam.\n\nNão aumente impacto ou suplemento no chute. Se houver preocupação real, médico e exame específico são melhores conselheiros que o botão de intensidade da academia." },
  bodyAge: { title: "Idade corporal: ficção científica com uma pitada de balança", text: "Essa idade é uma estimativa do algoritmo do aparelho, não sua idade biológica comprovada. Veja como ela evolui no mesmo aparelho e não cancele seu aniversário por causa dela.\n\nMovimento, força, sono e alimentação consistente são hábitos que ajudam a saúde de verdade. Não existe botão de voltar no tempo, mas existe o de sair do sofá." },
};


/* CONSTRUTOR DA RÉGUA DE MÉTRICAS */
function buildRulerHTML(key, val, type, unit) {
  const rule = TobaRules[key];
  if (!rule) return "";

  const gender = healthDb.gender || "Masculino";
  const age = healthDb.age || 30;

  let demoStr = rule.demo;
  if (!demoStr) {
    let ageGroup = age <= 25 ? "15 a 25" : age <= 35 ? "26 a 35" : "36+";
    demoStr = `Para ${gender === "Masculino" ? "homens" : "mulheres"} de ${ageGroup} anos`;
  }

  const segments = rule.getSegments(gender, age);
  const totalSpan = rule.max - rule.min;
  let htmlBars = "",
    htmlLabels = "";
  let prevLimit = rule.min;

  segments.forEach((seg) => {
    // Cada faixa começa onde a faixa anterior terminou; a largura visual
    // é proporcional ao intervalo numérico da régua.
    let span = seg.l - prevLimit;
    if (span <= 0) span = 1;
    let pct = (span / totalSpan) * 100;
    htmlBars += `<div style="width: ${pct}%; background: ${seg.c}"></div>`;
    htmlLabels += `<div style="width: ${pct}%">${seg.n}</div>`;
    prevLimit = seg.l;
  });

  let valPct = ((val - rule.min) / totalSpan) * 100;
  if (valPct < 0) valPct = 0;
  if (valPct > 100) valPct = 100;

  const valStr = formatMetricValue(val, type);
  const advice = metricAdvice[key]
    ? `<button type="button" class="ruler-advice-btn" data-click="openMetricAdvice" data-key="${key}" aria-label="Ver dica prática">🍄</button>`
    : "";

  return `
    <div class="card ruler-card">
      <div class="ruler-explanation-row">
        <div class="ruler-explanation-copy">
          <div class="ruler-demo">${demoStr}</div>
          <div class="ruler-text">${rule.title}</div>
        </div>
        ${advice}
      </div>
      <div class="ruler">
        <div class="ruler-bars">${htmlBars}</div>
        <div class="ruler-labels">${htmlLabels}</div>
        <div class="ruler-pin" style="left: ${Math.min(90, Math.max(10, valPct))}%">
          <div class="ruler-pin-tag">Você: ${valStr}${unit}</div>
          <div class="ruler-pin-line"></div>
        </div>
      </div>
    </div>
  `;
}

/* METADADOS DE CADA MÉTRICA (peso, IMC e as da balança) */
// Nome curto para os quadradinhos (cabe em 1 linha no S24).
const METRIC_SHORT_LABELS = {
  score: "Nota",
  fat: "Gordura",
  muscle: "Músculo",
  water: "Água",
  bmr: "Basal",
  visceral: "Visceral",
  protein: "Proteína",
  bone: "Ossos",
  bodyAge: "Idade",
};

function getMetricMeta(key) {
  if (key === "weight") return { key, label: "Peso", type: "dec2", unit: " kg" };
  if (key === "bmi") return { key, label: "IMC", type: "dec1", unit: "" };
  const m = healthDb.metricsOrder.find((item) => item.key === key);
  if (!m) return null;
  const label = m.label.split(" (")[0];
  return { key, label, short: METRIC_SHORT_LABELS[key] || label, type: m.type, unit: m.unit || "", color: m.color };
}

function formatMetricValue(val, type) {
  if (val === null || val === undefined) return "--";
  if (type === "dec2") return formatDec2(val);
  if (type === "dec1") return formatDec1(val);
  return String(val).replace(".", ",");
}

function getBmi(weight) {
  if (!healthDb.height || healthDb.height <= 0 || !weight) return null;
  const hM = healthDb.height / 100;
  return parseFloat((weight / (hM * hM)).toFixed(1));
}

function formatWeighDate(dateStr) {
  return new Date(dateStr).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* TELA DE COMPARATIVO (abre como "página" dentro do app) */
// v1.64: período escolhível (chips), linha de tendência e o veredito do Cloba.
// v1.68: períodos viraram só por tempo (2 semanas até 1 ano + Tudo).
// Tudo aqui só LÊ o healthDb; o período escolhido fica em toba_health_compare_prefs.
const COMPARE_PERIODS = [
  { id: "2w", label: "2 semanas", days: 14, phrase: "nas últimas 2 semanas", title: "Últimas 2 semanas" },
  { id: "1m", label: "1 mês", days: 30, phrase: "no último mês", title: "Último mês" },
  { id: "3m", label: "3 meses", days: 91, phrase: "nos últimos 3 meses", title: "Últimos 3 meses" },
  { id: "6m", label: "6 meses", days: 182, phrase: "nos últimos 6 meses", title: "Últimos 6 meses" },
  { id: "1y", label: "1 ano", days: 365, phrase: "no último ano", title: "Último ano" },
  { id: "all", label: "Tudo", phrase: "desde o começo", title: "Desde o começo" },
];
const COMPARE_PREFS_KEY = "toba_health_compare_prefs";
const COMPARE_DEFAULT_PERIOD = "3m";
const DAY_MS = 86400000;

// "Estável" = a linha de tendência mexeu menos que isso no período inteiro
// (na unidade da métrica). Métrica sem número aqui usa 1% da média.
const TREND_STABLE_BAND = {
  weight: 0.5,
  bmi: 0.2,
  score: 1,
  fat: 0.5,
  muscle: 0.4,
  water: 0.6,
  bmr: 25,
  visceral: 0.5,
  protein: 0.3,
  bone: 0.1,
  bodyAge: 1,
};

// Regra de cores Toba (v1.65): pra que lado cada número da balança é bom.
// "up" = subir é bom (verde), "down" = cair é bom. Vale pros quadradinhos
// vs Média/vs Anterior, as setinhas da lista, a cor da tendência e o Cloba.
const METRIC_GOOD_DIRECTION = {
  weight: "down", // peso: secar é a meta
  bmi: "down", // IMC anda junto com o peso
  score: "up", // pontuação corporal: nota da balança
  fat: "down", // gordura %
  muscle: "up", // massa muscular
  water: "up", // água %: hidratado e mais músculo (músculo é ~75% água)
  bmr: "up", // metabolismo basal: fornalha mais forte queima mais parado
  visceral: "down", // gordura em volta dos órgãos
  protein: "up", // proteína %: tijolo do shape
  bone: "up", // massa óssea
  bodyAge: "down", // idade corporal: mais novo que o RG é a meta
};

function metricUpIsGood(metricKey) {
  return METRIC_GOOD_DIRECTION[metricKey] === "up";
}

const compareState = { key: null, period: readComparePeriod() };

function readComparePeriod() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPARE_PREFS_KEY) || "null");
    if (raw && COMPARE_PERIODS.some((p) => p.id === raw.period)) return raw.period;
  } catch (err) {
    /* preferência ilegível: volta pro padrão */
  }
  return COMPARE_DEFAULT_PERIOD;
}

function storeComparePeriod(period) {
  try {
    localStorage.setItem(COMPARE_PREFS_KEY, JSON.stringify({ period }));
  } catch (err) {
    /* sem espaço: só não lembra o período */
  }
}

function getComparePeriod() {
  return COMPARE_PERIODS.find((p) => p.id === compareState.period) || COMPARE_PERIODS.find((p) => p.id === COMPARE_DEFAULT_PERIOD);
}

// Todos os valores da métrica, do mais novo pro mais velho (cópia, não reordena o banco).
function collectMetricPoints(metricKey) {
  const points = [];
  healthDb.weighIns.forEach((w) => {
    let val = null;
    if (metricKey === "weight") val = w.weight;
    else if (metricKey === "bmi") val = getBmi(w.weight);
    else val = w[metricKey];
    const date = new Date(w.date);
    if (val === null || val === undefined || !Number.isFinite(Number(val)) || Number.isNaN(date.getTime())) return;
    points.push({ date, t: date.getTime(), val: Number(val) });
  });
  return points.sort((a, b) => b.t - a.t);
}

function filterPointsByPeriod(points, period) {
  if (period.days) {
    const cutoff = Date.now() - period.days * DAY_MS;
    return points.filter((p) => p.t >= cutoff);
  }
  return points.slice();
}

function periodPhrase(period) {
  return period.phrase;
}

function chartTitleFor(period, n) {
  const label = n === 1 ? "1 pesagem" : `${n} pesagens`;
  return `📈 ${period.title} · ${label}`;
}

// Tamanho do buraco entre duas pesagens, curtinho pro gráfico: "18 dias", "3 sem", "2 meses", "1 ano".
function gapLabel(days) {
  if (days < 21) return `${Math.round(days)} dias`;
  if (days < 56) return `${Math.round(days / 7)} sem`;
  if (days < 365) {
    const m = Math.round(days / 30.4);
    return m <= 1 ? "1 mês" : `${m} meses`;
  }
  const y = Math.round((days / 365) * 10) / 10;
  return `${String(y).replace(".", ",")} ${y === 1 ? "ano" : "anos"}`;
}

function spanPhrase(days) {
  if (days < 2) return "nas últimas pesagens";
  if (days < 14) return `há ${Math.round(days)} dias`;
  if (days < 60) return `há ${Math.round(days / 7)} semanas`;
  const months = Math.round(days / 30.4);
  return months <= 1 ? "há 1 mês" : `há ${months} meses`;
}

// Regressão linear (mínimos quadrados) pelo tempo: devolve a reta e o quanto
// ela andou do primeiro ao último ponto. Pontos do mesmo instante usam o índice.
function calcTrend(chrono) {
  const n = chrono.length;
  if (n < 2) return null;
  const t0 = chrono[0].t;
  const spanDays = (chrono[n - 1].t - t0) / DAY_MS;
  const xs = spanDays > 0 ? chrono.map((p) => (p.t - t0) / DAY_MS) : chrono.map((_, i) => i);
  const ys = chrono.map((p) => p.val);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) * (x - mx);
  });
  const slope = sxx > 0 ? sxy / sxx : 0;
  const at = (x) => my + slope * (x - mx);
  const start = at(xs[0]);
  const end = at(xs[n - 1]);
  const resid = Math.sqrt(ys.reduce((acc, y, i) => acc + (y - at(xs[i])) ** 2, 0) / n);
  return {
    start,
    end,
    // Valor da reta num instante qualquer (usado pelo gráfico, que é por pesagem).
    at: (t) => (spanDays > 0 ? at((t - t0) / DAY_MS) : my),
    change: end - start,
    perMonth: spanDays >= 14 ? slope * 30.4 : null,
    spanDays,
    resid,
    mean: my,
  };
}

// Frases do Cloba. {delta} = variação com sinal, {periodo} = "nas últimas 10",
// {tempo} = "há 3 meses", {label} = nome da métrica.
// v1.65: cada número da balança tem as próprias frases e títulos (good/bad),
// sempre no sentido de METRIC_GOOD_DIRECTION. "up"/"down" = reserva genérica.
const TREND_LINES = {
  fat: {
    titles: { good: "🔥 Derretendo", bad: "🚨 Subindo", badStrong: "🚨 Alerta vermelho" },
    stable: ["Estável {tempo}, pai. Tá ótimo 👌", "A capa da gaita não mexe {tempo}. Constância de monge 🧘"],
    good: ["{delta} {periodo}. A banha tá pedindo arrego, segue o baile 🚀", "{delta} {periodo}. O tanquinho tá mandando sinal de fumaça 💪"],
    goodStrong: ["{delta} {periodo}?? Isso é cutting de filme, pai. Nunca foi sorte 🙏"],
    bad: ["Subindo {delta} {periodo}. Fudeu, a gordura tá aí 💩 Larga o pão de queijo", "{delta} {periodo}. A capa da gaita tá ganhando forro de inverno 🧥"],
    badStrong: ["{delta} {periodo}?? A gordura comprou apê e tá mobiliando 😂 Bora voltar pro básico"],
  },
  weight: {
    titles: { good: "🔥 Secando", bad: "🚨 Subindo" },
    stable: ["Peso cravado {tempo}. Balança de vidro, pai 👌", "Nem pra cima nem pra baixo {tempo}. Manutenção nível monge 🧘"],
    good: ["{delta} {periodo}. Tá secando bonito 🔥", "{delta} {periodo}. A balança tá começando a gostar de você 😎"],
    goodStrong: ["{delta} {periodo}?? Calma, Saitama 😂 Só não esquece de comer proteína"],
    bad: ["{delta} {periodo}. A balança tá rindo da tua cara 😂 Segura a larica", "{delta} {periodo}. O bulk sujo mandou lembranças 🍕"],
    badStrong: ["{delta} {periodo}?? Fudeu, pai. Fecha a geladeira e bora caminhar 🚶"],
  },
  bmi: {
    titles: { good: "📏 Caindo", bad: "🚨 Subindo" },
    stable: ["IMC cravado {tempo}. A régua não mexe, pai 👌"],
    good: ["IMC {delta} {periodo}. A régua tá a teu favor 📏🔥", "IMC {delta} {periodo}. Andando junto com o peso, do jeito certo 😎"],
    goodStrong: ["IMC {delta} {periodo}?? Tá encolhendo de propósito, Saitama 😂"],
    bad: ["IMC {delta} {periodo}. A régua tá apertando, segura a larica 🍕"],
    badStrong: ["IMC {delta} {periodo}?? Fudeu, pai. Bora voltar pro básico 🚶"],
  },
  score: {
    titles: { good: "⭐ Subindo", bad: "📉 Caindo" },
    stable: ["Nota parada {tempo}. Nem cola nem bomba 👌"],
    good: ["Nota {delta} {periodo}. A balança tá te dando estrelinha ⭐", "Nota {delta} {periodo}. Boletim melhorando, pai 📈"],
    goodStrong: ["Nota {delta} {periodo}?? Passou de ano direto 🎓"],
    bad: ["Nota {delta} {periodo}. A balança tá te dando recuperação 📉 Bora estudar (treinar)"],
    badStrong: ["Nota {delta} {periodo}?? Reprovado, pai 😂 Volta pro básico"],
  },
  muscle: {
    titles: { good: "💪 Crescendo", bad: "😬 Escorrendo" },
    stable: ["Músculo parado {tempo}. Segurando o que construiu 👌"],
    good: ["Músculo {delta} {periodo}. O shape tá vindo 🚀", "Músculo {delta} {periodo}. Tá construindo, pai 🧱"],
    goodStrong: ["Músculo {delta} {periodo}?? Monstro, saindo da jaula 🦍"],
    bad: ["Músculo {delta} {periodo}. Bora treino de força e proteína antes que vire pudim 🍮", "Músculo {delta} {periodo}. Tá escorrendo, pai. Bora reagir 👊"],
    badStrong: ["Músculo {delta} {periodo}?? Alerta vermelho. Volta pro treino ontem 🚨"],
  },
  water: {
    titles: { good: "💧 Hidratando", bad: "🌵 Secando" },
    stable: ["Água estável {tempo}. Hidratado tipo planta bem cuidada 🪴"],
    good: ["Água {delta} {periodo}. Hidratação em dia, o corpo agradece 💧", "Água {delta} {periodo}. Tá bebendo água igual o Killua na torneira 🐱💧"],
    goodStrong: ["Água {delta} {periodo}?? Virou camelo, pai 🐫💧"],
    bad: ["Água {delta} {periodo}. Tá secando por dentro. Entre um café da V60 e outro, bebe água 🚰"],
    badStrong: ["Água {delta} {periodo}?? Cacto mode ativado 🌵 Garrafinha do lado AGORA"],
  },
  bmr: {
    titles: { good: "🔥 Fornalha subindo", bad: "🥶 Esfriando" },
    stable: ["Basal estável {tempo}. A fornalha tá no mesmo fogo 🔥👌"],
    good: ["Basal {delta} {periodo}. A fornalha tá esquentando, queima mais até no sofá 🔥", "Basal {delta} {periodo}. Motor turbinado, pai. Pizza liberada (com moderação) 🍕"],
    goodStrong: ["Basal {delta} {periodo}?? Virou alto-forno, pai 🏭🔥"],
    bad: ["Basal {delta} {periodo}. Se foi porque secou, normal; se foi músculo indo embora, bora treino de força 💪"],
    badStrong: ["Basal {delta} {periodo}?? Modo economia de bateria 🪫 Proteína e treino de força pra reacender"],
  },
  visceral: {
    titles: { good: "🧹 Despejando", bad: "🚨 Subindo" },
    stable: ["Visceral parada {tempo}. Ninguém novo morando aí dentro 👌"],
    good: ["Visceral {delta} {periodo}. Despejando a gordura que mora nos órgãos 🧹🔥"],
    goodStrong: ["Visceral {delta} {periodo}?? Ordem de despejo cumprida 🏠🚪"],
    bad: ["Visceral {delta} {periodo}. Essa é a gordura traiçoeira, fica de olho 👀 Menos açúcar e bora caminhar"],
    badStrong: ["Visceral {delta} {periodo}?? Alerta vermelho, essa é a que pega o coração 🚨"],
  },
  protein: {
    titles: { good: "🧱 Subindo", bad: "😬 Caindo" },
    stable: ["Proteína parada {tempo}. Constância é o nome do jogo 👌"],
    good: ["Proteína {delta} {periodo}. Os tijolos do shape tão chegando 🧱", "Proteína {delta} {periodo}. O frango com batata doce tá trabalhando 🍗"],
    goodStrong: ["Proteína {delta} {periodo}?? Virou whey em forma de gente 🥛💪"],
    bad: ["Proteína {delta} {periodo}. Tá faltando tijolo na obra 🧱 Capricha no ovo, frango e feijão"],
    badStrong: ["Proteína {delta} {periodo}?? Obra embargada, pai 🚧 Proteína em toda refeição"],
  },
  bone: {
    titles: { good: "🦴 Subindo", bad: "😬 Caindo" },
    stable: ["Massa óssea estável {tempo}. Esqueleto firme, como tem que ser 🦴👌"],
    good: ["Massa óssea {delta} {periodo}. Esqueleto de adamantium em construção 🦴"],
    goodStrong: ["Massa óssea {delta} {periodo}?? Wolverine, é tu? 🦴⚔️"],
    bad: ["Massa óssea {delta} {periodo}. Treino de força, cálcio e sol que o esqueleto agradece ☀️🦴"],
    badStrong: ["Massa óssea {delta} {periodo}?? Bora cuidar disso, pai: força, cálcio e vitamina D 🚨"],
  },
  bodyAge: {
    titles: { good: "⏪ Rejuvenescendo", bad: "👴 Envelhecendo" },
    stable: ["Idade corporal parada {tempo}. O tempo não passa pra tu 🧘"],
    good: ["Idade corporal {delta} {periodo}. Rejuvenescendo, pai ⏪", "Idade corporal {delta} {periodo}. O RG mente, o corpo não 😎"],
    goodStrong: ["Idade corporal {delta} {periodo}?? Benjamin Button mode 👶"],
    bad: ["Idade corporal {delta} {periodo}. O corpo tá correndo na frente do calendário 👴 Bora treinar"],
    badStrong: ["Idade corporal {delta} {periodo}?? Virou tiozão do pavê 😂 Volta pro básico"],
  },
  up: {
    stable: ["{label} parado {tempo}. Constância é o nome do jogo 👌"],
    good: ["{label} {delta} {periodo}. É isso, tá no caminho 🚀"],
    goodStrong: ["{label} {delta} {periodo}?? Nunca foi sorte, Cloba 🙏"],
    bad: ["{label} {delta} {periodo}. Tá caindo, pai. Bora reagir 👊"],
    badStrong: ["{label} {delta} {periodo}?? Alerta vermelho. Bora voltar pro básico 🚨"],
  },
  down: {
    stable: ["{label} parado {tempo}. Constância é o nome do jogo 👌"],
    good: ["{label} {delta} {periodo}. É isso, tá no caminho 🔥"],
    goodStrong: ["{label} {delta} {periodo}?? Nunca foi sorte, Cloba 🙏"],
    bad: ["{label} {delta} {periodo}. Fica de olho que o bicho tá subindo 👀"],
    badStrong: ["{label} {delta} {periodo}?? Fudeu. Bora voltar pro básico 🚨"],
  },
};

const TREND_TITLES = {
  stable: "🧘 Estável",
  noisy: "🎢 Sanfona",
  good: { up: "💪 Subindo", down: "🔥 Derretendo" },
  bad: { up: "🚨 Subindo", down: "😬 Caindo" },
};

function buildTrendVerdict(metricKey, meta, chrono, trend, period) {
  const n = chrono.length;
  if (n < 2 || !trend) return "";
  if (n === 2) {
    return trendCardHtml("is-neutral", "🤏", "Só 2 pesagens", "Com 2 pontos é chute, não tendência. Sobe na balança mais vezes que o Cloba crava o papo reto.", "");
  }

  const decType = meta.type === "dec2" ? "dec2" : "dec1";
  const fmt = (v) => {
    const abs = formatMetricValue(Math.abs(v), decType);
    const zero = /^[0,]+$/.test(abs);
    return `${zero ? "" : v > 0 ? "+" : "−"}${abs}${meta.unit}`;
  };
  const band = trendBand(metricKey, trend);
  const upIsGood = metricUpIsGood(metricKey);
  const lines = TREND_LINES[metricKey] || TREND_LINES[upIsGood ? "up" : "down"];
  const titles = lines.titles || {};
  const change = trend.change;
  const pick = (arr) => arr[(n + Math.round(Math.abs(change) * 100)) % arr.length];

  let tone = "is-neutral";
  let title = TREND_TITLES.stable;
  let text;
  if (Math.abs(change) < band) {
    if (trend.resid > band * 0.8) {
      title = TREND_TITLES.noisy;
      text = `Sobe e desce ${periodPhrase(period)}, mas no fim tá no mesmo lugar. Pesa sempre no mesmo horário que o gráfico para de dançar 🪗`;
    } else {
      tone = "is-calm";
      text = pick(lines.stable);
    }
  } else {
    const up = change > 0;
    const good = up === upIsGood;
    const strong = Math.abs(change) >= band * 3;
    tone = good ? "is-good" : "is-bad";
    const dir = up ? "up" : "down";
    title = good ? titles.good || TREND_TITLES.good[dir] : (strong && titles.badStrong) || titles.bad || TREND_TITLES.bad[dir];
    const set = good ? (strong ? lines.goodStrong : lines.good) : strong ? lines.badStrong : lines.bad;
    text = pick(set);
  }

  text = text
    .replace("{delta}", fmt(change))
    .replace("{periodo}", periodPhrase(period))
    .replace("{tempo}", spanPhrase(trend.spanDays))
    .replace("{label}", meta.label);

  const [emoji, ...rest] = title.split(" ");
  const rateZero = trend.perMonth !== null && /^[0,]+$/.test(formatMetricValue(Math.abs(trend.perMonth), decType));
  const rate = trend.perMonth === null ? `Tendência: ${fmt(change)} no período` : rateZero ? "Ritmo: parado, zero por mês" : `Ritmo: ${fmt(trend.perMonth)} por mês`;
  return trendCardHtml(tone, emoji, rest.join(" "), text, rate);
}

function trendCardHtml(tone, emoji, title, text, foot) {
  return `
    <div class="card trend-card ${tone}">
      <div class="trend-emoji" aria-hidden="true">${emoji}</div>
      <div class="trend-copy">
        <div class="trend-kicker">Papo reto do Cloba</div>
        <div class="trend-title">${escapeHtml(title)}</div>
        <div class="trend-text">${escapeHtml(text)}</div>
        ${foot ? `<div class="trend-foot">${escapeHtml(foot)}</div>` : ""}
      </div>
    </div>
  `;
}

function trendBand(metricKey, trend) {
  return TREND_STABLE_BAND[metricKey] || Math.max(Math.abs(trend.mean) * 0.01, 0.1);
}

function trendToneColor(metricKey, trend) {
  if (!trend) return "var(--blue)";
  const band = trendBand(metricKey, trend);
  if (Math.abs(trend.change) < band) return "var(--blue)";
  const good = (trend.change > 0) === metricUpIsGood(metricKey);
  return good ? "var(--text-2)" : "var(--red)";
}

function openMetricCompare(metricKey) {
  const meta = getMetricMeta(metricKey);
  if (!meta || healthDb.weighIns.length === 0) return;
  if (collectMetricPoints(metricKey).length === 0) {
    const hint = metricKey === "bmi"
      ? "Pra calcular o IMC eu preciso da sua altura. Coloque em ⚙️ > Seu perfil."
      : "Ainda não há registros para essa métrica. Preencha esse campo numa pesagem e volte aqui.";
    showPageMessage(hint, { title: "Sem dados aqui", icon: "🤷" });
    return;
  }
  compareState.key = metricKey;
  renderMetricCompare();
  switchPesagemView("compare", meta.label);
}

function setComparePeriod(periodId) {
  if (!COMPARE_PERIODS.some((p) => p.id === periodId) || periodId === compareState.period) return;
  compareState.period = periodId;
  storeComparePeriod(periodId);
  renderMetricCompare();
}

function renderMetricCompare() {
  const metricKey = compareState.key;
  const meta = getMetricMeta(metricKey);
  if (!meta) return;
  const { type, unit } = meta;
  const decType = type === "dec2" ? "dec2" : "dec1";
  const period = getComparePeriod();
  const all = collectMetricPoints(metricKey);
  const sel = filterPointsByPeriod(all, period);

  document.getElementById("comparePeriods").innerHTML = COMPARE_PERIODS.map((p) => `
    <button type="button" class="compare-chip${p.id === period.id ? " is-on" : ""}" data-click="setComparePeriod" data-period="${p.id}" aria-pressed="${p.id === period.id}">${p.label}</button>
  `).join("");

  const upIsGood = metricUpIsGood(metricKey);
  const formataEvolucao = (valorBase, valorComp, idVal, idPct) => {
    const elVal = document.getElementById(idVal);
    const elPct = document.getElementById(idPct);
    elVal.className = "toba-stat-value";
    elPct.className = "toba-stat-sub";

    if (valorBase === null || valorBase === undefined || valorComp === null || valorComp === undefined) {
      elVal.textContent = "--";
      elVal.classList.add("text-muted");
      elPct.textContent = "";
      return;
    }

    const diff = valorBase - valorComp;
    const pct = valorComp !== 0 ? (diff / valorComp) * 100 : 0;

    // v1.65: diferença que arredonda pra zero ("-0,0%") é empate, não vermelho.
    if (/^[0,]+$/.test(formatMetricValue(Math.abs(diff), decType))) {
      elVal.textContent = `${formatMetricValue(0, decType)}${unit}`;
      elPct.textContent = "(0%)";
      elVal.classList.add("text-muted");
      elPct.classList.add("text-muted");
      return;
    }

    const subiu = diff > 0;
    const colorClass = subiu === upIsGood ? "text-green" : "text-red";
    const sinal = subiu ? "+" : "-";
    elVal.textContent = `${sinal}${formatMetricValue(Math.abs(diff), decType)}${unit}`;
    elPct.textContent = `(${sinal}${Math.abs(pct).toFixed(1).replace(".", ",")}%)`;
    elVal.classList.add(colorClass);
    elPct.classList.add(colorClass);
  };

  // Média e "vs Média" seguem o período; "vs Anterior" é sempre a pesagem de antes.
  const ultima = all[0].val;
  const avg = sel.length ? sel.reduce((acc, p) => acc + p.val, 0) / sel.length : null;
  document.getElementById("thMediaLabel").textContent = `Média (${sel.length})`;
  document.getElementById("thMedia5").textContent = avg === null ? "--" : `${formatMetricValue(avg, decType)}${unit}`;
  formataEvolucao(sel.length ? ultima : null, avg, "thVsMediaVal", "thVsMediaPct");
  formataEvolucao(ultima, all.length >= 2 ? all[1].val : null, "thVsAntVal", "thVsAntPct");

  const chrono = [...sel].reverse();
  const trend = calcTrend(chrono);
  document.getElementById("compareChartTitle").textContent = chartTitleFor(period, sel.length);
  document.getElementById("svgChartContainer").innerHTML = sel.length === 0
    ? tobaEmpty("🦗", "Nada nesse período", `A última foi em ${all[0].date.toLocaleDateString("pt-BR")}. Pega um período maior.`, { compact: true })
    : renderSvgChart(chrono, type, unit, trend, trendToneColor(metricKey, trend), trend ? trendBand(metricKey, trend) * 4 : 0);
  document.getElementById("trendVerdict").innerHTML = buildTrendVerdict(metricKey, meta, chrono, trend, period);

  document.getElementById("metricExplanatoryBox").innerHTML = buildRulerHTML(metricKey, ultima, type, unit);

  document.getElementById("compareListTitle").textContent = sel.length ? `🗓️ Registros do período (${sel.length})` : "🗓️ Registros do período";
  document.getElementById("compHistoryList").innerHTML = sel
    .map((item) => {
      const prev = all[all.indexOf(item) + 1];
      let delta = "";
      if (prev) {
        const d = item.val - prev.val;
        if (!/^[0,]+$/.test(formatMetricValue(Math.abs(d), decType))) {
          const cls = (d > 0) === upIsGood ? "text-green" : "text-red";
          delta = `<small class="cmp-delta ${cls}">${d > 0 ? "▲" : "▼"} ${formatMetricValue(Math.abs(d), decType)}</small>`;
        } else {
          delta = `<small class="cmp-delta text-muted">=</small>`;
        }
      }
      return `
      <div class="kv-row">
        <span>${item.date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
        <b class="text-green">${delta}${formatMetricValue(item.val, type)}${unit}</b>
      </div>
    `;
    })
    .join("");
}

function closeMetricCompare() {
  switchPesagemView("main");
}

function switchPesagemView(viewName, label = "") {
  const isCompare = viewName === "compare";
  document.getElementById("viewPesagem").classList.toggle("active", !isCompare);
  document.getElementById("viewCompare").classList.toggle("active", isCompare);
  document.getElementById("headerAddBtn").hidden = isCompare;
  if (isCompare) tobaSetHeader({ page: `📊 ${label}`, back: "closeMetricCompare" });
  else tobaSetHeader({ page: "⚖️ Pesagem" });
  window.scrollTo(0, 0);
}

// v1.68: ❔ do gráfico, o Cloba explicando como ler. Muda a regra do gráfico, muda o texto junto.
function openChartHelp() {
  const text = [
    "📅 Os botões lá em cima escolhem o período: 2 semanas até 1 ano, ou Tudo. A média, o vs Média e a lista embaixo vão junto.",
    "",
    "📏 Cada bolinha é uma pesagem e todas ganham o mesmo espaço. Pesou 30 vezes no mês? 30 colunas certinhas, pai. Nada de 5 bolinhas espremidas num canto.",
    "",
    "🟠 Ficou um tempão sem subir na balança? O buraco fica laranjinha, com o tamanho dele escrito (tipo \"↔ 2 meses\"). Não dá pra esconder do Cloba 👀",
    "",
    "〰️ A linha tracejada é a tendência: pra onde o bicho tá indo de verdade, sem o drama de uma pesagem só. Ela conta o tempo real, então no buraco do calendário ela dá um degrauzinho.",
    "",
    "🎨 Cada número da balança tem o lado bom dele: basal, músculo, água, proteína, massa óssea e pontuação SUBINDO é bom; peso, IMC, gordura, visceral e idade corporal DESCENDO é toperson. Verde = indo pro lado bom, vermelho = lado ruim. Na tendência: branco = indo bem, vermelho = indo mal, azul = parado.",
    "",
    "🗣️ Embaixo, o Papo reto do Cloba resume tudo e mostra o ritmo por mês. Nunca foi sorte 🙏",
  ].join("\n");
  showPageMessage(text, { title: "Como ler o gráfico", icon: "📈", okLabel: "Saquei 👊" });
}

function openMetricAdvice(metricKey) {
  const advice = metricAdvice[metricKey];
  if (!advice) return;
  document.getElementById("metricAdviceTitle").textContent = `🍄 ${advice.title}`;
  document.getElementById("metricAdviceContent").textContent = advice.text;
  openTobaModal("metricAdviceModal");
}

/* GRÁFICO SVG (v1.64: área, tendência tracejada e datas; v1.68: eixo por pesagem) */
// minSpan: altura mínima do eixo (na unidade da métrica), pra oscilação miúda não parecer montanha-russa.
// v1.68: cada pesagem ganha a mesma largura (30 pesagens = 30 colunas certinhas), mesmo com
// pesagem colada ou com meses de buraco. O buraco grande vira uma divisória "↔ 2 meses".
// A tendência continua calculada pelo tempo de verdade (calcTrend) e é desenhada no valor
// dela em cada pesagem, então os números do Cloba não mudam.
function renderSvgChart(points, type, unit, trend, trendColor = "var(--blue)", minSpan = 0) {
  if (points.length < 2)
    return tobaEmpty("📉", "Gráfico precisa de 2 pesagens", "Registre mais uma (ou pega um período maior) e a linha aparece aqui.", { compact: true });

  const w = 340;
  const h = 190;
  const padX = 18;
  const padTop = 28;
  const padBottom = 30;
  const n = points.length;
  const vals = points.map((p) => p.val);
  if (trend) vals.push(trend.start, trend.end);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 0.001) {
    min -= 1;
    max += 1;
  } else {
    const margin = (max - min) * 0.18;
    min -= margin;
    max += margin;
  }
  if (max - min < minSpan) {
    const grow = (minSpan - (max - min)) / 2;
    min -= grow;
    max += grow;
  }

  // X por pesagem: espaçamento igual, uma "coluna" por pesagem.
  const t0 = points[0].t;
  const tSpan = points[n - 1].t - t0;
  const xAt = (idx) => padX + (idx / (n - 1)) * (w - 2 * padX);
  const yAt = (v) => h - padBottom - ((v - min) / (max - min)) * (h - padTop - padBottom);
  const coords = points.map((p, idx) => ({ x: xAt(idx), y: yAt(p.val), val: p.val, date: p.date }));

  const r1 = (num) => Math.round(num * 10) / 10;
  const lineStr = coords.map((c) => `${r1(c.x)},${r1(c.y)}`).join(" ");
  const baseY = h - padBottom;
  const areaStr = `M${r1(coords[0].x)},${baseY} L${coords.map((c) => `${r1(c.x)},${r1(c.y)}`).join(" L")} L${r1(coords[n - 1].x)},${baseY} Z`;
  const decType = type === "dec2" ? "dec2" : "dec1";

  let svg = `<svg class="weigh-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico da evolução">
    <defs>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#3fb950" flood-opacity="0.5"/></filter>
      <linearGradient id="cmpArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3fb950" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#3fb950" stop-opacity="0"/>
      </linearGradient>
    </defs>`;

  // Grade leve (3 linhas)
  [0, 0.5, 1].forEach((f) => {
    const y = r1(padTop + f * (h - padTop - padBottom));
    svg += `<line class="chart-grid" x1="${padX}" x2="${w - padX}" y1="${y}" y2="${y}"/>`;
  });

  // Risquinho no pé de cada pesagem (até 60; mais que isso vira borrão).
  if (n <= 60) {
    coords.forEach((c) => {
      svg += `<line class="chart-tick" x1="${r1(c.x)}" x2="${r1(c.x)}" y1="${baseY}" y2="${baseY + 4}"/>`;
    });
  }

  // Buraco no calendário: entre duas pesagens com muito mais tempo que o normal,
  // faixa laranjinha + divisória tracejada com o tamanho do buraco ("↔ 2 meses"). Só os 2 maiores, pra não poluir.
  const gaps = [];
  for (let i = 1; i < n; i += 1) gaps.push({ i, days: (points[i].t - points[i - 1].t) / DAY_MS });
  const sortedDays = gaps.map((g) => g.days).sort((a, b) => a - b);
  const medianGap = sortedDays[Math.floor(sortedDays.length / 2)];
  const placed = [];
  gaps
    .filter((g) => g.days >= 14 && g.days >= medianGap * 3)
    .sort((a, b) => b.days - a.days)
    .slice(0, 2)
    .forEach((g) => {
      const gx = (coords[g.i - 1].x + coords[g.i].x) / 2;
      const text = `↔ ${gapLabel(g.days)}`;
      const tw = text.length * 8.5 * 0.62;
      const ly = baseY - 4;
      const lx = Math.min(Math.max(gx, padX + tw / 2), w - padX - tw / 2);
      const box = { x1: lx - tw / 2, x2: lx + tw / 2, y1: ly - 9, y2: ly + 2, text };
      const bx = coords[g.i - 1].x;
      svg += `<rect class="chart-gap-zone" x="${r1(bx)}" y="${padTop - 6}" width="${r1(coords[g.i].x - bx)}" height="${r1(baseY - padTop + 6)}"/>`;
      svg += `<line class="chart-gap" x1="${r1(gx)}" x2="${r1(gx)}" y1="${padTop - 6}" y2="${baseY}"/>`;
      // Rótulo só se não bater no do outro buraco (o maior ganha).
      if (!placed.some((o) => box.x1 < o.x2 + 4 && box.x2 > o.x1 - 4)) {
        svg += `<text class="chart-gap-label" x="${r1(lx)}" y="${ly}" text-anchor="middle">${text}</text>`;
        placed.push(box);
      }
    });

  svg += `<path class="chart-area" d="${areaStr}" fill="url(#cmpArea)"/>`;
  svg += `<polyline class="chart-line" pathLength="1" fill="none" stroke="#3fb950" stroke-width="3" points="${lineStr}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`;

  // Tendência: valor da reta (pelo tempo) em cada pesagem. Onde teve buraco no
  // calendário ela dá o "degrau" do tempo que passou; no resto fica lisinha.
  if (trend && n >= 3) {
    const trendStr = coords.map((c, idx) => `${r1(c.x)},${r1(yAt(trend.at(points[idx].t)))}`).join(" ");
    svg += `<polyline class="chart-trend" fill="none" points="${trendStr}" style="stroke: ${trendColor}"/>`;
  }

  // Bolinhas: menores quando tem muita pesagem; a última sempre destacada.
  const radius = n <= 12 ? 4 : n <= 30 ? 3 : 2;
  coords.forEach((c, idx) => {
    const isLast = idx === n - 1;
    if (n > 40 && !isLast) return;
    svg += `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${isLast ? radius + 1.5 : radius}" fill="${isLast ? "#f0f6fc" : "#3fb950"}" stroke="#161b22" stroke-width="2"/>`;
  });

  // Rótulos: todos com até 7 pontos; senão só primeiro, último, maior e menor.
  // v1.65: rótulo que bateria em outro (pesagens coladas, ex. "16,7%16,7%")
  // tenta ir pra baixo da bolinha; se ainda bater (ou é o mesmo número), some. Prioridade: última,
  // primeira, maior, menor, depois o resto na ordem.
  const ptVals = points.map((p) => p.val);
  const maxIdx = ptVals.indexOf(Math.max(...ptVals));
  const minIdx = ptVals.indexOf(Math.min(...ptVals));
  const order = [n - 1, 0, maxIdx, minIdx];
  if (n <= 7) coords.forEach((_, i) => order.push(i));
  const seen = new Set();
  const clash = (box) => placed.filter((o) => box.x1 < o.x2 + 3 && box.x2 > o.x1 - 3 && box.y1 < o.y2 + 1 && box.y2 > o.y1 - 1);
  order.forEach((i) => {
    if (seen.has(i)) return;
    seen.add(i);
    const c = coords[i];
    const isLast = i === n - 1;
    const text = `${formatMetricValue(c.val, decType)}${unit}`;
    const fs = isLast ? 11.5 : 10;
    const tw = text.length * fs * 0.6;
    const anchor = c.x < 40 ? "start" : c.x > w - 40 ? "end" : "middle";
    const dx = anchor === "start" ? -4 : anchor === "end" ? 4 : 0;
    const lx = c.x + dx;
    const x1 = anchor === "start" ? lx : anchor === "end" ? lx - tw : lx - tw / 2;
    const above = Math.max(12, c.y - 10);
    const below = Math.min(h - padBottom + 4, c.y + 18);
    const boxAt = (y) => ({ x1, x2: x1 + tw, y1: y - fs, y2: y + 2, text });
    let y = above;
    const first = clash(boxAt(above));
    if (first.length) {
      // Mesmo número colado no vizinho não precisa aparecer duas vezes.
      if (first.some((o) => o.text === text) || clash(boxAt(below)).length) return;
      y = below;
    }
    placed.push(boxAt(y));
    const cls = isLast ? "chart-label is-last" : "chart-label";
    svg += `<text class="${cls}" x="${r1(lx)}" y="${r1(y)}" text-anchor="${anchor}">${text}</text>`;
  });

  // Datas no pé: até 4 pesagens espalhadas por igual (primeira, última e as do meio),
  // cada uma embaixo da própria bolinha. Período que vira o ano mostra "jun/26".
  const crossesYear = points[0].date.getFullYear() !== points[n - 1].date.getFullYear();
  const dateLabel = (d) => crossesYear && tSpan > 120 * DAY_MS
    ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").replace(" de ", "/")
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const axisY = h - 8;
  const slots = n >= 10 ? 4 : n >= 5 ? 3 : 2;
  const axisIdx = [...new Set(Array.from({ length: slots }, (_, k) => Math.round((k * (n - 1)) / (slots - 1))))];
  let lastText = "";
  axisIdx.forEach((i, k) => {
    const text = dateLabel(coords[i].date);
    if (text === lastText && k !== axisIdx.length - 1) return;
    lastText = text;
    const anchor = k === 0 ? "start" : k === axisIdx.length - 1 ? "end" : "middle";
    const x = anchor === "start" ? padX - 4 : anchor === "end" ? w - padX + 4 : coords[i].x;
    svg += `<text class="chart-axis" x="${r1(x)}" y="${axisY}" text-anchor="${anchor}">${text}</text>`;
  });

  svg += `</svg>`;
  if (trend && n >= 3) {
    svg += `<div class="chart-legend"><span class="chart-legend-line"></span>Pesagens <span class="chart-legend-dash" style="border-color: ${trendColor}"></span>Tendência</div>`;
  }
  return svg;
}

/* MÉTRICAS DA BALANÇA (quais aparecem, em que ordem e com quantas casas) */
function openScaleConfig() {
  renderScaleConfigList();
  openTobaModal("scaleConfigModal");
}

// Formato do campo (v1.51): casas decimais (type) + dígitos antes da vírgula.
// É o que a máscara usa pra saber que o número acabou e pular de campo.
const METRIC_TYPE_DECIMALS = { int: 0, dec1: 1, dec2: 2 };

function getMetricDigits(m) {
  return healthDigitsOk(m.digits, 4) ? Number(m.digits) : DEFAULT_METRIC_DIGITS[m.key] || 2;
}

function getWeightFormat() {
  const wf = healthDb.weightFormat || {};
  return {
    type: wf.type === "dec1" ? "dec1" : "dec2",
    digits: healthDigitsOk(wf.digits, 3) ? Number(wf.digits) : DEFAULT_WEIGHT_FORMAT.digits,
  };
}

// "00,00" = 2 dígitos e 2 casas, do jeito que aparece no visor da balança
function formatPattern(type, digits) {
  const decimals = METRIC_TYPE_DECIMALS[type] || 0;
  return "0".repeat(digits) + (decimals ? `,${"0".repeat(decimals)}` : "");
}

function maskClassFor(type) {
  return type === "dec1" ? "toba-mask-dec1" : type === "dec2" ? "toba-mask-dec2" : "toba-mask-int";
}

// Exemplo do campo vazio: o do padrão, se ainda bater com o formato escolhido
function placeholderFor(original, type, digits) {
  const decimals = METRIC_TYPE_DECIMALS[type] || 0;
  const match = String(original || "").match(/(\d+)(?:,(\d+))?\s*$/);
  if (match && match[1].length === digits && (match[2] || "").length === decimals) return original;
  return `Ex: ${formatPattern(type, digits)}`;
}

// Botão do Visor (v1.52): abre a folha de quadradinhos, no estilo da gaveta
// de categorias do Gastos (no lugar do <select> nativo do Android).
function formatButtonHtml(type, digits, target, label) {
  return `<button type="button" class="scale-format-btn" data-click="openFormatPicker" data-target="${target}" aria-label="Visor: ${escapeHtml(label)}">
    <span class="scale-format-lcd">${formatPattern(type, digits)}</span><span class="scale-format-arrow">›</span>
  </button>`;
}

// Número de exemplo no formato (00,00 -> 82,50), pra ver como fica
function formatExample(type, digits) {
  const decimals = METRIC_TYPE_DECIMALS[type] || 0;
  return "1823".slice(-digits) + (decimals ? `,${"50".slice(0, decimals)}` : "");
}

let formatPickerTarget = null;

function openFormatPicker(target) {
  const isWeight = target === "weight";
  const metric = isWeight ? null : healthDb.metricsOrder[Number(target)];
  if (!isWeight && !metric) return;
  formatPickerTarget = target;
  const current = isWeight ? getWeightFormat() : { type: metric.type, digits: getMetricDigits(metric) };
  const groups = [
    { type: "int", label: "🔢 Sem vírgula" },
    { type: "dec1", label: "☝️ 1 casa decimal" },
    { type: "dec2", label: "✌️ 2 casas decimais" },
  ].filter((g) => !isWeight || g.type !== "int");
  const maxDigits = isWeight ? 3 : 4;
  document.getElementById("formatPickerTitle").textContent = isWeight ? "⚖️ Peso (kg)" : `📟 ${metric.label}`;
  document.getElementById("formatPickerBody").innerHTML = groups.map((g) => `
    <div class="format-group-label">${g.label}</div>
    <div class="format-grid is-${maxDigits}">
      ${Array.from({ length: maxDigits }, (_, i) => i + 1).map((digits) => {
        const on = g.type === current.type && digits === current.digits;
        return `<button type="button" class="format-tile${on ? " is-selected" : ""}" data-click="pickScaleFormat" data-value="${g.type}|${digits}" aria-pressed="${on}">
          <span class="format-tile-lcd">${formatPattern(g.type, digits)}</span>
          <span class="format-tile-example">ex: ${formatExample(g.type, digits)}</span>
        </button>`;
      }).join("")}
    </div>`).join("");
  openTobaModal("formatPickerModal");
}

function pickScaleFormat(value) {
  if (formatPickerTarget === "weight") setWeightFormat(value);
  else setMetricFormat(Number(formatPickerTarget), value);
  closeTobaModal("formatPickerModal");
  renderScaleConfigList();
}

function renderScaleConfigList() {
  const last = healthDb.metricsOrder.length - 1;
  const wf = getWeightFormat();
  const weightRow = `
            <div class="order-item is-weight">
                <div class="order-item-main">
                    <span class="order-item-left is-static"><span class="scale-fixed-icon">⚖️</span><span>Peso (kg)</span></span>
                    <span class="scale-format">Visor ${formatButtonHtml(wf.type, wf.digits, "weight", "Peso (kg)")}</span>
                </div>
                <span class="scale-fixed-tag">sempre</span>
            </div>`;
  document.getElementById("scaleMetricsOrderList").innerHTML = weightRow +
    healthDb.metricsOrder
      .map(
        (m, idx) => `
            <div class="order-item">
                <div class="order-item-main">
                    <label class="order-item-left" for="chk_${m.key}">
                        <input type="checkbox" id="chk_${m.key}" ${m.active ? "checked" : ""} data-change="toggleMetricActive" data-index="${idx}">
                        <span>${escapeHtml(m.label)}</span>
                    </label>
                    <span class="scale-format">Visor ${formatButtonHtml(m.type, getMetricDigits(m), idx, m.label)}</span>
                </div>
                <div class="order-btns">
                    <button type="button" class="action-icon-btn" data-click="moveMetric" data-index="${idx}" data-dir="-1" ${idx === 0 ? "disabled" : ""} aria-label="Subir">⬆️</button>
                    <button type="button" class="action-icon-btn" data-click="moveMetric" data-index="${idx}" data-dir="1" ${idx === last ? "disabled" : ""} aria-label="Descer">⬇️</button>
                </div>
            </div>
        `,
      )
      .join("");
}

function setMetricFormat(index, value) {
  const [type, digits] = String(value).split("|");
  const metric = healthDb.metricsOrder[index];
  if (!metric || !HEALTH_METRIC_TYPES.includes(type) || !healthDigitsOk(digits, 4)) return;
  metric.type = type;
  metric.digits = Number(digits);
  saveHealthDb();
}

function setWeightFormat(value) {
  const [type, digits] = String(value).split("|");
  if (!["dec1", "dec2"].includes(type) || !healthDigitsOk(digits, 3)) return;
  healthDb.weightFormat = { type, digits: Number(digits) };
  saveHealthDb();
}

function toggleMetricActive(index, isActive) {
  healthDb.metricsOrder[index].active = isActive;
  saveHealthDb();
}

function moveMetric(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= healthDb.metricsOrder.length) return;
  const temp = healthDb.metricsOrder[index];
  healthDb.metricsOrder[index] = healthDb.metricsOrder[newIndex];
  healthDb.metricsOrder[newIndex] = temp;
  saveHealthDb();
  renderScaleConfigList();
}

/* RENDERIZAÇÃO PRINCIPAL */
function updateUI() {
  renderWeighIns();
}

function renderWeighIns() {
  const historyList = document.getElementById("historyList");
  const latestDisplay = document.getElementById("latestWeightDisplay");
  const metricsGrid = document.getElementById("metricsGrid");

  if (healthDb.weighIns.length === 0) {
    latestDisplay.innerHTML = tobaEmpty(
      "⚖️",
      "Nenhuma pesagem ainda",
      "Sobe na balança (com coragem) e toque em + Pesagem.",
    );
    metricsGrid.hidden = true;
    historyList.innerHTML = "";
    return;
  }

  // A ordenação in-place mantém a lista cronológica usada tanto pelo
  // registro mais recente quanto pelo histórico, sem ordenar duas vezes.
  const sortedWeighIns = healthDb.weighIns.sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  const latest = sortedWeighIns[0];
  const previous = sortedWeighIns[1];

  let trend = "";
  if (previous && previous.weight) {
    const diff = latest.weight - previous.weight;
    if (Math.abs(diff) >= 0.005) {
      const cls = diff < 0 ? "text-green" : "text-red";
      trend = `<span class="${cls}">${diff < 0 ? "▼" : "▲"} ${formatDec2(Math.abs(diff))} kg</span> vs anterior • `;
    }
  }

  latestDisplay.innerHTML = `
    <div class="latest-weight-box" role="button" tabindex="0" data-click="openMetric" data-key="weight" aria-label="Ver evolução do peso">
      <div class="card-title">Peso atual</div>
      <div class="latest-weight-value">${formatDec2(latest.weight)}<small> kg</small></div>
      <div class="latest-weight-meta">${trend}${formatWeighDate(latest.date)}</div>
      <div class="latest-weight-link">Ver evolução ›</div>
    </div>
  `;

  const tile = (key, label, value, colorStyle = "") => `
    <button type="button" class="toba-stat is-center" data-click="openMetric" data-key="${key}">
      <span class="toba-stat-label">${escapeHtml(label)}</span>
      <span class="toba-stat-value"${colorStyle}>${value}</span>
    </button>
  `;

  let activeGridHtml = "";
  const bmiVal = getBmi(latest.weight);
  if (bmiVal !== null) activeGridHtml += tile("bmi", "IMC", formatDec1(bmiVal));

  healthDb.metricsOrder.forEach((m) => {
    if (!m.active) return;
    const meta = getMetricMeta(m.key);
    const raw = latest[m.key];
    const has = raw !== null && raw !== undefined;
    const valDisplay = has ? `${formatMetricValue(raw, m.type)}${m.unit || ""}` : "--";
    const colorStyle = has && m.color ? ` style="color: ${m.color}"` : "";
    activeGridHtml += tile(m.key, meta.short, valDisplay, colorStyle);
  });

  metricsGrid.innerHTML = activeGridHtml;
  metricsGrid.hidden = !activeGridHtml;

  const fatMetric = healthDb.metricsOrder.find((m) => m.key === "fat");
  historyList.innerHTML = sortedWeighIns
    .map((w) => {
      const fatInfo = w.fat && fatMetric && fatMetric.active ? `${formatDec1(w.fat)}% gordura` : "";
      return `
        <div class="toba-list-item" role="button" tabindex="0" data-click="editWeighIn" data-id="${escapeHtml(String(w.id))}">
          <div class="history-info">
            <div class="history-date">${formatWeighDate(w.date)}</div>
            ${fatInfo ? `<div class="history-extra">${fatInfo}</div>` : ""}
          </div>
          <div class="history-weight">${formatDec2(w.weight)} kg</div>
        </div>
      `;
    })
    .join("");
}

/* CRUD DE PESAGEM */
function openAddWeighModal() {
  document.getElementById("weighModalTitle").textContent = "⚖️ Nova pesagem";
  document.getElementById("editingWeighId").value = "";
  document.getElementById("btnSaveWeigh").textContent = "Salvar pesagem 🚀";
  document.getElementById("btnDeleteWeigh").hidden = true;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("wDate").value = now.toISOString().slice(0, 16);
  setupWeightField(null);
  renderDynamicFields({});
  openTobaModal("weighModal");
}

function openEditWeighModal(weighId) {
  const entry = healthDb.weighIns.find((w) => String(w.id) === String(weighId));
  if (!entry) return;
  document.getElementById("weighModalTitle").textContent = "✏️ Editar pesagem";
  document.getElementById("editingWeighId").value = entry.id;
  document.getElementById("btnSaveWeigh").textContent = "Salvar 💾";
  document.getElementById("btnDeleteWeigh").hidden = false;
  document.getElementById("wDate").value = entry.date;
  setupWeightField(entry.weight);
  renderDynamicFields(entry);
  openTobaModal("weighModal");
}

// Campo do peso no formato da ⚙️ (casas e dígitos). data-orig guarda o texto
// preenchido: se você não mexer, o valor gravado fica exatamente igual.
function setupWeightField(weight) {
  const wf = getWeightFormat();
  const el = document.getElementById("wWeight");
  el.classList.remove("toba-mask-dec1", "toba-mask-dec2");
  el.classList.add(maskClassFor(wf.type));
  el.dataset.digits = wf.digits;
  el.placeholder = placeholderFor("Ex: 82,50", wf.type, wf.digits);
  el.value = weight ? formatMetricValue(weight, wf.type) : "";
  el.dataset.orig = el.value;
}

// Texto do campo igual ao que foi preenchido = não mexeu (mantém o gravado)
function fieldUntouched(el) {
  return el.dataset.orig !== undefined && el.dataset.orig !== "" && el.value === el.dataset.orig;
}

function renderDynamicFields(entryData) {
  document.getElementById("dynamicFormFields").innerHTML =
    healthDb.metricsOrder
      .filter((m) => m.active)
      .map((m) => {
        let val = "";
        if (entryData[m.key] !== undefined && entryData[m.key] !== null) {
          val = formatMetricValue(entryData[m.key], m.type);
        }
        const digits = getMetricDigits(m);
        const inputMode = m.type === "int" ? "numeric" : "decimal";
        return `
                <div class="form-group">
                    <label for="w_${m.key}">${escapeHtml(m.label)}</label>
                    <input type="text" inputmode="${inputMode}" id="w_${m.key}" class="form-control ${maskClassFor(m.type)}" data-digits="${digits}" data-orig="${escapeHtml(String(val))}" placeholder="${escapeHtml(placeholderFor(m.placeholder, m.type, digits))}" value="${escapeHtml(String(val))}">
                </div>
            `;
      })
      .join("");
  initTobaDecimalMasks();
}

function saveWeighIn() {
  const editingId = document.getElementById("editingWeighId").value;
  const weightEl = document.getElementById("wWeight");
  const weightVal = parseTobaDecimal(weightEl.value);
  if (!weightVal) {
    showPageMessage("Preencha pelo menos o peso, meu consagrado!", { title: "Faltou o peso", icon: "⚖️" });
    return;
  }

  // Puxa os dados antigos se estivermos editando pra não perder o que tá oculto!
  // (compara como texto: um id gravado como "123" não pode sumir na edição)
  const existingEntry = editingId
    ? healthDb.weighIns.find((w) => String(w.id) === String(editingId))
    : null;

  const entry = {
    id: existingEntry ? existingEntry.id : Date.now(),
    date: document.getElementById("wDate").value,
    // Não mexeu no campo = peso gravado intacto (a ⚙️ pode mostrar menos casas)
    weight: existingEntry && fieldUntouched(weightEl) && Number(existingEntry.weight) > 0 ? existingEntry.weight : weightVal,
  };

  healthDb.metricsOrder.forEach((m) => {
    const el = document.getElementById(`w_${m.key}`);
    if (el) {
      // O campo tá na tela (métrica ativa). Não mexeu = valor gravado intacto.
      if (existingEntry && fieldUntouched(el) && existingEntry[m.key] !== undefined && existingEntry[m.key] !== null) {
        entry[m.key] = existingEntry[m.key];
      } else if (el.value.trim() !== "") {
        entry[m.key] = (m.type === "dec1" || m.type === "dec2") ? parseTobaDecimal(el.value) : parseInt(el.value, 10) || null;
      } else {
        entry[m.key] = null;
      }
    } else {
      // O campo NÃO tá na tela. Mantém o valor que já tava no banco (se existir)!
      entry[m.key] = existingEntry && existingEntry[m.key] !== undefined ? existingEntry[m.key] : null;
    }
  });

  const idx = existingEntry ? healthDb.weighIns.indexOf(existingEntry) : -1;
  if (idx !== -1) healthDb.weighIns[idx] = entry;
  else healthDb.weighIns.push(entry);

  saveHealthDb();
  closeTobaModal("weighModal");
  updateUI();
}

async function deleteCurrentWeighIn() {
  const editingId = document.getElementById("editingWeighId").value;
  if (!editingId) return;
  const confirmed = await showPageMessage("Apagar esta pesagem? Não tem volta.", { title: "Excluir pesagem", confirm: true, confirmLabel: "Excluir" });
  if (!confirmed) return;
  healthDb.weighIns = healthDb.weighIns.filter(
    (w) => String(w.id) !== String(editingId),
  );
  saveHealthDb();
  closeTobaModal("weighModal");
  updateUI();
}

/* PERFIL */
function openProfile() {
  document.getElementById("cfgAge").value = healthDb.age || "";
  document.getElementById("cfgHeight").value = healthDb.height || "";
  document.getElementById("cfgGender").value = healthDb.gender || "";
  openTobaModal("profileModal");
}

function saveProfile() {
  healthDb.age =
    parseInt(document.getElementById("cfgAge").value) || null;
  healthDb.height =
    parseInt(document.getElementById("cfgHeight").value) || null;
  healthDb.gender = document.getElementById("cfgGender").value || null;
  saveHealthDb();
  closeTobaModal("profileModal");
  updateUI();
}

function onHealthDataReplaced() {
  closeTobaModal("profileModal");
  switchPesagemView("main");
  updateUI();
}

tobaActions({
  openWeighReminder: () =>
    tobaOpenReminder({
      id: "pesagem",
      title: "⚖️ Hora da pesagem",
      message: "Sobe na balança e registra no Toba Health!",
      times: ["07:30"],
      days: ["MO"],
    }),
  newWeighIn: openAddWeighModal,
  editWeighIn: (el) => openEditWeighModal(el.dataset.id),
  saveWeighIn,
  deleteCurrentWeighIn,
  openMetric: (el) => openMetricCompare(el.dataset.key),
  setComparePeriod: (el) => setComparePeriod(el.dataset.period),
  closeMetricCompare,
  openMetricAdvice: (el) => openMetricAdvice(el.dataset.key),
  openChartHelp,
  openProfile,
  saveProfile,
  openScaleConfig,
  toggleMetricActive: (el) => toggleMetricActive(Number(el.dataset.index), el.checked),
  openFormatPicker: (el) => openFormatPicker(el.dataset.target),
  pickScaleFormat: (el) => pickScaleFormat(el.dataset.value),
  moveMetric: (el) => moveMetric(Number(el.dataset.index), Number(el.dataset.dir)),
});

// Fechar a balança redesenha a tela (métricas ligadas/desligadas).
document.getElementById("scaleConfigModal").addEventListener("toba:close", updateUI);

initTobaDecimalMasks();
updateUI();
