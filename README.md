# MAPF-RL FE

model-based Reinforcement Learning을 AGV, AMR 로봇의 path finding에 적용하는 repository입니다.  
중앙 서버에서 제어하는 것보다 분산형으로 각각의 에이전트로서 MAPF를 풀어보고자 합니다.  
현재, 산업용 로봇의 스펙 향상으로 충분히 가능하며, 강화학습의 결과인 policy는 단순 분포함수 이기 때문에 로봇 내부에서 큰 연산이 필요 없습니다.  
어떻게 강화학습 환경을 구축해서 state, action의 space를 줄이고, transition probabilty를 어떤 함수로 계산할 것인지에 대한 아이디어는 비공개 입니다.  
현재 아이디어 단계에 있고, 실증은 하지 못했습니다.  
궁금하신 분은 jhpark@alumni.kaist.ac.kr로 연락 주시면 감사하겠습니다.

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
`http://127.0.0.1:8000/local/login`을 열면 FE가 기본 **Live WS** 모드로 연결한다.
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
우회하지 않는다. API를 재시작하면 로컬 browser session이 바뀌므로 login URL을 다시 연다.

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
