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
function openMetricCompare(metricKey) {
  const meta = getMetricMeta(metricKey);
  if (!meta || healthDb.weighIns.length === 0) return;
  const { type, unit } = meta;

  const sorted = [...healthDb.weighIns].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  // Ordena uma cópia para mostrar a evolução sem reordenar o banco em memória.
  const dataPoints = [];

  sorted.forEach((w) => {
    let val = null;
    if (metricKey === "weight") val = w.weight;
    else if (metricKey === "bmi") val = getBmi(w.weight);
    else val = w[metricKey];

    if (val !== null && val !== undefined) {
      dataPoints.push({ date: new Date(w.date), val: val });
    }
  });

  const last5 = dataPoints.slice(0, 5);
  if (last5.length === 0) {
    const hint = metricKey === "bmi"
      ? "Pra calcular o IMC eu preciso da sua altura. Coloque em ⚙️ > Seu perfil."
      : "Ainda não há registros para essa métrica. Preencha esse campo numa pesagem e volte aqui.";
    showPageMessage(hint, { title: "Sem dados aqui", icon: "🤷" });
    return;
  }

  // A janela de comparação usa no máximo os cinco registros mais recentes.
  const sum = last5.reduce((acc, curr) => acc + curr.val, 0);
  const avg = sum / last5.length;
  const ultima = last5[0].val;
  const decType = type === "dec2" ? "dec2" : "dec1";

  document.getElementById("thMedia5").textContent = `${formatMetricValue(avg, decType)}${unit}`;

  // Regra de cores Toba: o que é bom subir? (o resto, cair é bom)
  const upIsGood = ["muscle", "water", "protein", "bone", "score"].includes(metricKey);

  const formataEvolucao = (valorBase, valorComp, idVal, idPct) => {
    const elVal = document.getElementById(idVal);
    const elPct = document.getElementById(idPct);
    elVal.className = "toba-stat-value";
    elPct.className = "toba-stat-sub";

    if (valorComp === null || valorComp === undefined) {
      elVal.textContent = "--";
      elVal.classList.add("text-muted");
      elPct.textContent = "";
      return;
    }

    const diff = valorBase - valorComp;
    const pct = valorComp !== 0 ? (diff / valorComp) * 100 : 0;

    if (diff > -0.001 && diff < 0.001) {
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

  formataEvolucao(ultima, avg, "thVsMediaVal", "thVsMediaPct");
  formataEvolucao(ultima, last5.length >= 2 ? last5[1].val : null, "thVsAntVal", "thVsAntPct");

  const chrono5 = [...last5].reverse();
  document.getElementById("svgChartContainer").innerHTML = renderSvgChart(chrono5, type, unit);

  document.getElementById("metricExplanatoryBox").innerHTML =
    buildRulerHTML(metricKey, ultima, type, unit);

  document.getElementById("compHistoryList").innerHTML = last5
    .map((item) => `
      <div class="kv-row">
        <span>${item.date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
        <b class="text-green">${formatMetricValue(item.val, type)}${unit}</b>
      </div>
    `)
    .join("");

  switchPesagemView("compare", meta.label);
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

function openMetricAdvice(metricKey) {
  const advice = metricAdvice[metricKey];
  if (!advice) return;
  document.getElementById("metricAdviceTitle").textContent = `🍄 ${advice.title}`;
  document.getElementById("metricAdviceContent").textContent = advice.text;
  openTobaModal("metricAdviceModal");
}

/* GRÁFICO SVG */
function renderSvgChart(points, type, unit) {
  if (points.length < 2)
    return tobaEmpty("📉", "Gráfico precisa de 2 pesagens", "Registre mais uma e a linha aparece aqui.", { compact: true });

  const w = 320,
    h = 100,
    pad = 25;
  const vals = points.map((p) => p.val);
  let min = Math.min(...vals),
    max = Math.max(...vals);

  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const margin = (max - min) * 0.25;
    min -= margin;
    max += margin;
  }

  // Converte os valores em coordenadas no viewBox; o SVG escala depois
  // para a largura disponível sem precisar recalcular em pixels.
  const coords = points.map((p, idx) => ({
    x: pad + (idx / (points.length - 1)) * (w - 2 * pad),
    y: h - pad - ((p.val - min) / (max - min)) * (h - 2 * pad),
    val: p.val,
  }));

  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(" ");

  let svg = `<svg class="weigh-chart" viewBox="0 0 ${w} ${h}">
            <defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#3fb950" flood-opacity="0.5"/></filter></defs>
            <polyline fill="none" stroke="#3fb950" stroke-width="3" points="${pointsStr}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
        `;

  coords.forEach((c) => {
    const valFormatted = formatMetricValue(c.val, type === "dec2" ? "dec2" : "dec1");
    svg += `
                <circle cx="${c.x}" cy="${c.y}" r="4" fill="#3fb950" stroke="#161b22" stroke-width="2"/>
                <text x="${c.x}" y="${c.y - 8}" fill="#f0f6fc" font-size="10" font-weight="800" text-anchor="middle">${valFormatted}${unit}</text>
            `;
  });
  svg += `</svg>`;
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
  closeMetricCompare,
  openMetricAdvice: (el) => openMetricAdvice(el.dataset.key),
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
