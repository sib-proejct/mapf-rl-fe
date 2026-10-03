# MAPF-RL FE

## 웹 화면

운영(Operations) 화면 — Fixture 10Hz 모드의 예시 데이터로 맵과 로봇 함대, 작업 큐를 표시한다.

![MAPF-RL 운영 화면: 창고 맵, 로봇 함대 상태, 작업 큐](docs/images/operations-fixture.png)

## 전체 로컬 환경 실행 (Docker Compose)

Sibling 저장소가 같은 parent 아래 있고 Infra `.env`의 DB/Redis 설정이 준비되어 있으면:

```sh
cd ../mapf-rl-infra
docker compose up -d
scripts/smoke-test.sh
```

최초 실행은 이미지를 빌드하고 PostgreSQL/Redis health → Core migration·seed → API/Planner →
FE/Simulator 순서로 시작한다. 초기 빌드에는 네트워크 접근과 시간이 필요하다.
`http://127.0.0.1:5173`을 열면 로그인 없이 기본 **Live WS** 모드로 연결한다.
`warehouse-robot-1`이 준비되면 목표 **column 14, row 8**로 Order를 만든다.
시작은 **column 4, row 2**이며 재시작 후에는 저장된 checkpoint를 복원한다.

맵은 Fixture 10Hz와 같은 **32×20, 1m/cell 창고**다. Core의
`scripts/warehouse-map.json`이 원본이며 `scripts/contracts.py generate`/`check`가 FE JSON 복사본을
동기화/검사한다. Fixture의 가상 로봇·Order·이벤트는 Live 환경에 주입하지 않는다.
실제 Core Planner와 Simulator가 로봇 한 대를 운용한다.

코드 변경 후에는 `docker compose up -d --build`, 로그는
`docker compose logs --tail=100 core planner simulator fe`로 확인한다.
`docker compose stop` 또는 `docker compose down`은 데이터를 유지한다.
**`down --volumes`를 실행하지 않는다.** 기존 7×5 데모 상태도 그대로 보존한다.

DB/Redis는 Core 전용 네트워크에 있고 FE/Simulator는 별도 client 네트워크에서 Core에만 연결한다.
모든 host 포트는 `127.0.0.1`에 바인딩한다. 컨테이너용 local 인증도 Host/Origin/session/CSRF를
검증하며 `local` profile에서만 허용된다. 기본 client subnet은 `172.30.50.0/24`이며 충돌 시
Infra `.env`의 `MAPF_DEMO_SUBNET`을 변경한다. 이 구성은 운영 배포용이 아니다.

Pepper, Simulator credential, spool/checkpoint는 서로 구분된 named volume에 보존된다.
DB와 credential/pepper를 함께 유지해야 한다. 기존 파일을 지우거나 checkpoint를 삭제해 복구를
우회하지 않는다. API 재시작 후 로컬 browser session은 다음 snapshot 요청에서 자동 갱신된다.

MAPF-RL operator interface다. Core의 versioned REST/WebSocket contract만 사용하며 PostgreSQL이나
Redis에 직접 접근하지 않는다.

현재 React/Vite operator UI는 Fixture 10Hz와 Live WS 연결을 지원한다.
Core canonical contract의 generated TypeScript representation과 drift 검증을 포함한다. 상세 기준은 [FE 설계서](docs/DESIGN.md)와
[시스템 아키텍처](../mapf-rl-docs/ARCHITECTURE.md)를 따른다.

```bash
npm ci
npm run format:check
npm run typecheck
npm run contracts:check
npm test
```

### Robot-to-node commands

Select a connected, safe idle robot, then click a node in either Canvas or the
accessible list to open Yes/No confirmation inside the node inspector. Only Yes
submits an order; No preserves the robot and node information. Core's station catalog determines optional
PICK/PLACE/CHARGE actions; legacy Simulator capability cannot execute these actions.
Node clicks without a robot still inspect the node. The task queue displays server
progress and failures, and retries uncertain submissions with the same requestId.
New Order also uses the inline task queue form so the map remains visible.
Fixture mode supports movement previews; station actions require a supporting live Simulator.

### Local Live robot provisioning

로컬 Compose fleet runtime이 연결되면 로봇 목록의 **로봇 추가**에서 시작 셀을
좌표 입력 또는 지도 선택으로 지정할 수 있다. 정상 상태 보고 후 `READY`가 되면
snapshot을 갱신하고 새 로봇을 선택한다. 응답 유실에는 같은 `requestId`로 재시도하며,
실행 실패 사유는 화면에 남고 같은 로봇 ID로 재시도할 수 있다. Fixture·운영 환경,
삭제·자동 배차는 지원 범위에 포함되지 않는다. 인증 정보는 FE에 전달하지 않는다.

## 배터리 및 자동 충전

배터리 소모와 20% 이하 자동 충전을 지원한다. 진행 중인 작업은 완료한 뒤 충전하며 새 일반 작업은 제한한다. Core가 사용 가능한 충전소에 기존 CHARGE Order를 배정하고 Simulator가 100%까지 충전한다. 0%에서는 안전 정지하며 운영자 복구가 필요하다. 충전소가 없거나 점유 중이면 기다리고 재평가한다. 자세한 계약과 제한은 [Live WS 기능 현황](../mapf-rl-docs/LIVE-WS-CAPABILITIES.md#3-배터리-로직)을 참고한다.

### 거리 기반 자동 배차

Live `POST /api/v1/orders/auto-assign` (`auto-assignment 1.0.0`)은 가용 로봇의 Manhattan 거리 상위 최대 5대 중 A\* 경로 길이가 가장 짧은 로봇을 선택한다. 이동·PICK·PLACE·CHARGE를 지원하며 확정 robotId와 Order 결과를 반환한다. 같은 requestId로 재시도하고, 후보가 모두 도달 불가능하면 NO_ASSIGNABLE_ROBOT으로 실패한다. 선택된 작업은 기존 MAPF 예약을 거친다. Core → FE 순으로 적용하며 DB migration은 없다.

### 오더 큐와 운반 웨이브

Live 새 오더와 맵 노드 명령은 Core 큐에 등록한다. 로봇이 바쁘거나 연결이 끊겨 있어도 지정
작업을 등록할 수 있고, Core가 실행 직전에 가용성과 안전 상태를 검증한다. 오더 탭의
`운반 작업 / 웨이브`에서 PICK·PLACE station과 자동/지정 로봇을 선택한다. 행 하나는 운반 작업,
여러 행은 최대 100개 작업의 웨이브로 제출한다. 큐 상세에서 대기 사유, 단계, 실행 오더와
웨이브 완료·취소·보류 수를 확인할 수 있다. 화물이 남아 보류되면 같은 로봇의 PLACE 작업으로
복구한다. 불확실한 제출은 같은 requestId로 재시도한다. Fixture 모드에는 운반 웨이브를 제공하지 않는다.
