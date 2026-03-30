"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClaimCalculationResult } from "@/src/claim-calculation";
import type {
  EyeType,
  HospitalBillBreakdownItem,
  LensTypeApproval,
  TariffBreakdownItem,
} from "@/src/types";

interface FinancialSummaryTabProps {
  fileName: string;
  claimCalculation?: ClaimCalculationResult | null;
  financialSummaryTotals: {
    hospitalBillAfterDiscount: number;
    hospitalBillBeforeDiscount: number;
    discount: number;
    insurerPayable: number;
  };
  finalInsurerPayable?: number | null;
  finalInsurerPayableNotes?: string | null;
  formatAmountValue: (amount?: number | null) => string;
  benefitAmount?: number | null;
  lensType?: string | null;
  lensTypePageNumber?: number | null;
  lensTypeApproved?: LensTypeApproval;
  eyeType?: EyeType | null;
  isAllInclusivePackage: boolean;
  tariffPageNumber?: number | null;
  tariffNotes?: string | null;
  tariffClarificationNote?: string | null;
  tariffExtractionItem?: TariffBreakdownItem[] | null;
  hospitalBillBreakdown?: HospitalBillBreakdownItem[] | null;
  hospitalBillPageNumber?: number | null;
  onHospitalAmountClick?: (pageNumber?: number | null) => void;
  onTariffAmountClick?: (pageNumber?: number | null) => void;
}

export function FinancialSummaryTab({
  claimCalculation,
  financialSummaryTotals,
  finalInsurerPayable,
  finalInsurerPayableNotes,
  formatAmountValue,
  benefitAmount,
  lensType,
  lensTypePageNumber,
  lensTypeApproved,
  isAllInclusivePackage,
  tariffNotes,
  tariffClarificationNote,
  tariffExtractionItem,
  hospitalBillBreakdown,
  hospitalBillPageNumber,
  onHospitalAmountClick,
  tariffPageNumber,
  onTariffAmountClick,
}: FinancialSummaryTabProps) {
  const normalizeAmount = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  const isLensComponent = (name?: string | null, code?: string | null) =>
    /lens|iol|implant/i.test(`${name || ""} ${code || ""}`);
  const sumLensAmountFromTariff = (items?: TariffBreakdownItem[] | null) => {
    if (!Array.isArray(items)) return null;
    return items.reduce((sum, item) => {
      const amount = normalizeAmount(item.amount);
      if (amount === null) return sum;
      return isLensComponent(item.name, item.code) ? sum + amount : sum;
    }, 0);
  };
  const sumLensAmountFromHospital = (
    items?: HospitalBillBreakdownItem[] | null,
  ) => {
    if (!Array.isArray(items)) return null;
    return items.reduce((sum, item) => {
      const amount = normalizeAmount(item.amount);
      if (amount === null) return sum;
      return isLensComponent(item.name) ? sum + amount : sum;
    }, 0);
  };

  const hospitalAmount = normalizeAmount(
    financialSummaryTotals.hospitalBillAfterDiscount,
  );
  const benefitTotal = normalizeAmount(benefitAmount);
  const tariffItems = Array.isArray(tariffExtractionItem)
    ? tariffExtractionItem
    : [];
  const tariffItemsTotal = tariffItems.reduce(
    (sum, item) => sum + (normalizeAmount(item.amount) ?? 0),
    0,
  );
  const effectiveTariffTotal = tariffItems.length > 0 ? tariffItemsTotal : null;
  const tariffLensAmount = sumLensAmountFromTariff(tariffItems);
  const hospitalLensAmount = sumLensAmountFromHospital(hospitalBillBreakdown);
  const tariffWithoutLens =
    tariffLensAmount !== null && effectiveTariffTotal !== null
      ? Math.max(effectiveTariffTotal - tariffLensAmount, 0)
      : null;
  const hospitalWithoutLens =
    hospitalAmount !== null && hospitalLensAmount !== null
      ? Math.max(hospitalAmount - hospitalLensAmount, 0)
      : null;

  const completePackage = isAllInclusivePackage;

  const totalAmountApproved =
    claimCalculation?.totalAmountApproved ??
    normalizeAmount(finalInsurerPayable) ??
    (() => {
      if (completePackage) {
        if (hospitalAmount === null || effectiveTariffTotal === null) return null;
        const packageMin = Math.min(hospitalAmount, effectiveTariffTotal);
        return benefitTotal === null
          ? packageMin
          : Math.min(packageMin, benefitTotal);
      }
      if (
        tariffWithoutLens === null ||
        hospitalWithoutLens === null ||
        tariffLensAmount === null ||
        hospitalLensAmount === null
      ) {
        if (hospitalAmount === null || effectiveTariffTotal === null) return null;
        const fallbackMin = Math.min(hospitalAmount, effectiveTariffTotal);
        return benefitTotal === null
          ? fallbackMin
          : Math.min(fallbackMin, benefitTotal);
      }
      const baseAmount = Math.min(tariffWithoutLens, hospitalWithoutLens);
      const lensAmount = Math.min(tariffLensAmount, 10000, hospitalLensAmount);
      const nonPackageTotal = baseAmount + lensAmount;
      return benefitTotal === null
        ? nonPackageTotal
        : Math.min(nonPackageTotal, benefitTotal);
    })();

  const lensTypeValue = lensType?.trim() || null;
  const lensApproved: LensTypeApproval | null = lensTypeApproved ?? null;

  const formatBoolean = (value: boolean) => (value ? "Yes" : "No");
  const formatLensTypeApproved = (value: LensTypeApproval | null) =>
    value === null ? "—" : value === "cant determine" ? "cant determine" : value ? "Yes" : "No";
  const formatDisplayAmount = (value: number | null) =>
    value === null ? "—" : `INR ${formatAmountValue(value)}`;
  const formatAppliedRule = (value?: string | null) => {
    switch (value) {
      case "policy_limit_or_hospital_package_lower":
        return "Lower of policy cataract limit and hospital package/R&C";
      case "no_policy_limit_use_hospital_package":
        return "No policy limit, so hospital package selected";
      case "no_policy_limit_package_excludes_lens":
        return "No policy limit and package excludes lens, so procedure package plus lens R&C applied";
      case "niac_no_policy_limit_lens_excluded":
        return "NIAC rule with no policy limit and package excludes lens, capped at INR 50,000";
      case "niac_flexi_floater_cap_24000":
        return "NIAC Flexi Floater cataract cap applied at INR 24,000";
      case "psu_retail_upto_5l_package_plus_lens":
        return "PSU retail up to 5L: package plus monofocal lens";
      case "psu_corporate_above_5l_package_plus_lens":
        return "PSU corporate above 5L: package plus monofocal lens";
      case "psu_corporate_above_5l_no_cataract_limit_cap_45000":
        return "PSU corporate above 5L with no cataract limit: capped at INR 45,000";
      case "psu_no_policy_limit_package_plus_lens":
        return "PSU no policy limit: package plus monofocal lens";
      case "no_policy_limit_no_package_lens_rc_only":
        return "No policy limit or package, so lens R&C only applied";
      case "policy_limit_without_package":
        return "Policy cataract limit applied without package reference";
      case "billed_amount_only":
        return "Billed amount applied";
      case "standard_billed_or_tariff":
        return "Standard billed/tariff calculation";
      default:
        return "—";
    }
  };

  const lensTypeLinkable = !!lensTypePageNumber && !!onTariffAmountClick;

  const goToLensTypePage = () => {
    if (lensTypePageNumber && onTariffAmountClick) {
      onTariffAmountClick(lensTypePageNumber);
    }
  };

  const hospitalLinkable = !!hospitalBillPageNumber && !!onHospitalAmountClick;
  const tariffLinkable = !!tariffPageNumber && !!onTariffAmountClick;

  const goToHospitalPage = () => {
    if (hospitalBillPageNumber && onHospitalAmountClick) {
      onHospitalAmountClick(hospitalBillPageNumber);
    }
  };

  const goToTariffPage = () => {
    if (tariffPageNumber && onTariffAmountClick) {
      onTariffAmountClick(tariffPageNumber);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4">
          <Card className="bg-white border-2">
            <CardContent>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Hospital bill extraction</span>
                {hospitalLinkable && (
                  <button
                    type="button"
                    onClick={goToHospitalPage}
                    className="normal-case text-xs font-medium text-blue-600"
                  >
                    Page {hospitalBillPageNumber}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {Array.isArray(hospitalBillBreakdown) &&
                hospitalBillBreakdown.length > 0 ? (
                  hospitalBillBreakdown.map((item, idx) => (
                    <div
                      key={`hospital-breakdown-${idx}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-medium text-gray-900">
                        {formatAmountValue(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-700">
                    Amount: {formatDisplayAmount(hospitalAmount)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-2 border-green-200">
            <CardContent>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold uppercase tracking-wide text-green-700">
                <span>Tariff extraction</span>
                {tariffLinkable && (
                  <button
                    type="button"
                    onClick={goToTariffPage}
                    className="normal-case text-xs font-medium text-blue-600"
                  >
                    Page {tariffPageNumber}
                  </button>
                )}
              </div>
              <div className="space-y-1 border-t border-green-200 pt-2">
                {tariffItems.length > 0 ? (
                  tariffItems.map((item, idx) => (
                    <div
                      key={`tariff-breakdown-${idx}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-green-700">{item.name}</span>
                      <span className="font-medium text-green-900">
                        {formatAmountValue(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-green-700">—</div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-2 border-purple-200">
            <CardContent>
              <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-purple-700">
                Benefit extraction
              </div>
              <div className="text-sm text-gray-700">
                {formatDisplayAmount(benefitTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">APPROVALS</h3>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-gray-700">Lens Type</span>
              <div className="flex items-center gap-3">
                {lensTypeLinkable && (
                  <button
                    type="button"
                    onClick={goToLensTypePage}
                    className="text-xs font-medium text-blue-600"
                  >
                    Page {lensTypePageNumber}
                  </button>
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {lensTypeValue || "—"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-gray-700">
                Lens Type Approved
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatLensTypeApproved(lensApproved)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-gray-700">
                Complete Package
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatBoolean(completePackage)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-300 py-2 pt-3">
              <span className="text-sm font-bold text-gray-900">
                Total Amount Approved
              </span>
              <span className="text-sm font-bold text-gray-900">
                {formatDisplayAmount(totalAmountApproved)}
              </span>
            </div>
          </div>
        </section>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>NOTES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-semibold text-gray-800">Applied Rule</div>
              <div className="text-gray-700 whitespace-pre-wrap">
                {formatAppliedRule(claimCalculation?.appliedRule)}
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-800">Tariff Notes</div>
              <div className="text-gray-700 whitespace-pre-wrap">
                {tariffNotes?.trim() ? tariffNotes : "—"}
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-800">
                Tariff Clarification Note
              </div>
              <div className="text-gray-700 whitespace-pre-wrap">
                {tariffClarificationNote?.trim()
                  ? tariffClarificationNote
                  : "—"}
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-800">
                Policy Wording Notes
              </div>
              <div className="text-gray-700 whitespace-pre-wrap">
                {finalInsurerPayableNotes?.trim()
                  ? finalInsurerPayableNotes
                  : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
