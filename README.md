# MAPF-RL FE

MAPF-RL operator interface다. Core의 versioned REST/WebSocket contract만 사용하며 PostgreSQL이나
Redis에 직접 접근하지 않는다.

현재 Phase 0 scaffold는 Core canonical contract의 generated TypeScript representation과 drift
검증만 포함한다. React/Vite UI와 production dependency는 별도 승인 뒤 vertical slice와 함께
추가한다. 상세 기준은 [FE 설계서](docs/DESIGN.md)와
[시스템 아키텍처](../mapf-rl-docs/ARCHITECTURE.md)를 따른다.

```bash
npm ci
npm run format:check
npm run typecheck
npm run contracts:check
npm test
```
