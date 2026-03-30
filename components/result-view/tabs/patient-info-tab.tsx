"use client";

import { useMemo, useState } from "react";
import { EditableInfoField } from "@/components/result-view/editable-info-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Loader2,
  Save,
  FileText,
  RefreshCcw,
} from "lucide-react";
import type {
  PdfAnalysis,
  DocumentChecklist,
  PatientValidationField,
  PatientInfoDbSnapshot,
} from "@/src/types";

interface PatientInfoTabProps {
  fileName: string;
  displayAnalysis: PdfAnalysis | null;
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  onUpdateAnalysis: (updater: (analysis: PdfAnalysis) => PdfAnalysis) => void;
  addChangeLogEntry: (
    tab: string,
    record: string,
    field: string,
    previousValue: string | number | null | undefined,
    newValue: string | number | null | undefined
  ) => void;
  onScrollToPage?: (pageNumber: number) => void;
}

type PatientInfoFieldKey =
  | "patientName"
  | "hospitalName"
  | "patientAge"
  | "patientGender"
  | "policyNumber"
  | "invoiceNumber"
  | "admissionDate"
  | "dischargeDate"
  | "date"
  | "totalAmount"
  | "discount";

type PatientInfoFieldValue = string | number | null | undefined;
type DocumentChecklistKey = keyof DocumentChecklist;

type DbGroupId =
  | "policy"
  | "balanceSumInsured"
  | "insurerBenefits"
  | "ucrPastHistory"
  | "provider"
  | "patientHospital"
  | "payeeBank"
  | "patientEnrolled"
  | "other";

const DB_GROUP_ORDER: Array<{ id: DbGroupId; title: string }> = [
  { id: "policy", title: "Policy Details" },
  {
    id: "patientEnrolled",
    title: "Patient Enrolled Details",
  },
  { id: "balanceSumInsured", title: "Balance Sum Insured" },
  { id: "insurerBenefits", title: "InsurerBenefits" },
  { id: "provider", title: "Provider Details" },
  {
    id: "ucrPastHistory",
    title: "Usual, Customary and Reasonable Charges Report [UCR] & Hospital Past History",
  },
  { id: "other", title: "Additional Patient Data" },
];

const POLICY_FIELDS: Array<{ label: string; aliases: string[] }> = [
  { label: "Insurance Company", aliases: ["insurancecompany", "insurername", "companyname"] },
  { label: "Payer Name", aliases: ["payername", "payer", "payerid"] },
  { label: "Corporate Name", aliases: ["corporatename", "corporate", "corpid"] },
  { label: "Product Name", aliases: ["productname", "product", "productid"] },
  { label: "Benefit Plan Name", aliases: ["benefitplanname", "planname", "benefitplan", "bpsiid"] },
  { label: "Policy Status", aliases: ["policystatus", "status"] },
  { label: "Policy Type", aliases: ["policytypename", "policytype"] },
  { label: "Policy Start Date", aliases: ["policystartdate", "startdate", "membercommencingdate"] },
  { label: "Policy End Date", aliases: ["policyenddate", "enddate", "memberenddate"] },
  { label: "Policy Inception Date", aliases: ["policyinceptiondate", "inceptiondate"] },
  { label: "Policy Holder Address", aliases: ["policyholderaddress", "holderaddress"] },
  { label: "Agent/Broker Name", aliases: ["agentbrokername", "brokername", "agentname"] },
  { label: "Plan Years", aliases: ["planyears"] },
  { label: "Renewal Status", aliases: ["renewalstatus"] },
  { label: "Revolving policy?", aliases: ["revolvingpolicy"] },
  { label: "Coverage Type", aliases: ["coveragetype", "coveragetypeid", "coveragetypeidp21"] },
  { label: "Remarks", aliases: ["remarks", "polremarks"] },
  { label: "Notes", aliases: ["notes", "polnotes"] },
];

const HOSPITAL_FIELDS: Array<{ label: string; aliases: string[] }> = [
  { label: "Patient Name*", aliases: ["patientname"] },
  { label: "Gender*", aliases: ["gender", "genderid"] },
  { label: "Patient Relationship*", aliases: ["patientrelationship", "relationshipname", "relationship", "relationshipid"] },
  { label: "Patient UHID", aliases: ["patientuhid", "uhid"] },
  { label: "DOB", aliases: ["dob", "dateofbirth"] },
  { label: "Age", aliases: ["age"] },
  { label: "Age Type", aliases: ["agetype"] },
  { label: "Employee ID", aliases: ["employeeid"] },
  { label: "Main Member*", aliases: ["mainmembername", "mainmember"] },
  { label: "Main Member Gender*", aliases: ["mainmembergender", "genderid1", "empgenderid"] },
  { label: "Mobile*", aliases: ["mobile", "mobileno", "othermobileno", "alternatemobileno"] },
  { label: "Email", aliases: ["email"] },
  { label: "Treating Doctor Name*", aliases: ["physicianname", "treatingdoctorname"] },
  { label: "Physician Mobile", aliases: ["physicianmobile", "physicianmobileno"] },
  { label: "Any Other Mediclaim", aliases: ["anyothermediclaim"] },
  { label: "Other Mediclaim Details", aliases: ["othermediclaimdetails", "mediclaimdetails"] },
  { label: "Other Insurance Policy", aliases: ["otherinsurancepolicy", "anyotherpolicy"] },
  { label: "Other Policy Details", aliases: ["otherpolicydetails", "otherpolicydetails"] },
  { label: "Insurer UHID", aliases: ["insureruhid", "insuhidno"] },
  { label: "Physician Address", aliases: ["physicianaddress"] },
  { label: "Relative Mobile", aliases: ["relativemobile"] },
];

const PAYEE_BANK_FIELDS: Array<{ label: string; aliases: string[] }> = [
  { label: "Payee Type", aliases: ["payeetype", "nomineepayeetype"] },
  { label: "Payee Name", aliases: ["payeename", "nomineepayeename"] },
  {
    label: "Bank Account No",
    aliases: ["bankaccountno", "accountnumber", "bankaccountnumber", "nomineebankaccountno"],
  },
  {
    label: "Bank & Branch Name",
    aliases: ["bankname", "bankbranchname", "branchname", "bankbranch"],
  },
  { label: "Account Type", aliases: ["accounttype", "bankaccounttype"] },
  { label: "IFS Code", aliases: ["ifscode", "ifsccode"] },
];

const ENROLLED_FIELDS: Array<{ label: string; aliases: string[] }> = [
  { label: "Patient Relationship", aliases: ["patientrelationship", "relationshipname", "relationship", "relationshipid"] },
  { label: "Patient UHID", aliases: ["patientuhid", "uhid", "uhidno"] },
  { label: "Insurer UHID", aliases: ["insureruhid", "insuhidno"] },
  { label: "DOB (Age)", aliases: ["dob", "dateofbirth", "dobage"] },
  { label: "Member Status", aliases: ["memberstatus", "policystatus", "status"] },
  { label: "Employee ID", aliases: ["employeeid"] },
  { label: "Main Member(M/F)", aliases: ["mainmembername", "mainmember", "employeename"] },
  { label: "Track Record", aliases: ["trackrecord"] },
  { label: "Claim Registered Mobile", aliases: ["registeredmobile", "claimregisteredmobile", "mobile"] },
  { label: "Claim Registered Email", aliases: ["registeredemail", "claimregisteredemail", "email"] },
  { label: "Assignee Name", aliases: ["assigneename"] },
  { label: "Member Inception Date", aliases: ["planperiodinception", "memberinceptiondate"] },
  {
    label: "Member Commencing Date",
    aliases: ["planperiodcommencing", "membercommencingdate"],
  },
  { label: "Member End Date", aliases: ["planperiodend", "memberenddate"] },
  { label: "Member DOJ", aliases: ["doj", "memberdoj"] },
  { label: "Aadhar Number", aliases: ["aadharnumber", "aadharno", "aadharnum", "aadharid", "adharno"] },
  { label: "PAN Number", aliases: ["pannumber", "panno", "pannum", "panno"] },
  { label: "Any Pol from Other Ins Comp", aliases: ["otherinscomp", "anypolicyfromotherinsurer", "anypolfromotherinscomp"] },
  { label: "Previous Policy Number", aliases: ["prepolicyno", "previouspolicynumber"] },
  { label: "Previous Policy Start date", aliases: ["prestartdate", "previouspolicystartdate", "prevoiuspolicystartdate"] },
  { label: "Previous Policy End date", aliases: ["policypreenddate", "preenddate", "previousenddate"] },
  { label: "PED Details", aliases: ["peddetails"] },
  { label: "Any PED Description", aliases: ["anypeddescription", "peddescription"] },
  { label: "Ins_Partycode", aliases: ["partycode", "inspartycode"] },
  { label: "TxtCategory", aliases: ["txtcategory", "category"] },
  { label: "64VBComplaince", aliases: ["vb64dmsid", "64vbcomplaince", "vb64complaince", "vb64dmsidstatus"] },
  { label: "Account Manager", aliases: ["actmngr", "accountmanager"] },
  { label: "EmailID", aliases: ["emailid"] },
  { label: "Bussiness Location", aliases: ["busslocation", "businesslocation"] },
];

const PROVIDER_FIELDS: Array<{ label: string; aliases: string[] }> = [
  { label: "PRC No", aliases: ["prcno", "registrationno"] },
  { label: "Pin Code", aliases: ["pincode", "providerpincode"] },
  { label: "Address1", aliases: ["address1", "provideraddress"] },
  { label: "Address 2", aliases: ["address2"] },
  { label: "Country", aliases: ["country", "countryname"] },
  { label: "State", aliases: ["state", "statename"] },
  { label: "District", aliases: ["district", "districtname"] },
  { label: "City", aliases: ["city", "cityname", "provider_city_name"] },
  { label: "Location Name", aliases: ["locationname", "location"] },
  { label: "Registered Email", aliases: ["registeredemail", "regemailid", "email", "emailid"] },
  { label: "Registered MobileNo", aliases: ["registeredmobileno", "regmobileno", "mobileno", "mobile"] },
  { label: "IRDA Code", aliases: ["irdacode", "irda"] },
  { label: "Rohini Code", aliases: ["rohinicode", "rohini"] },
  { label: "Zone Name", aliases: ["zonename", "zone"] },
  { label: "Phone No", aliases: ["phoneno", "reglandlineno", "phone", "contactno"] },
  { label: "PRN NO", aliases: ["prnno", "prnnumber", "prn"] },
  { label: "Total No of Beds", aliases: ["totalnoofbeds", "noofbeds", "beds"] },
  { label: "Is GIPSA PPN", aliases: ["isgipsappn", "isgipsa", "gipsappn"] },
];

const INSURER_BENEFIT_FIELDS: Array<{ label: string; aliases: string[] }> = [
  { label: "Benefit Name", aliases: ["benefitname", "name", "servicename", "title"] },
  { label: "Category", aliases: ["sicategery", "sicategory", "category"] },
  { label: "Covered", aliases: ["iscovered", "covered", "coverage"] },
  { label: "Limit", aliases: ["limit", "suminsured", "si", "claimlimit"] },
  { label: "Utilized", aliases: ["utilized", "utilised", "usedamount"] },
  { label: "Balance", aliases: ["balance", "remaining", "remainingbalance"] },
  { label: "Remarks", aliases: ["remarks", "remark"] },
];

const BSI_SUM_INSURED_COLUMNS: Array<{ label: string; aliases: string[] }> = [
  { label: "SI Type", aliases: ["sitypename", "sitype"] },
  { label: "SI Categery", aliases: ["sicategoryname", "sicategery", "sicategory", "category"] },
  { label: "Suminsured", aliases: ["suminsured", "suminsuredamount", "si"] },
  { label: "CBAmount", aliases: ["cbamount", "cb_amount", "cb"] },
  { label: "Reserved", aliases: ["reserved", "reservedamt", "allocatedamt"] },
  { label: "Blocked", aliases: ["blocked", "blockedamt"] },
  { label: "Utilized", aliases: ["utilized", "utilised", "utilizedamt"] },
  { label: "Balance", aliases: ["balance", "balanceamt", "remaining", "availablebalance"] },
];

const BSI_OTHER_BENEFIT_COLUMNS: Array<{ label: string; aliases: string[] }> = [
  { label: "Benefit Name", aliases: ["benefitname", "name", "servicename"] },
  { label: "SI Categery", aliases: ["sicategery", "sicategory", "category"] },
  { label: "Suminsured", aliases: ["suminsured", "limit", "si"] },
  { label: "Reserved", aliases: ["reserved", "reservedamt"] },
  { label: "Blocked", aliases: ["blocked", "blockedamt"] },
  { label: "Utilized", aliases: ["utilized", "utilised", "usedamount"] },
  { label: "Balance", aliases: ["balance", "remaining", "remainingbalance"] },
];

const HOSPITAL_PAST_HISTORY_COLUMNS: Array<{ label: string; aliases: string[] }> = [
  {
    label: "Corporate Name",
    aliases: [
      "corporatename",
      "corporate",
      "employername",
      "companyname",
      "groupname",
      "corpname",
    ],
  },
  { label: "Claim ID", aliases: ["claimid", "claimnumber"] },
  { label: "DOA", aliases: ["doa", "dateofadmission", "admissiondate"] },
  { label: "DOD", aliases: ["dod", "dateofdischarge", "dischargedate"] },
  {
    label: "Claimed Amount",
    aliases: ["claimedamount", "claimamount", "billamount", "requestedamount"],
  },
  {
    label: "Approved amount",
    aliases: ["approvedamount", "sanctionedamount", "settledamount", "payableamount"],
  },
  {
    label: "Investigation Status",
    aliases: ["investigationstatus", "investigation", "investigationremarks"],
  },
  { label: "Diagnosis-L3", aliases: ["diagnosisl3", "diagnosis", "diagnosislevel3"] },
];

export function PatientInfoTab({
  fileName,
  displayAnalysis,
  hasChanges,
  isSaving,
  onSave,
  onUpdateAnalysis,
  addChangeLogEntry,
  onScrollToPage,
}: PatientInfoTabProps) {
  const [isRefreshingDb, setIsRefreshingDb] = useState(false);
  const [dbRefreshError, setDbRefreshError] = useState<string | null>(null);
  const patientValidation = displayAnalysis?.patientValidation;
  const patientInfoDb = displayAnalysis?.patientInfoDb;
  const dbClaimId = patientInfoDb?.claimId?.trim();
  const fieldPageNumbers: Partial<Record<PatientInfoFieldKey, number | null | undefined>> = {
    patientName: displayAnalysis?.patientName?.pageNumber,
    hospitalName: displayAnalysis?.hospitalName?.pageNumber,
    patientAge: displayAnalysis?.patientAge?.pageNumber,
    patientGender: displayAnalysis?.patientGender?.pageNumber,
    policyNumber: displayAnalysis?.policyNumber?.pageNumber,
    invoiceNumber: displayAnalysis?.invoiceNumber?.pageNumber,
    admissionDate: displayAnalysis?.admissionDate?.pageNumber,
    dischargeDate: displayAnalysis?.dischargeDate?.pageNumber,
    date: displayAnalysis?.date?.pageNumber,
    totalAmount: displayAnalysis?.totalAmount?.pageNumber,
    discount: displayAnalysis?.discount?.pageNumber,
  };

  const getFieldPageNumber = (field: PatientInfoFieldKey): number | null | undefined =>
    fieldPageNumbers[field];

  const getFieldValue = (field: PatientInfoFieldKey): PatientInfoFieldValue =>
    displayAnalysis?.[field]?.value;

  const getChecklistField = (field: DocumentChecklistKey) =>
    displayAnalysis?.documentChecklist?.[field];

  const getFieldValidationInfo = (
    field: PatientValidationField["field"],
  ):
    | {
      status: "matched" | "mismatch";
      aiValue: string;
      dbValue: string;
      aiSource: string;
      dbSource: string;
    }
    | undefined => {
    if (!patientValidation || patientValidation.fields.length === 0) {
      return undefined;
    }

    const fieldResult = patientValidation.fields.find((item) => item.field === field);
    if (!fieldResult || fieldResult.aiValue === null) {
      return undefined;
    }

    return {
      status: fieldResult.isMatch ? "matched" : "mismatch",
      aiValue: String(fieldResult.aiValue),
      dbValue: fieldResult.dbValue === null ? "N/A" : String(fieldResult.dbValue),
      aiSource: fieldResult.aiSource,
      dbSource: fieldResult.dbSource,
    };
  };

  const calculateDaysInHospital = (): number | null => {
    if (!displayAnalysis?.admissionDate?.value || !displayAnalysis?.dischargeDate?.value) {
      return null;
    }

    try {
      const admission = new Date(displayAnalysis.admissionDate.value);
      const discharge = new Date(displayAnalysis.dischargeDate.value);

      if (isNaN(admission.getTime()) || isNaN(discharge.getTime())) {
        return null;
      }

      // Set to start of day to ignore time component
      const admissionDate = new Date(
        admission.getFullYear(),
        admission.getMonth(),
        admission.getDate()
      );
      const dischargeDate = new Date(
        discharge.getFullYear(),
        discharge.getMonth(),
        discharge.getDate()
      );

      // Calculate difference in days (both admission and discharge days count)
      const diffTime = dischargeDate.getTime() - admissionDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      return diffDays >= 1 ? diffDays : null;
    } catch {
      return null;
    }
  };

  const updateField = (
    key: PatientInfoFieldKey,
    value: PatientInfoFieldValue,
    fieldLabel: string
  ) => {
    if (!displayAnalysis) return;
    const previous = displayAnalysis[key]?.value;
    onUpdateAnalysis(
      (current) => ({
        ...current,
        [key]: {
          ...current[key],
          value,
        },
      } as PdfAnalysis)
    );
    addChangeLogEntry(
      "PATIENT INFO",
      "Patient Information",
      fieldLabel,
      previous,
      value === "" ? undefined : value
    );
  };

  const updateGstField = (
    key: "cgstAmount" | "sgstAmount",
    value: number | undefined
  ) => {
    if (!displayAnalysis) return;
    const previous = displayAnalysis?.gst?.value?.[key];
    onUpdateAnalysis((current) => ({
      ...current,
      gst: {
        ...(current.gst || {}),
        value: {
          ...(current.gst?.value || {}),
          [key]: value,
        },
      },
    }));
    addChangeLogEntry(
      "PATIENT INFO",
      "Patient Information",
      key.toUpperCase(),
      previous,
      value
    );
  };

  const updateDocumentChecklist = (
    key: DocumentChecklistKey,
    checked: boolean
  ) => {
    if (!displayAnalysis) return;
    const previous = displayAnalysis.documentChecklist?.[key]?.value;
    onUpdateAnalysis((current) => ({
      ...current,
      documentChecklist: {
        ...current.documentChecklist,
        [key]: {
          ...current.documentChecklist[key],
          value: checked,
        },
      },
    }));
    addChangeLogEntry(
      "PATIENT INFO",
      "Document Checklist",
      key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      previous ? "Yes" : "No",
      checked ? "Yes" : "No"
    );
  };

  const checklistItems: Array<{
    key: DocumentChecklistKey;
    label: string;
    id: string;
  }> = [
    { key: "aadharCard", label: "Aadhar Card", id: "aadharCard" },
    { key: "panCard", label: "PAN Card", id: "panCard" },
    { key: "eCard", label: "E-Card", id: "eCard" },
    {
      key: "invoiceForSurgical",
      label: "Invoice for Surgical",
      id: "invoiceForSurgical",
    },
    { key: "kyc", label: "KYC", id: "kyc" },
    { key: "claimForm", label: "Claim Form", id: "claimForm" },
  ];

  const formatDbFieldLabel = (key: string): string =>
    key
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();

  const formatDateValue = (input: Date): string => {
    const day = String(input.getDate()).padStart(2, "0");
    const month = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][input.getMonth()];
    const year = input.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const tryFormatDateLike = (
    value: string | number | boolean | null | undefined,
    fieldHint?: string,
  ): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(trimmed)) return trimmed;

    const normalizedHint = normalizeDbKey(fieldHint || "");
    const looksLikeDateField =
      normalizedHint.includes("date") ||
      normalizedHint.includes("dob") ||
      normalizedHint.includes("doj") ||
      normalizedHint.includes("commencing") ||
      normalizedHint.includes("inception") ||
      normalizedHint.includes("enddate") ||
      normalizedHint.includes("startdate");

    const isIsoOrSqlDate =
      /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(trimmed) ||
      /^\d{4}\/\d{2}\/\d{2}(?:[T\s].*)?$/.test(trimmed) ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed) ||
      /^\d{2}-\d{2}-\d{4}$/.test(trimmed) ||
      /T\d{2}:\d{2}:\d{2}/.test(trimmed);

    if (!looksLikeDateField && !isIsoOrSqlDate) return null;

    const dotNetMatch = /^\/Date\((\d+)\)\/$/.exec(trimmed);
    if (dotNetMatch) {
      const ticks = Number.parseInt(dotNetMatch[1], 10);
      if (Number.isFinite(ticks)) {
        const d = new Date(ticks);
        if (!Number.isNaN(d.getTime())) return formatDateValue(d);
      }
      return null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatDateValue(parsed);
  };

  const formatDbFieldValue = (
    value: string | number | boolean | null | undefined,
    fieldHint?: string,
  ): string => {
    if (value === null || value === undefined || value === "") return "N/A";
    const asDate = tryFormatDateLike(value, fieldHint);
    if (asDate) return asDate;
    return String(value);
  };

  const normalizeDbKey = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");

  const isPresentValue = (value: string | number | boolean | null | undefined): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  };

  const parseCodeValue = (
    value: string | number | boolean | null | undefined,
  ): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    const cleaned = String(value).trim();
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
  };

  const mapYesNoValue = (
    value: string | number | boolean | null | undefined,
  ): string => {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    const asText = formatDbFieldValue(value, "yesNo").trim();
    const lower = asText.toLowerCase();
    if (["yes", "no", "true", "false", "y", "n"].includes(lower)) {
      if (lower === "true" || lower === "y") return "Yes";
      if (lower === "false" || lower === "n") return "No";
      return lower === "yes" ? "Yes" : "No";
    }

    const code = parseCodeValue(value);
    if (code === 1) return "Yes";
    if (code === 0) return "No";
    return asText;
  };

  const mapAgeTypeValue = (
    value: string | number | boolean | null | undefined,
  ): string => {
    const asText = formatDbFieldValue(value, "ageType").trim();
    const lower = asText.toLowerCase();
    if (["year", "years", "month", "months", "day", "days"].includes(lower)) {
      if (lower.startsWith("year")) return "Years";
      if (lower.startsWith("month")) return "Months";
      if (lower.startsWith("day")) return "Days";
    }

    const code = parseCodeValue(value);
    if (code === 1) return "Years";
    if (code === 2) return "Months";
    if (code === 3) return "Days";
    return asText;
  };

  const postProcessMappedValue = (
    label: string,
    value: string | number | boolean | null | undefined,
  ): string => {
    const normalizedLabel = normalizeDbKey(label);

    if (normalizedLabel.includes("agetype")) {
      return mapAgeTypeValue(value);
    }

    if (
      normalizedLabel.includes("othermediclaim") ||
      normalizedLabel.includes("otherinsurancepolicy") ||
      normalizedLabel.includes("revolvingpolicy")
    ) {
      return mapYesNoValue(value);
    }

    return formatDbFieldValue(value, label);
  };

  const getMappedFieldValue = (
    label: string,
    rows: Array<Record<string, string | number | boolean | null>>,
    aliases: string[],
  ): string => {
    const normalizedAliases = aliases.map(normalizeDbKey);

    for (const alias of normalizedAliases) {
      for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
          if (normalizeDbKey(key) === alias && isPresentValue(value)) {
            return postProcessMappedValue(label, value);
          }
        }
      }
    }

    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (normalizedAliases.includes(normalizeDbKey(key)) && isPresentValue(value)) {
          return postProcessMappedValue(label, value);
        }
      }
    }

    return "N/A";
  };

  const areComparableValuesEqual = (left: string, right: string): boolean => {
    const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
    return normalize(left) === normalize(right);
  };

  const getDbBackedValidationInfo = (
    field: PatientValidationField["field"] | null,
    aiValue: string | number | null | undefined,
    dbValue: string,
    dbSource: string,
  ) => {
    if (field) {
      const existing = getFieldValidationInfo(field);
      if (existing) {
        return existing;
      }
    }

    const aiText = aiValue === null || aiValue === undefined ? "" : String(aiValue).trim();
    const dbText = dbValue.trim();
    if (!aiText || !dbText || dbText === "N/A") {
      return undefined;
    }

    return {
      status: areComparableValuesEqual(aiText, dbText) ? "matched" as const : "mismatch" as const,
      aiValue: aiText,
      dbValue: dbText,
      aiSource: "Extracted PDF field",
      dbSource,
    };
  };

  const renderReadOnlyField = (
    key: string,
    label: string,
    value: string | number | null | undefined,
  ) => (
    <div key={key} className="space-y-1">
      <Label htmlFor={key} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={key} value={value === null || value === undefined ? "" : String(value)} disabled readOnly />
    </div>
  );

  const safeJsonParse = (value: string): unknown => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const normalizeBenefitRows = (
    rows: Array<Record<string, unknown>>,
  ): Array<Record<string, string | number | boolean | null>> => {
    return rows.map((row) => {
      const normalized: Record<string, string | number | boolean | null> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (
          value === null ||
          value === undefined ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          normalized[key] = value ?? null;
        } else {
          normalized[key] = String(value);
        }
      });
      return normalized;
    });
  };

  const extractOtherBenefitsRows = (
    snapshot: PatientInfoDbSnapshot,
  ): Array<Record<string, string | number | boolean | null>> => {
    const benefitRows: Array<Record<string, unknown>> = [];

    snapshot.sections.forEach((section) => {
      section.rows.forEach((row) => {
        Object.entries(row).forEach(([key, raw]) => {
          const normalizedKey = normalizeDbKey(key);

          if (normalizedKey.includes("otherbenefits") && typeof raw === "string") {
            const parsed = safeJsonParse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((entry) => {
                if (entry && typeof entry === "object") {
                  benefitRows.push(entry as Record<string, unknown>);
                }
              });
            }
            return;
          }

          if (typeof raw !== "string") {
            return;
          }

          const parsed = safeJsonParse(raw);
          if (!parsed || typeof parsed !== "object") {
            return;
          }

          const asObject = parsed as Record<string, unknown>;
          const otherBenefits = asObject.OtherBenefits;
          if (Array.isArray(otherBenefits)) {
            otherBenefits.forEach((entry) => {
              if (entry && typeof entry === "object") {
                benefitRows.push(entry as Record<string, unknown>);
              }
            });
          }
        });
      });
    });

    return normalizeBenefitRows(benefitRows);
  };

  const extractSumInsuredRows = (
    snapshot: PatientInfoDbSnapshot,
  ): Array<Record<string, string | number | boolean | null>> => {
    const preferredSections = snapshot.sections.filter((section) =>
      section.name.toLowerCase().includes("balance sum insured"),
    );
    const sourceSections = preferredSections.length > 0 ? preferredSections : snapshot.sections;
    const sumInsuredRows: Array<Record<string, unknown>> = [];

    sourceSections.forEach((section) => {
      const sectionName = section.name.toLowerCase();
      const sectionLooksLikeBsi =
        sectionName.includes("balance sum insured") ||
        sectionName.includes("membersi") ||
        sectionName.includes("family sum insured") ||
        sectionName.includes("sum insured");

      section.rows.forEach((row) => {
        const keys = Object.keys(row).map((key) => key.toLowerCase());
        const rowLooksLikeBsi =
          keys.some((key) => key.includes("sicateg")) ||
          keys.some((key) => key.includes("suminsured")) ||
          keys.some((key) => key.includes("cbamount")) ||
          keys.some((key) => key.includes("utilized")) ||
          keys.some((key) => key.includes("balance"));

        if (sectionLooksLikeBsi || rowLooksLikeBsi) {
          sumInsuredRows.push(row as Record<string, unknown>);
        }

        Object.entries(row).forEach(([key, raw]) => {
          const normalizedKey = normalizeDbKey(key);
          if (normalizedKey.includes("suminsured") && typeof raw === "string") {
            const parsed = safeJsonParse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((entry) => {
                if (entry && typeof entry === "object") {
                  sumInsuredRows.push(entry as Record<string, unknown>);
                }
              });
            }
            return;
          }

          if (typeof raw !== "string") {
            return;
          }

          const parsed = safeJsonParse(raw);
          if (!parsed || typeof parsed !== "object") {
            return;
          }

          const asObject = parsed as Record<string, unknown>;
          const payloadSumInsured = asObject.Suminsured;
          if (Array.isArray(payloadSumInsured)) {
            payloadSumInsured.forEach((entry) => {
              if (entry && typeof entry === "object") {
                sumInsuredRows.push(entry as Record<string, unknown>);
              }
            });
          }
        });
      });
    });

    const deduped = Array.from(
      new Map(
        normalizeBenefitRows(sumInsuredRows).map((row) => [JSON.stringify(row), row]),
      ).values(),
    );

    return deduped;
  };

  const insurerCompanyName = patientInfoDb?.sections?.length
    ? getMappedFieldValue(
        "Insurance Company",
        patientInfoDb.sections.flatMap((section) => section.rows),
        ["insurancecompany", "insurername", "companyname"],
      )
    : "";

  const shouldShowInsurerBenefits = (() => {
    const name = (insurerCompanyName || "").toLowerCase();
    return name.includes("magma") || name.includes("kotak");
  })();

  const insurerBenefitsRows =
    patientInfoDb && shouldShowInsurerBenefits
      ? extractOtherBenefitsRows(patientInfoDb)
      : [];

  const balanceSumInsuredRows = patientInfoDb
    ? extractSumInsuredRows(patientInfoDb)
    : [];

  const resolveDbGroup = (sectionName: string, fieldKeys: string[]): DbGroupId => {
    const normalizedSection = sectionName.toLowerCase();
    const normalizedKeys = fieldKeys.map((key) => key.toLowerCase());
    const keyBlob = normalizedKeys.join(" ");

    if (
      normalizedSection.includes("membersi") ||
      normalizedSection.includes("family sum insured") ||
      normalizedSection.includes("sum insured") ||
      keyBlob.includes("sicateg") ||
      keyBlob.includes("cbamount") ||
      keyBlob.includes("suminsured")
    ) {
      return "balanceSumInsured";
    }

    if (
      normalizedSection.includes("past history") ||
      normalizedSection.includes("pasthistory") ||
      normalizedSection.includes("ucr") ||
      keyBlob.includes("pasthistory") ||
      keyBlob.includes("history") ||
      keyBlob.includes("ucr") ||
      keyBlob.includes("customary") ||
      keyBlob.includes("reasonable")
    ) {
      return "ucrPastHistory";
    }

    if (
      keyBlob.includes("account") ||
      keyBlob.includes("ifsc") ||
      keyBlob.includes("bank") ||
      keyBlob.includes("payee") ||
      normalizedSection.includes("bank") ||
      normalizedSection.includes("payee")
    ) {
      return "payeeBank";
    }

    if (
      normalizedSection.includes("provider") ||
      normalizedSection.includes("hospital") ||
      keyBlob.includes("prcno") ||
      keyBlob.includes("provider") ||
      keyBlob.includes("hospitaltype") ||
      keyBlob.includes("gstin")
    ) {
      return "provider";
    }

    if (
      normalizedSection.includes("address") ||
      keyBlob.includes("address") ||
      keyBlob.includes("district") ||
      keyBlob.includes("pincode") ||
      keyBlob.includes("city") ||
      keyBlob.includes("state") ||
      keyBlob.includes("stdcode")
    ) {
      return "patientHospital";
    }

    if (
      normalizedSection.includes("received patient") ||
      normalizedSection.includes("recpatient") ||
      keyBlob.includes("physician") ||
      keyBlob.includes("mediclaim") ||
      keyBlob.includes("patientrelationship")
    ) {
      return "patientHospital";
    }

    if (
      normalizedSection.includes("system patient") ||
      normalizedSection.includes("memberpolicy") ||
      keyBlob.includes("planperiod") ||
      keyBlob.includes("policy status") ||
      keyBlob.includes("registeredmobile") ||
      keyBlob.includes("uhid") ||
      keyBlob.includes("employeeid") ||
      keyBlob.includes("membercommencingdate")
    ) {
      return "patientEnrolled";
    }

    if (
      normalizedSection.includes("claim medical scrutiny") ||
      normalizedSection.includes("claims") ||
      normalizedSection.includes("claimdetails") ||
      keyBlob.includes("policy") ||
      keyBlob.includes("payer") ||
      keyBlob.includes("corporate") ||
      keyBlob.includes("benefitplan")
    ) {
      return "policy";
    }

    return "other";
  };

  const groupedDbSections = useMemo(() => {
    const grouped = new Map<DbGroupId, PatientInfoDbSnapshot["sections"]>(
      DB_GROUP_ORDER.map((entry) => [entry.id, []]),
    );

    if (!patientInfoDb?.sections?.length) {
      return grouped;
    }

    patientInfoDb.sections.forEach((section) => {
      const firstRow = section.rows[0] || {};
      const group = resolveDbGroup(section.name, Object.keys(firstRow));
      const current = grouped.get(group) || [];
      current.push(section);
      grouped.set(group, current);
    });

    return grouped;
  }, [patientInfoDb]);

  const renderMergedEditableField = (
    options: {
      label: string;
      fieldKey: PatientInfoFieldKey;
      dbRows: Array<Record<string, string | number | boolean | null>>;
      dbAliases: string[];
      changeLabel: string;
      validationField?: PatientValidationField["field"];
      type?: "text" | "number";
      placeholder?: string;
      showCheckmark?: boolean;
    },
  ) => {
    const dbValue = options.dbRows.length
      ? getMappedFieldValue(options.label, options.dbRows, options.dbAliases)
      : "N/A";

    return (
      <EditableInfoField
        label={options.label}
        value={getFieldValue(options.fieldKey)}
        onChange={(value) =>
          updateField(
            options.fieldKey,
            options.type === "number" ? (value ? parseFloat(value) : undefined) : value || undefined,
            options.changeLabel,
          )
        }
        type={options.type}
        placeholder={options.placeholder}
        showCheckmark={options.showCheckmark}
        validationInfo={getDbBackedValidationInfo(
          options.validationField ?? null,
          getFieldValue(options.fieldKey),
          dbValue,
          "DB procedure value",
        )}
        pageNumber={getFieldPageNumber(options.fieldKey)}
        onNavigateToPage={onScrollToPage}
      />
    );
  };

  const allDbRows = patientInfoDb?.sections.flatMap((section) => section.rows) || [];
  const enrolledDbRows =
    groupedDbSections.get("patientEnrolled")?.flatMap((section) => section.rows) || [];
  const providerDbRows =
    groupedDbSections.get("provider")?.flatMap((section) => section.rows) || [];

  const renderPatientDbSection = (snapshot: PatientInfoDbSnapshot) => {
    if (!snapshot.sections.length && (!snapshot.errors || !snapshot.errors.length)) {
      return null;
    }

    const hasMergedFieldAlert = (
      fieldKey: PatientInfoFieldKey,
      dbRows: Array<Record<string, string | number | boolean | null>>,
      dbAliases: string[],
      validationField?: PatientValidationField["field"],
    ) => {
      const info = getDbBackedValidationInfo(
        validationField ?? null,
        getFieldValue(fieldKey),
        getMappedFieldValue(fieldKey, dbRows, dbAliases),
        "DB procedure value",
      );
      return info?.status === "mismatch";
    };

    const groupHasAlert = (
      groupId: DbGroupId,
      sections: PatientInfoDbSnapshot["sections"],
    ) => {
      const allRows =
        groupId === "policy" || groupId === "patientHospital"
          ? snapshot.sections.flatMap((section) => section.rows)
          : sections.flatMap((section) => section.rows);

      if (groupId === "patientEnrolled") {
        return [
          hasMergedFieldAlert("patientName", allRows, ["patientname", "membername"], "patientName"),
          hasMergedFieldAlert("patientAge", allRows, ["age"], "patientAge"),
          hasMergedFieldAlert("patientGender", allRows, ["gender", "genderid"], "patientGender"),
        ].some(Boolean);
      }

      if (groupId === "policy") {
        return hasMergedFieldAlert(
          "policyNumber",
          allRows,
          ["policyno", "policynumber"],
          "policyNumber",
        );
      }

      if (groupId === "provider") {
        return hasMergedFieldAlert("hospitalName", allRows, ["hospitalname", "providername", "name"]);
      }

      if (groupId === "patientHospital") {
        return [
          hasMergedFieldAlert("invoiceNumber", allRows, ["claimnumber", "invoicenumber", "invoice"]),
          hasMergedFieldAlert("date", allRows, ["documentdate", "date", "createddate"]),
          hasMergedFieldAlert("admissionDate", allRows, ["dateofadmission", "doa", "admissiondate"]),
          hasMergedFieldAlert("dischargeDate", allRows, ["dateofdischarge", "dod", "dischargedate"]),
          hasMergedFieldAlert("totalAmount", allRows, ["claimedamount", "billamount", "grossamount", "totalamount"]),
          hasMergedFieldAlert("discount", allRows, ["discount", "hospitaldiscount"]),
        ].some(Boolean);
      }

      return false;
    };

    const renderSectionTable = (
      tabSections: PatientInfoDbSnapshot["sections"],
      emptyMessage: string,
      fixedColumns?: Array<{ label: string; aliases: string[] }>,
    ) => {
      const rows = tabSections.flatMap((section) => section.rows);
      if (!rows.length) {
        return <div className="text-sm text-muted-foreground">{emptyMessage}</div>;
      }

      const columns = fixedColumns?.length
        ? fixedColumns.map((column) => column.label)
        : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

      const getValueByAliases = (
        row: Record<string, string | number | boolean | null>,
        aliases: string[],
      ): string | number | boolean | null | undefined => {
        for (const [key, value] of Object.entries(row)) {
          if (aliases.includes(normalizeDbKey(key))) {
            return value;
          }
        }
        return undefined;
      };

      return (
        <Table containerClassName="max-h-[420px] rounded-md border">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{formatDbFieldLabel(column)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={`ucr-past-row-${rowIndex}`}>
                {columns.map((column) => (
                  <TableCell
                    key={`ucr-past-cell-${rowIndex}-${column}`}
                    className="whitespace-normal align-top"
                  >
                    {fixedColumns?.length
                      ? formatDbFieldValue(
                          getValueByAliases(
                            row,
                            (fixedColumns.find((item) => item.label === column)?.aliases || []).map(
                              normalizeDbKey,
                            ),
                          ),
                          column,
                        )
                      : formatDbFieldValue(row[column], column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    };

    const renderGroupContent = (
      groupId: DbGroupId,
      sections: PatientInfoDbSnapshot["sections"],
    ) => {
      if (groupId === "policy") {
        const allRows = snapshot.sections.flatMap((section) => section.rows);
        return (
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
            {POLICY_FIELDS.map((field) => {
              const value = getMappedFieldValue(field.label, allRows, field.aliases);
              return renderReadOnlyField(
                `policy-${normalizeDbKey(field.label)}`,
                field.label,
                value,
              );
            })}
          </div>
        );
      }

      if (groupId === "balanceSumInsured") {
        return (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold">Sum Insured</div>
              {balanceSumInsuredRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No records found.</div>
              ) : (
                <Table containerClassName="max-h-[420px] rounded-md border">
                  <TableHeader>
                    <TableRow>
                      {BSI_SUM_INSURED_COLUMNS.map((column) => (
                        <TableHead key={`bsi-sum-${column.label}`}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceSumInsuredRows.map((row, rowIndex) => (
                      <TableRow key={`bsi-sum-row-${rowIndex}`}>
                        {BSI_SUM_INSURED_COLUMNS.map((column) => {
                          const value = getMappedFieldValue(column.label, [row], column.aliases);
                          return (
                            <TableCell
                              key={`bsi-sum-cell-${rowIndex}-${column.label}`}
                              className="whitespace-normal align-top"
                            >
                              {value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Other Benefits</div>
              {insurerBenefitsRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No records found.</div>
              ) : (
                <Table containerClassName="max-h-[320px] rounded-md border">
                  <TableHeader>
                    <TableRow>
                      {BSI_OTHER_BENEFIT_COLUMNS.map((column) => (
                        <TableHead key={`bsi-benefit-${column.label}`}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insurerBenefitsRows.map((row, rowIndex) => (
                      <TableRow key={`bsi-benefit-row-${rowIndex}`}>
                        {BSI_OTHER_BENEFIT_COLUMNS.map((column) => {
                          const value = getMappedFieldValue(column.label, [row], column.aliases);
                          return (
                            <TableCell
                              key={`bsi-benefit-cell-${rowIndex}-${column.label}`}
                              className="whitespace-normal align-top"
                            >
                              {value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        );
      }

      if (groupId === "insurerBenefits") {
        return insurerBenefitsRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No insurer benefit rows available for this claim.
          </div>
        ) : (
          <div className="space-y-3">
            {insurerBenefitsRows.map((row, rowIndex) => (
              <div
                key={`insurer-benefit-${rowIndex}`}
                className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2"
              >
                {INSURER_BENEFIT_FIELDS.map((field) => {
                  const value = getMappedFieldValue(field.label, [row], field.aliases);
                  return renderReadOnlyField(
                    `insurer-benefit-${rowIndex}-${normalizeDbKey(field.label)}`,
                    field.label,
                    value,
                  );
                })}
              </div>
            ))}
          </div>
        );
      }

      if (groupId === "provider") {
        const allRows = sections.flatMap((section) => section.rows);
        return (
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
            {PROVIDER_FIELDS.map((field) => {
              const value = getMappedFieldValue(field.label, allRows, field.aliases);
              return renderReadOnlyField(
                `provider-${normalizeDbKey(field.label)}`,
                field.label,
                value,
              );
            })}
          </div>
        );
      }

      if (groupId === "ucrPastHistory") {
        const ucrSections = sections.filter((section) => {
          const sectionName = section.name.toLowerCase();
          if (sectionName.includes("ucr")) return true;
          const firstRow = section.rows[0] || {};
          const keys = Object.keys(firstRow).map((key) => key.toLowerCase());
          return (
            keys.some((key) => key.includes("ucr")) ||
            keys.some((key) => key.includes("customary")) ||
            keys.some((key) => key.includes("reasonable"))
          );
        });

        const pastHistorySections = sections.filter((section) => {
          const sectionName = section.name.toLowerCase();
          if (
            sectionName.includes("hospital past history") ||
            sectionName.includes("gethospitalpasthistory")
          ) {
            return true;
          }
          const firstRow = section.rows[0] || {};
          const keys = Object.keys(firstRow).map((key) => key.toLowerCase());
          return (
            keys.includes("corporate_name") ||
            keys.includes("claim_id") ||
            keys.includes("claimed_amount") ||
            keys.includes("approved_amount") ||
            keys.includes("investigation_status")
          );
        });

        const claimPastHistorySections = sections.filter((section) => {
          const sectionName = section.name.toLowerCase();
          if (
            sectionName.includes("claim past history") ||
            sectionName.includes("pasthistorydetails")
          ) {
            return true;
          }
          const firstRow = section.rows[0] || {};
          const keys = Object.keys(firstRow).map((key) => key.toLowerCase());
          return (
            keys.includes("valuetype_p18") ||
            (keys.includes("name") && keys.includes("value") && keys.includes("remarks"))
          );
        });

        if (sections.length === 0) {
          return (
            <div className="text-sm text-muted-foreground">
              No UCR / Hospital past history rows available for this claim.
            </div>
          );
        }

        return (
          <Tabs defaultValue="hospitalPastHistory" className="space-y-3">
            <TabsList>
              <TabsTrigger value="hospitalPastHistory">Hospital Past History</TabsTrigger>
              <TabsTrigger value="claimPastHistory">Claim Past History</TabsTrigger>
              <TabsTrigger value="ucr">UCR</TabsTrigger>
            </TabsList>
            <TabsContent value="hospitalPastHistory" className="mt-0">
              {renderSectionTable(
                pastHistorySections,
                "No past history details available.",
                HOSPITAL_PAST_HISTORY_COLUMNS,
              )}
            </TabsContent>
            <TabsContent value="claimPastHistory" className="mt-0">
              {renderSectionTable(
                claimPastHistorySections,
                "No claim past history details available.",
              )}
            </TabsContent>
            <TabsContent value="ucr" className="mt-0">
              {renderSectionTable(ucrSections, "No UCR details available.")}
            </TabsContent>
          </Tabs>
        );
      }

      if (groupId === "patientHospital") {
        const allRows = snapshot.sections.flatMap((section) => section.rows);
        return (
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
            {HOSPITAL_FIELDS.map((field) => {
              const value = getMappedFieldValue(field.label, allRows, field.aliases);
              return renderReadOnlyField(
                `hospital-${normalizeDbKey(field.label)}`,
                field.label,
                value,
              );
            })}
          </div>
        );
      }

      if (groupId === "payeeBank") {
        const allRows = snapshot.sections.flatMap((section) => section.rows);
        return (
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
            {PAYEE_BANK_FIELDS.map((field) => {
              const value = getMappedFieldValue(field.label, allRows, field.aliases);
              return renderReadOnlyField(
                `payee-${normalizeDbKey(field.label)}`,
                field.label,
                value,
              );
            })}
          </div>
        );
      }

      if (groupId === "patientEnrolled") {
        const allRows = snapshot.sections.flatMap((section) => section.rows);
        return (
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
            {ENROLLED_FIELDS.map((field) => {
              const value = getMappedFieldValue(field.label, allRows, field.aliases);
              return renderReadOnlyField(
                `enrolled-${normalizeDbKey(field.label)}`,
                field.label,
                value,
              );
            })}
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.name}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.name}
              </div>
              {section.rows.length === 0 ? (
                <div className="text-xs text-muted-foreground">No rows returned.</div>
              ) : (
                <div className="space-y-3">
                  {section.rows.map((row, rowIndex) => (
                    <div
                      key={`${section.name}-${rowIndex}`}
                      className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2"
                    >
                      {Object.entries(row).map(([key, value]) =>
                        renderReadOnlyField(
                          `${section.name}-${rowIndex}-${key}`,
                          formatDbFieldLabel(key),
                          formatDbFieldValue(value, key),
                        ),
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    };

    return (
      <>
        {snapshot.errors && snapshot.errors.length > 0 && (
          <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {snapshot.errors.join(" | ")}
          </div>
        )}

        <div className="space-y-4">
          {DB_GROUP_ORDER.map((group) => {
            const sections = groupedDbSections.get(group.id) || [];
            if (group.id === "insurerBenefits" && !shouldShowInsurerBenefits) {
              return null;
            }
            if (
              group.id !== "policy" &&
              group.id !== "balanceSumInsured" &&
              group.id !== "insurerBenefits" &&
              group.id !== "ucrPastHistory" &&
              group.id !== "patientHospital" &&
              group.id !== "patientEnrolled" &&
              group.id !== "provider" &&
              sections.length === 0
            ) {
              return null;
            }

            const content = renderGroupContent(group.id, sections);
            return (
              <div
                key={group.id}
                className="space-y-3 rounded-md border bg-background px-3 py-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {group.title}
                  {groupHasAlert(group.id, sections) ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : null}
                </div>
                {content}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const refreshPatientDb = async () => {
    if (!dbClaimId) {
      setDbRefreshError("Claim ID is not available for DB refresh.");
      return;
    }

    setIsRefreshingDb(true);
    setDbRefreshError(null);
    try {
      const response = await fetch("/api/patient-info-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: dbClaimId }),
      });

      const payload = (await response.json()) as {
        snapshot?: PatientInfoDbSnapshot | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to refresh DB data");
      }

      if (!payload.snapshot) {
        throw new Error("No DB snapshot returned.");
      }

      onUpdateAnalysis((current) => ({
        ...current,
        patientInfoDb: payload.snapshot ?? undefined,
      }));
    } catch (error) {
      setDbRefreshError(
        error instanceof Error ? error.message : "Failed to refresh DB data",
      );
    } finally {
      setIsRefreshingDb(false);
    }
  };

  const renderExtractedPatientInformation = () => {
    const pipelineFields: Array<{
      key: PatientInfoFieldKey;
      label: string;
      type?: "text" | "number";
      changeLabel: string;
      placeholder?: string;
      dbRows: Array<Record<string, string | number | boolean | null>>;
      dbAliases: string[];
      validationField?: PatientValidationField["field"];
      showCheckmark?: boolean;
    }> = [
      {
        key: "patientName",
        label: "Patient Name",
        changeLabel: "PATIENT NAME",
        placeholder: "Patient name",
        dbRows: enrolledDbRows,
        dbAliases: ["patientname", "membername"],
        validationField: "patientName",
      },
      {
        key: "hospitalName",
        label: "Hospital",
        changeLabel: "HOSPITAL",
        placeholder: "Hospital name",
        dbRows: providerDbRows,
        dbAliases: ["hospitalname", "providername", "name"],
      },
      {
        key: "patientAge",
        label: "Patient Age",
        changeLabel: "PATIENT AGE",
        placeholder: "Age",
        type: "number",
        dbRows: enrolledDbRows,
        dbAliases: ["age"],
        validationField: "patientAge",
      },
      {
        key: "patientGender",
        label: "Gender",
        changeLabel: "GENDER",
        placeholder: "Gender",
        dbRows: enrolledDbRows,
        dbAliases: ["gender", "genderid"],
        validationField: "patientGender",
      },
      {
        key: "policyNumber",
        label: "Policy Number",
        changeLabel: "POLICY NUMBER",
        placeholder: "Policy number",
        dbRows: allDbRows,
        dbAliases: ["policyno", "policynumber"],
        validationField: "policyNumber",
      },
      {
        key: "invoiceNumber",
        label: "Invoice Number",
        changeLabel: "INVOICE NUMBER",
        placeholder: "Invoice number",
        dbRows: allDbRows,
        dbAliases: ["claimnumber", "invoicenumber", "invoice"],
      },
      {
        key: "date",
        label: "Document Date",
        changeLabel: "DOCUMENT DATE",
        placeholder: "Document date",
        dbRows: allDbRows,
        dbAliases: ["documentdate", "date", "createddate"],
      },
      {
        key: "admissionDate",
        label: "Admission Date",
        changeLabel: "ADMISSION DATE",
        placeholder: "Admission date",
        dbRows: allDbRows,
        dbAliases: ["dateofadmission", "doa", "admissiondate"],
      },
      {
        key: "dischargeDate",
        label: "Discharge Date",
        changeLabel: "DISCHARGE DATE",
        placeholder: "Discharge date",
        dbRows: allDbRows,
        dbAliases: ["dateofdischarge", "dod", "dischargedate"],
      },
      {
        key: "totalAmount",
        label: "Bill Amount",
        changeLabel: "TOTAL AMOUNT",
        placeholder: "0.00",
        type: "number",
        dbRows: allDbRows,
        dbAliases: ["claimedamount", "billamount", "grossamount", "totalamount"],
      },
      {
        key: "discount",
        label: "Discount",
        changeLabel: "DISCOUNT",
        placeholder: "0.00",
        type: "number",
        dbRows: allDbRows,
        dbAliases: ["discount", "hospitaldiscount"],
      },
    ];

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
          {pipelineFields.map((field) => (
            <div key={field.key}>
              {renderMergedEditableField({
                label: field.label,
                fieldKey: field.key,
                dbRows: field.dbRows,
                dbAliases: field.dbAliases,
                changeLabel: field.changeLabel,
                validationField: field.validationField,
                type: field.type,
                placeholder: field.placeholder,
                showCheckmark: field.showCheckmark,
              })}
            </div>
          ))}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-muted-foreground">Days in Hospital</Label>
            </div>
            <Input
              value={(() => {
                const days = calculateDaysInHospital();
                return days !== null ? `${days} day${days !== 1 ? "s" : ""}` : "";
              })()}
              disabled
              readOnly
            />
          </div>
          <EditableInfoField
            label="CGST"
            value={displayAnalysis?.gst?.value?.cgstAmount}
            onChange={(value) =>
              updateGstField("cgstAmount", value ? parseFloat(value) : undefined)
            }
            type="number"
            placeholder="0.00"
            pageNumber={displayAnalysis?.gst?.pageNumber}
            onNavigateToPage={onScrollToPage}
          />
          <EditableInfoField
            label="SGST"
            value={displayAnalysis?.gst?.value?.sgstAmount}
            onChange={(value) =>
              updateGstField("sgstAmount", value ? parseFloat(value) : undefined)
            }
            type="number"
            placeholder="0.00"
            pageNumber={displayAnalysis?.gst?.pageNumber}
            onNavigateToPage={onScrollToPage}
          />
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
        <div>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>
            Core claim details with direct links back to the source PDF.
          </CardDescription>
          {fileName ? (
            <div className="mt-1 text-xs text-muted-foreground">File: {fileName}</div>
          ) : null}
          {patientInfoDb ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Claim: {patientInfoDb.claimId}</span>
              <span>SlNo: {patientInfoDb.slNo}</span>
              <span>Fetched: {new Date(patientInfoDb.generatedAt).toLocaleString()}</span>
            </div>
          ) : null}
          {dbRefreshError ? (
            <div className="mt-1 text-xs text-red-600">{dbRefreshError}</div>
          ) : null}
        </div>
          <div className="flex items-center gap-2">
            {patientInfoDb ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void refreshPatientDb();
                }}
                disabled={isRefreshingDb}
              >
                {isRefreshingDb ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing DB...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh DB
                  </>
                )}
              </Button>
            ) : null}
            {hasChanges && (
              <Button
                onClick={onSave}
                disabled={isSaving}
                className="bg-[#1E3A8A] hover:bg-[#1E40AF]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderExtractedPatientInformation()}

        {/* Document Checklist Section */}
        <div className="mt-6">
          <Label className="mb-3 block text-sm font-medium text-muted-foreground">
            Document Checklist
          </Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {checklistItems.map((item) => {
              const field = getChecklistField(item.key);
              const checked = field?.value === true;
              const pageNumber =
                field?.pageNumber && field.pageNumber > 0
                  ? field.pageNumber
                  : undefined;

              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between rounded-md border px-3 py-3 ${
                    checked && pageNumber && onScrollToPage
                      ? "cursor-pointer"
                      : ""
                  }`}
                  onClick={() => {
                    if (checked && pageNumber && onScrollToPage) {
                      onScrollToPage(pageNumber);
                    }
                  }}
                >
                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      id={item.id}
                      checked={checked}
                      onCheckedChange={(checked) =>
                        updateDocumentChecklist(item.key, checked === true)
                      }
                    />
                    <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer">
                      {item.label}
                    </Label>
                  </div>
                  {checked && pageNumber && (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <FileText className="w-3 h-3" />
                      Page {pageNumber}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {patientInfoDb ? renderPatientDbSection(patientInfoDb) : null}
      </CardContent>
    </Card>
  );
}
