# 자료의 분포와 요약

100개의 변량으로 구성된 점 그래프(도수분포)에서 점들을 옮겨, 4가지 통계량을 목표값에 가깝게 맞추는 골프식 점수 게임입니다.

중학교 수학 "자료의 분포와 요약" 단원 학습용으로 설계되었습니다.

## 목표 통계량

| 통계량 | 채점 |
|---|---|
| 평균 (mean) | 차이 1당 1000점 |
| 중앙값 (median) | 일치하지 않으면 100점 |
| 최빈값 (mode) | 일치하지 않으면 100점 |
| 선택 클래스(SC) 도수 차이 | 클래스당 차이 1마다 20점 |
| 표준편차 (population stdev) | 차이 1당 100점 |

점수가 **낮을수록** 좋습니다.

## 모드

| 모드 | 추가 점수 | 비고 |
|---|---|---|
| `time` | 경과 시간(초) | 시간 제한 있음 |
| `moves` | 확정 횟수 × 10 | 이동 확정 횟수 제한 있음 |
| `practice` | 0 | 제한 없음 (연습) |

## 실행법

ES Modules를 사용하므로 `file://` 직접 열기는 일부 브라우저에서 막힙니다. 정적 서버로 띄워서 접속해 주세요.

### Windows: `serve.bat` 더블클릭 (권장)

저장소 루트의 [serve.bat](serve.bat) 을 탐색기에서 더블클릭하면 8088 포트에 서버가 뜹니다. (Node.js 필요. 첫 실행 시 `http-server` 패키지가 자동 다운로드되고 그 후엔 캐시에서 즉시 실행됩니다.)

서버 종료는 cmd 창을 닫거나 `Ctrl+C`.

### 명령으로 직접 띄우기 (모든 OS)

저장소 폴더에서:

```
npx --yes http-server . -p 8088 -c-1
```

`-c-1` 은 캐싱 비활성화(개발 중 변경사항 즉시 반영용).

### 접속 URL

| 용도 | 주소 |
|---|---|
| 모드 선택 화면 | http://localhost:8088/ |
| time 모드 직행 | http://localhost:8088/?contentMode=time |
| moves 모드 직행 | http://localhost:8088/?contentMode=moves |
| practice 모드 직행 | http://localhost:8088/?contentMode=practice |

## 데이터 저장

브라우저 `localStorage` 만 사용합니다 (서버/계정 없음).

- 키: `dds-test:scores:{time|moves|practice}`
- 모드별 상위 50개 기록을 점수 낮은 순으로 보관

## 파일 구조

```
.
├── index.html                          페이지 + 글루(모드 라우팅, 이벤트, 점수 저장)
└── js/statistics/
    ├── stats-core.js                   순수 통계 계산 (mean / median / mode / 표준편차 / 클래스 빈도)
    ├── distribution-sampler.js         A/B/C/D 분포 샘플링, 합 보존, 시작 데이터 생성
    ├── score-formatter.js              점수 breakdown 계산
    ├── game-engine.js                  불변 상태기 (선택 / 이동 / 미리보기 / 확정 / 종료)
    └── dot-graph-render.js             캔버스 렌더 + hit-test (DPI 대응)
```

5개 JS 모듈 중 4개는 DOM 의존 0건의 순수 함수 — Node 등 다른 환경으로 그대로 이식 가능합니다. `dot-graph-render.js` 만 캔버스 API와 `window.devicePixelRatio` 를 사용합니다.

## 라이선스

TBD
