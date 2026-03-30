"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { tabsListVariants } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProcessingState } from "@/src/processing-service";
import type { ExtractionResult, PdfAnalysis } from "@/src/types";
import { ChangeLog } from "@/src/changelog";
import { computeClaimCalculation } from "@/src/claim-calculation";
import { ProcessingLogs } from "./result-view/processing-logs";
import { PdfViewerPanel } from "./result-view/pdf-viewer-panel";
import { PatientInfoTab } from "./result-view/tabs/patient-info-tab";
import { MedicalAdmissibilityTab } from "./result-view/tabs/medical-admissibility-tab";
import { FinancialSummaryTab } from "./result-view/tabs/financial-summary-tab";
import { ChangeLogTab } from "./result-view/tabs/changelog-tab";
import { useMutation as useConvexMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";

function getBasename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

interface ResultViewProps {
  hospitalBill: File | string | null;
  tariffFile: File | string | null;
  showSampleData: boolean;
  state: ProcessingState | undefined;
  isProcessing: boolean;
  selectedFileResult: ExtractionResult | null;
  selectedAnalysis: PdfAnalysis | null;
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
  onDocumentLoadError: (error: Error) => void;
  pdfError: Error | null;
}

export function ResultView({
  hospitalBill,
  tariffFile,
  showSampleData,
  state,
  isProcessing,
  selectedFileResult,
  selectedAnalysis,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  pdfError,
}: ResultViewProps) {
  const updateResult = useConvexMutation(api.processing.updateResult);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfWidth, setPdfWidth] = useState<number>(800);
  const [activePdfFile, setActivePdfFile] = useState<
    "hospital" | "tariff" | "benefitPlan"
  >("hospital");
  const [pdfPages, setPdfPages] = useState<{
    hospital: number;
    tariff: number;
  }>({
    hospital: 0,
    tariff: 0,
  });
  const reportSections = useMemo(
    () => [
      { id: "patient", label: "Patient Info" },
      // { id: "hospitalSummary", label: "Hospital Summary" },
      // { id: "lines", label: "TPA Lines" },
      // { id: "policyAudit", label: "Policy Audit" },
      { id: "medicalAdmissibility", label: "Medical Admissibility" },
      // { id: "summary", label: "TPA Summary" },
      { id: "financialSummary", label: "Summary" },
      { id: "changelog", label: "Change Log" },
    ],
    [],
  );
  const [activeSection, setActiveSection] = useState(reportSections[0].id);
  const reportScrollRef = useRef<HTMLDivElement>(null);
  const [editedAnalysis, setEditedAnalysis] = useState<PdfAnalysis | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const changeLogRef = useRef(new ChangeLog());
  const pendingChangesRef = useRef(new ChangeLog()); // Track pending changes separately
  const [changeLogVersion, setChangeLogVersion] = useState(0);
  const changeLog = changeLogRef.current;
  const pendingChanges = pendingChangesRef.current;
  const [logContentVisible, setLogContentVisible] = useState(true);
  const [isLogsPanelForced, setIsLogsPanelForced] = useState(false);
  const [logs, setLogs] = useState<Array<{ id: string; message: string }>>([]);
  const [reviewDecision, setReviewDecision] = useState<
    "approve" | "deny" | "query" | null
  >(null);
  const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
  const [queryType, setQueryType] = useState("");
  const [queryMessage, setQueryMessage] = useState("");

  // Helper to trigger re-render when changelog updates
  const updateChangeLog = () => {
    setChangeLogVersion((v) => v + 1);
  };

  // Helper to add pending change entry (not added to changelog until save)
  const addChangeLogEntry = (
    tab: string,
    record: string,
    field: string,
    previousValue: string | number | null | undefined,
    newValue: string | number | null | undefined,
  ) => {
    // Add to pending changes instead of changelog
    pendingChanges.addEntry(tab, record, field, previousValue, newValue);
    updateChangeLog();
  };

  // Set active PDF file to first available file
  useEffect(() => {
    if (hospitalBill && activePdfFile !== "hospital") {
      setActivePdfFile("hospital");
    } else if (!hospitalBill && tariffFile && activePdfFile !== "tariff") {
      setActivePdfFile("tariff");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalBill, tariffFile]);

  // Consume backend debug logs directly from processing state
  useEffect(() => {
    if (!state?.logs) return;
    const formatted = state.logs.map((entry, idx) => ({
      id: `${entry.timestamp}-${idx}`,
      message: entry.message,
    }));
    setLogs(formatted);
  }, [state?.logs]);

  // Initialize editedAnalysis when selectedAnalysis changes
  // Use a ref to track the last initialized filePath to avoid resetting on re-renders
  const lastInitializedFilePathRef = useRef<string | null>(null);
  useEffect(() => {
    const currentFilePath = selectedFileResult?.filePath;
    // Only initialize if filePath changed (don't reset on re-renders with same file)
    if (
      selectedAnalysis &&
      selectedFileResult &&
      currentFilePath !== lastInitializedFilePathRef.current
    ) {
      setEditedAnalysis(JSON.parse(JSON.stringify(selectedAnalysis)));

      // Restore changelog from saved data instead of clearing it
      if (
        selectedFileResult.changelogEntries &&
        selectedFileResult.changelogEntries.length > 0
      ) {
        changeLog.load(selectedFileResult.changelogEntries);
      } else {
        changeLog.clear(); // Only clear if no saved changelog exists
      }
      // Clear pending changes when switching files
      pendingChanges.clear();
      updateChangeLog();
      lastInitializedFilePathRef.current = currentFilePath || null;
    }
  }, [selectedFileResult?.filePath, selectedAnalysis, selectedFileResult]);

  // Use editedAnalysis for display, fallback to selectedAnalysis
  // This ensures all tabs use the latest edited data
  const displayAnalysis = useMemo(() => {
    return editedAnalysis || selectedAnalysis;
  }, [editedAnalysis, selectedAnalysis]);

  // Handler to scroll PDF to a specific page
  const handleScrollToPage = (pageNumber: number) => {
    if (!pdfContainerRef.current || !pageNumber || pageNumber <= 0) return;

    // Ensure hospital bill is active for medical admissibility
    if (hospitalBill) {
      setActivePdfFile("hospital");
    }

    // Small delay to ensure PDF pages are rendered
    setTimeout(() => {
      if (!pdfContainerRef.current) return;

      // Find the page element by its data-page-number attribute
      const pageElements =
        pdfContainerRef.current.querySelectorAll("[data-page-number]");

      for (const el of Array.from(pageElements)) {
        const pageNum = parseInt(
          (el as HTMLElement).getAttribute("data-page-number") || "0",
        );
        if (pageNum === pageNumber) {
          // Scroll to the page element
          (el as HTMLElement).scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          break;
        }
      }
    }, 100);
  };

  const handleScrollToTariffPage = (pageNumber?: number | null) => {
    if (!pdfContainerRef.current || !pageNumber || pageNumber <= 0) return;
    if (!tariffFile) return;

    setActivePdfFile("tariff");

    setTimeout(() => {
      if (!pdfContainerRef.current) return;

      const pageElements =
        pdfContainerRef.current.querySelectorAll("[data-page-number]");

      for (const el of Array.from(pageElements)) {
        const pageNum = parseInt(
          (el as HTMLElement).getAttribute("data-page-number") || "0",
        );
        if (pageNum === pageNumber) {
          (el as HTMLElement).scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          break;
        }
      }
    }, 150);
  };

  const formatAmountValue = (amount?: number | null) => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return "—";
    }
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const claimCalculation = useMemo(() => {
    if (!displayAnalysis) return null;
    return computeClaimCalculation(displayAnalysis);
  }, [displayAnalysis]);

  // Financial Summary Calculations
  const financialSummaryTotals = useMemo(() => {
    if (!claimCalculation) {
      return {
        hospitalBillAfterDiscount: 0,
        hospitalBillBeforeDiscount: 0,
        discount: 0,
        totalTariffDeductible: 0,
        totalTariffOverflow: 0,
        policyCoverageWithinTariff: 0,
        totalNME: 0,
        insurerPayable: 0,
        patientPayable: 0,
        cataractSublimit: null,
      };
    }
    return {
      hospitalBillAfterDiscount: claimCalculation.hospitalBillAfterDiscount,
      hospitalBillBeforeDiscount: claimCalculation.hospitalBillBeforeDiscount,
      discount: claimCalculation.discount,
      totalTariffDeductible: 0,
      totalTariffOverflow: 0,
      policyCoverageWithinTariff: 0,
      totalNME: 0,
      insurerPayable: claimCalculation.insurerPayable,
      patientPayable: 0,
      cataractSublimit: null,
    };
  }, [claimCalculation]);

  const finalInsurerPayable =
    claimCalculation?.finalInsurerPayable ?? displayAnalysis?.finalInsurerPayable;
  const finalInsurerPayableNotes =
    claimCalculation?.finalInsurerPayableNotes ||
    displayAnalysis?.finalInsurerPayableNotes;

  const handleSave = async () => {
    if (!editedAnalysis || !selectedFileResult) return;

    setIsSaving(true);
    try {
      // Move pending changes to changelog before saving
      // Group by tab+record+field to merge multiple changes to same field
      // Get all entries (not reversed, so we can process chronologically)
      const allPendingEntries = pendingChanges.getEntries().reverse(); // Reverse to get chronological order
      const mergedEntries = new Map<
        string,
        {
          tab: string;
          record: string;
          field: string;
          originalValue: string;
          finalValue: string;
        }
      >();

      // Group entries by tab+record+field
      const entriesByKey = new Map<string, typeof allPendingEntries>();
      allPendingEntries.forEach((entry) => {
        const key = `${entry.tab}|${entry.record}|${entry.field}`;
        if (!entriesByKey.has(key)) {
          entriesByKey.set(key, []);
        }
        entriesByKey.get(key)!.push(entry);
      });

      // For each field, use the first entry's previousValue and last entry's newValue
      entriesByKey.forEach((entries, key) => {
        // Entries are already in chronological order
        const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];
        mergedEntries.set(key, {
          tab: firstEntry.tab,
          record: firstEntry.record,
          field: firstEntry.field,
          originalValue: firstEntry.previousValue,
          finalValue: lastEntry.newValue,
        });
      });

      // Add merged entries to changelog
      mergedEntries.forEach((entry) => {
        changeLog.addEntry(
          entry.tab,
          entry.record,
          entry.field,
          entry.originalValue,
          entry.finalValue,
        );
      });
      // Clear pending changes after moving to changelog
      pendingChanges.clear();
      updateChangeLog();

      // Serialize changelog entries for persistence
      const changelogEntries = changeLog.serialize();

      const recalculatedClaim = computeClaimCalculation(editedAnalysis);
      const analysisToSave: PdfAnalysis = {
        ...editedAnalysis,
        baseInsurerPayable: recalculatedClaim.insurerPayable,
        benefitAmount:
          recalculatedClaim.benefitAmount ?? editedAnalysis.benefitAmount,
        finalInsurerPayable:
          recalculatedClaim.finalInsurerPayable ?? undefined,
        finalInsurerPayableNotes:
          recalculatedClaim.finalInsurerPayableNotes || undefined,
      };

      await updateResult({
        filePath: selectedFileResult.filePath,
        analysis: analysisToSave,
        changelogEntries:
          changelogEntries.length > 0 ? changelogEntries : undefined,
      });

      setEditedAnalysis(analysisToSave);

      alert("Changes saved successfully!");
    } catch (error) {
      console.error("Error saving:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save changes. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (!editedAnalysis || !selectedAnalysis) return false;
    return JSON.stringify(editedAnalysis) !== JSON.stringify(selectedAnalysis);
  }, [editedAnalysis, selectedAnalysis]);

  const changeLogEntries = useMemo(
    () => changeLog.getEntries(),
    [changeLogVersion, changeLog],
  );

  const fileName = selectedFileResult
    ? getBasename(selectedFileResult.filePath)
    : "—";

  const handleAnalysisUpdate = (
    updater: (analysis: PdfAnalysis) => PdfAnalysis,
  ) => {
    setEditedAnalysis((prev) => {
      const base = prev || selectedAnalysis;
      if (!base) return prev;
      const updated = updater({ ...base });
      return updated;
    });
  };

  // Show processing logs when:
  // 1. Currently processing
  // 2. Status is idle
  // 3. No analysis available (regardless of status) - this includes error cases
  const hasLogs = (state?.logs?.length ?? 0) > 0;
  const isAwaitingResults =
    isProcessing || state?.status === "idle" || !selectedAnalysis;
  const shouldShowProcessingLogs =
    !showSampleData && (isAwaitingResults || isLogsPanelForced);
  const canToggleLogsPanel = !showSampleData && !isAwaitingResults && hasLogs;

  useEffect(() => {
    if (
      (!hasLogs || showSampleData) &&
      isLogsPanelForced &&
      !isAwaitingResults
    ) {
      setIsLogsPanelForced(false);
    }
  }, [hasLogs, isLogsPanelForced, isAwaitingResults, showSampleData]);

  const handlePdfWidthChange = (width: number) => {
    setPdfWidth(width);
  };

  useEffect(() => {
    const container = reportScrollRef.current;
    if (!container) return;

    const sectionElements = reportSections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sectionElements.length === 0) return;

    let raf = 0;
    const updateActive = () => {
      raf = 0;
      const containerTop = container.getBoundingClientRect().top;
      const activationOffset = 80;
      let current = sectionElements[0].id;

      for (const section of sectionElements) {
        const offset = section.getBoundingClientRect().top - containerTop;
        if (offset <= activationOffset) {
          current = section.id;
        } else {
          break;
        }
      }

      setActiveSection(current);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(updateActive);
    };

    const onResize = () => {
      updateActive();
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    updateActive();

    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reportSections, selectedFileResult?.filePath]);

  return (
    <main className="flex-1 w-full h-full overflow-hidden">
      {canToggleLogsPanel && (
        <div className="flex justify-end gap-2 px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsLogsPanelForced((prev) => !prev)}
          >
            {isLogsPanelForced ? "View Analysis" : "View Logs"}
          </Button>
        </div>
      )}
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {/* Tabs Content - Left Side */}
        <ResizablePanel
          defaultSize={40}
          className="flex h-full min-w-0 flex-col overflow-hidden border-r border-slate-200/80 bg-gradient-to-b from-slate-50 to-white"
        >
          {shouldShowProcessingLogs ? (
            <ProcessingLogs
              isProcessing={isProcessing}
              state={state}
              showLogs={logContentVisible}
              onToggleLogs={setLogContentVisible}
              logs={logs}
            />
          ) : selectedFileResult && selectedAnalysis ? (
            <div className="flex h-full w-full flex-col overflow-hidden">
              <div className="sticky top-0 z-10 w-full bg-background px-3 py-2">
                <div>
                  <div className="group/tabs" data-orientation="horizontal">
                    <div
                      data-slot="tabs-list"
                      data-variant="default"
                      className={cn(
                        tabsListVariants({ variant: "default" }),
                         "grid w-full grid-cols-4",
                      )}
                    >
                      {reportSections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          data-active={
                            activeSection === section.id ? true : undefined
                          }
                          onClick={() => {
                            const target = document.getElementById(section.id);
                            if (target) {
                              setActiveSection(section.id);
                              target.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }
                          }}
                           className={cn(
                             "gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-sm font-medium group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                             "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
                             "data-active:bg-background dark:data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 data-active:text-foreground",
                             "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
                            )}
                        >
                          {section.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div
                ref={reportScrollRef}
                className="flex-1 overflow-y-auto scroll-smooth scroll-pt-0 px-3 pb-8 pt-3"
              >
                <section id="patient" className="py-2">
                  <PatientInfoTab
                    fileName={fileName}
                    displayAnalysis={displayAnalysis || null}
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                    onSave={handleSave}
                    onUpdateAnalysis={handleAnalysisUpdate}
                    addChangeLogEntry={addChangeLogEntry}
                    onScrollToPage={handleScrollToPage}
                  />
                </section>
                <section id="medicalAdmissibility" className="py-2">
                  <MedicalAdmissibilityTab
                    fileName={fileName}
                    medicalAdmissibility={displayAnalysis?.medicalAdmissibility}
                    onScrollToPage={handleScrollToPage}
                  />
                </section>
                <section id="financialSummary" className="py-2">
                  <FinancialSummaryTab
                    fileName={fileName}
                    claimCalculation={claimCalculation}
                    financialSummaryTotals={financialSummaryTotals}
                    finalInsurerPayable={finalInsurerPayable}
                    finalInsurerPayableNotes={finalInsurerPayableNotes}
                    formatAmountValue={formatAmountValue}
                    lensType={displayAnalysis?.lensType}
                    lensTypePageNumber={displayAnalysis?.lensTypePageNumber}
                    lensTypeApproved={displayAnalysis?.lensTypeApproved}
                    eyeType={displayAnalysis?.eyeType}
                    isAllInclusivePackage={displayAnalysis?.isAllInclusivePackage ?? false}
                    tariffPageNumber={displayAnalysis?.tariffPageNumber}
                    tariffNotes={displayAnalysis?.tariffNotes}
                    tariffClarificationNote={displayAnalysis?.tariffClarificationNote}
                    tariffExtractionItem={displayAnalysis?.tariffExtractionItem}
                    hospitalBillBreakdown={displayAnalysis?.hospitalBillBreakdown}
                    hospitalBillPageNumber={displayAnalysis?.totalAmount?.pageNumber}
                    benefitAmount={claimCalculation?.benefitAmount ?? displayAnalysis?.benefitAmount}
                    onHospitalAmountClick={(pageNumber) => {
                      if (pageNumber) {
                        handleScrollToPage(pageNumber);
                      }
                    }}
                    onTariffAmountClick={handleScrollToTariffPage}
                  />
                </section>
                <section id="changelog" className="py-2">
                  <ChangeLogTab
                    fileName={fileName}
                    entries={changeLogEntries}
                  />
                </section>
                <div className="mt-6 border-t border-border/80 py-4">
                  <div className="flex items-center">
                    <div
                      data-slot="button-group"
                      className="flex w-full items-center gap-2"
                    >
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => setReviewDecision("approve")}
                        className={`flex-1 !border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700 ${
                          reviewDecision === "approve"
                            ? "ring-2 ring-emerald-300 ring-offset-1"
                            : ""
                        }`}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => setReviewDecision("deny")}
                        className={`flex-1 !border-rose-700 !bg-rose-600 !text-white hover:!bg-rose-700 ${
                          reviewDecision === "deny"
                            ? "ring-2 ring-rose-300 ring-offset-1"
                            : ""
                        }`}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" />
                        Deny
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => setIsQueryDialogOpen(true)}
                        className={`flex-1 !border-amber-700 !bg-amber-500 !text-white hover:!bg-amber-600 ${
                          reviewDecision === "query"
                            ? "ring-2 ring-amber-300 ring-offset-1"
                            : ""
                        }`}
                      >
                        <HelpCircle className="mr-1.5 h-4 w-4" />
                        Raise Query
                      </Button>
                    </div>
                  </div>
                </div>
                {isQueryDialogOpen ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-xl rounded-xl border border-border bg-background p-4 shadow-lg">
                      <div className="mb-3 text-base font-semibold">Raise Query</div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="text-sm font-medium">Query Type</div>
                          <Select value={queryType} onValueChange={setQueryType}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select query type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="documentation">Documentation</SelectItem>
                              <SelectItem value="coding">Coding Clarification</SelectItem>
                              <SelectItem value="billing">Billing Clarification</SelectItem>
                              <SelectItem value="clinical">Clinical Clarification</SelectItem>
                              <SelectItem value="policy">Policy Clarification</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-sm font-medium">Query Details</div>
                          <textarea
                            value={queryMessage}
                            onChange={(event) => setQueryMessage(event.target.value)}
                            placeholder="Enter query details..."
                            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsQueryDialogOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            disabled={!queryType || !queryMessage.trim()}
                            onClick={() => {
                              setReviewDecision("query");
                              setIsQueryDialogOpen(false);
                            }}
                          >
                            Submit Query
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : state?.status === "completed" && selectedFileResult ? (
            <Card className="flex-1 overflow-y-auto">
              <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No analysis data found for this file.
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1 overflow-y-auto">
              <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-slate-200/90" />

        <ResizablePanel defaultSize={60} className="h-full min-w-0 overflow-hidden bg-white">
          <PdfViewerPanel
            activePdfFile={activePdfFile}
            onActivePdfChange={(value) =>
              setActivePdfFile(value as "hospital" | "tariff" | "benefitPlan")
            }
            hospitalBill={hospitalBill}
            tariffFile={tariffFile}
            claimId={state?.claimId}
            pdfContainerRef={pdfContainerRef}
            onPdfWidthChange={handlePdfWidthChange}
            pdfPages={pdfPages}
            setPdfPages={setPdfPages}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            onDocumentLoadError={onDocumentLoadError}
            pdfWidth={pdfWidth}
            pdfError={pdfError}
            showSampleData={showSampleData}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
