# 🍏 DESIGN.md — MAPF-RL (Apple Design Edition)

> **"애플이 로봇 관제 시스템을 만들면 이럴 것이다."**
>
> **"MAPF-RL Operator Interface"**는 애플(Apple) 특유의 인간 중심 디자인 철학(Clarity, Deference, Depth)과 고신뢰성 다중 로봇 경로 계획(Multi-Agent Path Finding) 관제 인터페이스를 완벽하게 결합한 프리미엄 운영 대시보드입니다.

---

## 1. Apple 디자인 철학: 극도의 정제미와 운영 명료성 (Zero AI-Slop)

1. **명료함 (Clarity)**
   - 가독성을 해치는 저급한 네온 그라디언트, 인위적인 발광 효과, 조잡한 3D 이모지를 일절 배제합니다.
   - 모든 픽셀과 여백은 운영자가 **로봇 실시간 상태(Robot Telemetry)**, **작업 상태(Order Lifecycle)**, **안전 경고(Safety & Incident)**를 가장 직관적으로 읽을 수 있도록 정교하게 설계됩니다.
2. **겸손함 (Deference)**
   - UI는 맵과 로봇 데이터를 돋보이게 하는 투명한 무대 역할을 합니다.
   - 반투명 블러 글래스 네비게이션(`backdrop-blur-xl bg-[#FBFBFD]/90 dark:bg-black/85`), 부드러운 24px 라운드 벤토 박스(Bento Box) 구조, 은은한 1px 보더(`border-black/[0.06] dark:border-white/[0.08]`)를 적용합니다.
3. **깊이감 (Depth)**
   - 평면적인 요소 위에 정교한 레이어링과 섬세한 그림자(`shadow-apple-card`, `shadow-apple-drawer`), 부드러운 인터랙션 마이크로 모션을 통해 손에 잡힐 듯한 깊이감을 전달합니다.
4. **숫자의 정밀성 (Tabular Monospace Precision)**
   - 모든 좌표 `(x, y)`, 그리드 셀 `(col, row)`, 시뮬레이션 시간, 버전 시퀀스, 이벤트 번호에 `tabular-nums font-mono`를 적용하여 흔들림 없는 완벽한 열 정렬을 보장합니다.

---

## 2. 색상 팔레트 및 토큰 체계 (Apple Color Tokens)

### 2.1 Background & Surface Colors (Apple Clean Light & Dark)

| 토큰명                   | Light Hex / RGBA      | Dark Hex / RGBA             | 역할 및 적용처                                                   |
| :----------------------- | :-------------------- | :-------------------------- | :--------------------------------------------------------------- |
| `--apple-canvas`         | `#FBFBFD`             | `#000000`                   | 페이지 전체 캔버스 배경 (Apple Signature Off-White / True Black) |
| `--apple-surface`        | `#FFFFFF`             | `#1C1C1E`                   | 벤토 카드, 메인 테이블, 모달 컨테이너 배경                       |
| `--apple-surface-subtle` | `#F5F5F7` / `#EBEBED` | `#2C2C2E` / `#252528`       | 세그먼트 컨트롤 트랙, 검색창 배경, 비활성 칩                     |
| `--apple-border`         | `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.08)` | 은은한 1px 컨테이너 및 테이블 테두리                             |
| `--apple-divider`        | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.06)` | 카드 내부 구획선 및 테이블 행 구분선                             |

### 2.2 Apple Typography & Text Hierarchy

| 토큰명                   | Light Hex | Dark Hex  | 역할 및 적용처                                          |
| :----------------------- | :-------- | :-------- | :------------------------------------------------------ |
| `--apple-text-primary`   | `#1D1D1F` | `#F5F5F7` | 메인 헤드라인, 핵심 수치, 로봇 ID (Apple Dark Charcoal) |
| `--apple-text-secondary` | `#86868B` | `#86868B` | 서브헤더, 지표 레이블, 설명문 (Apple Mid Gray)          |
| `--apple-text-tertiary`  | `#A1A1A6` | `#6E6E73` | 각주, 캡션, 보조 힌트 텍스트                            |

### 2.3 Apple System Semantic Colors (Operations & Robotics)

| 토큰명           | Light Hex | Dark Hex  | 의미 및 적용처                                                 |
| :--------------- | :-------- | :-------- | :------------------------------------------------------------- |
| `--apple-blue`   | `#0071E3` | `#2997FF` | 메인 액센트, 인터랙티브 액티브 상태, 선택된 로봇/주문          |
| `--apple-green`  | `#34C759` | `#30D158` | 실행 중(Executing), 연결 정상(Connected), 전체 정상(All Clear) |
| `--apple-red`    | `#FF3B30` | `#FF453A` | 통신 단절(Disconnected), 안전 비상 정지(Safety Stop), 오류     |
| `--apple-orange` | `#FF9500` | `#FF9F0A` | 대기/일시정지(Held/Wait), 데이터 지연(Stale), 경고(Warning)    |
| `--apple-gold`   | `#D97706` | `#D97706` | 특별 상태 및 하이라이트                                        |

---

## 3. 타이포그래피 (Typography System)

- **기본 폰트**: `Pretendard`, `-apple-system`, `BlinkMacSystemFont`, `SF Pro Display`, `SF Pro Text`, `Inter`, `Nanum Gothic`, `sans-serif`
- **숫자 및 좌표 데이터**: `SF Mono`, `JetBrains Mono`, `Menlo`, `Monaco`, `tabular-nums`
- **헤딩 스케일**:
  - `Display`: 40px / 48px (Bold, Letter-spacing: -0.025em)
  - `H1`: 28px / 36px (Bold, Letter-spacing: -0.02em)
  - `H2`: 20px / 28px (SemiBold, Letter-spacing: -0.015em)
  - `H3`: 16px / 24px (SemiBold, Letter-spacing: -0.01em)
  - `Body`: 14px / 20px (Regular, Letter-spacing: -0.005em)
  - `Caption`: 12px / 16px (Medium, Letter-spacing: 0.01em)

---

## 4. UI 컴포넌트 아키텍처 (Apple Bento & Controls)

1. **Apple Navigation Bar**:
   - 높이 56px~64px (`h-14 sm:h-16`), `backdrop-blur-xl bg-[#FBFBFD]/90 dark:bg-black/85`, 섬세한 `border-b border-black/[0.04] dark:border-white/[0.08]`.
   - 하단 인디케이터 라인을 갖춘 클린 텍스트 탭 네비게이션 (`h-0.5 bg-[#0071E3] dark:bg-[#2997FF] rounded-full`).
   - 알약형 Fixture/Live API 캡슐 토글 및 원클릭 언어/테마 전환 버튼.
2. **Apple Bento Status Grid**:
   - 24px 라운드 벤토 박스 레이아웃.
   - 전체 함대 수, 주행 중 로봇, 대기 중 로봇, 통신 단절 로봇, 스냅샷 신선도를 고대비 `font-mono tabular-nums`와 미니멀 상태 바로 전달.
3. **Segmented View Mode Controls**:
   - Toss/Apple 스타일의 세그먼트 캡슐 리본 (`bg-[#F2F4F6] dark:bg-[#1C1C1E]`, active `bg-white dark:bg-[#2C2C2E] shadow-sm`).
4. **Desktop Data Table & Accessible Map View**:
   - 24px/32px 라운드 컨테이너, 은은한 행 구분선, 미니멀 타이포그래피 스탯 점(dot + text) 적용.
5. **Inspector Slide-over Drawer**:
   - 부드러운 그림자(`shadow-apple-drawer`), 모듈형 텔레메트리 벤토 카드, 복사 피드백 체크 마크 애니메이션.
