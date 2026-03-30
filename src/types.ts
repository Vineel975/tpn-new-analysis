import type { z } from "zod";
import { TokenUsage } from "./cost-tracker";
import {
  documentSchema,
  hospitalBillBreakdownItemSchema,
  hospitalSummaryItemSchema,
  medicalAdmissibilityItemSchema,
  tariffBreakdownItemSchema,
} from "./models";

export type ConditionTestStatus =
  | "expected"
  | "concern"
  | "missing"
  | "uncertain";

export type EyeType =
  | "left eye"
  | "right eye"
  | "both eyes"
  | "cant determine";

export type LensTypeApproval = boolean | "cant determine";

export interface ConditionTestCheck {
  condition: string;
  matchedDiagnosis?: string;
  pageNumber?: number;
  testName: string;
  reportValue?: string;
  numericValue?: number | null;
  unit?: string;
  status?: ConditionTestStatus;
  sourceText?: string;
}

export interface ServiceItem {
  serviceName?: string;
  amount?: number | null;
  quantity?: number | null;
  date?: string | null;
  parent?: string;
  subCategory?: string;
  tariff?: number;
  serviceCode?: string;
  [key: string]: unknown;
}
export type HospitalBillBreakdownItem = z.infer<
  typeof hospitalBillBreakdownItemSchema
>;
export type HospitalSummaryItem = z.infer<typeof hospitalSummaryItemSchema>;
export type MedicalAdmissibilityItem = z.infer<
  typeof medicalAdmissibilityItemSchema
>;
export type TariffBreakdownItem = z.infer<typeof tariffBreakdownItemSchema>;
export type PdfDocument = z.infer<typeof documentSchema>;

// Policy data from Excel file (enriched after extraction, not from AI)
// Only the 10 fields needed for policy audit tab
export interface PolicyEnrichmentData {
  policyStartDate?: string;
  policyEndDate?: string;
  sumInsured?: string;
  relationship?: string; // Relationship with Proposer
  dob?: string; // Date of Birth
  gender?: string;
  certificateNumber?: string;
  tpaName?: string;
}

export type DocumentChecklist = PdfDocument["documentChecklist"];

export interface TariffEnrichmentData {
  tariffNotes: string;
  tariffClarificationNote: string;
  tariffExtractionItem: TariffBreakdownItem[];
  lensType?: string;
  lensTypePageNumber?: number | null;
  lensTypeApproved?: LensTypeApproval;
  eyeType: EyeType;
  tariffPageNumber: number | null;
}

export type PatientValidationStatus =
  | "matched"
  | "needs_review"
  | "not_found"
  | "skipped"
  | "error";

export interface PatientValidationField {
  field: "patientName" | "patientAge" | "patientGender" | "policyNumber";
  label: string;
  aiValue: string | number | null;
  dbValue: string | number | null;
  isMatch: boolean;
  aiSource: string;
  dbSource: string;
}

export interface PatientValidationResult {
  status: PatientValidationStatus;
  matchedClaimId?: number;
  matchedMemberPolicyId?: number;
  matchedMemberName?: string;
  matchedUhid?: string;
  fields: PatientValidationField[];
  mismatchCount: number;
  matchedCount: number;
  message?: string;
}

export interface PatientInfoDbSection {
  name: string;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export interface PatientInfoDbSnapshot {
  claimId: string;
  slNo: number;
  generatedAt: string;
  sections: PatientInfoDbSection[];
  errors?: string[];
}

export type InsurerType = "niac" | "psu" | "other" | "cant determine";
export type PolicySegmentType = "retail" | "corporate" | "cant determine";

export interface PolicyRuleContext {
  insurerType?: InsurerType;
  policySegment?: PolicySegmentType;
  sumInsuredAmount?: number | null;
  niacFlexiFloater?: boolean;
  hasNoCataractLimitClause?: boolean;
  geoLensCap7000Applicable?: boolean;
}

export type PdfAnalysis = PdfDocument &
  PolicyEnrichmentData &
  TariffEnrichmentData & {
    baseInsurerPayable?: number;
    benefitAmount?: number | null;
    benefitPlanText?: string;
    finalInsurerPayable?: number;
    finalInsurerPayableNotes?: string;
    patientValidation?: PatientValidationResult;
    patientInfoDb?: PatientInfoDbSnapshot;
    policyRuleContext?: PolicyRuleContext;
  };

export type { TokenUsage } from "./cost-tracker";

export interface ExtractionResult {
  filePath: string;
  analysis: PdfAnalysis;
  cost?: number;
  usage: TokenUsage;
  processingTimeMs?: number;
  processingTime?: string;
  fallbackAnalysis?: PdfAnalysis;
  fallbackCost?: number;
  fallbackUsage?: TokenUsage;
  changelogEntries?: Array<{
    id: string;
    timestamp: string; // ISO string for serialization
    tab: string;
    record: string;
    field: string;
    previousValue: string;
    newValue: string;
  }>;
}
