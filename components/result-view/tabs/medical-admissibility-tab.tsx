"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ConditionTestCheck,
  ConditionTestStatus,
  PdfAnalysis,
} from "@/src/types";

interface MedicalAdmissibilityTabProps {
  fileName: string;
  medicalAdmissibility?: PdfAnalysis["medicalAdmissibility"] | null;
  onScrollToPage?: (pageNumber: number) => void;
}

type ConditionKey = "cataract";

type TestRule = {
  key: string;
  label: string;
  expected: string;
  concern: string;
  evaluate: (input: {
    rawValue?: string;
    numericValue?: number;
    source?: ConditionTestCheck;
  }) => { status: ConditionTestStatus; reason?: string };
  matchers?: string[];
};

type ConditionRule = {
  key: ConditionKey;
  label: string;
  diagnosisKeywords: string[];
  tests: TestRule[];
  icdCode?: string;
};

type ConditionRow = {
  condition: string;
  test: string;
  reported: "Yes" | "No";
  icdCode?: string;
  pageNumber?: number;
  conditionKey?: string; // Added to identify which condition this row belongs to
};

function inferDefaultCataractIcdCode(
  medicalAdmissibility?: PdfAnalysis["medicalAdmissibility"] | null
): string {
  const diagnosis = (medicalAdmissibility?.diagnosis || "").toLowerCase();
  const doctorNotes = (medicalAdmissibility?.doctorNotes || "").toLowerCase();
  const conditionTestsText = (
    ((medicalAdmissibility as { conditionTests?: ConditionTestCheck[] })
      ?.conditionTests || []) as ConditionTestCheck[]
  )
    .map((ct) => {
      return `${ct.condition || ""} ${ct.matchedDiagnosis || ""} ${ct.testName || ""} ${ct.reportValue || ""} ${ct.sourceText || ""}`.toLowerCase();
    })
    .join(" ");

  const combined = `${diagnosis} ${doctorNotes} ${conditionTestsText}`.trim();

  if (
    combined.includes("secondary cataract") ||
    combined.includes("after cataract")
  ) {
    return "H26.40";
  }
  if (combined.includes("cortical")) {
    return "H25.9";
  }

  // Safe default starting point for cataract, user can change from dropdown.
  return "H25.9";
}

function matchesTestName(testName: string, rule: TestRule): boolean {
  const normalized = testName.toLowerCase();
  if (normalized.includes(rule.label.toLowerCase())) return true;
  if (rule.matchers) {
    return rule.matchers.some((matcher) => normalized.includes(matcher));
  }
  return false;
}

function matchesConditionName(
  condition: string | undefined,
  rule: ConditionRule
): boolean {
  if (!condition) return false;
  const normalized = condition.toLowerCase();
  return (
    normalized.includes(rule.label.toLowerCase()) ||
    normalized.includes(rule.key)
  );
}

/**
 * Fetches ICD-10-CM code for a medical condition using NLM API
 * Extracts the base condition name (removes parenthetical test info) for better search results
 */
async function fetchICDCode(condition: string): Promise<string | undefined> {
  try {
    // Extract the base condition name by removing parenthetical information
    // e.g., "Cataract (A-scan)" -> "Cataract", "Age-related cataract" -> "Age-related cataract"
    const baseCondition = condition.split("(")[0].trim();

    // Try searching with the base condition first
    let searchTerm = baseCondition.toLowerCase();

    const response = await fetch(
      `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(searchTerm)}&maxList=15`
    );
    const result = await response.json();
    // API returns [numFound, [codes], [names]]
    if (
      result &&
      Array.isArray(result) &&
      result.length >= 2 &&
      result[1].length > 0
    ) {
      // Prefer age-related codes if searching for cataract
      if (searchTerm.includes("cataract")) {
        const ageRelatedIndex = result[1].findIndex((code: string) =>
          code.startsWith("H25")
        );
        if (ageRelatedIndex !== -1) {
          return result[1][ageRelatedIndex];
        }
      }
      // Otherwise return the first matching ICD code
      return result[1][0];
    }
    return undefined;
  } catch (error) {
    console.error(`Error fetching ICD code for ${condition}:`, error);
    return undefined;
  }
}

const conditionRules: ConditionRule[] = [
  {
    key: "cataract",
    label: "Cataract (A-scan)",
    diagnosisKeywords: ["cataract"],
    icdCode: "H25.9", // Valid dropdown default (can be overridden by API/user)
    tests: [
      {
        key: "a_scan",
        label: "A-scan",
        expected: "",
        concern: "",
        evaluate: ({ rawValue }) => {
          // Check if A-scan is reported (Yes) or not (No)
          if (!rawValue) {
            return { status: "missing" };
          }
          const value = rawValue.toLowerCase();
          if (
            value === "yes" ||
            value.includes("a-scan") ||
            value.includes("ascan") ||
            value.includes("axial length")
          ) {
            return { status: "expected" };
          }
          return { status: "missing" };
        },
        matchers: ["a-scan", "ascan", "axial length", "axl"],
      },
    ],
  },
];

// Cataract ICD-10-CM codes with descriptions (2026)
const cataractICDCodes = [
  { code: "H26.9", description: "Unspecified cataract" },
  { code: "H25.9", description: "Unspecified age-related (senile) cataract" },
  { code: "H25.011", description: "Cortical age-related cataract, right eye" },
  { code: "H25.012", description: "Cortical age-related cataract, left eye" },
  { code: "H25.013", description: "Cortical age-related cataract, bilateral" },
  { code: "H26.40", description: "Secondary cataract, unspecified eye" },
  { code: "H26.41", description: "Secondary cataract, right eye" },
  { code: "H26.42", description: "Secondary cataract, left eye" },
  { code: "H26.43", description: "Secondary cataract, bilateral" },
];

function buildConditionRows(
  diagnosisText: string,
  conditionTests?: ConditionTestCheck[],
  icdCodeMap?: Map<string, string>
): ConditionRow[] {
  const rows: ConditionRow[] = [];

  for (const rule of conditionRules) {
    const aiCondition = conditionTests?.find((condition) =>
      matchesConditionName(condition.condition, rule)
    );
    const matchedByDiagnosis = rule.diagnosisKeywords.some((keyword) =>
      diagnosisText.includes(keyword)
    );

    // For now, always show the cataract row as a starting point,
    // even when "cataract" is not explicitly extracted.
    const shouldAlwaysShow = rule.key === "cataract";
    if (!aiCondition && !matchedByDiagnosis && !shouldAlwaysShow) {
      continue;
    }

    // Get ICD code from map or rule
    const icdCode = icdCodeMap?.get(rule.key) || rule.icdCode || undefined;

    for (const testRule of rule.tests) {
      const fallbackConditionByTest = conditionTests?.find((condition) =>
        matchesTestName(condition.testName || "", testRule)
      );
      const aiTest =
        (aiCondition &&
        matchesTestName(aiCondition.testName || "", testRule)
          ? aiCondition
          : undefined) || fallbackConditionByTest;
      const selectedCondition = aiTest || aiCondition || fallbackConditionByTest;
      const rawValue = aiTest?.reportValue || aiTest?.sourceText;

      const evaluation = testRule.evaluate({
        rawValue,
        numericValue: undefined,
        source: aiTest,
      });

      // Determine if reported (Yes) or not (No)
      const reported: "Yes" | "No" =
        evaluation.status === "expected" ||
        (rawValue && rawValue.toLowerCase() === "yes") ||
        (aiTest && aiTest.status === "expected")
          ? "Yes"
          : "No";

      // Get page number from condition
      const conditionPageNumber = selectedCondition?.pageNumber;

      rows.push({
        condition: rule.label,
        test: testRule.label,
        reported,
        icdCode,
        pageNumber: conditionPageNumber,
        conditionKey: rule.key, // Add condition key for dropdown
      });
    }
  }

  return rows;
}

export function MedicalAdmissibilityTab({
  fileName,
  medicalAdmissibility,
  onScrollToPage,
}: MedicalAdmissibilityTabProps) {
  const [icdCodeMap, setIcdCodeMap] = useState<Map<string, string>>(new Map());
  const [selectedICDCodes, setSelectedICDCodes] = useState<
    Map<string, string>
  >(new Map()); // conditionKey -> ICD code

  // Fetch ICD codes for conditions that appear in the data
  useEffect(() => {
    const fetchICDCodes = async () => {
      if (!medicalAdmissibility) return;

      const diagnosisText = (
        medicalAdmissibility.diagnosis || ""
      ).toLowerCase();
      const conditionTests =
        (medicalAdmissibility as { conditionTests?: ConditionTestCheck[] })
          .conditionTests || [];

      const newIcdCodeMap = new Map<string, string>();
      const fallbackCataractIcd = inferDefaultCataractIcdCode(medicalAdmissibility);

      // Find which conditions are present
      const presentConditions = new Set<string>();
      for (const rule of conditionRules) {
        const aiCondition = conditionTests.find((condition) =>
          matchesConditionName(condition.condition, rule)
        );
        const matchedByDiagnosis = rule.diagnosisKeywords.some((keyword) =>
          diagnosisText.includes(keyword)
        );
        const shouldAlwaysShow = rule.key === "cataract";

        if (aiCondition || matchedByDiagnosis || shouldAlwaysShow) {
          presentConditions.add(rule.key);
        }
      }

      // Fetch ICD codes for present conditions (always fetch, but use hardcoded as fallback)
      await Promise.all(
        Array.from(presentConditions).map(async (conditionKey) => {
          const rule = conditionRules.find((r) => r.key === conditionKey);
          if (!rule) return;

          // Always try to fetch from API for most up-to-date code
          const fetchedIcdCode = await fetchICDCode(rule.label);
          const icdCode =
            fetchedIcdCode ||
            (rule.key === "cataract" ? fallbackCataractIcd : undefined) ||
            rule.icdCode;

          if (icdCode) {
            newIcdCodeMap.set(conditionKey, icdCode);
          }
        })
      );

      // Initialize with best available defaults so ICD is never blank at start.
      setIcdCodeMap(newIcdCodeMap);
      setSelectedICDCodes(new Map(newIcdCodeMap));
    };

    fetchICDCodes();
  }, [medicalAdmissibility]);

  const conditionRows = medicalAdmissibility
    ? buildConditionRows(
        (medicalAdmissibility.diagnosis || "").toLowerCase(),
        (medicalAdmissibility as { conditionTests?: ConditionTestCheck[] })
          .conditionTests || [],
        icdCodeMap
      )
    : [];

  // Handle ICD code selection for cataract
  const handleICDCodeChange = (conditionKey: string, code: string) => {
    setSelectedICDCodes((prev) => {
      const newMap = new Map(prev);
      newMap.set(conditionKey, code);
      return newMap;
    });
  };

  // Get display ICD code (prefer selected, fall back to fetched)
  const getDisplayICDCode = (conditionKey: string, fetchedCode?: string) => {
    return selectedICDCodes.get(conditionKey) || fetchedCode;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Medical Admissibility Check</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!medicalAdmissibility ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
            No medical admissibility data available for this file.
          </div>
        ) : (
          <div className="space-y-4">
              {medicalAdmissibility.diagnosis && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Diagnosis
                  </div>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded-md p-3 border">
                    {medicalAdmissibility.diagnosis}
                  </div>
                </div>
              )}
              {medicalAdmissibility.doctorNotes && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Doctor Notes
                  </div>
                  <div
                    className={`text-sm text-gray-900 bg-gray-50 rounded-md p-3 border whitespace-pre-wrap ${
                      onScrollToPage &&
                      medicalAdmissibility.doctorNotesPageNumber
                        ? "cursor-pointer hover:bg-gray-100 transition-colors"
                        : ""
                    }`}
                    onClick={() => {
                      if (
                        onScrollToPage &&
                        medicalAdmissibility.doctorNotesPageNumber
                      ) {
                        onScrollToPage(
                          medicalAdmissibility.doctorNotesPageNumber
                        );
                      }
                    }}
                  >
                    {medicalAdmissibility.doctorNotes}
                  </div>
                </div>
              )}
              {conditionRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Diagnosis-Linked Test Checks
                  </div>
                  <div className="rounded-md border bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Condition</TableHead>
                          <TableHead>Test</TableHead>
                          <TableHead>ICD Code</TableHead>
                          <TableHead>ICD Description</TableHead>
                          <TableHead>Reported</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conditionRows.map((row, idx) => (
                          <TableRow
                            key={`condition-row-${idx}`}
                            className={`${
                              onScrollToPage && row.pageNumber
                                ? "cursor-pointer hover:bg-gray-50 transition-colors"
                                : ""
                            }`}
                          >
                            <TableCell
                              className="align-top text-sm font-medium text-gray-800"
                              onClick={(e) => {
                                if (onScrollToPage && row.pageNumber) {
                                  onScrollToPage(row.pageNumber);
                                }
                              }}
                            >
                              {row.condition}
                            </TableCell>
                            <TableCell
                              className="align-top"
                              onClick={(e) => {
                                if (onScrollToPage && row.pageNumber) {
                                  onScrollToPage(row.pageNumber);
                                }
                              }}
                            >
                              {row.test}
                            </TableCell>
                            <TableCell className="align-top">
                              {row.conditionKey === "cataract" ? (
                                <Select
                                  value={getDisplayICDCode(row.conditionKey, row.icdCode)}
                                  onValueChange={(code) => handleICDCodeChange(row.conditionKey!, code)}
                                >
                                  <SelectTrigger className="h-8 w-full min-w-[120px]">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {cataractICDCodes.map((icd) => (
                                      <SelectItem key={icd.code} value={icd.code}>
                                        <span className="font-mono text-sm font-medium text-blue-700">
                                          {icd.code}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : row.icdCode ? (
                                <span className="text-sm font-mono text-blue-700">
                                  {row.icdCode}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Loading...
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              {row.conditionKey === "cataract" ? (
                                <span className="text-sm text-gray-700">
                                  {cataractICDCodes.find(
                                    (icd) => icd.code === getDisplayICDCode(row.conditionKey!, row.icdCode)
                                  )?.description || "-"}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className="align-top"
                              onClick={(e) => {
                                if (onScrollToPage && row.pageNumber) {
                                  onScrollToPage(row.pageNumber);
                                }
                              }}
                            >
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  row.reported === "Yes"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {row.reported}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {!medicalAdmissibility.diagnosis &&
                !medicalAdmissibility.doctorNotes &&
                conditionRows.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No diagnosis or doctor notes available.
                  </div>
                )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
