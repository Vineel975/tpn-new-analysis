"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { NavBar } from "@/components/navbar";
import { ResultView } from "@/components/result-view";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ProcessingState } from "@/src/processing-service";
import type { ExtractionResult, PdfAnalysis } from "@/src/types";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export default function JobPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const jobId = params.id as string;

  // When ?embedded=1 is present the page is inside a Spectra <iframe>.
  // Skip the localStorage auth check and hide the navbar — Spectra manages auth.
  const isEmbedded = searchParams.get("embedded") === "1";

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfError, setPdfError] = useState<Error | null>(null);

  // Fetch job data — Convex real-time subscription updates automatically
  const jobState = useConvexQuery(
    api.processing.getJobById,
    jobId ? { jobId: jobId as Id<"processJob"> } : "skip"
  );

  const hospitalBillFile = jobState?.files?.find(
    (f) => f.fileType === "hospitalBill",
  );
  const tariffFile = jobState?.files?.find((f) => f.fileType === "tariff");

  const pdfUrl = useConvexQuery(
    api.processing.getPdfUrl,
    hospitalBillFile?.storageId
      ? { storageId: hospitalBillFile.storageId }
      : "skip"
  );

  const tariffPdfUrl = useConvexQuery(
    api.processing.getPdfUrl,
    tariffFile?.storageId
      ? { storageId: tariffFile.storageId as Id<"_storage"> }
      : "skip"
  );

  const state: ProcessingState | undefined = jobState
    ? {
        status: jobState.status as ProcessingState["status"],
        files: jobState.files.map((f) => ({
          ...f,
          status: f.status as "pending" | "processing" | "success" | "error",
        })),
        results: jobState.results,
        logs: jobState.logs,
        completed: jobState.completed,
        total: jobState.total,
        successCount: jobState.successCount,
        errorCount: jobState.errorCount,
        totalCost: jobState.totalCost,
        totalTokens: jobState.totalTokens,
        totalPromptTokens: jobState.totalPromptTokens,
        totalCompletionTokens: jobState.totalCompletionTokens,
        isComplete: jobState.isComplete,
        claimId: jobState.claimId,
        error: jobState.error,
      }
    : undefined;

  const isProcessing = state?.status === "processing";

  const selectedFileResult: ExtractionResult | null =
    state?.results && state.results.length > 0 ? state.results[0] : null;

  const selectedAnalysis: PdfAnalysis | null =
    selectedFileResult?.analysis ||
    selectedFileResult?.fallbackAnalysis ||
    null;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    setPdfError(error);
  };

  const handleStartNewReview = () => {
    router.push("/");
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    router.push("/login");
  };

  // Auth — skipped entirely when embedded inside Spectra iframe
  useEffect(() => {
    if (isEmbedded) {
      setIsAuthenticated(true);
      return;
    }
    if (typeof window !== "undefined") {
      const authStatus = localStorage.getItem("isAuthenticated");
      if (authStatus === "true") {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        router.push("/login");
      }
    }
  }, [router, isEmbedded]);

  // PDF.js worker
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("react-pdf").then((module) => {
        module.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${module.pdfjs.version}/build/pdf.worker.min.mjs`;
      });
    }
  }, []);

  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (jobState === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-muted-foreground">Loading job...</div>
      </div>
    );
  }

  if (jobState === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4">
        <div className="text-xl text-muted-foreground">Job not found</div>
        {!isEmbedded && (
          <Button type="button" variant="outline" onClick={handleStartNewReview}>
            Start New Review
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Hide navbar when running inside Spectra iframe */}
      {!isEmbedded && (
        <NavBar onLogout={handleLogout} onStartNewReview={handleStartNewReview} />
      )}

      <ResultView
        hospitalBill={pdfUrl || null}
        tariffFile={tariffPdfUrl || null}
        showSampleData={false}
        state={state as ProcessingState}
        isProcessing={isProcessing}
        selectedFileResult={selectedFileResult}
        selectedAnalysis={selectedAnalysis}
        onDocumentLoadSuccess={onDocumentLoadSuccess}
        onDocumentLoadError={onDocumentLoadError}
        pdfError={pdfError}
      />
    </div>
  );
}