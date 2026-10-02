/**
 * Domain types for Safety, Deadlock, Collision, Fault, and Connectivity Incidents.
 */

export type IncidentSeverity = "INFO" | "WARNING" | "CRITICAL";

export type IncidentCategory =
  | "safety"
  | "collision_risk"
  | "deadlock"
  | "fault"
  | "connectivity"
  | "contract"
  | "auth"
  | "policy";

export type IncidentStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";

export interface IncidentRelatedEntity {
  type: "ROBOT" | "ORDER" | "MAP" | "POLICY" | "CONNECTIVITY";
  id: string;
  version?: number;
}

export interface Incident {
  id: string;
  entityVersion: number;
  contentDigestSha256?: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  status: IncidentStatus;
  occurredAtUtc: string;
  simulationTimeMs: number;
  resolvedAtUtc?: string;
  acknowledgedAtUtc?: string;
  acknowledgedBy?: string;
  reasonCode: string;
  description: string;
  relatedEntity?: IncidentRelatedEntity;
  allowedActions: string[];
}
