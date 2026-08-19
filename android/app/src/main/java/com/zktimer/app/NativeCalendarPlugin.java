package com.zktimer.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.CalendarContract;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

/**
 * Adds an event to the phone's own calendar app.
 *
 * Uses ACTION_INSERT rather than writing to the CalendarContract provider
 * directly: the insert intent opens the user's default calendar app on its
 * "new event" screen with everything prefilled, so the user confirms and the
 * event lands wherever they keep their events (Samsung Calendar, Google
 * Calendar, Outlook, whatever the phone ships). It also needs NO permission,
 * which a direct provider write would.
 */
@CapacitorPlugin(name = "NativeCalendar")
public class NativeCalendarPlugin extends Plugin {

    private static final long DAY_MS = 24L * 60L * 60L * 1000L;

    /**
     * Only proves the plugin exists in this binary.
     *
     * Deliberately does NOT probe the package manager. resolveActivity() returns
     * null on API 30+ unless the manifest declares a matching <queries> element,
     * so it would report "no calendar app" on essentially every modern device.
     * startActivity() is not subject to that visibility filtering, so real
     * availability is discovered in addEvent via ActivityNotFoundException.
     */
    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    @PluginMethod()
    public void addEvent(PluginCall call) {
        String title = call.getString("title");
        String startDate = call.getString("startDate");
        String endDate = call.getString("endDate");

        if (title == null || title.isEmpty() || startDate == null || startDate.isEmpty()) {
            call.reject("title and startDate are required");
            return;
        }

        Long beginMs = allDayAnchorMillis(startDate);
        if (beginMs == null) {
            call.reject("startDate must be YYYY-MM-DD");
            return;
        }

        // END_TIME is exclusive for all-day events: add a day to the last day so
        // the event covers it. Missing end date means a single-day competition.
        Long lastDayMs = endDate == null || endDate.isEmpty() ? beginMs : allDayAnchorMillis(endDate);
        if (lastDayMs == null) {
            call.reject("endDate must be YYYY-MM-DD");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, title)
            .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginMs.longValue())
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, lastDayMs + DAY_MS);

        String location = call.getString("location");
        if (location != null && !location.isEmpty()) {
            intent.putExtra(CalendarContract.Events.EVENT_LOCATION, location);
        }

        String notes = call.getString("notes");
        if (notes != null && !notes.isEmpty()) {
            intent.putExtra(CalendarContract.Events.DESCRIPTION, notes);
        }

        try {
            getActivity().startActivity(intent);

            // The handoff is all we can report. ACTION_INSERT returns
            // RESULT_CANCELED from most calendar apps even after a successful
            // save, so "the user saved it" is not knowable on Android. Saying
            // "opened" keeps the web layer from claiming a save that may not
            // have happened.
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (ActivityNotFoundException e) {
            // No calendar app installed. The web layer falls back to its own sheet.
            call.reject("NO_CALENDAR_APP");
        }
    }

    /**
     * "YYYY-MM-DD" to local NOON.
     *
     * Do not "fix" this to midnight. The receiving calendar app gets a plain
     * epoch millisecond value and there is no documented rule for which zone it
     * reads that value in, so the anchor has to survive both readings:
     *
     *   UTC midnight   -> correct if read as UTC, one day early west of UTC
     *   local midnight -> correct if read as local, one day early in every
     *                     positive offset including Turkey at UTC+3
     *   local noon     -> correct under both readings, from UTC-11 to UTC+12
     *
     * Noon is also immune to zones whose DST transition happens at midnight,
     * where the local midnight of a given date may not exist at all.
     */
    private Long allDayAnchorMillis(String isoDate) {
        String[] parts = isoDate.split("-");
        if (parts.length != 3) {
            return null;
        }
        try {
            Calendar calendar = Calendar.getInstance();
            calendar.clear();
            calendar.set(
                Integer.parseInt(parts[0]),
                Integer.parseInt(parts[1]) - 1,
                Integer.parseInt(parts[2]),
                12,
                0,
                0
            );
            return calendar.getTimeInMillis();
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
