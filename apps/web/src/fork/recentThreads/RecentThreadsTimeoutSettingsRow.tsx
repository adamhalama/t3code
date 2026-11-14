import { useState } from "react";

import { SettingResetButton, SettingsRow } from "../../components/settings/settingsLayout";
import { searchableSetting } from "../../components/settings/settingsSearch";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES,
  RECENT_THREADS_TIMEOUT_OPTIONS,
} from "./recentThreadsMru";
import { lookupThread } from "./recentThreadLookup";
import {
  getRecentThreadsTimeoutMinutes,
  setRecentThreadsTimeoutMinutes,
} from "./recentThreadsStore";

function timeoutLabel(minutes: number): string {
  if (minutes === 0) return "Never";
  if (minutes % 60 === 0) return minutes === 60 ? "1 hour" : `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/** Settings → General → Sidebar: how long a thread you left stays in the Ctrl+Tab switcher. */
export function RecentThreadsTimeoutSettingsRow() {
  const [minutes, setMinutes] = useState(getRecentThreadsTimeoutMinutes);
  const update = (next: number) => {
    setRecentThreadsTimeoutMinutes(next, lookupThread);
    setMinutes(next);
  };
  return (
    <SettingsRow
      {...searchableSetting("recent-threads-timeout")}
      description="Threads you left longer ago than this drop out of the Ctrl+Tab switcher. The thread you came from always stays."
      resetAction={
        minutes !== DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES ? (
          <SettingResetButton
            label="recent threads timeout"
            onClick={() => update(DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES)}
          />
        ) : null
      }
      control={
        <Select
          value={String(minutes)}
          onValueChange={(value) => {
            if (value !== null) update(Number(value));
          }}
        >
          <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Recent threads timeout">
            <SelectValue>{timeoutLabel(minutes)}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {RECENT_THREADS_TIMEOUT_OPTIONS.map((option) => (
              <SelectItem hideIndicator key={option} value={String(option)}>
                {timeoutLabel(option)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
