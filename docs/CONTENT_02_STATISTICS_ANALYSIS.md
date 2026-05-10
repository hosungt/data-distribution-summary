# 자료의 분포와 요약 콘텐츠 분석 — 발표용

> 분석 대상 커밋: `97a62ce` (main, 2026-05-10 시점)
> 진입점: [index.html](../index.html), [js/main.js](../js/main.js)
> 핵심 모듈 5종 + 설정 모듈 1종(`level-config.js`)
> 외부 의존성: 없음 (LLM/Firebase/네트워크 호출 0건)

---

## A. 한 줄 정의

학생에게 **목표 통계량(평균·표준편차·계급도수·중앙값·최빈값)을 먼저 제시한 뒤, 100개 점의 위치를 직접 옮겨 그 통계량을 만족시키도록 자료를 재구성하게 하는** 단일 페이지 캔버스 콘텐츠.

---

## B. 학습 목표 / 다루는 통계량

### B-1. 코드에서 계산하는 통계량 (모두 [stats-core.js](../js/statistics/stats-core.js))

| 통계량 | 함수 | 위치 | 비고 |
|---|---|---|---|
| 산술평균 | `mean(arr)` | [stats-core.js:11-16](../js/statistics/stats-core.js#L11-L16) | 단순 합/n |
| 중앙값 | `median(arr)` | [stats-core.js:18-24](../js/statistics/stats-core.js#L18-L24) | n 짝수면 두 가운데 값 평균 |
| 최빈값 | `mode(arr)` | [stats-core.js:38-51](../js/statistics/stats-core.js#L38-L51) | **세 가지 분기**: ① 모든 값이 1회 → "없음", ② 모든 값이 동일 빈도 → "없음", ③ 그 외 → 최대 빈도 도달한 모든 값 (다중 가능) |
| 표준편차 | `populationStdev(arr)` | [stats-core.js:64-73](../js/statistics/stats-core.js#L64-L73) | **모표준편차 (분모 n)**. 주석: `// Population standard deviation. Middle-school definition.` — 중학교 교육과정 정의에 맞춤 |
| 계급별 도수 | `frequencyByClass(arr)` | [stats-core.js:93-100](../js/statistics/stats-core.js#L93-L100) | 5개 계급: `[0,5), [5,10), [10,15), [15,20), [20,25]` (마지막만 우측 폐) — [stats-core.js:3-9](../js/statistics/stats-core.js#L3-L9) |

> **수학교육 전문가 청중에게 정확히 전달해야 할 점**: 표준편차는 **분모 n** 인 모표준편차. `n-1` 표본표준편차가 아님. 중학교 수학 교과서 정의와 일치.
> 또한 최빈값이 다중일 수 있고, "모두 동일 빈도면 최빈값 없음" 처리도 교육과정 정의 그대로.

### B-2. 한 라운드에 동시 만족시켜야 하는 조건 (Level별)

[level-config.js:11-75](../js/statistics/level-config.js#L11-L75) — `scoreItems` 배열로 정의:

| Level | scoreItems | 조건 개수 | 추가 제약 |
|---|---|---|---|
| 1 | mean, stdev | 2 | — |
| 2 | mean, stdev, sc(1) | 3 | SC 1구간 도수 |
| 3 | mean, stdev, sc(2) | 4 | SC 2구간 도수 |
| 4 | mean, stdev, sc(2) | 4 | 확정 100회 제한 |
| 5 | + median | 5 | 확정 100회 제한 |
| 6 | + mode | 6 | 확정 100회 제한 |
| 7 | (동일) | 6 | 확정 100회 + 시간 10분 제한 |

조건 조합은 **사전 정의된 표** ([level-config.js](../js/statistics/level-config.js))이며 **동적 생성이 아님**. 다만 각 라운드의 **목표 통계값 자체**는 매번 새로 샘플링됨 (B-3 참조).

### B-3. 목표 자료의 분포 유형

[distribution-sampler.js:11-18](../js/statistics/distribution-sampler.js#L11-L18) — 4가지 분포 유형 A/B/C/D, 가중치 A=0.4, B=C=D=0.2.
- A: 좌우 대칭 산형
- B: 우편향 (오른쪽 치우침)
- C: 약한 우편향
- D: 좌편향
- L1·L2 의 목표는 분포 유형이 아니라 **0~25 정수 균등 무작위 100개** ([distribution-sampler.js:121-127](../js/statistics/distribution-sampler.js#L121-L127))

---

## C. 학생 사용 흐름 — 단계별 코드 동작

### C-1. 콘텐츠 진입 시 초기 상태

**100개 점의 초기 배치는 Level 별로 다르며, 모두 [distribution-sampler.js](../js/statistics/distribution-sampler.js) 의 함수가 책임짐**.

| Level | startType | 초기 배치 | 매 시작마다 다른가? |
|---|---|---|---|
| 1 | `'fixed'` | 1~24 각 4개 + 0·25 각 2개 = 100개 (정확히 동일) — [distribution-sampler.js:131-137](../js/statistics/distribution-sampler.js#L131-L137) | **항상 동일** |
| 2, 3 | `'typed-ghi'` | 유형 G(중앙 산형, 가중치 0.4) / H(양 끝 분리, 0.3) / I(가운데 비움, 0.3) 중 가중 무작위 — [distribution-sampler.js:160-200](../js/statistics/distribution-sampler.js#L160-L200) | **3종 중 1종 무작위** |
| 4 ~ 7 | `'random'` | 0~25 정수 균등 무작위 100개 — [distribution-sampler.js:140-146](../js/statistics/distribution-sampler.js#L140-L146) | **매번 완전 무작위** |

**시드 설정 없음**. `rand = Math.random` 기본값을 그대로 사용 ([game-engine.js:78](../js/statistics/game-engine.js#L78)). 따라서:
- Level 1 은 동일 학생의 재도전 시 **초기 점 배치는 같지만 목표 통계값은 다름** (목표는 매번 무작위 샘플링).
- Level 4~7 은 매 도전마다 **초기 배치·목표 모두 다름**.

**Level 5~7 의 추가 보정**: 목표와 초기 자료의 **median 또는 mode 가 동일하면 최대 200회까지 재샘플링** ([game-engine.js:35-74](../js/statistics/game-engine.js#L35-L74)). 시작 시점의 체감 차이를 보장하기 위함.

### C-2. 학생의 조작

[main.js:563-656](../js/main.js#L563-L656) — 입력 채널 4가지:

1. **포인터(마우스/터치) 클릭으로 점 선택** → `pointerdown` → `hitTestDot` ([dot-graph-render.js:77-92](../js/statistics/dot-graph-render.js#L77-L92), `HIT_R = 14px`)
2. **드래그** → `pointermove` → `columnFromPx` 로 정수 0~25 칸으로 스냅 ([dot-graph-render.js:41-50](../js/statistics/dot-graph-render.js#L41-L50))
3. **좌우 방향키** → 1칸씩 이동 ([main.js:593-598](../js/main.js#L593-L598))
4. **좌우 화살표 버튼** → 1칸씩 이동 ([main.js:590-591](../js/main.js#L590-L591))

**한 번에 한 점만 이동**. `state.selectedPointIdx` 가 단일 정수 ([game-engine.js:101](../js/statistics/game-engine.js#L101)).

**이동 범위**: 가로축은 정수 0~25 (`clampX` — [game-engine.js:138-140](../js/statistics/game-engine.js#L138-L140)). **세로축은 통계적 의미가 없고 같은 칸에 쌓이는 점들의 시각적 스택 위치**일 뿐 ([dot-graph-render.js:36-39](../js/statistics/dot-graph-render.js#L36-L39)). 즉 **점 그래프(도트 플롯)** 형식.

### C-3. 통계량 갱신 시점

**Level 1~3 (즉시 반영 모드)**: 점을 옮긴 매 순간 `computeStats` 호출, `currentStats` 갱신, 화면 즉시 재렌더 — [game-engine.js:150-158](../js/statistics/game-engine.js#L150-L158)

**Level 4~7 (preview → commit 모드)**: 점을 옮기면 `state.preview` 에만 저장. 표시되는 통계량은 미리보기 통계 (`previewStats`)이지만, 학생이 **"확정"을 눌러야** `commits++` 가 되고 실제 `values`/`currentStats` 에 반영됨 — [game-engine.js:145-198](../js/statistics/game-engine.js#L145-L198)

**디바운싱은 없음**. 250ms 타이머는 Level 7 의 시간 제한 표시용일 뿐 ([main.js:431-443](../js/main.js#L431-L443)).

**즉각성**: Level 1~3 은 한 점을 한 칸 움직일 때마다 표(`평균`, `표준편차`, `중앙값`, `최빈값`)와 막대그래프, SC 도수가 동시에 갱신됨. Level 4~7 도 미리보기 단계에서 동일하게 즉시 반영됨 (단지 commits 가 늘지 않음).

### C-4. 조건 만족 판정

**핵심: 이 콘텐츠에는 "정답/오답" 이진 판정이 없다.** 점수는 연속값(낮을수록 좋음)이며 모든 조건이 부분 점수로 통합됨.

[score-formatter.js:22-73](../js/statistics/score-formatter.js#L22-L73) — Level 통과 임계값은 `LEVEL_PASS_THRESHOLD = 100` ([level-config.js:79](../js/statistics/level-config.js#L79)).

| 항목 | 가산점 공식 | 사실상의 허용 오차 |
|---|---|---|
| 평균 | `|g.mean - c.mean|` 을 소수 둘째 자리까지 반올림 후 × **1000** | 통과(<100점)하려면 평균 차이 ≈ ±0.1 미만 (다른 항목 0점일 때) |
| 표준편차 | 동일하게 반올림 후 × **100** | 통과하려면 표준편차 차이 ≈ ±1.0 미만 |
| SC (계급도수) | Σ\|c.classFreq[i] - g.classFreq[i]\| × **20** | 통과하려면 SC 도수 합 차이 < 5 |
| 중앙값 | 일치 0점 / 불일치 **100점** (`abs < 1e-9`) | **정확값 일치** 요구 — 단 한 개라도 어긋나면 100점 |
| 최빈값 | `modesEqual` 일치 0점 / 불일치 **100점** | **다중 최빈값까지 정확히 일치** 요구 |

**반올림 처리**: `roundToThird(x) = Math.round(x*100)/100` — 함수명은 "셋째 자리"이지만 실제 동작은 둘째 자리까지 반올림 ([stats-core.js:77-79](../js/statistics/stats-core.js#L77-L79)). 평균·표준편차의 사실상 허용 오차는 **±0.005**.

**판정 시점**: 점이 움직일 때마다 `computeFullScore` 가 다시 호출되어 우측 패널의 점수가 실시간으로 변함 ([game-engine.js:154-156](../js/statistics/game-engine.js#L154-L156)). **"제출"이라는 검증 단계는 없음** — 종료 시점의 누적 점수가 곧 결과.

**부분 점수 구조**: 모든 조건이 동시에 만족돼야 하는 boolean 게이트는 없음. 평균만 잘 맞춰도 부분 점수가 낮아짐.

### C-5. 라운드 종료

[main.js:448-454](../js/main.js#L448-L454), [game-engine.js:208-227](../js/statistics/game-engine.js#L208-L227)

| Level | 종료 트리거 |
|---|---|
| 1 ~ 3 | **수동 종료만** — "여기서 끝내기" 버튼 |
| 4 ~ 6 | 100회 확정 도달 시 자동 종료 + 수동 종료 가능 |
| 7 | + 시간 10분(600,000ms) 도달 시 자동 종료 |

종료 후 `showResult()` 가 결과 오버레이를 띄우고 [main.js:459-519](../js/main.js#L459-L519), 다음 문제로 가려면:
- "다시 도전" 버튼 → `newGame()` + `startCurrentGame()` 호출 → **새 목표·새 초기 배치 생성** ([main.js:539-544](../js/main.js#L539-L544))
- "Level N 도전" (잠금 해제 시) → URL 이동
- "모드 선택으로" → 라우팅

라운드가 끝나도 점은 **그 자리에 남고**, "다시 도전"을 누를 때 비로소 새 게임이 만들어짐.

---

## D. 점수화 메커니즘 (★ 발표 핵심)

### D-1. 점수 산출 공식

**모든 공식은 [score-formatter.js](../js/statistics/score-formatter.js) 의 `computeBaseBreakdown` (22~73행) + `computeExtra` (79~111행)**.

#### 기본 점수 (base) — 낮을수록 좋음, 0점이 만점

```
base = Σ (해당 Level 의 scoreItems 에 포함된 항목의 가산점)

    mean   포함 → |Δmean(반올림)| × 1000        [score-formatter.js:31-37]
    stdev  포함 → |Δstdev(반올림)| × 100        [score-formatter.js:39-45]
    sc     포함 → Σ|Δfreq[i]| × 20  (i ∈ SC)   [score-formatter.js:47-57]
    median 포함 → 일치 0 / 불일치 100           [score-formatter.js:59-63]
    mode   포함 → 일치 0 / 불일치 100           [score-formatter.js:65-69]
```

#### 추가 점수 (extra) — Level 4~7

```
extraScore = 'moves'       → commits × 3                     [score-formatter.js:92-97]
extraScore = 'moves+time'  → commits × 3 + ⌊elapsedMs/5000⌋ × 1   [score-formatter.js:99-108]
```

상수: `MOVE_SCORE_PER_COMMIT = 3`, `TIME_SCORE_PER_5_SECONDS = 1` ([level-config.js:82-83](../js/statistics/level-config.js#L82-L83))

#### 합계

`total = base + extra` ([score-formatter.js:122](../js/statistics/score-formatter.js#L122))
**낮을수록 좋음**. UI 라벨도 `"현재 점수 (낮을수록 좋아요)"` ([index.html:345](../index.html#L345)).

#### 만점·라운드 수

- "만점"은 base = 0 (모든 조건 정확 일치). Level 4~7 은 시도·시간이 있어 base = 0 이어도 extra 만큼은 가산됨.
- **한 판은 1라운드** (한 목표 자료에 대한 한 번의 도전). 별도 "몇 라운드 누적" 개념은 코드에 없음.
- Level 통과: `total < 100` 이면 다음 Level 잠금 해제 ([main.js:56-66](../js/main.js#L56-L66)).

### D-2. 평가 모드와 연계 가능성 — **현재는 standalone**

**점수 저장 위치: 오로지 `localStorage`**. Firestore·sessionStorage·외부 API 호출 모두 **없음**.

키 구조 ([main.js:34-83](../js/main.js#L34-L83)):
```
'dds-level1:scores:level{N}'           ← 본 게임 기록 (Level 별 분리)
'dds-level1:scores:practice-level{N}'  ← 연습 모드 기록
'dds-level1:unlocked-level'            ← 본 게임 진행도 (1~7)
'dds-level1:unlock-all'                ← 전체 잠금 해제 임시 토글 (기본 ON)
```

기록은 Level 슬롯별 최대 50건 보관, 점수 오름차순 정렬 ([main.js:76-83](../js/main.js#L76-L83)). 우측 패널에는 상위 5건 표시. **"전체 랭킹" 영역은 placeholder ("준비 중 — Phase 2에서 활성화")** — [index.html:361](../index.html#L361)

**통합 시 plugin 가능 형태**: 게임 종료 시 `state.score = {total, base, extra}` 와 메타(`distType`, `level`, `isPractice`, `completedAt`) 가 이미 plain object 로 직렬화되어 있어 ([main.js:509-517](../js/main.js#L509-L517)) 외부 저장소 어댑터를 끼우기 쉬운 구조.

> **테스트 모드 배너**: `<span class="test-banner">테스트 모드 — 운영 점수 미적용</span>` ([index.html:272](../index.html#L272)). 코드 레벨에서 운영 환경과의 분리가 명시돼 있음.

---

## E. 학생이 만들어내는 결과물 (★ Constructionism 핵심)

### E-1. 산출물의 형태 — 코드 근거

학생의 산출물은 정확히 **`state.values`: 길이 100의 정수 배열** (각 원소는 0~25 정수) — [game-engine.js:98](../js/statistics/game-engine.js#L98).

내부적으로 점 하나하나가 식별자(`valueIdx`)를 가지고 있으나 ([dot-graph-render.js:54-74](../js/statistics/dot-graph-render.js#L54-L74)), 통계량 계산은 순서·식별자에 무관하게 다중집합(multiset)으로 처리됨. 즉 **"같은 도수 분포면 같은 통계량"** 이 보장됨.

### E-2. "정답이 다양한가" 검증

| 통계량 | 다양한 답이 인정되는가? | 근거 |
|---|---|---|
| 평균 | **매우 다양** — 같은 평균을 만드는 100개 정수 배열은 무한히 많음. ±0.005 의 반올림 허용 안에서는 사실상 무한 |
| 표준편차 | **다양** — 평균을 고정해도 표준편차를 같은 값으로 맞추는 도수 분포는 다수 존재 |
| SC 도수 | **다양** — 도수만 맞으면 그 계급 안에서 어떤 정수에 점이 모이든 무관 |
| 중앙값 | **다양하나 제약 강함** — 정확값 일치 필요. 50번째·51번째 원소(정렬 후)의 평균이 같아야 함 |
| 최빈값 | **다양하나 제약 강함** — 다중 최빈값 집합까지 정확히 일치 필요 |

**Constructionism 적합성 코드 근거**:
- 점수 함수가 **다중집합의 통계량만 비교**하고 **목표 자료 자체와의 1:1 매칭을 비교하지 않음** ([score-formatter.js:31-69](../js/statistics/score-formatter.js#L31-L69)). 따라서 "목표 자료의 점 하나하나를 똑같이 재현하라"는 요구가 아님 — Papert 의 "구성한 산물이 학습자마다 다르되 모두 의미가 있다" 와 정확히 일치.
- 단, **Level 5~7 에서 중앙값·최빈값을 정확값으로 맞춰야** 하는 제약은 "다양한 정답"의 폭을 좁힌다 — 발표에서는 이 차이를 정직하게 언급할 가치가 있음.

---

## F. 지필 환경과의 비교

### F-1. 코드 동작에서 명백히 지필 불가능한 요소

1. **점 1개 이동 → 평균·표준편차·중앙값·최빈값·계급 도수가 모두 즉시 갱신** ([game-engine.js:150-158](../js/statistics/game-engine.js#L150-L158), [main.js:281-307](../js/main.js#L281-L307)). 100개 자료의 표준편차를 매 이동마다 손으로 다시 계산하는 것은 비현실적.
2. **막대그래프(히스토그램)가 점 이동과 동기화되어 시각적으로 변형** ([dot-graph-render.js:103-113](../js/statistics/dot-graph-render.js#L103-L113)). 지필에서는 점 하나 옮길 때마다 그래프를 다시 그려야 함.
3. **드래그 인터랙션을 통한 시행착오의 속도** — 한 라운드에 100회 이동(Level 4~7) 또는 무제한 시도(Level 1~3)가 분 단위로 가능.

### F-2. 정직하게 — 지필로도 가능한 부분

- **"역방향 탐구"라는 발상 자체**는 지필에서도 가능: "평균이 12, 표준편차가 5인 자료 5개를 만들어 보세요" 같은 문제는 지필 교과서에도 존재함. 다만 **5개**가 한계.
- **Level 1 의 평균만 맞추기** 는 종이 위에서도 사고실험으로 충분히 가능 (예: "100개 다 12로 채우면 평균 12, 표준편차 0").

### F-3. 핵심 차별점 한 줄

> **"100개 자료에 대한 다섯 통계량을 동시에 만족시키며, 매 점 이동마다 즉각 피드백을 받는 시행착오"** — 이 결합은 지필에서 사실상 재현 불가. 지필에서는 자료 크기를 줄이거나 통계량 수를 줄여야 비로소 가능해진다.

---

## G. 발표 슬라이드용 핵심 한 문장 3개

1. **"통계 단원의 일반적 활동은 '주어진 자료 → 통계량 계산'이지만, 이 콘텐츠는 그 화살표를 뒤집어 '주어진 통계량 → 자료를 직접 구성'하게 한다."**

2. **"학생은 100개 점을 캔버스 위에서 한 점씩 옮기며, 평균·표준편차·계급 도수·중앙값·최빈값이 실시간으로 변하는 모습을 보고 자료를 재구성한다 — 같은 통계량 조건을 만족시키는 답은 사실상 무한하므로 학생마다 다른 산물이 모두 인정된다."**

3. **"이는 100개 자료에 대한 다섯 통계량을 매 이동마다 재계산해야 하는 작업으로, 지필에서는 자료 크기·통계량 수를 줄이지 않으면 사실상 불가능한 역방향 탐구 경험이다."**

---

## H. 발표에서 절대 말하면 안 되는 것 ★

| 흔한 과장 표현 | 코드의 실제 | 발표 시 대안 |
|---|---|---|
| "AI 가 학생 답을 분석한다" | **LLM 호출 0건. 외부 API 호출 0건.** 모든 평가는 [score-formatter.js](../js/statistics/score-formatter.js) 의 결정론적 공식 | "통계량 차이를 직접 계산해 점수화한다" — AI 언급 금지 |
| "학생이 통계 개념을 스스로 발견한다" | **목표 통계량을 먼저 명시하고 ([index.html:326-331](../index.html#L326-L331) `목표` 행), 학생은 그 값을 맞추는 활동.** 자유 탐구가 아니라 **목표-주도 구성**. 힌트는 우측의 "현재 vs 목표" 표 자체가 스캐폴딩 역할 | "통계량의 의미를 자료를 구성하며 역으로 체득한다" |
| "학생마다 다른 답이 모두 인정된다" | **평균·표준편차·SC 도수**: 폭이 넓어 사실. **중앙값·최빈값(L5~7)**: 정확값 일치 필요 — 폭이 좁음 | "평균·표준편차·계급 도수에 한해 다양한 답이 인정되며, 중앙값·최빈값 단계에서는 더 좁은 제약이 추가된다" |
| "지필로 절대 불가능" | "역방향 발상" 자체는 지필도 가능. **100개 + 다중 통계량 + 즉시 피드백의 결합**이 사실상 불가능한 부분 | "100개 자료 + 다섯 통계량 + 실시간 피드백의 결합이 지필에서는 비현실적" |
| "점수가 서버에 기록된다 / 학습 데이터로 활용된다" | **localStorage 만 사용**. 외부 저장 0건. UI에 `테스트 모드 — 운영 점수 미적용` 배너 명시 ([index.html:272](../index.html#L272)) | "현재는 학습자 단말 로컬에만 저장. 통합 단계에서 외부 저장으로 확장 예정" |

**좌표 찍기·외심 콘텐츠와의 차이 (코드 차원)**:

| 측면 | 좌표 찍기 (예상) | 외심 (예상) | **통계 (이 코드)** |
|---|---|---|---|
| 평가 방식 | 점수화·자동 분류 | 비점수화·LLM+규칙 | **점수화·결정론적 공식** (LLM 없음) |
| 학생 활동 | 정답 위치 찾기 (반복 숙달) | 자기주도 탐구 | **자료 구성** (역방향 만들기) |
| 정답 다양성 | 단일 정답 | 다양한 추론 경로 | **통계량 일치하는 모든 자료** (특히 평균·표준편차) |
| 외부 연동 | (확인 필요) | LLM 호출 있음 | **없음** (standalone) |

---

## I. 시연 시나리오 — 30초~1분 안에 핵심 메시지 전달

### 추천 시연 흐름 (Level 1 사용 — 가장 임팩트 있음)

**왜 Level 1?**
- 초기 배치가 **항상 동일** (1~24 각 4개 + 0,25 각 2개) → 시연자가 동작을 사전에 익혀둘 수 있음
- 조건이 **평균 + 표준편차 2개뿐** → 청중이 30초 안에 핵심 파악
- preview/commit 단계 없이 점이 **실시간으로 즉시 반영** → "지필 불가능" 메시지가 가장 명확

### 시연 스크립트 (약 60초)

**0~10초 — 목표 제시**
> "Level 1 을 시작하면 화면 위쪽에는 100개 점이 1부터 24까지 평탄하게 깔려 있습니다. 표를 보면 **목표 평균**과 **목표 표준편차**가 적혀 있고, 그 옆 **현재** 행에는 지금 점들의 통계량이 나옵니다."
> *(시연: 게임 시작 버튼 클릭 → 목표 행 가리키기)*

**10~25초 — 점 1개 이동, 즉시 갱신 강조**
> "점 하나를 잡고 오른쪽으로 옮겨 보겠습니다. 평균이 바뀌고, 표준편차가 바뀌고, 막대그래프 모양도 바뀝니다. **점 하나마다 다섯 가지 값이 동시에 다시 계산됩니다.**"
> *(시연: 가운데 영역의 점을 양 끝으로 한 번씩 끌어다 놓기 — 평균은 거의 안 변하지만 표준편차가 크게 변하는 모습)*

**25~45초 — 역방향 탐구 강조**
> "보통 통계 단원에서는 '이 자료의 평균을 구하시오'를 합니다. 이 콘텐츠는 반대입니다. **'평균이 12.5, 표준편차가 7.2가 되도록 자료를 만드시오.'** 같은 통계량을 만드는 자료는 **여러 개** 있을 수 있습니다. 학생마다 다른 정답이 나옵니다."
> *(시연: 점들을 양 끝으로 몰았다가, 가운데로 모았다가 — 표준편차가 크게 → 작게 변하는 시각적 대비)*

**45~60초 — 마무리 한 문장**
> "100개 자료에 대해 다섯 가지 통계량을 동시에 맞추며 점을 옮길 때마다 즉시 피드백을 받는 — 이 경험은 지필 환경에서는 자료 크기를 줄이지 않으면 사실상 만들 수 없습니다."

### 시연 시 주의

- **Level 5~7 시연은 비추천**: 중앙값·최빈값의 정확값 일치 요구 때문에 청중이 "정답이 다양하다"는 메시지를 흐리게 받을 수 있음.
- **Preview/Commit 모드(L4~7)는 추가 설명이 필요**: 시연 시간이 짧다면 L1~3 의 즉시 반영 모드만 보여주는 것이 메시지 전달에 유리.
- **"전체 랭킹" 패널은 클릭하지 말 것**: "준비 중" placeholder 가 노출되어 미완성 인상을 줌.

### 청중이 시연 직후 자연스럽게 떠올리도록 유도할 메시지

> *"100개 점의 위치를 손으로 옮기면서 다섯 통계량이 동시에 변하는 걸 본 학생은, '평균이 같아도 표준편차는 다를 수 있다', '계급 도수만 맞춰도 정확한 값들은 다를 수 있다' 같은 사실을 — 정의를 외워서가 아니라 자기가 만든 자료에서 — 알게 된다."*

---

## 부록: 분석에서 확인한 미완성·작업 중 표시

코드에서 **"현재는 이런 상태"** 로 명시된 부분 (추정 아님):

- **"전체 랭킹"** 패널: `<div class="ranking-placeholder">준비 중 (Phase 2에서 활성화)</div>` ([index.html:361](../index.html#L361))
- **"전체 잠금 해제"** 토글: `관리자 페이지 이전 전 임시 토글` ([index.html:282](../index.html#L282)), 기본값 ON ([main.js:48-52](../js/main.js#L48-L52))
- **"테스트 모드 — 운영 점수 미적용"** 배너 ([index.html:272](../index.html#L272))
- localStorage 키 prefix `'dds-level1:'` — Level 시스템 확장 전 초기 명명이 잔존
