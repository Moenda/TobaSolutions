# Graph Report - TobaSolutions  (2026-11-24)

## Corpus Check
- 156 files · ~454,517 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 62 file(s) not represented in the graph (top: .css 30, .xml 28, .properties 2)
- WARNING: 62 of 218 files seen (28%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 4203 nodes · 9814 edges · 144 communities (124 shown, 20 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 764 edges (avg confidence: 0.84)
- Token cost: 1,575,966 input · 0 output

## Community Hubs (Navigation)
- Investimentos Charts
- Treino Raio-X
- Toba Places Lists
- Cloud Sync & Health Core
- Toba Screen UI
- Home & Elastic Workouts
- Strength Training
- Live Workout Session
- Routine Metrics & Tasks
- Pesagem Scale
- Android Auto Screens
- Toba Common Shell
- Amigos Social Page
- Watch Metric Analysis
- GPS Walk Session
- Kitchen Recipe Catalog
- Auto NavEngine
- Recipes Page
- Health Metrics Rules
- Android Services
- Auto Map Renderer
- Sleep Analysis
- Drive Metrics
- TomTom Route API
- MainActivity WebView
- Native Store & Alarms
- TobaBridge JS Interface
- Portal Cards
- Watch Day View
- Agenda 24h
- Health Connect Reader
- Bank Core & Raxador
- Drive Core & Routing
- Task Oneoffs
- Social Vitrine
- CLAUDE.md Architecture
- Watch Engine Core
- Car Session & DriveSync
- Perfil Page
- Monthly Load & Reps
- Routine Page
- Health Connect Types
- Auto Preview & Search
- Auto WebMap Display
- Racing Drive Hub
- Gastos Fixed & Native
- Hourly Stress Data
- Stretch Session
- Drive Destination Picker
- Screen Core Engine
- Auto Map Config
- Player XP Achievements
- Shopping List
- Car Map Bridge
- Watch Inbox & Merge
- Kitchen Teas
- Places Leaflet Map
- Auto Main Screen
- Drive Game Mode
- Routine Day Plan
- Native Voice TTS
- Auto Preferences Store
- Monthly Hall Pages
- Treinos Watch Sync
- New App Template
- Weekly Meal Plan
- Samsung Health SDK
- Native Notifications
- Hall Shared Math
- Calories Analysis
- Drive Trip Lifecycle
- Health Connect Responses
- Profile Hall of Heroes
- Android & Drive Features
- Fuel Log
- Turism Metrics
- Portal & PWA Register
- Gastos Month Budget
- Day Score (Nota)
- Watch Day List
- Watch Records Hall
- Drive 3D Car Models
- Player XP Engine
- Calendar Page
- Routine Alerts
- Screen Usage Reader
- Saitama Live Session
- Kitchen Hub Pages
- Pending Purchases
- Steps Analysis
- Watch Connect & Pull
- Samsung CSV Import
- Drive Mapbox Engine
- APK Install Guide
- Routine Events
- Gastos Page Modals
- Scale in Raio-X
- Kitchen Core DB
- 3D Model Primitives
- Turism Core DB
- Auto Maneuvers
- Toba Maps Tiles
- Workout Features Notes
- Auto Radar Alerts
- Drive External Apps
- Routine Core DB
- Raio-X Features Notes
- Stress Analysis
- Racing Core DB
- Player Utilities
- Raio-X Page
- Auto Map Layers
- Drive Vehicle Skins
- Drive Places & GPS
- Drive Hub Favorites
- Player Look & Rewards
- Bank Features Notes
- Watch Goals
- Racing Hub Page
- Auto Route Prep
- Purchase Parser
- Workout Route Reader
- Wheel Picker
- Player Levels & Seasons
- Service Worker
- Watch Gone Handling
- Auto HUD Render
- Drive Navigation Loop
- Rotina Page Sheets
- Category Picker
- Watch Manual Km
- Pending Launch Flow
- Auto Live Traffic
- Drive Auto Page
- Apple Touch Icon
- PWA Icon 192
- PWA Icon 512
- Maskable Icon
- Launcher Icon xxhdpi
- Launcher Icon xxxhdpi

## God Nodes (most connected - your core abstractions)
1. `NavEngine` - 74 edges
2. `TobaBridge` - 52 edges
3. `Toba Drive` - 51 edges
4. `TobaHealth Treinos page` - 46 edges
5. `CLAUDE.md project guide` - 45 edges
6. `MainActivity` - 44 edges
7. `CarMap` - 43 edges
8. `Toba Tourism - Toba Places` - 43 edges
9. `MapRenderer` - 42 edges
10. `Route` - 40 edges

## Surprising Connections (you probably didn't know these)
- `App Android (TobaAndroid APK) - v1.34` --conceptually_related_to--> `routineAbsorbNativeDone()`  [INFERRED]
  PATCH-NOTES.md → TobaRoutine/js/routine-metrics.js
- `Risquinho do ritmo do orcamento - v2.07` --references--> `calcBankMonthSummary()`  [EXTRACTED]
  PATCH-NOTES.md → TobaBank/js/bank-metrics.js
- `samsungModal (Historico do Samsung Health, import de CSV)` --references--> `samsungGo()`  [INFERRED]
  TobaHealth/TobaHealth-Relogio.html → TobaHealth/js/relogio-samsung.js
- `liveFinishModal (Finalizar treino, mesclar com relogio, salvar modelo)` --references--> `finishLiveSession()`  [INFERRED]
  TobaHealth/TobaHealth-Treinos.html → TobaHealth/js/sessao.js
- `Toba Calendar (eventos, dia tomado) - v1.49` --conceptually_related_to--> `routineToggleOccurrence()`  [INFERRED]
  PATCH-NOTES.md → TobaRoutine/js/routine-task-sheet.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Galaxy Watch -> Samsung Health -> Health Connect -> APK -> Raio-X** — patch_notes_health_connect, tobaandroid_app_auto_br_com_toba_app_healthreader, tobahealth_js_relogio, patch_notes_raio_x, patch_notes_samsung_import [EXTRACTED 1.00]
- **Android Auto car map: CarMap/WebMap loads auto-map.js, DriveSync joins phone route** — tobaandroid_app_auto_br_com_toba_auto_carmap, tobaandroid_app_auto_br_com_toba_auto_webmap, tobaracing_tobadrive_js_auto_map, tobaandroid_app_auto_br_com_toba_auto_drivesync, patch_notes_toba_drive [EXTRACTED 1.00]
- **computePlayer recalculates XP/achievements from every app's data** — assets_toba_player_computeplayer, patch_notes_toba_health, patch_notes_toba_routine, patch_notes_toba_kitchen, patch_notes_toba_racing, patch_notes_toba_tourism, patch_notes_toba_drive [INFERRED 0.85]
- **Pages loading toba-player require all *-metrics files** — assets_toba_player, tobahealth_js_health_metrics, tobaroutine_js_routine_metrics, tobakitchen_js_kitchen_recipes, tobaracing_js_racing_metrics, toba_perfil [EXTRACTED 1.00]
- **Pages that publish the social vitrine (need hall-shared)** — index, toba_perfil, toba_amigos, assets_toba_social, tobahealth_js_hall_shared [EXTRACTED 1.00]
- **Automatic purchase flow APK -> queue -> Gastos** — tobaandroid_readme_purchase_listener, tobaandroid_readme_tobastore, tobabank_js_gastos, claude_toba_bank_db [INFERRED 0.85]
- **Toba Bank module pages share bank-core.js and TOBA_BANK_DB** — tobabank_tobabank_gastos, tobabank_tobabank_investimento, tobabank_tobabank_raxador, tobabank_js_bank_core [EXTRACTED 1.00]
- **Watch data flow: Raio-X reads Health Connect, Treinos merges watch workouts via relogio.js** — tobahealth_tobahealth_relogio, tobahealth_tobahealth_treinos, tobahealth_js_relogio, tobahealth_js_treinos_relogio [INFERRED 0.85]
- **Treinos loads every *-metrics.js before toba-player.js for consistent XP** — tobahealth_js_health_metrics, tobaroutine_js_routine_metrics, tobakitchen_js_kitchen_recipes, tobaracing_js_racing_metrics, tobaturism_js_turism_metrics, tobaracing_tobadrive_js_drive_metrics, assets_toba_player [EXTRACTED 1.00]
- **Pages loading toba-player with all *-metrics.js** — tobakitchen_tobakitchen_receitas, tobakitchen_tobakitchen_semana, tobaracing_tobadrive_tobadrive, tobaracing_tobaracing_combustivel, tobaroutine_tobaroutine_agenda, tobaroutine_tobaroutine_rotina, tobaroutine_tobaroutine_task, tobaturism_tobaturism_places, assets_toba_player [EXTRACTED 1.00]
- **Toba Drive phone + Android Auto car map** — tobaracing_tobadrive_tobadrive, tobaracing_tobadrive_tobadrive_auto, assets_toba_maps, tobaracing_tobadrive_js_auto_map, tobaracing_tobadrive_js_drive_map [INFERRED 0.85]
- **Routine pages with Meu dia fixo (routine-plan.js)** — tobaroutine_tobaroutine_index, tobaroutine_tobaroutine_agenda, tobaroutine_tobaroutine_calendar, tobaroutine_tobaroutine_rotina, tobaroutine_tobaroutine_task, tobaroutine_js_routine_plan [EXTRACTED 1.00]

## Communities (144 total, 20 thin omitted)

### Community 0 - "Investimentos Charts"
Cohesion: 0.05
Nodes (105): Chart.js 4.4.7 (jsdelivr), addMonthsIso(), applyFinishedListState(), baseChartOptions(), calcFinishIrPreview(), calcMonthlyYields(), changeChartMode(), changeChartPeriod() (+97 more)

### Community 1 - "Treino Raio-X"
Cohesion: 0.05
Nodes (94): decodeWalkTrackSafe(), renderWorkoutRaioX(), trx, TRX_CMP_WORDS, TRX_FAMILY, TRX_FAMILY_NAME, TRX_HELP, TRX_LOAD_GUESS (+86 more)

### Community 2 - "Toba Places Lists"
Cohesion: 0.05
Nodes (93): Folha ir por outro app (Maps/Waze), Folha lugares de uma lista do Toba Places, addReviewChip(), applyParsed(), backToLists(), chipHtml(), cycleListEmoji(), deleteList() (+85 more)

### Community 3 - "Cloud Sync & Health Core"
Cohesion: 0.05
Nodes (86): ensureTobaCloudUi(), TOBA_CLOUD, TOBA_CLOUD_ASK, TOBA_CLOUD_KEY_SET, TOBA_CLOUD_KEYS, TOBA_FIREBASE_CONFIG, tobaCloudAddPassword(), tobaCloudAgo() (+78 more)

### Community 4 - "Toba Screen UI"
Cohesion: 0.08
Nodes (77): onHealthDataReplaced(), openScreenGoal(), renderScrApp(), renderScreen(), renderScreenConnect(), renderScreenDayNav(), renderScreenGoal(), renderScreenSyncLine() (+69 more)

### Community 5 - "Home & Elastic Workouts"
Cohesion: 0.06
Nodes (75): describeHomeLive(), ELASTIC_DEFAULT_ORDER, elasticAtLevel(), elasticBandLabel(), elasticChip(), elasticCycleIntro(), elasticDayHint(), elasticKg() (+67 more)

### Community 6 - "Strength Training"
Cohesion: 0.05
Nodes (76): closeStrengthSummary(), deleteStrengthRoutine(), describeBestSet(), describeExerciseLoad(), describeStrengthSets(), getBestStrengthSet(), getExerciseLoad(), getLastStrengthSets() (+68 more)

### Community 7 - "Live Workout Session"
Cohesion: 0.06
Nodes (74): buildLiveWorkoutExercises(), clampLiveKg(), clampLiveReps(), destroyLiveWheels(), discardLiveSession(), dropLiveSession(), endLiveRest(), finishLiveSession() (+66 more)

### Community 8 - "Routine Metrics & Tasks"
Cohesion: 0.07
Nodes (70): Deslizar atrasada pra la (skipped) - v1.47, Agenda 24h (Dia/Semana) - v1.46, Toba Calendar (eventos, dia tomado) - v1.49, Toba Routine (Rotina, Task, Agenda, Calendar) - v1.41, Task (tarefas nao rotineiras com sugestao de dia) - v1.42, calcRoutineDayAgenda(), calcRoutineDayLoad(), calcRoutinePlayer() (+62 more)

### Community 9 - "Pesagem Scale"
Cohesion: 0.06
Nodes (61): buildRulerHTML(), buildTrendVerdict(), calcTrend(), chartTitleFor(), closeMetricCompare(), collectMetricPoints(), COMPARE_PERIODS, compareState (+53 more)

### Community 10 - "Android Auto Screens"
Cohesion: 0.06
Nodes (4): Rota junta carro <-> celular - v1.78, Viagens do Android Auto no historico - v2.02, FavScreen, RecentScreen

### Community 11 - "Toba Common Shell"
Cohesion: 0.05
Nodes (38): closeDataModal(), closeTobaModal(), ensureTobaSettings(), ensureTobaShell(), getCurrentMonthKey(), initTobaDecimalMasks(), openDataModal(), openTobaModal() (+30 more)

### Community 12 - "Amigos Social Page"
Cohesion: 0.09
Nodes (56): AM, AM_DUEL_MODULES, AM_HELP, AM_TIER_ICON, AM_TIER_ORDER, amAccept(), amAchList(), amAddSubmit() (+48 more)

### Community 13 - "Watch Metric Analysis"
Cohesion: 0.08
Nodes (50): openWatchMetric(), renderWatchMetric(), renderWatchMetricDay(), WATCH_METRICS, WATCH_MONTHS_LONG, WATCH_MONTHS_SHORT, WATCH_PERIODS, WATCH_WEEKDAYS (+42 more)

### Community 14 - "GPS Walk Session"
Cohesion: 0.08
Nodes (49): decodeWalkPolyline(), decodeWalkTrack(), encodeWalkPolyline(), encodeWalkTrack(), estimateWalkKcal(), fillWalkForm(), formatWalkPace(), getWalkChips() (+41 more)

### Community 15 - "Kitchen Recipe Catalog"
Cohesion: 0.06
Nodes (50): calcKitchenPlayer(), calcKitchenSummary(), KITCHEN_AISLES, KITCHEN_AUTHORS, KITCHEN_INGREDIENTS, KITCHEN_MEALS, KITCHEN_RECIPES, KITCHEN_SHOP_ITEMS (+42 more)

### Community 16 - "Auto NavEngine"
Cohesion: 0.08
Nodes (9): NavEngine, RoutesCallback, Listener, NavigationManagerCallback, RouteCallback, State, ARRIVED, IDLE (+1 more)

### Community 17 - "Recipes Page"
Cohesion: 0.10
Nodes (52): addToPlan(), clearPantry(), cookedNow(), cookGoto(), cookNext(), cookPrev(), cookTick(), cookTimerLeft() (+44 more)

### Community 18 - "Health Metrics Rules"
Cohesion: 0.07
Nodes (47): BODYWEIGHT_FIELDS, buildHomeSteps(), buildStretchSteps(), calcBodyWeightOn(), calcElasticLift(), calcExerciseEffort(), calcExerciseLoad(), calcHomeMuscleItems() (+39 more)

### Community 20 - "Auto Map Renderer"
Cohesion: 0.09
Nodes (3): Geo, MapRenderer, OnImage

### Community 21 - "Sleep Analysis"
Cohesion: 0.11
Nodes (48): renderWatchSleepDay(), watchSleepAfterRender(), watchSleepBarTap(), watchSleepMini(), watchSleepPeriodExtras(), watchSleepScrub(), watchSleepStackChart(), WSL_HELP (+40 more)

### Community 22 - "Drive Metrics"
Cohesion: 0.06
Nodes (36): calcDrivePlayer(), calcDriveSummary(), DRIVE_ARROWS, DRIVE_COPILOT_LINES, DRIVE_OSRM_SIDE, DRIVE_ROUTE_COLORS, DRIVE_SPEEDOS, DRIVE_TOMTOM_TYPES (+28 more)

### Community 23 - "TomTom Route API"
Cohesion: 0.10
Nodes (6): Place, Route, Lanes, TobaApi, HttpError, RoadInfo

### Community 24 - "MainActivity WebView"
Cohesion: 0.09
Nodes (3): MainActivity, WebChromeClient, LocationListener

### Community 25 - "Native Store & Alarms"
Cohesion: 0.10
Nodes (3): Alarms, PurchaseListener, TobaStore

### Community 27 - "Portal Cards"
Cohesion: 0.08
Nodes (42): applyPortalCards(), BANK_CARD_DEFAULTS, buildHealthTile(), buildRoutineTile(), fillBankCardForm(), fillHealthCardForm(), fillRoutineCardForm(), formatDaysAgo() (+34 more)

### Community 28 - "Watch Day View"
Cohesion: 0.10
Nodes (42): openWatchHelp(), renderWatchBody(), renderWatchCloba(), renderWatchDayNav(), renderWatchSleep(), renderWatchToday(), renderWatchTrend(), renderWatchWeek() (+34 more)

### Community 29 - "Agenda 24h"
Cohesion: 0.09
Nodes (42): AGENDA_HOUR_PX, AGENDA_KIND_LABEL, AGENDA_MIN_EVENT, AGENDA_TASK_STATUS, agendaClock(), agendaDayName(), agendaEditTask(), agendaFreeGaps() (+34 more)

### Community 31 - "Bank Core & Raxador"
Cohesion: 0.07
Nodes (33): BANK_CATEGORIES, BANK_CATEGORY_GROUPS, BANK_CATEGORY_MIGRATION, db, loadDatabase(), migrateBankCategories(), onBankDataSaved(), saveDatabase() (+25 more)

### Community 32 - "Drive Core & Routing"
Cohesion: 0.10
Nodes (38): createEmptyDriveDb(), driveAddTrip(), driveDb, driveImportAutoTrips(), driveNewId(), driveNum(), driveRememberRecent(), driveValidPoint() (+30 more)

### Community 33 - "Task Oneoffs"
Cohesion: 0.10
Nodes (40): activeOneoffs(), addManualSession(), deleteOneoff(), fillOneoffTime(), finishOneoff(), guessOneoff(), ONEOFF_CHUNKS, ONEOFF_EMOJI_PICKS (+32 more)

### Community 34 - "Social Vitrine"
Cohesion: 0.13
Nodes (37): SOCIAL_CAT_SECTION, SOCIAL_SECTIONS, SOCIAL_STATS, socialAccept(), socialAddByUsername(), socialAt(), socialBuildVitrine(), socialCleanUsername() (+29 more)

### Community 35 - "CLAUDE.md Architecture"
Cohesion: 0.09
Nodes (27): CLAUDE.md project guide, Achievements (PLAYER_ACHIEVEMENTS ids), TOBA_HEALTH_ACTIVE_SESSION (live workout), Android APK WebView + TobaNative bridge, Android Auto navigation app, Bank category ids + migration (BANK_CATEGORY_GROUPS), Firestore rules, Toba Drive Mapbox 3D map engine (+19 more)

### Community 36 - "Watch Engine Core"
Cohesion: 0.06
Nodes (34): openWatchDiag(), WATCH_DECIMAL_FIELDS, WATCH_DEFAULT_GOALS, WATCH_EX_FAMILY, WATCH_EX_FIELDS, WATCH_EXERCISE_NAMES, WATCH_FAMILY, WATCH_GROUP_LABELS (+26 more)

### Community 37 - "Car Session & DriveSync"
Cohesion: 0.08
Nodes (7): DriveSync, Car, Phone, TobaCarAppService, TobaCarSession, DefaultLifecycleObserver, NavEngine.RouteCallback

### Community 38 - "Perfil Page"
Cohesion: 0.10
Nodes (33): equipReward(), fillProfileSettings(), formatProfileDate(), hideProfileHow(), openAchievement(), openCustomize(), openSeason(), PLAYER_EVENT_KINDS (+25 more)

### Community 39 - "Monthly Load & Reps"
Cohesion: 0.15
Nodes (37): renderLoadMonthPage(), renderRepsMonthPage(), TMES_CATS, TMES_DAY_LONG, TMES_STATUS, tmesAddDays(), tmesCatOf(), tmesChartHtml() (+29 more)

### Community 40 - "Routine Page"
Cohesion: 0.11
Nodes (36): activeRoutineTasks(), addSuggestions(), describeRoutineDay(), describeRoutineWhen(), doSituational(), enableRoutineNotify(), endRoutineSwipe(), fillRoutineSettings() (+28 more)

### Community 43 - "Auto Preview & Search"
Cohesion: 0.10
Nodes (5): PreviewScreen, NavEngine.RoutesCallback, DefaultLifecycleObserver, SearchScreen, DefaultLifecycleObserver

### Community 44 - "Auto WebMap Display"
Cohesion: 0.10
Nodes (4): WebViewClient, WebMap, WebViewClient, Host

### Community 45 - "Racing Drive Hub"
Cohesion: 0.10
Nodes (34): addDriveFavHere(), DRIVE_HUB_FAV_EMOJIS, DRIVE_HUB_MONTHS, DRIVE_HUB_WEEK, driveHub, driveHubAddMonths(), driveHubDayLabel(), driveHubFilterTrips() (+26 more)

### Community 46 - "Gastos Fixed & Native"
Cohesion: 0.07
Nodes (19): AUTO_CATEGORY_HINTS, getEffectiveDaysInMonth(), historyCategoryFilter, nativePending, openExpenseModal(), openGastosSettings(), openSobraHelp(), PENDING_PARCEL_CHOICES (+11 more)

### Community 47 - "Hourly Stress Data"
Cohesion: 0.10
Nodes (25): WX_WEEKDAYS, WX_WEEKDAYS_LONG, wxAnyHours(), wxArr(), wxAvg(), wxBlocked(), wxBreath, wxBreathClose() (+17 more)

### Community 48 - "Stretch Session"
Cohesion: 0.13
Nodes (27): describeStretchLive(), estimateStretchKcal(), normalizeStretchLive(), readStretchPrefs(), renderStretchDone(), renderStretchLive(), renderStretchWorkoutDetail(), saveStretchLive() (+19 more)

### Community 49 - "Drive Destination Picker"
Cohesion: 0.11
Nodes (32): cancelFavMode(), chip(), clearRecent(), deleteFav(), doneTimeLine(), DRIVE_ARRIVE_JOKES, DRIVE_FAV_EMOJIS, driveAutoNavigating() (+24 more)

### Community 50 - "Screen Core Engine"
Cohesion: 0.12
Nodes (31): SCREEN_ANDROID_CATS, SCREEN_CATS, SCREEN_GOALS, SCREEN_KINDS, SCREEN_LIMITS, SCREEN_PKG_HINTS, screenAddDays(), screenAppInfo() (+23 more)

### Community 51 - "Auto Map Config"
Cohesion: 0.09
Nodes (30): am, AM_CARDINAL, AM_HUNDREDS, AM_JAM_COLORS, AM_JOKES, AM_LANE_ANG, AM_LIVE_LVL, AM_OVERPASS (+22 more)

### Community 52 - "Player XP Achievements"
Cohesion: 0.07
Nodes (25): buildPlayerAchievements(), buildPlayerCrowdAchievements(), createEmptyPlayerDb(), loadPlayerDb(), normalizePlayerDb(), PLAYER_ACHIEVEMENT_CATS, PLAYER_ACHIEVEMENTS, PLAYER_AVATARS (+17 more)

### Community 53 - "Shopping List"
Cohesion: 0.14
Nodes (30): addExtra(), addOther(), clearBoughtExtras(), copyShopping(), extraForItem(), findExtra(), isItemChecked(), KITCHEN_AISLE_HINTS (+22 more)

### Community 55 - "Watch Inbox & Merge"
Cohesion: 0.16
Nodes (30): onHealthDataReplaced(), openWatchIgnored(), renderWatch(), renderWatchInbox(), watchAutoMerge(), watchCandidates(), watchClock(), watchCreateEx() (+22 more)

### Community 56 - "Kitchen Teas"
Cohesion: 0.14
Nodes (28): Chas (blends por partes) - v1.96, Lista de compras (Escolher por chip) - v1.53/v1.54, Modo cozinha com timer - v1.43, Toba Kitchen (Receitas, Semana, Compras, Chas) - v1.43, addTeaOther(), editTea(), newTea(), openTea() (+20 more)

### Community 57 - "Places Leaflet Map"
Cohesion: 0.15
Nodes (25): drawPlacesMap(), loadTurismLeaflet(), mapFindAll(), mapPinPlace(), mapToggleStyle(), onPlacesMapClick(), placesMap, renderPlacesMap() (+17 more)

### Community 58 - "Auto Main Screen"
Cohesion: 0.11
Nodes (3): HomeScreen, DefaultLifecycleObserver, RoutesCallback

### Community 59 - "Drive Game Mode"
Cohesion: 0.14
Nodes (20): drawTripCard(), game, gameApplyView(), gameBubble(), gameEffectiveStyle(), gameFollowHeading(), gameJoke(), gameLoadRadars() (+12 more)

### Community 60 - "Routine Day Plan"
Cohesion: 0.12
Nodes (25): dayPlanAddBlock(), dayPlanPreview(), dayPlanRemoveBlock(), describeOneoffDay(), ensureDayPlanSheet(), findRoutineOneoff(), floatOneoffXp(), openDayPlan() (+17 more)

### Community 63 - "Monthly Hall Pages"
Cohesion: 0.16
Nodes (23): closeWorkoutDetail(), compareBadge(), compareRatio(), eqCard(), eqChallenge(), eqCompareRow(), eqSamePointNote(), eqSummary() (+15 more)

### Community 64 - "Treinos Watch Sync"
Cohesion: 0.09
Nodes (24): renderTrainingWatch(), trainingWatchPendingCount(), trainingWatchSync(), watchPageRefresh(), viewWatchMain (dia escolhido: hoje, Cloba, sono, corpo, balanca, semana, tendencia, mes a mes), TobaHealth Treinos page, exerciseLoadModal (Tipo de carga total/por halter/unilateral), homeHelpModal (Treino em casa) (+16 more)

### Community 65 - "New App Template"
Cohesion: 0.14
Nodes (17): _molde-app README (new app template), Copy-and-fill steps for a new app, TobaMolde-Index.html (molde hub), TobaMolde-Modulo.html (molde module), _molde-app template for new apps, deleteItem(), onMoldeDataReplaced(), renderItems() (+9 more)

### Community 66 - "Weekly Meal Plan"
Cohesion: 0.20
Nodes (22): addEntry(), copyLastWeek(), entryDone(), findEntry(), KITCHEN_WEEK_NAMES, mealOrder(), onKitchenDataReplaced(), openEntry() (+14 more)

### Community 68 - "Native Notifications"
Cohesion: 0.16
Nodes (3): AlarmReceiver, BootReceiver, Notifier

### Community 69 - "Hall Shared Math"
Cohesion: 0.13
Nodes (18): calcMuscleHeat(), calcWorkoutMuscleWork(), CARDIO_MUSCLES, describeMuscleHeat(), describeMuscleTap(), formatHallKg(), formatWorkoutNumber(), getCardioKm() (+10 more)

### Community 70 - "Calories Analysis"
Cohesion: 0.25
Nodes (22): renderWatchKcalDay(), WCA_FOODS, WCA_M, wcaClobaLines(), wcaDayTiles(), wcaFoodCard(), wcaFoodLine(), wcaGoal() (+14 more)

### Community 71 - "Drive Trip Lifecycle"
Cohesion: 0.13
Nodes (23): arrive(), arriveHere(), chooseOnMap(), clearActiveTrip(), closeActiveTrip(), driveArriveJoke(), driveAutoShare(), driveFollowAuto() (+15 more)

### Community 72 - "Health Connect Responses"
Cohesion: 0.13
Nodes (5): OutcomeReceiver<List<AggregateRecordsGroupedByPeriodResponse<T>>, HealthConnectException>, OutcomeReceiver<List<AggregateRecordsGroupedByDurationResponse<T>>, HealthConnectException>, OutcomeReceiver<AggregateRecordsResponse<T>, HealthConnectException>, OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>, OutcomeReceiver<AggregateRecordsResponse<Length>, HealthConnectException>

### Community 73 - "Profile Hall of Heroes"
Cohesion: 0.21
Nodes (19): animateHall(), HALL_PAGES, hallBar(), hallCount(), hallFoodPick(), hallFormat(), hallHero(), hallReducedMotion() (+11 more)

### Community 74 - "Android & Drive Features"
Cohesion: 0.13
Nodes (20): App Android (TobaAndroid APK) - v1.34, Toba no Android Auto - v1.75 (APK 1.4), Caminhada/Corrida ao vivo com GPS - v1.84, Cloba copiloto (piadas na voz), Cloba fantasma (amigo de mentira) - v1.62, Conta Toba / nuvem Firebase - v1.59, Combustivel e km/l de tanque cheio a tanque cheio - v1.51, Toba Patch Notes (PATCH-NOTES.md) (+12 more)

### Community 75 - "Fuel Log"
Cohesion: 0.16
Nodes (21): deleteFueling(), fuelNeighbors(), fuelShortDate(), onFuelCalcInput(), onRacingDataReplaced(), openFuelSheet(), readFuelNumber(), renderFuelChart() (+13 more)

### Community 76 - "Turism Metrics"
Cohesion: 0.12
Nodes (15): calcTurismPlayer(), calcTurismSummary(), TURISM_AGAIN, TURISM_KIND_GROUPS, TURISM_KINDS, TURISM_RATINGS, TURISM_TAGS, TURISM_VALUES (+7 more)

### Community 77 - "Portal & PWA Register"
Cohesion: 0.19
Nodes (15): Portal index.html, Configurador de cards (#cardsModal), Portal app cards grid (data-id keyed), Toba-Amigos.html (Toba dos amigos), Toba-Perfil.html (Perfil do jogador), calcRacingAverage(), calcRacingPlayer(), calcRacingSegments() (+7 more)

### Community 78 - "Gastos Month Budget"
Cohesion: 0.15
Nodes (21): filterExpenseCategory(), filterHistoryCategory(), getActiveInstallmentsForMonth(), getFixedExpensesForMonth(), getFixedTotalForMonth(), installmentItemHtml(), onBankDataSaved(), refreshHistoryMonth() (+13 more)

### Community 79 - "Day Score (Nota)"
Cohesion: 0.21
Nodes (19): renderWatchNotaDay(), WND_PARTS, WND_ZONES, wndCache, wndCompare(), wndCompareHtml(), wndFmtVal(), wndGrade() (+11 more)

### Community 80 - "Watch Day List"
Cohesion: 0.16
Nodes (21): openWatchDay(), renderWatchList(), watchAddDays(), watchAvgBefore(), watchDay(), watchDayLabel(), watchDayRow(), watchDays() (+13 more)

### Community 81 - "Watch Records Hall"
Cohesion: 0.17
Nodes (17): openWatchRecords(), renderWatchRecords(), WATCH_MEDALS, WATCH_REC_SCOPES, WATCH_RECORDS, watchRec, watchRecAgo(), watchRecBlocks() (+9 more)

### Community 82 - "Drive 3D Car Models"
Cohesion: 0.15
Nodes (20): DM_BLACK, DM_GLASS, DM_HEAD, DM_TAIL, DM_TIRE, DM_WHITE, dmExtrude(), dmNormal() (+12 more)

### Community 83 - "Player XP Engine"
Cohesion: 0.14
Nodes (20): calcPlayerStreak(), calcPlayerWorkoutXp(), calcSocialPlayer(), computePlayer(), isPlayerSeasonShown(), playerAddDays(), playerBestSet(), playerDaysBetween() (+12 more)

### Community 84 - "Calendar Page"
Cohesion: 0.23
Nodes (18): bindCalendarSwipe(), calendarAddMonths(), calendarEventMeta(), calendarMonthLabel(), calendarMonthStep(), calendarShortDate(), calendarState, calendarToday() (+10 more)

### Community 85 - "Routine Alerts"
Cohesion: 0.15
Nodes (18): buildRoutineAlerts(), readRoutineDbRaw(), ROUTINE_AGENDA_URL, ROUTINE_DONE_LINES, ROUTINE_EVENT_LINES, ROUTINE_NAG_LINES, ROUTINE_NAG_STEPS, ROUTINE_NAG_TITLES (+10 more)

### Community 86 - "Screen Usage Reader"
Cohesion: 0.22
Nodes (4): ScreenReader, Day, Done, Session

### Community 87 - "Saitama Live Session"
Cohesion: 0.15
Nodes (13): clampSaitamaCount(), describeSaitamaLive(), finishSaitamaLiveSession(), formatSaitamaLiveTime(), getSaitamaLiveTotal(), normalizeSaitamaLive(), renderSaitamaLive(), SAITAMA_LIVE_FIELDS (+5 more)

### Community 88 - "Kitchen Hub Pages"
Cohesion: 0.11
Nodes (19): deleteTea(), openShopping(), Toba Kitchen Hub, Modulos do Kitchen (Receitas, Semana, Compras), Seu placar (receitas feitas), renderKitchenHub (script inline), Toba Kitchen - Receitas, Folha de ingredientes do modo cozinha (+11 more)

### Community 89 - "Pending Purchases"
Cohesion: 0.16
Nodes (18): editPendingName(), findPendingTwin(), guessExpenseCategory(), guessPendingParcels(), launchPending(), morePendingCategories(), pendingAlreadySaved(), pendingParcelHtml() (+10 more)

### Community 90 - "Steps Analysis"
Cohesion: 0.27
Nodes (17): renderWatchStepsDay(), WPS_DAYS, WPS_DAYS_LONG, wpsAvg(), wpsClobaLines(), wpsHero(), wpsMonday(), wpsMonth() (+9 more)

### Community 91 - "Watch Connect & Pull"
Cohesion: 0.21
Nodes (18): renderWatchConnect(), renderWatchSync(), watchAgo(), watchAsk(), watchAutoPull(), watchCanNative(), watchExplainBrowser(), watchGranted() (+10 more)

### Community 92 - "Samsung CSV Import"
Cohesion: 0.24
Nodes (17): openSamsungImport(), renderSamsungPicked(), SAMSUNG_EX_TYPES, SAMSUNG_FILES, samsungApply(), samsungCol(), samsungCsvRows(), samsungDayOf() (+9 more)

### Community 93 - "Drive Mapbox Engine"
Cohesion: 0.15
Nodes (14): DRIVE_BEAM_LOOKS, DRIVE_LIGHTS, DRIVE_RT_LEVEL, DRIVE_RT_NAME, DRIVE_TRAFFIC_CITY_WIDTH, DRIVE_TRAFFIC_COLORS, DRIVE_TRAFFIC_WIDTH, driveCreateMap() (+6 more)

### Community 95 - "APK Install Guide"
Cohesion: 0.13
Nodes (12): INSTALAR.md (install APK via adb), Battery: unrestricted, Allow restricted settings for notification access, TobaAndroid README (APK), Alarms/AlarmReceiver/BootReceiver (reminders, rest, routine alerts), Android Auto package br.com.toba.auto (CarAppService, NavEngine, MapRenderer, TobaApi), DHU desktop head unit testing, MainActivity.java (WebView, ACTION_SEND share) (+4 more)

### Community 96 - "Routine Events"
Cohesion: 0.20
Nodes (12): deleteRoutineEvent(), ensureEventSheet(), eventStartChanged(), findRoutineEvent(), newRoutineEventId(), openEventSheet(), readEventForm(), ROUTINE_EVENT_EMOJI_PICKS (+4 more)

### Community 97 - "Gastos Page Modals"
Cohesion: 0.13
Nodes (16): launchAllPending(), saveExpense(), TobaBank Gastos page, editFixedModal (Gasto fixo), editInstallmentModal, expenseModal (Novo gasto / parcelado), Hero card: sobra prevista + ritmo do orcamento, modalSobra (Como calculamos a sobra) (+8 more)

### Community 98 - "Scale in Raio-X"
Cohesion: 0.27
Nodes (15): renderWatchScale(), scaleTotal(), WATCH_SCALE_TILES, watchBasalSource(), watchHealthBmrOf(), watchPickBasalSource(), watchScaleBasalPicker(), watchScaleBmrAt() (+7 more)

### Community 99 - "Kitchen Core DB"
Cohesion: 0.23
Nodes (11): createEmptyKitchenDb(), importKitchenBackup(), kitchenDb, kitchenMarkCooked(), kitchenNewId(), kitchenUndoCooked(), loadKitchenDb(), normalizeKitchenDb() (+3 more)

### Community 100 - "3D Model Primitives"
Cohesion: 0.33
Nodes (16): dmBoth(), dmBox(), dmFourWheels(), dmLights(), dmWheel(), driveHexRgb(), driveModelBusao(), driveModelCarro() (+8 more)

### Community 101 - "Turism Core DB"
Cohesion: 0.19
Nodes (12): createEmptyTurismDb(), importTurismBackup(), loadTurismDb(), normalizeTurismDb(), onTurismDataReplaced(), resetTurismData(), saveTurismDb(), turismDb (+4 more)

### Community 103 - "Toba Maps Tiles"
Cohesion: 0.29
Nodes (14): TOBA_CARTO_STYLES, TOBA_TOMTOM_STYLES, tobaBaseTiles(), tobaCartoTilesUrl(), tobaTomTomCanRoute(), tobaTomTomCountRoute(), tobaTomTomOff(), tobaTomTomOn() (+6 more)

### Community 104 - "Workout Features Notes"
Cohesion: 0.16
Nodes (15): Alongamento 10/20 min - v1.84, Km da bike ergometrica - v2.09, Carga do mes semana a semana - v2.12, Treinos com elastico - v2.06, Paradas no caminho / Juntar e Separar viagens - v2.05, Mapa de calor dos musculos - v1.30, Peso levantado (inclui peso do corpo) - v1.23, Raio-X do treino (carga, zonas, VO2) - v2.10 (APK 3.3) (+7 more)

### Community 105 - "Auto Radar Alerts"
Cohesion: 0.16
Nodes (15): amAngle(), amBearing(), amRadarBox(), amRadarCache(), amRadarCheck(), amRadarDirs(), amRadarDraw(), amRadarFits() (+7 more)

### Community 106 - "Drive External Apps"
Cohesion: 0.13
Nodes (15): openGoogleMaps(), openOut(), openWaze(), prefChange(), recenter(), toggleVoice(), Toba Drive, Balao do Cloba copiloto (+7 more)

### Community 107 - "Routine Core DB"
Cohesion: 0.24
Nodes (13): createEmptyRoutineDb(), importRoutineBackup(), loadRoutineDb(), normalizeRoutineDayPlan(), normalizeRoutineDb(), normalizeRoutineEvents(), normalizeRoutineOneoffs(), onRoutineDataReplaced() (+5 more)

### Community 108 - "Raio-X Features Notes"
Cohesion: 0.15
Nodes (14): Balanca no Raio-X (basal da balanca) - v1.95, Corpo por dentro / RAIO ULTRA X - v1.94, Hall dos Recordes - v1.96, Hora de acordar (despertador) - v2.00, Nota do Dia do Cloba - v2.04, Passos turbinados - v2.01, Pesagem com periodo, tendencia e Papo reto - v1.64/v1.68, Prontidao do Cloba (+6 more)

### Community 109 - "Stress Analysis"
Cohesion: 0.34
Nodes (13): renderWatchStressDay(), wstAvg(), wstBreathCard(), wstClobaLines(), wstHero(), wstHoursCard(), wstIsHr(), wstLinks() (+5 more)

### Community 110 - "Racing Core DB"
Cohesion: 0.25
Nodes (9): createEmptyRacingDb(), importRacingBackup(), loadRacingDb(), normalizeRacingDb(), onRacingDataReplaced(), racingDb, resetRacingData(), saveCar() (+1 more)

### Community 111 - "Player Utilities"
Cohesion: 0.27
Nodes (13): formatPlayerNumber(), getPlayerPrefs(), playerConfetti(), playerOverlayRoot(), playerRandom(), playerVibrate(), playPlayerSound(), rewardsBetween() (+5 more)

### Community 112 - "Raio-X Page"
Cohesion: 0.15
Nodes (13): wxBreathStart(), TobaHealth Raio-X (Relogio) page, samsungModal (Historico do Samsung Health, import de CSV), Raio-X settings extras (metas, diagnostico, permissoes Health Connect, import Samsung), viewWatchMetric (analise de cada quadrado), viewWatchRecords (Hall dos Recordes), watchDayModal, watchDiagModal (Diagnostico do relogio) (+5 more)

### Community 113 - "Auto Map Layers"
Cohesion: 0.23
Nodes (13): amAddLayers(), amAddTraffic(), amApplyLook(), amApplySkin(), amArrowImage(), amEmojiImage(), amLight(), amLightByClock() (+5 more)

### Community 114 - "Drive Vehicle Skins"
Cohesion: 0.29
Nodes (13): currentRouteColor(), currentSpeedo(), currentVehicle(), drawCar(), driveAchievementInfo(), driveStatsNow(), nextVehicle(), openStyleSheet() (+5 more)

### Community 115 - "Drive Places & GPS"
Cohesion: 0.23
Nodes (13): drivePlacePin(), drivePlaceRow(), goPlace(), kmFromHere(), onFix(), onGpsError(), openPlacesList(), readTurismForDrive() (+5 more)

### Community 116 - "Drive Hub Favorites"
Cohesion: 0.36
Nodes (12): deleteDriveFav(), deleteDriveTrip(), driveHubFavs(), driveHubKmText(), driveHubRead(), driveHubTrips(), driveHubWrite(), joinDriveTrip() (+4 more)

### Community 117 - "Player Look & Rewards"
Cohesion: 0.22
Nodes (11): describePlayerWeek(), getPlayerLook(), getPlayerTitles(), isPlayerAchievementHidden(), isPlayerRewardUnlocked(), playerColorStyle(), playerLevelTitle(), renderPlayerAvatar() (+3 more)

### Community 118 - "Bank Features Notes"
Cohesion: 0.27
Nodes (10): Categorias novas do Gastos (ids curtos) - v1.35, Gastos automaticos pelas notificacoes / compras pra aprovar, Investimentos repaginados com previa do IR - v1.70, Livre hoje carrega o estouro de ontem - v1.35, Risquinho do ritmo do orcamento - v2.07, Toba Bank (Gastos, Investimentos, Raxador), calcBankActiveInstallments(), calcBankEffectiveDays() (+2 more)

### Community 119 - "Watch Goals"
Cohesion: 0.22
Nodes (11): openWatchGoals(), renderWatchGoals(), setWatchGoal(), setWatchWake(), watchDb(), watchGoals(), watchGroupExercises(), watchMerge() (+3 more)

### Community 120 - "Racing Hub Page"
Cohesion: 0.18
Nodes (11): addDriveFavSearch(), Folha Favoritar, Toba Racing Hub, Folha novo/editar favorito, Folha favoritos, Folha km mes a mes, Folha viagens, Modulos do Racing (Toba Drive, Combustivel) (+3 more)

### Community 121 - "Auto Route Prep"
Cohesion: 0.29
Nodes (11): amDist(), amEmpty(), amLine(), amPrepRoute(), amSameDest(), amSetAlts(), amSetRouteData(), amShowOverview() (+3 more)

### Community 124 - "Wheel Picker"
Cohesion: 0.44
Nodes (9): escapeHtml(), tobaWheelPicker(), buzz(), goTo(), layout(), makeItem(), onScroll(), paint() (+1 more)

### Community 125 - "Player Levels & Seasons"
Cohesion: 0.29
Nodes (8): markPlayerSeasonVisit(), playerLevelInfo(), playerSeasonsOn(), playerXpToNext(), queuePlayerCelebration(), runPlayerCheck(), savePlayerDb(), tobaPlayerCheck()

### Community 126 - "Service Worker"
Cohesion: 0.29
Nodes (4): Service worker sw.js (PRECACHE/VERSION), PRECACHE, tileFirst(), trimTiles()

### Community 127 - "Watch Gone Handling"
Cohesion: 0.39
Nodes (8): renderWatchGone(), watchEnsureDb(), watchGoneApply(), watchGoneDone(), watchGoneKeep(), watchGoneLinked(), watchGoneList(), watchNoteVanished()

### Community 128 - "Auto HUD Render"
Cohesion: 0.25
Nodes (8): amIcon(), amLaneHtml(), amPlaceRoad(), amRenderBar(), amRenderHud(), amUpdateTrim(), hud(), progress()

### Community 129 - "Drive Navigation Loop"
Cohesion: 0.32
Nodes (8): checkTraffic(), drawRoute(), navTick(), renderNav(), reroute(), routeJamParts(), saveActiveTrip(), speakNext()

### Community 130 - "Rotina Page Sheets"
Cohesion: 0.25
Nodes (8): Folha tarefa da rotina na Agenda, Toba Routine - Rotina, Meu dia fixo (atalho na engrenagem), Avisos e cobrancas, Folha sugestoes de tarefas, Historico, Tarefas, Hoje (tarefas, atrasadas, amanha, situacionais)

### Community 131 - "Category Picker"
Cohesion: 0.48
Nodes (6): buildCategoryPicker(), openCategoryPicker(), openCategoryPickerFor(), pickCategory(), setCategoryField(), showCategoryPicker()

### Community 132 - "Watch Manual Km"
Cohesion: 0.47
Nodes (6): watchKmField(), watchManualKm(), watchManualKmMap(), watchParseKm(), watchSaveManualKm(), watchSetExKm()

### Community 133 - "Pending Launch Flow"
Cohesion: 0.60
Nodes (5): discardPending(), finishPendingLaunch(), openPendingPurchases(), refreshPendingPurchases(), renderPendingCard()

### Community 134 - "Auto Live Traffic"
Cohesion: 0.40
Nodes (5): amHeadDiff(), amLiveSegments(), amLocalXY(), amMatchLiveTraffic(), amSegDist()

### Community 135 - "Drive Auto Page"
Cohesion: 0.40
Nodes (5): Toba Drive Android Auto map, Velocimetro + placa de limite, Chegada (minutos, hora, km, barra), HUD do carro (manobra, faixas, radar, Cloba), Rua atual

### Community 136 - "Apple Touch Icon"
Cohesion: 0.67
Nodes (3): apple-touch-icon.png (Toba app icon: bold black 'T' on rounded-square blue-to-green gradient over dark background), iOS home screen PWA icon, Toba visual identity (T monogram, blue-green gradient, dark theme)

## Knowledge Gaps
- **157 isolated node(s):** `IDLE`, `NAVIGATING`, `ARRIVED`, `Mapa de calor dos musculos - v1.30`, `Investimentos repaginados com previa do IR - v1.70` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 854 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TobaHealth Treinos page` connect `Treinos Watch Sync` to `Treino Raio-X`, `Cloud Sync & Health Core`, `Home & Elastic Workouts`, `Strength Training`, `Live Workout Session`, `Routine Metrics & Tasks`, `Toba Common Shell`, `GPS Walk Session`, `Kitchen Recipe Catalog`, `Health Metrics Rules`, `Drive Metrics`, `Watch Engine Core`, `Monthly Load & Reps`, `Stretch Session`, `Player XP Achievements`, `Monthly Hall Pages`, `Hall Shared Math`, `Turism Metrics`, `Portal & PWA Register`, `Saitama Live Session`, `Toba Maps Tiles`?**
  _High betweenness centrality (0.326) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `TobaBridge` (e.g. with `.askHealthPermissions()` and `.onCreate()`) actually correct?**
  _`TobaBridge` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `IDLE`, `NAVIGATING`, `ARRIVED` to the rest of the system?**
  _157 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Investimentos Charts` be split into smaller, more focused modules?**
  _Cohesion score 0.05157493942540672 - nodes in this community are weakly interconnected._
- **Why does `TobaHealth Raio-X (Relogio) page` connect `Raio-X Page` to `Treinos Watch Sync`, `Scale in Raio-X`, `Cloud Sync & Health Core`, `Watch Engine Core`, `Calories Analysis`, `Toba Common Shell`, `Portal & PWA Register`, `Watch Metric Analysis`, `Hourly Stress Data`, `Day Score (Nota)`, `Watch Records Hall`, `Health Metrics Rules`, `Samsung CSV Import`, `Stress Analysis`, `Sleep Analysis`, `Screen Core Engine`, `Steps Analysis`, `Watch Day View`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `Toba Drive` (e.g. with `arriveHere()` and `cancelFavMode()`) actually correct?**
  _`Toba Drive` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Should `Treino Raio-X` be split into smaller, more focused modules?**
  _Cohesion score 0.05154639175257732 - nodes in this community are weakly interconnected._