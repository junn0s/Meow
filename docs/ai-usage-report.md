# AI 활용 보고서

## 1. 문서 목적과 현재 상태

이 문서는 `냥포차: 달빛 아래 야식당`을 제작하면서 AI를 어디에 사용했는지, 어떤 산출물을 만들었는지, 사람이 무엇을 확인해야 하는지를 공개하기 위한 기록입니다.

> **검증 상태:** 1~9절은 2026-07-15의 10단계 MVP 제작 이력을 원문대로 보존한 기록입니다. 현재 30단계 확장과 2026-07-16 검증 상태는 10절이 최신이며, 타입·스모크·시뮬레이션·프로덕션/Sites 빌드·릴리스 정적 감사가 통과했습니다.

GitHub Pages Actions 빌드·배포와 공개 URL의 HTTPS 200 응답은 확인했습니다. 7~10단계 신규 실브라우저 E2E와 12장 시각 회귀 재촬영은 실행 환경 사용량 제한으로 수행하지 못했으며, 이전 브라우저 검증을 신규 기능의 성공으로 기록하지 않습니다.

## 2. 사용 도구

| 항목 | 기록 |
| --- | --- |
| AI 도구 | OpenAI Codex 데스크톱 앱 |
| 모델 계열 | GPT-5 기반 Codex |
| 작업일 | 2026-07-15 |
| 도구 버전 | 세부 앱 빌드 번호는 작업 컨텍스트에 제공되지 않아 미기록 |
| 빌드 도구 | 잠금 파일 기준 Vite 6.4.3 |
| 브라우저 검증 | Playwright 실브라우저, 세부 브라우저 버전은 미기록 |
| 주요 역할 | 요구사항 구조화, Phaser/TypeScript 코드 생성 보조, 문서·프롬프트 작성, 검증 항목 도출 |
| 사람의 역할 | 기획 승인, 실제 플레이 판단, 코드·라이선스 검토, 테스트 실행 결과 확인, 최종 제출 결정 |

버전 정보를 확인할 수 없는 항목은 추정해서 적지 않았습니다.

## 3. 입력 자료와 요구사항 정리

AI에 제공된 원본 입력은 사용자가 작성한 게임 기획서와 구현 요청입니다. 핵심 요구사항은 다음과 같습니다.

- Phaser 3 + TypeScript + Vite 기반 웹 게임
- `480 × 270` 논리 좌표계, 고해상도 렌더링, 픽셀아트 설정, 키보드와 마우스 입력
- 손님, 좌석, 주문, 조리, 서빙, 돈과 만족도 흐름
- 어묵·떡볶이·붕어빵과 10단계 업그레이드
- 셰프 자동 조리와 서버 자동 서빙
- `localStorage` 저장, 달빛 간판·평점 5점 클리어
- GitHub Pages 배포
- 외부 미디어 에셋 없이 코드 생성 픽셀아트와 Web Audio 효과음 사용
- 게임 설명, AI 활용, 에셋 라이선스와 재현 가능한 프롬프트 기록

기획서에서 온라인 멀티플레이, 서버 데이터베이스, 로그인, 결제, 랭킹, 여러 맵, 복잡한 인벤토리와 무한 진행은 범위에서 제외했습니다.

## 4. 프롬프트 전문

구현 작업을 기능별로 분리하고 재현할 수 있도록 실제 입력용 프롬프트 전문을 다음 파일에 보존했습니다. 요약본이 아니라 AI에 전달할 수 있는 전체 요구사항 형태입니다.

| 순서 | 작업 | 프롬프트 전문 |
| ---: | --- | --- |
| 1 | 프로젝트·장면·입력·코드 생성 리소스 설정 | [`prompts/01-project-setup.md`](../prompts/01-project-setup.md) |
| 2 | 손님·좌석·상태 흐름 | [`prompts/02-customer-system.md`](../prompts/02-customer-system.md) |
| 3 | 주문·조리·서빙·경제·직원 자동화 | [`prompts/03-order-system.md`](../prompts/03-order-system.md) |
| 4 | 10단계 업그레이드·저장·클리어 | [`prompts/04-upgrade-system.md`](../prompts/04-upgrade-system.md) |
| 5 | 타입·빌드·브라우저·배포 회귀 검증 | [`prompts/05-debugging.md`](../prompts/05-debugging.md) |

이 다섯 파일은 원본 기획을 구현 단위로 정리한 재현용 작업 프롬프트입니다. Codex의 내부 시스템 지시나 도구 호출 로그를 프롬프트인 것처럼 꾸민 것이 아닙니다. 실제 대화에서 추가 지시가 생기면 해당 문구와 적용 시점을 작업 기록에 덧붙여야 합니다.

## 5. 작업별 AI 활용 기록

### 기록 1 — 프로젝트 기반과 화면 구성

**작업:** Phaser 3, TypeScript, Vite 프로젝트와 기본 장면·입력·해상도 설정

**사용 도구:** OpenAI Codex / GPT-5 기반

**프롬프트 전문:** [`01-project-setup.md`](../prompts/01-project-setup.md)

**AI 활용:**

- 패키지 스크립트, TypeScript strict 설정, Vite 진입점 구조 제안
- Boot/Menu/Game/Result 장면의 책임 분리
- `480 × 270` 논리 좌표계를 `960 × 540` 실제 버퍼에 렌더링하고, 글자에는 2배 내부 해상도, 픽셀아트에는 `pixelArt`, `roundPixels`, NEAREST 필터 적용
- WASD·방향키·Space·Esc·마우스 입력 연결안 작성
- 외부 이미지 없이 코드로 픽셀 텍스처를 만드는 방식 제안
- Web Audio API 효과음 모듈 구조 제안

**AI 생성·수정 파일:**

- 프로젝트 설정: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- 진입점·스타일·타입: `src/main.ts`, `src/styles.css`, `src/vite-env.d.ts`, `src/debug.d.ts`
- 프로젝트 제작 파비콘: `public/favicon.svg`
- 코드 생성 리소스: `src/game/art/PixelArtFactory.ts`(43개 런타임 텍스처 키·NEAREST 필터), `src/game/audio/SoundManager.ts`(coin/ready/buy/enter/upgrade/clear/click 합성음)
- 배경·장면: `src/game/art/SceneDecor.ts`, `src/game/scenes/BootScene.ts`, `MenuScene.ts`, `GameScene.ts`, `ResultScene.ts`
- UI: `src/ui/HUD.ts`, `PixelButton.ts`, `ToastManager.ts`, `UpgradePanel.ts`

**발생 오류:** 픽셀아트·오디오 분리 작업 당시 전체 `npm run typecheck`는 수정 중이던 Customer/Player override와 아직 만들어지지 않은 Scene import 때문에 실패했고, 샌드박스 Vite listen은 `EPERM`이었습니다. 통합 완료 후 타입 오류를 해소하고 다른 실행 경로에서 Playwright 실브라우저 검증을 수행했습니다. 초기 실패도 이력에서 삭제하지 않았습니다.

**사람이 직접 수정한 내용:** 직접 소스 편집 기록은 없습니다. 사람은 외부 에셋을 쓰지 않는 방향, 밸런스 변경과 최종 제출 범위를 승인했습니다.

**AI 결과를 그대로 사용하지 않은 이유:** 원본 기획에 있던 외부 에셋 디렉터리 중심 구조는 이번 구현의 “외부 에셋 없음” 조건과 맞지 않아, 런타임 코드 생성 텍스처와 합성음 중심 구조로 조정했습니다.

**테스트 방법:** 분리 단계에서 `PixelArtFactory.ts`와 `SoundManager.ts`를 strict TypeScript로 검사했습니다. 통합 단계에서는 전체 `npm run typecheck`, `npm run build`, Playwright 실브라우저 로드, 콘솔 수집과 메뉴·튜토리얼 동선을 확인했습니다.

**최종 반영 여부:** 위 파일을 최종 통합본에 반영했습니다.

**실제 검증 결과:** 두 리소스 파일의 분리 strict 검사는 exit 0이었고 `any`·`ts-ignore`가 없었습니다. 최종 `npm run typecheck`와 `npm run build`도 통과했으며 Vite 6.4.3이 30개 모듈을 처리해 `dist/`를 생성했습니다. Playwright 브라우저 콘솔은 error 0, warning 0이었습니다.

### 기록 2 — 손님과 좌석 배정

**작업:** 손님 생성, 좌석 예약, 이동, 인내심과 퇴장 상태 구현

**사용 도구:** OpenAI Codex / GPT-5 기반

**프롬프트 전문:** [`02-customer-system.md`](../prompts/02-customer-system.md)

**AI 활용:**

- `ENTERING`부터 `LEAVING`까지 손님 상태 정의
- 좌석을 선택하는 즉시 예약해 중복 배정을 막는 규칙 제안
- 좌석이 없을 때 입구에서 기다리고, 좌석 해제 후 다시 배정하는 흐름 제안
- 토끼·강아지·햄스터·너구리의 외형과 선호 메뉴 데이터 구조 제안
- 장면 종료 시 타이머·손님·좌석 점유를 함께 정리하는 검증 항목 도출

**AI 생성·수정 파일:**

- `src/game/types/game.ts`
- `src/game/data/customerData.ts`
- `src/game/entities/Customer.ts`
- `src/game/entities/Table.ts`
- `src/game/scenes/GameScene.ts`
- 손님 텍스처를 포함한 `src/game/art/PixelArtFactory.ts`

**발생 오류:** 동시 생성 시 좌석 중복, 퇴장 중 좌석 미해제, 대기열 정체 가능성을 사전 위험으로 식별했습니다. 좌석 선택 즉시 `reserve`하고 식사 완료 시 `release`하는 흐름으로 처리했습니다. 20명 스트레스 테스트까지는 수행하지 않았습니다.

**사람이 직접 수정한 내용:** 직접 소스 편집 기록 없음.

**AI 결과를 그대로 사용하지 않은 이유:** 원본 기획의 단순 “착석 후 3초 뒤 퇴장” 예시는 주문·조리 루프를 검증할 수 없어 주문·대기·식사·결제 상태로 확장했습니다. 별도 CustomerSystem/SeatSystem 클래스를 늘리기보다 엔티티와 GameScene 조정 로직으로 MVP 구조를 유지했습니다.

**테스트 방법:** Playwright 실브라우저에서 첫 손님 입장·착석·주문 상태를 확인하고, 수동 서비스 흐름과 50냥 좌석 업그레이드 전후 좌석 수를 비교했습니다. 디버그 API로 최종 6좌석 효과도 확인했습니다.

**최종 반영 여부:** 최종 통합본에 반영했습니다.

**실제 검증 결과:** 첫 손님이 좌석에 배정되어 주문 상태로 전환됐고, 전체 서비스 후 퇴장·결제로 이어졌습니다. 추가 좌석 구매 시 좌석이 2개에서 4개로, 전체 업그레이드 후 6개로 증가했습니다. 브라우저 콘솔 error/warning은 0이었습니다.

### 기록 3 — 주문, 조리, 서빙, 결제와 직원

**작업:** 수동 상호작용과 셰프·서버 자동화가 연결된 서비스 루프 구현

**사용 도구:** OpenAI Codex / GPT-5 기반

**프롬프트 전문:** [`03-order-system.md`](../prompts/03-order-system.md)

**AI 활용:**

- 해금된 메뉴만 주문하도록 데이터 기반 메뉴 선택 규칙 제안
- 주문 접수, 조리 대기열, 완성 음식, 한 칸 운반, 일치 주문 서빙 구조 제안
- 어묵 3초/10냥, 떡볶이 5초/25냥, 붕어빵 7초/45냥과 밤손님 영업 보너스 ×3 정산 반영
- 인내심에 따른 30%·10%·0% 팁과 평점 갱신 규칙 제안
- 셰프의 자동 조리와 서버의 자동 서빙이 수동 조작과 충돌하지 않도록 작업 점유 규칙 제안
- 동전, 조리 완료, 구매·해금·클리어용 Web Audio 합성음 작성 보조

**AI 생성·수정 파일:**

- `src/game/data/menuData.ts`
- `src/game/entities/Player.ts`, `src/game/entities/CookingStation.ts`
- `src/game/systems/EconomySystem.ts`
- `src/game/scenes/GameScene.ts`
- `src/ui/HUD.ts`, `src/ui/ToastManager.ts`
- `src/game/audio/SoundManager.ts`, `src/game/art/PixelArtFactory.ts`

**발생 오류:** 같은 완성 음식을 플레이어와 서버가 동시에 가져가는 경쟁 조건, 다른 메뉴 오서빙, 장면 전환 후 상태 잔존을 사전 위험으로 식별했습니다. 완성 티켓을 `takeReadyTicket`으로 한 번만 꺼내고 손님 id·메뉴 id를 다시 확인하며, Scene shutdown에서 입력·구독·오디오를 정리하도록 구현했습니다.

**사람이 직접 수정한 내용:** 통합 구현의 전역 조리 배율과 일치시키기 위해, 원 기획의 빠른 냄비 효과인 “어묵만 30% 단축”을 MVP에서는 “모든 음식 조리 시간 30% 단축”으로 조정했습니다. 또한 메뉴판 가격 10/25/45냥은 유지하면서 실제 정산에 “밤손님 영업 보너스 ×3”를 추가하고 UI·튜토리얼에 공개하기로 했습니다. 두 변경 모두 규칙을 단순화하고 후반 업그레이드 보상을 유지하며 5~8분 클리어를 맞추기 위한 사람의 MVP 밸런스 결정입니다.

**AI 결과를 그대로 사용하지 않은 이유:** 사람이 직접 모든 조리를 수행하는 복잡한 미니게임은 5~8분 MVP 흐름과 직원 자동화 목표에 맞지 않아 포함하지 않았습니다. 조리는 타이머로 단순화하고 플레이어는 주문 접수와 운반에 집중하게 했습니다.

**테스트 방법:** 첫 손님의 주문 접수, 어묵 3초 조리, 음식 픽업, 일치 손님 서빙, 식사 후 동전 수거를 실브라우저에서 수행했습니다. 디버그 API로 메뉴 3개, 조리 배율 0.7, 셰프·서버 활성 상태를 확인했습니다.

**최종 반영 여부:** 최종 통합본에 반영했습니다.

**실제 검증 결과:** 첫 손님의 주문 → 3초 조리 → 픽업 → 서빙 → 동전 수거 전체 흐름이 통과했습니다. 10단계 점검에서 메뉴 3개, 전역 조리 배율 0.7, 셰프·서버 활성화와 스폰 배율 0.7을 확인했습니다. 밤손님 보너스 ×3 안내는 3단계 튜토리얼에 표시됩니다.

### 기록 4 — 10단계 성장, 저장과 클리어

**작업:** 데이터 기반 10단계 업그레이드, `localStorage` 저장 복원, 최종 클리어 구현

**사용 도구:** OpenAI Codex / GPT-5 기반

**프롬프트 전문:** [`04-upgrade-system.md`](../prompts/04-upgrade-system.md)

**AI 활용:**

- 무료 어묵 조리대부터 2,000냥 달빛 간판까지 가격·선행 조건·효과 데이터 구성
- 경제 시스템이 잔액과 중복 구매를 검증하도록 책임 분리
- 좌석, 메뉴, 조리 속도, 직원, 방문 속도 효과 적용 방식 제안
- 저장 스키마 버전, 파싱 실패 복구, 구매 효과 재적용 시 재결제 금지 규칙 제안
- 활성 플레이 시간 `elapsedMs`, 최신 저장본 선택, 음소거 설정 보존 추가
- 달빛 간판 구매와 평점 5점의 복합 클리어 조건 구성

**AI 생성·수정 파일:**

- `src/game/types/game.ts`
- `src/game/data/menuData.ts`
- `src/game/data/upgradeData.ts`
- `src/game/data/customerData.ts`
- `src/game/systems/EconomySystem.ts`
- `src/game/systems/SaveSystem.ts`
- `src/game/systems/UpgradeSystem.ts`
- `src/game/scenes/GameScene.ts`, `MenuScene.ts`, `ResultScene.ts`
- `src/ui/UpgradePanel.ts`, `src/ui/PixelButton.ts`

**발생 오류:** 분리 검증 당시 전체 빌드는 생성 중이던 Scene import 때문에 완료되지 않았지만 최종 통합에서 해소했습니다. 통합 QA 중에는 메모리 fallback이 브라우저 저장소보다 오래된 값을 가릴 수 있는 위험과 새 게임에서 음소거가 초기화될 가능성을 점검했고, `lastSavedAt` 기준 최신본 선택과 기존 설정 전달로 보완했습니다.

**사람이 직접 수정한 내용:** 직접 소스 편집 기록 없음. 활성 플레이 시간만 결과에 포함하고 음소거 설정은 새 게임에도 보존하는 동작을 사람이 승인했습니다.

**AI 결과를 그대로 사용하지 않은 이유:** 기획 문서의 초기 `SaveData` 예시는 버전·설정·활성 시간 필드가 없어 그대로 사용하지 않았습니다. `version`, `settings`, `muted`, `tutorialCompleted`, `playStartedAt`, `elapsedMs`, `cleared`, `lastSavedAt`을 포함하는 정규화 스키마로 확장했습니다.

**테스트 방법:** 도메인 스모크 테스트에서 6,000냥으로 10단계를 순서대로 구매하고 효과 집계, 평점 5점 클리어, 저장·로드·구버전 보정·초기화를 확인했습니다. 통합 브라우저 QA에서는 50냥 좌석 구매, 새로고침 복원, 10단계 전체 효과, 클리어 결과와 새 게임 초기화를 확인했습니다.

**최종 반영 여부:** 도메인, Scene과 UI 연결을 최종 통합본에 반영했습니다.

**실제 검증 결과:** 도메인 strict 검사와 스모크 테스트가 통과했고, 최종 전체 typecheck/build도 통과했습니다. 브라우저에서 50냥 구매 후 좌석 2→4, 새로고침 후 진행 복원, 최종 좌석 6·메뉴 3·배율 0.7/0.7·직원 2명·달빛 간판을 확인했습니다. 평점 5점 클리어 결과와 새 게임 초기화도 통과했습니다.

### 기록 5 — 디버깅, 문서와 제출 준비

**작업:** 타입·빌드·플레이 회귀 검증 계획 수립과 제출 문서 작성

**사용 도구:** OpenAI Codex / GPT-5 기반

**프롬프트 전문:** [`05-debugging.md`](../prompts/05-debugging.md)

**AI 활용:**

- 타입 검사, 빌드, preview, 상태 전환, 저장, Pages 하위 경로 검증 목록 작성
- README, 게임 설명서, AI 활용 보고서, 에셋 라이선스 문서 초안 생성
- 코드 생성 픽셀아트와 Web Audio 합성 방식의 출처·라이선스 설명 작성
- 30~60초 영상과 제출물 체크리스트 정리

**AI 생성·수정 파일:**

- `README.md`
- `docs/game-description.md`
- `docs/ai-usage-report.md`
- `docs/asset-licenses.md`
- `prompts/01-project-setup.md`
- `prompts/02-customer-system.md`
- `prompts/03-order-system.md`
- `prompts/04-upgrade-system.md`
- `prompts/05-debugging.md`

**발생 오류:** 문서 작성 중 초기 `src/styles.css`에서 Google Fonts 외부 `@import`가 발견되어 “외부 에셋·웹폰트 미사용” 요구와 충돌했습니다. 통합 과정에서 해당 import를 제거하고 시스템 폰트 스택으로 바꿨습니다. 또한 문서 작성 시점에 소스 파일과 실제 빌드 결과가 확정되지 않아 구현을 완료형으로 단정할 수 없었습니다.

**사람이 직접 수정한 내용:** 직접 문서 편집 기록 없음. 사람의 최종 지시에 따라 실제 검증 결과, 전역 0.7 조리 배율, 밤손님 보너스 ×3, `elapsedMs`, 최신 저장본 선택과 음소거 보존 내용을 문서에 반영했습니다.

**AI 결과를 그대로 사용하지 않은 이유:** 외부 Google Fonts import는 라이선스 표기 여부와 관계없이 이번 프로젝트의 외부 에셋 0개 정책에 맞지 않아 채택하지 않았습니다. 초기 단계에서는 검증되지 않은 성공 문구도 쓰지 않았고, 통합 후 실제 실행 결과만 갱신했습니다.

**테스트 방법:** 최종 파일 경로와 문서 설명을 대조하고, 네트워크를 요청하는 외부 URL·`@import`를 정적 검색했습니다. `favicon.svg`의 W3C SVG namespace는 네트워크 요청이 아닌 XML 식별자이므로 외부 에셋에서 제외했습니다. 전체 typecheck/build 결과와 Playwright·수동·디버그 QA 기록을 아래 표에 반영했습니다.

**최종 반영 여부:** 최종 구현과 대조해 문서 9개에 반영했습니다.

**실제 검증 결과:** 외부 웹폰트 import를 제거했고 제3자 이미지·음원 URL이 없습니다. 프로젝트 제작 `public/favicon.svg`는 별도 라이선스 문서에 기록했습니다. 전체 typecheck/build가 통과했으며 Playwright 콘솔 error/warning은 0이었습니다.

## 6. 최종 생성 파일 목록

최종 통합본의 소스·문서 파일을 실제 저장소 구조와 대조했습니다. 설치·빌드 산출물인 `node_modules/`와 `dist/`는 아래 목록에서 제외했습니다.

```text
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.svg
├── src/
│   ├── debug.d.ts
│   ├── main.ts
│   ├── styles.css
│   ├── vite-env.d.ts
│   ├── game/
│   │   ├── art/
│   │   │   ├── PixelArtFactory.ts
│   │   │   └── SceneDecor.ts
│   │   ├── audio/SoundManager.ts
│   │   ├── data/
│   │   │   ├── customerData.ts
│   │   │   ├── menuData.ts
│   │   │   └── upgradeData.ts
│   │   ├── entities/
│   │   │   ├── CookingStation.ts
│   │   │   ├── Customer.ts
│   │   │   ├── Player.ts
│   │   │   └── Table.ts
│   │   ├── scenes/
│   │   │   ├── BootScene.ts
│   │   │   ├── GameScene.ts
│   │   │   ├── MenuScene.ts
│   │   │   └── ResultScene.ts
│   │   ├── systems/
│   │   │   ├── EconomySystem.ts
│   │   │   ├── SaveSystem.ts
│   │   │   └── UpgradeSystem.ts
│   │   └── types/game.ts
│   └── ui/
│       ├── HUD.ts
│       ├── PixelButton.ts
│       ├── ToastManager.ts
│       └── UpgradePanel.ts
├── docs/
│   ├── ai-usage-report.md
│   ├── asset-licenses.md
│   └── game-description.md
├── prompts/
│   ├── 01-project-setup.md
│   ├── 02-customer-system.md
│   ├── 03-order-system.md
│   ├── 04-upgrade-system.md
│   └── 05-debugging.md
└── README.md
```

## 7. 2026-07-15 MVP 검증표 — 당시 기준

| 검증 항목 | 방법 | 실제 결과 | 상태 |
| --- | --- | --- | --- |
| 전체 타입 검사 | `npm run typecheck` | 오류 없이 종료 | 통과 |
| 프로덕션 빌드 | `npm run build` | Vite 6.4.3, 30개 모듈, `dist/` 생성 | 통과 |
| 브라우저 콘솔 | Playwright 실브라우저 | error 0, warning 0 | 통과 |
| 메뉴·튜토리얼 | Enter 및 3단계 진행 | 게임 진입과 튜토리얼 완료 | 통과 |
| 첫 손님 서비스 | 수동 주문·조리·픽업·서빙·수거 | 어묵 3초 조리 포함 전체 흐름 완료 | 통과 |
| 좌석 업그레이드 | 50냥 구매 전후 상태 비교 | 좌석 2개 → 4개 | 통과 |
| 저장 복원 | 구매 후 새로고침 | 진행 상태 복원 | 통과 |
| 전체 업그레이드 | 디버그 API로 10단계 구매 | 좌석 6, 메뉴 3, 조리 0.7, 직원 2, 스폰 0.7, 달빛 간판 | 통과 |
| 클리어 | 달빛 간판 + 평점 5 | ResultScene과 최종 통계 표시 | 통과 |
| 새 게임 | 완료 상태에서 초기화 | 진행 초기화, 음소거 설정 보존 | 통과 |
| 저장 안정성 | 코드·스모크 테스트 | primary/fallback 유효성 검사 후 최신 `lastSavedAt` 선택 | 통과 |
| 외부 에셋 | 정적 파일·URL 대조 | 제3자 이미지·음원·웹폰트 없음 | 통과 |
| GitHub Pages | `https://junn0s.github.io/Meow/` | Actions 빌드·배포 및 HTTPS 200 응답 | 통과 |
| 자연 플레이 시간 | 디버그 보조 없는 전체 플레이 | 5~8분 목표 실측 전 | 미검증 |

## 8. 실제 오류·사람 수정 기록 양식

검증 중 문제가 생길 때 아래 블록을 복사해 누적합니다. 원본 기획서가 요구한 기록 항목을 모두 포함합니다.

```text
작업:

사용 도구와 버전:

프롬프트 전문 또는 경로:

AI가 생성하거나 수정한 파일:

AI 활용 내용:

발생한 오류:

사람이 직접 수정한 내용:

AI 결과를 그대로 사용하지 않은 이유:

테스트 방법과 환경:

실제 결과:

최종 반영 여부:
```

예를 들어 좌석 중복이 실제로 발견됐다면 단순히 “수정 완료”라고 쓰지 않고, 재현 주기, 원인, 좌석을 예약한 정확한 시점, 수정 파일, 20명 재시험 결과를 함께 남겨야 합니다.

## 9. 한계와 책임

- AI가 생성한 코드는 타입 검사를 통과해도 게임 규칙·레이스 조건·브라우저 정책 문제가 남을 수 있습니다.
- 코드 생성 그래픽이라는 사실만으로 독창성 검토가 끝나는 것은 아니므로 특정 기존 캐릭터·로고와 유사하지 않은지 사람이 확인합니다.
- 라이선스와 제출 규정의 최종 판단은 프로젝트 제출자가 합니다.
- 게임의 재미와 381분 전체 경제 밸런스는 자동 검사만으로 보장할 수 없으며 장기 실제 플레이테스트가 필요합니다.
- 실제 Sites 배포와 디버그 보조 없는 1→30단계 자연 플레이는 남은 검증이며, 완료 후 결과를 추가해야 합니다. GitHub Pages 배포와 공개 URL 응답 확인은 완료했습니다.

## 10. 30단계 확장과 7~10단계 구현 기록 — 2026-07-16

**사용 도구:** OpenAI Codex, GPT-5 계열, TypeScript/Vite 명령 검사, Playwright 절차, Sites 빌드/호스팅 절차

**사용자 요청 요약:** 고양이 스낵바류 성장 구조를 참고한 30단계 경제·난이도·직원·메뉴·피버·낮/밤 디자인을 수치 문서로 정의하고, 로드맵 7~10단계인 다중 직원, 피버/오프라인/날씨, 자동 밸런싱/시각 QA, 문서/배포 검증을 구현하도록 요청했습니다.

**AI가 생성·수정한 핵심 파일:**

- `src/game/scenes/GameScene.ts`, `src/game/entities/CookingStation.ts`
- `src/game/systems/ProgressionSystem.ts`, `OfflineEarningsSystem.ts`, `SaveSystem.ts`
- `src/game/art/AtmosphereSystem.ts`, `PixelArtFactory.ts`, `SceneDecor.ts`
- `src/game/audio/SoundManager.ts`, `src/ui/HUD.ts`
- `index.html`, `src/main.ts`, `src/styles.css`, `src/debug.d.ts`
- `scripts/balance-simulator.mjs`, `scripts/release-audit.mjs`, `scripts/foundation-smoke-test.ts`
- `README.md`, `docs/game-description.md`, `docs/30-stage-economy-balance-design.md`, 본 보고서

**주요 AI 활용 내용:**

- boolean 직원 상태를 8개의 독립 작업 에이전트와 정확한 티켓 소유권으로 교체
- 셰프 수에 따른 1~4개 동시 조리 슬롯과 서버별 왕복시간·점유 구현
- FEVER의 확정 게이지, 지속/쿨다운/매출 배율과 메뉴 홍보 설계
- 오프라인 수익의 4시간·25% 효율·다음 구매비 45% 상한 순수 함수와 단위 테스트 작성
- 24개 광원, 48개 비, 12개 안개의 고정 풀과 reduced-motion 축소 규칙 작성
- 모바일 가상 키 입력, 44px 터치 대상, 색 이외의 상태 문구 구현
- 30단계 가격 이분탐색과 초보/평균/숙련 P50/P75/P90 합격선 자동 검사
- 달빛 간판 5부품 점등과 낮/노을/밤/새벽 합성 앰비언스 구현

**사람이 직접 수정한 내용:** 이번 기록 시점까지 직접 소스 편집 기록은 없습니다. 목표시간, 후반 난이도, 30단계 범위와 디자인 방향은 사용자가 결정했습니다.

**AI 제안을 그대로 사용하지 않은 부분:** 실제 `고양이 스낵바`의 비공개 내부 수치나 코드를 복제하지 않았습니다. 공개적으로 관찰 가능한 장르 패턴과 idle-game 수학을 바탕으로 별도 수치·아트·코드를 만들었습니다. 오프라인 자동 구매는 장기 접속 보상을 주지만 단계를 건너뛸 수 있어 제외했습니다.

**실제 오류와 대응:** 7~10단계 실브라우저 검증을 위해 로컬 서버 실행을 요청했으나 Codex 실행 사용량 제한으로 권한이 거절됐습니다. 제한을 우회하지 않았고, 이전 버전 스크린샷을 신규 기능 검증 증거로 재사용하지 않았습니다. 타입·스모크·시뮬레이션·프로덕션/Sites 빌드·정적 릴리스 감사는 계속 수행했습니다.

**검증 결과:** 타입 검사, 경제·진행·피버·오프라인·시계·저장 스모크 테스트, 30단계 × 3프로필 × 1,000 seed 시뮬레이션, 가격 이분탐색, 프로덕션/Sites 빌드, 대비·터치·모션·광원/파티클 상한 검사가 통과했습니다. GitHub Pages Actions 빌드·배포와 `https://junn0s.github.io/Meow/`의 HTTPS 200 응답도 확인했습니다. 평균 30단계 P50은 59분 56초, 최대 가격 보정 필요량은 0.65%, FEVER 예상 매출 기여는 10~17%입니다.

**남은 검증:** 7~10단계 신규 실브라우저 E2E, 12장 시각 회귀 재촬영과 공개 URL에서 새 게임→최종 클리어 확인입니다.
