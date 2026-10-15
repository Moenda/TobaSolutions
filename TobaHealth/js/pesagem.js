/* =====================================================================
 * Toba Health · Pesagem & Bioimpedância
 * Depende de health-core.js (healthDb, saveHealthDb, showPageMessage...)
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

/* CONSTRUTOR DA RÉGUA DE MÉTRICAS */
function buildRulerHTML(key, val, type, unit) {
  const rule = TobaRules[key];
  if (!rule) return "";

  const gender = healthDb.gender || "Masculino";
  const age = healthDb.age || 30;

  let demoStr = rule.demo;
  if (!demoStr) {
    let ageGroup = age <= 25 ? "15 a 25" : age <= 35 ? "26 a 35" : "36+";
    demoStr = `Para ${gender === "Masculino" ? "Homens" : "Mulheres"} de ${ageGroup} anos`;
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
    htmlBars += `<div style="width: ${pct}%; background: ${seg.c}; height: 8px;"></div>`;
    htmlLabels += `<div style="width: ${pct}%; text-align: center; font-size: 0.65rem; color: #8b949e; font-weight: 700; text-transform: uppercase; margin-top: 4px;">${seg.n}</div>`;
    prevLimit = seg.l;
  });

  let valPct = ((val - rule.min) / totalSpan) * 100;
  if (valPct < 0) valPct = 0;
  if (valPct > 100) valPct = 100;

  const valStr =
    type === "dec2"
      ? formatDec2(val)
      : type === "dec1"
        ? formatDec1(val)
        : val;

  return `
            <div style="background: #161b22; border: 1px solid #30363d; border-radius: 14px; padding: 1.2rem; margin-bottom: 1rem;">
                <div class="ruler-explanation-row">
                  <div class="ruler-explanation-copy">
                    <div style="font-size: 0.7rem; font-weight: 800; color: #58a6ff; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">${demoStr}</div>
                    <div style="font-size: 0.85rem; color: #c9d1d9; line-height: 1.4;">${rule.title}</div>
                  </div>
                  <button type="button" class="ruler-advice-btn" onclick="openMetricAdviceModal('${key}')" title="Ver dica prática" aria-label="Ver dica prática sobre ${demoStr}">🍄</button>
                </div>
                
                <div style="position: relative; padding-top: 25px; padding-bottom: 5px;">
                    <div style="display: flex; width: 100%; border-radius: 4px; overflow: hidden; background: #21262d;">
                        ${htmlBars}
                    </div>
                    <div style="display: flex; width: 100%;">
                        ${htmlLabels}
                    </div>
                    <div style="position: absolute; top: -2px; left: ${valPct}%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 10;">
                        <div style="background: #f0f6fc; color: #0d1117; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">Você: ${valStr}${unit}</div>
                        <div style="width: 2px; height: 16px; background: #f0f6fc; margin-top: 3px;"></div>
                    </div>
                </div>
            </div>
        `;
}

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

/* MODAL DE COMPARATIVO */
function openMetricCompareModal(metricKey, label, type, unit = "") {
  if (healthDb.weighIns.length === 0) return;

  document.getElementById("compModalTitle").innerText = `📊 ${label}`;

  const sorted = [...healthDb.weighIns].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  // Ordena uma cópia para mostrar a evolução sem reordenar o banco em memória.
  const dataPoints = [];

  sorted.forEach((w) => {
    let val = null;
    if (metricKey === "weight") {
      val = w.weight;
    } else if (metricKey === "bmi") {
      if (healthDb.height && healthDb.height > 0) {
        const hM = healthDb.height / 100;
        val = parseFloat((w.weight / (hM * hM)).toFixed(1));
      }
    } else {
      val = w[metricKey];
    }

    if (val !== null && val !== undefined) {
      dataPoints.push({ date: new Date(w.date), val: val });
    }
  });

  const last5 = dataPoints.slice(0, 5);
  if (last5.length === 0) {
    showPageMessage("Ainda não há registros para essa métrica. Cadastre esse campo em uma pesagem e volte para conferir a evolução.", { title: "Sem dados nessa métrica" });
    return;
  }

  // A janela de comparação usa no máximo os cinco registros mais recentes.
  const sum = last5.reduce((acc, curr) => acc + curr.val, 0);
  const avg = sum / last5.length;
  const ultima = last5[0].val;

  // 1. Seta a Média no Quadrado 1
  document.getElementById("thMedia5").innerText = `${type === "dec2" ? formatDec2(avg) : formatDec1(avg)}${unit}`;

  // 2. Regra de Cores Toba: O que é bom subir? (O resto, cair é bom)
  const upIsGood = ["muscle", "water", "protein", "bone", "score"].includes(metricKey);

  // 3. Função ninja pra calcular e pintar a tela
  const formataEvolucao = (valorBase, valorComp, idVal, idPct) => {
    const elVal = document.getElementById(idVal);
    const elPct = document.getElementById(idPct);

    if (valorComp === null || valorComp === undefined) {
      elVal.innerHTML = '<span style="color: #8b949e;">--</span>';
      elPct.innerText = '';
      return;
    }

    const diff = valorBase - valorComp;
    const pct = valorComp !== 0 ? (diff / valorComp) * 100 : 0;

    let cor = "#8b949e";
    let sinal = "";

    if (diff > 0.001) {
      // Subiu: Verde se for músculo/água/score, Vermelho se for gordura/peso/idade
      cor = upIsGood ? "#3fb950" : "#f85149";
      sinal = "+";
    } else if (diff < -0.001) {
      // Caiu: Vermelho se for músculo/água, Verde se for gordura/peso
      cor = upIsGood ? "#f85149" : "#3fb950";
      sinal = "-";
    }

    const formattedDiff = type === "dec2" ? formatDec2(Math.abs(diff)) : formatDec1(Math.abs(diff));

    elVal.innerHTML = `<span style="color: ${cor};">${sinal}${formattedDiff}${unit}</span>`;

    if (diff > -0.001 && diff < 0.001) {
      elVal.innerHTML = `<span style="color: #8b949e;">0,0${type === "dec1" ? "" : "0"}${unit}</span>`;
      elPct.innerText = `(0%)`;
      elPct.style.color = "#8b949e";
    } else {
      elPct.innerText = `(${sinal}${Math.abs(pct).toFixed(1).replace('.', ',')}%)`;
      elPct.style.color = cor;
    }
  };

  // 4. Calculando e preenchendo as métricas
  // Quadrado 2: vs Média
  formataEvolucao(ultima, avg, 'thVsMediaVal', 'thVsMediaPct');

  // Quadrado 3: vs Anterior
  if (last5.length >= 2) {
    formataEvolucao(ultima, last5[1].val, 'thVsAntVal', 'thVsAntPct');
  } else {
    formataEvolucao(ultima, null, 'thVsAntVal', 'thVsAntPct');
  }

  const chrono5 = [...last5].reverse();
  document.getElementById("svgChartContainer").innerHTML = renderSvgChart(
    chrono5,
    type,
    unit,
  );

  const latestVal = last5[0].val;
  document.getElementById("metricExplanatoryBox").innerHTML =
    buildRulerHTML(metricKey, latestVal, type, unit);

  document.getElementById("compHistoryList").innerHTML = last5
    .map((item) => {
      const dt = item.date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const valStr =
        type === "dec2" ? formatDec2(item.val) : formatDec1(item.val);
      return `
                <div class="comp-list-item">
                    <span style="color: #8b949e;">${dt}</span>
                    <span style="font-weight: 700; color: #3fb950;">${valStr}${unit}</span>
                </div>
            `;
    })
    .join("");

  document.getElementById("metricCompareModal").classList.add("active");
  window.scrollTo(0, 0);
}

function closeMetricCompareModal() {
  document
    .getElementById("metricCompareModal")
    .classList.remove("active");
  window.scrollTo(0, 0);
}

function openMetricAdviceModal(metricKey) {
  const advice = metricAdvice[metricKey];
  if (!advice) return;
  document.getElementById("metricAdviceTitle").innerText = `🍄 ${advice.title}`;
  document.getElementById("metricAdviceContent").innerText = advice.text;
  document.getElementById("metricAdviceModal").classList.add("active");
}

function closeMetricAdviceModal() {
  document.getElementById("metricAdviceModal").classList.remove("active");
}

/* GRÁFICO SVG */
function renderSvgChart(points, type, unit) {
  if (points.length < 2)
    return `<div style="padding: 1rem 0; font-size: 0.8rem; color: #8b949e; text-align: center;">Mínimo de 2 pesagens para o gráfico.</div>`;

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

  let svg = `<svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: auto; overflow: visible;">
            <defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#3fb950" flood-opacity="0.5"/></filter></defs>
            <polyline fill="none" stroke="#3fb950" stroke-width="3" points="${pointsStr}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
        `;

  coords.forEach((c) => {
    const valFormatted =
      type === "dec2" ? formatDec2(c.val) : formatDec1(c.val);
    svg += `
                <circle cx="${c.x}" cy="${c.y}" r="4" fill="#3fb950" stroke="#161b22" stroke-width="2"/>
                <text x="${c.x}" y="${c.y - 8}" fill="#f0f6fc" font-size="10" font-weight="800" text-anchor="middle">${valFormatted}${unit}</text>
            `;
  });
  svg += `</svg>`;
  return svg;
}

/* REORDENAÇÃO DA BALANÇA */
function openScaleConfigModal() {
  renderScaleConfigList();
  document.getElementById("scaleConfigModal").classList.add("active");
}

function closeScaleConfigModal() {
  document.getElementById("scaleConfigModal").classList.remove("active");
  updateUI();
}

function renderScaleConfigList() {
  document.getElementById("scaleMetricsOrderList").innerHTML =
    healthDb.metricsOrder
      .map(
        (m, idx) => `
            <div class="order-item">
                <div class="order-item-left">
                    <input type="checkbox" id="chk_${m.key}" ${m.active ? "checked" : ""} onchange="toggleMetricActive(${idx}, this.checked)">
                    <label for="chk_${m.key}">${m.label}</label>
                </div>
                <div class="order-btns">
                    <button class="btn-icon" onclick="moveMetric(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ""}>⬆️</button>
                    <button class="btn-icon" onclick="moveMetric(${idx}, 1)" ${idx === healthDb.metricsOrder.length - 1 ? 'disabled style="opacity:0.3;"' : ""}>⬇️</button>
                </div>
            </div>
        `,
      )
      .join("");
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
    latestDisplay.innerHTML = `<span style="font-size: 0.85rem; color: #8b949e;">Nenhuma pesagem cadastrada ainda.</span>`;
    metricsGrid.style.display = "none";
    historyList.innerHTML = `<span style="font-size: 0.8rem; color: #8b949e;">Nenhum registro no histórico.</span>`;
    return;
  }

  // A ordenação in-place mantém a lista cronológica usada tanto pelo
  // registro mais recente quanto pelo histórico, sem ordenar duas vezes.
  const sortedWeighIns = healthDb.weighIns.sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  const latest = sortedWeighIns[0];
  const dateFormatted = new Date(latest.date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  latestDisplay.innerHTML = `
            <div style="font-size: 2.2rem; font-weight: 800; color: #3fb950; letter-spacing: -1px;">${formatDec2(latest.weight)} <span style="font-size: 1rem;">kg</span></div>
            <div style="font-size: 0.75rem; color: #8b949e;">Registrado em: ${dateFormatted} • <b style="color: #58a6ff;">Ver gráfico ›</b></div>
        `;

  let bmiVal = null;
  if (healthDb.height && healthDb.height > 0) {
    const heightM = healthDb.height / 100;
    bmiVal = (latest.weight / (heightM * heightM))
      .toFixed(1)
      .replace(".", ",");
  }

  let activeGridHtml = "";
  if (bmiVal) {
    activeGridHtml += `
                <div class="metric-box clickable" onclick="openMetricCompareModal('bmi', 'IMC', 'dec1', '')">
                    <span class="metric-label">IMC</span>
                    <div class="metric-val" style="color: #c9d1d9;">${bmiVal}</div>
                </div>
            `;
  }

  healthDb.metricsOrder.forEach((m) => {
    if (m.active) {
      const metricLabel = m.label.split(" (")[0];
      let valDisplay = "--";
      if (latest[m.key] !== null && latest[m.key] !== undefined) {
        if (m.type === "dec1") valDisplay = formatDec1(latest[m.key]);
        else if (m.type === "dec2")
          valDisplay = formatDec2(latest[m.key]);
        else valDisplay = latest[m.key];
        valDisplay += m.unit || "";
      }
      activeGridHtml += `
                    <div class="metric-box clickable" onclick="openMetricCompareModal('${m.key}', '${metricLabel}', '${m.type}', '${m.unit || ""}')">
                        <span class="metric-label">${metricLabel}</span>
                        <div class="metric-val" style="color: ${m.color || "#f0f6fc"};">${valDisplay}</div>
                    </div>
                `;
    }
  });

  if (activeGridHtml) {
    metricsGrid.innerHTML = activeGridHtml;
    metricsGrid.style.display = "grid";
  } else {
    metricsGrid.style.display = "none";
  }

  const fatMetric = healthDb.metricsOrder.find((m) => m.key === "fat");
  historyList.innerHTML = sortedWeighIns
    .map((w) => {
      const dt = new Date(w.date).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      return `
                <div class="history-item" onclick="openEditWeighModal(${w.id})">
                    <div>
                        <div class="history-weight">${formatDec2(w.weight)} kg</div>
                        <div class="history-date">${dt} ${w.fat && fatMetric && fatMetric.active ? `• ${formatDec1(w.fat)}% gordura` : ""}</div>
                    </div>
                </div>
            `;
    })
    .join("");
}

/* CRUD DE PESAGEM */
function openAddWeighModal() {
  document.getElementById("weighModalTitle").innerText =
    "⚖️ Registrar Pesagem";
  document.getElementById("editingWeighId").value = "";
  document.getElementById("btnSaveWeigh").innerText = "Salvar Pesagem 🚀";
  document.getElementById("btnDeleteWeigh").style.display = "none";
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("wDate").value = now.toISOString().slice(0, 16);
  document.getElementById("wWeight").value = "";
  renderDynamicFields({});
  document.getElementById("addWeighModal").classList.add("active");
}

function openEditWeighModal(weighId) {
  const entry = healthDb.weighIns.find((w) => w.id === weighId);
  if (!entry) return;
  document.getElementById("weighModalTitle").innerText =
    "✏️ Editar Pesagem";
  document.getElementById("editingWeighId").value = entry.id;
  document.getElementById("btnSaveWeigh").innerText =
    "Salvar Alterações 💾";
  document.getElementById("btnDeleteWeigh").style.display = "block";
  document.getElementById("wDate").value = entry.date;
  document.getElementById("wWeight").value = formatDec2(entry.weight);
  renderDynamicFields(entry);
  document.getElementById("addWeighModal").classList.add("active");
}

function renderDynamicFields(entryData) {
  document.getElementById("dynamicFormFields").innerHTML =
    healthDb.metricsOrder
      .filter((m) => m.active)
      .map((m) => {
        let val = "";
        if (entryData[m.key] !== undefined && entryData[m.key] !== null) {
          if (m.type === "dec1") val = formatDec1(entryData[m.key]);
          else if (m.type === "dec2") val = formatDec2(entryData[m.key]);
          else val = entryData[m.key];
        }
        const maskClass =
          m.type === "dec1"
            ? "toba-mask-dec1"
            : m.type === "dec2"
              ? "toba-mask-dec2"
              : "";
        const inputType = m.type === "int" ? "number" : "text";
        return `
                <div class="form-group">
                    <label for="w_${m.key}">${m.label}</label>
                    <input type="${inputType}" id="w_${m.key}" class="form-control ${maskClass}" placeholder="${m.placeholder || ""}" value="${val}">
                </div>
            `;
      })
      .join("");
  initTobaDecimalMasks();
}

function closeAddWeighModal() {
  document.getElementById("addWeighModal").classList.remove("active");
}

function saveWeighIn(e) {
  e.preventDefault();
  const editingId = document.getElementById("editingWeighId").value;
  const weightVal = parseTobaDecimal(
    document.getElementById("wWeight").value,
  );
  if (!weightVal) {
    showPageMessage("Preencha pelo menos o peso, meu consagrado!", { title: "Faltou o peso" });
    return;
  }

  const entry = {
    id: editingId ? parseInt(editingId, 10) : Date.now(),
    date: document.getElementById("wDate").value,
    weight: weightVal,
  };

  // A gravação percorre todas as métricas configuradas; campos que não
  // existem no formulário (por estarem inativos) acabam salvos como null.
  // Puxa os dados antigos se estivermos editando pra não perder o que tá oculto!
  const existingEntry = editingId ? healthDb.weighIns.find(w => w.id === parseInt(editingId, 10)) : null;

  healthDb.metricsOrder.forEach((m) => {
    const el = document.getElementById(`w_${m.key}`);
    if (el) {
      // O campo tá na tela (métrica ativa)
      if (el.value.trim() !== "") {
        entry[m.key] = (m.type === "dec1" || m.type === "dec2") ? parseTobaDecimal(el.value) : parseInt(el.value, 10) || null;
      } else {
        entry[m.key] = null;
      }
    } else {
      // O campo NÃO tá na tela. Mantém o valor que já tava no banco (se existir)!
      entry[m.key] = existingEntry && existingEntry[m.key] !== undefined ? existingEntry[m.key] : null;
    }
  });

  if (editingId) {
    const idx = healthDb.weighIns.findIndex(
      (w) => w.id === parseInt(editingId, 10),
    );
    if (idx !== -1) healthDb.weighIns[idx] = entry;
  } else {
    healthDb.weighIns.push(entry);
  }

  saveHealthDb();
  closeAddWeighModal();
  updateUI();
}

async function deleteCurrentWeighIn() {
  const editingId = document.getElementById("editingWeighId").value;
  if (!editingId) return;
  const confirmed = await showPageMessage("Tem certeza que deseja apagar este registro de pesagem?", { title: "Excluir pesagem", confirm: true, confirmLabel: "Excluir" });
  if (confirmed) {
    healthDb.weighIns = healthDb.weighIns.filter(
      (w) => w.id !== parseInt(editingId, 10),
    );
    saveHealthDb();
    closeAddWeighModal();
    updateUI();
  }
}

/* ROLDANA & CONFIGS GERAIS */
function openSettingsModal() {
  document.getElementById("settingsMenuModal").classList.add("active");
}

function closeSettingsMenuModal() {
  document.getElementById("settingsMenuModal").classList.remove("active");
}

function openProfileSettingsModal() {
  closeSettingsMenuModal();
  document.getElementById("cfgAge").value = healthDb.age || "";
  document.getElementById("cfgHeight").value = healthDb.height || "";
  document.getElementById("cfgGender").value = healthDb.gender || "";
  document.getElementById("settingsModal").classList.add("active");
}

function openScaleSettingsFromMenu() {
  closeSettingsMenuModal();
  openScaleConfigModal();
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("active");
}

function saveSettings() {
  healthDb.age =
    parseInt(document.getElementById("cfgAge").value) || null;
  healthDb.height =
    parseInt(document.getElementById("cfgHeight").value) || null;
  healthDb.gender = document.getElementById("cfgGender").value || null;
  saveHealthDb();
  closeSettingsModal();
  updateUI();
  showPageMessage("Perfil salvo com sucesso! (⁠⁠👍⁠￣⁠🏽⁠￣⁠)⁠👍", { title: "Perfil atualizado" });
}

/* A tela de Pesagem é a única do módulo: o ⚙️ abre o menu de configurações. */
function openDataModalFromMenu() {
  closeSettingsMenuModal();
  openDataModal();
}

function onHealthDataReplaced() {
  closeSettingsModal();
  updateUI();
}

initTobaDecimalMasks();
updateUI();
