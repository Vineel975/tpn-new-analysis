import fs from "fs";
import path from "path";
import { generateObject, NoObjectGeneratedError } from "ai";
import { getTokenCosts } from "@tokenlens/helpers";
import { getModel, ModelProvider } from "./model-provider";
import {
  ExtractionResult,
  PdfAnalysis,
  PdfDocument,
  ServiceItem,
  HospitalSummaryItem,
  MedicalAdmissibilityItem,
  PolicyEnrichmentData,
} from "./types";
import {
  baseDocumentSchema,
  medicalAdmissibilityItemSchema,
} from "./models";
import {
  CostTracker,
  TokenUsage,
  createTokenUsage,
} from "./cost-tracker";
import { z } from "zod";
import {
  normalizeMedicalAdmissibility,
} from "./shared-utils";
import {
  baseDocumentExtractionPrompt,
  medicalAdmissibilityExtractionPrompt,
} from "./prompts";
import { logger } from "./logger";

type DeductibleEntry = {
  serviceIndex: number;
  tariffDeductibleAmount?: number;
  policyDeductibleAmount?: number;
  nme?: number;
};

interface ProcessPdfOptions {
  filePath: string;
  modelName: string;
  provider: ModelProvider;
  providers: any;
  baseDocument?: PdfDocument;
  medicalAdmissibility?: MedicalAdmissibilityItem | null;
}


interface ProcessBaseDocumentOptions {
  filePath: string;
  modelName: string;
  provider: ModelProvider;
  providers: any;
}

interface ProcessMedicalAdmissibilityOptions {
  filePath: string;
  modelName: string;
  provider: ModelProvider;
  providers: any;
}

const MAX_LOG_TEXT_LENGTH = 500;

function formatGeneratedTextForLog(text: string | undefined): string {
  if (!text) return "<empty>";

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_LOG_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_LOG_TEXT_LENGTH)}... [truncated ${normalized.length - MAX_LOG_TEXT_LENGTH} chars]`;
}

function summarizeBaseDocumentExtraction(
  object: z.infer<typeof baseDocumentSchema>,
): Record<string, unknown> {
  return {
    hospitalName: object.hospitalName?.value ?? null,
    patientName: object.patientName?.value ?? null,
    totalAmount: object.totalAmount?.value ?? null,
    hasBreakdown: Boolean(object.hospitalBillBreakdown?.length),
    checklist: object.documentChecklist,
  };
}

async function processMedicalAdmissibilityWithAI({
  filePath,
  modelName,
  provider,
  providers,
}: ProcessMedicalAdmissibilityOptions): Promise<{
  medicalAdmissibility: MedicalAdmissibilityItem | null;
  cost: number;
  usage: TokenUsage;
}> {
  const fileName = path.basename(filePath);
  const pdfBuffer = fs.readFileSync(filePath);

  logger.debug(
    `[DEBUG] processMedicalAdmissibilityWithAI: Starting extraction`
  );
  try {
    const { object, usage } = await generateObject({
      model: getModel({ provider, modelName }),
      schema: medicalAdmissibilityItemSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: medicalAdmissibilityExtractionPrompt },
            {
              type: "file",
              data: pdfBuffer,
              mediaType: "application/pdf",
              filename: fileName,
            },
          ],
        },
      ],
    });

    const modelId = `${provider}/${modelName}`;
    const costs = getTokenCosts({
      modelId,
      usage: {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
      },
      providers,
    });

    const normalizedMedicalAdmissibility =
      normalizeMedicalAdmissibility(object);

    return {
      medicalAdmissibility: normalizedMedicalAdmissibility,
      cost: costs.totalUSD || 0,
      usage: createTokenUsage(usage.inputTokens || 0, usage.outputTokens || 0),
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      logger.error(
        `[ERROR] processMedicalAdmissibilityWithAI: Model failed to generate object (NoObjectGeneratedError)`
      );
      logger.error(`[ERROR] Cause:`, error.cause);
      logger.error(
        `[ERROR] Generated text snippet:`,
        formatGeneratedTextForLog(error.text)
      );
      logger.error(`[ERROR] Finish reason:`, error.finishReason);
      if (error.usage) {
        logger.error(`[ERROR] Token usage:`, error.usage);
      }
    } else {
      logger.error(
        `[ERROR] processMedicalAdmissibilityWithAI: Error occurred:`,
        error
      );
    }
    // Return null if extraction fails
    return {
      medicalAdmissibility: null,
      cost: 0,
      usage: createTokenUsage(0, 0),
    };
  }
}

async function processBaseDocumentWithAI({
  filePath,
  modelName,
  provider,
  providers,
}: ProcessBaseDocumentOptions): Promise<{
  baseDocument: z.infer<typeof baseDocumentSchema>;
  cost: number;
  usage: TokenUsage;
}> {
  const fileName = path.basename(filePath);
  // Use entire PDF for base document
  const pdfBuffer = fs.readFileSync(filePath);

  logger.debug(
    `[DEBUG] processBaseDocumentWithAI: Starting extraction (using full PDF)`
  );
  try {
    const { object, usage } = await generateObject({
      model: getModel({ provider, modelName }),
      schema: baseDocumentSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: baseDocumentExtractionPrompt },
            {
              type: "file",
              data: pdfBuffer,
              mediaType: "application/pdf",
              filename: fileName,
            },
          ],
        },
      ],
    });

    const modelId = `${provider}/${modelName}`;
    const costs = getTokenCosts({
      modelId,
      usage: {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
      },
      providers,
    });

    logger.debug(
      `[DEBUG] processBaseDocumentWithAI: Base document extraction summary:`,
      summarizeBaseDocumentExtraction(object)
    );

    return {
      baseDocument: object,
      cost: costs.totalUSD || 0,
      usage: createTokenUsage(usage.inputTokens || 0, usage.outputTokens || 0),
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      logger.error(
        `[ERROR] processBaseDocumentWithAI: Model failed to generate object (NoObjectGeneratedError)`
      );
      logger.error(`[ERROR] Cause:`, error.cause);
      logger.error(
        `[ERROR] Generated text snippet:`,
        formatGeneratedTextForLog(error.text)
      );
      logger.error(`[ERROR] Finish reason:`, error.finishReason);
      if (error.usage) {
        logger.error(`[ERROR] Token usage:`, error.usage);
      }
    } else {
      logger.error(`[ERROR] processBaseDocumentWithAI: Error occurred:`, error);
    }
    throw error;
  }
}

async function processPdfWithAI({
  filePath,
  modelName,
  provider,
  providers,
  baseDocument: providedBaseDocument,
  medicalAdmissibility: providedMedicalAdmissibility,
    }: ProcessPdfOptions): Promise<{
  analysis: PdfAnalysis;
  cost: number;
  usage: TokenUsage;
}> {
  logger.debug(`[DEBUG] processPdfWithAI: Starting processing`);

  const costs = new CostTracker();

  let baseDocument: z.infer<typeof baseDocumentSchema>;
  let hospitalSummary: HospitalSummaryItem[] = [];
  let medicalAdmissibility: MedicalAdmissibilityItem | null = null;
  let normalizedServices: ServiceItem[] | null = null;

  logger.debug(
    `[DEBUG] processPdfWithAI: Step 1/2 - document sections (base document, hospital summary, medical admissibility)`
  );
  try {
    const hasProvidedSections = providedMedicalAdmissibility !== undefined;

    if (!providedBaseDocument) {
      logger.debug(
        `[DEBUG] processPdfWithAI: Starting base document and medical admissibility extraction`
      );
      const [baseDocResult, admissResult] = await Promise.all([
        processBaseDocumentWithAI({
          filePath,
          modelName,
          provider,
          providers,
        }),
        processMedicalAdmissibilityWithAI({
          filePath,
          modelName,
          provider,
          providers,
        }),
      ]);

      logger.debug(
        `[DEBUG] processPdfWithAI: ✓ Base document and medical admissibility extraction completed`
      );
      baseDocument = baseDocResult.baseDocument;
      hospitalSummary = [];
      medicalAdmissibility = admissResult.medicalAdmissibility;
      costs.addCostedData(baseDocResult);
      costs.addCostedData(admissResult);
    } else if (hasProvidedSections) {
      logger.debug(`[DEBUG] processPdfWithAI: Using provided base document`);
      baseDocument = providedBaseDocument;
      hospitalSummary = [];
      medicalAdmissibility = providedMedicalAdmissibility || null;
      logger.debug(
        `[DEBUG] processPdfWithAI: ✓ Reuse complete - medical admissibility: ${medicalAdmissibility ? "present" : "missing"}`
      );
    } else {
      logger.debug(`[DEBUG] processPdfWithAI: Using provided base document`);
      logger.debug(
        `[DEBUG] processPdfWithAI: Starting medical admissibility extraction`
      );
      baseDocument = providedBaseDocument;
      const admissResult = await processMedicalAdmissibilityWithAI({
        filePath,
        modelName,
        provider,
        providers,
      });
      logger.debug(
        `[DEBUG] processPdfWithAI: ✓ Medical admissibility extraction completed`
      );
      hospitalSummary = [];
      medicalAdmissibility = admissResult.medicalAdmissibility;
      costs.addCostedData(admissResult);
    }
  } catch (error) {
    logger.error(`[ERROR] processPdfWithAI: Document section failed`, error);
    throw error;
  }

  logger.debug(
    `[DEBUG] processPdfWithAI: ✓ Document sections ready - hospital summary items: ${hospitalSummary.length
    }, medical admissibility: ${medicalAdmissibility ? "present" : "missing"}`
  );

  normalizedServices = [];
  const policyEnrichment: PolicyEnrichmentData = {};
  const serviceDeductibles: DeductibleEntry[] = [];

  const analysis: PdfAnalysis = {
    ...baseDocument,
    ...policyEnrichment,
    tariffNotes: "cant determine",
    tariffClarificationNote: "cant determine",
    tariffExtractionItem: [],
    isAllInclusivePackage: baseDocument.isAllInclusivePackage ?? false,
    eyeType: "cant determine",
    tariffPageNumber: null,
    services: normalizedServices || [],
    serviceDeductibles:
      serviceDeductibles.length > 0 ? serviceDeductibles : undefined,
    hospitalSummary: hospitalSummary.length > 0 ? hospitalSummary : undefined,
    medicalAdmissibility: medicalAdmissibility || undefined,
  };

  const { totalCost, usage } = costs.snapshot();
  logger.debug(
    `[DEBUG] processPdfWithAI: ✓ Processing completed (tokens: ${usage.totalTokens})`
  );
  return { analysis, cost: totalCost, usage };
}

export interface ProcessSinglePdfOptions {
  filePath: string;
  modelName: string;
  provider: ModelProvider;
  providers: any;
  timeoutMs?: number;
}

export interface ProcessSinglePdfResult {
  result: ExtractionResult;
  totals: {
    totalCost: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    successCount: number;
    errorCount: number;
    totalTimeMs: number;
  };
}

export async function processSinglePdf({
  filePath,
  modelName,
  provider,
  providers,
  timeoutMs = 600_000,
}: ProcessSinglePdfOptions): Promise<ProcessSinglePdfResult> {

  logger.debug(
    `[DEBUG] processSinglePdf: Starting processing - model: ${provider}/${modelName}, timeout: ${timeoutMs}ms`
  );
  const processingStartTime = Date.now();
  const processingTracker = new CostTracker();

  let successCount = 0;
  let errorCount = 0;

  const fileStartTime = Date.now();

  try {
    logger.debug(`[DEBUG] processSinglePdf: Starting processing`);
    // Initial extraction with primary model
    const {
      analysis: initialAnalysis,
      cost: initialCost,
      usage: initialUsage,
    } = await processPdfWithAI({
      filePath,
      modelName,
      provider,
      providers,
      baseDocument: undefined,
      medicalAdmissibility: undefined,
    });

    const initialProcessingTimeMs = Date.now() - fileStartTime;
    logger.debug(
      `[DEBUG] processSinglePdf: Initial extraction completed - time: ${initialProcessingTimeMs}ms, tokens: ${initialUsage.totalTokens}`
    );

    processingTracker.add(initialCost, initialUsage);

    const result: ExtractionResult = {
      filePath,
      analysis: initialAnalysis,
      cost: initialCost,
      usage: initialUsage,
    };

    successCount++;
        const totalTimeMs = Date.now() - processingStartTime;
        const { totalCost, usage } = processingTracker.snapshot();
        logger.debug(
          `[DEBUG] processSinglePdf: Processing completed - success: ${successCount}, errors: ${errorCount}, total time: ${totalTimeMs}ms, total tokens: ${usage.totalTokens}`
        );

        return {
          result,
          totals: {
            totalCost,
            totalPromptTokens: usage.inputTokens,
            totalCompletionTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            successCount,
            errorCount,
            totalTimeMs,
          },
        };
      } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(
      `[DEBUG] processSinglePdf: Error processing:`,
      error
    );
    logger.error(
      `[DEBUG] processSinglePdf: Error message: ${errorMessage}`
    );
    errorCount++;

    // Skip this file - don't add to results, just log and continue
  }

  const totalTimeMs = Date.now() - processingStartTime;
  const { totalCost, usage } = processingTracker.snapshot();
  logger.debug(
    `[DEBUG] processSinglePdf: Processing completed with errors - success: ${successCount}, errors: ${errorCount}, total time: ${totalTimeMs}ms, total tokens: ${usage.totalTokens}`
  );

  throw new Error("Failed to process PDF");
}
