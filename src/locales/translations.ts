export type Language = "ko" | "en";

export const translations = {
  ko: {
    // Navigation
    navOperations: "운영 (Operations)",
    navOrders: "작업 (Orders)",
    navScenarios: "시나리오 (Scenarios)",
    navPolicies: "정책 (Policies)",
    navEvents: "이벤트 (Events)",

    // Header & Environment
    envLabel: "환경",
    envLocal: "로컬",
    envDev: "개발",
    envProd: "운영",
    themeLight: "라이트 모드",
    themeDark: "다크 모드",
    langKo: "한국어",
    langEn: "English",

    // Freshness & Connectivity
    freshnessCurrent: "최신 (Current)",
    freshnessStale: "지연됨 (Stale)",
    freshnessPartial: "부분 데이터 (Partial)",
    freshnessDisconnected: "연결 끊김 (Disconnected)",
    freshnessReconciling: "동기화 중 (Reconciling)",

    // Operational States
    stateIdle: "대기 (IDLE)",
    stateExecuting: "실행 중 (EXECUTING)",
    stateHeld: "일시정지 (HELD)",
    stateStopped: "정지됨 (STOPPED)",
    stateUnknown: "알 수 없음 (UNKNOWN)",

    // Connectivity States
    connConnected: "연결됨 (Connected)",
    connDegraded: "불안정 (Degraded)",
    connDisconnected: "연결 끊김 (Disconnected)",

    // Safety States
    safetyNormal: "정상 (NORMAL)",
    safetyWait: "대기 (WAIT)",
    safetyControlledStop: "제어 정지 (CONTROLLED STOP)",
    safetyEmergencyStop: "비상 정지 (EMERGENCY STOP)",
    safetyReject: "명령 거부 (REJECT)",
    safetyFault: "오류 (FAULT)",

    // Order Lifecycle
    orderSubmitted: "제출됨 (Submitted)",
    orderPlanning: "계획 중 (Planning)",
    orderDispatchable: "배정 가능 (Dispatchable)",
    orderDispatched: "배정됨 (Dispatched)",
    orderApplied: "적용됨 (Applied)",
    orderExecuting: "실행 중 (Executing)",
    orderReplanning: "재계획 중 (Replanning)",
    orderHeld: "보류됨 (Held)",
    orderCancelling: "취소 중 (Cancelling)",
    orderCompleted: "완료됨 (Completed)",
    orderCancelled: "취소됨 (Cancelled)",
    orderRejected: "거절됨 (Rejected)",

    // Bento Status Rail
    bentoFleetTotal: "전체 로봇",
    bentoExecuting: "실행 중",
    bentoHeldOrIdle: "대기 / 보류",
    bentoDisconnected: "연결 끊김",
    bentoFreshness: "스냅샷 상태",
    bentoSnapshotAt: "마지막 스냅샷",

    // Incidents / Alerts Strip
    incidentSafetyActive: "안전 정지 경보가 활성화되었습니다",
    incidentDisconnectedAlert: "대수의 로봇이 오프라인 상태입니다",
    incidentStaleWarning: "데이터가 최신 상태가 아닙니다 (Stale snapshot)",
    incidentPartialWarning:
      "일부 데이터 소스가 누락되었습니다 (Partial snapshot)",
    incidentAllClear: "모든 시스템과 로봇이 정상 운영 중입니다",

    // Map Canvas
    mapTitle: "맵 시각화",
    mapZoomIn: "확대",
    mapZoomOut: "축소",
    mapResetView: "화면 맞춤",
    mapFitFleet: "로봇 중심",
    mapLayerGrid: "격자선",
    mapLayerObstacles: "장애물",
    mapLayerGoals: "목표 지점",
    mapLayerLabels: "로봇 라벨",
    mapAccessibleView: "접근성 목록 보기",
    mapCanvasView: "캔버스 지도 보기",
    mapResolution: "해상도",
    mapDimensions: "크기",
    mapOrigin: "원점",
    mapBlockedCount: "장애물 셀 수",
    mapTraversable: "통행 가능",
    mapBlocked: "통행 불가",

    // Accessible Alternative List
    a11yTableTitle: "맵 및 로봇 상태 접근성 데이터 목록",
    a11yTableDescription:
      "시각적 지도와 동일한 위치, 상태, 목표 좌표를 제공하는 스크린 리더 및 키보드 접근성 표입니다.",
    a11yColRobotId: "로봇 ID",
    a11yColPose: "월드 좌표 (X, Y, Yaw)",
    a11yColCell: "격자 좌표 (열, 행)",
    a11yColState: "동작 상태",
    a11yColConnectivity: "연결 상태",
    a11yColSafety: "안전 상태",
    a11yColOrder: "배정 작업",
    a11yColAction: "선택",
    a11ySelectRobot: "로봇 {id} 선택 및 세부정보 열기",

    // Robot List
    robotListTitle: "로봇 목록",
    robotListSearch: "로봇 ID 검색...",
    robotListFilterAll: "전체",
    robotNoRobots: "등록된 로봇이 없습니다",
    robotKeyboardHint:
      "목록에서 ↑ / ↓ 키로 이동하고 Enter 키로 선택할 수 있습니다",

    // Order List
    orderListTitle: "활성 작업 목록",
    orderNoOrders: "현재 활성화된 작업이 없습니다",
    orderUpdateIdLabel: "업데이트 순번",
    orderAssignedRobot: "배정 로봇",
    orderGoal: "목표 위치",

    // Robot Inspector Drawer
    inspectorTitle: "로봇 상세 정보",
    inspectorNoSelection:
      "선택된 로봇이 없습니다. 지도나 목록에서 로봇을 선택하세요.",
    inspectorClose: "닫기 (Esc)",
    inspectorPose: "수신된 위치 (Pose)",
    inspectorCell: "격자 좌표",
    inspectorStateAge: "상태 수신 경과 시간",
    inspectorSimTime: "시뮬레이션 시간",
    inspectorEpoch: "세션 에포크",
    inspectorActiveController: "활성 제어기",
    inspectorSafetyStatus: "안전 상태",
    inspectorActiveOrder: "진행 중인 작업",
    inspectorCopySuccess: "복사되었습니다",
    inspectorCopyId: "ID 복사",

    // State Views (Loading, Empty, Error)
    stateLoadingTitle: "스냅샷 로딩 중...",
    stateLoadingDesc: "Core API로부터 최신 상태 데이터를 수신하고 있습니다.",
    stateEmptyTitle: "표시할 운영 데이터가 없습니다",
    stateEmptyDesc: "활성화된 맵이나 등록된 로봇이 존재하지 않습니다.",
    stateErrorTitle: "스냅샷 로드 실패",
    stateErrorRetry: "다시 시도",
    stateErrorCode: "오류 코드",
    stateTraceId: "추적 ID (Trace ID)",
    stateRequestId: "요청 ID (Request ID)",

    // Data Source Toggle
    sourceLive: "실제 Core API 스냅샷",
    sourceFixture: "Canonical Fixture 모드",
    sourceToggleHint:
      "백엔드 연동 상태와 관계없이 Fixture로 검증할 수 있습니다.",

    // Footer
    footerCopyright: "© 2026 MAPF-RL Platform. Operator Client.",
    footerDocs: "설계 문서",
  },
  en: {
    // Navigation
    navOperations: "Operations",
    navOrders: "Orders",
    navScenarios: "Scenarios",
    navPolicies: "Policies",
    navEvents: "Events",

    // Header & Environment
    envLabel: "ENV",
    envLocal: "LOCAL",
    envDev: "DEV",
    envProd: "PROD",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    langKo: "한국어",
    langEn: "English",

    // Freshness & Connectivity
    freshnessCurrent: "Current",
    freshnessStale: "Stale",
    freshnessPartial: "Partial",
    freshnessDisconnected: "Disconnected",
    freshnessReconciling: "Reconciling",

    // Operational States
    stateIdle: "IDLE",
    stateExecuting: "EXECUTING",
    stateHeld: "HELD",
    stateStopped: "STOPPED",
    stateUnknown: "UNKNOWN",

    // Connectivity States
    connConnected: "Connected",
    connDegraded: "Degraded",
    connDisconnected: "Disconnected",

    // Safety States
    safetyNormal: "NORMAL",
    safetyWait: "WAIT",
    safetyControlledStop: "CONTROLLED STOP",
    safetyEmergencyStop: "EMERGENCY STOP",
    safetyReject: "REJECT",
    safetyFault: "FAULT",

    // Order Lifecycle
    orderSubmitted: "Submitted",
    orderPlanning: "Planning",
    orderDispatchable: "Dispatchable",
    orderDispatched: "Dispatched",
    orderApplied: "Applied",
    orderExecuting: "Executing",
    orderReplanning: "Replanning",
    orderHeld: "Held",
    orderCancelling: "Cancelling",
    orderCompleted: "Completed",
    orderCancelled: "Cancelled",
    orderRejected: "Rejected",

    // Bento Status Rail
    bentoFleetTotal: "Total Fleet",
    bentoExecuting: "Executing",
    bentoHeldOrIdle: "Held / Idle",
    bentoDisconnected: "Disconnected",
    bentoFreshness: "Snapshot Freshness",
    bentoSnapshotAt: "Snapshot At",

    // Incidents / Alerts Strip
    incidentSafetyActive: "Safety stop alert is currently active",
    incidentDisconnectedAlert: "robot(s) are currently offline",
    incidentStaleWarning: "Snapshot telemetry is stale",
    incidentPartialWarning: "Snapshot source is incomplete (Partial data)",
    incidentAllClear: "All systems and robots operating normally",

    // Map Canvas
    mapTitle: "Map Visualization",
    mapZoomIn: "Zoom In",
    mapZoomOut: "Zoom Out",
    mapResetView: "Fit Map",
    mapFitFleet: "Fit Fleet",
    mapLayerGrid: "Grid",
    mapLayerObstacles: "Obstacles",
    mapLayerGoals: "Goals",
    mapLayerLabels: "Robot Labels",
    mapAccessibleView: "View Accessible Table",
    mapCanvasView: "View Map Canvas",
    mapResolution: "Resolution",
    mapDimensions: "Dimensions",
    mapOrigin: "Origin",
    mapBlockedCount: "Blocked Cells",
    mapTraversable: "Traversable",
    mapBlocked: "Blocked",

    // Accessible Alternative List
    a11yTableTitle: "Map and Robot Telemetry Accessible Table",
    a11yTableDescription:
      "Keyboard and screen-reader accessible alternative providing identical coordinates, states, and order assignments as the visual map.",
    a11yColRobotId: "Robot ID",
    a11yColPose: "World Pose (X, Y, Yaw)",
    a11yColCell: "Grid Cell (Col, Row)",
    a11yColState: "State",
    a11yColConnectivity: "Connectivity",
    a11yColSafety: "Safety",
    a11yColOrder: "Assigned Order",
    a11yColAction: "Action",
    a11ySelectRobot: "Select robot {id} and open details",

    // Robot List
    robotListTitle: "Robots",
    robotListSearch: "Search robot ID...",
    robotListFilterAll: "All",
    robotNoRobots: "No robots found",
    robotKeyboardHint: "Use ↑ / ↓ arrow keys to navigate and Enter to select",

    // Order List
    orderListTitle: "Active Orders",
    orderNoOrders: "No active orders currently",
    orderUpdateIdLabel: "Update ID",
    orderAssignedRobot: "Assigned Robot",
    orderGoal: "Goal Cell",

    // Robot Inspector Drawer
    inspectorTitle: "Robot Inspector",
    inspectorNoSelection:
      "No robot selected. Choose a robot from the map or list.",
    inspectorClose: "Close (Esc)",
    inspectorPose: "Accepted Pose",
    inspectorCell: "Grid Cell",
    inspectorStateAge: "State Age",
    inspectorSimTime: "Simulation Time",
    inspectorEpoch: "Session Epoch",
    inspectorActiveController: "Active Controller",
    inspectorSafetyStatus: "Safety Status",
    inspectorActiveOrder: "Active Order",
    inspectorCopySuccess: "Copied to clipboard",
    inspectorCopyId: "Copy ID",

    // State Views (Loading, Empty, Error)
    stateLoadingTitle: "Loading Snapshot...",
    stateLoadingDesc: "Fetching latest state data from Core API.",
    stateEmptyTitle: "No Operations Data Available",
    stateEmptyDesc: "No active map or registered robots in this session.",
    stateErrorTitle: "Snapshot Fetch Failed",
    stateErrorRetry: "Retry",
    stateErrorCode: "Error Code",
    stateTraceId: "Trace ID",
    stateRequestId: "Request ID",

    // Data Source Toggle
    sourceLive: "Live Core API Snapshot",
    sourceFixture: "Canonical Fixture Mode",
    sourceToggleHint:
      "Toggle between live Core API snapshot and canonical offline fixtures.",

    // Footer
    footerCopyright: "© 2026 MAPF-RL Platform. Operator Client.",
    footerDocs: "Design Documentation",
  },
};
