package plus.maternalcare.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What the web layer can ask of the home-screen widget.
 *
 *   update      hand over a fresh snapshot (the JSON src/lib/widget.ts builds)
 *   status      how many widgets are placed, and whether we may offer to add one
 *   requestPin  ask the launcher to add one — Android shows its own sheet
 *
 * Nothing here decides what the widget shows; that is MaternalCareWidget,
 * reading the stored snapshot when it draws.
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    private ComponentName provider() {
        return new ComponentName(getContext(), MaternalCareWidget.class);
    }

    private boolean pinSupported(AppWidgetManager mgr) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && mgr.isRequestPinAppWidgetSupported();
    }

    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("snapshot is required");
            return;
        }
        MaternalCareWidget.store(getContext(), snapshot);
        MaternalCareWidget.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(getContext());
        int[] ids = mgr.getAppWidgetIds(provider());
        JSObject out = new JSObject();
        out.put("pinned", ids.length);
        out.put("supported", pinSupported(mgr));
        call.resolve(out);
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(getContext());
        boolean supported = pinSupported(mgr);
        boolean requested = false;
        if (supported) {
            try {
                requested = mgr.requestPinAppWidget(provider(), null, null);
            } catch (RuntimeException e) {
                // a launcher that says it supports pinning and then refuses
                requested = false;
            }
        }
        JSObject out = new JSObject();
        out.put("supported", supported);
        out.put("requested", requested);
        call.resolve(out);
    }
}
