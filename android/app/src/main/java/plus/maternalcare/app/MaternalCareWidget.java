package plus.maternalcare.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The home-screen widget.
 *
 * Draws from the snapshot the app last handed over (WidgetPlugin.update),
 * kept in SharedPreferences. Everything the launcher can ask for goes through
 * {@link #render}: the periodic refresh, a resize, a tap for the next
 * message, and a fresh snapshot from the app.
 *
 * Two things are worked out here, at draw time, rather than taken from the
 * snapshot — the week and days to go (from her LMP and due date) and which
 * small message to show (from the hour) — so a widget that has not seen the
 * app for a few days still says the right week and still changes through
 * the day. The message rule matches src/lib/widget.ts exactly, so the
 * preview in the app and the widget agree.
 *
 * What fits depends on the size she gave it. Each row has a known height,
 * and rows are dropped from the least important up — the reading, then the
 * baby's size, then the reminder, then the week — until what is left fits
 * the height the launcher reports. On Android 12 and later the launcher
 * reports every size it may show (portrait and landscape) and is handed a
 * view for each; before that, the portrait height is used. Rows she has
 * switched off in the app are left out at every size.
 */
public class MaternalCareWidget extends AppWidgetProvider {

    static final String PREFS = "maternalcare.widget";
    static final String KEY_SNAPSHOT = "snapshot";
    static final String KEY_OFFSET = "offset";
    static final String ACTION_NEXT = "plus.maternalcare.app.widget.NEXT";

    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    /* ------------------------------------------------------------ storage */

    static void store(Context context, String snapshot) {
        prefs(context).edit().putString(KEY_SNAPSHOT, snapshot).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, MaternalCareWidget.class));
        for (int id : ids) render(context, mgr, id);
    }

    /* ---------------------------------------------------------- lifecycle */

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(context, mgr, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        render(context, mgr, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_NEXT.equals(intent.getAction())) {
            SharedPreferences p = prefs(context);
            p.edit().putInt(KEY_OFFSET, p.getInt(KEY_OFFSET, 0) + 1).apply();
            refreshAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    /* ------------------------------------------------------------ drawing */

    static void render(Context context, AppWidgetManager mgr, int id) {
        Bundle opts = mgr.getAppWidgetOptions(id);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<SizeF> sizes = opts.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty()) {
                Map<SizeF, RemoteViews> bySize = new HashMap<>();
                for (SizeF size : sizes) bySize.put(size, build(context, size.getWidth(), size.getHeight()));
                mgr.updateAppWidget(id, new RemoteViews(bySize));
                return;
            }
        }
        // MIN_HEIGHT is the landscape height; MAX_HEIGHT is what a phone held upright shows
        int w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        mgr.updateAppWidget(id, build(context, w, h));
    }

    /* rough heights of each row in dp, from the layout's paddings and text sizes */
    private static final int H_PADDING = 28;
    private static final int H_WEEK = 22;
    private static final int H_BABY = 20;
    private static final int H_MESSAGE = 64;                // two lines in the pill, plus its margin
    private static final int H_REMINDER = 25;
    private static final int H_READING = 23;

    /** The widget at one size. A width or height of 0 means "unknown": everything is shown. */
    static RemoteViews build(Context context, float widthDp, float heightDp) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_maternalcare);

        // the whole widget opens the app
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        // the message flips to the next one
        Intent next = new Intent(context, MaternalCareWidget.class).setAction(ACTION_NEXT);
        v.setOnClickPendingIntent(R.id.row_message, PendingIntent.getBroadcast(
            context, 1, next, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        JSONObject snap = null;
        try {
            String raw = prefs(context).getString(KEY_SNAPSHOT, null);
            if (raw != null) snap = new JSONObject(raw);
        } catch (Exception ignored) {
            snap = null;
        }

        if (snap == null) {
            // nothing handed over yet — she has not opened the app on this phone
            v.setViewVisibility(R.id.row_week, View.GONE);
            v.setViewVisibility(R.id.baby_size, View.GONE);
            v.setViewVisibility(R.id.row_message, View.GONE);
            v.setViewVisibility(R.id.row_reminder, View.GONE);
            v.setViewVisibility(R.id.row_reading, View.GONE);
            v.setViewVisibility(R.id.empty_text, View.VISIBLE);
            return v;
        }
        v.setViewVisibility(R.id.empty_text, View.GONE);

        JSONObject show = snap.optJSONObject("show");
        boolean wantWeek = show == null || show.optBoolean("week", true);
        boolean wantMessage = show == null || show.optBoolean("message", true);
        boolean wantReminder = show == null || show.optBoolean("reminder", true);
        boolean wantReading = show == null || show.optBoolean("reading", true);

        long now = System.currentTimeMillis();

        /* ------------------------------------------------------- the week */
        String name = snap.optString("name", "");
        long lmp = snap.optLong("lmpMs", 0);
        long edd = snap.optLong("eddMs", 0);
        int snapWeek = snap.isNull("week") ? -1 : snap.optInt("week", -1);
        boolean pregnant = lmp > 0 && edd > 0;
        String weekTitle;
        String weekSub = "";
        String babySize = null;
        if (pregnant) {
            int week = (int) Math.max(0, (now - lmp) / (7 * DAY_MS));
            // rounded, as the server counts daysLeft, so the widget agrees with the app
            long daysToGo = Math.round((edd - now) / (double) DAY_MS);
            String tri = week < 14 ? "first" : (week < 28 ? "second" : "third");
            weekTitle = "Week " + week + " · " + tri + " trimester";
            weekSub = daysToGo > 0 ? daysToGo + " days to go" : (daysToGo == 0 ? "Due today" : "");
            // the size line was written for the snapshot's week; a later week has outgrown it
            if (week == snapWeek && !snap.isNull("babySize")) babySize = snap.optString("babySize", null);
        } else {
            weekTitle = name.isEmpty() ? "MaternalCare+" : "Good to see you, " + name;
        }

        /* ---------------------------------------------------- the message */
        JSONObject message = chooseMessage(snap.optJSONArray("messages"), prefs(context).getInt(KEY_OFFSET, 0), now);

        /* --------------------------------------------------- the reminder */
        String reminderText = null;
        JSONArray reminders = snap.optJSONArray("reminders");
        if (reminders != null) {
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject r = reminders.optJSONObject(i);
                if (r == null) continue;
                long at = r.optLong("atMs", 0);
                if (at >= now - 60 * 60 * 1000) {
                    reminderText = r.optString("title", "Reminder") + " · " + when(at, now);
                    break;
                }
            }
        }

        /* ---------------------------------------------------- the reading */
        String readingText = null;
        JSONObject reading = snap.optJSONObject("reading");
        if (reading != null) {
            readingText = reading.optString("title", "") + " · " + reading.optInt("mins", 3) + " min";
        }

        /* ------------------------------------------------ what fits where */
        boolean showWeek = wantWeek;
        boolean showBaby = wantWeek && babySize != null;
        boolean showMessage = wantMessage && message != null;
        boolean showReminder = wantReminder;
        boolean showReading = wantReading && readingText != null;
        if (!showWeek && !showMessage && !showReminder && !showReading) {
            showWeek = true;                       // never a blank card
        }
        if (heightDp > 0) {
            // drop rows from the bottom of the list until the rest fits
            int budget = (int) heightDp - H_PADDING;
            if (showReading && needed(showWeek, showBaby, showMessage, showReminder, true) > budget) showReading = false;
            if (showBaby && needed(showWeek, true, showMessage, showReminder, showReading) > budget) showBaby = false;
            if (showReminder && needed(showWeek, showBaby, showMessage, true, showReading) > budget) showReminder = false;
            if (showWeek && showMessage && needed(true, showBaby, true, showReminder, showReading) > budget) showWeek = false;
        }
        // a narrow widget has no room for the days-to-go beside the week
        if (widthDp > 0 && widthDp < 220) weekSub = "";

        v.setViewVisibility(R.id.row_week, showWeek ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.week_title, weekTitle);
        v.setTextViewText(R.id.week_sub, weekSub);
        v.setViewVisibility(R.id.week_sub, weekSub.isEmpty() ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.baby_size, showWeek && showBaby ? View.VISIBLE : View.GONE);
        if (babySize != null) v.setTextViewText(R.id.baby_size, babySize);

        v.setViewVisibility(R.id.row_message, showMessage ? View.VISIBLE : View.GONE);
        if (showMessage) {
            v.setTextViewText(R.id.message_text, message.optString("text", ""));
            v.setImageViewResource(R.id.message_icon, iconFor(message.optString("icon", "heart")));
        }

        v.setViewVisibility(R.id.row_reminder, showReminder ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.reminder_text, reminderText != null ? reminderText : "No reminders coming up");

        v.setViewVisibility(R.id.row_reading, showReading ? View.VISIBLE : View.GONE);
        if (readingText != null) v.setTextViewText(R.id.reading_text, readingText);

        return v;
    }

    /** The height, in dp, these rows take together. */
    private static int needed(boolean week, boolean baby, boolean message, boolean reminder, boolean reading) {
        return (week ? H_WEEK : 0) + (week && baby ? H_BABY : 0) + (message ? H_MESSAGE : 0)
            + (reminder ? H_REMINDER : 0) + (reading ? H_READING : 0);
    }

    /* ------------------------------------------------------------ helpers */

    /** 05–11 morning, 11–17 afternoon, 17–22 evening, otherwise night — as lib/widget.ts. */
    private static String timeOfDay(Calendar c) {
        int h = c.get(Calendar.HOUR_OF_DAY);
        if (h >= 5 && h < 11) return "morning";
        if (h >= 11 && h < 17) return "afternoon";
        if (h >= 17 && h < 22) return "evening";
        return "night";
    }

    /**
     * The same rule as chooseMessage in lib/widget.ts: messages that fit the
     * time of day (or any time), one picked by a seed that moves every three
     * hours plus however many times she has tapped.
     */
    static JSONObject chooseMessage(JSONArray all, int offset, long now) {
        if (all == null || all.length() == 0) return null;
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        String slot = timeOfDay(c);
        List<JSONObject> fitting = new ArrayList<>();
        List<JSONObject> every = new ArrayList<>();
        for (int i = 0; i < all.length(); i++) {
            JSONObject m = all.optJSONObject(i);
            if (m == null) continue;
            every.add(m);
            String when = m.optString("when", "any");
            if (when.equals(slot) || when.equals("any")) fitting.add(m);
        }
        List<JSONObject> pool = fitting.isEmpty() ? every : fitting;
        if (pool.isEmpty()) return null;
        int seed = c.get(Calendar.DAY_OF_YEAR) * 8 + c.get(Calendar.HOUR_OF_DAY) / 3;
        int n = pool.size();
        int index = (((seed + offset) % n) + n) % n;
        return pool.get(index);
    }

    /** "Today 9:00 PM", "Tomorrow 8:30 AM", "Thu 10:00 AM". */
    private static String when(long at, long now) {
        Calendar a = Calendar.getInstance(); a.setTimeInMillis(at);
        Calendar n = Calendar.getInstance(); n.setTimeInMillis(now);
        String time = new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(at));
        if (sameDay(a, n)) return "Today " + time;
        n.add(Calendar.DAY_OF_YEAR, 1);
        if (sameDay(a, n)) return "Tomorrow " + time;
        return new SimpleDateFormat("EEE", Locale.getDefault()).format(new Date(at)) + " " + time;
    }

    private static boolean sameDay(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR)
            && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }

    /** The vector under res/drawable for a message's icon name; a heart when unknown. */
    private static int iconFor(String name) {
        switch (name) {
            case "droplet": return R.drawable.ic_w_droplet;
            case "moon": return R.drawable.ic_w_moon;
            case "sun": return R.drawable.ic_w_sun;
            case "leaf": return R.drawable.ic_w_leaf;
            case "sparkles": return R.drawable.ic_w_sparkles;
            case "footprints": return R.drawable.ic_w_footprints;
            case "wind": return R.drawable.ic_w_wind;
            case "smile": return R.drawable.ic_w_smile;
            case "ear": return R.drawable.ic_w_ear;
            default: return R.drawable.ic_w_heart;
        }
    }
}
