/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.fftools.core;
/**
 * User: roby
 * Date: 11/18/11
 * Time: 2:15 PM
 */


import com.google.gwt.core.client.EntryPoint;
import com.google.gwt.event.logical.shared.ResizeEvent;
import com.google.gwt.event.logical.shared.ResizeHandler;
import com.google.gwt.user.client.Window;
import edu.caltech.ipac.firefly.commands.ImageSelectDropDownCmd;
import edu.caltech.ipac.firefly.core.Application;
import edu.caltech.ipac.firefly.core.NetworkMode;
import edu.caltech.ipac.firefly.data.Request;
import edu.caltech.ipac.firefly.fftools.FFToolEnv;
import edu.caltech.ipac.firefly.task.DataSetInfoFactory;
import edu.caltech.ipac.firefly.task.IrsaPlusLsstDataSetsFactory;
import edu.caltech.ipac.firefly.util.BrowserUtil;

/**
 * @author Trey Roby
 */
public class FireflyToolsEntryPoint implements EntryPoint {

    private static final boolean USE_CORS_IF_POSSIBLE= true;
    private Application.EventMode eventMode = Application.EventMode.WebSocket;
    private String appHelpName = null;

    public void setAppHelpName(String appHelpName) {
        this.appHelpName = appHelpName;
    }

    public void setEventMode(Application.EventMode eventMode) {
        this.eventMode = eventMode;
    }

    public void onModuleLoad() {
        start(IrsaPlusLsstDataSetsFactory.getInstance(),
              2,"generic_footer_minimal.html",
              ImageSelectDropDownCmd.COMMAND_NAME);
    }

    public void start(DataSetInfoFactory factory, int bannerOffset, String footerHtmlFile, String defCommandName) {
        boolean alone= isStandAloneApp();
        if (!alone) FFToolEnv.loadJS();
        Application.setEventMode(eventMode);  // -- uncomment for testing only, not ready  for production
        Application.setCreator(alone ?
                               new FFToolsStandaloneCreator(factory,bannerOffset, footerHtmlFile,defCommandName) :
                               new FireflyToolsEmbededCreator());
        final Application app= Application.getInstance();
        boolean useCORSForXS= BrowserUtil.getSupportsCORS() && USE_CORS_IF_POSSIBLE;
        app.setNetworkMode(alone ||  useCORSForXS ? NetworkMode.RPC : NetworkMode.JSONP);
        FFToolEnv.setApiMode(!alone);

        Request home = null;
        if (alone) {
            home = new Request(ImageSelectDropDownCmd.COMMAND_NAME, "Images", true, false);
        }
        else {
            Window.addResizeHandler(new ResizeHandler() {
                public void onResize(ResizeEvent event) {
                    app.resize();
                }
            });
        }
        app.start(home, new AppReady());
    }

    public class AppReady implements Application.ApplicationReady {
        public void ready() {
            FFToolEnv.postInitialization();
            if (isStandAloneApp()) {
                Application.getInstance().hideDefaultLoadingDiv();
                if (appHelpName != null) {
                    Application.getInstance().getHelpManager().setAppHelpName(appHelpName);
                }
            } else {
                Application.getInstance().getHelpManager().setAppHelpName("fftools-api");
            }
        }
    }

    public static native boolean isStandAloneApp() /*-{
        if ("fireflyToolsApp" in $wnd) {
            return $wnd.fireflyToolsApp;
        }
        else {
            return false;
        }
    }-*/;

}

