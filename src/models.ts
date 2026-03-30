import { z } from "zod";

export const hospitalBillBreakdownItemSchema = z.object({
  name: z
    .string()
    .describe(
      "Name of the component (e.g., 'Actual Bill', 'Lens Bill', 'Implant Cost', 'Room Charges', 'Procedure Charges'). For procedure charges use exactly 'Procedure Charges'—do not expand with sub-categories.",
    ),
  amount: z.number().describe("Amount for this component"),
});

export const tariffBreakdownItemSchema = z.object({
  code: z
    .string()
    .describe(
      "Tariff code/identifier for this component (use 'cant determine' if unavailable)",
    ),
  name: z
    .string()
    .describe(
      "Tariff component label as inferred from tariff/package logic (e.g., 'Procedure Package', 'Lens Cap', 'Room Rent Cap', 'Consumables Cap')",
    ),
  amount: z
    .number()
    .describe("Amount allocated to this tariff component in INR"),
});

export const hospitalSummaryItemSchema = z.object({
  serviceName: z
    .string()
    .describe(
      "Name of the summary category from the hospital bill summary (e.g., 'Consultation', 'Investigations', 'Pharmacy', 'Room Charges')",
    ),
  amount: z
    .number()
    .describe(
      "Total amount for this summary category (aggregated amount, not individual line items)",
    ),
});

export const medicalAdmissibilityItemSchema = z.object({
  diagnosis: z
    .string()
    .describe(
      "The medical diagnosis or condition identified from the document",
    ),
  doctorNotes: z
    .string()
    .describe(
      "Handwritten notes or physical remarks written by the doctor. This should be actual written notes, observations, or comments physically written by the doctor, NOT formal diagnosis statements or nature of illness (those belong in the diagnosis field).",
    ),
  doctorNotesPageNumber: z
    .number()
    .optional()
    .describe(
      "The PDF page index (1-based) where the doctor's notes appear. CRITICAL: This must be the actual PDF page index from the beginning of the PDF file, NOT any page numbers printed on the pages.",
    ),
  conditionTests: z
    .array(
      z.object({
        condition: z.string(),
        matchedDiagnosis: z.string(),
        pageNumber: z
          .number()
          .describe(
            "The PDF page index (1-based) where this specific condition/diagnosis appears. CRITICAL: This must be the actual PDF page index from the beginning of the PDF file, NOT any page numbers printed on the pages.",
          ),
        testName: z.string(),
        reportValue: z.string(),
        numericValue: z.number().nullable(),
        unit: z.string(),
        status: z.enum(["expected", "concern", "missing", "uncertain"]),
        sourceText: z.string(),
      }),
    )
    .describe(
      "Array of condition tests. Each entry represents a single test with its condition and details.",
    ),
});

const extractedFieldSchema = <T extends z.ZodTypeAny>(
  valueSchema: T,
  valueDescription: string,
) =>
  z.object({
    value: valueSchema.describe(valueDescription),
    pageNumber: z
      .number()
      .describe(
        "The PDF page index (1-based) where this value appears. This is required whenever you return a value. Use the physical PDF page number, not any printed page number.",
      ),
  });

const documentPresenceSchema = (label: string) =>
  extractedFieldSchema(
    z.boolean(),
    `Whether ${label} is present/visible in the PDF`,
  );

export const baseDocumentSchema = z.object({
  hospitalName: extractedFieldSchema(z.string(), "Hospital name"),
  patientName: extractedFieldSchema(z.string(), "Patient name"),
  patientAge: extractedFieldSchema(
    z.number(),
    'Patient age. Look for "Age", "Age (Yrs)" labels.',
  ),
  patientGender: extractedFieldSchema(
    z.string().nullable().optional(),
    "Patient gender if mentioned",
  ),
  policyNumber: extractedFieldSchema(
    z.string().nullable().optional(),
    'Policy number if mentioned. Look for "IP Number", "Policy No", "Member ID", "ID Card No" labels.',
  ),
  invoiceNumber: extractedFieldSchema(
    z.string().nullable().optional(),
    'Invoice number if mentioned. Look for "Bill No", "Invoice No" labels.',
  ),
  admissionDate: extractedFieldSchema(
    z.string().nullable().optional(),
    "Admission date if mentioned",
  ),
  dischargeDate: extractedFieldSchema(
    z.string().nullable().optional(),
    "Discharge date if mentioned",
  ),
  date: extractedFieldSchema(
    z.string().nullable().optional(),
    "Document date if mentioned",
  ),
  totalAmount: extractedFieldSchema(
    z.number(),
    "Total amount (this is the final bill amount AFTER discount, if any discount is applied)",
  ),
  discount: extractedFieldSchema(
    z.number().nullable().optional(),
    "Discount amount if mentioned. Look for 'Discount', 'Less: Discount', 'Rebate', 'Concession' in the bill summary. This should be a positive number representing the discount given.",
  ),
  gst: extractedFieldSchema(
    z
      .object({
        gstAmount: z
          .number()
          .nullable()
          .optional()
          .describe("Total GST amount if mentioned as a single value"),
        cgstAmount: z
          .number()
          .nullable()
          .optional()
          .describe("Central GST (CGST) amount if mentioned separately"),
        sgstAmount: z
          .number()
          .nullable()
          .optional()
          .describe("State GST (SGST) amount if mentioned separately"),
      })
      .nullable()
      .optional(),
    "GST (Goods and Services Tax) information if present in the document. Use one shared pageNumber for the GST block.",
  ),
  hospitalBillBreakdown: z
    .array(hospitalBillBreakdownItemSchema)
    .nullable()
    .optional()
    .describe(
      "Array of hospital bill breakdown components. Extract major components that make up hospital bill total, such as 'Actual Bill', 'Lens Bill', 'Implant Cost', 'Room Charges', 'Procedure Charges', 'Consumables', etc. For procedure charges use exactly 'Procedure Charges'—do not expand with sub-categories. The sum of these breakdown items should match or be close to total hospital bill amount.",
    ),
  isAllInclusivePackage: z
    .boolean()
    .describe(
      "True when hospital bill is clearly all-inclusive/package style; false otherwise",
    ),
  documentChecklist: z
    .object({
      aadharCard: documentPresenceSchema("Aadhar Card"),
      panCard: documentPresenceSchema("PAN Card"),
      eCard: documentPresenceSchema(
        "E-Card (Health Card/Insurance Card)",
      ),
      invoiceForSurgical: documentPresenceSchema(
        "Invoice for Surgical document",
      ),
      kyc: documentPresenceSchema("KYC document"),
      claimForm: documentPresenceSchema("Claim Form"),
    })
    .describe(
      "Document checklist indicating which documents are present in the PDF. Mark as true only if the document is clearly visible and identifiable. If a document is not present, mark it as false. For each document that is present, also record the page number where it appears.",
    ),
});

export const documentSchema = baseDocumentSchema.extend({
  services: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  serviceDeductibles: z
    .array(
      z.object({
        serviceIndex: z.number(),
        policyDeductibleAmount: z.number().nullable().optional(),
        tariffDeductibleAmount: z.number().nullable().optional(),
        nme: z.number().nullable().optional(),
      }),
    )
    .nullable()
    .optional()
    .describe(
      "Array of deductible amounts for services. Maps service indices to their policy deductible, tariff deductible, and NME amounts.",
    ),
  hospitalSummary: z
    .array(hospitalSummaryItemSchema)
    .nullable()
    .optional()
    .describe(
      "Array of hospital bill summary categories extracted from the first few pages (typically first 4 pages) of the PDF. Extract summary-level categories (e.g., 'Consultation', 'Investigations', 'Pharmacy') with their total amounts from summary sections that appear at the beginning of the bill. Do NOT extract individual line items - only extract category summaries with aggregated totals.",
    ),
  hospitalBillBreakdown: z
    .array(hospitalBillBreakdownItemSchema)
    .nullable()
    .optional()
    .describe(
      "Array of hospital bill breakdown components. Extract the major components that make up the hospital bill total, such as 'Actual Bill', 'Lens Bill', 'Implant Cost', 'Room Charges', etc. Look for sections or summaries that show these components separately. The sum of these breakdown items should match the total hospital bill amount.",
    ),
  medicalAdmissibility: medicalAdmissibilityItemSchema
    .nullable()
    .optional()
    .describe(
      "Medical admissibility information. Extract all diagnoses and doctor notes from medical admissibility documents, clinical reports, or physician notes. Combine all diagnoses together and all doctor notes together.",
    ),
});

export const policyAdjustmentSchema = z.object({
  benefitAmount: z.number().nullable().optional(),
  adjustmentNotes: z.string().nullable().optional(),
  insurerType: z
    .enum(["niac", "psu", "other", "cant determine"])
    .nullable()
    .optional(),
  policySegment: z
    .enum(["retail", "corporate", "cant determine"])
    .nullable()
    .optional(),
  sumInsuredAmount: z.number().nullable().optional(),
  niacFlexiFloater: z.boolean().nullable().optional(),
  hasNoCataractLimitClause: z.boolean().nullable().optional(),
  geoLensCap7000Applicable: z.boolean().nullable().optional(),
});

export const tariffCalculationSchema = z.object({
  tariffExtractionItem: z
    .array(tariffBreakdownItemSchema)
    .describe(
      "Primary extracted tariff components list. Include itemized components such as procedure amount and lens amount as separate entries when present.",
    ),
  lensType: z
    .string()
    .describe("Lens/IOL type (e.g., Monofocal, Multifocal, Toric)"),
  lensTypePageNumber: z
    .number()
    .describe(
      "Tariff PDF page index (1-based) where the lens type reference appears; return 0 if not found",
    ),
  lensTypeApproved: z
    .union([z.boolean(), z.literal("cant determine")])
    .describe(
      'Lens applicability result from AI: return "cant determine" when lens type is cant determine; return false when policy wording indicates lens type is not applicable; otherwise return true',
    ),
  eyeType: z
    .enum(["left eye", "right eye", "both eyes", "cant determine"])
    .describe("Eye type: left eye, right eye, both eyes, or cant determine"),
  tariffPageNumber: z
    .number()
    .describe(
      "Tariff PDF page index (1-based) where the tariff reference appears; return 0 if not found",
    ),
  calculationNotes: z
    .string()
    .describe("Succinct tariff calculation explanation (max 3–4 sentences)"),
  clarificationNote: z
    .string()
    .describe("Succinct clarification note (max 2–3 sentences)"),
});
