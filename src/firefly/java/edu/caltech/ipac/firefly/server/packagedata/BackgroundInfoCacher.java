/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.packagedata;

import edu.caltech.ipac.firefly.core.background.BackgroundState;
import edu.caltech.ipac.firefly.core.background.BackgroundStatus;
import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.firefly.server.query.BackgroundEnv;
import edu.caltech.ipac.firefly.server.events.ServerEventManager;
import edu.caltech.ipac.firefly.data.ServerEvent;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.util.event.ServerSentEventNames;
import edu.caltech.ipac.util.cache.Cache;
import edu.caltech.ipac.util.cache.StringKey;

/**
 * User: roby
 * Date: Sep 26, 2008
 * Time: 8:52:44 AM
 */
public class BackgroundInfoCacher {

    private final StringKey _key;

    //======================================================================
    //----------------------- Constructors ---------------------------------
    //======================================================================

    /**
     * Only use this constructor is you expect that the object is already in the cache
     * @param key the key for this object
     */
    public BackgroundInfoCacher(String key) {
        _key= new StringKey(key);
    }

    /**
     * Use this constructor when you want to initialize the object in the cache
     * @param key the key for this object
     * @param email user's email
     * @param baseFileName base name
     * @param title title
     */
    public BackgroundInfoCacher(String key, String email, String baseFileName, String title, ServerEvent.EventTarget target) {
        this(key);
        updateInfo(new BackgroundInfo(null, email, baseFileName, title, target, false));
    }

    public BackgroundInfo getPackageInfo() { return getInfo(); }

    //======================================================================
    //----------------------- Public Methods -------------------------------
    //======================================================================

    public void fireStatusUpdate(BackgroundInfo info) {
        if (info == null) info = getInfo();
        if (info!=null && info.getStatus() != null) {
            // only send events when job is not cancel, unless it's the canceled event.
            if (!info.isCanceled() || info.getStatus().getState().equals(BackgroundState.CANCELED)) {
                mergeInfoIntoStatus(info, info.getStatus());
                ServerEvent.EventTarget target = info.getEventTarget() == null ?
                        new ServerEvent.EventTarget(ServerEvent.Scope.USER) : info.getEventTarget();
                ServerEvent ev= new ServerEvent(ServerSentEventNames.SVR_BACKGROUND_REPORT,
                        target, info.getStatus());
                ServerEventManager.fireEvent(ev);
            }
        }
    }

    public String getBID() {
        return _key.getUniqueString();
    }

    public BackgroundStatus getStatus() {
        BackgroundInfo info= getInfo();
        return info==null ? null : info.getStatus();
    }

    public void setStatus(BackgroundStatus bgStat) {
        BackgroundInfo info= getInfo();
        if (info!=null) {
            info.setBgStat(bgStat);
            updateInfo(info);
        }
    }

    public void cancel() {
        BackgroundInfo info= getInfo();
        if (info!=null) {
            info.setCanceled(true);
            updateInfo(info);
        }
    }

    public boolean isCanceled() {
        BackgroundInfo info= getInfo();
        return info == null || info.isCanceled();
    }

    public boolean isSuccess() {
        BackgroundInfo info= getInfo();
        return  info != null
                && info.getStatus() != null
                && info.getStatus().getState() == BackgroundState.SUCCESS;
    }

    public String getEmailAddress() {
        BackgroundInfo info= getInfo();
        return (info==null) ? null : info.getEmailAddress();
    }

    public void setEmailAddress(String email) {
        BackgroundInfo info= getInfo();
        if (info!=null) {
            info.setEmail(email);
            updateInfo(info);
        }
    }

    public String getBaseFileName() {
        BackgroundInfo info= getInfo();
        return info==null ? null : info.getBaseFileName();
    }

    public void setBaseFileName(String baseFileName) {
        BackgroundInfo info= getInfo();
        if (info!=null) {
            info.setBaseFileName(baseFileName);
            updateInfo(info);
        }
    }

    public String getTitle() {
        BackgroundInfo info= getInfo();
        return info==null ? null : info.getTitle();
    }


    public ServerEvent.EventTarget getEventTarget() {
        BackgroundInfo info= getInfo();
        return info==null ? null : info.getEventTarget();
    }

    //======================================================================
    //----------------------- Private Methods -------------------------------
    //======================================================================

    private void updateInfo(BackgroundInfo info) {
        BackgroundEnv.getCache().put(_key, info);
        fireStatusUpdate(info);
    }

    private void mergeInfoIntoStatus(BackgroundInfo info, BackgroundStatus bgStatus) {
        bgStatus.setParam(ServerParams.TITLE, info.getTitle());
        bgStatus.setParam(ServerParams.EMAIL, info.getEmailAddress());
    }

    private BackgroundInfo getInfo() {
        Cache cache= BackgroundEnv.getCache();
        BackgroundInfo retval= null;
        if (cache.isCached(_key)) {
            BackgroundInfo info= (BackgroundInfo)cache.get(_key);
            if (info!=null) {
                retval= new BackgroundInfo(info.getStatus(),
                                        info.getEmailAddress(),
                                        info.getBaseFileName(),
                                        info.getTitle(),
                                        info.getEventTarget(),
                                        info.isCanceled());
            }
        }
        else {
            Logger.error( "Could not update background info, BackgroundInfo not found in cache, key: "+_key );
        }
        return retval;
    }

}

