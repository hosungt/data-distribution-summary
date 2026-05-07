// Level 1~7 의 게임 설정 중앙화. 각 Level 의 점수 항목·데이터 생성 방식·제한을 표 한 곳에서 관리.
//
// goalType:   'random'       — 0~25 정수 100개 완전 랜덤
//             'distribution' — A/B/C/D 분포 샘플링 (기존 sampleGoalData)
// startType:  'fixed'        — 1~24 각 4개 + 0,25 각 2개 (총 100개) 고정
//             'random'       — 0~25 정수 100개 완전 랜덤
// scCount:    Selected Class 개수 (0/1/2)
// scoreItems: base 점수 합산에 포함할 항목 목록
// extraScore: null / 'moves' / 'moves+time'

export const LEVEL_CONFIG = {
  1: {
    scCount: 0,
    goalType: 'random',
    startType: 'fixed',
    scoreItems: ['mean', 'stdev'],
    timeLimit: null,
    movesLimit: null,
    extraScore: null,
  },
  2: {
    scCount: 1,
    goalType: 'random',
    startType: 'fixed',
    scoreItems: ['mean', 'stdev', 'sc'],
    timeLimit: null,
    movesLimit: null,
    extraScore: null,
  },
  3: {
    scCount: 2,
    goalType: 'distribution',
    startType: 'fixed',
    scoreItems: ['mean', 'stdev', 'sc'],
    timeLimit: null,
    movesLimit: null,
    extraScore: null,
  },
  4: {
    scCount: 2,
    goalType: 'distribution',
    startType: 'random',
    scoreItems: ['mean', 'stdev', 'sc'],
    timeLimit: null,
    movesLimit: 100,
    extraScore: 'moves',
  },
  5: {
    scCount: 2,
    goalType: 'distribution',
    startType: 'random',
    scoreItems: ['mean', 'stdev', 'sc', 'median'],
    timeLimit: null,
    movesLimit: 100,
    extraScore: 'moves',
  },
  6: {
    scCount: 2,
    goalType: 'distribution',
    startType: 'random',
    scoreItems: ['mean', 'stdev', 'sc', 'median', 'mode'],
    timeLimit: null,
    movesLimit: 100,
    extraScore: 'moves',
  },
  7: {
    scCount: 2,
    goalType: 'distribution',
    startType: 'random',
    scoreItems: ['mean', 'stdev', 'sc', 'median', 'mode'],
    timeLimit: 600_000,
    movesLimit: 100,
    extraScore: 'moves+time',
  },
};

export const LEVEL_LIST = [1, 2, 3, 4, 5, 6, 7];
export const MAX_LEVEL = 7;
export const LEVEL_PASS_THRESHOLD = 100;

// 추가점 계수
export const MOVE_SCORE_PER_COMMIT = 3;       // Level 4~ : 확정 1회당
export const TIME_SCORE_PER_5_SECONDS = 1;    // Level 7  : 5초당
