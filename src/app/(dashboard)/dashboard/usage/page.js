"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RequestLogger, CardSkeleton, SegmentedControl } from "@/shared/components";
import UsageStats from "@/shared/components/UsageStats";
import RequestDetailsTab from "./components/RequestDetailsTab";
import ErrorClassificationTab from "./components/ErrorClassificationTab";
import ModelLeaderboardTab from "./components/ModelLeaderboardTab";
import TokenSavingsTab from "./components/TokenSavingsTab";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
];

const MAIN_TABS = [
  { value: "overview", label: "Overview", icon: "monitoring" },
  { value: "details", label: "Details", icon: "receipt_long" },
  { value: "errors", label: "Errors", icon: "error_outline" },
  { value: "leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { value: "savings", label: "Savings", icon: "savings" },
];

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [period, setPeriod] = useState("today");

  const tabFromUrl = searchParams.get("tab");
  const activeTab =
    tabFromUrl && ["overview", "logs", "details", "errors", "leaderboard", "savings"].includes(tabFromUrl)
      ? tabFromUrl
      : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
  };

  const showPeriodSelector = ["overview", "errors", "leaderboard", "savings"].includes(activeTab);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Control Bar: Sub-tabs and Period Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-1 rounded-[6px]">
        <SegmentedControl
          options={MAIN_TABS}
          value={activeTab}
          onChange={handleTabChange}
          className="w-full sm:w-auto"
        />

        {showPeriodSelector && (
          <SegmentedControl
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            size="sm"
            className="w-full sm:w-auto self-start sm:self-auto"
          />
        )}
      </div>

      {/* Main Tab Views */}
      <div className="min-w-0">
        {activeTab === "overview" && (
          <Suspense fallback={<CardSkeleton />}>
            <UsageStats period={period} setPeriod={setPeriod} hidePeriodSelector />
          </Suspense>
        )}
        {activeTab === "logs" && <RequestLogger />}
        {activeTab === "details" && <RequestDetailsTab />}
        {activeTab === "errors" && <ErrorClassificationTab period={period} />}
        {activeTab === "leaderboard" && <ModelLeaderboardTab period={period} />}
        {activeTab === "savings" && <TokenSavingsTab period={period} />}
      </div>
    </div>
  );
}
