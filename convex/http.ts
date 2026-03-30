import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// POST /api/claims/process
// Body: { claimId: string, hospitalBillBase64: string, tariffBase64?: string }
// Returns: { jobId: string }
http.route({
  path: "/api/claims/process",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { claimId, hospitalBillBase64, hospitalFileName, tariffBase64, tariffFileName } = body;

      if (!claimId || !hospitalBillBase64 || !hospitalFileName) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: claimId, hospitalBillBase64, hospitalFileName" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Upload hospital bill to storage
      const hospitalBinaryString = atob(hospitalBillBase64);            
      const hospitalBytes = new Uint8Array(hospitalBinaryString.length);
      for (let i = 0; i < hospitalBinaryString.length; i++) {
        hospitalBytes[i] = hospitalBinaryString.charCodeAt(i);
      }
      const hospitalStorageId = await ctx.storage.store(
        new Blob([hospitalBytes], { type: "application/pdf" })
      );

      // Upload tariff if provided
      let tariffStorageId = undefined;
      if (tariffBase64 && tariffFileName) {
        const tariffBinaryString = atob(tariffBase64);
        const tariffBytes = new Uint8Array(tariffBinaryString.length);
        for (let i = 0; i < tariffBinaryString.length; i++) {
          tariffBytes[i] = tariffBinaryString.charCodeAt(i);
        }
        tariffStorageId = await ctx.storage.store(
          new Blob([tariffBytes], { type: "application/pdf" })
        );
      }

      // Create job and start processing
      const jobId = await ctx.runMutation(api.jobMutations.createJobWithFiles, {
        claimId,
        hospitalStorageId,
        hospitalFileName,
        tariffStorageId,
        tariffFileName,
      });

      return new Response(
        JSON.stringify({ success: true, jobId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// GET /api/claims/status?jobId=xxx
// Returns: Full job status with results
http.route({
  path: "/api/claims/status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const jobId = url.searchParams.get("jobId");

      if (!jobId) {
        return new Response(
          JSON.stringify({ error: "Missing jobId parameter" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Note: You'll need to cast jobId to the proper type
      const job = await ctx.runQuery(api.processing.getJobById, {
        jobId: jobId as any, // Cast to Id<"processJob">
      });

      if (!job) {
        return new Response(
          JSON.stringify({ error: "Job not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(job),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;