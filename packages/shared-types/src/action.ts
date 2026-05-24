export type RiskLevel = "LOW" | "MEDIUM" | "HIGH"
export type ActionClass = "AUTO" | "QUEUE" | "BLOCK"
export type ActionStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "EXPIRED" | "FAILED"
import type { EntityType } from "./signal"

export interface ActionProposal {
  proposalId: string
  signalId: string
  entityType: EntityType
  entityId: string
  agent: string
  actionType: string
  actionPayload: Record<string, unknown>
  rationale: string
  expectedOutcome: string
  confidence: number
  riskLevel: RiskLevel
}

export interface PendingAction {
  id: string
  signalId: string
  agent: string
  actionType: string
  actionPayload: Record<string, unknown>
  rationale: string
  expectedOutcome: string
  confidence: number
  riskLevel: RiskLevel
  classification: ActionClass
  status: ActionStatus
  guardrailRule?: string | null
  approvalToken?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  rejectedAt?: string | null
  executedAt?: string | null
  executionResult?: Record<string, unknown> | null
  expiresAt: string
  createdAt: string
}

export interface ApprovalRequest {
  decision: "approve" | "reject"
  reason?: string
  modifiedPayload?: Record<string, unknown>
}

export interface ApprovalResponse {
  status: "ok"
  actionId: string
  decision: "approved" | "rejected"
}
