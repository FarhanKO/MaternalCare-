package plus.maternalcare.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the bridge to the home-screen widget; must be known before the WebView loads
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
